// lib/campaign-classifier.ts
export type CampaignTag = 'IC' | 'IC2' | 'IC3' | 'RP' | 'JDE' | 'MFH' | 'OTHER'

export interface CampaignTagConfig {
  tag: CampaignTag
  label: string
  color: string
  keywords: string[]
}

// Ordem importa: o classificador usa first-match-wins.
// ICM3 (junho) → ICM2 (maio) → ICM1 (abril). As edições mais novas e mais
// específicas vêm primeiro para não serem capturadas pelo 'claude' genérico do IC.
export const CAMPAIGN_TAGS: CampaignTagConfig[] = [
  {
    // ICM3 — Junho. Vem antes de IC2/IC (first match wins).
    tag: 'IC3',
    label: 'ICM3 - Junho',
    color: '#4CAF82',
    keywords: ['ic3', 'icm3', 'ic 3', 'imersao claude 3', 'imersão claude 3', '[v2]', ' v2 ', 'junho']
  },
  {
    // IC2 must come before IC — first match wins in classifyCampaign()
    tag: 'IC2',
    label: 'ICM2 - Maio',
    color: '#4A9EE8',
    keywords: ['ic2', 'ic2_', '_ic2', ' ic2 ', 'imersao claude 2', 'imersão claude 2']
  },
  {
    tag: 'IC',
    label: 'ICM1 - Abril',
    color: '#D97757',
    keywords: ['imersao', 'imersão', 'claude', ' ic ', 'ic_', '_ic']
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
