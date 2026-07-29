// app/api/hotmart/webhook/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Hotmart webhook: receives sale events and sends Discord alerts immediately
// Register this URL in Hotmart: {NEXTAUTH_URL}/api/hotmart/webhook
// Events: PURCHASE_APPROVED, PURCHASE_COMPLETE
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { sendSaleAlert } from '@/lib/notifications'
import { sendCAPIPurchase } from '@/lib/meta-capi'

const AVG_TICKET = parseInt(process.env.AVG_TICKET ?? '997')

// Meta Ads UTMs typically contain brackets like [campanha][conjunto] or pipes like audience|180d
// They rarely contain plain "meta"/"fb" — matching by structure is more reliable.
function resolveSource(sck: string): string {
  if (!sck) return 'Orgânico'
  const s = sck.toLowerCase()
  const isMeta =
    s.includes('meta') || s.includes('facebook') || s.includes('fb.') ||
    /^\[/.test(sck) ||          // starts with [ — Meta campaign name bracket format
    s.includes('|')             // pipe separator — Meta audience UTM pattern
  if (isMeta) return 'Meta Ads'
  if (s.includes('google') || s.includes('gads') || s.includes('gclid')) return 'Google Ads'
  if (s.includes('email') || s.includes('activecampaign') || s.includes('ac_')) return 'E-mail'
  if (s.includes('instagram') || s.includes('ig_')) return 'Instagram'
  if (s.includes('youtube') || s.includes('yt_')) return 'YouTube'
  if (s.includes('organic') || s.includes('organico')) return 'Orgânico'
  return sck  // unknown — return raw so nothing is lost
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Optional: verify hottok secret (set HOTMART_HOTTOK in Vercel env vars)
  const hottok = process.env.HOTMART_HOTTOK
  if (hottok && body.hottok !== hottok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const event = String(body.event ?? '')

  // Only process approved/complete purchases
  if (event !== 'PURCHASE_APPROVED' && event !== 'PURCHASE_COMPLETE') {
    return NextResponse.json({ status: 'ignored', event })
  }

  const data = body.data as Record<string, unknown> ?? {}
  const buyer    = data.buyer    as Record<string, unknown> ?? {}
  const product  = data.product  as Record<string, unknown> ?? {}
  const purchase = data.purchase as Record<string, unknown> ?? {}
  const price    = (purchase.price as Record<string, unknown>) ?? {}
  const tracking = (purchase.tracking as Record<string, unknown>) ?? {}

  const productName  = String(product.name  ?? 'Produto')
  const productId    = String(product.id    ?? '')
  const value        = Number(price.value   ?? AVG_TICKET)
  const currency     = String(price.currency_value ?? 'BRL')
  const sourceSck    = String(tracking.source_sck  ?? '')
  const source       = resolveSource(sourceSck)
  const buyerName    = String(buyer.name  ?? '')
  const buyerEmail   = String((buyer as Record<string,unknown>).email   ?? '')
  const buyerPhone   = String((buyer as Record<string,unknown>).checkout_phone ?? (buyer as Record<string,unknown>).phone ?? '')
  const transaction  = String((purchase as Record<string,unknown>).transaction ?? '')
  const nameParts    = buyerName.trim().split(/\s+/)
  const firstName    = nameParts[0]  ?? ''
  const lastName     = nameParts.slice(1).join(' ') ?? ''

  // ── 1. Meta Conversions API (server-side Purchase) ──────────────────────
  // Roda em paralelo com a notificação — não bloqueia o retorno ao Hotmart
  void sendCAPIPurchase({
    email:       buyerEmail   || undefined,
    phone:       buyerPhone   || undefined,
    firstName:   firstName    || undefined,
    lastName:    lastName     || undefined,
    value,
    currency,
    contentName: productName,
    contentIds:  productId ? [productId] : [],
    eventId:     transaction  || undefined,   // deduplicação com pixel browser
    sourceUrl:   'https://your-domain.com/pagina-a/',
  }).catch(err => console.error('[CAPI] Falha silenciosa:', err))

  // ── 2. Alerta de venda (Discord / Telegram) ──────────────────────────────
  try {
    await sendSaleAlert({
      product: productName,
      value,
      source,
      buyer: buyerName || undefined,
      totalToday: 0,   // no running total on webhook — cron handles daily count
      goal: 100,
      goalPct: 0,
    })
  } catch {
    // Notification failed — still return 200 so Hotmart doesn't retry
  }

  return NextResponse.json({ status: 'ok', event, product: productName })
}
