// lib/demo-data.ts
// ─────────────────────────────────────────────────────────────────────────────
// Dados fictícios para o modo demo (DEMO_MODE=true).
// Nenhuma informação real da empresa é exposta.
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_MODE = process.env.DEMO_MODE === 'true'

// ─── Identidade fictícia ──────────────────────────────────────────────────────
export const DEMO_BRAND   = 'NEXUS'
export const DEMO_PRODUCT = 'Método Nexus'
export const DEMO_COMPANY = 'Nexus Digital'
export const DEMO_URL     = 'http://localhost:3000'
export const DEMO_PASSWORD = 'nexus2025'
export const DEMO_TICKET  = 997

// ─── /api/campaigns ──────────────────────────────────────────────────────────
export const DEMO_CAMPAIGNS = {
  campaigns: [
    { id: '11111111', name: 'NEXUS [Vendas][F] - VSL Principal',       status: 'ACTIVE',  effective_status: 'ACTIVE',  objective: 'OUTCOME_SALES', tag: { tag: 'nexus', label: 'Nexus' } },
    { id: '22222222', name: 'NEXUS [Vendas][Q] - Retargeting Quente',  status: 'ACTIVE',  effective_status: 'ACTIVE',  objective: 'OUTCOME_SALES', tag: { tag: 'nexus', label: 'Nexus' } },
    { id: '33333333', name: 'NEXUS [Vendas][F] - Lookalike 1-3%',      status: 'PAUSED',  effective_status: 'PAUSED',  objective: 'OUTCOME_SALES', tag: { tag: 'nexus', label: 'Nexus' } },
  ],
}

// ─── /api/control (aba Controle) ─────────────────────────────────────────────
// Orçamentos em CENTAVOS, igual à Meta. A 1ª campanha usa CBO (orçamento na
// campanha); as outras duas controlam o dinheiro no conjunto — exatamente os
// dois casos que a tela precisa saber diferenciar.
export const DEMO_CONTROL = {
  campaigns: [
    {
      id: '11111111', name: 'NEXUS [Vendas][F] - VSL Principal',
      objective: 'OUTCOME_SALES', status: 'ACTIVE', effective_status: 'ACTIVE',
      daily_budget: '15000', lifetime_budget: null,
      tag: { tag: 'nexus', label: 'Nexus', color: '#4CAF82' },
      spend: 87.4, metaLink: '#',
    },
    {
      id: '22222222', name: 'NEXUS [Vendas][Q] - Retargeting Quente',
      objective: 'OUTCOME_SALES', status: 'ACTIVE', effective_status: 'ACTIVE',
      daily_budget: null, lifetime_budget: null,
      tag: { tag: 'nexus', label: 'Nexus', color: '#4A9EE8' },
      spend: 41.9, metaLink: '#',
    },
    {
      id: '33333333', name: 'NEXUS [Vendas][F] - Lookalike 1-3%',
      objective: 'OUTCOME_SALES', status: 'PAUSED', effective_status: 'PAUSED',
      daily_budget: null, lifetime_budget: null,
      tag: { tag: 'nexus', label: 'Nexus', color: '#C9A45A' },
      spend: 0, metaLink: '#',
    },
  ],
}

// ─── /api/campaigns/[id]/adsets ──────────────────────────────────────────────
export const DEMO_ADSETS: Record<string, unknown[]> = {
  '11111111': [
    { id: '1101', name: 'Aberto 25-45', status: 'ACTIVE', effective_status: 'ACTIVE', daily_budget: null, lifetime_budget: null, spend: 52.1 },
    { id: '1102', name: 'Interesses - Marketing', status: 'ACTIVE', effective_status: 'ACTIVE', daily_budget: null, lifetime_budget: null, spend: 35.3 },
  ],
  '22222222': [
    { id: '2201', name: 'RMKT 15D - Visitantes LP', status: 'ACTIVE', effective_status: 'ACTIVE', daily_budget: '4000', lifetime_budget: null, spend: 28.6 },
    { id: '2202', name: 'RMKT 7D - Checkout aberto', status: 'ACTIVE', effective_status: 'ACTIVE', daily_budget: '2500', lifetime_budget: null, spend: 13.3 },
  ],
  '33333333': [
    { id: '3301', name: 'LAL 1% compradores', status: 'PAUSED', effective_status: 'PAUSED', daily_budget: '3000', lifetime_budget: null, spend: 0 },
  ],
}

