// app/api/campaigns/[id]/adsets/route.ts
// Conjuntos de uma campanha + gasto do período. Carregado sob demanda quando
// você expande a campanha na aba Controle.
import { NextRequest, NextResponse } from 'next/server'
import { fetchAdSets, fetchAdSetSpend } from '@/lib/meta-api'
import { requireAuth } from '@/lib/auth'
import { DEMO_MODE, DEMO_ADSETS } from '@/lib/demo-data'

const HIDDEN_STATUSES = new Set(['ARCHIVED', 'DELETED'])

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (DEMO_MODE) return NextResponse.json({ adsets: DEMO_ADSETS[id] ?? [] })

  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const datePreset = req.nextUrl.searchParams.get('datePreset') ?? 'today'

  try {
    const adsets = await fetchAdSets(id)
    // fetchAdSets pede limit 200 e não pagina. Campanha com mais que isso
    // apareceria cortada em silêncio — melhor deixar rastro no log.
    if (adsets.length >= 200) {
      console.warn(`[adsets] campanha ${id} devolveu ${adsets.length} conjuntos — a lista pode estar truncada em 200`)
    }

    let spend: Record<string, number> = {}
    try {
      spend = await fetchAdSetSpend(id, datePreset)
    } catch (e) {
      console.warn('[adsets] gasto do período falhou:', e instanceof Error ? e.message : e)
    }

    return NextResponse.json({
      adsets: adsets
        .filter(a => !HIDDEN_STATUSES.has(a.effective_status))
        .map(a => ({
          id: a.id,
          name: a.name,
          status: a.status,
          effective_status: a.effective_status,
          daily_budget: a.daily_budget ?? null,
          lifetime_budget: a.lifetime_budget ?? null,
          spend: spend[a.id] ?? 0,
        })),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
