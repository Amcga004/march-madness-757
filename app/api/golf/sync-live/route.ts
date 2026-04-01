import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncEventField, upsertNormalizedLiveState } from '@/lib/golf/normalize'
import { resolveProviders } from '@/lib/golf/providers'
import type { ProviderPlayerRow, SyncProviderMode } from '@/lib/golf/providers/types'
import { refreshLiveManagerScores } from '@/lib/golf/scoring'
import { upsertRoundAndEventResults } from '@/lib/golf/results'

function deriveMode(requestedMode?: unknown): SyncProviderMode {
  if (
    requestedMode === 'mock' ||
    requestedMode === 'masters' ||
    requestedMode === 'espn' ||
    requestedMode === 'pga' ||
    requestedMode === 'espn_pga' ||
    requestedMode === 'hybrid'
  ) {
    return requestedMode
  }

  const envMode = process.env.GOLF_SYNC_MODE
  if (
    envMode === 'mock' ||
    envMode === 'masters' ||
    envMode === 'espn' ||
    envMode === 'pga' ||
    envMode === 'espn_pga' ||
    envMode === 'hybrid'
  ) {
    return envMode
  }

  return 'espn_pga'
}

function mergeProviderRows(primary: ProviderPlayerRow[], fallback: ProviderPlayerRow[]) {
  const normalizeName = (name: string) =>
    name
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/,/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  const merged = new Map<string, ProviderPlayerRow>()

  for (const row of fallback) {
    merged.set(normalizeName(row.playerName), row)
  }

  for (const row of primary) {
    merged.set(normalizeName(row.playerName), {
      ...merged.get(normalizeName(row.playerName)),
      ...row,
    })
  }

  return Array.from(merged.values())
}

export async function POST(req: Request) {
  const supabase = await createClient()

  let syncRunId: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    const leagueId = body?.leagueId as string | undefined
    const requestedMode = body?.mode
    const mode = deriveMode(requestedMode)

    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
    }

    const { data: league, error: leagueError } = await supabase
      .from('leagues_v2')
      .select('id, event_id')
      .eq('id', leagueId)
      .maybeSingle()

    if (leagueError) {
      return NextResponse.json(
        { error: `Unable to load league: ${leagueError.message}` },
        { status: 500 }
      )
    }

    if (!league?.event_id) {
      return NextResponse.json(
        { error: 'League is not connected to an event' },
        { status: 400 }
      )
    }

    const { data: syncRunRow, error: syncRunInsertError } = await supabase
      .from('golf_sync_runs')
      .insert({
        event_id: league.event_id,
        league_id: leagueId,
        source: 'internal',
        sync_type: 'field_live_and_fantasy_refresh',
        status: 'running',
        metadata: {
          trigger: 'sync-live-route',
          mode,
        },
      })
      .select('id')
      .maybeSingle()

    if (syncRunInsertError) {
      return NextResponse.json(
        { error: `Unable to create sync run: ${syncRunInsertError.message}` },
        { status: 500 }
      )
    }

    syncRunId = syncRunRow?.id ?? null

    const fieldResult = await syncEventField(league.event_id)
    const providers = await resolveProviders(league.event_id, mode)

    const liveResult = await upsertNormalizedLiveState({
      eventId: league.event_id,
      primary: providers.primary,
      fallback: providers.fallback,
    })

    const providerRowsForResults = mergeProviderRows(
      providers.primary.rows ?? [],
      providers.fallback.rows ?? []
    )

    const roundEventResult = await upsertRoundAndEventResults({
      eventId: league.event_id,
      rows: providerRowsForResults,
    })

    const scoringResult = await refreshLiveManagerScores(leagueId, league.event_id)

    if (syncRunId) {
      await supabase
        .from('golf_sync_runs')
        .update({
          status: 'success',
          completed_at: new Date().toISOString(),
          rows_written:
            (fieldResult.rowCount ?? 0) +
            (liveResult.rowCount ?? 0) +
            (roundEventResult.roundRowCount ?? 0) +
            (roundEventResult.eventRowCount ?? 0) +
            (scoringResult.managerRowCount ?? 0) +
            (scoringResult.playerRowCount ?? 0),
          metadata: {
            trigger: 'sync-live-route',
            mode,
            fieldRowCount: fieldResult.rowCount,
            liveRowCount: liveResult.rowCount,
            roundRowCount: roundEventResult.roundRowCount,
            eventResultRowCount: roundEventResult.eventRowCount,
            managerRowCount: scoringResult.managerRowCount,
            playerRowCount: scoringResult.playerRowCount,
            primarySource: providers.primary.source,
            primarySuccess: providers.primary.success,
            primaryMessage: providers.primary.message ?? null,
            fallbackSource: providers.fallback.source,
            fallbackSuccess: providers.fallback.success,
            fallbackMessage: providers.fallback.message ?? null,
          },
        })
        .eq('id', syncRunId)
    }

    return NextResponse.json({
      success: true,
      mode,
      fieldRowCount: fieldResult.rowCount,
      liveRowCount: liveResult.rowCount,
      roundRowCount: roundEventResult.roundRowCount,
      eventResultRowCount: roundEventResult.eventRowCount,
      managerRowCount: scoringResult.managerRowCount,
      playerRowCount: scoringResult.playerRowCount,
      primarySource: providers.primary.source,
      primarySuccess: providers.primary.success,
      primaryMessage: providers.primary.message ?? null,
      fallbackSource: providers.fallback.source,
      fallbackSuccess: providers.fallback.success,
      fallbackMessage: providers.fallback.message ?? null,
      syncRunId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error'

    if (syncRunId) {
      await supabase
        .from('golf_sync_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: message,
        })
        .eq('id', syncRunId)
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}