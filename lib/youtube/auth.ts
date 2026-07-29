import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const REDIRECT_URI = process.env.NEXTAUTH_URL ?? 'http://localhost:3000/';
const CREDENTIALS_PATH = path.join(process.cwd(), 'client_secret.json');
const TOKEN_PATH = path.join(process.cwd(), '.tokens.json');

interface StoredToken {
  refresh_token: string;
  access_token: string;
  expiry_date: number;
}

function makeOAuth2Client() {
  // Production: read from env vars
  if (process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET) {
    return new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      REDIRECT_URI,
    );
  }
  // Local dev: read from client_secret.json
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('client_secret.json não encontrado e YOUTUBE_CLIENT_ID/SECRET não configurados.');
  }
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_id, client_secret } = credentials.web;
  return new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
}

export async function getValidAccessToken(): Promise<string> {
  const auth2 = makeOAuth2Client();

  // Production: use refresh token from env var
  if (process.env.YOUTUBE_REFRESH_TOKEN) {
    auth2.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
    const { credentials } = await auth2.refreshAccessToken();
    return credentials.access_token!;
  }

  // Local dev: use .tokens.json
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error('Token não configurado. Execute: pnpm youtube:setup ou defina YOUTUBE_REFRESH_TOKEN.');
  }

  const stored: StoredToken = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));

  if (Date.now() >= stored.expiry_date) {
    auth2.setCredentials({ refresh_token: stored.refresh_token });
    const { credentials } = await auth2.refreshAccessToken();
    stored.access_token = credentials.access_token || '';
    stored.expiry_date = credentials.expiry_date || 0;
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(stored, null, 2));
  }

  return stored.access_token;
}

export async function generateInitialToken(authCode: string): Promise<void> {
  const auth2 = makeOAuth2Client();
  const { tokens } = await auth2.getToken(authCode);
  const stored: StoredToken = {
    refresh_token: tokens.refresh_token || '',
    access_token: tokens.access_token || '',
    expiry_date: tokens.expiry_date || 0,
  };
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(stored, null, 2));
}
