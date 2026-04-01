import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const body = await req.json()
    const leagueId = body?.leagueId as string | undefined

    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'You must be signed in' }, { status: 401 })
    }

    const { data: leagueRow, error: leagueError } = await supabase
      .from('leagues_v2')
      .select('id, created_by')
      .eq('id', leagueId)
      .maybeSingle()

    if (leagueError) {
      return NextResponse.json(
        { error: `Unable to validate commissioner: ${leagueError.message}` },
        { status: 500 }
      )
    }

    if (!leagueRow) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    if (!leagueRow.created_by || leagueRow.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Only the commissioner can start the draft' },
        { status: 403 }
      )
    }

    const { data: draftRow, error: draftLookupError } = await supabase
      .from('drafts')
      .select('id, league_id, current_pick, current_round, status')
      .eq('league_id', leagueId)
      .maybeSingle()

    if (draftLookupError) {
      return NextResponse.json(
        { error: `Unable to find draft: ${draftLookupError.message}` },
        { status: 500 }
      )
    }

    if (!draftRow) {
      return NextResponse.json(
        { error: 'No draft found for this league' },
        { status: 404 }
      )
    }

    const { error: draftUpdateError } = await supabase
      .from('drafts')
      .update({ status: 'live' })
      .eq('id', draftRow.id)

    if (draftUpdateError) {
      return NextResponse.json(
        { error: `Unable to set draft live: ${draftUpdateError.message}` },
        { status: 500 }
      )
    }

    const { error: leagueUpdateError } = await supabase
      .from('leagues_v2')
      .update({ draft_status: 'live' })
      .eq('id', leagueId)

    if (leagueUpdateError) {
      return NextResponse.json(
        { error: `Unable to update league draft status: ${leagueUpdateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        leagueId,
        draftId: draftRow.id,
        status: 'live',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}