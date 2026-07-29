// lib/lp-mapping.ts
// Mapping de slugs de LPs do funil → versão + headline + status.
// Preencha com as SUAS páginas e anúncios — os valores abaixo são apenas exemplos.

export type LPVersion = 'ICM3' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | '?'

export interface LPInfo {
  version: LPVersion
  headline: string
  subheadline: string
  /** "live" = rodando em campanha ativa | "legacy" = só pra histórico/A-B passado */
  status: 'live' | 'legacy'
}

export const LP_MAPPING: Record<string, LPInfo> = {
  // Mapeie AQUI os slugs das SUAS landing pages.
  // A chave é o slug que aparece na URL (ex.: your-domain.com/<slug>/).
  'pagina-a': {
    version: 'V1',
    headline: 'Headline principal da sua página A',
    subheadline: 'Subheadline / promessa secundária da página A.',
    status: 'live',
  },
  'pagina-b': {
    version: 'V2',
    headline: 'Headline principal da sua página B',
    subheadline: 'Variação usada em teste A/B.',
    status: 'legacy',
  },
}

/**
 * Mapping ad_name → resumo do gancho/ângulo do criativo.
 * Padrão de nome: "ADV - X Nome" (vídeo) ou "ADE - Nome" (estático).
 * Sempre que criar novo ad, adicionar aqui.
 */
export const AD_HOOK: Record<string, string> = {
  // Mapeie o NOME do anúncio (como está no Meta) → resumo do gancho dele.
  // Serve pra comparar a promessa do anúncio com a headline da LP.
  'AD - Exemplo Frio': 'Gancho do criativo de topo de funil',
  'AD - Exemplo Remarketing': 'Gancho do criativo de remarketing',
}

/** Extrai slug da URL e retorna info da LP (ou ? se não mapeada). */
export function detectLP(link: string | null | undefined): {
  slug: string
  version: LPVersion
  headline: string
  subheadline: string
  status: 'live' | 'legacy' | 'unknown'
} {
  if (!link) {
    return { slug: '', version: '?', headline: '—', subheadline: '—', status: 'unknown' }
  }
  // Pega slug entre your-domain.com/ e a próxima /
  const m = link.match(/your-domain\.com\/([^/?#]+)/i)
  const slug = m?.[1] ?? ''
  const info = LP_MAPPING[slug]
  if (!info) {
    return {
      slug: slug || link,
      version: '?',
      headline: '— (LP não mapeada — adicionar a lib/lp-mapping.ts)',
      subheadline: '—',
      status: 'unknown',
    }
  }
  return { slug, ...info }
}

/** Retorna o gancho do ad pelo nome. Fallback: primeira parte do nome. */
export function detectAdHook(ad_name: string): string {
  const direct = AD_HOOK[ad_name]
  if (direct) return direct
  // Fallback: tira sufixos comuns ("Principal", "RMKT", etc) e retorna primeiro fragmento
  const cleaned = ad_name.replace(/\s+(Principal|RMKT|Test[ea]|Cópia.*)$/i, '').trim()
  return cleaned || '—'
}

// ─────────────────────────────────────────────────────────────────────────────
// Coerência ANÚNCIO ↔ PÁGINA (semáforo)
//   🟢 green  = coerente (o gancho bate direto com a promessa da página)
//   🟡 yellow = "serve" (atrai/funciona, mas não é o eixo central da página)
//   🔴 red    = sem correlação (LP errada/não mapeada, ou gancho desconexo)
// ─────────────────────────────────────────────────────────────────────────────
export type Coherence = 'green' | 'yellow' | 'red'

// Promessa da LP junho (ICM3): "ensina, constrói e implementa o ecossistema de
// escala com Claude em 48h — não é aula, é fazedoria".
export const AD_COHERENCE: Record<string, { level: Coherence; reason: string }> = {
  // Congruência anúncio ↔ landing page.
  // green = promessa do ad casa com a LP | yellow = gap parcial | red = promessa diferente
  'AD - Exemplo Frio': { level: 'green', reason: 'promessa do anúncio casa com a headline da LP' },
  'AD - Exemplo Remarketing': { level: 'yellow', reason: 'copy genérica ≠ eixo principal da LP — gap de expectativa' },
}

// Ganchos de comparação ChatGPT×Claude — coerência depende da HEADLINE de destino.
const COMPARISON_ADS = new Set(['ADE - Claude vs GPT', 'ADE - ChatGPT vs Claude', 'ADE - GPT Teto', 'CXP - ChatGPT vs Claude'])

/**
 * Avalia a coerência ad↔HEADLINE da página de destino (não a página toda — a headline
 * é o que decide se a pessoa desce ou não). LP errada/não mapeada = vermelho.
 */
export function detectCoherence(
  ad_name: string,
  lp: { status: 'live' | 'legacy' | 'unknown'; slug: string },
): { level: Coherence; reason: string } {
  if (lp.status === 'unknown') {
    return { level: 'red', reason: 'LP de destino não mapeada — sem correlação validável (checar a URL do anúncio)' }
  }
  // Comparação só conecta numa headline de comparação (variante imersao-claude-gpt)
  if (COMPARISON_ADS.has(ad_name)) {
    if (lp.slug === 'imersao-claude-gpt') {
      return { level: 'green', reason: 'gancho de comparação ↔ headline "ChatGPT vs Claude" da variante — conecta na hora' }
    }
    return { level: 'yellow', reason: 'gancho de comparação numa headline de construção — apontar p/ imersao-claude-gpt vira 🟢' }
  }
  const direct = AD_COHERENCE[ad_name]
  if (direct) return direct
  if (lp.status === 'legacy') {
    return { level: 'yellow', reason: 'ad sem rating; LP é de edição anterior (legacy)' }
  }
  return { level: 'yellow', reason: 'ad sem rating de coerência — adicionar a AD_COHERENCE' }
}
