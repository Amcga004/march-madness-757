'use client'

import Link from 'next/link'

type Props = {
  mastersLeagueId?: string
}

export default function SportSwitcher({
  mastersLeagueId = 'f9e88c6e-dfe1-4897-bec8-5c4ba11cd801',
}: Props) {
  const pgaHref = `/masters/${mastersLeagueId}/hub`

  return (
    <Link
      href={pgaHref}
      className="rounded-xl border border-[#d9ddcf] bg-[#0b5d3b] px-2.5 py-2 text-[11px] font-semibold text-white shadow-[0_6px_16px_rgba(16,24,40,0.05)] transition hover:bg-[#0a4f32] md:px-4 md:text-sm"
    >
      PGA
    </Link>
  )
}
