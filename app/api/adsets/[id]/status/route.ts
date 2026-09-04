// app/api/adsets/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { updateAdSetStatus } from '@/lib/meta-api'
import { handleStatusPatch } from '@/lib/control'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  return handleStatusPatch(req, id, updateAdSetStatus)
}
