// lib/control.ts
// Corpo compartilhado das rotas PATCH de controle remoto (status e orçamento,
// em campanha / conjunto / anúncio). Toda mutação passa por aqui, então a
// ordem é sempre a mesma: auth → validação → modo demo → Meta.
//
// Códigos:
//   401  não logado
//   400  payload/valor inválido (regra nossa)
//   502  a Meta recusou (token expirado, campanha sem CBO, mínimo do objetivo…)
//        — a mensagem da própria Meta volta no corpo, é ela que explica.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { DEMO_MODE } from '@/lib/demo-data'
import { metaErrorMessage, type BudgetPatch } from '@/lib/meta-api'
import { budgetSchema, validateBudget, BudgetError } from '@/lib/budget'

export const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED']),
})

function badRequest(err: unknown, fallback = 'Payload inválido'): NextResponse {
  const message =
    err instanceof BudgetError ? err.message
    : err instanceof z.ZodError ? err.issues[0]?.message ?? fallback
    : fallback
  return NextResponse.json({ error: message }, { status: 400 })
}

/** Auth para rotas de mutação. Em modo demo nada é mutado, então segue sem login. */
async function guard(): Promise<NextResponse | null> {
  if (DEMO_MODE) return null
  return requireAuth()
}

export async function handleStatusPatch(
  req: NextRequest,
  id: string,
  apply: (id: string, status: 'ACTIVE' | 'PAUSED') => Promise<void>,
): Promise<NextResponse> {
  const unauthorized = await guard()
  if (unauthorized) return unauthorized

  let status: 'ACTIVE' | 'PAUSED'
  try {
    status = statusSchema.parse(await req.json()).status
  } catch (err: unknown) {
    return badRequest(err, 'status precisa ser ACTIVE ou PAUSED')
  }

  if (DEMO_MODE) return NextResponse.json({ ok: true, demo: true, id, status })

  try {
    await apply(id, status)
    return NextResponse.json({ ok: true, id, status })
  } catch (err: unknown) {
    return NextResponse.json({ error: metaErrorMessage(err) }, { status: 502 })
  }
}

export async function handleBudgetPatch(
  req: NextRequest,
  id: string,
  apply: (id: string, patch: BudgetPatch) => Promise<void>,
): Promise<NextResponse> {
  const unauthorized = await guard()
  if (unauthorized) return unauthorized

  let patch: BudgetPatch
  try {
    patch = validateBudget(budgetSchema.parse(await req.json()))
  } catch (err: unknown) {
    return badRequest(err)
  }

  if (DEMO_MODE) return NextResponse.json({ ok: true, demo: true, id, ...patch })

  try {
    await apply(id, patch)
    return NextResponse.json({ ok: true, id, ...patch })
  } catch (err: unknown) {
    return NextResponse.json({ error: metaErrorMessage(err) }, { status: 502 })
  }
}
