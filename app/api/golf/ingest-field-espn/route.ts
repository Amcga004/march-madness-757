import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const ESPN_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'

const PGA_SPORT_ID = 'e9323465-f946-487f-b355-e63e596adfc2'

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

  const res = await fetch(ESPN_SCOREBOARD, { cache: 'no-store' })
  if (!res.ok) {
    return NextResponse.json(
      { error: `ESPN scoreboard fetch failed: ${res.status}` },
      { status: 502 }
    )
  }
  const data = await res.json()
  const events: any[] = Array.isArray(data?.events) ? data.events : []

  const espnEvent = events.find((ev) => {
    const competitors: any[] = ev?.competitions?.[0]?.competitors ?? []
    return competitors.length > 0 && !competitors.some(isTeamCompetitor)
  })

  if (!espnEvent) {
    console.error('[golf-ingest] No individual PGA event found on ESPN scoreboard. Events:', events.map(e => e?.name))
    return NextResponse.json(
      { ok: false, error: 'No individual PGA event found on ESPN scoreboard', espnEvents: events.map(e => e?.name) },
      { status: 404 }
    )
  }

  const espnEventName: string = espnEvent.name ?? 'Unknown Event'
  const espnEventId: string = espnEvent.id ?? ''
  const competitors: any[] = espnEvent.competitions?.[0]?.competitors ?? []
  console.log(`[golf-ingest] ESPN event: "${espnEventName}" (id: ${espnEventId}), competitors: ${competitors.length}`)

  // Try all non-completed statuses
  const { data: allPlatformEvents, error: peListError } = await supabase
    .from('platform_events')
    .select('id, name, status, starts_at, metadata')
    .in('sport_key', ['pga', 'golf'])
    .in('status', ['scheduled', 'pre', 'live'])
    .order('starts_at', { ascending: true })
    .limit(5)

  console.log('[golf-ingest] Platform events found:', JSON.stringify(allPlatformEvents), 'error:', peListError?.message)

  if (peListError) {
    return NextResponse.json({ error: peListError.message }, { status: 500 })
  }

  if (!allPlatformEvents || allPlatformEvents.length === 0) {
    // Last resort: find most recent platform event regardless of status
    const { data: anyEvent } = await supabase
      .from('platform_events')
      .select('id, name, status, starts_at')
      .in('sport_key', ['pga', 'golf'])
      .order('starts_at', { ascending: false })
      .limit(3)
    console.error('[golf-ingest] No scheduled/pre/live golf events. Recent events:', JSON.stringify(anyEvent))
    return NextResponse.json(
      { ok: false, error: 'No matching platform_event found', recentEvents: anyEvent },
      { status: 404 }
    )
  }

  // Try to match by ESPN event name or metadata.espnEventId
  let platformEvent = allPlatformEvents.find((e: any) =>
    e.metadata?.espnEventId === espnEventId ||
    e.name?.toLowerCase().includes(espnEventName.split(' ')[0]?.toLowerCase() ?? '')
  ) ?? allPlatformEvents[0]

  const eventId: string = platformEvent.id
  console.log(`[golf-ingest] Using platform event: "${platformEvent.name}" (id: ${eventId}, status: ${platformEvent.status})`)

  let competitorsIngested = 0
  let skipped = 0
  const errors: string[] = []

  for (const comp of competitors) {
    const name: string = comp?.athlete?.displayName ?? comp?.team?.displayName ?? ''
    const externalId: string = comp?.athlete?.id ?? comp?.team?.id ?? ''

    if (!name || !externalId) {
      console.warn('[golf-ingest] Skipping competitor missing name/id:', JSON.stringify(comp).slice(0, 200))
      skipped++
      continue
    }

    const { data: competitorRow, error: compError } = await supabase
      .from('competitors')
      .upsert(
        { name, external_id: externalId, sport_id: PGA_SPORT_ID },
        { onConflict: 'external_id', ignoreDuplicates: false }
      )
      .select('id')
      .maybeSingle()

    if (compError) {
      const msg = `competitor upsert error for "${name}" (${externalId}): ${compError.message}`
      console.error('[golf-ingest]', msg)
      errors.push(msg)
      skipped++
      continue
    }

    if (!competitorRow) {
      const msg = `competitor upsert returned null for "${name}" (${externalId})`
      console.error('[golf-ingest]', msg)
      errors.push(msg)
      skipped++
      continue
    }

    const seedOrder: number | null =
      typeof comp?.order === 'number' ? comp.order :
      typeof comp?.sortOrder === 'number' ? comp.sortOrder : null

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
      const msg = `event_competitors upsert error for "${name}": ${ecError.message}`
      console.error('[golf-ingest]', msg)
      errors.push(msg)
      skipped++
      continue
    }

    competitorsIngested++
  }

  console.log(`[golf-ingest] Done. ingested: ${competitorsIngested}, skipped: ${skipped}, errors: ${errors.length}`)

  return NextResponse.json({
    ok: true,
    espnEventName,
    espnEventId,
    platformEventId: eventId,
    platformEventName: platformEvent.name,
    competitorsIngested,
    skipped,
    errors: errors.slice(0, 10),
  })
}
