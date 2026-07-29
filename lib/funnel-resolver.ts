// lib/funnel-resolver.ts
import {
  sumActions, maxRoas, linkClicks,
  PURCHASE_PATTERNS, LEAD_PATTERNS, CHECKOUT_PATTERNS, LP_VIEW_PATTERNS,
} from './action-matchers'

export type FunnelType = 'purchase' | 'lead'

const PURCHASE_OBJECTIVES = [
  'OUTCOME_SALES', 'CONVERSIONS', 'PRODUCT_CATALOG_SALES',
  'STORE_VISITS', 'VALUE', 'LINK_CLICKS'
]
const LEAD_OBJECTIVES = [
  'LEAD_GENERATION', 'OUTCOME_LEADS', 'MESSAGES'
]

export function resolveFunnelType(objective: string): FunnelType {
  if (PURCHASE_OBJECTIVES.includes(objective)) return 'purchase'
  if (LEAD_OBJECTIVES.includes(objective)) return 'lead'
  return 'purchase' // safe default
}

// ─── Helpers ────────────────────────────────────────────────────────────────
type MetaAction = { action_type: string; value: string }

export interface FunnelStage {
  key: string
  label: string
  value: number
  cost?: number
  costLabel?: string
  previousValue?: number
  dropPct?: number
  deltaVsPrevious?: number
  /** Label shown in the connector between previous stage and this one (replaces "X% drop" text) */
  connectorLabel?: string
  /** Revenue value for the purchases stage (spend × ROAS) */
  revenue?: number
}

// prevData is reserved for V2 period-over-period enrichment; prefix with _ to
// suppress unused-variable warnings while keeping the public signature stable.
export function buildPurchaseFunnel(
  data: Record<string, unknown>,
  _prevData?: Record<string, unknown>
): FunnelStage[] {
  const spend      = parseFloat((data.spend as string) || '0')
  const impressions = parseInt((data.impressions as string) || '0')
  const clicks      = linkClicks(data as { outbound_clicks?: MetaAction[]; clicks?: string })
  const ctr         = impressions > 0 ? (clicks / impressions) * 100 : 0

  const actions = data.actions as MetaAction[] | undefined
  const lpViews   = sumActions(actions, LP_VIEW_PATTERNS)
  const checkout  = sumActions(actions, CHECKOUT_PATTERNS)
  const purchases = sumActions(actions, PURCHASE_PATTERNS)

  const roas    = maxRoas(data.purchase_roas as MetaAction[] | undefined)
  const revenue = roas > 0 ? spend * roas : 0

  // Conversion rates for connector labels
  const lpConvRate       = clicks     > 0 ? Math.round(lpViews   / clicks     * 100) : null
  const checkoutConvRate = lpViews    > 0 ? Math.round(checkout  / lpViews    * 100) : null
  const purchaseConvRate = checkout   > 0 ? Math.round(purchases / checkout   * 100) : null

  const stages: FunnelStage[] = [
    {
      key: 'impressions', label: 'Impressões', value: impressions,
      cost: impressions > 0 ? spend / impressions * 1000 : undefined,
      costLabel: 'CPM',
    },
    {
      key: 'clicks', label: 'Cliques', value: clicks,
      cost: clicks > 0 ? spend / clicks : undefined,
      costLabel: 'CPC',
      connectorLabel: ctr > 0
        ? `CTR: ${ctr.toFixed(2).replace('.', ',')}%`
        : undefined,
    },
    {
      key: 'lp_views', label: 'Visualizações LP', value: lpViews,
      connectorLabel: lpConvRate !== null
        ? `${lpConvRate}% dos cliques chegaram na LP`
        : undefined,
    },
    {
      key: 'checkout', label: 'Iniciou Checkout', value: checkout,
      cost: checkout > 0 ? spend / checkout : undefined,
      costLabel: 'CP Checkout',
      connectorLabel: checkoutConvRate !== null
        ? `${checkoutConvRate}% da LP foram ao checkout`
        : undefined,
    },
    {
      key: 'purchases', label: 'Compras', value: purchases,
      cost: purchases > 0 ? spend / purchases : undefined,
      costLabel: 'CPA',
      connectorLabel: purchaseConvRate !== null
        ? `${purchaseConvRate}% do checkout converteram`
        : undefined,
      revenue: revenue > 0 ? revenue : undefined,
    },
  ]

  return _enrichStages(stages)
}

