// lib/action-matchers.ts
// O Meta retorna o mesmo evento sob múltiplos `action_type` dependendo
// do pixel, da origem (browser/CAPI) e de Conversões Customizadas.
// Este módulo centraliza o matching para que trocar de pixel não exija
// alterar parsers espalhados pelo código.

export type MetaAction = { action_type: string; value: string }

// Conversões Customizadas de COMPRA devem ser listadas por ID ESPECÍFICO.
// ⚠️ NÃO usar catch-all `/^offsite_conversion\.custom\..+$/` — ele contava QUALQUER
// conversão customizada como venda. Bug confirmado em 16/06: a conversão "End Form"
// (2269373989923717, type OTHER — formulário, não compra) estava inflando o nº de
// compras (ex.: ADV Dashboard mostrava 1 compra fantasma). Para achar IDs: /api/debug/actions.
export const PURCHASE_PATTERNS: readonly (string | RegExp)[] = [
  'purchase',
  'omni_purchase',
  'onsite_web_purchase',
  'onsite_web_app_purchase',
  'offsite_conversion.fb_pixel_purchase',
  'offsite_conversion.custom.2400677647118380', // "IC2 Purchase (Imersao Claude Maio)" — type PURCHASE
]

export const LEAD_PATTERNS: readonly (string | RegExp)[] = [
  'lead',
  'complete_registration',
  'onsite_conversion.lead_grouped',
  'offsite_conversion.fb_pixel_lead',
  'offsite_conversion.fb_pixel_complete_registration',
]

export const CHECKOUT_PATTERNS: readonly (string | RegExp)[] = [
  'initiate_checkout',
  'omni_initiated_checkout',
  'offsite_conversion.fb_pixel_initiate_checkout',
]

export const LP_VIEW_PATTERNS: readonly (string | RegExp)[] = [
  'landing_page_view',
]

export const LINK_CLICK_PATTERNS: readonly (string | RegExp)[] = [
  'outbound_click',
  'link_click',
]

// Dentro de `video_play_actions`, o action_type `video_view` representa as
// reproduções de 3 segundos ou mais — base do Hook Rate (3s plays / impressões).
export const VIDEO_3S_PATTERNS: readonly (string | RegExp)[] = [
  'video_view',
]

function matches(actionType: string, pattern: string | RegExp): boolean {
  return typeof pattern === 'string' ? actionType === pattern : pattern.test(actionType)
}

// Pegamos o MÁXIMO (não soma) porque o Meta frequentemente reporta o
// mesmo evento sob aliases redundantes — `purchase` ⊂ `omni_purchase`,
// e `offsite_conversion.fb_pixel_purchase` já está contado em `purchase`.
// Somar duplicaria. Max tolera aliases e continua correto quando só
// uma Conversão Customizada existe.
export function sumActions(
  actions: MetaAction[] | undefined,
  patterns: readonly (string | RegExp)[],
): number {
  if (!actions?.length) return 0
  const values = actions
    .filter(a => patterns.some(p => matches(a.action_type, p)))
    .map(a => parseInt(a.value || '0', 10))
    .filter(n => !Number.isNaN(n))
  return values.length ? Math.max(...values) : 0
}

export function maxRoas(
  roas: MetaAction[] | undefined,
  patterns: readonly (string | RegExp)[] = PURCHASE_PATTERNS,
): number {
  if (!roas?.length) return 0
  const values = roas
    .filter(r => patterns.some(p => matches(r.action_type, p)))
    .map(r => parseFloat(r.value || '0'))
    .filter(n => !Number.isNaN(n))
  return values.length ? Math.max(...values) : 0
}

export function linkClicks(
  data: { outbound_clicks?: MetaAction[]; clicks?: string },
): number {
  const outbound = sumActions(data.outbound_clicks, LINK_CLICK_PATTERNS)
  return outbound > 0 ? outbound : parseInt(data.clicks || '0', 10) || 0
}
