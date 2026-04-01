import { fetchEspnLeaderboard } from './espn'
import { fetchMastersOfficialLeaderboard } from './mastersOfficial'
import { fetchMockLeaderboard } from './mock'
import { fetchPgaLeaderboard } from './pga'
import type { ProviderFetchResult, ProviderResolution, SyncProviderMode } from './types'

function emptyResult(
  source: ProviderFetchResult['source'],
  message: string
): ProviderFetchResult {
  return {
    source,
    success: false,
    rows: [],
    message,
  }
}

export async function resolveProviders(
  eventId: string,
  mode: SyncProviderMode
): Promise<ProviderResolution> {
  if (mode === 'mock') {
    const primary = await fetchMockLeaderboard(eventId)
    return {
      mode,
      primary,
      fallback: emptyResult('espn', 'No fallback used in mock mode'),
    }
  }

  if (mode === 'masters') {
    const primary = await fetchMastersOfficialLeaderboard()
    return {
      mode,
      primary,
      fallback: emptyResult('espn', 'No fallback used in masters mode'),
    }
  }

  if (mode === 'espn') {
    const primary = await fetchEspnLeaderboard()
    return {
      mode,
      primary,
      fallback: emptyResult('pga', 'No fallback used in espn mode'),
    }
  }

  if (mode === 'pga') {
    const primary = await fetchPgaLeaderboard()
    return {
      mode,
      primary,
      fallback: emptyResult('espn', 'No fallback used in pga mode'),
    }
  }

  if (mode === 'espn_pga') {
    const [espn, pga] = await Promise.all([
      fetchEspnLeaderboard(),
      fetchPgaLeaderboard(),
    ])

    return {
      mode,
      primary: espn,
      fallback: pga,
    }
  }

  const [masters, espn] = await Promise.all([
    fetchMastersOfficialLeaderboard(),
    fetchEspnLeaderboard(),
  ])

  return {
    mode: 'hybrid',
    primary: masters,
    fallback: espn,
  }
}