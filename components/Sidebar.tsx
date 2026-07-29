'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  LayoutDashboard, GitBranch,
  Megaphone, ChevronLeft, ChevronRight, Rocket, UserPlus
} from 'lucide-react'

const NAV_ITEMS = [
  { view: 'resumo',      label: 'Resumo',          icon: LayoutDashboard },
  { view: 'funil',       label: 'Funil',            icon: GitBranch },
  { view: 'anuncios',    label: 'Anúncios',          icon: Megaphone },
  { view: 'seguidores',  label: 'Seguidores',        icon: UserPlus },
  { view: 'leads',       label: 'Leads',             icon: Rocket },
]

export function Sidebar() {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const currentView  = searchParams.get('view') ?? 'resumo'

  // ── Collapsible (desktop only) ──────────────────────────────────────────
  const [isOpen, setIsOpen] = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-open')
      if (saved !== null) setIsOpen(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  const toggleSidebar = () => {
    setIsOpen(prev => {
      const next = !prev
      try { localStorage.setItem('sidebar-open', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }
  // ────────────────────────────────────────────────────────────────────────

  if (pathname === '/login') return null

  function navigate(view: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', view)
    router.push(`/?${params.toString()}`)
  }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 sticky top-16 border-r overflow-hidden transition-all duration-300`}
        style={{
          height: 'calc(100vh - 64px)',
          width: isOpen ? '224px' : '56px',
          background: 'var(--mit-bg-dark)',
          borderColor: 'var(--mit-border)',
        }}
      >
        {/* Toggle button */}
        <div
          className="flex items-center border-b px-3 py-3 shrink-0"
          style={{
            borderColor: 'var(--mit-border)',
            justifyContent: isOpen ? 'flex-end' : 'center',
          }}
        >
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors cursor-pointer hover:opacity-70"
            style={{
              background: 'var(--mit-bg-elevated)',
              color: 'var(--mit-text-subtle)',
            }}
            title={isOpen ? 'Fechar sidebar' : 'Abrir sidebar'}
          >
            {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="p-2 pt-3 space-y-1 flex-1">
          {NAV_ITEMS.map(({ view, label, icon: Icon }) => {
            const active = currentView === view
            return (
              <button
                key={view}
                onClick={() => navigate(view)}
                title={!isOpen ? label : undefined}
                className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer overflow-hidden"
                style={{
                  background: active ? 'rgba(201,164,90,0.1)' : 'transparent',
                  color:      active ? 'var(--mit-gold)' : 'var(--mit-text-subtle)',
                  borderLeft: active
                    ? '2px solid var(--mit-gold)'
                    : '2px solid transparent',
                  justifyContent: isOpen ? undefined : 'center',
                }}
              >
                <Icon size={16} className="shrink-0" />
                {isOpen && (
                  <span className="truncate whitespace-nowrap">{label}</span>
                )}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t"
        style={{
          background: 'var(--mit-bg-dark)',
          borderColor: 'var(--mit-border)',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}
      >
        {NAV_ITEMS.map(({ view, label, icon: Icon }) => {
          const active = currentView === view
          return (
            <button
              key={view}
              onClick={() => navigate(view)}
              className="flex-1 flex flex-col items-center gap-1 pt-3 pb-2 text-[10px] transition-colors duration-150 cursor-pointer"
              style={{
                color: active ? 'var(--mit-gold)' : 'var(--mit-text-subtle)',
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          )
        })}
      </nav>
    </>
  )
}
