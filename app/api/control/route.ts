// app/api/control/route.ts
// Alimenta a aba "Controle" (controle remoto): campanhas com status, orçamento
// e gasto de hoje. Os conjuntos vêm sob demanda em /api/campaigns/[id]/adsets
// — assim abrir a aba no celular custa 2 chamadas na Meta, não N.
import { NextRequest, NextResponse } from 'next/server'
import { fetchCampaigns, fetchCampaignSpend } from '@/lib/meta-api'
import { classifyCampaign } from '@/lib/campaign-classifier'
import { requireAuth } from '@/lib/auth'
import { DEMO_MODE, DEMO_CONTROL } from '@/lib/demo-data'

// Campanha arquivada/deletada não é acionável — some da tela de controle.
const HIDDEN_STATUSES = new Set(['ARCHIVED', 'DELETED'])

export async function GET(req: NextRequest) {
  if (DEMO_MODE) return NextResponse.json(DEMO_CONTROL)
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  const tagFilter = req.nextUrl.searchParams.get('tagFilter') ?? ''
  const datePreset = req.nextUrl.searchParams.get('datePreset') ?? 'today'

  try {
    const all = await fetchCampaigns()
    const visible = all
      .filter(c => !HIDDEN_STATUSES.has(c.effective_status))
      .map(c => ({ ...c, tag: classifyCampaign(c.name) }))
      .filter(c => (tagFilter ? c.tag.tag === tagFilter : true))

    if (visible.length === 0) return NextResponse.json({ campaigns: [] })

    // Best-effort: se o insights falhar (rate limit), a tela ainda liga/desliga.
    let spend: Record<string, number> = {}
    try {
      spend = await fetchCampaignSpend(datePreset, visible.map(c => c.id))
    } catch (e) {
      console.warn('[control] gasto do período falhou:', e instanceof Error ? e.message : e)
    }

    const accountNumeric = (process.env.META_AD_ACCOUNT_ID ?? '').replace('act_', '')

    const campaigns = visible.map(c => ({
      id: c.id,
      name: c.name,
      objective: c.objective,
      status: c.status,
      effective_status: c.effective_status,
      // Orçamento no nível de campanha só existe em campanha com Advantage
      // (CBO). Sem CBO isso vem nulo e o dinheiro é controlado no conjunto.
      daily_budget: c.daily_budget ?? null,
      lifetime_budget: c.lifetime_budget ?? null,
      tag: c.tag,
      spend: spend[c.id] ?? 0,
      metaLink: `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${accountNumeric}&selected_campaign_ids=${c.id}`,
    }))

    return NextResponse.json({ campaigns })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