// ─── Lead funnel ─────────────────────────────────────────────────────────────
// Impressões → Cliques → Visualizações LP → Leads
export function buildLeadFunnel(
  data: Record<string, unknown>,
  _prevData?: Record<string, unknown>
): FunnelStage[] {
  const spend      = parseFloat((data.spend as string) || '0')
  const impressions = parseInt((data.impressions as string) || '0')
  const clicks      = linkClicks(data as { outbound_clicks?: MetaAction[]; clicks?: string })
  const ctr         = impressions > 0 ? (clicks / impressions) * 100 : 0

  const actions = data.actions as MetaAction[] | undefined
  const lpViews = sumActions(actions, LP_VIEW_PATTERNS)
  const leads   = sumActions(actions, LEAD_PATTERNS)

  const lpConvRate   = clicks  > 0 ? Math.round(lpViews / clicks  * 100) : null
  const leadConvRate = lpViews > 0 ? Math.round(leads   / lpViews * 100) : null

  const stages: FunnelStage[] = [
    {
      key: 'impressions', label: 'Impressões', value: impressions,
      cost: impressions > 0 ? spend / impressions * 1000 : undefined,
      costLabel: 'CPM',
    },
    {
      key: 'clicks', label: 'Cliques', value: clicks,
      cost: clicks > 0 ? spend / clicks : undefined,
      costLabel: 'CPC',
      connectorLabel: ctr > 0
        ? `CTR: ${ctr.toFixed(2).replace('.', ',')}%`
        : undefined,
    },
    {
      key: 'lp_views', label: 'Visualizações LP', value: lpViews,
      connectorLabel: lpConvRate !== null
        ? `${lpConvRate}% dos cliques chegaram na LP`
        : undefined,
    },
    {
      key: 'leads', label: 'Leads', value: leads,
      cost: leads > 0 ? spend / leads : undefined,
      costLabel: 'CPL',
      connectorLabel: leadConvRate !== null
        ? `${leadConvRate}% da LP converteram`
        : undefined,
    },
  ]

  return _enrichStages(stages)
}

// ─── Health indicators ──────────────────────────────────────────────────────
export type HealthStatus = 'green' | 'yellow' | 'red'

export interface HealthMetric {
  key: string
  label: string
  value: number
  formatted: string
  status: HealthStatus
  benchmarkLabel: string
  /** Which stage transition this metric belongs to: [fromKey, toKey] */
  transition: [string, string]
}

export function buildHealthMetrics(data: Record<string, unknown>): HealthMetric[] {
  const spend       = parseFloat((data.spend as string) || '0')
  const impressions = parseInt((data.impressions as string) || '0')
  const clicks      = linkClicks(data as { outbound_clicks?: MetaAction[]; clicks?: string })
  const ctr         = impressions > 0 ? (clicks / impressions) * 100 : 0
  const cpm         = impressions > 0 ? (spend / impressions) * 1000 : 0

  const actions = data.actions as MetaAction[] | undefined
  const lpViews   = sumActions(actions, LP_VIEW_PATTERNS)
  const checkout  = sumActions(actions, CHECKOUT_PATTERNS)
  const purchases = sumActions(actions, PURCHASE_PATTERNS)

  const connectRate     = clicks  > 0 ? (lpViews   / clicks)  * 100 : 0
  const pageConversion  = lpViews > 0 ? (checkout  / lpViews) * 100 : 0
  const checkoutConversion = checkout > 0 ? (purchases / checkout) * 100 : 0

  const metrics: HealthMetric[] = []

  // CTR
  if (impressions > 0) {
    metrics.push({
      key: 'ctr', label: 'CTR',
      value: ctr, formatted: `${ctr.toFixed(2)}%`,
      status: ctr >= 2 ? 'green' : ctr >= 1 ? 'yellow' : 'red',
      benchmarkLabel: '🟢 ≥2%  🟡 1–2%  🔴 <1%',
      transition: ['impressions', 'clicks'],
    })
  }

  // CPM (higher = better quality audience for conversion campaigns)
  if (impressions > 0) {
    metrics.push({
      key: 'cpm', label: 'CPM',
      value: cpm, formatted: `R$ ${cpm.toFixed(2).replace('.', ',')}`,
      status: cpm >= 80 ? 'green' : cpm >= 16 ? 'yellow' : 'red',
      benchmarkLabel: '🟢 ≥R$80  🟡 R$16–80  🔴 <R$16',
      transition: ['impressions', 'clicks'],
    })
  }

  // Connect Rate (LP load rate)
  if (clicks > 0) {
    metrics.push({
      key: 'connect', label: 'Connect Rate',
      value: connectRate, formatted: `${connectRate.toFixed(1)}%`,
      status: connectRate >= 85 ? 'green' : connectRate >= 75 ? 'yellow' : 'red',
      benchmarkLabel: '🟢 ≥85%  🟡 75–85%  🔴 <75%',
      transition: ['clicks', 'lp_views'],
    })
  }

  // Page Conversion (LP → Checkout)
  if (lpViews > 0) {
    metrics.push({
      key: 'page_conv', label: 'Conv. Página',
      value: pageConversion, formatted: `${pageConversion.toFixed(1)}%`,
      status: pageConversion >= 7 ? 'green' : pageConversion >= 5 ? 'yellow' : 'red',
      benchmarkLabel: '🟢 ≥7%  🟡 5–7%  🔴 <5%',
      transition: ['lp_views', 'checkout'],
    })
  }

  // Checkout Conversion (Checkout → Purchase)
  if (checkout > 0) {
    metrics.push({
      key: 'checkout_conv', label: 'Conv. Checkout',
      value: checkoutConversion, formatted: `${checkoutConversion.toFixed(1)}%`,
      status: checkoutConversion >= 38 ? 'green' : checkoutConversion >= 20 ? 'yellow' : 'red',
      transition: ['checkout', 'purchases'],
      benchmarkLabel: '🟢 ≥38%  🟡 20–38%  🔴 <20%',
    })
  }

  return metrics
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function _enrichStages(stages: FunnelStage[]): FunnelStage[] {
  return stages.map((stage, i) => {
    const prev = i > 0 ? stages[i - 1].value : null
    const dropPct = prev && prev > 0
      ? Math.round((1 - stage.value / prev) * 100)
      : undefined
    return { ...stage, dropPct }
  })
}
