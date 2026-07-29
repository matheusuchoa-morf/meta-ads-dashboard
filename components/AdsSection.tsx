// components/AdsSection.tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import { ExternalLink, ImageIcon, TrendingUp, AlertTriangle, StopCircle, ZoomIn, X } from 'lucide-react'
import { fmtBRL, fmtNum } from '@/lib/formatters'
import { buildDateParams, type CustomRange } from '@/lib/date-utils'
import { sumActions, maxRoas, PURCHASE_PATTERNS, CHECKOUT_PATTERNS, LP_VIEW_PATTERNS, VIDEO_3S_PATTERNS } from '@/lib/action-matchers'
import { detectLP, detectAdHook, detectCoherence } from '@/lib/lp-mapping'
import { Film, Image as ImageIconLucide } from 'lucide-react'

interface AdRow {
  ad_id: string
  ad_name: string
  adset_name?: string
  campaign_name?: string
  impressions: string
  clicks: string
  inline_link_clicks?: string
  spend: string
  ctr: string
  cpc?: string
  cpm?: string
  actions?: { action_type: string; value: string }[]
  purchase_roas?: { action_type: string; value: string }[]
  video_play_actions?: { action_type: string; value: string }[]
  video_avg_time_watched_actions?: { action_type: string; value: string }[]
  video_play_curve_actions?: { action_type: string; value: number[] }[]
  video_duration?: number | null
  thumbnail: string | null
  landingPage: string | null
  metaLink: string
}

interface Props {
  datePreset: string
  tagFilter: string
  customRange?: CustomRange
}

type Decision = 'scale' | 'check' | 'stop'

function getRoas(ad: AdRow): number {
  return maxRoas(ad.purchase_roas)
}

function getPurchases(ad: AdRow): number {
  return sumActions(ad.actions, PURCHASE_PATTERNS)
}

function getCheckouts(ad: AdRow): number {
  return sumActions(ad.actions, CHECKOUT_PATTERNS)
}

function getLpViews(ad: AdRow): number {
  return sumActions(ad.actions, LP_VIEW_PATTERNS)
}

/** Cliques no link/CTA (inline_link_clicks), não o total de cliques. */
function getLinkClicks(ad: AdRow): number {
  return parseInt(ad.inline_link_clicks ?? '0', 10)
}

/** Reproduções de vídeo (video_play_actions) — base do Hook Rate + detecção de vídeo. */
function get3sPlays(ad: AdRow): number {
  return sumActions(ad.video_play_actions, VIDEO_3S_PATTERNS)
}

/** Tempo médio assistido, em segundos (sinal honesto ao lado do Hook). */
function getAvgWatch(ad: AdRow): number {
  return sumActions(ad.video_avg_time_watched_actions, VIDEO_3S_PATTERNS)
}

/** CPM = gasto ÷ impressões × 1000. Usa o cpm do Meta quando vier. */
function getCpm(ad: AdRow): number {
  if (ad.cpm != null && ad.cpm !== '') return parseFloat(ad.cpm)
  const imp = parseInt(ad.impressions ?? '0', 10)
  return imp > 0 ? (parseFloat(ad.spend ?? '0') / imp) * 1000 : 0
}

/**
 * Conversão da PÁGINA por anúncio = compras ÷ visitas na página (landing_page_view).
 * Retorna null quando não houve visitas (sem denominador).
 */
function getPageConversion(ad: AdRow): number | null {
  const views = getLpViews(ad)
  if (views <= 0) return null
  return (getPurchases(ad) / views) * 100
}

/**
 * Vídeo vs. estático. Sinal primário = convenção de nome (ADV = vídeo,
 * ADE/ADC/AD = estático), que é como o time nomeia. `video_play_actions`
 * sozinho NÃO serve: criativos estáticos retornam plays-fantasma (ex.: ADE
 * com 0,3% de hook). Fallback orientado a dados pega vídeos sem prefixo:
 * só conta como vídeo se a razão 3s/impressões for relevante.
 */
