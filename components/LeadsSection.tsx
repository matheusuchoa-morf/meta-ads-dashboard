// components/LeadsSection.tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'motion/react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  Camera, Mail, MonitorPlay, Users, Eye, FileText,
  ChevronDown, ChevronUp, GitCompare, Play, Heart,
  MessageCircle, Bookmark, Share2, TrendingUp, Send, MousePointer,
} from 'lucide-react'
import { fmtNum, fmtPct } from '@/lib/formatters'

// ─── Types ──────────────────────────────────────────────────────────────────

interface IGProfile {
  username: string; followers_count: number; media_count: number; profile_picture_url: string
}
interface IGDailyInsight { date: string; followers: number; reach: number }
interface IGMediaPost {
  id: string; timestamp: string; media_type: string; caption: string
  like_count: number; comments_count: number; reach: number; saved: number; shares: number
}
interface IGData {
  profile: IGProfile
  dailyInsights: IGDailyInsight[]
  postsPerDay: Array<{ date: string; count: number }>
  recentPosts: IGMediaPost[]
}

interface ACCampaign {
  id: string; name: string; sendDate: string; sends: number
  opens: number; uniqueOpens: number; openRate: number
  clicks: number; uniqueClicks: number; clickRate: number
}
interface ACData {
  campaigns: ACCampaign[]
  summary: { totalSent: number; avgOpenRate: number; avgClickRate: number; campaignCount: number }
}

interface YTVideo {
  id: string; title: string; publishedAt: string; thumbnail: string
  duration: string; isShort: boolean
  views: number; likes: number; comments: number
  periodViews: number; avgWatchTime: number; avgWatchPct: number; subscribersGained: number
}
interface YTData {
  configured: boolean
  channel?: { subscriberCount: number; viewCount: number; videoCount: number }
  recentVideos?: YTVideo[]
  aggregates?: { totalViews: number; totalWatchTime: number; newSubscribers: number; avgViewDuration: number }
}

type SubTab = 'instagram' | 'email' | 'youtube'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(date: string) {
  const p = date.split('-')
  return `${p[2]}/${p[1]}`
}

function formatBRT(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function rateColor(rate: number, thresholds: [number, number]) {
  if (rate >= thresholds[1]) return 'var(--mit-success)'
  if (rate >= thresholds[0]) return 'var(--mit-warning)'
  return 'var(--mit-danger)'
}

function mediaIcon(type: string) {
  switch (type) {
    case 'VIDEO': return <Play size={14} />
    case 'CAROUSEL_ALBUM': return <FileText size={14} />
    default: return <Camera size={14} />
  }
}

// ─── Skeletons ──────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="rounded-xl border p-6 animate-pulse"
      style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
      <div className="h-4 w-40 rounded mb-1" style={{ background: 'var(--mit-bg-elevated)' }} />
      <div className="h-3 w-56 rounded mb-5" style={{ background: 'var(--mit-bg-elevated)' }} />
      <div className="h-52 rounded-lg" style={{ background: 'var(--mit-bg-elevated)' }} />
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border p-6 animate-pulse"
      style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
      <div className="h-3 w-24 rounded mb-4" style={{ background: 'var(--mit-bg-elevated)' }} />
      <div className="h-8 w-32 rounded" style={{ background: 'var(--mit-bg-elevated)' }} />
    </div>
  )
}

// ─── Tooltips ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FollowerTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const pt = payload[0]?.payload as IGDailyInsight
  return (
    <div className="rounded-lg border p-3 text-xs shadow-xl"
      style={{ background: 'var(--mit-bg-elevated)', borderColor: 'var(--mit-border)', minWidth: 150 }}>
      <p className="mb-2 font-mono" style={{ color: 'var(--mit-text-subtle)' }}>{formatDate(label)}</p>
      <div className="flex justify-between gap-4 mb-1">
        <span style={{ color: 'var(--mit-text-subtle)' }}>Seguidores</span>
        <span className="font-mono font-bold" style={{ color: 'var(--mit-gold)' }}>
          {fmtNum(pt.followers)}
        </span>
      </div>
      <div className="flex justify-between gap-4 mb-1">
        <span style={{ color: 'var(--mit-text-subtle)' }}>Alcance</span>
        <span className="font-mono font-bold" style={{ color: 'var(--mit-accent)' }}>
          {fmtNum(pt.reach)}
        </span>
      </div>
    </div>
  )
}

