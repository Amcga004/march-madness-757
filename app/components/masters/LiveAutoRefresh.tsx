'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type Props = {
  intervalMs?: number
}

export default function LiveAutoRefresh({ intervalMs = 60000 }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const isGolfPage = pathname.startsWith('/masters')
    if (!isGolfPage) return

    let timer: ReturnType<typeof setInterval> | null = null

    function start() {
      if (timer) return
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          router.refresh()
        }
      }, intervalMs)
    }

    function stop() {
      if (!timer) return
      clearInterval(timer)
      timer = null
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        router.refresh()
        start()
      } else {
        stop()
      }
    }

    start()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [intervalMs, pathname, router])

  return null
}