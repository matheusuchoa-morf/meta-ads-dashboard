import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

const REDIRECT_URI = process.env.NEXTAUTH_URL ?? 'http://localhost:3000/'

function makeClient() {
  if (process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET) {
    return new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      REDIRECT_URI,
    )
  }
  const creds = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'client_secret.json'), 'utf8'))
  return new google.auth.OAuth2(creds.web.client_id, creds.web.client_secret, REDIRECT_URI)
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  try {
    const client = makeClient()
    const { tokens } = await client.getToken(code)
    return NextResponse.json({ refreshToken: tokens.refresh_token })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao trocar token'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
