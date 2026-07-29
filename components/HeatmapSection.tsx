// components/HeatmapSection.tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface Props {
  datePreset: string
  tagFilter: string
}

type MetricKey = 'spend' | 'roas' | 'ctr' | 'impressions'

const METRIC_OPTIONS: { value: MetricKey; label: string }[] = [
  { value: 'spend', label: 'Gasto' },
  { value: 'roas', label: 'ROAS' },
  { value: 'ctr', label: 'CTR' },
  { value: 'impressions', label: 'Impressões' },
]

function metricFormatter(metric: MetricKey, value: number): string {
  if (value === 0) return '—'
  switch (metric) {
    case 'spend': return `R$ ${value.toFixed(2)}`
    case 'roas': return `${value.toFixed(2)}x`
    case 'ctr': return `${value.toFixed(2)}%`
    case 'impressions': return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
  }
}

export function HeatmapSection({ datePreset, tagFilter }: Props) {
  const [metric, setMetric] = useState<MetricKey>('spend')

  const { data, isLoading, error } = useQuery({
    queryKey: ['heatmap', datePreset, tagFilter, metric],
    queryFn: () =>
      fetch(`/api/heatmap?datePreset=${datePreset}&tagFilter=${tagFilter}&metric=${metric}`)
        .then(r => r.json()),
    refetchInterval: 10 * 60 * 1000,
  })

  const series = data?.series ?? []

  // Flatten all values to compute the color range
  const allValues = series.flatMap((s: { data: { y: number }[] }) => s.data.map((d: { y: number }) => d.y)).filter((v: number) => v > 0)
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 1

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'heatmap',
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'JetBrains Mono, monospace',
      animations: { enabled: true, speed: 600 }
    },
    dataLabels: { enabled: false },
    stroke: { width: 2, colors: ['#1D1F26'] },
    colors: ['#D97757'],
    plotOptions: {
      heatmap: {
        radius: 4,
        enableShades: true,
        shadeIntensity: 0.85,
        colorScale: {
          ranges: [
            { from: 0, to: 0, color: '#252B2D', name: 'Sem dados' },
            { from: 0.001, to: maxVal * 0.25, color: '#3D4F52', name: 'Baixo' },
            { from: maxVal * 0.25, to: maxVal * 0.5, color: '#8A5A45', name: 'Médio' },
            { from: maxVal * 0.5, to: maxVal * 0.75, color: '#C4724D', name: 'Alto' },
            { from: maxVal * 0.75, to: maxVal, color: '#D97757', name: 'Pico' },
          ]
        }
      }
    },
    xaxis: {
      labels: {
        style: { colors: '#8A9BA0', fontSize: '11px', fontFamily: 'Gilroy, sans-serif' }
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: '#8A9BA0', fontSize: '11px', fontFamily: 'Gilroy, sans-serif' }
      }
    },
    grid: { show: false },
    legend: { show: false },
    tooltip: {
      theme: 'dark',
      style: { fontFamily: 'JetBrains Mono, monospace', fontSize: '11px' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      custom: ({ series: s, seriesIndex, dataPointIndex, w }: any) => {
        const val = s[seriesIndex][dataPointIndex]
        const weekName = w.globals.seriesNames[seriesIndex]
        const day = w.globals.labels[dataPointIndex]
        return `<div style="background:#252B2D;border:1px solid rgba(201,164,90,0.2);padding:8px 12px;border-radius:6px;font-size:11px;color:#EFEFEF">
          <div style="color:#8A9BA0;margin-bottom:4px">${weekName} · ${day}</div>
          <div style="font-weight:700;color:#D97757">${metricFormatter(metric, val)}</div>
        </div>`
      }
    },
    states: {
      hover: { filter: { type: 'lighten' } }
    }
  }

  return (
    <section className="rounded-xl border p-6"
      style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--mit-gold)' }}>
            Mapa de Calor
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--mit-text-subtle)' }}>
            Performance por dia da semana
          </p>
        </div>

        {/* Metric selector */}
        <div className="flex rounded-lg overflow-hidden border text-xs shrink-0"
          style={{ borderColor: 'var(--mit-border)' }}>
          {METRIC_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setMetric(opt.value)}
              className="px-3 py-1.5 transition-colors duration-150 cursor-pointer"
              style={{
                background: metric === opt.value ? 'var(--mit-accent)' : 'var(--mit-bg-elevated)',
                color: metric === opt.value ? '#fff' : 'var(--mit-text-subtle)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="animate-pulse space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 rounded" style={{ background: 'var(--mit-bg-elevated)' }} />
          ))}
        </div>
      )}

      {(error || data?.error) && (
        <p className="text-sm text-red-400">
          Erro ao carregar heatmap: {data?.error ?? String(error)}
        </p>
      )}

      {!isLoading && !error && series.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>
          Sem dados para o período selecionado.
        </p>
      )}

      {!isLoading && series.length > 0 && (
        <ApexChart
          type="heatmap"
          height={Math.max(series.length * 44 + 40, 180)}
          options={chartOptions}
          series={series}
        />
      )}

      {/* Legend */}
      {series.length > 0 && (
        <div className="flex items-center gap-3 mt-3 justify-center">
          {[
            { label: 'Baixo', color: '#3D4F52' },
            { label: 'Médio', color: '#8A5A45' },
            { label: 'Alto', color: '#C4724D' },
            { label: 'Pico', color: '#D97757' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
              <span className="text-xs" style={{ color: 'var(--mit-text-subtle)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
