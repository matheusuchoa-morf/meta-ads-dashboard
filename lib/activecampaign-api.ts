// lib/activecampaign-api.ts
// ─────────────────────────────────────────────────────────────────────────────
// ActiveCampaign API v3 — Email Campaign Statistics
// Auth: Header `Api-Token: {key}` — no OAuth needed
// ─────────────────────────────────────────────────────────────────────────────

function getConfig() {
  const apiKey = process.env.ACTIVECAMPAIGN_API_KEY?.trim()
  const account = process.env.ACTIVECAMPAIGN_ACCOUNT?.trim() ?? 'nexusdigital'
  if (!apiKey) throw new Error('ACTIVECAMPAIGN_API_KEY não configurado')
  return { apiKey, baseUrl: `https://${account}.api-us1.com/api/3` }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ACCampaign {
  id: string
  name: string
  sendDate: string        // ISO date string
  sends: number
  opens: number
  uniqueOpens: number
  openRate: number        // 0-100
  clicks: number
  uniqueClicks: number
  clickRate: number       // 0-100
}

// ─── Fetch campaigns ────────────────────────────────────────────────────────

export async function fetchEmailCampaigns(limit = 30): Promise<ACCampaign[]> {
  const { apiKey, baseUrl } = getConfig()

  const params = new URLSearchParams({
    'orders[sdate]': 'DESC',
    limit: String(limit),
  })

  const res = await fetch(`${baseUrl}/campaigns?${params}`, {
    headers: { 'Api-Token': apiKey },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`ActiveCampaign campaigns (${res.status}): ${body}`)
  }

  const json = await res.json()
  const rawCampaigns = json.campaigns as Array<Record<string, unknown>> | undefined

  if (!rawCampaigns) return []

  const nowIso = new Date().toISOString()
  return rawCampaigns
    .filter((c) => {
      const status = String(c.status ?? '')
      const sdate = String(c.sdate ?? '')
      const sends = Number(c.send_amt ?? 0)
      // Only show campaigns that have actually sent emails
      if (status === '0') return false       // draft
      if (!sdate || sdate > nowIso) return false  // future / no date
      return sends > 0                       // must have sent at least 1 email
    })
    .map((c) => {
      const sends = Number(c.send_amt ?? 0)
      const opens = Number(c.opens ?? 0)
      const uniqueOpens = Number(c.uniqueopens ?? 0)
      const clicks = Number(c.linkclicks ?? 0)
      const uniqueClicks = Number(c.uniquelinkclicks ?? 0)

      return {
        id: String(c.id),
        name: String(c.name ?? ''),
        sendDate: String(c.sdate ?? ''),
        sends,
        opens,
        uniqueOpens,
        openRate: sends > 0 ? (uniqueOpens / sends) * 100 : 0,
        clicks,
        uniqueClicks,
        clickRate: sends > 0 ? (uniqueClicks / sends) * 100 : 0,
      }
    })
}
