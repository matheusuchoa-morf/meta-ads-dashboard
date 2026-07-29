'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, MousePointerClick, Activity, Gauge, RefreshCw, Wifi, MapPin } from 'lucide-react'
import { motion } from 'motion/react'
import { classifyPageHealth, type PageStatus } from '@/lib/clarity-health'
import type { ClarityPageMetrics } from '@/app/api/clarity/route'

// ─── Config ──────────────────────────────────────────────────────────────────
const PROJECT_ID = 'n1l3h80zd7'

interface PageSection {
  start: number  // % do início da seção (0–100)
  end: number    // % do fim da seção (0–100)
  label: string
}

// Seções mapeadas da sua LP (ajuste aos blocos da sua página)
const DEFAULT_SECTIONS: PageSection[] = [
  { start: 0,  end: 12, label: 'Hero' },
  { start: 12, end: 24, label: 'Problema' },
  { start: 24, end: 38, label: 'O que acontece' },
  { start: 38, end: 52, label: 'Especialista' },
  { start: 52, end: 68, label: 'Depoimentos' },
  { start: 68, end: 82, label: 'Oferta / Lote' },
  { start: 82, end: 92, label: 'Sorteio' },
  { start: 92, end: 100, label: 'FAQ + CTA' },
]

// Corpo da LP — compartilhado entre variações que só mudam o hero
// % MEDIDOS ao vivo na página real (offsetTop ÷ scrollHeight, 22/06): o preço fica em 62%
const BODY_SECTIONS: PageSection[] = [
  { start: 0,  end: 9,   label: 'Hero' },
  { start: 9,  end: 15,  label: 'Não programar' },
  { start: 15, end: 30,  label: 'Ecossistema' },
  { start: 30, end: 40,  label: 'Fazedoria' },
  { start: 40, end: 56,  label: 'Prova / depoimentos' },
  { start: 56, end: 62,  label: 'Autoridade' },
  { start: 62, end: 70,  label: 'Lotes / preço' },
  { start: 70, end: 76,  label: 'Sorteio' },
  { start: 76, end: 92,  label: 'Tudo acesso' },
  { start: 92, end: 100, label: 'Desafio' },
]

const PAGES = [
  {
    id: 'ic-48h',
    label: 'Página A',
    sublabel: 'LP ativa — para onde os anúncios apontam',
    url: 'https://your-domain.com/pagina-a/',
    sections: BODY_SECTIONS,
    trafficActive: true,
  },
  {
    id: 'ic-construcao',
    label: 'Página B',
    sublabel: 'Baseline — scroll médio 18%, 0 venda real. Tráfego migrado p/ 48h em 22/06',
    url: 'https://your-domain.com/pagina-b/',
    sections: BODY_SECTIONS,
    trafficActive: false,
  },
  {
    id: 'ic-junho',
    label: 'Página C',
    sublabel: 'LP original (Edição Copa) — referência histórica',
    url: 'https://your-domain.com/pagina-c/',
    sections: DEFAULT_SECTIONS,
    trafficActive: false,
  },
]

function clarityHeatmapUrl(pageUrl: string) {
  return (
    `https://clarity.microsoft.com/projects/id/${PROJECT_ID}/heatmaps` +
    `?pageFilter=${encodeURIComponent(pageUrl)}`
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  return `${Math.floor(hrs / 24)}d atrás`
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PageStatus | null }) {
  if (!status) return (
    <span className="text-xs px-2 py-0.5 rounded"
      style={{ background: 'rgba(138,155,160,0.12)', color: 'var(--mit-text-subtle)' }}>
      Sem dados
    </span>
  )
  const cfg = {
    ok: { label: 'OK', bg: 'rgba(76,175,130,0.15)', color: 'var(--mit-success)', border: 'rgba(76,175,130,0.3)' },
    atencao: { label: 'Atenção', bg: 'rgba(240,180,41,0.15)', color: 'var(--mit-warning)', border: 'rgba(240,180,41,0.3)' },
    critico: { label: 'Crítico', bg: 'rgba(229,62,62,0.15)', color: 'var(--mit-danger)', border: 'rgba(229,62,62,0.3)' },
  }[status]
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  )
}

// ─── Live indicator ───────────────────────────────────────────────────────────
function LiveBadge({ fetchedAt }: { fetchedAt?: string }) {
  if (!fetchedAt) return null
  return (
    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--mit-success)' }}>
      <Wifi size={10} />
      Ao vivo · {timeAgo(fetchedAt)}
    </span>
  )
}

// ─── Metric chip ─────────────────────────────────────────────────────────────
function Metric({ icon: Icon, label, value, unit = '%', live }: {
  icon: React.ElementType; label: string; value?: number; unit?: string; live?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5" style={{ color: 'var(--mit-text-subtle)' }}>
        <Icon size={11} />
        <span className="text-xs">{label}</span>
        {live && value !== undefined && (
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--mit-success)' }} />
        )}
      </div>
      <span className="text-lg font-bold font-mono" style={{ color: 'var(--mit-text-muted)' }}>
        {value !== undefined ? `${value}${unit}` : '—'}
      </span>
    </div>
  )
}

