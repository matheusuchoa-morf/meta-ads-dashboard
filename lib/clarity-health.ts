// lib/clarity-health.ts
// ─────────────────────────────────────────────────────────────────────────────
// Regras de negócio para classificar a saúde de uma landing page.
// Você conhece seus benchmarks — preencha os thresholds abaixo.
// ─────────────────────────────────────────────────────────────────────────────

export interface PageMetrics {
  /** % de usuários que scrollaram até o final da página (0–100) */
  scrollDepth?: number
  /** % de sessões com rage clicks — cliques frustrados (0–100) */
  ragePct?: number
  /** Score de engajamento geral do Clarity (0–100) */
  engagement?: number
}

export type PageStatus = 'ok' | 'atencao' | 'critico'

/**
 * Classifica a saúde da landing page baseado nas métricas do Clarity.
 * Retorna null quando não há métricas suficientes para classificar.
 *
 * Dicas para definir seus thresholds:
 *  - scrollDepth: abaixo de X% indica que as pessoas estão abandonando
 *    antes do ponto de conversão da sua página.
 *  - ragePct: acima de Y% indica frustração ou expectativa quebrada.
 *  - engagement: abaixo de Z indica sessões de baixa qualidade.
 *
 * TODO: substitua os valores abaixo pelos seus benchmarks reais.
 */
export function classifyPageHealth(m: PageMetrics): PageStatus | null {
  if (m.scrollDepth === undefined && m.ragePct === undefined) return null

  // Rage clicks — sinal direto de fricção (botão sem resposta, preço escondido,
  // elemento que parece clicável mas não é). Prioridade máxima.
  if (m.ragePct !== undefined && m.ragePct > 7)  return 'critico'
  if (m.ragePct !== undefined && m.ragePct > 3)  return 'atencao'

  // Scroll depth — tráfego frio precisa chegar até "Sobre o Especialista" (~50%)
  // e "Cases/Depoimentos" (~60%) para construir confiança antes de decidir.
  // Abaixo de 35% = abandonou antes de ver qualquer prova de autoridade.
  if (m.scrollDepth !== undefined && m.scrollDepth < 35) return 'critico'
  if (m.scrollDepth !== undefined && m.scrollDepth < 60) return 'atencao'

  // Engagement (% de sessões de alta intenção no Clarity)
  if (m.engagement !== undefined && m.engagement < 20) return 'critico'
  if (m.engagement !== undefined && m.engagement < 40) return 'atencao'

  return 'ok'
}
