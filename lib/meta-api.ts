// lib/meta-api.ts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bizSdk = require('facebook-nodejs-business-sdk')

const { AdAccount, Campaign, Ad } = bizSdk

function initApi() {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) throw new Error('META_ACCESS_TOKEN is not set')
  bizSdk.FacebookAdsApi.init(token)
  return {
    accountId: process.env.META_AD_ACCOUNT_ID!
  }
}

export interface CampaignData {
  id: string
  name: string
  status: string
  effective_status: string
  daily_budget?: string
  lifetime_budget?: string
  objective: string
}

export interface InsightsData {
  campaign_id: string
  campaign_name: string
  impressions: string
  reach: string
  clicks: string
  spend: string
  ctr: string
  cpc: string
  cpm: string
  frequency: string
  unique_outbound_clicks: string
  outbound_clicks?: { action_type: string; value: string }[]
  actions?: { action_type: string; value: string }[]
  purchase_roas: { action_type: string; value: string }[]
  cost_per_result: { action_type: string; value: string }[]
  date_start: string
  date_stop: string
}

export async function fetchCampaigns(): Promise<CampaignData[]> {
  const { accountId } = initApi()
  const account = new AdAccount(accountId)
  const campaigns = await account.getCampaigns([
    'id', 'name', 'status', 'effective_status',
    'daily_budget', 'lifetime_budget', 'objective'
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return campaigns.map((c: any) => c._data)
}

export async function fetchInsights(
  datePreset: string = 'last_7d',
  campaignId?: string
): Promise<InsightsData[]> {
  const { accountId } = initApi()
  const account = new AdAccount(accountId)
  const fields = [
    'campaign_id', 'campaign_name', 'impressions', 'reach', 'clicks',
    'spend', 'ctr', 'cpc', 'cpm', 'frequency',
    'unique_outbound_clicks', 'outbound_clicks', 'actions', 'cost_per_action_type',
    'purchase_roas', 'cost_per_result'
  ]
  const params: Record<string, unknown> = {
    level: 'campaign',
    date_preset: datePreset,
    filtering: campaignId
      ? [{ field: 'campaign.id', operator: 'EQUAL', value: campaignId }]
      : []
  }
  const insights = await account.getInsights(fields, params)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return insights.map((i: any) => i._data)
}

/**
 * Fetch funnel insights aggregated across multiple campaigns.
 * Returns a single aggregated row by fetching at account level with campaign ID filtering.
 */
export async function fetchFunnelInsights(
  campaignIds: string[],
  datePreset: string = 'last_7d',
  compareDatePreset?: string
): Promise<{ current: InsightsData; previous?: InsightsData }> {
  const fields = [
    'campaign_id', 'impressions', 'reach', 'clicks', 'spend', 'ctr',
    'unique_outbound_clicks', 'outbound_clicks', 'actions', 'purchase_roas', 'cost_per_result',
    'cost_per_action_type'
  ]
  const { accountId } = initApi()
  const account = new AdAccount(accountId)

  const filtering = campaignIds.length > 0
    ? [{ field: 'campaign.id', operator: 'IN', value: campaignIds }]
    : []

  // Fetch at account level (aggregated) — no level:'campaign' so it sums everything
  const params: Record<string, unknown> = {
    date_preset: datePreset,
    filtering,
  }
  const current = await account.getInsights(fields, params)

  let previous
  if (compareDatePreset) {
    const prevParams = { ...params, date_preset: compareDatePreset }
    previous = await account.getInsights(fields, prevParams)
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    current: current[0]?._data,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    previous: previous?.[0]?._data
  }
}

export interface DailyInsight {
  campaign_id: string
  campaign_name?: string
  impressions: string
  clicks: string
  spend: string
  ctr: string
  actions?: { action_type: string; value: string }[]
  purchase_roas?: { action_type: string; value: string }[]
  date_start: string
  date_stop: string
}

export async function fetchDailyInsights(
  datePreset: string = 'last_7d',
  campaignIds?: string[]
): Promise<DailyInsight[]> {
  const { accountId } = initApi()
  const account = new AdAccount(accountId)
  const fields = [
    'campaign_id', 'campaign_name', 'impressions', 'clicks',
    'spend', 'ctr', 'actions', 'purchase_roas', 'date_start', 'date_stop'
  ]
  const params: Record<string, unknown> = {
    level: 'campaign',
    date_preset: datePreset,
    time_increment: 1,
    filtering: campaignIds?.length
      ? [{ field: 'campaign.id', operator: 'IN', value: campaignIds }]
      : []
  }
  const insights = await account.getInsights(fields, params)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return insights.map((i: any) => i._data)
}

export async function fetchInsightsTimeRange(
  since: string,
  until: string,
  campaignIds?: string[]
): Promise<InsightsData[]> {
  const { accountId } = initApi()
  const account = new AdAccount(accountId)
  const fields = [
    'campaign_id', 'campaign_name', 'impressions', 'reach', 'clicks',
    'spend', 'ctr', 'cpc', 'cpm', 'frequency',
    'unique_outbound_clicks', 'outbound_clicks', 'actions', 'cost_per_action_type',
    'purchase_roas', 'cost_per_result'
  ]
  const params: Record<string, unknown> = {
    level: 'campaign',
    time_range: { since, until },
    filtering: campaignIds?.length
      ? [{ field: 'campaign.id', operator: 'IN', value: campaignIds }]
      : []
  }
  const insights = await account.getInsights(fields, params)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return insights.map((i: any) => i._data)
}

export async function fetchDailyInsightsTimeRange(
  since: string,
  until: string,
  campaignIds?: string[]
): Promise<DailyInsight[]> {
  const { accountId } = initApi()
  const account = new AdAccount(accountId)
  const fields = [
    'campaign_id', 'campaign_name', 'impressions', 'clicks',
    'spend', 'ctr', 'actions', 'purchase_roas', 'date_start', 'date_stop'
  ]
  const params: Record<string, unknown> = {
    level: 'campaign',
    time_range: { since, until },
    time_increment: 1,
    filtering: campaignIds?.length
      ? [{ field: 'campaign.id', operator: 'IN', value: campaignIds }]
      : []
  }
  const insights = await account.getInsights(fields, params)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return insights.map((i: any) => i._data)
}

// ─── Funil diário (agregado por dia, nível conta) ───────────────────────────
// Diferente de fetchDailyInsightsTimeRange (nível campanha → 1 linha por campanha
// por dia), este agrega TODAS as campanhas do filtro em UMA linha por dia.
export interface DailyFunnelRow {
  date_start: string
  date_stop: string
  spend: string
  impressions: string
  cpm?: string
  clicks: string
  ctr: string
  outbound_clicks?: { action_type: string; value: string }[]
  actions?: { action_type: string; value: string }[]
}

export async function fetchDailyFunnelMetrics(
  campaignIds: string[],
  since: string,
  until: string,
): Promise<DailyFunnelRow[]> {
  const { accountId } = initApi()
  const account = new AdAccount(accountId)
  const fields = [
    'spend', 'impressions', 'cpm', 'clicks', 'ctr',
    'outbound_clicks', 'actions', 'date_start', 'date_stop',
  ]
  const params: Record<string, unknown> = {
    // sem `level` → Meta agrega no nível conta (1 linha por dia)
    time_range: { since, until },
    time_increment: 1,
    filtering: campaignIds.length
      ? [{ field: 'campaign.id', operator: 'IN', value: campaignIds }]
      : [],
  }
  const insights = await account.getInsights(fields, params)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return insights.map((i: any) => i._data)
}

export async function fetchFunnelInsightsTimeRange(
  campaignIds: string[],
  since: string,
  until: string
): Promise<{ current: InsightsData; previous?: InsightsData }> {
  const fields = [
    'campaign_id', 'impressions', 'reach', 'clicks', 'spend', 'ctr',
    'unique_outbound_clicks', 'outbound_clicks', 'actions', 'purchase_roas', 'cost_per_result',
    'cost_per_action_type'
  ]
  const { accountId } = initApi()
  const account = new AdAccount(accountId)

  const filtering = campaignIds.length > 0
    ? [{ field: 'campaign.id', operator: 'IN', value: campaignIds }]
    : []

  const params: Record<string, unknown> = {
    time_range: { since, until },
    filtering,
  }
  const current = await account.getInsights(fields, params)

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    current: current[0]?._data,
    previous: undefined  // No comparison for custom range
  }
}

export async function fetchAdInsightsTimeRange(
  since: string,
  until: string,
  campaignIds?: string[]
): Promise<AdInsightData[]> {
  const { accountId } = initApi()
  const account = new AdAccount(accountId)
  const fields = [
    'ad_id', 'ad_name', 'adset_id', 'adset_name',
    'campaign_id', 'campaign_name',
    'impressions', 'clicks', 'inline_link_clicks', 'spend', 'ctr', 'cpc',
    'actions', 'purchase_roas', 'video_play_actions',
    'video_avg_time_watched_actions', 'video_play_curve_actions', 'cpm',
  ]
  const params: Record<string, unknown> = {
    level: 'ad',
    time_range: { since, until },
    sort: ['spend_descending'],
    limit: 25,
    filtering: campaignIds?.length
      ? [{ field: 'campaign.id', operator: 'IN', value: campaignIds }]
      : [],
  }
  const insights = await account.getInsights(fields, params)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return insights.map((i: any) => i._data)
}

export async function updateCampaignStatus(
  campaignId: string,
  status: 'ACTIVE' | 'PAUSED'
): Promise<void> {
  initApi()
  const campaign = new Campaign(campaignId)
  await campaign.update({ status })
}

export async function updateAdStatus(
  adId: string,
  status: 'ACTIVE' | 'PAUSED'
): Promise<void> {
  initApi()
  const ad = new Ad(adId)
  await ad.update({ status })
}

/** Fetches effective_status for ad IDs. Batched via ?ids= (1 chamada por 50 ads,
 *  em vez de 1 por ad) — corta MUITO o volume de chamadas e o risco de rate limit. */
export async function fetchAdStatuses(adIds: string[]): Promise<Record<string, string>> {
  if (adIds.length === 0) return {}
  const token = process.env.META_ACCESS_TOKEN
  const result: Record<string, string> = {}
  for (let i = 0; i < adIds.length; i += 50) {
    const chunk = adIds.slice(i, i + 50)
    try {
      const url = `https://graph.facebook.com/v21.0/?ids=${chunk.join(',')}&fields=effective_status&access_token=${token}`
      const data = await (await fetch(url)).json()
      for (const id of chunk) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result[id] = (data as any)?.[id]?.effective_status ?? 'UNKNOWN'
      }
    } catch {
      for (const id of chunk) result[id] = result[id] ?? 'UNKNOWN'
    }
  }
  return result
}