function isVideoAd(ad: AdRow): boolean {
  const n = (ad.ad_name ?? '').toLowerCase().trim()
  if (/^adv[\s\-_|]/.test(n) || n === 'adv' || n.includes('vídeo') || n.includes(' video')) return true
  const v3s = get3sPlays(ad)
  const imp = parseInt(ad.impressions ?? '0', 10)
  return imp > 0 && v3s >= 50 && v3s / imp > 0.08
}

/**
 * Hook Rate = reproduções de vídeo de ≥3s ÷ impressões.
 * A Meta deprecou o campo de 3s direto, então reconstruímos via curva de retenção
 * (video_play_curve_actions): 22 pontos do início (100%) ao fim (0%) do vídeo.
 * Interpolamos a retenção no tempo de 3s usando a duração: pos = 3/dur × (n-1).
 * 3s plays = plays × retenção(3s) ; hook = 3s plays ÷ impressões. null sem dado.
 */
function getHookRate(ad: AdRow): number | null {
  if (!isVideoAd(ad)) return null
  const imp = parseInt(ad.impressions ?? '0', 10)
  if (imp < 50) return null // < 50 impressões = ruído estatístico
  const plays = get3sPlays(ad)
  const curve = ad.video_play_curve_actions?.[0]?.value
  const dur = ad.video_duration
  if (!plays || !curve || curve.length < 2 || !dur || dur <= 0) return null
  const n = curve.length - 1 // intervalos (0..n cobrem 0..dur segundos)
  const pos = Math.min(n, Math.max(0, (3 / dur) * n))
  const i = Math.floor(pos)
  const frac = pos - i
  const ret = i + 1 < curve.length ? curve[i] + frac * (curve[i + 1] - curve[i]) : curve[i]
  return ((plays * (ret / 100)) / imp) * 100
}

// ── Benchmarks de cor ─────────────────────────────────────────────────────────
// Conversão da página: 🔴 < 2% · 🟡 2–6% · 🟢 ≥ 6%
function convColor(pct: number | null): string {
  if (pct == null) return 'var(--mit-text-subtle)'
  if (pct >= 6) return 'var(--mit-success)'
  if (pct >= 2) return 'var(--mit-warning)'
  return 'var(--mit-danger)'
}
// Hook Rate (3s ÷ impressões): 🔴 < 25% · 🟡 25–40% · 🟢 ≥ 40%
function hookColor(pct: number | null): string {
  if (pct == null) return 'var(--mit-text-subtle)'
  if (pct >= 40) return 'var(--mit-success)'
  if (pct >= 25) return 'var(--mit-warning)'
  return 'var(--mit-danger)'
}

/**
 * Classificação baseada em compras (ROAS), não em CTR.
 * CTR sozinho não indica resultado de negócio.
 */
function classifyAdDecision(ad: AdRow): Decision {
  const spend     = parseFloat(ad.spend ?? '0')
  const roas      = getRoas(ad)
  const purchases = getPurchases(ad)

  // Dados insuficientes para decisão
  if (spend < 10) return 'check'

  // Anúncio gerou compras — classificar por ROAS
  if (purchases > 0 || roas > 0) {
    if (roas >= 2.5) return 'scale'
    if (roas >= 1.0) return 'check'
    return 'stop'
  }

  // Sem compras: quanto gastou sem resultado determina urgência
  if (spend >= 50) return 'stop'   // gastou R$50+ sem nenhuma compra
  return 'check'                    // ainda coletando dados
}

function AdThumbnail({
  src,
  name,
  onPreview,
}: {
  src: string | null
  name: string
  onPreview?: () => void
}) {
  if (src) {
    return (
      <button
        onClick={onPreview}
        className="relative w-9 h-9 rounded-md shrink-0 border group cursor-pointer overflow-hidden"
        style={{ borderColor: 'var(--mit-border)' }}
        title="Ver criativo"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} className="w-full h-full object-cover" />
        <span className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <ZoomIn size={14} className="text-white" />
        </span>
      </button>
    )
  }
  return (
    <div
      className="w-9 h-9 rounded-md shrink-0 flex items-center justify-center border"
      style={{ background: 'var(--mit-bg-elevated)', borderColor: 'var(--mit-border)' }}
    >
      <ImageIcon size={14} style={{ color: 'var(--mit-text-subtle)' }} />
    </div>
  )
}