// ─── /api/insights ────────────────────────────────────────────────────────────
export const DEMO_INSIGHTS = {
  kpis: {
    totalSpend: 3420.80,
    totalImpressions: 84230,
    totalClicks: 4210,
    totalReach: 61800,
    roas: 13.99,
    totalPurchases: 48,
    totalLeads: 0,
    ctr: 2.51,
    cpm: 40.61,
    cpl: 0,
    cpa: 71.27,
    revenue: 47856,
  },
  prevKpis: {
    totalSpend: 2980.50,
    totalImpressions: 72100,
    totalClicks: 3540,
    totalReach: 52300,
    roas: 11.40,
    totalPurchases: 34,
    totalLeads: 0,
    ctr: 2.31,
    cpm: 41.34,
    cpl: 0,
    cpa: 87.66,
    revenue: 33966,
  },
  trend: [
    { date: '2026-04-03', spend: 420.10, roas: 12.1, leads: 0, purchases: 5,  revenue: 5085,  cpl: 0, cpa: 84.02 },
    { date: '2026-04-04', spend: 488.50, roas: 14.2, leads: 0, purchases: 7,  revenue: 6936,  cpl: 0, cpa: 69.79 },
    { date: '2026-04-05', spend: 510.20, roas: 15.1, leads: 0, purchases: 8,  revenue: 7704,  cpl: 0, cpa: 63.78 },
    { date: '2026-04-06', spend: 497.30, roas: 13.8, leads: 0, purchases: 7,  revenue: 6860,  cpl: 0, cpa: 71.04 },
    { date: '2026-04-07', spend: 530.60, roas: 14.5, leads: 0, purchases: 8,  revenue: 7693,  cpl: 0, cpa: 66.33 },
    { date: '2026-04-08', spend: 478.90, roas: 12.9, leads: 0, purchases: 7,  revenue: 6177,  cpl: 0, cpa: 68.41 },
    { date: '2026-04-09', spend: 495.20, roas: 13.1, leads: 0, purchases: 6,  revenue: 6487,  cpl: 0, cpa: 82.53 },
  ],
  campaignCount: 3,
}

// ─── /api/funnel ─────────────────────────────────────────────────────────────
export const DEMO_FUNNEL = {
  type: 'purchase',
  spend: '3420.80',
  stages: [
    { key: 'impressions', label: 'Impressões',      value: 84230, cost: 40.61,  costLabel: 'CPM', dropPct: undefined },
    { key: 'clicks',      label: 'Cliques no Link', value: 2107,  cost: 1.62,   costLabel: 'CPC', dropPct: 98, connectorLabel: 'CTR: 2,50%' },
    { key: 'lp_views',   label: 'Visualizações LP', value: 1840,  dropPct: 13,  connectorLabel: '87% dos cliques chegaram na LP' },
    { key: 'checkout',   label: 'Iniciou Checkout', value: 312,   cost: 10.97,  costLabel: 'CP Checkout', dropPct: 83, connectorLabel: '17% da LP foram ao checkout' },
    { key: 'purchases',  label: 'Vendas',           value: 48,    cost: 71.27,  costLabel: 'CPA', dropPct: 85, connectorLabel: '15% do checkout converteram', revenue: 47856 },
  ],
  health: [
    { key: 'ctr',           label: 'CTR',           value: 2.50, formatted: '2.50%',   status: 'green',  benchmarkLabel: '🟢 ≥2%  🟡 1–2%  🔴 <1%',     transition: ['impressions', 'clicks'] },
    { key: 'cpm',           label: 'CPM',           value: 40.61, formatted: 'R$ 40,61', status: 'yellow', benchmarkLabel: '🟢 ≥R$80  🟡 R$16–80  🔴 <R$16', transition: ['impressions', 'clicks'] },
    { key: 'connect',       label: 'Connect Rate',  value: 87.3, formatted: '87.3%',   status: 'green',  benchmarkLabel: '🟢 ≥85%  🟡 75–85%  🔴 <75%',  transition: ['clicks', 'lp_views'] },
    { key: 'page_conv',     label: 'Conv. Página',  value: 16.9, formatted: '16.9%',   status: 'green',  benchmarkLabel: '🟢 ≥7%  🟡 5–7%  🔴 <5%',      transition: ['lp_views', 'checkout'] },
    { key: 'checkout_conv', label: 'Conv. Checkout',value: 15.4, formatted: '15.4%',   status: 'yellow', benchmarkLabel: '🟢 ≥38%  🟡 20–38%  🔴 <20%',  transition: ['checkout', 'purchases'] },
  ],
}

