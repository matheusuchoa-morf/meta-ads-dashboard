// app/api/hotmart/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Agrega vendas do Hotmart por período, fonte e dia.
// Cache de 15min via staleTime no client (dados mudam com menos frequência).
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { fetchHotmartSales } from '@/lib/hotmart-api'
import { DEMO_MODE, DEMO_HOTMART } from '@/lib/demo-data'

// ─── Date range helpers ─────────────────────────────────────────────────────
// ⚠️  O servidor Vercel roda em UTC. O negócio opera no fuso de São Paulo
//     (UTC-3, sem horário de verão desde abr/2019). Usar setHours() no servidor
//     definiria meia-noite em UTC = 21h do dia ANTERIOR no horário de SP.
//     Por isso convertemos explicitamente para o calendário de SP antes de
//     calcular a meia-noite local.
const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000 // UTC-3 fixo

function brazilTodayMidnightUTC(): Date {
  // Representa a hora atual "como se fosse UTC" no calendário de SP
  const nowBrazilLocal = new Date(Date.now() - BRAZIL_OFFSET_MS)
  nowBrazilLocal.setUTCHours(0, 0, 0, 0)          // zera horas nesse calendário
  return new Date(nowBrazilLocal.getTime() + BRAZIL_OFFSET_MS) // volta ao UTC real
}

function getDateRange(preset: string): { start: Date; end: Date } {
  const end   = new Date()                // momento atual em UTC
  const start = brazilTodayMidnightUTC() // meia-noite de hoje no horário de SP, em UTC

  switch (preset) {
    case 'today':
      break // start já é meia-noite de hoje (SP)
    case 'last_7d':
      start.setUTCDate(start.getUTCDate() - 7)
      break
    case 'last_14d':
      start.setUTCDate(start.getUTCDate() - 14)
      break
    case 'last_30d':
      start.setUTCDate(start.getUTCDate() - 30)
      break
    default:
      start.setUTCDate(start.getUTCDate() - 7)
  }

  return { start, end }
}

// ─── Source classification ──────────────────────────────────────────────────
// Classifica o source_sck do Hotmart. Formato: "facebook|paid|<campanha>|<adset>|<ad>".
// Retorna o tipo (metaAds/organic/other) E a campanha (frio/quente) quando identificável.
function classifySource(sck: string): {
  type: 'metaAds' | 'organic' | 'other'
  campaign: 'frio' | 'quente' | null
} {
  if (!sck) return { type: 'other', campaign: null }
  const lower = sck.toLowerCase()
  // formato corrente
  if (lower.includes('-frio'))   return { type: 'metaAds', campaign: 'frio' }
  if (lower.includes('-quente')) return { type: 'metaAds', campaign: 'quente' }
  // Meta Ads genérico (sck antigo IC2 ou paid sem tag de edição / com IDs longos)
  if (
    lower.includes('facebook|paid') ||
    lower.includes('[vendas]') || lower.includes('[f]') || lower.includes('[q]') ||
    /\|\d{10,}/.test(sck)
  ) {
    return { type: 'metaAds', campaign: null }
  }
  if (lower.includes('instagram-org') || lower.includes('bio') || lower.includes('organic')) {
    return { type: 'organic', campaign: null }
  }
  return { type: 'other', campaign: null }
}

// ─── Response type ──────────────────────────────────────────────────────────
export interface HotmartData {
  totalSales: number
  totalRevenue: number
  totalFees: number
  netRevenue: number
  currency: string
  bySource: {
    metaAds: { sales: number; revenue: number }
    organic: { sales: number; revenue: number }
    other: { sales: number; revenue: number }
  }
  // Receita REAL atribuída por campanha via sck do Hotmart (frio/quente).
  byCampaign: {
    frio: { sales: number; revenue: number }
    quente: { sales: number; revenue: number }
  }
  daily: { date: string; sales: number; revenue: number }[]
  fetchedAt: string
}

// ─── GET handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (DEMO_MODE) return NextResponse.json(DEMO_HOTMART)
  const preset = req.nextUrl.searchParams.get('datePreset') ?? 'last_7d'
  const since = req.nextUrl.searchParams.get('since')
  const until = req.nextUrl.searchParams.get('until')
  const isCustomRange = !!(since && until)

  // Verificação de credenciais
  if (!process.env.HOTMART_CLIENT_ID || !process.env.HOTMART_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'HOTMART_CLIENT_ID e HOTMART_CLIENT_SECRET não configurados.' },
      { status: 503 },
    )
  }

  let start: Date, end: Date
  if (isCustomRange) {
    // Parse YYYY-MM-DD strings into Date objects
    // since = start of day in Brazil time, until = end of day (now or end of until date)
    const [sy, sm, sd] = since!.split('-').map(Number)
    start = new Date(Date.UTC(sy, sm - 1, sd) + BRAZIL_OFFSET_MS) // midnight Brazil time in UTC
    const [uy, um, ud] = until!.split('-').map(Number)
    // End of the "until" day: next day midnight Brazil time in UTC
    end = new Date(Date.UTC(uy, um - 1, ud + 1) + BRAZIL_OFFSET_MS)
    // Cap at current time if until is today or future
    const now = new Date()
    if (end > now) end = now
  } else {
    ;({ start, end } = getDateRange(preset))
  }

  try {
    const sales = await fetchHotmartSales(start, end)

    // Aggregations
    let totalRevenue = 0
    let totalFees = 0
    const bySource = {
      metaAds: { sales: 0, revenue: 0 },
      organic: { sales: 0, revenue: 0 },
      other: { sales: 0, revenue: 0 },
    }
    const byCampaign = {
      frio: { sales: 0, revenue: 0 },
      quente: { sales: 0, revenue: 0 },
    }
    const dailyMap = new Map<string, { sales: number; revenue: number }>()

    for (const sale of sales) {
      // Só conta vendas aprovadas/completas
      if (sale.status !== 'APPROVED' && sale.status !== 'COMPLETE') continue

      totalRevenue += sale.price
      totalFees += sale.hotmartFeeTotal

      const { type: srcType, campaign } = classifySource(sale.source)
      bySource[srcType].sales++
      bySource[srcType].revenue += sale.price
      if (campaign) {
        byCampaign[campaign].sales++
        byCampaign[campaign].revenue += sale.price
      }

      // Bucketing diário no calendário de SP (evita atribuir venda de 23:30 SP a outro dia em UTC)
      const saleDateBrazil = new Date(sale.orderDate - BRAZIL_OFFSET_MS)
      const dateStr = saleDateBrazil.toISOString().slice(0, 10)
      const day = dailyMap.get(dateStr) ?? { sales: 0, revenue: 0 }
      day.sales++
      day.revenue += sale.price
      dailyMap.set(dateStr, day)
    }

    const daily = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, d]) => ({ date, ...d }))

    const confirmedSales = sales.filter(
      s => s.status === 'APPROVED' || s.status === 'COMPLETE',
    ).length

    const result: HotmartData = {
      totalSales: confirmedSales,
      totalRevenue,
      totalFees,
      netRevenue: totalRevenue - totalFees,
      currency: 'BRL',
      bySource,
      byCampaign,
      daily,
      fetchedAt: new Date().toISOString(),
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
