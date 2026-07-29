// lib/notifications.ts
// Unified notification module: Discord webhook + Resend email
import { Resend } from 'resend'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DiscordEmbed {
  title: string
  description: string
  color: number       // Decimal: red=0xE53E3E, yellow=0xF0B429, green=0x4CAF82
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string }
  url?: string
}

// ─── Discord ────────────────────────────────────────────────────────────────

// Don't send username/avatar_url — let the webhook use its saved
// name ("Robô do ROI") and avatar (Chuck Norris) configured in Discord.
// Sending username overrides the identity and loses the saved avatar.

// Paused on 2026-04-20, reactivated on 2026-04-24 (hourly health alerts).
const DISCORD_PAUSED = false

export async function sendDiscord(embeds: DiscordEmbed[]): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url || DISCORD_PAUSED) return

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: embeds.slice(0, 10) }),
  })
}

// ─── Telegram (DESATIVADO — centralizado no Discord em 2026-04-24) ──────────
// Deixamos a função aqui pra reativar facilmente virando TELEGRAM_PAUSED = false.

const TELEGRAM_PAUSED = true

export async function sendTelegram(text: string): Promise<void> {
  if (TELEGRAM_PAUSED) return
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
}

// ─── Email (Resend) ─────────────────────────────────────────────────────────

export async function sendEmail(subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const to     = process.env.NOTIFICATION_EMAIL
  if (!apiKey || !to) return

  const resend = new Resend(apiKey)
  await resend.emails.send({
    from: 'Mitologia Alerts <onboarding@resend.dev>',
    to: [to],
    subject,
    html,
  })
}

// ─── Alert Builders ─────────────────────────────────────────────────────────

const DASHBOARD_URL = 'https://dashboard.your-domain.com'

const ACTION_MAP: Record<string, { yellow: string; red: string }> = {
  ctr:           { yellow: 'Testar novos hooks e criativos. Monitorar.', red: 'Pausar anúncios fracos. Trocar criativos urgente.' },
  cpm:           { yellow: 'Refinar segmentação. Audiência pode estar ampla.', red: 'Público sem intenção de compra. Rever audiência.' },
  connect:       { yellow: 'Otimizar peso da LP. Verificar PageSpeed.', red: 'LP crítica. Reduzir imagens, simplificar página.' },
  page_conv:     { yellow: 'Testar headline e CTA. Adicionar prova social.', red: 'Oferta não conecta. Revisar proposta de valor.' },
  checkout_conv: { yellow: 'Adicionar urgência e garantia no checkout.', red: 'Atrito grave. Verificar preço e formas de pagamento.' },
}

const BENCHMARK_MAP: Record<string, string> = {
  ctr: 'Acima de 2%',
  cpm: 'R$80 a R$100+',
  connect: '85% a 90%',
  page_conv: '7% a 13%',
  checkout_conv: '38% a 60%',
}

interface HealthAlert {
  key: string
  label: string
  formatted: string
  status: 'yellow' | 'red'
}

// ─── Send Health Alerts (UNIFIED — one message with all metrics) ────────────

