// lib/campaign-classifier.ts
export type CampaignTag = 'IC' | 'IC2' | 'IC3' | 'RP' | 'JDE' | 'MFH' | 'OTHER'

export interface CampaignTagConfig {
  tag: CampaignTag
  label: string
  color: string
  keywords: string[]
}

// Ordem importa: o classificador usa first-match-wins.
// Edições mais novas primeiro (first match wins). As mais novas e mais
// específicas vêm primeiro para não serem capturadas pelo 'claude' genérico do IC.
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
    label: 'Relatório Proibido',
    color: '#C9A45A',
    keywords: ['relatorio', 'relatório', 'proibido', ' rp ', 'rp_', '_rp']
  },
  {
    tag: 'JDE',
    label: 'Jogo da Escala',
    color: '#4CAF82',
    keywords: ['escala', 'jogo', 'jde', ' jde']
  },
  {
    tag: 'MFH',
    label: 'Maior Faturamento',
    color: '#8B5CF6',
    keywords: ['faturamento', 'historia', 'história', 'mfh']
  }
]

export function classifyCampaign(name: string): CampaignTagConfig {
  const lower = name.toLowerCase()
  for (const config of CAMPAIGN_TAGS) {
    if (config.keywords.some(kw => lower.includes(kw))) return config
  }
  return { tag: 'OTHER', label: 'Outros', color: '#8A9BA0', keywords: [] }
}