// ─── Sub-tab: Instagram ─────────────────────────────────────────────────────

function InstagramTab({ days }: { days: number }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)

  const { data, isLoading } = useQuery<IGData>({
    queryKey: ['instagram-data', days],
    queryFn: () => fetch(`/api/instagram?days=${days}`).then(r => r.json()),
    refetchInterval: 5 * 60_000,
  })

  if (isLoading) return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      <ChartSkeleton />
    </div>
  )

  if (!data?.profile) return (
    <div className="rounded-xl border p-6 flex items-center justify-center min-h-[200px]"
      style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
      <p className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>
        {(data as unknown as Record<string, unknown>)?.error ? String((data as unknown as Record<string, unknown>).error) : 'Sem dados do Instagram'}
      </p>
    </div>
  )

  const { profile, dailyInsights, postsPerDay, recentPosts } = data
  const totalReach = dailyInsights.reduce((s, d) => s + d.reach, 0)
  const totalPosts = postsPerDay.reduce((s, d) => s + d.count, 0)

  const toggleExpand = (id: string) => {
    const next = new Set(expanded)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpanded(next)
  }

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  const compareA = recentPosts.find(p => p.id === compareIds[0])
  const compareB = recentPosts.find(p => p.id === compareIds[1])

  return (
    <div className="space-y-5">
      {/* Hero cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          { label: 'Seguidores', value: fmtNum(profile.followers_count), icon: Users, color: 'var(--mit-gold)' },
          { label: `Alcance (${days}d)`, value: fmtNum(totalReach), icon: Eye, color: 'var(--mit-accent)' },
          { label: `Posts (${days}d)`, value: String(totalPosts), icon: FileText, color: 'var(--mit-success)' },
        ] as const).map((def, i) => {
          const Icon = def.icon
          return (
            <motion.div key={def.label}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4, ease: 'easeOut' }}
              className="relative rounded-xl border overflow-hidden p-6"
              style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
              <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: `linear-gradient(90deg, ${def.color}, transparent 70%)` }} />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium tracking-widest uppercase mb-4"
                    style={{ color: 'var(--mit-text-subtle)' }}>{def.label}</p>
                  <p className="text-4xl font-bold font-mono leading-none" style={{ color: def.color }}>
                    {def.value}
                  </p>
                </div>
                <div className="p-3 rounded-xl shrink-0" style={{ background: def.color + '18' }}>
                  <Icon size={22} style={{ color: def.color }} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Chart: Follower growth */}
      {dailyInsights.length > 0 && (
        <section className="rounded-xl border p-6"
          style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--mit-gold)' }}>
            Crescimento de Seguidores
          </h2>
          <p className="text-xs mt-0.5 mb-5" style={{ color: 'var(--mit-text-subtle)' }}>
            Contagem diária no período
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyInsights} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="followerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A45A" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#C9A45A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(201,164,90,0.06)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate}
                tick={{ fontSize: 10, fill: 'var(--mit-text-subtle)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--mit-text-subtle)' }}
                axisLine={false} tickLine={false} width={50}
                tickFormatter={(v: number) => fmtNum(v)} domain={['dataMin - 10', 'dataMax + 10']} />
              <Tooltip content={<FollowerTooltip />} cursor={{ stroke: 'rgba(201,164,90,0.2)', strokeWidth: 1 }} />
              <Area dataKey="followers" type="monotone" stroke="#C9A45A" strokeWidth={2}
                fill="url(#followerGrad)" dot={{ r: 3, fill: '#C9A45A', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#C9A45A', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Chart: Posts per day */}
      {postsPerDay.length > 0 && (
        <section className="rounded-xl border p-6"
          style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--mit-gold)' }}>
            Posts por Dia
          </h2>
          <p className="text-xs mt-0.5 mb-5" style={{ color: 'var(--mit-text-subtle)' }}>
            Quantidade de publicações diárias
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={postsPerDay} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="rgba(201,164,90,0.06)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate}
                tick={{ fontSize: 10, fill: 'var(--mit-text-subtle)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--mit-text-subtle)' }}
                axisLine={false} tickLine={false} allowDecimals={false} width={30} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="rounded-lg border p-3 text-xs shadow-xl"
                      style={{ background: 'var(--mit-bg-elevated)', borderColor: 'var(--mit-border)' }}>
                      <p className="mb-1 font-mono" style={{ color: 'var(--mit-text-subtle)' }}>{formatDate(label)}</p>
                      <span className="font-mono font-bold" style={{ color: 'var(--mit-accent)' }}>
                        {payload[0].value} post{payload[0].value !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )
                }}
                cursor={{ fill: 'rgba(201,164,90,0.04)' }} />
              <Bar dataKey="count" fill="var(--mit-accent)" radius={[4, 4, 0, 0]} opacity={0.85} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Posts table with toggle */}
      {recentPosts.length > 0 && (
        <section className="rounded-xl border overflow-hidden"
          style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
          <div className="p-6 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--mit-gold)' }}>
                Posts Recentes
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>
                Clique para expandir detalhes · Selecione 2 para comparar
              </p>
            </div>
            {compareIds.length === 2 && (
              <button onClick={() => setShowCompare(!showCompare)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                style={{ background: 'rgba(201,164,90,0.15)', color: 'var(--mit-gold)' }}>
                <GitCompare size={14} /> Comparar
              </button>
            )}
          </div>

          {/* Compare panel */}
          <AnimatePresence>
            {showCompare && compareA && compareB && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="px-6 pb-4 grid grid-cols-2 gap-3">
                  {[compareA, compareB].map((post) => (
                    <div key={post.id} className="rounded-lg border p-4"
                      style={{ background: 'var(--mit-bg-elevated)', borderColor: 'var(--mit-border)' }}>
                      <p className="text-xs font-mono mb-3" style={{ color: 'var(--mit-text-subtle)' }}>
                        {new Date(post.timestamp).toLocaleDateString('pt-BR')} · {post.media_type}
                      </p>
                      <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--mit-text-muted)' }}>
                        {post.caption || '(sem legenda)'}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { icon: Heart, label: 'Curtidas', value: post.like_count, color: '#e57373' },
                          { icon: MessageCircle, label: 'Comentários', value: post.comments_count, color: 'var(--mit-accent)' },
                          { icon: Eye, label: 'Alcance', value: post.reach, color: 'var(--mit-gold)' },
                          { icon: Bookmark, label: 'Salvos', value: post.saved, color: 'var(--mit-success)' },
                          { icon: Share2, label: 'Compartilh.', value: post.shares, color: '#CE93D8' },
                        ] as const).map(m => {
                          const Icon = m.icon
                          return (
                            <div key={m.label} className="flex items-center gap-1.5">
                              <Icon size={12} style={{ color: m.color }} />
                              <span className="text-xs font-mono" style={{ color: m.color }}>{fmtNum(m.value)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--mit-border)' }}>
                  <th className="px-6 py-3 text-left" style={{ color: 'var(--mit-text-subtle)' }}>
                    <input type="checkbox" className="hidden" />
                  </th>
                  <th className="px-3 py-3 text-left font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Tipo</th>
                  <th className="px-3 py-3 text-left font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Publicação (BRT)</th>
                  <th className="px-3 py-3 text-right font-medium" style={{ color: 'var(--mit-text-subtle)' }}>
                    <Heart size={12} className="inline" /> Curtidas
                  </th>
                  <th className="px-3 py-3 text-right font-medium hidden sm:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>
                    <MessageCircle size={12} className="inline" /> Coment.
                  </th>
                  <th className="px-3 py-3 text-right font-medium hidden md:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>
                    <Eye size={12} className="inline" /> Alcance
                  </th>
                  <th className="px-3 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {recentPosts.map((post) => {
                  const isExpanded = expanded.has(post.id)
                  const isSelected = compareIds.includes(post.id)
                  return (
                    <motion.tr key={post.id} layout
                      style={{
                        borderBottom: '1px solid var(--mit-border)',
                        background: isSelected ? 'rgba(201,164,90,0.06)' : 'transparent',
                      }}>
                      <td className="px-6 py-3">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleCompare(post.id)}
                          className="cursor-pointer accent-[#C9A45A]" />
                      </td>
                      <td className="px-3 py-3" style={{ color: 'var(--mit-text-muted)' }}>
                        <div className="flex items-center gap-1.5">
                          {mediaIcon(post.media_type)}
                          <span className="text-[10px]">{post.media_type.replace('CAROUSEL_ALBUM', 'CARROSSEL')}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono" style={{ color: 'var(--mit-text)' }}>
                        {formatBRT(post.timestamp)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono" style={{ color: '#e57373' }}>
                        {fmtNum(post.like_count)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono hidden sm:table-cell" style={{ color: 'var(--mit-accent)' }}>
                        {fmtNum(post.comments_count)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono hidden md:table-cell" style={{ color: 'var(--mit-gold)' }}>
                        {fmtNum(post.reach)}
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={() => toggleExpand(post.id)}
                          className="cursor-pointer p-1 rounded transition-colors"
                          style={{ color: 'var(--mit-text-subtle)' }}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </td>
                      {/* Expanded row is handled below via a separate table row */}
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
            {/* Expanded details — rendered as separate divs to avoid table layout issues */}
            {recentPosts.filter(p => expanded.has(p.id)).map(post => (
              <div key={`exp-${post.id}`} className="px-6 py-3 border-b"
                style={{ borderColor: 'var(--mit-border)', background: 'var(--mit-bg-elevated)' }}>
                <p className="text-xs mb-2 line-clamp-3" style={{ color: 'var(--mit-text-muted)' }}>
                  {post.caption || '(sem legenda)'}
                </p>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <Bookmark size={12} style={{ color: 'var(--mit-success)' }} />
                    <span className="font-mono" style={{ color: 'var(--mit-success)' }}>{post.saved} salvos</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Share2 size={12} style={{ color: '#CE93D8' }} />
                    <span className="font-mono" style={{ color: '#CE93D8' }}>{post.shares} compartilh.</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye size={12} style={{ color: 'var(--mit-gold)' }} />
                    <span className="font-mono" style={{ color: 'var(--mit-gold)' }}>{fmtNum(post.reach)} alcance</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Sub-tab: Email (ActiveCampaign) ────────────────────────────────────────

function EmailTab({ days }: { days: number }) {
  const { data, isLoading } = useQuery<ACData>({
    queryKey: ['email-campaigns', days],
    queryFn: () => fetch(`/api/email-campaigns?days=${days}`).then(r => r.json()),
    refetchInterval: 10 * 60_000,
  })

  if (isLoading) return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
      <ChartSkeleton />
    </div>
  )

  if (!data?.campaigns) return (
    <div className="rounded-xl border p-6 flex items-center justify-center min-h-[200px]"
      style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
      <p className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>
        {(data as unknown as Record<string, unknown>)?.error ? String((data as unknown as Record<string, unknown>).error) : 'Sem dados de e-mail'}
      </p>
    </div>
  )

  const { campaigns, summary } = data

  return (
    <div className="space-y-5">
      {/* Hero cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          { label: 'Emails Enviados', value: fmtNum(summary.totalSent), icon: Send, color: 'var(--mit-accent)' },
          {
            label: 'Taxa Abertura Média',
            value: fmtPct(summary.avgOpenRate, 1),
            icon: Eye,
            color: rateColor(summary.avgOpenRate, [10, 20]),
          },
          {
            label: 'Taxa Cliques Média',
            value: fmtPct(summary.avgClickRate, 1),
            icon: MousePointer,
            color: rateColor(summary.avgClickRate, [2, 5]),
          },
        ] as const).map((def, i) => {
          const Icon = def.icon
          return (
            <motion.div key={def.label}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4, ease: 'easeOut' }}
              className="relative rounded-xl border overflow-hidden p-6"
              style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
              <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: `linear-gradient(90deg, ${def.color}, transparent 70%)` }} />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium tracking-widest uppercase mb-4"
                    style={{ color: 'var(--mit-text-subtle)' }}>{def.label}</p>
                  <p className="text-4xl font-bold font-mono leading-none" style={{ color: def.color }}>
                    {def.value}
                  </p>
                </div>
                <div className="p-3 rounded-xl shrink-0" style={{ background: def.color + '18' }}>
                  <Icon size={22} style={{ color: def.color }} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Campaigns table */}
      <section className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
        <div className="p-6 pb-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--mit-gold)' }}>
            Campanhas Enviadas
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>
            {summary.campaignCount} campanhas · Ordenadas por data de envio
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--mit-border)' }}>
                <th className="px-6 py-3 text-left font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Nome</th>
                <th className="px-3 py-3 text-left font-medium hidden sm:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>Envio (BRT)</th>
                <th className="px-3 py-3 text-right font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Envios</th>
                <th className="px-3 py-3 text-right font-medium hidden md:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>Aberturas</th>
                <th className="px-3 py-3 text-right font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Taxa Abertura</th>
                <th className="px-3 py-3 text-right font-medium hidden md:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>Cliques</th>
                <th className="px-3 py-3 text-right font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Taxa Cliques</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="transition-colors hover:brightness-110"
                  style={{ borderBottom: '1px solid var(--mit-border)' }}>
                  <td className="px-6 py-3 max-w-[200px] truncate" style={{ color: 'var(--mit-text)' }}>
                    {c.name}
                  </td>
                  <td className="px-3 py-3 font-mono hidden sm:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>
                    {c.sendDate ? formatBRT(c.sendDate) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-mono" style={{ color: 'var(--mit-text)' }}>
                    {fmtNum(c.sends)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono hidden md:table-cell" style={{ color: 'var(--mit-text-muted)' }}>
                    {fmtNum(c.uniqueOpens)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold"
                    style={{ color: rateColor(c.openRate, [10, 20]) }}>
                    {fmtPct(c.openRate, 1)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono hidden md:table-cell" style={{ color: 'var(--mit-text-muted)' }}>
                    {fmtNum(c.uniqueClicks)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold"
                    style={{ color: rateColor(c.clickRate, [2, 5]) }}>
                    {fmtPct(c.clickRate, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

// ─── Sub-tab: YouTube ───────────────────────────────────────────────────────

type VideoFilter = 'all' | 'long' | 'short'

function YouTubeTab({ days }: { days: number }) {
  const [videoFilter, setVideoFilter] = useState<VideoFilter>('all')

  const { data, isLoading } = useQuery<YTData>({
    queryKey: ['youtube-data', days],
    queryFn: () => fetch(`/api/youtube?days=${days}`).then(r => r.json()),
    refetchInterval: 10 * 60_000,
  })

  if (isLoading) return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
    </div>
  )

  // Not configured — show connect button
  if (!data?.configured) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="rounded-xl border p-12 flex flex-col items-center justify-center min-h-[300px]"
        style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
        <div className="p-5 rounded-2xl mb-6" style={{ background: 'rgba(229,57,53,0.12)' }}>
          <MonitorPlay size={40} style={{ color: '#E53935' }} />
        </div>
        <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--mit-gold)' }}>
          Conectar YouTube
        </h3>
        <p className="text-sm text-center max-w-md mb-6" style={{ color: 'var(--mit-text-subtle)' }}>
          Autorize o acesso ao canal para visualizar inscritos, vídeos e analytics.
        </p>
        <a href="/api/youtube/auth"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 hover:opacity-85"
          style={{ background: '#E53935', color: '#fff' }}>
          <MonitorPlay size={16} />
          Conectar com Google
        </a>
      </motion.div>
    )
  }

  // Configured — show real data
  const { channel, recentVideos, aggregates } = data

  return (
    <div className="space-y-5">
      {/* Hero cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          { label: 'Inscritos', value: fmtNum(channel?.subscriberCount ?? 0), icon: Users, color: '#E53935' },
          { label: 'Views Totais', value: fmtNum(channel?.viewCount ?? 0), icon: Eye, color: 'var(--mit-accent)' },
          { label: 'Vídeos', value: String(channel?.videoCount ?? 0), icon: Play, color: 'var(--mit-gold)' },
        ] as const).map((def, i) => {
          const Icon = def.icon
          return (
            <motion.div key={def.label}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4, ease: 'easeOut' }}
              className="relative rounded-xl border overflow-hidden p-6"
              style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
              <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: `linear-gradient(90deg, ${def.color}, transparent 70%)` }} />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium tracking-widest uppercase mb-4"
                    style={{ color: 'var(--mit-text-subtle)' }}>{def.label}</p>
                  <p className="text-4xl font-bold font-mono leading-none" style={{ color: def.color }}>
                    {def.value}
                  </p>
                </div>
                <div className="p-3 rounded-xl shrink-0" style={{ background: def.color + '18' }}>
                  <Icon size={22} style={{ color: def.color }} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Period aggregates */}
      {aggregates && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { label: `Views (${days}d)`, value: fmtNum(aggregates.totalViews), color: '#E53935' },
            { label: `Inscritos (${days}d)`, value: `+${fmtNum(aggregates.newSubscribers)}`, color: 'var(--mit-gold)' },
            { label: 'Watch Time (h)', value: fmtNum(Math.round(aggregates.totalWatchTime / 60)), color: 'var(--mit-accent)' },
            { label: 'Duração Média', value: `${Math.round(aggregates.avgViewDuration)}s`, color: 'var(--mit-text-subtle)' },
          ]).map((def, i) => (
            <motion.div key={def.label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className="rounded-xl border p-4"
              style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--mit-text-subtle)' }}>{def.label}</p>
              <p className="text-2xl font-bold font-mono" style={{ color: def.color }}>{def.value}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Video filter sub-tabs */}
      {recentVideos && recentVideos.length > 0 && (() => {
        const shorts = recentVideos.filter(v => v.isShort)
        const longs  = recentVideos.filter(v => !v.isShort)
        const filtered = videoFilter === 'short' ? shorts : videoFilter === 'long' ? longs : recentVideos

        const VIDEO_FILTERS: { key: VideoFilter; label: string; count: number }[] = [
          { key: 'all',   label: 'Todos',  count: recentVideos.length },
          { key: 'long',  label: '🎬 Longos', count: longs.length },
          { key: 'short', label: '⚡ Shorts', count: shorts.length },
        ]

        return (
          <div className="space-y-4">
            {/* Sub-tab buttons */}
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--mit-bg-elevated)', width: 'fit-content' }}>
              {VIDEO_FILTERS.map(f => (
                <button key={f.key} onClick={() => setVideoFilter(f.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer"
                  style={{
                    background: videoFilter === f.key ? 'rgba(201,164,90,0.15)' : 'transparent',
                    color: videoFilter === f.key ? 'var(--mit-gold)' : 'var(--mit-text-subtle)',
                  }}>
                  {f.label}
                  <span className="font-mono text-[10px] opacity-70">{f.count}</span>
                </button>
              ))}
            </div>

            {/* Table */}
            {filtered.length > 0 ? (
              <section className="rounded-xl border overflow-hidden"
                style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--mit-border)' }}>
                        <th className="px-4 py-3 w-20 hidden sm:table-cell" />
                        <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Título</th>
                        <th className="px-3 py-3 text-left font-medium hidden lg:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>Publicação (BRT)</th>
                        <th className="px-3 py-3 text-center font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Views</th>
                        <th className="px-3 py-3 text-center font-medium hidden sm:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>Inscritos</th>
                        <th className="px-3 py-3 text-center font-medium hidden sm:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>% Assistida</th>
                        <th className="px-3 py-3 text-center font-medium hidden md:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>Média assistida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((v) => (
                        <tr key={v.id} className="transition-colors hover:brightness-110"
                          style={{ borderBottom: '1px solid var(--mit-border)' }}>
                          <td className="px-4 py-2 hidden sm:table-cell">
                            {v.thumbnail ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={v.thumbnail} alt="" className="w-20 h-11 object-cover rounded-md"
                                style={{ border: '1px solid var(--mit-border)' }} />
                            ) : (
                              <div className="w-20 h-11 rounded-md flex items-center justify-center"
                                style={{ background: 'var(--mit-bg-elevated)' }}>
                                <MonitorPlay size={16} style={{ color: 'var(--mit-text-subtle)' }} />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-[200px]" style={{ color: 'var(--mit-text)' }}>
                            <span className="line-clamp-2 leading-snug">{v.title}</span>
                          </td>
                          <td className="px-3 py-3 font-mono hidden lg:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>
                            {formatBRT(v.publishedAt)}
                          </td>
                          <td className="px-3 py-3 text-center font-mono font-bold" style={{ color: '#E53935' }}>
                            {fmtNum(v.views)}
                          </td>
                          <td className="px-3 py-3 text-center font-mono hidden sm:table-cell"
                            style={{ color: v.subscribersGained > 0 ? 'var(--mit-success)' : 'var(--mit-text-subtle)' }}>
                            {v.subscribersGained > 0 ? `+${v.subscribersGained}` : '—'}
                          </td>
                          <td className="px-3 py-3 text-center font-mono hidden sm:table-cell"
                            style={{ color: v.avgWatchPct >= 40 ? 'var(--mit-success)' : v.avgWatchPct >= 20 ? 'var(--mit-warning)' : 'var(--mit-text-subtle)' }}>
                            {v.avgWatchPct > 0 ? `${v.avgWatchPct.toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-3 py-3 text-center font-mono hidden md:table-cell" style={{ color: 'var(--mit-gold)' }}>
                            {v.avgWatchTime >= 60
                              ? `${Math.floor(v.avgWatchTime / 60)}m${Math.round(v.avgWatchTime % 60)}s`
                              : v.avgWatchTime > 0 ? `${Math.round(v.avgWatchTime)}s` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <div className="rounded-xl border p-8 text-center text-xs"
                style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)', color: 'var(--mit-text-subtle)' }}>
                Nenhum vídeo nessa categoria no período
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

const SUB_TABS: Array<{ key: SubTab; label: string; icon: typeof Camera }> = [
  { key: 'instagram', label: 'Instagram', icon: Camera },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'youtube', label: 'YouTube', icon: MonitorPlay },
]

export function LeadsSection() {
  const [activeTab, setActiveTab] = useState<SubTab>('instagram')
  const [days, setDays] = useState(7)

  return (
    <div className="space-y-5">
      {/* Sub-tab buttons */}
      <div className="flex justify-center">
        <div className="flex items-center gap-1 p-1 rounded-2xl"
          style={{ background: 'var(--mit-bg-elevated)' }}>
          {SUB_TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer"
              style={{
                background: activeTab === key ? 'rgba(201,164,90,0.15)' : 'transparent',
                color: activeTab === key ? 'var(--mit-gold)' : 'var(--mit-text-subtle)',
              }}>
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Period toggle — all tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--mit-bg-elevated)', width: 'fit-content' }}>
        {([1, 7, 15, 30] as const).map(d => (
          <button key={d} onClick={() => setDays(d)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer"
            style={{
              background: days === d ? 'rgba(201,164,90,0.15)' : 'transparent',
              color: days === d ? 'var(--mit-gold)' : 'var(--mit-text-subtle)',
            }}>
            {d === 1 ? 'Hoje' : `${d}d`}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      {activeTab === 'instagram' && <InstagramTab days={days} />}
      {activeTab === 'email' && <EmailTab days={days} />}
      {activeTab === 'youtube' && <YouTubeTab days={days} />}
    </div>
  )
}
