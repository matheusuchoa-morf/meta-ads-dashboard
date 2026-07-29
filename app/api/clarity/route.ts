// app/api/clarity/route.ts
// Proxy para a Clarity Data Export API.
// Cache de 2h no Next.js para respeitar o limite de 10 req/dia por projeto.
import { NextResponse } from 'next/server'

const CLARITY_API = 'https://www.clarity.ms/export-data/api/v1/project-live-insights'
const CACHE_SECONDS = 60 * 60 * 2 // 2 horas

// Páginas monitoradas — filtramos a resposta por essas URLs
// ICM3 (junho 2026): variação "Construção" é a LP corrente (todos os ads apontam aqui).
// junho fica como referência histórica (tráfego migrado em 21/06).
const TRACKED_PAGES = [
  'https://your-domain.com/icm3-48h/',
  'https://your-domain.com/icm3-construcao/',
  'https://your-domain.com/imersao-claude-junho/',
]

// ─── URL matching ───────────────────────────────────────────────────────────
// Clarity retorna URLs com UTM params e fbclid — precisa comparar só o path
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '').toLowerCase()
      + u.pathname.replace(/\/+$/, '').toLowerCase()
  } catch {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\?.*$/, '')
      .replace(/\/+$/, '')
      .toLowerCase()
  }
}

export interface ClarityPageMetrics {
  scrollDepth?: number   // 0–100 %
  ragePct?: number       // % de sessões com rage clicks
  engagement?: number    // engagement time normalizado 0–100
  sessions?: number      // total de sessões
  fetchedAt: string      // ISO timestamp
}

// ─── Parse response ─────────────────────────────────────────────────────────
// A API retorna métricas em camelCase com 227+ items por métrica (um por URL+UTM combo).
// Precisamos agregar todas as variações de UTM para cada página base.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResponse(data: any[]): Record<string, ClarityPageMetrics> {
  if (!Array.isArray(data)) return {}

  const now = new Date().toISOString()

  // Acumuladores por página
  const acc: Record<string, {
    sessions: number
    scrollDepthSum: number
    scrollDepthCount: number
    rageCount: number
    engagementSum: number
    engagementCount: number
  }> = {}

  for (const page of TRACKED_PAGES) {
    acc[page] = {
      sessions: 0,
      scrollDepthSum: 0,
      scrollDepthCount: 0,
      rageCount: 0,
      engagementSum: 0,
      engagementCount: 0,
    }
  }

  function matchPage(apiUrl: string): string | null {
    if (!apiUrl) return null
    const norm = normalizeUrl(apiUrl)
    return TRACKED_PAGES.find(p => normalizeUrl(p) === norm) ?? null
  }

  for (const metric of data) {
    const name: string = metric.metricName ?? ''
    const items: Record<string, unknown>[] = metric.information ?? []

    for (const item of items) {
      const rawUrl = (item.Url ?? item.url ?? item.URL ?? '') as string
      if (!rawUrl) continue

      const page = matchPage(rawUrl)
      if (!page) continue

      // Traffic — sessões por URL variante
      if (name === 'Traffic') {
        acc[page].sessions += parseInt((item.totalSessionCount as string) ?? '0', 10)
      }

      // ScrollDepth — campo: averageScrollDepth (0–100)
      if (name === 'ScrollDepth') {
        const depth = parseInt(String(item.averageScrollDepth ?? '0'), 10)
        if (depth > 0) {
          acc[page].scrollDepthSum += depth
          acc[page].scrollDepthCount++
        }
      }

      // RageClickCount — campo: subTotal (count absoluto)
      if (name === 'RageClickCount') {
        acc[page].rageCount += parseInt((item.subTotal as string) ?? '0', 10)
      }

      // EngagementTime — campo: activeTime (segundos)
      if (name === 'EngagementTime') {
        const secs = parseInt((item.activeTime ?? item.totalTime) as string ?? '0', 10)
        if (secs > 0) {
          acc[page].engagementSum += secs
          acc[page].engagementCount++
        }
      }
    }
  }

  // Converte acumuladores em métricas finais
  const result: Record<string, ClarityPageMetrics> = {}

  for (const page of TRACKED_PAGES) {
    const d = acc[page]

    // Média ponderada do scroll depth
    const scrollDepth = d.scrollDepthCount > 0
      ? Math.round(d.scrollDepthSum / d.scrollDepthCount)
      : undefined

    // Rage % = count / sessions × 100
    const ragePct = d.sessions > 0 && d.rageCount > 0
      ? Math.round(d.rageCount / d.sessions * 1000) / 10
      : d.sessions > 0 ? 0 : undefined

    // Engagement: média de activeTime normalizada para 0–100 (180s = 100)
    const engagement = d.engagementCount > 0
      ? Math.min(100, Math.round((d.engagementSum / d.engagementCount / 180) * 100))
      : undefined

    result[page] = {
      scrollDepth,
      ragePct,
      engagement,
      sessions: d.sessions,
      fetchedAt: now,
    }
  }

  return result
}

// ─── GET handler ────────────────────────────────────────────────────────────
export async function GET() {
  const token = process.env.CLARITY_API_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'CLARITY_API_TOKEN não configurado. Gere um token em Settings → Data Export no Clarity.' },
      { status: 503 }
    )
  }

  try {
    const params = new URLSearchParams({ numOfDays: '3', dimension1: 'URL' })
    const res = await fetch(`${CLARITY_API}?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: CACHE_SECONDS },
    })

    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json(
        { error: `Clarity API retornou ${res.status}: ${body}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    const metrics = parseResponse(data)
    return NextResponse.json(metrics)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