// ── Lightbox para preview do criativo ───────────────────────────────────────
function CreativeLightbox({
  src,
  name,
  onClose,
}: {
  src: string
  name: string
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Content */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative max-w-lg w-full rounded-xl overflow-hidden shadow-2xl border"
          style={{ borderColor: 'var(--mit-border)', background: 'var(--mit-bg-card)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--mit-border)' }}
          >
            <p className="text-sm font-medium truncate" style={{ color: 'var(--mit-text)' }}>
              {name}
            </p>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'var(--mit-text-subtle)' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={name}
            className="w-full h-auto"
            style={{ maxHeight: '70vh', objectFit: 'contain', background: '#000' }}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

const DECISION_CONFIG = {
  scale: {
    icon: TrendingUp,
    label: 'Para Escalar',
    desc: 'ROAS ≥ 2,5',
    bg: 'rgba(76,175,130,0.08)',
    border: 'rgba(76,175,130,0.25)',
    color: 'var(--mit-success)',
    badge: { bg: 'rgba(76,175,130,0.15)', color: 'var(--mit-success)' },
    rowDecision: { bg: 'rgba(76,175,130,0.12)', label: '↑ Escalar' },
  },
  check: {
    icon: AlertTriangle,
    label: 'Estado Crítico',
    desc: 'ROAS 1,0–2,5',
    bg: 'rgba(240,180,41,0.08)',
    border: 'rgba(240,180,41,0.25)',
    color: 'var(--mit-warning)',
    badge: { bg: 'rgba(240,180,41,0.15)', color: 'var(--mit-warning)' },
    rowDecision: { bg: 'rgba(240,180,41,0.12)', label: '~ Verificar' },
  },
  stop: {
    icon: StopCircle,
    label: 'Parar Imediatamente',
    desc: 'ROAS < 1,0 ou sem compras',
    bg: 'rgba(229,62,62,0.08)',
    border: 'rgba(229,62,62,0.25)',
    color: 'var(--mit-danger)',
    badge: { bg: 'rgba(229,62,62,0.15)', color: 'var(--mit-danger)' },
    rowDecision: { bg: 'rgba(229,62,62,0.12)', label: '✕ Parar' },
  },
}

// ── Decision summary card (top row) ──────────────────────────────────────────
function DecisionCard({
  decision,
  ads,
  delay,
  onPreview,
}: {
  decision: Decision
  ads: AdRow[]
  delay: number
  onPreview: (src: string, name: string) => void
}) {
  const cfg = DECISION_CONFIG[decision]
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex-1 rounded-xl border p-4"
      style={{ background: cfg.bg, borderColor: cfg.border, minWidth: 0 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} style={{ color: cfg.color }} />
        <span className="text-sm font-semibold truncate" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-mono font-bold ml-auto shrink-0"
          style={{ background: cfg.badge.bg, color: cfg.badge.color }}
        >
          {ads.length}
        </span>
      </div>
      <p className="text-[11px] mb-3" style={{ color: cfg.color, opacity: 0.7 }}>{cfg.desc}</p>

      {ads.length === 0 ? (
        <p className="text-xs italic" style={{ color: 'var(--mit-text-subtle)' }}>Nenhum</p>
      ) : (
        <div className="space-y-2">
          {ads.slice(0, 3).map(ad => {
            const roas  = getRoas(ad)
            const purch = getPurchases(ad)
            return (
              <div key={ad.ad_id} className="flex items-center gap-2">
                <AdThumbnail
                  src={ad.thumbnail}
                  name={ad.ad_name}
                  onPreview={ad.thumbnail ? () => onPreview(ad.thumbnail!, ad.ad_name) : undefined}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[11px] font-medium truncate"
                    style={{ color: 'var(--mit-text)' }}
                    title={ad.ad_name}
                  >
                    {ad.ad_name}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--mit-text-subtle)' }}>
                    {purch > 0
                      ? `${purch} compra${purch !== 1 ? 's' : ''} · ROAS ${roas.toFixed(2)}`
                      : `R$\u00a0${parseFloat(ad.spend).toFixed(0)} sem compras`}
                  </p>
                </div>
                <a
                  href={ad.metaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir no Meta"
                  className="shrink-0"
                  style={{ color: cfg.color, opacity: 0.7 }}
                >
                  <ExternalLink size={11} />
                </a>
              </div>
            )
          })}
          {ads.length > 3 && (
            <p className="text-[10px]" style={{ color: 'var(--mit-text-subtle)' }}>
              +{ads.length - 3} mais
            </p>
          )}
        </div>
      )}
    </motion.div>
  )
}

function AdsSkeleton() {
  return (
    <div className="space-y-5">
      {/* Decision cards skeleton */}
      <div className="flex gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-xl border p-4 h-36 animate-pulse"
            style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
          />
        ))}
      </div>
      {/* Table skeleton */}
      <section
        className="rounded-xl border p-6 animate-pulse"
        style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
      >
        <div className="h-5 w-48 rounded mb-2" style={{ background: 'var(--mit-bg-elevated)' }} />
        <div className="h-3 w-64 rounded mb-6" style={{ background: 'var(--mit-bg-elevated)' }} />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-md shrink-0" style={{ background: 'var(--mit-bg-elevated)' }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 rounded" style={{ background: 'var(--mit-bg-elevated)' }} />
              <div className="h-2.5 w-1/2 rounded" style={{ background: 'var(--mit-bg-elevated)' }} />
            </div>
            <div className="h-3 w-16 rounded" style={{ background: 'var(--mit-bg-elevated)' }} />
          </div>
        ))}
      </section>
    </div>
  )
}

