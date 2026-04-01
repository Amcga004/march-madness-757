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
        { error: 'Only the commissioner can pause the draft' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase.rpc('pause_draft', {
      p_league_id: leagueId,
    })

    if (error) {
      return NextResponse.json(
        { error: `Pause failed: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: data ?? null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}