// app/api/leads/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Retorna lista detalhada de compradores (leads convertidos) do Hotmart.
// Diferente de /api/hotmart que agrega por dia/source, este endpoint expõe
// os dados brutos de cada venda para a aba Leads.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { fetchHotmartSales, type HotmartSale } from '@/lib/hotmart-api'

const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000

function brazilTodayMidnightUTC(): Date {
  const nowBrazilLocal = new Date(Date.now() - BRAZIL_OFFSET_MS)
  nowBrazilLocal.setUTCHours(0, 0, 0, 0)
  return new Date(nowBrazilLocal.getTime() + BRAZIL_OFFSET_MS)
}

function getDateRange(preset: string): { start: Date; end: Date } {
  const end   = new Date()
  const start = brazilTodayMidnightUTC()

  switch (preset) {
    case 'today':    break
    case 'last_7d':  start.setUTCDate(start.getUTCDate() - 7);  break
    case 'last_14d': start.setUTCDate(start.getUTCDate() - 14); break
    case 'last_30d': start.setUTCDate(start.getUTCDate() - 30); break
    default:         start.setUTCDate(start.getUTCDate() - 7)
  }

  return { start, end }
}

// Classifica a fonte da venda
function classifySource(sck: string): 'metaAds' | 'organic' | 'other' {
  if (!sck) return 'other'
  const lower = sck.toLowerCase()
  if (
    lower.includes('[vendas]') ||
    lower.includes('[f]') ||
    lower.includes('[q]') ||
    /\|\d{10,}/.test(sck)
  ) return 'metaAds'
  if (lower.includes('instagram-org') || lower.includes('bio') || lower.includes('organic')) {
    return 'organic'
  }
  return 'other'
}

// Formata data unix ms → string legível em SP
function fmtDate(ms: number): string {
  if (!ms) return '-'
  const d = new Date(ms)
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export interface LeadEntry {
  transaction: string
  buyerName: string
  buyerEmail: string
  productName: string
  price: number
  currency: string
  paymentMethod: string
  status: string
  sourceRaw: string
  sourceType: 'metaAds' | 'organic' | 'other'
  orderDate: number
  orderDateFmt: string
}

export interface LeadsData {
  leads: LeadEntry[]
  total: number
  totalRevenue: number
  bySource: {
    metaAds: { count: number; revenue: number }
    organic: { count: number; revenue: number }
    other: { count: number; revenue: number }
  }
  fetchedAt: string
}

export async function GET(req: NextRequest) {
  const params   = req.nextUrl.searchParams
  const preset   = params.get('datePreset') ?? 'last_7d'
  const since    = params.get('since')
  const until    = params.get('until')
  const isCustom = !!(since && until)

  if (!process.env.HOTMART_CLIENT_ID || !process.env.HOTMART_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'HOTMART_CLIENT_ID e HOTMART_CLIENT_SECRET não configurados.' },
      { status: 503 },
    )
  }

  let start: Date, end: Date
  if (isCustom) {
    const [sy, sm, sd] = since!.split('-').map(Number)
    start = new Date(Date.UTC(sy, sm - 1, sd) + BRAZIL_OFFSET_MS)
    const [uy, um, ud] = until!.split('-').map(Number)
    end = new Date(Date.UTC(uy, um - 1, ud + 1) + BRAZIL_OFFSET_MS)
    const now = new Date()
    if (end > now) end = now
  } else {
    ;({ start, end } = getDateRange(preset))
  }

  try {
    const sales: HotmartSale[] = await fetchHotmartSales(start, end)

    // Filter only approved/complete
    const approved = sales.filter(s => s.status === 'APPROVED' || s.status === 'COMPLETE')

    const bySource = {
      metaAds: { count: 0, revenue: 0 },
      organic: { count: 0, revenue: 0 },
      other:   { count: 0, revenue: 0 },
    }

    const leads: LeadEntry[] = approved
      .sort((a, b) => b.orderDate - a.orderDate) // mais recentes primeiro
      .map(s => {
        const srcType = classifySource(s.source)
        bySource[srcType].count++
        bySource[srcType].revenue += s.price
        return {
          transaction:  s.transaction,
          buyerName:    s.buyerName   || 'Desconhecido',
          buyerEmail:   s.buyerEmail  || '-',
          productName:  s.productName || '-',
          price:        s.price,
          currency:     s.currency || 'BRL',
          paymentMethod: s.paymentMethod,
          status:       s.status,
          sourceRaw:    s.source,
          sourceType:   srcType,
          orderDate:    s.orderDate,
          orderDateFmt: fmtDate(s.orderDate),
        }
      })

    const totalRevenue = approved.reduce((sum, s) => sum + s.price, 0)

    const result: LeadsData = {
      leads,
      total: approved.length,
      totalRevenue,
      bySource,
      fetchedAt: new Date().toISOString(),
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
