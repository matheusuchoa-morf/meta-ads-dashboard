// app/api/campaigns/[id]/budget/route.ts
// Só funciona em campanha com orçamento de campanha (Advantage/CBO). Sem CBO,
// a Meta recusa e a mensagem dela volta no 502 — o orçamento mora no conjunto.
import { NextRequest, NextResponse } from 'next/server'
import { updateCampaignBudget } from '@/lib/meta-api'
import { handleBudgetPatch } from '@/lib/control'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  return handleBudgetPatch(req, id, updateCampaignBudget)
}
