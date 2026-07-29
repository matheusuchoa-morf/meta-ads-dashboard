import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import fs from 'fs'
import path from 'path'

const REDIRECT_URI = process.env.NEXTAUTH_URL ?? 'http://localhost:3000/'

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
]

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

export async function GET() {
  const client = makeClient()
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })
  return NextResponse.redirect(url)
}
