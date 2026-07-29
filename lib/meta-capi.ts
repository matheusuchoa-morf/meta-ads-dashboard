// lib/meta-capi.ts
// Meta Conversions API (server-side) — envia Purchase events do servidor
// para o Meta sem depender de pixel no browser, cookies ou adblockers.
import { createHash } from 'crypto'

const PIXEL_ID = process.env.META_PIXEL_ID
const API_URL  = PIXEL_ID ? `https://graph.facebook.com/v19.0/${PIXEL_ID}/events` : null

// SHA-256 normalizado conforme exigido pelo Meta
function hash(value: string | undefined): string | undefined {
  if (!value) return undefined
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

function hashPhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined
  // Remove tudo que não é dígito, remove o + inicial
  const digits = phone.replace(/\D/g, '')
  return createHash('sha256').update(digits).digest('hex')
}

export interface CAPIEventData {
  email?:      string
  phone?:      string
  firstName?:  string
  lastName?:   string
  value:       number
  currency:    string
  contentName?: string
  contentIds?:  string[]
  eventId?:    string   // para deduplicação com o pixel do browser
  sourceUrl?:  string
  clientIpAddress?: string
  clientUserAgent?: string
}

export async function sendCAPIPurchase(data: CAPIEventData): Promise<void> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) {
    console.warn('[CAPI] META_ACCESS_TOKEN não configurado — evento ignorado')
    return
  }
  if (!API_URL) {
    console.warn('[CAPI] META_ACCESS_TOKEN ok, mas META_PIXEL_ID não está setado — evento ignorado')
    return
  }

  // Dados do usuário com hash (Meta exige SHA-256, lowercase, sem espaços)
  const user_data: Record<string, unknown> = {}
  const em = hash(data.email);         if (em) user_data.em = em
  const ph = hashPhone(data.phone);    if (ph) user_data.ph = ph
  const fn = hash(data.firstName);     if (fn) user_data.fn = fn
  const ln = hash(data.lastName);      if (ln) user_data.ln = ln
  if (data.clientIpAddress) user_data.client_ip_address = data.clientIpAddress
  if (data.clientUserAgent) user_data.client_user_agent = data.clientUserAgent

  const event: Record<string, unknown> = {
    event_name:       'Purchase',
    event_time:       Math.floor(Date.now() / 1000),
    action_source:    'website',
    event_source_url: data.sourceUrl ?? 'https://your-domain.com/pagina-a/',
    user_data,
    custom_data: {
      value:        data.value,
      currency:     data.currency,
      content_name: data.contentName,
      content_ids:  data.contentIds ?? [],
      content_type: 'product',
    },
  }

  // event_id permite deduplicação: se o pixel do browser disparar também,
  // o Meta descarta o duplicado usando esse ID
  if (data.eventId) event.event_id = data.eventId

  const payload = {
    data: [event],
    access_token: token,
    // test_event_code: 'TEST12345', // descomente para testar no Events Manager
  }

  const res = await fetch(API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  const result = await res.json()

  if (result.error) {
    console.error('[CAPI] Erro ao enviar Purchase:', JSON.stringify(result.error))
  } else {
    console.log(`[CAPI] Purchase enviado — events_received: ${result.events_received}, fbtrace: ${result.fbtrace_id}`)
  }
}
