'use client'
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ChevronDown } from 'lucide-react'
import { DateRangePicker } from '@/components/DateRangePicker'
import { formatDateRange, type CustomRange } from '@/lib/date-utils'
import { FunnelSection } from '@/components/FunnelSection'
import { AdControlsSection } from '@/components/AdControlsSection'
import { CampaignControlsSection } from '@/components/CampaignControlsSection'
import { AdPerformanceSection } from '@/components/AdPerformanceSection'
import { TrendChart } from '@/components/TrendChart'
import { ClarityInsightsSection } from '@/components/ClarityInsightsSection'
import { LeadsSection } from '@/components/LeadsSection'
import { AdsSection } from '@/components/AdsSection'
import { GoalTracker } from '@/components/GoalTracker'
import { MetricsPulse } from '@/components/MetricsPulse'
import { FollowersSection } from '@/components/FollowersSection'
import { FunilAdAnalysis } from '@/components/FunilAdAnalysis'

const DATE_OPTIONS = [
  { label: 'Hoje',           value: 'today'    },
  { label: '7 dias',         value: 'last_7d'  },
  { label: '14 dias',        value: 'last_14d' },
  { label: '30 dias',        value: 'last_30d' },
  { label: 'Personalizado',  value: 'custom'   },
]

// Filtros de edição/produto. A `value` é o prefixo/tag usada no NOME da campanha
// no Meta (ex.: campanha "LANC1 [Vendas][Frio] - ..." casa com value 'LANC1').
// Troque pelos seus produtos/edições.
const TAG_OPTIONS = [
  { label: 'Todos',       value: ''      },
  { label: 'Lançamento 1', value: 'LANC1' },
  { label: 'Lançamento 2', value: 'LANC2' },
  { label: 'Perpétuo',    value: 'PERP'  },
]

interface CampaignTag { tag: string }
interface Campaign {
  id: string
  name: string
  objective: string
  effective_status: string
  tag: CampaignTag
}

