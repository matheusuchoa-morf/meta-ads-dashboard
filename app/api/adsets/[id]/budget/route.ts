// app/api/adsets/[id]/budget/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { updateAdSetBudget } from '@/lib/meta-api'
import { handleBudgetPatch } from '@/lib/control'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  return handleBudgetPatch(req, id, updateAdSetBudget)
}
