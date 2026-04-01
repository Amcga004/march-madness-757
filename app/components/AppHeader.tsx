'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import HeaderMenu from './HeaderMenu'
import SportSwitcher from './SportSwitcher'

const desktopNavLinks = [
  { href: '/', label: 'Home' },
  { href: '/scores', label: 'Scores' },
  { href: '/bracket', label: 'Bracket' },
  { href: '/rosters', label: 'Rosters' },
]

export default function AppHeader() {
  const pathname = usePathname()
  const isMasters = pathname.startsWith('/masters')

  if (isMasters) {
    return null
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#020817]/95 text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-2xl">🏀</span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                  757 MM Draft
                </h1>
                <p className="hidden text-xs text-slate-400 sm:block">
                  March Madness fantasy draft
                </p>
              </div>
            </div>
          </Link>

          <div className="hidden items-center gap-3 md:flex">
            <SportSwitcher />
            <nav className="flex items-center gap-2 rounded-2xl border border-slate-800/80 bg-[#0b1220]/80 px-2 py-2">
              {desktopNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-[#172033] hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="shrink-0">
              <HeaderMenu />
            </div>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <SportSwitcher />
            <HeaderMenu />
          </div>
        </div>
      </div>
    </header>
  )
}