export async function sendHealthAlerts(alerts: HealthAlert[]): Promise<void> {
  if (alerts.length === 0) return

  const redAlerts    = alerts.filter(a => a.status === 'red')
  const yellowAlerts = alerts.filter(a => a.status === 'yellow')
  const hasRed       = redAlerts.length > 0
  const emoji        = hasRed ? '🔴' : '🟡'
  const title        = hasRed ? 'ALERTA CRÍTICO' : 'ATENÇÃO'

  // ── Build unified Discord embed
  const lines: string[] = []

  if (redAlerts.length > 0) {
    lines.push('**🔴 CRÍTICO:**')
    for (const a of redAlerts) {
      lines.push(`• **${a.label}:** ${a.formatted} — Benchmark: ${BENCHMARK_MAP[a.key] ?? '—'}`)
      lines.push(`  _${ACTION_MAP[a.key]?.red ?? 'Verificar no dashboard.'}_`)
    }
  }

  if (yellowAlerts.length > 0) {
    if (redAlerts.length > 0) lines.push('')
    lines.push('**🟡 ATENÇÃO:**')
    for (const a of yellowAlerts) {
      lines.push(`• **${a.label}:** ${a.formatted} — Benchmark: ${BENCHMARK_MAP[a.key] ?? '—'}`)
      lines.push(`  _${ACTION_MAP[a.key]?.yellow ?? 'Monitorar.'}_`)
    }
  }

  const embed: DiscordEmbed = {
    title: `${emoji} ${title} — Funil Mitologia`,
    description: lines.join('\n'),
    color: hasRed ? 0xE53E3E : 0xF0B429,
    fields: [
      { name: 'Métricas em alerta', value: `${alerts.length}`, inline: true },
      { name: 'Críticas', value: `${redAlerts.length}`, inline: true },
    ],
    footer: { text: `📊 ${DASHBOARD_URL}` },
    url: DASHBOARD_URL,
  }

  // ── Email HTML
  const emailCards = alerts.map(a => {
    const isRed = a.status === 'red'
    const bg     = isRed ? '#2a1515' : '#2a2415'
    const border = isRed ? '#E53E3E' : '#F0B429'
    const dot    = isRed ? '🔴' : '🟡'
    const action = ACTION_MAP[a.key]?.[a.status] ?? 'Verificar no dashboard.'
    return `
      <div style="background:${bg}; border-left:4px solid ${border}; padding:16px; border-radius:8px; margin-bottom:12px;">
        <p style="margin:0 0 4px 0; color:#fff; font-weight:bold; font-size:14px;">${dot} ${a.label}: ${a.formatted}</p>
        <p style="margin:0; color:#8A9BA0; font-size:12px;">Benchmark: ${BENCHMARK_MAP[a.key] ?? '—'}</p>
        <p style="margin:4px 0 0 0; color:#EFEFEF; font-size:12px;">${action}</p>
      </div>
    `
  }).join('')

  const emailHtml = `
    <div style="background:#1D1F26; padding:32px; border-radius:12px; font-family:system-ui,sans-serif; max-width:500px;">
      <h1 style="color:${hasRed ? '#E53E3E' : '#F0B429'}; margin:0 0 20px 0; font-size:20px;">${emoji} ${title}</h1>
      ${emailCards}
      <a href="${DASHBOARD_URL}" style="display:inline-block; margin-top:16px; padding:10px 20px; background:#C9A45A; color:#000; text-decoration:none; border-radius:6px; font-weight:bold; font-size:13px;">Abrir Dashboard</a>
    </div>
  `

  // ── Telegram: texto compacto com as métricas em alerta
  const tgLines: string[] = [`${emoji} <b>${title} — Funil Mitologia</b>\n`]
  if (redAlerts.length > 0) {
    tgLines.push('🔴 <b>CRÍTICO:</b>')
    for (const a of redAlerts) {
      tgLines.push(`• <b>${a.label}:</b> ${a.formatted}`)
      tgLines.push(`  <i>${ACTION_MAP[a.key]?.red ?? 'Verificar.'}</i>`)
    }
  }
  if (yellowAlerts.length > 0) {
    if (redAlerts.length > 0) tgLines.push('')
    tgLines.push('🟡 <b>ATENÇÃO:</b>')
    for (const a of yellowAlerts) {
      tgLines.push(`• <b>${a.label}:</b> ${a.formatted}`)
      tgLines.push(`  <i>${ACTION_MAP[a.key]?.yellow ?? 'Monitorar.'}</i>`)
    }
  }
  tgLines.push(`\n📊 <a href="${DASHBOARD_URL}">Abrir Dashboard</a>`)

  await Promise.allSettled([
    sendDiscord([embed]),
    sendEmail(`${emoji} ${title} — Mitologia Dashboard`, emailHtml),
    sendTelegram(tgLines.join('\n')),
  ])
}

// ─── Send Sale Alert ────────────────────────────────────────────────────────

interface SaleInfo {
  product: string
  value: number
  source: string
  buyer?: string
  totalToday: number
  goal: number
  goalPct: number
}

export async function sendSaleAlert(sale: SaleInfo): Promise<void> {
  const valueFmt = `R$ ${sale.value.toFixed(2).replace('.', ',')}`

  const tgSale = [
    `🟢 <b>VENDA REALIZADA!</b>`,
    ``,
    `<b>Produto:</b> ${sale.product}`,
    `<b>Valor:</b> ${valueFmt}`,
    `<b>Origem:</b> ${sale.source}`,
    ``,
    `<b>Vendas hoje:</b> ${sale.totalToday} / Meta: ${sale.goal} (${sale.goalPct}%)`,
    `📊 <a href="${DASHBOARD_URL}">Dashboard</a>`,
  ].join('\n')

  await Promise.allSettled([
    sendDiscord([{
      title: '🟢 VENDA REALIZADA!',
      description: [
        `**Produto:** ${sale.product}`,
        `**Valor:** ${valueFmt}`,
        `**Origem:** ${sale.source}`,
      ].join('\n'),
      color: 0x4CAF82,
      fields: [
        { name: 'Vendas hoje', value: `${sale.totalToday}`, inline: true },
        { name: 'Meta', value: `${sale.totalToday}/${sale.goal} (${sale.goalPct}%)`, inline: true },
      ],
      footer: { text: `📊 ${DASHBOARD_URL}` },
      url: DASHBOARD_URL,
    }]),
    sendTelegram(tgSale),
  ])

  // Email skip para vendas individuais (muito frequente)
}

