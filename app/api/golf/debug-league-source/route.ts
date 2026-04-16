import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const expected = process.env.GOLF_SYNC_SECRET

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()

    const body = await req.json().catch(() => ({}))
    const leagueId = body?.leagueId as string | undefined

    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
    }

    const { data: league, error: leagueError } = await supabase
      .from('leagues_v2')
      .select('*')
      .eq('id', leagueId)
      .maybeSingle()

    if (leagueError) {
      return NextResponse.json(
        { error: `Unable to load league: ${leagueError.message}` },
        { status: 500 }
      )
    }

    const eventId = league?.event_id ?? null

    const { data: availableRows, error: availableError } = await supabase
      .from('available_event_competitors_v2')
      .select('*')
      .eq('league_id', leagueId)
      .order('seeded_order', { ascending: true })

    const { data: draftedRows, error: draftedError } = await supabase
      .from('drafted_board_v2')
      .select('*')
      .eq('league_id', leagueId)
      .order('overall_pick', { ascending: true })
      .limit(20)

    const { data: rosterRows, error: rosterError } = await supabase
      .from('manager_rosters_v2')
      .select('*')
      .eq('league_id', leagueId)
      .limit(40)

    const eventCompetitorsResult = eventId
      ? await supabase
          .from('event_competitors')
          .select('*')
          .eq('event_id', eventId)
          .limit(20)
      : { data: null, error: null }

    const competitorsResult =
      eventCompetitorsResult.data && eventCompetitorsResult.data.length > 0
        ? await supabase
            .from('competitors')
            .select('*')
            .in(
              'id',
              eventCompetitorsResult.data
                .map((row) => row.competitor_id)
                .filter(Boolean)
                .slice(0, 20)
            )
        : { data: null, error: null }

    return NextResponse.json({
      success: true,
      leagueId,
      eventId,
      league,
      sources: {
        available_event_competitors_v2: {
          error: availableError?.message ?? null,
          count: availableRows?.length ?? 0,
          sample: (availableRows ?? []).slice(0, 10),
        },
        drafted_board_v2: {
          error: draftedError?.message ?? null,
          count: draftedRows?.length ?? 0,
          sample: (draftedRows ?? []).slice(0, 10),
        },
        manager_rosters_v2: {
          error: rosterError?.message ?? null,
          count: rosterRows?.length ?? 0,
          sample: (rosterRows ?? []).slice(0, 10),
        },
        event_competitors: {
          error: eventCompetitorsResult.error?.message ?? null,
          count: eventCompetitorsResult.data?.length ?? 0,
          sample: (eventCompetitorsResult.data ?? []).slice(0, 10),
        },
        competitors: {
          error: competitorsResult.error?.message ?? null,
          count: competitorsResult.data?.length ?? 0,
          sample: (competitorsResult.data ?? []).slice(0, 10),
        },
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown debug error',
      },
      { status: 500 }
    )
  }
}