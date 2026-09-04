// lib/budget.ts
// Validação de orçamento compartilhada pelas rotas de controle remoto.
// A Meta trabalha em CENTAVOS (BRL tem 2 casas): R$ 150,00 = 15000.
import { z } from 'zod'
import type { BudgetPatch } from '@/lib/meta-api'

/** Piso de segurança. A Meta tem mínimos próprios por objetivo/moeda e pode
 *  recusar valores acima deste — aqui é só pra barrar "R$ 0,01" por engano. */
export const MIN_BUDGET_CENTS = 100

/** Teto absurdo, independente do teto configurável: R$ 1.000.000,00. Serve só
 *  pra barrar valor claramente errado antes de mandar pra Meta. */
export const ABSURD_BUDGET_CENTS = 100_000_000

export const budgetSchema = z
  .object({
    dailyBudgetCents: z.number().int().optional(),
    lifetimeBudgetCents: z.number().int().optional(),
  })
  .refine(
    b => (b.dailyBudgetCents === undefined) !== (b.lifetimeBudgetCents === undefined),
    { message: 'Envie exatamente um: dailyBudgetCents OU lifetimeBudgetCents' },
  )

export type BudgetInput = z.infer<typeof budgetSchema>

/** Erro de regra de negócio → vira 400, não 500. */
export class BudgetError extends Error {}

/**
 * Teto opcional de orçamento DIÁRIO, em reais, via `META_MAX_DAILY_BUDGET`.
 * Rede de segurança pra dedo gordo no celular: sem ela, um zero a mais numa
 * cama de hotel vira R$ 1.500/dia. Vazio/invalido = sem teto.
 */
export function maxDailyBudgetCents(): number | null {
  const raw = process.env.META_MAX_DAILY_BUDGET?.trim()
  if (!raw) return null
  const brl = Number(raw)
  if (!Number.isFinite(brl) || brl <= 0) return null
  return Math.round(brl * 100)
}

function fmt(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Normaliza o payload validado num patch pra Meta, aplicando piso e teto. */
export function validateBudget(input: BudgetInput): BudgetPatch {
  const isDaily = input.dailyBudgetCents !== undefined
  const cents = (isDaily ? input.dailyBudgetCents : input.lifetimeBudgetCents) as number

  if (!Number.isInteger(cents) || cents < MIN_BUDGET_CENTS) {
    throw new BudgetError(`Orçamento mínimo é ${fmt(MIN_BUDGET_CENTS)}.`)
  }

  if (cents > ABSURD_BUDGET_CENTS) {
    throw new BudgetError(`Valor absurdo (acima de ${fmt(ABSURD_BUDGET_CENTS)}). Confira o que digitou.`)
  }

  if (isDaily) {
    const max = maxDailyBudgetCents()
    if (max !== null && cents > max) {
      throw new BudgetError(
        `Acima do teto de ${fmt(max)}/dia definido em META_MAX_DAILY_BUDGET. ` +
        `Suba a variável de ambiente se quiser passar disso.`,
      )
    }
  }

  return { field: isDaily ? 'daily_budget' : 'lifetime_budget', cents }
}
