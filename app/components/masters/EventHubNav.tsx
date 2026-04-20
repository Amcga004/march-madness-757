'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  leagueId: string
}

const items = [
  {
    key: 'hub',
    label: 'Hub',
    shortLabel: 'Hub',
    getHref: (leagueId: string) => `/masters/${leagueId}/hub`,
  },
  {
    key: 'leaderboard',
    label: 'Leaderboard',
    shortLabel: 'Board',
    getHref: (leagueId: string) => `/masters/${leagueId}/leaderboard`,
  },
  {
    key: 'rosters',
    label: 'Rosters',
    shortLabel: 'Rosters',
    getHref: (leagueId: string) => `/masters/${leagueId}/rosters`,
  },
  {
    key: 'draft',
    label: 'Draft',
    shortLabel: 'Draft',
    getHref: (leagueId: string) => `/masters/${leagueId}/draft`,
  },
  {
    key: 'rules',
    label: 'Settings',
    shortLabel: 'Settings',
    getHref: (leagueId: string) => `/masters/${leagueId}/rules`,
  },
]

export default function EventHubNav({ leagueId }: Props) {
  const pathname = usePathname()

  return (
    <div className="sticky bottom-0 z-20 border-t border-[#d9ddcf] bg-[rgba(247,246,239,0.94)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-5 gap-2 px-3 py-3 sm:px-4">
        {items.map((item) => {
          const href = item.getHref(leagueId)
          const active = pathname === href

          return (
            <Link
              key={item.key}
              href={href}
              className={`rounded-xl px-2 py-2 text-center text-xs font-semibold transition sm:px-3 sm:text-sm ${
                active
                  ? 'border border-[#0b5d3b] bg-[#0b5d3b] text-white shadow-sm'
                  : 'border border-[#d9ddcf] bg-white text-[#243126] hover:border-[#c6cfbc] hover:bg-[#fcfcf8]'
              }`}
            >
              <span>{item.shortLabel}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}