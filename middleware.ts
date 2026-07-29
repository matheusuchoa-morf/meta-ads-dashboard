// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip API routes, static files, and login page
  if (pathname.startsWith('/api') || pathname === '/login') return NextResponse.next()

  const cookie = req.cookies.get('auth')?.value
  if (cookie === process.env.DASHBOARD_PASSWORD) return NextResponse.next()

  // Redirect to custom login page
  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo\\.|chuck\\.).*)'],
}