// ─── Durações de vídeo (p/ derivar o hook de 3s da curva de retenção) ────────
// Caches (estáveis — ad→video_id e video→duração nunca mudam).
const _adVideoIdCache = new Map<string, string | null>()
const _videoDurationCache = new Map<string, number>()

/** Mapa ad_id → duração do vídeo (segundos). Só ads de vídeo. Batched via ?ids=
 *  (1 chamada por 50) + cacheado. Best-effort — nunca lança. */
export async function fetchAdVideoDurations(adIds: string[]): Promise<Record<string, number>> {
  if (adIds.length === 0) return {}
  const token = process.env.META_ACCESS_TOKEN
  const V = 'v21.0'
  // 1) ad_id → video_id (batched, cacheado)
  const unknown = adIds.filter(id => !_adVideoIdCache.has(id))
  for (let i = 0; i < unknown.length; i += 50) {
    const chunk = unknown.slice(i, i + 50)
    try {
      const url = `https://graph.facebook.com/${V}/?ids=${chunk.join(',')}&fields=creative{object_story_spec}&access_token=${token}`
      const data = await (await fetch(url)).json()
      for (const id of chunk) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vid = (data as any)?.[id]?.creative?.object_story_spec?.video_data?.video_id ?? null
        _adVideoIdCache.set(id, vid)
      }
    } catch {
      for (const id of chunk) if (!_adVideoIdCache.has(id)) _adVideoIdCache.set(id, null)
    }
  }
  // 2) video_id → length (batched, cacheado)
  const videoIds = [...new Set(adIds.map(id => _adVideoIdCache.get(id)).filter((v): v is string => !!v))]
  const needLen = videoIds.filter(v => !_videoDurationCache.has(v))
  for (let i = 0; i < needLen.length; i += 50) {
    const chunk = needLen.slice(i, i + 50)
    try {
      const url = `https://graph.facebook.com/${V}/?ids=${chunk.join(',')}&fields=length&access_token=${token}`
      const data = await (await fetch(url)).json()
      for (const v of chunk) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const len = parseFloat((data as any)?.[v]?.length)
        if (len > 0) _videoDurationCache.set(v, len)
      }
    } catch { /* ignora */ }
  }
  const out: Record<string, number> = {}
  for (const id of adIds) {
    const vid = _adVideoIdCache.get(id)
    if (vid && _videoDurationCache.has(vid)) out[id] = _videoDurationCache.get(vid)!
  }
  return out
}

