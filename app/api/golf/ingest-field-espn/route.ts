import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const ESPN_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'

function isTeamCompetitor(competitor: any): boolean {
  const name: string = competitor?.team?.displayName ?? ''
  return name.includes('/')
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const expected = process.env.GOLF_SYNC_SECRET

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // 1. Fetch ESPN scoreboard
  const res = await fetch(ESPN_SCOREBOARD, { cache: 'no-store' })
  if (!res.ok) {
    return NextResponse.json(
      { error: `ESPN scoreboard fetch failed: ${res.status}` },
      { status: 502 }
    )
  }
  const data = await res.json()
  const events: any[] = Array.isArray(data?.events) ? data.events : []

  // 2. Find first individual event
  const espnEvent = events.find((ev) => {
    const competitors: any[] =
      ev?.competitions?.[0]?.competitors ?? []
    return competitors.length > 0 && !competitors.some(isTeamCompetitor)
  })

  if (!espnEvent) {
    return NextResponse.json(
      { ok: false, error: 'No individual PGA event found on ESPN scoreboard' },
      { status: 404 }
    )
  }

  const espnEventName: string = espnEvent.name ?? 'Unknown Event'
  const competitors: any[] = espnEvent.competitions?.[0]?.competitors ?? []

  // 3. Find matching platform_event in DB
  const { data: platformEvent, error: peError } = await supabase
    .from('platform_events')
    .select('id, name')
    .in('sport_key', ['pga', 'golf'])
    .eq('status', 'scheduled')
    .gte('starts_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (peError) {
    return NextResponse.json({ error: peError.message }, { status: 500 })
  }

  if (!platformEvent) {
    return NextResponse.json(
      { ok: false, error: 'No matching scheduled platform_event found' },
      { status: 404 }
    )
  }

  const eventId: string = platformEvent.id

  // 4. Upsert competitors and event_competitors
  let competitorsIngested = 0
  let skipped = 0

  for (const comp of competitors) {
    const name: string = comp?.team?.displayName ?? ''
    const externalId: string = comp?.team?.id ?? ''

    if (!name || !externalId) {
      skipped++
      continue
    }

    // Upsert into competitors
    const { data: competitorRow, error: compError } = await supabase
      .from('competitors')
      .upsert(
        { name, external_id: externalId, sport_key: 'pga' },
        { onConflict: 'external_id', ignoreDuplicates: false }
      )
      .select('id')
      .maybeSingle()

    if (compError || !competitorRow) {
      skipped++
      continue
    }

    // Upsert into event_competitors
    const seedOrder: number | null =
      typeof comp?.order === 'number' ? comp.order : null

    const { error: ecError } = await supabase
      .from('event_competitors')
      .upsert(
        {
          event_id: eventId,
          competitor_id: competitorRow.id,
          is_active: true,
          seed_order: seedOrder,
        },
        { onConflict: 'event_id,competitor_id', ignoreDuplicates: false }
      )

    if (ecError) {
      skipped++
      continue
    }

    competitorsIngested++
  }

  return NextResponse.json({
    ok: true,
    espnEventName,
    platformEventId: eventId,
    platformEventName: platformEvent.name,
    competitorsIngested,
    skipped,
  })
}
