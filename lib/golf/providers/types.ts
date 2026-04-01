export type ProviderSource = 'mock' | 'masters_official' | 'espn' | 'pga'

export type ProviderPlayerRow = {
  playerName: string
  source?: ProviderSource
  positionText?: string | null
  totalToPar?: number | null
  todayToPar?: number | null
  thru?: string | null
  holesCompleted?: number | null
  currentRound?: number | null
  round1?: number | null
  round2?: number | null
  round3?: number | null
  round4?: number | null
  madeCut?: boolean | null
  status?: string | null
  sourceUpdatedAt?: string | null
  rawPayload?: unknown
}

export type ProviderFetchResult = {
  source: ProviderSource
  success: boolean
  rows: ProviderPlayerRow[]
  message?: string
}

export type SyncProviderMode =
  | 'mock'
  | 'masters'
  | 'espn'
  | 'pga'
  | 'espn_pga'
  | 'hybrid'

export type ProviderResolution = {
  primary: ProviderFetchResult
  fallback: ProviderFetchResult
  mode: SyncProviderMode
}