// ─── Ad-level insights ────────────────────────────────────────────────────────

export interface AdInsightData {
  ad_id: string
  ad_name: string
  adset_id?: string
  adset_name?: string
  campaign_id?: string
  campaign_name?: string
  impressions: string
  clicks: string
  inline_link_clicks?: string            // cliques só no link/CTA (denominador de Connect)
  spend: string
  ctr: string
  cpc?: string
  cpm?: string
  actions?: { action_type: string; value: string }[]
  purchase_roas?: { action_type: string; value: string }[]
  video_play_actions?: { action_type: string; value: string }[]
  video_avg_time_watched_actions?: { action_type: string; value: string }[]
  // Curva de retenção: value = array de 22 pontos (% dos plays ainda assistindo),
  // do início (100) ao fim do vídeo (0). Usada p/ derivar o hook de 3s + duração.
  video_play_curve_actions?: { action_type: string; value: number[] }[]
  date_start: string
  date_stop: string
}

/** Top-performing ads sorted by spend descending */
export async function fetchAdInsights(
  datePreset: string = 'last_7d',
  campaignIds?: string[]
): Promise<AdInsightData[]> {
  const { accountId } = initApi()
  const account = new AdAccount(accountId)
  const fields = [
    'ad_id', 'ad_name', 'adset_id', 'adset_name',
    'campaign_id', 'campaign_name',
    'impressions', 'clicks', 'inline_link_clicks', 'spend', 'ctr', 'cpc',
    'actions', 'purchase_roas', 'video_play_actions',
    'video_avg_time_watched_actions', 'video_play_curve_actions', 'cpm',
  ]
  const params: Record<string, unknown> = {
    level: 'ad',
    date_preset: datePreset,
    sort: ['spend_descending'],
    limit: 25,
    filtering: campaignIds?.length
      ? [{ field: 'campaign.id', operator: 'IN', value: campaignIds }]
      : [],
  }
  const insights = await account.getInsights(fields, params)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return insights.map((i: any) => i._data)
}