// ─── /api/ads ─────────────────────────────────────────────────────────────────
export const DEMO_ADS = {
  ads: [
    {
      ad_id: 'ad_001', ad_name: 'VSL Principal - Depoimento João',
      adset_name: 'Lookalike 1-3% - Interesses', campaign_name: 'NEXUS [Vendas][F] - VSL Principal',
      impressions: '31420', clicks: '820', spend: '1284.30', ctr: '2.61', cpc: '1.57',
      thumbnail: null, metaLink: '#',
      actions: [
        { action_type: 'landing_page_view',       value: '714' },
        { action_type: 'omni_initiated_checkout', value: '128' },
        { action_type: 'purchase',                value: '19'  },
      ],
    },
    {
      ad_id: 'ad_002', ad_name: 'VSL - Hook "E se em 90 dias..."',
      adset_name: 'Broad 30-55', campaign_name: 'NEXUS [Vendas][F] - VSL Principal',
      impressions: '28640', clicks: '698', spend: '1072.60', ctr: '2.44', cpc: '1.54',
      thumbnail: null, metaLink: '#',
      actions: [
        { action_type: 'landing_page_view',       value: '601' },
        { action_type: 'omni_initiated_checkout', value: '107' },
        { action_type: 'purchase',                value: '16'  },
      ],
    },
    {
      ad_id: 'ad_003', ad_name: 'Retargeting - Quem viu LP 3+ dias',
      adset_name: 'Retargeting LP 3-14 dias', campaign_name: 'NEXUS [Vendas][Q] - Retargeting Quente',
      impressions: '24170', clicks: '589', spend: '1063.90', ctr: '2.44', cpc: '1.81',
      thumbnail: null, metaLink: '#',
      actions: [
        { action_type: 'landing_page_view',       value: '525' },
        { action_type: 'omni_initiated_checkout', value: '77'  },
        { action_type: 'purchase',                value: '13'  },
      ],
    },
  ],
}

// ─── /api/hotmart ─────────────────────────────────────────────────────────────
export const DEMO_HOTMART = {
  totalSales: 48,
  totalRevenue: 47856,
  totalFees: 4785.60,
  netRevenue: 43070.40,
  currency: 'BRL',
  bySource: {
    metaAds: { sales: 31, revenue: 30907 },
    organic: { sales: 11, revenue: 10967 },
    other:   { sales: 6,  revenue: 5982  },
  },
  daily: [
    { date: '2026-04-03', sales: 5,  revenue: 4985  },
    { date: '2026-04-04', sales: 7,  revenue: 6979  },
    { date: '2026-04-05', sales: 8,  revenue: 7976  },
    { date: '2026-04-06', sales: 7,  revenue: 6979  },
    { date: '2026-04-07', sales: 8,  revenue: 7976  },
    { date: '2026-04-08', sales: 7,  revenue: 6979  },
    { date: '2026-04-09', sales: 6,  revenue: 5982  },
  ],
  fetchedAt: new Date().toISOString(),
}

