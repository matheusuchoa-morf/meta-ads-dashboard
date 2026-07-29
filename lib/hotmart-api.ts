// lib/hotmart-api.ts
// ─────────────────────────────────────────────────────────────────────────────
// Hotmart Payments API — OAuth2 Client Credentials + Sales endpoints
// Docs: https://developers.hotmart.com/docs/pt-BR/start/app-auth/
// ─────────────────────────────────────────────────────────────────────────────

const AUTH_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token'
const API_BASE = 'https://developers.hotmart.com/payments/api/v1'

// ─── Token cache (in-memory, 24h lifetime) ──────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300_000) {
    return cachedToken.token
  }

  const clientId = process.env.HOTMART_CLIENT_ID
  const clientSecret = process.env.HOTMART_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('HOTMART_CLIENT_ID e HOTMART_CLIENT_SECRET não configurados')
  }

  // Compute Basic auth from credentials (avoids env var encoding issues)
  const basic = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(`${AUTH_URL}?${params}`, {
    method: 'POST',
    headers: {
      Authorization: basic,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Hotmart auth falhou (${res.status}): ${body}`)
  }

  const data = await res.json()
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return cachedToken.token
}

// ─── Types ──────────────────────────────────────────────────────────────────
export interface HotmartSale {
  productName: string
  productId: number
  buyerName: string
  buyerEmail: string
  orderDate: number       // unix ms
  approvedDate?: number   // unix ms
  status: string
  price: number
  currency: string
  paymentMethod: string
  hotmartFeeTotal: number
  source: string          // tracking source_sck
  transaction: string
}

// ─── Fetch all sales (paginated) ────────────────────────────────────────────
export async function fetchHotmartSales(
  startDate: Date,
  endDate: Date,
): Promise<HotmartSale[]> {
  const token = await getAccessToken()
  const startMs = startDate.getTime()
  const endMs = endDate.getTime()

  const allSales: HotmartSale[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      start_date: String(startMs),
      end_date: String(endMs),
      max_results: '50',
    })
    if (pageToken) params.set('page_token', pageToken)

    const res = await fetch(`${API_BASE}/sales/history?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Hotmart sales API (${res.status}): ${body}`)
    }

    const data = await res.json()
    const items: unknown[] = data.items ?? []

    for (const raw of items) {
      const item = raw as Record<string, Record<string, unknown>>
      const purchase = item.purchase ?? {}
      const price = purchase.price as Record<string, unknown> | undefined
      const payment = purchase.payment as Record<string, unknown> | undefined
      const fee = purchase.hotmart_fee as Record<string, unknown> | undefined
      const tracking = purchase.tracking as Record<string, unknown> | undefined

      allSales.push({
        productName: (item.product?.name as string) ?? '',
        productId: (item.product?.id as number) ?? 0,
        buyerName: (item.buyer?.name as string) ?? '',
        buyerEmail: (item.buyer?.email as string) ?? '',
        orderDate: (purchase.order_date as number) ?? 0,
        approvedDate: purchase.approved_date as number | undefined,
        status: (purchase.status as string) ?? '',
        price: (price?.value as number) ?? 0,
        currency: (price?.currency_code as string) ?? 'BRL',
        paymentMethod: (payment?.type as string) ?? '',
        hotmartFeeTotal: (fee?.total as number) ?? 0,
        source: (tracking?.source_sck as string) ?? '',
        transaction: (purchase.transaction as string) ?? '',
      })
    }

    pageToken = (data.page_info as Record<string, unknown>)?.next_page_token as string | undefined
  } while (pageToken)

  return allSales
}
