// app/api/cron/route.ts
// Scheduled health check: fetches funnel + Hotmart data, sends alerts
// Horário comercial 09h-22h BRT (12h UTC - 01h UTC+1d), hourly via GitHub Actions
import { NextRequest, NextResponse } from 'next/server'
import {
  fetchFunnelInsights, fetchCampaigns,
  fetchAdInsights, fetchAdStatuses, updateAdStatus,
} from '@/lib/meta-api'
import { buildPurchaseFunnel, buildHealthMetrics } from '@/lib/funnel-resolver'
import { classifyCampaign } from '@/lib/campaign-classifier'
import { sumActions, CHECKOUT_PATTERNS } from '@/lib/action-matchers'
import {
  sendHealthAlerts, sendSaleAlert, sendCheckoutAlert, sendAutoPauseAlert,
  type AutoPausedAd,
} from '@/lib/notifications'

// Ticket medio (para calculo de potencial perdido)
const AVG_TICKET = 197

// Regra: pausar ad ACTIVE que gastou >= threshold HOJE sem gerar nenhum checkout.
// Default (fallback) R$35; por edição/campanha os overrides abaixo mandam.
const AUTO_PAUSE_SPEND_THRESHOLD = 35

// Overrides por ad: ads listados aqui só pausam quando passam do valor customizado.
// Útil pra estender teste de ad com bom CTR que ainda não converteu.
const AUTO_PAUSE_OVERRIDES: Record<string, number> = {
  '120246409293310745': 110, // ADV - Demita Todos — testando V4 jornada-maio até R$75
}

// Overrides por padrão de nome de campanha: aplicado quando ad_id não tem override próprio.
// Útil pra ajustar threshold pra famílias inteiras de campanha (ex: RMKT pode rodar mais
// caro porque público quente/15D tem cycle maior antes de converter).
// Match: case-insensitive includes em campaign_name.
// Estabelecido 25/04/2026: ads RMKT IC2 com público 15D + ROAS forte merecem R$50 (vs R$35 padrão).
// ICM3 (decisão Matheus 19/06/2026): frio pausa em R$42 / quente em R$60 (0 checkout no dia).
// Match: case-insensitive includes em campaign_name. Quente vem antes de frio (mais específico).
const AUTO_PAUSE_CAMPAIGN_NAME_OVERRIDES: Array<{ pattern: string; threshold: number; reason: string }> = [
  { pattern: 'quente',      threshold: 60, reason: 'Quente/RMKT — público quente, cycle de venda maior (R$60)' },
  { pattern: 'remarketing', threshold: 60, reason: 'Quente/RMKT — público quente, cycle de venda maior (R$60)' },
  { pattern: '[q]',         threshold: 60, reason: 'Quente/RMKT — público quente, cycle de venda maior (R$60)' },
  { pattern: 'frio',        threshold: 42, reason: 'Frio — stop-loss ~1,3× CPChk médio (R$42)' },
]

function getAutoPauseThreshold(ad: { ad_id: string; campaign_name?: string }): number {
  // 1) Ad-level override tem prioridade máxima
  if (AUTO_PAUSE_OVERRIDES[ad.ad_id] !== undefined) {
    return AUTO_PAUSE_OVERRIDES[ad.ad_id]
  }
  // 2) Campaign-name pattern override
  const campName = (ad.campaign_name ?? '').toLowerCase()
  for (const rule of AUTO_PAUSE_CAMPAIGN_NAME_OVERRIDES) {
    if (campName.includes(rule.pattern.toLowerCase())) return rule.threshold
  }
  // 3) Default
  return AUTO_PAUSE_SPEND_THRESHOLD
}

// Horário comercial BRT (inclusive): 09h-22h. Fora disso o cron retorna sem agir.
const BUSINESS_HOURS_START_BRT = 9
const BUSINESS_HOURS_END_BRT   = 22