// ─── Send Auto-Pause Alert (ads paused by R$35 no-checkout rule) ────────────

export interface AutoPausedAd {
  adId: string
  adName: string
  campaignName: string
  spend: number
}

export async function sendAutoPauseAlert(ads: AutoPausedAd[]): Promise<void> {
  if (ads.length === 0) return

  const lines = ads.map(a => {
    const spendFmt = `R$ ${a.spend.toFixed(2).replace('.', ',')}`
    return `• **${a.adName}** — ${spendFmt} gasto · _${a.campaignName}_`
  })

  const description = [
    `Regra: ad gastou ≥ R$35 sem gerar nenhum checkout hoje → pausado automaticamente.`,
    '',
    ...lines,
    '',
    `💡 Analise o criativo, copy ou público antes de reativar.`,
  ].join('\n')

  const tgLines = [
    `⛔ <b>AUTO-PAUSE — ${ads.length} ad(s)</b>`,
    ``,
    `Regra: spend ≥ R$35 sem checkout hoje.`,
    ``,
    ...ads.map(a => `• <b>${a.adName}</b> — R$ ${a.spend.toFixed(2).replace('.', ',')} · <i>${a.campaignName}</i>`),
    ``,
    `📊 <a href="${DASHBOARD_URL}">Dashboard</a>`,
  ].join('\n')

  await Promise.allSettled([
    sendDiscord([{
      title: `⛔ AUTO-PAUSE — ${ads.length} ad(s) pausado(s)`,
      description,
      color: 0xE53E3E,
      fields: [
        { name: 'Ads pausados', value: `${ads.length}`, inline: true },
        { name: 'Spend total desperdiçado',
          value: `R$ ${ads.reduce((s, a) => s + a.spend, 0).toFixed(2).replace('.', ',')}`,
          inline: true },
      ],
      footer: { text: `📊 ${DASHBOARD_URL}` },
      url: DASHBOARD_URL,
    }]),
    sendTelegram(tgLines),
  ])
}

// ─── Send Checkout Abandoned Alert ──────────────────────────────────────────

export interface AbandonedBuyer {
  name: string
  email: string
  value: number
  date: string
}

interface CheckoutAbandoned {
  checkouts: number
  purchases: number
  convRate: number
  potentialLost: number
  buyers?: AbandonedBuyer[]
}

export async function sendCheckoutAlert(data: CheckoutAbandoned): Promise<void> {
  const potentialFmt = `R$ ${data.potentialLost.toFixed(2).replace('.', ',')}`

  // Build buyer list for the embed
  const buyerLines = (data.buyers ?? []).map(b => {
    const valueFmt = `R$ ${b.value.toFixed(2).replace('.', ',')}`
    return `👤 **${b.name}** — ${b.email} — ${valueFmt}`
  })

  const description = [
    `**Hoje:** ${data.checkouts} iniciaram checkout, ${data.purchases} compraram`,
    `**Taxa de conversão:** ${data.convRate.toFixed(1)}%`,
    `**Benchmark:** 38% a 60%`,
    '',
    `💰 **Potencial perdido:** ~${potentialFmt}`,
  ]

  if (buyerLines.length > 0) {
    description.push('')
    description.push('**📋 Leads para recuperação:**')
    description.push(...buyerLines)
  }

  description.push('')
  description.push(`**Ação:** Recuperar via email/WhatsApp. Verificar checkout.`)

  const tgBuyerLines = (data.buyers ?? []).map(b =>
    `👤 <b>${b.name}</b> — ${b.email} — R$ ${b.value.toFixed(2).replace('.', ',')}`
  )

  const tgCheckout = [
    `⏳ <b>CHECKOUT ABANDONADO</b>`,
    ``,
    `Hoje: ${data.checkouts} iniciaram, ${data.purchases} compraram`,
    `Taxa: ${data.convRate.toFixed(1)}% (benchmark: 38–60%)`,
    `💰 Potencial perdido: ~${potentialFmt}`,
    ...(tgBuyerLines.length > 0 ? ['', '<b>Leads para recuperação:</b>', ...tgBuyerLines] : []),
    ``,
    `📊 <a href="${DASHBOARD_URL}">Dashboard</a>`,
  ].join('\n')

  await Promise.allSettled([
    sendDiscord([{
      title: `⏳ CHECKOUT ABANDONADO — ${data.buyers?.length ?? (data.checkouts - data.purchases)} leads`,
      description: description.join('\n'),
      color: 0xF0B429,
      footer: { text: `📊 ${DASHBOARD_URL}` },
      url: DASHBOARD_URL,
    }]),
    sendTelegram(tgCheckout),
  ])
}
