// lib/campaign-classifier.ts
export type CampaignTag = 'IC' | 'IC2' | 'IC3' | 'RP' | 'JDE' | 'MFH' | 'OTHER'

export interface CampaignTagConfig {
  tag: CampaignTag
  label: string
  color: string
  keywords: string[]
}

// Ordem importa: o classificador usa first-match-wins.
// ⚠️ CONFIGURE AQUI. O painel agrupa campanhas lendo o NOME delas no Meta e
// procurando estas `keywords`. Se os nomes das suas campanhas não casarem com
// nenhuma keyword, tudo cai em "Outros" e os filtros ficam vazios.
// Ordem importa: first-match-wins — o mais específico vem primeiro.
export const CAMPAIGN_TAGS: CampaignTagConfig[] = [
  {
    // Edição mais recente. Vem primeiro (first match wins).
    tag: 'IC3',
    label: 'Lançamento 3',
    color: '#4CAF82',
    keywords: ['lanc3', 'lancamento 3', 'lançamento 3']
  },
  {
    // IC2 must come before IC — first match wins in classifyCampaign()
    tag: 'IC2',
    label: 'Lançamento 2',
    color: '#4A9EE8',
    keywords: ['lanc2', 'lancamento 2', 'lançamento 2']
  },
  {
    tag: 'IC',
    label: 'Lançamento 1',
    color: '#D97757',
    keywords: ['lanc1', 'lancamento 1', 'lançamento 1']
  },
  {
    tag: 'RP',
    label: 'Perpétuo',
    color: '#C9A45A',
    keywords: ['perp', 'perpetuo', 'perpétuo']
  },
  {
    tag: 'JDE',
    label: 'Produto B',
    color: '#4CAF82',
    keywords: ['produtob', 'produto b']
  },
  {
    tag: 'MFH',
    label: 'Produto C',
    color: '#8B5CF6',
    keywords: ['produtoc', 'produto c']
  }
]

export function classifyCampaign(name: string): CampaignTagConfig {
  const lower = name.toLowerCase()
  for (const config of CAMPAIGN_TAGS) {
    if (config.keywords.some(kw => lower.includes(kw))) return config
  }
  return { tag: 'OTHER', label: 'Outros', color: '#8A9BA0', keywords: [] }
}
