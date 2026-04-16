import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.GOLF_SYNC_SECRET

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL

    if (!secret) {
      return NextResponse.json({ error: 'Missing GOLF_SYNC_SECRET' }, { status: 500 })
    }

    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Missing site URL environment variable' },
        { status: 500 }
      )
    }

    const normalizedBaseUrl = baseUrl.startsWith('http')
      ? baseUrl
      : `https://${baseUrl}`

    const leagueId = 'f9e88c6e-dfe1-4897-bec8-5c4ba11cd801'
    const mode = process.env.GOLF_SYNC_MODE ?? 'espn_pga'

    const res = await fetch(`${normalizedBaseUrl}/api/golf/sync-live`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
      },
      body: JSON.stringify({ leagueId, mode }),
      cache: 'no-store',
    })

    const payload = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: payload?.error ?? 'Cron sync failed' },
        { status: res.status }
      )
    }

    return NextResponse.json({
      success: true,
      syncResult: payload,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown cron error',
      },
      { status: 500 }
    )
  }
}