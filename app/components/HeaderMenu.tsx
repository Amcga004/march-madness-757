'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type AuthUser = {
  id: string
  email?: string
} | null

type Member = {
  id: string
  display_name: string
  role: string | null
  user_id: string | null
}

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/rosters', label: 'Rosters' },
  { href: '/draft', label: 'Draft Room' },
  { href: '/data', label: 'Data' },
  { href: '/history', label: 'Results' },
  { href: '/bracket', label: 'Bracket' },
  { href: '/admin', label: 'Admin', admin: true },
]

export default function HeaderMenu() {
  const pathname = usePathname()
  const isMasters = pathname.startsWith('/masters')

  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    async function loadAuthState() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setAuthUser(user ? { id: user.id, email: user.email } : null)

      if (!user) {
        setMember(null)
        setAuthLoaded(true)
        return
      }

      const { data: memberData } = await supabase
        .from('league_members')
        .select('id,display_name,role,user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      setMember((memberData as Member | null) ?? null)
      setAuthLoaded(true)
    }

    loadAuthState()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadAuthState()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setOpen(false)
    window.location.href = '/'
  }

  const signedInLabel = member
    ? `${member.display_name} • ${member.role ?? 'manager'}`
    : authUser?.email ?? null

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Open navigation menu"
        className={
          isMasters
            ? 'inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#d9ddcf] bg-white text-[#243126] shadow-[0_6px_16px_rgba(16,24,40,0.05)] transition hover:border-[#c6cfbc] hover:bg-[#fcfcf8]'
            : 'inline-flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-slate-600/80 bg-slate-800/80 text-white shadow-[0_8px_24px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur transition hover:border-slate-400 hover:bg-slate-700/80'
        }
      >
        <span className="flex flex-col gap-1.5">
          <span
            className={`block rounded ${
              isMasters ? 'h-0.5 w-5 bg-[#243126]' : 'h-1 w-7 bg-white'
            }`}
          />
          <span
            className={`block rounded ${
              isMasters ? 'h-0.5 w-5 bg-[#243126]' : 'h-1 w-7 bg-white'
            }`}
          />
          <span
            className={`block rounded ${
              isMasters ? 'h-0.5 w-5 bg-[#243126]' : 'h-1 w-7 bg-white'
            }`}
          />
        </span>
      </button>

      {open ? (
        <div
          className={
            isMasters
              ? 'absolute right-0 top-14 z-50 w-72 overflow-hidden rounded-3xl border border-[#d9ddcf] bg-[#fffefb] p-2 shadow-[0_20px_40px_rgba(16,24,40,0.12)]'
              : 'absolute right-0 top-20 z-50 w-72 overflow-hidden rounded-3xl border border-slate-700/80 bg-[#0f172a]/95 p-2 shadow-[0_20px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl'
          }
        >
          <div
            className={`mb-2 px-3 pt-2 text-xs font-semibold uppercase tracking-[0.18em] ${
              isMasters ? 'text-[#788274]' : 'text-slate-400'
            }`}
          >
            Navigate
          </div>

          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={
                  isMasters
                    ? `rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        link.admin
                          ? 'border border-[#d6c38c] bg-[#fbf6e8] text-[#7b6022] hover:bg-[#f5edd8]'
                          : 'text-[#243126] hover:bg-[#f3f6ef]'
                      }`
                    : `rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        link.admin
                          ? 'border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                          : 'text-slate-100 hover:bg-slate-800/80'
                      }`
                }
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div
            className={`my-3 border-t ${isMasters ? 'border-[#e3e6da]' : 'border-slate-700/80'}`}
          />

          <div
            className={`mb-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] ${
              isMasters ? 'text-[#788274]' : 'text-slate-400'
            }`}
          >
            Account
          </div>

          {authLoaded && signedInLabel ? (
            <div
              className={`px-3 pb-2 text-sm ${isMasters ? 'text-[#4f5b4c]' : 'text-slate-300'}`}
            >
              {signedInLabel}
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            {!authUser ? (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isMasters
                    ? 'text-[#243126] hover:bg-[#f3f6ef]'
                    : 'text-slate-100 hover:bg-slate-800/80'
                }`}
              >
                Login
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleSignOut}
                className={`rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                  isMasters
                    ? 'text-[#243126] hover:bg-[#f3f6ef]'
                    : 'text-slate-100 hover:bg-slate-800/80'
                }`}
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}