// ─── Compact dropdown component ────────────────────────────────────────────────
function FilterDropdown({
  value,
  options,
  onChange,
  accentColor = 'var(--mit-accent)',
}: {
  value: string
  options: { label: string; value: string }[]
  onChange: (v: string) => void
  accentColor?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors duration-150 hover:opacity-80"
        style={{
          background: 'var(--mit-bg-card)',
          borderColor: open ? accentColor : 'var(--mit-border)',
          color: 'var(--mit-text-muted)',
        }}
      >
        <span className="font-medium" style={{ color: accentColor }}>{current.label}</span>
        <ChevronDown
          size={13}
          style={{
            color: 'var(--mit-text-subtle)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms',
          }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 left-0 rounded-lg border py-1 z-50 shadow-lg"
          style={{
            background: 'var(--mit-bg-card)',
            borderColor: 'var(--mit-border)',
            minWidth: '140px',
          }}
        >
          {options.map(opt => {
            const active = opt.value === value
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-white/5"
                style={{
                  color: active ? accentColor : 'var(--mit-text-muted)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const view = searchParams.get('view') ?? 'resumo'

  const [datePreset, setDatePreset] = useState('today')
  const [customRange, setCustomRange] = useState<CustomRange>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [tagFilter, setTagFilter]   = useState('')

  // Handle date preset change — "custom" opens picker, anything else clears custom range
  const handleDateChange = (v: string) => {
    if (v === 'custom') {
      setShowDatePicker(true)
    } else {
      setDatePreset(v)
      setCustomRange(null)
      setShowDatePicker(false)
    }
  }

  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => fetch('/api/campaigns').then(r => r.json()),
  })

  const campaigns: Campaign[] = campaignsData?.campaigns ?? []

  // Smart default: seleciona a primeira tag com campanha ativa
  const [defaultApplied, setDefaultApplied] = useState(false)
  useEffect(() => {
    if (!defaultApplied && campaigns.length > 0) {
      const ic3Active = campaigns.filter(c => c.effective_status === 'ACTIVE')
      if (ic3Active.length > 0) setTagFilter(ic3Active[0].tag.tag)
      setDefaultApplied(true)
    }
  }, [campaigns, defaultApplied])

  const filteredCampaigns = tagFilter
    ? campaigns.filter((c: Campaign) => c.tag.tag === tagFilter)
    : campaigns

  // Prioritize ACTIVE campaigns for funnel display
  const activeCampaigns = filteredCampaigns.filter(c => c.effective_status === 'ACTIVE')
  const selectedCampaign = activeCampaigns[0] ?? filteredCampaigns[0]
  const campaignId  = selectedCampaign?.id        ?? ''
  const objective   = selectedCampaign?.objective ?? 'OUTCOME_SALES'

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* ── Meta de ingressos (goal tracker) — oculto em Leads, Seguidores e Controle ── */}
      {view !== 'leads' && view !== 'seguidores' && view !== 'controle' && <GoalTracker datePreset={datePreset} customRange={customRange} />}

      {/* ── Filter bar — oculto em Leads (seletor próprio) e Seguidores (snapshot fixo) ── */}
      {view !== 'leads' && view !== 'seguidores' && <div className="flex items-center gap-3 relative">
        {/* Controle é sempre "agora": o gasto mostrado é o de hoje, não tem período a escolher */}
        {view !== 'controle' && <FilterDropdown
          value={datePreset}
          options={
            customRange
              ? DATE_OPTIONS.map(o => o.value === 'custom'
                  ? { ...o, label: formatDateRange(customRange.since, customRange.until) }
                  : o)
              : DATE_OPTIONS
          }
          onChange={handleDateChange}
          accentColor="var(--mit-accent)"
        />}
        {showDatePicker && view !== 'controle' && (
          <DateRangePicker
            initialRange={customRange ?? undefined}
            onApply={(since, until) => {
              setCustomRange({ since, until })
              setDatePreset('custom')
              setShowDatePicker(false)
            }}
            onCancel={() => {
              setShowDatePicker(false)
              if (!customRange) setDatePreset('today')
            }}
          />
        )}
        {/* Filtro de edição — oculto em Seguidores (tráfego é edição-agnóstico) */}
        {view !== 'seguidores' && <FilterDropdown
          value={tagFilter}
          options={TAG_OPTIONS}
          onChange={setTagFilter}
          accentColor="var(--mit-gold)"
        />}
      </div>}

      {/* ── RESUMO: full dashboard ── */}
      {view === 'resumo' && (
        <>
          <AdPerformanceSection datePreset={datePreset} tagFilter={tagFilter} customRange={customRange} />
          <FunilAdAnalysis part="origem" datePreset={datePreset} tagFilter={tagFilter} customRange={customRange} />
          <TrendChart datePreset={datePreset} tagFilter={tagFilter} customRange={customRange} />
          <FunnelSection objective={objective} datePreset={datePreset} tagFilter={tagFilter} customRange={customRange} />
        </>
      )}

      {/* ── FUNIL ── */}
      {view === 'funil' && (
        <>
          <FunnelSection objective={objective} datePreset={datePreset} tagFilter={tagFilter} customRange={customRange} />
          <FunilAdAnalysis part="metrics" datePreset={datePreset} tagFilter={tagFilter} customRange={customRange} />
          <MetricsPulse tagFilter={tagFilter} />
          {/* Saúde do Funil (Clarity) — logo abaixo da pulsão de métricas */}
          <ClarityInsightsSection />
          <FunilAdAnalysis part="ads" datePreset={datePreset} tagFilter={tagFilter} customRange={customRange} />
        </>
      )}

      {/* ── CONTROLE (remoto): campanha, conjunto e anúncio ── */}
      {view === 'controle' && (
        <>
          <CampaignControlsSection tagFilter={tagFilter} />
          <AdControlsSection tagFilter={tagFilter} />
        </>
      )}

      {/* ── ANÚNCIOS + KPIs + Controle de campanhas ── */}
      {view === 'anuncios' && (
        <>
          <AdPerformanceSection datePreset={datePreset} tagFilter={tagFilter} customRange={customRange} />
          <AdsSection datePreset={datePreset} tagFilter={tagFilter} customRange={customRange} />
          <AdControlsSection tagFilter={tagFilter} />
        </>
      )}

      {/* ── SEGUIDORES (tráfego para seguidores / distribuição) ── */}
      {view === 'seguidores' && (
        <FollowersSection />
      )}

      {/* ── LEADS (Instagram, Email, YouTube) ── */}
      {view === 'leads' && <LeadsSection />}
    </div>
  )
}

function EmptyFunnel({ loading }: { loading: boolean }) {
  return (
    <div
      className="rounded-xl border p-6 flex items-center justify-center min-h-[200px]"
      style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
    >
      <p className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>
        {loading ? 'Carregando campanhas…' : 'Selecione uma campanha para ver o funil'}
      </p>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}
