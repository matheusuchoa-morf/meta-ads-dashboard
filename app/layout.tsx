import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '@/components/Navbar'
import { Sidebar } from '@/components/Sidebar'
import { Toaster } from 'sonner'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Mitologia Dashboard',
  description: 'Meta Ads Campaign Dashboard — Mitologia Edition',
}

export const viewport: Viewport = {
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body
        className="flex flex-col"
        style={{ background: 'var(--mit-bg-base)', color: 'var(--mit-text)', minHeight: '100vh' }}
      >
        <Toaster richColors position="top-right" />
        <Providers>
          <Navbar />
          <div className="flex flex-1 min-h-0">
            <Suspense fallback={<div className="hidden lg:block w-56 shrink-0" />}>
              <Sidebar />
            </Suspense>
            {/* pb-16 prevents mobile bottom nav from covering content */}
            <main className="flex-1 min-w-0 p-6 pb-20 lg:pb-6">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
