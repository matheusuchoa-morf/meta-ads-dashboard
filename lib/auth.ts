// lib/auth.ts
// Shared server-side auth guard for API routes.
// The middleware protects page routes but explicitly passes /api/* through,
// so every API handler must call requireAuth() itself.
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Returns a 401 NextResponse if the request cookie does not match
 * DASHBOARD_PASSWORD, or null if the caller may proceed.
 *
 * Usage:
 *   const unauthorized = await requireAuth()
 *   if (unauthorized) return unauthorized
 */
export async function requireAuth(): Promise<NextResponse | null> {
  const cookieStore = await cookies()
  const auth = cookieStore.get('auth')?.value
  if (auth && auth === process.env.DASHBOARD_PASSWORD) return null
  return new NextResponse('Unauthorized', { status: 401 })
}