// ─── /api/instagram ───────────────────────────────────────────────────────────
export function demoBuildInstagram(days: number) {
  const today = new Date()
  const insightsDays = []
  const postsDays = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    insightsDays.push({ date: dateStr, reach: Math.floor(2800 + Math.random() * 1200), profileViews: Math.floor(180 + Math.random() * 80) })
    postsDays.push({ date: dateStr, count: i % 3 === 0 ? 1 : 0 })
  }
  return {
    profile: {
      username: 'nexus.digital',
      name: 'Nexus Digital',
      bio: 'Transformando resultados com método e consistência 🚀',
      followers: 12847,
      following: 614,
      mediaCount: 284,
      profilePicture: '',
    },
    insights: { reach: 28430, profileViews: 1840, daily: insightsDays },
    postsPerDay: postsDays,
    recentPosts: [
      { id: 'p1', mediaType: 'IMAGE', timestamp: new Date(today.getTime() - 1 * 86400000).toISOString(), permalink: '#', likeCount: 312, commentCount: 28, caption: 'O que diferencia quem alcança resultado de quem fica só planejando...' },
      { id: 'p2', mediaType: 'REEL',  timestamp: new Date(today.getTime() - 2 * 86400000).toISOString(), permalink: '#', likeCount: 841, commentCount: 64, caption: 'Minha rotina semanal de alta performance em 60 segundos ⚡' },
      { id: 'p3', mediaType: 'IMAGE', timestamp: new Date(today.getTime() - 4 * 86400000).toISOString(), permalink: '#', likeCount: 197, commentCount: 15, caption: '3 hábitos que mudaram minha relação com o tempo' },
    ],
  }
}

// ─── /api/email-campaigns ────────────────────────────────────────────────────
export const DEMO_EMAIL_CAMPAIGNS = {
  campaigns: [
    { id: 1, name: 'Abertura: Por que 97% nunca chegam lá',      subject: 'Por que 97% das pessoas nunca chegam lá', status: '6', sdate: '2026-04-08 10:00:00', sends: 4820, opens: 1880, clicks: 312, openRate: 39.0, clickRate: 6.5, unsub: 12 },
    { id: 2, name: 'Conteúdo: O erro que eu cometi por 2 anos',  subject: 'O erro que eu cometi por 2 anos (e como evitar)', status: '6', sdate: '2026-04-06 10:00:00', sends: 4820, opens: 2120, clicks: 389, openRate: 43.9, clickRate: 8.1, unsub: 8  },
    { id: 3, name: 'Oferta: Método Nexus abre hoje',             subject: '🚨 Método Nexus — vagas abertas por 48h',  status: '6', sdate: '2026-04-04 09:00:00', sends: 4820, opens: 2540, clicks: 812, openRate: 52.7, clickRate: 16.8, unsub: 24 },
    { id: 4, name: 'Urgência: Últimas horas',                    subject: 'Fecha em 3h — última chance',             status: '6', sdate: '2026-04-04 20:00:00', sends: 4820, opens: 2140, clicks: 640, openRate: 44.4, clickRate: 13.3, unsub: 19 },
    { id: 5, name: 'Pós-compra: Boas-vindas Nexus',              subject: 'Bem-vindo ao Método Nexus! Próximo passo:', status: '6', sdate: '2026-04-05 11:00:00', sends: 183,  opens: 162,  clicks: 140, openRate: 88.5, clickRate: 76.5, unsub: 0  },
  ],
}

