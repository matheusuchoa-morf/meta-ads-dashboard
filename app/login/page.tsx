'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError('Senha incorreta')
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--mit-bg-dark)' }}
    >
      {/* Ambient glow */}
      <div
        className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[120px] opacity-[0.07] pointer-events-none"
        style={{ background: 'var(--mit-accent)' }}
      />

      <div className="w-full max-w-[380px] relative">
        {/* Brand */}
        <div className="text-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Mitologia"
            className="w-24 h-24 mx-auto mb-6"
            style={{ filter: 'drop-shadow(0 0 30px rgba(201,164,90,0.3))' }}
          />
          <h1
            className="text-2xl tracking-[0.3em] font-light mb-2"
            style={{ color: 'var(--mit-text)', fontFamily: 'var(--font-display)' }}
          >
            MITOLOGIA
          </h1>
          <p className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>
            Meta Ads Dashboard
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border p-8 space-y-6"
          style={{
            background: 'var(--mit-bg-card)',
            borderColor: 'rgba(201,164,90,0.1)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          }}
        >
          <div className="space-y-5">
            {/* Password field */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-xs font-medium tracking-wide uppercase"
                style={{ color: 'var(--mit-text-subtle)' }}
              >
                Senha de acesso
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full h-12 px-4 rounded-lg text-sm outline-none transition-all duration-200 placeholder:opacity-30"
                style={{
                  background: 'var(--mit-bg-elevated)',
                  color: 'var(--mit-text)',
                  border: '1px solid rgba(201,164,90,0.12)',
                  fontFamily: 'var(--font-mono)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--mit-accent)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(201,164,90,0.12)')}
              />
            </div>

            {/* Error */}
            {error && (
              <p
                className="text-xs font-medium px-1"
                style={{ color: 'var(--mit-danger)' }}
                role="alert"
              >
                {error}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full h-12 rounded-lg text-sm font-semibold tracking-wide cursor-pointer transition-all duration-200 flex items-center justify-center gap-2"
            style={{
              background: loading ? 'var(--mit-bg-elevated)' : 'var(--mit-accent)',
              color: loading ? 'var(--mit-text-subtle)' : '#fff',
              opacity: !password ? 0.5 : 1,
            }}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        {/* Footer */}
        <p
          className="text-center text-xs mt-8"
          style={{ color: 'rgba(138,155,160,0.5)' }}
        >
          Morf Systems · Painel interno
        </p>
      </div>
    </div>
  )
}
