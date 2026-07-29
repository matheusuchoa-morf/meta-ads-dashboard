'use client'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()

  if (pathname === '/login') return null

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <nav
      className="sticky top-0 z-50 h-16 flex items-center justify-between px-6"
      style={{
        background: 'var(--mit-bg-dark)',
        borderBottom: '1px solid var(--mit-border)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Mitologia" className="w-9 h-9" />
        <div className="flex items-baseline gap-2">
          <span
            className="text-sm tracking-[0.25em] font-light"
            style={{ color: 'var(--mit-gold)', fontFamily: 'var(--font-display)' }}
          >
            MITOLOGIA
          </span>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors duration-200 hover:opacity-80"
        style={{ color: 'var(--mit-text-subtle)' }}
        aria-label="Sair"
      >
        <LogOut size={14} />
        <span className="hidden sm:inline">Sair</span>
      </button>
    </nav>
  )
}