// ─── Lista de ads (p/ mostrar ATIVOS sem entrega ainda) ─────────────────────
export interface AdListItem {
  ad_id: string
  ad_name: string
  effective_status: string
  campaign_id?: string
}

/**
 * Lista ads (id, nome, status) das campanhas — só os "vivos" (ACTIVE ou em
 * revisão). Usado para mostrar no dashboard anúncios recém-subidos que ainda
 * não têm entrega (logo, não aparecem em /insights). Assim todo ad que sobe
 * atualiza no painel automaticamente, mesmo antes de gastar.
 */
export async function fetchAdsList(campaignIds?: string[]): Promise<AdListItem[]> {
  const { accountId } = initApi()
  const account = new AdAccount(accountId)
  const params: Record<string, unknown> = {
    limit: 500,
    effective_status: ['ACTIVE', 'PENDING_REVIEW', 'IN_PROCESS'],
    filtering: campaignIds?.length
      ? [{ field: 'campaign.id', operator: 'IN', value: campaignIds }]
      : [],
  }
  const ads = await account.getAds(['id', 'name', 'effective_status', 'campaign_id'], params)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ads.map((a: any) => ({
    ad_id: a._data.id,
    ad_name: a._data.name,
    effective_status: a._data.effective_status,
    campaign_id: a._data.campaign_id,
  }))
}

