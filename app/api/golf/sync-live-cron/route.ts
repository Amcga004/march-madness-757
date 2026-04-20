import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.GOLF_SYNC_SECRET

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL

  if (!baseUrl) {
    return NextResponse.json(
      { error: 'Missing site URL environment variable' },
      { status: 500 }
    )
  }

  const normalizedBaseUrl = baseUrl.startsWith('http')
    ? baseUrl
    : `https://${baseUrl}`

  const mode = process.env.GOLF_SYNC_MODE ?? 'espn_pga'

  const supabase = createServiceClient()
  const { data: leagues, error } = await supabase
    .from('leagues_v2')
    .select('id')
    .not('event_id', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!leagues || leagues.length === 0) {
    return NextResponse.json({ success: true, synced: 0, message: 'No active leagues' })
  }

  const results = await Promise.allSettled(
    leagues.map(async (league: { id: string }) => {
      const res = await fetch(`${normalizedBaseUrl}/api/golf/sync-live`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`,
        },
        body: JSON.stringify({ leagueId: league.id, mode }),
        cache: 'no-store',
      })
      const payload = await res.json()
      return { leagueId: league.id, ok: res.ok, payload }
    })
  )

  const summary = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { leagueId: 'unknown', ok: false, error: r.reason }
  )

  return NextResponse.json({ success: true, synced: leagues.length, results: summary })
}