// ─── Scroll Depth Map ────────────────────────────────────────────────────────
// Mostra visualmente em qual seção da página o usuário médio para
function ScrollDepthMap({
  scrollDepth,
  sections,
}: {
  scrollDepth?: number
  sections: PageSection[]
}) {
  if (scrollDepth === undefined) return null

  // Encontra a seção onde a média para
  const currentSection = sections.find(
    s => scrollDepth >= s.start && scrollDepth < s.end
  ) ?? sections[sections.length - 1]

  return (
    <div className="mt-1 mb-3">
      {/* Label */}
      <div className="flex items-center gap-1.5 mb-2">
        <MapPin size={11} style={{ color: 'var(--mit-warning)' }} />
        <span className="text-xs" style={{ color: 'var(--mit-text-subtle)' }}>
          Média para em: <strong style={{ color: 'var(--mit-text)' }}>{currentSection.label}</strong>
          <span style={{ color: 'var(--mit-text-subtle)' }}> ({scrollDepth}%)</span>
        </span>
      </div>

      {/* Visual bar with sections */}
      <div className="relative w-full h-6 rounded-md overflow-hidden flex"
        style={{ background: 'var(--mit-bg-dark)' }}
      >
        {sections.map((section, i) => {
          const width = section.end - section.start
          const isReached = scrollDepth >= section.end
          const isCurrent = scrollDepth >= section.start && scrollDepth < section.end
          const partialFill = isCurrent
            ? ((scrollDepth - section.start) / (section.end - section.start)) * 100
            : 0

          return (
            <div
              key={i}
              className="relative h-full border-r"
              style={{
                width: `${width}%`,
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            >
              {/* Fill */}
              <div
                className="absolute inset-0"
                style={{
                  background: isReached
                    ? 'rgba(76,175,130,0.25)'
                    : isCurrent
                      ? `linear-gradient(90deg, rgba(240,180,41,0.3) ${partialFill}%, transparent ${partialFill}%)`
                      : 'transparent',
                }}
              />

              {/* Section label (only if wide enough) */}
              {width >= 14 && (
                <span
                  className="absolute inset-0 flex items-center justify-center text-[9px] font-medium truncate px-0.5"
                  style={{
                    color: isReached
                      ? 'var(--mit-success)'
                      : isCurrent
                        ? 'var(--mit-warning)'
                        : 'var(--mit-text-subtle)',
                    opacity: isReached || isCurrent ? 1 : 0.4,
                  }}
                >
                  {section.label}
                </span>
              )}
            </div>
          )
        })}

        {/* Marker line */}
        <div
          className="absolute top-0 bottom-0 w-0.5"
          style={{
            left: `${scrollDepth}%`,
            background: 'var(--mit-warning)',
            boxShadow: '0 0 6px rgba(240,180,41,0.5)',
          }}
        />
      </div>

      {/* Section legend */}
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--mit-success)' }}>
          <span className="w-2 h-2 rounded-sm" style={{ background: 'rgba(76,175,130,0.4)' }} />
          Viram
        </span>
        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--mit-warning)' }}>
          <span className="w-2 h-2 rounded-sm" style={{ background: 'rgba(240,180,41,0.4)' }} />
          Param aqui
        </span>
        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--mit-text-subtle)' }}>
          <span className="w-2 h-2 rounded-sm" style={{ background: 'rgba(138,155,160,0.15)' }} />
          Não chegam
        </span>
      </div>
    </div>
  )
}

