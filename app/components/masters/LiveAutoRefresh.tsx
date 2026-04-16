'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type Props = {
  leagueId: string
  intervalMs?: number
}

export default function LiveAutoRefresh({
  leagueId,
  intervalMs = 60000,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const isRunningRef = useRef(false)

  useEffect(() => {
    const isGolfPage = pathname.startsWith('/masters')
    if (!isGolfPage || !leagueId) return

    let timer: ReturnType<typeof setInterval> | null = null

    async function runSync() {
      if (isRunningRef.current) return
      if (document.visibilityState !== 'visible') return

      isRunningRef.current = true

      try {
        await fetch('/api/golf/sync-live', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ leagueId }),
        })
      } catch (error) {
        console.error('LiveAutoRefresh sync failed:', error)
      } finally {
        router.refresh()
        isRunningRef.current = false
      }
    }

    function start() {
      if (timer) return
      timer = setInterval(() => {
        void runSync()
      }, intervalMs)
    }

    function stop() {
      if (!timer) return
      clearInterval(timer)
      timer = null
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void runSync()
        start()
      } else {
        stop()
      }
    }

    void runSync()
    start()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [intervalMs, leagueId, pathname, router])

  return null
}