// ─── /api/youtube ─────────────────────────────────────────────────────────────
export const DEMO_YOUTUBE = {
  channel: {
    id: 'UC_demo_nexus',
    title: 'Nexus Digital',
    description: 'Canal oficial Nexus Digital — método, resultados e estratégia.',
    thumbnail: '',
    subscriberCount: 24380,
    videoCount: 87,
    viewCount: 1284000,
  },
  recentVideos: [
    { id: 'v1', title: 'Como eu fiz R$47k em uma semana com um produto digital', publishedAt: '2026-04-08T14:00:00Z', thumbnail: '', duration: 'PT18M42S', isShort: false, views: 8420,  likes: 312, comments: 48, periodViews: 3100, avgWatchTime: 680,  avgWatchPct: 60.6, subscribersGained: 87 },
    { id: 'v2', title: 'O funil que converte 15% de checkout para venda',         publishedAt: '2026-04-06T14:00:00Z', thumbnail: '', duration: 'PT22M15S', isShort: false, views: 5210,  likes: 198, comments: 31, periodViews: 2640, avgWatchTime: 820,  avgWatchPct: 61.4, subscribersGained: 54 },
    { id: 'v3', title: 'Rotina de R$1k/dia #shorts',                              publishedAt: '2026-04-07T10:00:00Z', thumbnail: '', duration: 'PT58S',    isShort: true,  views: 14820, likes: 720, comments: 93, periodViews: 9800, avgWatchTime: 48,   avgWatchPct: 82.8, subscribersGained: 142 },
    { id: 'v4', title: 'O erro que destrói seus anúncios no Meta Ads',            publishedAt: '2026-04-03T14:00:00Z', thumbnail: '', duration: 'PT31M08S', isShort: false, views: 3840,  likes: 147, comments: 22, periodViews: 980,  avgWatchTime: 1120, avgWatchPct: 59.8, subscribersGained: 28 },
    { id: 'v5', title: 'CTR 2,5% na prática #shorts',                             publishedAt: '2026-04-05T10:00:00Z', thumbnail: '', duration: 'PT1M12S',  isShort: true,  views: 9240,  likes: 480, comments: 57, periodViews: 5200, avgWatchTime: 62,   avgWatchPct: 85.4, subscribersGained: 96 },
  ],
  analytics: {
    views: 28430,
    estimatedMinutesWatched: 74200,
    averageViewDuration: 520,
    subscribersGained: 407,
    subscribersLost: 48,
    daily: [
      { date: '2026-04-03', views: 3420, estimatedMinutesWatched: 9800,  averageViewDuration: 480, subscribersGained: 42 },
      { date: '2026-04-04', views: 4810, estimatedMinutesWatched: 12400, averageViewDuration: 510, subscribersGained: 68 },
      { date: '2026-04-05', views: 5240, estimatedMinutesWatched: 13800, averageViewDuration: 528, subscribersGained: 74 },
      { date: '2026-04-06', views: 4120, estimatedMinutesWatched: 10900, averageViewDuration: 502, subscribersGained: 58 },
      { date: '2026-04-07', views: 3980, estimatedMinutesWatched: 10200, averageViewDuration: 514, subscribersGained: 55 },
      { date: '2026-04-08', views: 4280, estimatedMinutesWatched: 11400, averageViewDuration: 533, subscribersGained: 62 },
      { date: '2026-04-09', views: 2580, estimatedMinutesWatched: 5700,  averageViewDuration: 440, subscribersGained: 48 },
    ],
  },
}

// ─── /api/clarity ─────────────────────────────────────────────────────────────
export const DEMO_CLARITY = {
  pages: [
    {
      url: 'http://localhost:3000/metodo-nexus',
      label: 'LP Principal — Método Nexus',
      sessions: 1840,
      avgScrollDepth: 72,
      avgTimeOnPage: 248,
      bounceRate: 34.2,
      clickmapUrl: null,
      heatmapUrl: null,
    },
    {
      url: 'http://localhost:3000/checkout',
      label: 'Checkout',
      sessions: 312,
      avgScrollDepth: 91,
      avgTimeOnPage: 184,
      bounceRate: 18.4,
      clickmapUrl: null,
      heatmapUrl: null,
    },
  ],
}