// ─── Single page card ────────────────────────────────────────────────────────
function PageCard({
  page,
  liveMetrics,
  liveLoading,
}: {
  page: typeof PAGES[number]
  liveMetrics?: ClarityPageMetrics
  liveLoading: boolean
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const scrollDepth = liveMetrics?.scrollDepth
  const ragePct = liveMetrics?.ragePct
  const engagement = liveMetrics?.engagement
  const sessions = liveMetrics?.sessions

  const status = classifyPageHealth({ scrollDepth, ragePct, engagement })

  const accentColor =
    status === 'critico' ? 'var(--mit-danger)'
    : status === 'atencao' ? 'var(--mit-warning)'
    : status === 'ok' ? 'var(--mit-success)'
    : 'var(--mit-border)'

  if (!mounted) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
    >
      <div className="h-px" style={{ background: `linear-gradient(90deg, ${accentColor}, transparent 60%)` }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--mit-text)' }}>
                {page.label}
              </h3>
              <StatusBadge status={status} />
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>
              {page.sublabel}
              {sessions !== undefined && ` · ${sessions.toLocaleString('pt-BR')} sessões`}
            </p>
          </div>

          <a
            href={clarityHeatmapUrl(page.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 shrink-0 cursor-pointer"
            style={{
              background: 'rgba(217,119,87,0.12)',
              color: 'var(--mit-accent)',
              border: '1px solid rgba(217,119,87,0.25)',
            }}
          >
            Ver Heatmap
            <ExternalLink size={11} />
          </a>
        </div>

        {/* Metrics */}
        <div
          className="grid grid-cols-3 gap-4 mb-4 p-3 rounded-lg"
          style={{ background: 'var(--mit-bg-elevated)' }}
        >
          {liveLoading ? (
            <div className="col-span-3 flex items-center gap-2" style={{ color: 'var(--mit-text-subtle)' }}>
              <RefreshCw size={12} className="animate-spin" />
              <span className="text-xs">Buscando dados do Clarity…</span>
            </div>
          ) : (
            <>
              <Metric icon={Activity} label="Scroll" value={scrollDepth} live={!!liveMetrics} />
              <Metric icon={MousePointerClick} label="Rage" value={ragePct} live={!!liveMetrics} />
              <Metric icon={Gauge} label="Engaj." value={engagement} unit="" live={!!liveMetrics} />
            </>
          )}
        </div>

        {/* Scroll Depth Map */}
        <ScrollDepthMap scrollDepth={scrollDepth} sections={page.sections} />

        {/* Live timestamp */}
        {liveMetrics?.fetchedAt && (
          <div className="mb-3">
            <LiveBadge fetchedAt={liveMetrics.fetchedAt} />
          </div>
        )}

      </div>
    </motion.div>
  )
}

// ─── Section ─────────────────────────────────────────────────────────────────
export function ClarityInsightsSection() {
  const [visiblePages, setVisiblePages] = useState<Set<string>>(
    new Set(PAGES.filter(p => p.trafficActive).map(p => p.id))
  )

  const togglePage = (id: string) => {
    setVisiblePages(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const { data, isLoading, error, dataUpdatedAt, refetch, isFetching } = useQuery<
    Record<string, ClarityPageMetrics>
  >({
    queryKey: ['clarity-metrics'],
    queryFn: () => fetch('/api/clarity').then(r => r.json()),
    refetchInterval: 2 * 60 * 60 * 1000,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })

  const hasError = !!error || (data && 'error' in data)
  const errorMsg = (data as { error?: string })?.error ?? String(error)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--mit-gold)' }}>
            Landing Page
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>
            Comportamento ao vivo via Microsoft Clarity · Project {PROJECT_ID}
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-opacity disabled:opacity-40"
          style={{ border: '1px solid var(--mit-border)', color: 'var(--mit-text-subtle)' }}
        >
          <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} />
          {isFetching ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {/* API error */}
      {hasError && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ background: 'rgba(229,62,62,0.08)', borderColor: 'rgba(229,62,62,0.25)', color: 'var(--mit-danger)' }}
        >
          {errorMsg.includes('CLARITY_API_TOKEN') ? (
            <>
              <strong>Token não configurado.</strong> Gere um token em{' '}
              <a
                href={`https://clarity.microsoft.com/projects/id/${PROJECT_ID}/settings/data-export`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Settings → Data Export
              </a>{' '}
              e adicione como variável de ambiente <code>CLARITY_API_TOKEN</code>.
            </>
          ) : (
            <>Erro ao buscar dados do Clarity: {errorMsg}</>
          )}
        </div>
      )}

      {/* Page toggles */}
      <div className="flex flex-wrap gap-2">
        {PAGES.map(page => {
          const active = visiblePages.has(page.id)
          return (
            <button
              key={page.id}
              onClick={() => togglePage(page.id)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer"
              style={{
                background: active ? 'rgba(201,164,90,0.12)' : 'var(--mit-bg-elevated)',
                color: active ? 'var(--mit-gold)' : 'var(--mit-text-subtle)',
                border: `1px solid ${active ? 'rgba(201,164,90,0.3)' : 'var(--mit-border)'}`,
                opacity: active ? 1 : 0.6,
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{
                background: active
                  ? page.trafficActive ? 'var(--mit-success)' : 'var(--mit-gold)'
                  : 'var(--mit-text-subtle)',
              }} />
              {page.label}
              {page.trafficActive && (
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                  background: 'rgba(76,175,130,0.12)',
                  color: 'var(--mit-success)',
                }}>
                  Tráfego
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PAGES.filter(p => visiblePages.has(p.id)).map(page => (
          <PageCard
            key={page.id}
            page={page}
            liveMetrics={!hasError ? data?.[page.url] : undefined}
            liveLoading={isLoading}
          />
        ))}
      </div>

      {/* Footer info */}
      {dataUpdatedAt > 0 && !hasError && (
        <p className="text-xs text-center" style={{ color: 'var(--mit-text-subtle)' }}>
          Dados atualizados a cada 2h · cache alinhado com limite de 10 req/dia da Clarity API
          {' · '}última busca: {timeAgo(new Date(dataUpdatedAt).toISOString())}
        </p>
      )}
    </div>
  )
}
