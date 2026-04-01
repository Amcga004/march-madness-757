export type ManagerTheme = {
  name: string
  badgeClass: string
  softBadgeClass: string
  borderClass: string
  textClass: string
  ringClass: string
  tintClass: string
}

const managerThemeMap: Record<string, ManagerTheme> = {
  andrew: {
    name: 'Andrew',
    badgeClass: 'border border-blue-200 bg-blue-50 text-blue-800',
    softBadgeClass: 'border border-blue-200 bg-blue-50 text-blue-800',
    borderClass: 'border-l-blue-500',
    textClass: 'text-blue-800',
    ringClass: 'ring-blue-200',
    tintClass: 'bg-blue-50/60',
  },
  wesley: {
    name: 'Wesley',
    badgeClass: 'border border-emerald-200 bg-emerald-50 text-emerald-800',
    softBadgeClass: 'border border-emerald-200 bg-emerald-50 text-emerald-800',
    borderClass: 'border-l-emerald-500',
    textClass: 'text-emerald-800',
    ringClass: 'ring-emerald-200',
    tintClass: 'bg-emerald-50/60',
  },
  matthew: {
    name: 'Matthew',
    badgeClass: 'border border-amber-200 bg-amber-50 text-amber-800',
    softBadgeClass: 'border border-amber-200 bg-amber-50 text-amber-800',
    borderClass: 'border-l-amber-500',
    textClass: 'text-amber-800',
    ringClass: 'ring-amber-200',
    tintClass: 'bg-amber-50/60',
  },
  brandon: {
    name: 'Brandon',
    badgeClass: 'border border-violet-200 bg-violet-50 text-violet-800',
    softBadgeClass: 'border border-violet-200 bg-violet-50 text-violet-800',
    borderClass: 'border-l-violet-500',
    textClass: 'text-violet-800',
    ringClass: 'ring-violet-200',
    tintClass: 'bg-violet-50/60',
  },
}

const fallbackTheme: ManagerTheme = {
  name: 'Manager',
  badgeClass: 'border border-slate-200 bg-slate-50 text-slate-800',
  softBadgeClass: 'border border-slate-200 bg-slate-50 text-slate-800',
  borderClass: 'border-l-slate-400',
  textClass: 'text-slate-800',
  ringClass: 'ring-slate-200',
  tintClass: 'bg-slate-50/60',
}

export function getManagerTheme(managerName?: string | null): ManagerTheme {
  if (!managerName) return fallbackTheme

  const normalized = managerName.trim().toLowerCase()
  return managerThemeMap[normalized] ?? fallbackTheme
}