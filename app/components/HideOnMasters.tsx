'use client'

import { usePathname } from 'next/navigation'

export default function HideOnMasters({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isMasters = pathname.startsWith('/masters')

  if (isMasters) return null

  return <>{children}</>
}