export function AdsSection({ datePreset, tagFilter, customRange }: Props) {
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null)
  const { data, isLoading, error } = useQuery({
    queryKey: ['ads', datePreset, tagFilter, customRange],
    queryFn: async () => {
      const params = buildDateParams(datePreset, customRange ?? null, tagFilter)
      const r = await fetch(`/api/ads?${params}`)
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${r.status}`)
      }
      return r.json()
    },
    refetchInterval: 5 * 60 * 1000,
  })

  if (isLoading) return <AdsSkeleton />
  if (error || data?.error) {
    return (
      <div
        className="text-red-400 p-4 rounded-xl"
        style={{ background: 'var(--mit-bg-card)' }}
      >
        Erro ao carregar anúncios: {data?.error ?? String(error)}
      </div>
    )
  }

  const ads: AdRow[] = data?.ads ?? []
  const classified = ads.map(ad => ({ ...ad, decision: classifyAdDecision(ad) }))
  const toScale = classified.filter(a => a.decision === 'scale')
  const toCheck = classified.filter(a => a.decision === 'check')
  const toStop  = classified.filter(a => a.decision === 'stop')

  return (
    <div className="space-y-5">

      {/* ── Decision cards — stack on mobile, row on desktop ── */}
      {ads.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <DecisionCard decision="scale" ads={toScale} delay={0.0} onPreview={(s, n) => setPreview({ src: s, name: n })} />
          <DecisionCard decision="check" ads={toCheck} delay={0.1} onPreview={(s, n) => setPreview({ src: s, name: n })} />
          <DecisionCard decision="stop"  ads={toStop}  delay={0.2} onPreview={(s, n) => setPreview({ src: s, name: n })} />
        </div>
      )}

      {/* ── Top ads table ── */}
      <section
        className="rounded-xl border p-6"
        style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
      >
        <div className="mb-5">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--mit-gold)' }}>
            Avaliação de Anúncios
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--mit-text-subtle)' }}>
            {ads.length} anúncio{ads.length !== 1 ? 's' : ''} · ordenado por gasto
          </p>
        </div>

        {ads.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>
            Nenhum anúncio encontrado para o período selecionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr
                  className="text-left text-xs uppercase tracking-wider"
                  style={{ borderBottom: '1px solid var(--mit-border)' }}
                >
                  <th className="pb-2 pr-4 font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Anúncio</th>
                  <th className="pb-2 pr-4 font-medium hidden sm:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>Tipo</th>
                  <th className="pb-2 pr-4 font-medium hidden lg:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>Campanha</th>
                  <th className="pb-2 pr-4 font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Gasto</th>
                  <th className="pb-2 pr-4 font-medium" style={{ color: 'var(--mit-text-subtle)' }} title="Custo por mil impressões">CPM</th>
                  <th className="pb-2 pr-4 font-medium" style={{ color: 'var(--mit-text-subtle)' }} title="Cliques ÷ impressões">CTR</th>
                  <th className="pb-2 pr-4 font-medium" style={{ color: 'var(--mit-text-subtle)' }} title="Cliques no link/CTA (inline_link_clicks)">Cliques</th>
                  <th className="pb-2 pr-4 font-medium" style={{ color: 'var(--mit-text-subtle)' }} title="Visitas à página (landing_page_view)">C. Página</th>
                  <th className="pb-2 pr-4 font-medium hidden md:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>Checkout</th>
                  <th className="pb-2 pr-4 font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Compras</th>
                  <th className="pb-2 pr-4 font-medium" style={{ color: 'var(--mit-text-subtle)' }} title="Compras ÷ visitas na página">Conv.</th>
                  <th className="pb-2 pr-4 font-medium" style={{ color: 'var(--mit-text-subtle)' }} title="Reproduções de ≥3s ÷ impressões (só vídeo). 3s reconstruído da curva de retenção + duração do vídeo.">Hook</th>
                  <th className="pb-2 pr-4 font-medium hidden lg:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>ROAS</th>
                  <th className="pb-2 w-8 font-medium" style={{ color: 'var(--mit-text-subtle)' }}></th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad, i) => {
                  const roas       = getRoas(ad)
                  const purchases  = getPurchases(ad)
                  const checkouts  = getCheckouts(ad)
                  const spend      = parseFloat(ad.spend ?? '0')
                  const cpa        = purchases > 0 ? spend / purchases : 0
                  const ctr        = parseFloat(ad.ctr ?? '0')
                  const linkClicks = getLinkClicks(ad)
                  const pageViews  = getLpViews(ad)
                  const conversion = getPageConversion(ad)
                  const video      = isVideoAd(ad)
                  const hook       = getHookRate(ad)
                  const avgWatch   = getAvgWatch(ad)
                  const cpm        = getCpm(ad)
                  const decision   = classifyAdDecision(ad)
                  const cfg        = DECISION_CONFIG[decision]

                  return (
                    <motion.tr
                      key={ad.ad_id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                      className="transition-colors hover:bg-white/[0.025]"
                      style={{ borderBottom: '1px solid var(--mit-border)' }}
                    >
                      {/* Ad name + thumbnail + badge */}
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <AdThumbnail
                            src={ad.thumbnail}
                            name={ad.ad_name}
                            onPreview={ad.thumbnail ? () => setPreview({ src: ad.thumbnail!, name: ad.ad_name }) : undefined}
                          />
                          <div className="min-w-0">
                            <p
                              className="text-sm font-medium truncate max-w-[140px] sm:max-w-[200px]"
                              style={{ color: 'var(--mit-text)' }}
                              title={ad.ad_name}
                            >
                              {ad.ad_name}
                            </p>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-semibold mt-0.5 inline-block"
                              style={{ background: cfg.rowDecision.bg, color: cfg.color }}
                            >
                              {cfg.rowDecision.label}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Tipo: vídeo vs estático */}
                      <td className="py-3 pr-4 hidden sm:table-cell">
                        {video ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(74,158,232,0.12)', color: '#4A9EE8' }}
                          >
                            <Film size={11} /> Vídeo
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--mit-bg-elevated)', color: 'var(--mit-text-subtle)' }}
                          >
                            <ImageIconLucide size={11} /> Estático
                          </span>
                        )}
                      </td>

                      {/* Campaign (hidden até lg) */}
                      <td className="py-3 pr-4 max-w-[120px] hidden lg:table-cell">
                        <span
                          className="text-xs truncate block"
                          style={{ color: 'var(--mit-text-subtle)' }}
                          title={ad.campaign_name}
                        >
                          {ad.campaign_name ?? '—'}
                        </span>
                      </td>

                      {/* Spend */}
                      <td className="py-3 pr-4">
                        <span className="text-sm font-mono" style={{ color: 'var(--mit-text-muted)' }}>
                          {fmtBRL(spend)}
                        </span>
                      </td>

                      {/* CPM */}
                      <td className="py-3 pr-4">
                        <span className="text-sm font-mono" style={{ color: 'var(--mit-text-muted)' }} title="Custo por mil impressões">
                          {fmtBRL(cpm)}
                        </span>
                      </td>

                      {/* CTR */}
                      <td className="py-3 pr-4">
                        <span className="text-sm font-mono" style={{ color: 'var(--mit-text-muted)' }} title="Cliques ÷ impressões">
                          {ctr.toFixed(2).replace('.', ',')}%
                        </span>
                      </td>

                      {/* Cliques no link */}
                      <td className="py-3 pr-4">
                        {linkClicks > 0 ? (
                          <span className="text-sm font-mono" style={{ color: 'var(--mit-text-muted)' }} title="Cliques no link/CTA (inline_link_clicks)">
                            {fmtNum(linkClicks)}
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>—</span>
                        )}
                      </td>

                      {/* C. Página (visitas na página) */}
                      <td className="py-3 pr-4">
                        {pageViews > 0 ? (
                          <span className="text-sm font-mono" style={{ color: 'var(--mit-text-muted)' }} title="Visitas à página (landing_page_view)">
                            {fmtNum(pageViews)}
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>—</span>
                        )}
                      </td>

                      {/* Checkout */}
                      <td className="py-3 pr-4 hidden md:table-cell">
                        {checkouts > 0 ? (
                          <span className="text-sm font-mono" style={{ color: 'var(--mit-warning)' }}>
                            {fmtNum(checkouts)}
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>—</span>
                        )}
                      </td>

                      {/* Purchases + CPA */}
                      <td className="py-3 pr-4">
                        {purchases > 0 ? (
                          <div>
                            <span className="text-sm font-mono font-semibold" style={{ color: 'var(--mit-success)' }}>
                              {fmtNum(purchases)}
                            </span>
                            {cpa > 0 && (
                              <span className="block text-[10px]" style={{ color: 'var(--mit-text-subtle)' }}>
                                CPA: {fmtBRL(cpa)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>—</span>
                        )}
                      </td>

                      {/* Conversão da página = compras ÷ visitas */}
                      <td className="py-3 pr-4">
                        {conversion != null ? (
                          <span
                            className="text-sm font-mono font-semibold"
                            style={{ color: convColor(conversion) }}
                            title={`${getPurchases(ad)} compras ÷ ${getLpViews(ad)} visitas`}
                          >
                            {conversion.toFixed(1).replace('.', ',')}%
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>—</span>
                        )}
                      </td>

                      {/* Hook (só vídeo) = reproduções de vídeo ÷ impressões */}
                      <td className="py-3 pr-4">
                        {hook != null ? (
                          <div>
                            <span
                              className="text-sm font-mono font-semibold"
                              style={{ color: hookColor(hook) }}
                              title={`Reproduções de ≥3s ÷ ${fmtNum(parseInt(ad.impressions || '0', 10))} impressões (3s derivado da curva de retenção) · ${avgWatch}s médios assistidos`}
                            >
                              {hook.toFixed(1).replace('.', ',')}%
                            </span>
                            {avgWatch > 0 && (
                              <span className="block text-[10px]" style={{ color: 'var(--mit-text-subtle)' }}>
                                {avgWatch}s méd
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--mit-text-subtle)' }} title="Estático ou < 50 impressões — sem hook">—</span>
                        )}
                      </td>

                      {/* ROAS (hidden até lg) */}
                      <td className="py-3 pr-4 hidden lg:table-cell">
                        <span
                          className="text-sm font-mono font-semibold"
                          style={{
                            color: roas >= 2.5
                              ? 'var(--mit-success)'
                              : roas >= 1.0
                              ? 'var(--mit-warning)'
                              : roas > 0
                              ? 'var(--mit-danger)'
                              : 'var(--mit-text-subtle)',
                          }}
                        >
                          {roas > 0 ? roas.toFixed(2).replace('.', ',') : '—'}
                        </span>
                      </td>

                      {/* Meta link */}
                      <td className="py-3">
                        <a
                          href={ad.metaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:opacity-70"
                          style={{ background: 'var(--mit-bg-elevated)', color: 'var(--mit-gold)' }}
                          title={ad.metaLink.includes('drive.google') ? 'Ver criativo no Drive' : 'Abrir no Meta Ads Manager'}
                        >
                          <ExternalLink size={12} />
                        </a>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>

            {/* ── Legenda dos benchmarks ── */}
            <div className="mt-5 flex flex-col gap-2 text-[11px]" style={{ color: 'var(--mit-text-subtle)' }}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold uppercase tracking-wider" style={{ color: 'var(--mit-text-muted)' }}>
                  Conversão da página
                </span>
                <span><span style={{ color: 'var(--mit-danger)' }}>●</span> &lt; 2% ruim</span>
                <span><span style={{ color: 'var(--mit-warning)' }}>●</span> 2–6% padrão</span>
                <span><span style={{ color: 'var(--mit-success)' }}>●</span> ≥ 6% excelente</span>
                <span className="opacity-70">· compras ÷ visitas na página</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold uppercase tracking-wider" style={{ color: 'var(--mit-text-muted)' }}>
                  Hook (vídeo)
                </span>
                <span><span style={{ color: 'var(--mit-danger)' }}>●</span> &lt; 25% ruim</span>
                <span><span style={{ color: 'var(--mit-warning)' }}>●</span> 25–40% ok</span>
                <span><span style={{ color: 'var(--mit-success)' }}>●</span> ≥ 40% excelente</span>
                <span className="opacity-70">· reproduções de ≥3s ÷ impressões (3s derivado da curva de retenção)</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Tabela de cruzamento: Anúncio × Gancho × LP × Headline ── */}
      {ads.length > 0 && (
        <section
          className="rounded-xl border p-6"
          style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
        >
          <div className="mb-5">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--mit-gold)' }}>
              Cruzamento Ad ↔ LP
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--mit-text-subtle)' }}>
              Validação de match entre o gancho do criativo e a headline da página de destino. Mismatch = potencial drop em Connect Rate.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr
                  className="text-left text-xs uppercase tracking-wider"
                  style={{ borderBottom: '1px solid var(--mit-border)' }}
                >
                  <th className="pb-2 pr-4 font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Anúncio</th>
                  <th className="pb-2 pr-4 font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Coerência</th>
                  <th className="pb-2 pr-4 font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Gancho</th>
                  <th className="pb-2 pr-4 font-medium" style={{ color: 'var(--mit-text-subtle)' }}>LP</th>
                  <th className="pb-2 pr-4 font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Headline</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad, i) => {
                  const hook = detectAdHook(ad.ad_name)
                  const lp = detectLP(ad.landingPage)
                  const isLegacy = lp.status === 'legacy'
                  const isUnknown = lp.status === 'unknown'
                  const coh = detectCoherence(ad.ad_name, { status: lp.status, slug: lp.slug })
                  const cohCfg = {
                    green:  { dot: '🟢', label: 'Coerente',       color: 'var(--mit-success)', bg: 'rgba(16,185,129,0.12)' },
                    yellow: { dot: '🟡', label: 'Serve',          color: 'var(--mit-warning)', bg: 'rgba(245,158,11,0.12)' },
                    red:    { dot: '🔴', label: 'Sem correlação', color: 'var(--mit-danger)',  bg: 'rgba(220,38,38,0.12)' },
                  }[coh.level]

                  return (
                    <motion.tr
                      key={`xref-${ad.ad_id}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.25 }}
                      className="transition-colors hover:bg-white/[0.025] align-top"
                      style={{ borderBottom: '1px solid var(--mit-border)' }}
                    >
                      <td className="py-3 pr-4 max-w-[180px]">
                        <p className="font-medium truncate" style={{ color: 'var(--mit-text)' }} title={ad.ad_name}>
                          {ad.ad_name}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>
                          {ad.campaign_name ?? '—'}
                        </p>
                      </td>

                      {/* Coerência ad↔página (semáforo) */}
                      <td className="py-3 pr-4 align-top max-w-[180px]">
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap"
                          style={{ background: cohCfg.bg, color: cohCfg.color }}
                        >
                          {cohCfg.dot} {cohCfg.label}
                        </span>
                        <p className="text-[10px] mt-1 leading-snug" style={{ color: 'var(--mit-text-subtle)' }}>
                          {coh.reason}
                        </p>
                      </td>
                      <td className="py-3 pr-4 max-w-[200px]">
                        <p className="text-[13px] leading-snug" style={{ color: 'var(--mit-text-muted)' }}>
                          {hook}
                        </p>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded inline-block"
                          style={{
                            background: isUnknown
                              ? 'rgba(220,38,38,0.15)'
                              : isLegacy
                              ? 'rgba(245,158,11,0.15)'
                              : 'rgba(16,185,129,0.15)',
                            color: isUnknown
                              ? 'var(--mit-danger)'
                              : isLegacy
                              ? 'var(--mit-warning)'
                              : 'var(--mit-success)',
                          }}
                        >
                          {lp.version}
                        </span>
                        {isLegacy && (
                          <p className="text-[10px] mt-1" style={{ color: 'var(--mit-warning)' }}>
                            legacy
                          </p>
                        )}
                        {ad.landingPage && (
                          <a
                            href={ad.landingPage}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[10px] mt-1 underline opacity-70 hover:opacity-100"
                            style={{ color: 'var(--mit-text-subtle)' }}
                          >
                            {lp.slug}
                          </a>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-[13px] leading-snug" style={{ color: 'var(--mit-text)' }}>
                          {lp.headline}
                        </p>
                        {lp.subheadline !== '—' && (
                          <p className="text-[11px] mt-1 leading-snug" style={{ color: 'var(--mit-text-subtle)' }}>
                            {lp.subheadline}
                          </p>
                        )}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="text-[11px] mt-4 space-y-1" style={{ color: 'var(--mit-text-subtle)' }}>
            <p>
              <span className="font-semibold" style={{ color: 'var(--mit-text-muted)' }}>Coerência:</span>{' '}
              🟢 coerente (bate no eixo da página) · 🟡 serve (atrai, mas não é o eixo) · 🔴 sem correlação (LP errada/não mapeada)
            </p>
            <p>
              <span className="font-semibold" style={{ color: 'var(--mit-text-muted)' }}>LP:</span>{' '}
              <span style={{ color: 'var(--mit-success)' }}>●</span> live ·{' '}
              <span style={{ color: 'var(--mit-warning)' }}>●</span> legacy ·{' '}
              <span style={{ color: 'var(--mit-danger)' }}>●</span> não mapeada (adicionar a <code>lib/lp-mapping.ts</code>)
            </p>
          </div>
        </section>
      )}

      {/* Lightbox para preview do criativo */}
      {preview && (
        <CreativeLightbox
          src={preview.src}
          name={preview.name}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
