// app/api/ads/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { updateAdStatus } from '@/lib/meta-api'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED'])
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAuth()
  if (unauthorized) return unauthorized

  try {
    const { id } = await params
    const body = schema.parse(await req.json())
    await updateAdStatus(id, body.status)
    return NextResponse.json({ ok: true, id, status: body.status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