// Stateless throttle: track last alert time in a global variable
// Throttle: health alerts = 1x/hora, vendas e carrinhos = sempre (sem throttle)
let lastHealthAlertAt = 0
let lastSaleCount = -1
const HEALTH_THROTTLE_MS = 55 * 60 * 1000  // ~1 hora entre alertas de saúde

function currentHourBRT(): number {
  // BRT is UTC-3 (no DST since 2019)
  const utcHour = new Date().getUTCHours()
  return (utcHour - 3 + 24) % 24
}

function isBusinessHourBRT(): boolean {
  const h = currentHourBRT()
  return h >= BUSINESS_HOURS_START_BRT && h <= BUSINESS_HOURS_END_BRT
}

export async function GET(req: NextRequest) {
  // Auth: Vercel cron sends this header, or external cron sends Bearer token
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    const vercelCron = req.headers.get('x-vercel-cron')
    const bearerMatch = authHeader === `Bearer ${cronSecret}`
    if (!vercelCron && !bearerMatch) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Business-hour gate (09h-20h BRT). Query param ?force=1 bypasses for manual tests.
  const url = new URL(req.url)
  const forceBypass = url.searchParams.get('force') === '1'
  if (!forceBypass && !isBusinessHourBRT()) {
    return NextResponse.json({
      status: 'skip',
      reason: `outside business hours BRT (${currentHourBRT()}h, allowed ${BUSINESS_HOURS_START_BRT}-${BUSINESS_HOURS_END_BRT}h)`,
    })
  }

  try {
    // ── 1. Resolve campaign IDs (Imersão Claude — inclui IC2 atual + IC legado) ──
    const allCampaigns = await fetchCampaigns()
    const icCampaigns = allCampaigns.filter(c => {
      const tag = classifyCampaign(c.name).tag
      return (tag === 'IC' || tag === 'IC2' || tag === 'IC3')
          && (c.effective_status === 'ACTIVE' || c.effective_status === 'PAUSED' ||
              c.effective_status === 'CAMPAIGN_PAUSED' || c.effective_status === 'ADSET_PAUSED')
    })
    // Preferência: edição corrente primeiro — IC3 > IC2 > IC legado.
    const ic3Only = icCampaigns.filter(c => classifyCampaign(c.name).tag === 'IC3')
    const ic2Only = icCampaigns.filter(c => classifyCampaign(c.name).tag === 'IC2')
    const selected = ic3Only.length > 0 ? ic3Only : (ic2Only.length > 0 ? ic2Only : icCampaigns)
    const selectedTag = ic3Only.length > 0 ? 'IC3' : (ic2Only.length > 0 ? 'IC2' : 'IC')
    const campaignIds = selected.map(c => c.id)

    if (campaignIds.length === 0) {
      return NextResponse.json({ status: 'skip', reason: 'No IC/IC2 campaigns found' })
    }

    // ── 2. Fetch funnel data ──
    const { current } = await fetchFunnelInsights(campaignIds, 'today')

    if (!current) {
      return NextResponse.json({ status: 'skip', reason: 'No funnel data for today' })
    }

    const currentData = current as unknown as Record<string, unknown>
    const health = buildHealthMetrics(currentData)
    const stages = buildPurchaseFunnel(currentData)

    // ── 3. Check health alerts (yellow + red) ──
    const alertMetrics = health
      .filter(m => m.status === 'yellow' || m.status === 'red')
      .map(m => ({
        key: m.key,
        label: m.label,
        formatted: m.formatted,
        status: m.status as 'yellow' | 'red',
      }))

    const now = Date.now()

    // Health alerts: throttled (1x/hora)
    if (alertMetrics.length > 0 && now - lastHealthAlertAt > HEALTH_THROTTLE_MS) {
      await sendHealthAlerts(alertMetrics)
      lastHealthAlertAt = now
    }

    // ── 3.5. Auto-pause ads: spend >= R$35 hoje sem nenhum checkout ──
    let autoPausedAds: AutoPausedAd[] = []
    try {
      autoPausedAds = await runAutoPauseRule(campaignIds)
      if (autoPausedAds.length > 0) {
        await sendAutoPauseAlert(autoPausedAds)
      }
    } catch (err) {
      console.error('[auto-pause] falhou:', err)
    }

    // ── 4. Check checkout abandoned (SEMPRE — sem throttle) ──
    const checkoutStage = stages.find(s => s.key === 'checkout')
    const purchaseStage = stages.find(s => s.key === 'purchases')
    const checkouts  = checkoutStage?.value ?? 0
    const purchases  = purchaseStage?.value ?? 0

    if (checkouts > 0 && purchases === 0) {
      // Fetch WAITING_PAYMENT buyers from Hotmart (nome + email)
      let abandonedBuyers: import('@/lib/notifications').AbandonedBuyer[] = []
      try {
        const waitingBuyers = await fetchWaitingPaymentBuyers()
        abandonedBuyers = waitingBuyers
      } catch { /* Hotmart fetch failed — continue without buyer names */ }

      await sendCheckoutAlert({
        checkouts,
        purchases,
        convRate: 0,
        potentialLost: checkouts * AVG_TICKET,
        buyers: abandonedBuyers.length > 0 ? abandonedBuyers : undefined,
      })
    }

    // ── 5. Check new sales (Hotmart) ──
    let newSalesCount = 0
    try {
      // Fetch Hotmart data using internal API
      const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000
      const todayStart = new Date(Date.now() - BRAZIL_OFFSET_MS)
      todayStart.setUTCHours(0, 0, 0, 0)
      const startMs = new Date(todayStart.getTime() + BRAZIL_OFFSET_MS).getTime()

      // Use Hotmart client credentials to fetch sales directly
      const hotmartRes = await fetchHotmartSales(startMs)
      const totalSales = hotmartRes.totalSales

      if (lastSaleCount === -1) {
        // First run — initialize without alerting
        lastSaleCount = totalSales
      } else if (totalSales > lastSaleCount) {
        newSalesCount = totalSales - lastSaleCount

        for (let i = 0; i < newSalesCount; i++) {
          const sale = hotmartRes.recentSales?.[i]
          await sendSaleAlert({
            product: sale?.product ?? 'Imersao Claude',
            value: sale?.value ?? AVG_TICKET,
            source: sale?.source ?? 'Meta Ads',
            totalToday: totalSales,
            goal: 100,
            goalPct: Math.round((totalSales / 100) * 100),
          })
        }

        lastSaleCount = totalSales
      }
    } catch {
      // Hotmart fetch failed — skip sales alerts but continue
    }

    return NextResponse.json({
      status: 'ok',
      healthAlerts: alertMetrics.length,
      checkoutAbandoned: checkouts > 0 && purchases === 0,
      newSales: newSalesCount,
      autoPaused: autoPausedAds.length,
      autoPausedAds: autoPausedAds.map(a => ({ id: a.adId, name: a.adName, spend: a.spend })),
      hourBRT: currentHourBRT(),
      tracked: {
        campaigns: campaignIds.length,
        tag: selectedTag,
        checkouts, purchases,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── Auto-pause rule: spend >= R$35 & 0 checkouts today → PAUSE ──────────────

async function runAutoPauseRule(campaignIds: string[]): Promise<AutoPausedAd[]> {
  // 1) Pull today's ad-level insights for IC campaigns
  const insights = await fetchAdInsights('today', campaignIds)

  // 2) Filter candidates: spend >= threshold AND zero checkouts
  //    Threshold lookup: ad-level override > campaign-name pattern > default R$35.
  const candidates = insights.filter(i => {
    const spend = parseFloat(i.spend || '0')
    const checkouts = sumActions(i.actions, CHECKOUT_PATTERNS)
    const threshold = getAutoPauseThreshold({ ad_id: i.ad_id, campaign_name: i.campaign_name })
    return spend >= threshold && checkouts === 0
  })
  if (candidates.length === 0) return []

  // 3) Only pause ads that are still ACTIVE (avoid duplicate notifications)
  const statuses = await fetchAdStatuses(candidates.map(c => c.ad_id))

  const toPause = candidates.filter(c => statuses[c.ad_id] === 'ACTIVE')
  if (toPause.length === 0) return []

  // 4) Pause each, collect the successes
  const paused: AutoPausedAd[] = []
  for (const ad of toPause) {
    try {
      await updateAdStatus(ad.ad_id, 'PAUSED')
      paused.push({
        adId: ad.ad_id,
        adName: ad.ad_name,
        campaignName: ad.campaign_name ?? '—',
        spend: parseFloat(ad.spend || '0'),
      })
    } catch (err) {
      console.error(`[auto-pause] falha ao pausar ${ad.ad_id}:`, err)
    }
  }
  return paused
}

// ─── Hotmart helpers (auth matching hotmart-api.ts pattern) ──────────────────

async function getHotmartToken(): Promise<string | null> {
  const clientId = process.env.HOTMART_CLIENT_ID?.trim()
  const clientSecret = process.env.HOTMART_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null

  const basic = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(`https://api-sec-vlc.hotmart.com/security/oauth/token?${params}`, {
    method: 'POST',
    headers: {
      Authorization: basic,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.access_token
}

interface HotmartSalesResult {
  totalSales: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recentSales: { product: string; value: number; source: string }[]
}

async function fetchHotmartSales(sinceMs: number): Promise<HotmartSalesResult> {
  const token = await getHotmartToken()
  if (!token) return { totalSales: 0, recentSales: [] }

  const url = new URL('https://developers.hotmart.com/payments/api/v1/sales/history')
  url.searchParams.set('start_date', sinceMs.toString())
  url.searchParams.set('end_date', Date.now().toString())
  url.searchParams.set('transaction_status', 'APPROVED')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return { totalSales: 0, recentSales: [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as { items?: any[] }
  const items = data.items ?? []

  return {
    totalSales: items.length,
    recentSales: items.slice(0, 5).map(item => ({
      product: item.product?.name ?? 'Produto',
      value: item.purchase?.price?.value ?? 0,
      source: item.purchase?.tracking?.source_sck ? 'Meta Ads' : 'Orgânico',
    })),
  }
}

// ─── Fetch WAITING_PAYMENT buyers (checkout abandonado) ─────────────────────

async function fetchWaitingPaymentBuyers(): Promise<import('@/lib/notifications').AbandonedBuyer[]> {
  const token = await getHotmartToken()
  if (!token) return []

  const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000
  const todayStart = new Date(Date.now() - BRAZIL_OFFSET_MS)
  todayStart.setUTCHours(0, 0, 0, 0)
  const startMs = new Date(todayStart.getTime() + BRAZIL_OFFSET_MS).getTime()

  const url = new URL('https://developers.hotmart.com/payments/api/v1/sales/history')
  url.searchParams.set('start_date', startMs.toString())
  url.searchParams.set('end_date', Date.now().toString())
  url.searchParams.set('transaction_status', 'WAITING_PAYMENT')
  url.searchParams.set('max_results', '50')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as { items?: any[] }
  const items = data.items ?? []

  return items.map(item => {
    const buyer = item.buyer ?? {}
    const purchase = item.purchase ?? {}
    const price = purchase.price ?? {}
    const orderDate = purchase.order_date
    const dateFmt = orderDate
      ? new Date(orderDate).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
      : '—'

    return {
      name: buyer.name ?? 'Desconhecido',
      email: buyer.email ?? '—',
      value: price.value ?? 0,
      date: dateFmt,
    }
  })
}