// ─── Tráfego para Seguidores (ToF / criativos de distribuição) ──────────────
export interface FollowerAdData {
  ad_id: string
  ad_name: string
  campaign_name?: string
  impressions: string
  reach?: string
  frequency?: string
  spend: string
  ctr: string
  cpc?: string
  inline_link_clicks?: string            // = visitas ao perfil (destino IG profile)
  actions?: { action_type: string; value: string }[]
  video_play_actions?: { action_type: string; value: string }[]
}

export async function fetchFollowerAdInsights(
  campaignIds: string[],
  opts: { datePreset?: string; since?: string; until?: string } = {},
): Promise<FollowerAdData[]> {
  const { accountId } = initApi()
  const account = new AdAccount(accountId)
  const fields = [
    'ad_id', 'ad_name', 'campaign_name',
    'impressions', 'reach', 'frequency', 'spend', 'ctr', 'cpc',
    'inline_link_clicks', 'actions', 'video_play_actions',
  ]
  const params: Record<string, unknown> = {
    level: 'ad',
    sort: ['spend_descending'],
    limit: 50,
    filtering: campaignIds.length
      ? [{ field: 'campaign.id', operator: 'IN', value: campaignIds }]
      : [],
  }
  if (opts.since && opts.until) params.time_range = { since: opts.since, until: opts.until }
  else params.date_preset = opts.datePreset ?? 'last_7d'
  const insights = await account.getInsights(fields, params)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return insights.map((i: any) => i._data)
}

/** Returns a map of ad_id → thumbnail_url fetched via creative field expansion */
export async function fetchAdThumbnails(
  campaignIds?: string[]
): Promise<Record<string, string>> {
  const { accountId } = initApi()
  const account = new AdAccount(accountId)
  const params: Record<string, unknown> = {
    limit: 100,
    filtering: campaignIds?.length
      ? [{ field: 'campaign.id', operator: 'IN', value: campaignIds }]
      : [],
  }
  const ads = await account.getAds(
    ['id', 'name', 'creative{thumbnail_url}'],
    params
  )
  const map: Record<string, string> = {}
  for (const ad of ads) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (ad as any)._data
    if (d?.creative?.thumbnail_url) map[d.id] = d.creative.thumbnail_url
  }
  return map
}

/**
 * Returns a map of ad_id → landing page link fetched via creative.object_story_spec.
 * Tries link_data.link first, then video_data.call_to_action.value.link.
 */
export async function fetchAdLandingPages(
  campaignIds?: string[]
): Promise<Record<string, string>> {
  const { accountId } = initApi()
  const account = new AdAccount(accountId)
  const params: Record<string, unknown> = {
    limit: 100,
    filtering: campaignIds?.length
      ? [{ field: 'campaign.id', operator: 'IN', value: campaignIds }]
      : [],
  }
  const ads = await account.getAds(
    [
      'id',
      'name',
      'creative{object_story_spec{link_data{link,call_to_action},video_data{call_to_action}}}',
    ],
    params
  )
  const map: Record<string, string> = {}
  for (const ad of ads) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (ad as any)._data
    const oss = d?.creative?.object_story_spec
    let link: string | undefined
    if (oss?.link_data) {
      link = oss.link_data.link ?? oss.link_data.call_to_action?.value?.link
    }
    if (!link && oss?.video_data) {
      link = oss.video_data.call_to_action?.value?.link
    }
    if (link) map[d.id] = link
  }
  return map
}
