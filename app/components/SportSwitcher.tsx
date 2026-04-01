'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Props = {
  mastersLeagueId?: string
}

export default function SportSwitcher({
  mastersLeagueId = 'f9e88c6e-dfe1-4897-bec8-5c4ba11cd801',
}: Props) {
  const pathname = usePathname()
  const isMasters = pathname.startsWith('/masters')

  const ncaabHref = '/'
  const pgaHref = `/masters/${mastersLeagueId}/hub`

  return (
    <div
      className={`flex items-center gap-1 rounded-2xl border p-1 shadow-[0_6px_16px_rgba(16,24,40,0.05)] ${
        isMasters
          ? 'border-[#d9ddcf] bg-white'
          : 'border-slate-700/80 bg-[#0b1220]/90'
      }`}
    >
      <Link
        href={ncaabHref}
        className={`rounded-xl px-2.5 py-2 text-[11px] font-semibold transition md:px-4 md:text-sm ${
          !isMasters
            ? 'bg-white text-slate-900'
            : 'text-[#4f5d4d] hover:bg-[#f5f6f1]'
        }`}
      >
        NCAAB
      </Link>

      <Link
        href={pgaHref}
        className={`rounded-xl px-2.5 py-2 text-[11px] font-semibold transition md:px-4 md:text-sm ${
          isMasters
            ? 'bg-[#0b5d3b] text-white'
            : 'text-slate-200 hover:bg-[#172033] hover:text-white'
        }`}
      >
        PGA
      </Link>
    </div>
  )
}