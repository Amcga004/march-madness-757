'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function extractLeagueId(pathname: string) {
  const match = pathname.match(/^\/masters\/([^/]+)/)
  return match?.[1] ?? 'f9e88c6e-dfe1-4897-bec8-5c4ba11cd801'
}

const items = [
  { label: 'Hub', getHref: (leagueId: string) => `/masters/${leagueId}/hub` },
  { label: 'Leaderboard', getHref: (leagueId: string) => `/masters/${leagueId}/leaderboard` },
  { label: 'Rosters', getHref: (leagueId: string) => `/masters/${leagueId}/rosters` },
  { label: 'Draft', getHref: (leagueId: string) => `/masters/${leagueId}/draft` },
]

export default function MastersTopNav() {
  const pathname = usePathname()
  const leagueId = extractLeagueId(pathname)

  return (
    <nav className="hidden items-center gap-1 rounded-2xl border border-[#d9ddcf] bg-white p-1 shadow-[0_6px_16px_rgba(16,24,40,0.05)] md:flex">
      {items.map((item) => {
        const href = item.getHref(leagueId)
        const active = pathname === href

        return (
          <Link
            key={item.label}
            href={href}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-[#0b5d3b] text-white'
                : 'text-[#334132] hover:bg-[#f5f6f1]'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}