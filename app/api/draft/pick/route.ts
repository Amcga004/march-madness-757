import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/requireAuth'

export async function POST(req: Request) {
  try {
    await requireUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const body = await req.json()

    const leagueId = body?.leagueId as string | undefined
    const competitorId = body?.competitorId as string | undefined

    if (!leagueId || !competitorId) {
      return NextResponse.json(
        { error: 'leagueId and competitorId are required' },
        { status: 400 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be signed in to draft' },
        { status: 401 }
      )
    }

    const { data: leagueRow, error: leagueError } = await supabase
      .from('leagues_v2')
      .select('id, event_id, roster_size, max_members, created_by, draft_status')
      .eq('id', leagueId)
      .maybeSingle()

    if (leagueError) {
      return NextResponse.json(
        { error: `Unable to load league: ${leagueError.message}` },
        { status: 500 }
      )
    }

    if (!leagueRow) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    if (!leagueRow.event_id) {
      return NextResponse.json(
        { error: 'League is not connected to an event' },
        { status: 400 }
      )
    }

    const { data: turnData, error: turnError } = await supabase
      .from('current_draft_turn_v2')
      .select('*')
      .eq('league_id', leagueId)
      .maybeSingle()

    if (turnError) {
      return NextResponse.json(
        { error: `Unable to verify draft turn: ${turnError.message}` },
        { status: 500 }
      )
    }

    if (!turnData) {
      return NextResponse.json(
        { error: 'Draft state not found for this league' },
        { status: 404 }
      )
    }

    if (!['active', 'live'].includes(String(turnData.status ?? '').toLowerCase())) {
      return NextResponse.json(
        { error: 'Draft is not live' },
        { status: 400 }
      )
    }

    const currentDrafterUserId =
      turnData.user_id ??
      turnData.current_drafter_user_id ??
      turnData.current_drafter ??
      null

    if (!currentDrafterUserId || currentDrafterUserId !== user.id) {
      return NextResponse.json(
        { error: 'It is not your turn to draft' },
        { status: 403 }
      )
    }

    const { data: eventCompetitorRow, error: eventCompetitorError } = await supabase
      .from('event_competitors')
      .select('*')
      .eq('event_id', leagueRow.event_id)
      .eq('competitor_id', competitorId)
      .maybeSingle()

    if (eventCompetitorError) {
      return NextResponse.json(
        { error: `Unable to validate event field: ${eventCompetitorError.message}` },
        { status: 500 }
      )
    }

    if (!eventCompetitorRow) {
      return NextResponse.json(
        { error: 'That player is not part of this event field' },
        { status: 409 }
      )
    }

    if (
      Object.prototype.hasOwnProperty.call(eventCompetitorRow, 'is_active') &&
      eventCompetitorRow.is_active === false
    ) {
      return NextResponse.json(
        { error: 'That player is not currently active in the event field' },
        { status: 409 }
      )
    }

    const { data: existingPick, error: existingPickError } = await supabase
      .from('drafted_board_v2')
      .select('competitor_id')
      .eq('league_id', leagueId)
      .eq('competitor_id', competitorId)
      .maybeSingle()

    if (existingPickError) {
      return NextResponse.json(
        { error: `Unable to validate draft availability: ${existingPickError.message}` },
        { status: 500 }
      )
    }

    if (existingPick) {
      return NextResponse.json(
        { error: 'That player has already been drafted' },
        { status: 409 }
      )
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('submit_draft_pick', {
      p_league_id: leagueId,
      p_competitor_id: competitorId,
    })

    if (rpcError) {
      return NextResponse.json(
        { error: `Draft submission failed: ${rpcError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: rpcData ?? null,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected server error'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}