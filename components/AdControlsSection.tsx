'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'motion/react'
import { ImageIcon, ZoomIn, X, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from './ConfirmModal'
import { classifyCampaign } from '@/lib/campaign-classifier'
import { sumActions, maxRoas, PURCHASE_PATTERNS, CHECKOUT_PATTERNS } from '@/lib/action-matchers'
import { fmtBRL } from '@/lib/formatters'

// "Ligado" = rodando OU indo pro ar (revisão). Ad recém-(re)ativado — ou que teve
// o creative trocado (ex: mudança de CTA) — fica em PENDING_REVIEW/IN_PROCESS por
// alguns minutos. Deve aparecer como ON (reflete a intenção), não OFF.
const ON_STATUSES = new Set(['ACTIVE', 'PENDING_REVIEW', 'IN_PROCESS'])

// ── Types ─────────────────────────────────────────────────────────────────────
// Lista anúncios INDIVIDUAIS (não campanhas). O foco é o CRIATIVO — thumbnail
// grande clicável + sinais de decisão (compras, ROAS) ao lado do toggle pausa
// rápida pelo celular.
interface AdRow {
  ad_id: string
  ad_name: string
  campaign_name?: string
  effective_status: string
  spend: string
  thumbnail: string | null
  metaLink: string
  actions?: { action_type: string; value: string }[]
  purchase_roas?: { action_type: string; value: string }[]
}

interface PendingAction {
  id: string
  name: string
  spend: number
  status: 'ACTIVE' | 'PAUSED'
}

// ── Lightbox (preview do criativo) ─────────────────────────────────────────────
function CreativeLightbox({
  src, name, onClose,
}: {
  src: string; name: string; onClose: () => void
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
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative max-w-md w-full rounded-xl overflow-hidden shadow-2xl border"
          style={{ borderColor: 'var(--mit-border)', background: 'var(--mit-bg-card)' }}
          onClick={e => e.stopPropagation()}
        >
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

// ── Thumbnail ─────────────────────────────────────────────────────────────────
function CreativeThumb({
  src, name, onClick, size = 44,
}: {
  src: string | null; name: string; onClick?: () => void; size?: number
}) {
  if (src) {
    return (
      <button
        onClick={onClick}
        className="relative rounded-lg shrink-0 border group cursor-pointer overflow-hidden"
        style={{ width: size, height: size, borderColor: 'var(--mit-border)' }}
        title="Ver criativo"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} className="w-full h-full object-cover" />
        <span className="absolute inset-0 bg-black/55 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <ZoomIn size={14} className="text-white" />
        </span>
      </button>
    )
  }
  return (
    <div
      className="rounded-lg shrink-0 flex items-center justify-center border"
      style={{
        width: size, height: size,
        background: 'var(--mit-bg-elevated)',
        borderColor: 'var(--mit-border)',
      }}
    >
      <ImageIcon size={16} style={{ color: 'var(--mit-text-subtle)' }} />
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function StatusToggle({
  active, disabled, onClick,
}: {
  active: boolean; disabled: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={active ? 'Pausar anúncio' : 'Ativar anúncio'}
      className="relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 focus:outline-none focus-visible:ring-2 cursor-pointer"
      style={{
        background: active ? 'var(--mit-success)' : 'rgba(138,155,160,0.3)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        className="absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform duration-200"
        style={{
          transform: active ? 'translateX(20px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </button>
  )
}

// ── Decision hint (cor e label baseado em sinais) ─────────────────────────────
type Hint = { label: string; bg: string; color: string } | null
function getHint(spend: number, purchases: number, roas: number, isActive: boolean): Hint {
  if (!isActive) return null
  if (purchases >= 2 || roas >= 1.5) {
    return { label: '↑ ESCALAR', bg: 'rgba(76,175,130,0.15)', color: 'var(--mit-success)' }
  }
  if (purchases === 0 && spend >= 50) {
    return { label: '✕ PARAR', bg: 'rgba(229,62,62,0.15)', color: 'var(--mit-danger)' }
  }
  if (purchases === 0 && spend >= 30) {
    return { label: '~ ATENÇÃO', bg: 'rgba(240,180,41,0.15)', color: 'var(--mit-warning)' }
  }
  return null
}

// ── Main component ────────────────────────────────────────────────────────────
export function AdControlsSection({ tagFilter }: { tagFilter?: string }) {
  const qc = useQueryClient()
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null)

  // /api/ads já retorna effective_status, thumbnail, actions, purchase_roas
  const { data, isLoading } = useQuery({
    queryKey: ['ad-controls', tagFilter, 'live'],
    queryFn: () =>
      fetch(`/api/ads?datePreset=last_7d${tagFilter ? `&tagFilter=${tagFilter}` : ''}&includeActive=1`)
        .then(r => r.json()),
    refetchInterval: 30_000,
  })

  const mutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'ACTIVE' | 'PAUSED' }) => {
      const r = await fetch(`/api/ads/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${r.status}`)
      }
      return r.json()
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ad-controls'] })
      qc.invalidateQueries({ queryKey: ['ads'] })
      setPending(null)
      toast.success(vars.status === 'ACTIVE' ? 'Anúncio ativado' : 'Anúncio pausado')
    },
    onError: (err: Error) => {
      setPending(null)
      toast.error(`Erro ao atualizar anúncio: ${err.message}`)
    },
  })

  const ads: AdRow[] = data?.ads ?? []

  function handleToggle(ad: AdRow) {
    const spend = parseFloat(ad.spend ?? '0')
    const newStatus: 'ACTIVE' | 'PAUSED' = ON_STATUSES.has(ad.effective_status ?? '') ? 'PAUSED' : 'ACTIVE'
    // Confirmation só ao ATIVAR ad com >R$50 gastos em 7d (reativação séria).
    // Pause é one-click — esse é o ponto de mobile-friendly.
    if (newStatus === 'ACTIVE' && spend > 50) {
      setPending({ id: ad.ad_id, name: ad.ad_name, spend, status: newStatus })
    } else {
      mutation.mutate({ id: ad.ad_id, status: newStatus })
    }
  }

  function handleConfirm() {
    if (pending) mutation.mutate({ id: pending.id, status: pending.status })
  }

  if (isLoading) {
    return (
      <section
        className="rounded-xl border p-6 animate-pulse"
        style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
      >
        <div className="h-4 w-44 rounded mb-5" style={{ background: 'var(--mit-bg-elevated)' }} />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg mb-2" style={{ background: 'var(--mit-bg-elevated)' }} />
        ))}
      </section>
    )
  }

  // Ordena: ativos (incl. em revisão) primeiro, depois por spend desc
  const sorted = [...ads].sort((a, b) => {
    const aActive = ON_STATUSES.has(a.effective_status ?? '') ? 0 : 1
    const bActive = ON_STATUSES.has(b.effective_status ?? '') ? 0 : 1
    if (aActive !== bActive) return aActive - bActive
    return parseFloat(b.spend ?? '0') - parseFloat(a.spend ?? '0')
  })

  const activeCount = ads.filter(a => ON_STATUSES.has(a.effective_status ?? '')).length

  return (
    <>
      <section
        className="rounded-xl border p-6"
        style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--mit-gold)' }}>
              Controle de Anúncios
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>
              Toggle pausa o criativo individualmente · clique no thumb pra ver
            </p>
          </div>
          <span className="text-xs" style={{ color: 'var(--mit-text-subtle)' }}>
            {activeCount}/{ads.length} ativo{ads.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Stop-loss automático — roda no cron server-side (de hora em hora, 9–22h BRT),
            então pausa mesmo com você fora de casa. Thresholds em app/api/cron/route.ts. */}
        <div
          className="rounded-lg border px-3 py-2 mb-4 flex items-start gap-2 text-[11.5px] leading-relaxed"
          style={{ background: 'var(--mit-bg-elevated)', borderColor: 'var(--mit-border)', color: 'var(--mit-text-muted)' }}
        >
          <span>🛡️</span>
          <span>
            <b style={{ color: 'var(--mit-text)' }}>Stop-loss automático</b> — roda no servidor de hora em hora (9–22h), <b>mesmo com você fora de casa</b>:
            pausa o anúncio sem checkout no dia ao passar de <b style={{ color: 'var(--mit-accent)' }}>R$42</b> no Frio /
            <b style={{ color: 'var(--mit-accent)' }}> R$60</b> no Quente. Ad com ≥1 checkout é imune; avisa no alerta ao pausar.
            O toggle acima é pausa manual one-click (também funciona do celular).
          </span>
        </div>

        {ads.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>
            Nenhum anúncio encontrado{tagFilter ? ` para o filtro "${tagFilter}"` : ''}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr
                  className="text-left text-xs uppercase tracking-wider"
                  style={{ borderBottom: '1px solid var(--mit-border)' }}
                >
                  <th className="pb-2 pr-3 font-medium w-12" style={{ color: 'var(--mit-text-subtle)' }}>Ativo</th>
                  <th className="pb-2 pr-3 font-medium" style={{ color: 'var(--mit-text-subtle)' }}>Criativo</th>
                  <th className="pb-2 pr-3 font-medium hidden sm:table-cell w-16" style={{ color: 'var(--mit-text-subtle)' }}>Tag</th>
                  <th className="pb-2 pr-3 font-medium w-20" style={{ color: 'var(--mit-text-subtle)' }}>Gasto 7d</th>
                  <th className="pb-2 pr-3 font-medium w-12 hidden md:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>Cmp</th>
                  <th className="pb-2 pr-3 font-medium w-14 hidden md:table-cell" style={{ color: 'var(--mit-text-subtle)' }}>ROAS</th>
                  <th className="pb-2 font-medium w-20" style={{ color: 'var(--mit-text-subtle)' }}>Sinal</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((ad: AdRow) => {
                  const isActive   = ON_STATUSES.has(ad.effective_status ?? '')
                  const isMutating = mutation.isPending && mutation.variables?.id === ad.ad_id
                  const spend     = parseFloat(ad.spend ?? '0')
                  const tag       = classifyCampaign(ad.campaign_name ?? '')
                  const purchases = sumActions(ad.actions, PURCHASE_PATTERNS)
                  const checkouts = sumActions(ad.actions, CHECKOUT_PATTERNS)
                  const roas      = maxRoas(ad.purchase_roas)
                  const hint      = getHint(spend, purchases, roas, isActive)

                  return (
                    <tr
                      key={ad.ad_id}
                      className="transition-colors duration-150 hover:bg-white/[0.03]"
                      style={{
                        borderBottom: '1px solid var(--mit-border)',
                        opacity: isActive ? 1 : 0.55,
                      }}
                    >
                      {/* Toggle */}
                      <td className="py-3 pr-3 align-middle">
                        <StatusToggle
                          active={isActive}
                          disabled={isMutating}
                          onClick={() => handleToggle(ad)}
                        />
                      </td>

                      {/* Thumbnail + nome + campanha + meta link */}
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <CreativeThumb
                            src={ad.thumbnail}
                            name={ad.ad_name}
                            onClick={ad.thumbnail ? () => setPreview({ src: ad.thumbnail!, name: ad.ad_name }) : undefined}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="text-sm font-medium leading-tight truncate max-w-[180px] sm:max-w-[260px]"
                                style={{ color: 'var(--mit-text)' }}
                                title={ad.ad_name}
                              >
                                {ad.ad_name}
                              </span>
                              {ad.metaLink && (
                                <a
                                  href={ad.metaLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir no Meta"
                                  className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                                  style={{ color: 'var(--mit-text-subtle)' }}
                                >
                                  <ExternalLink size={11} />
                                </a>
                              )}
                            </div>
                            {ad.campaign_name && (
                              <span
                                className="text-[11px] block mt-0.5 truncate max-w-[200px] sm:max-w-[280px]"
                                style={{ color: 'var(--mit-text-subtle)' }}
                                title={ad.campaign_name}
                              >
                                {ad.campaign_name}
                              </span>
                            )}
                            {checkouts > 0 && (
                              <span
                                className="text-[10px] block mt-0.5"
                                style={{ color: 'var(--mit-warning)' }}
                              >
                                {checkouts} checkout{checkouts !== 1 ? 's' : ''}
                              </span>
                            )}
                            {isMutating && (
                              <span
                                className="text-[10px] animate-pulse mt-0.5 block"
                                style={{ color: 'var(--mit-text-subtle)' }}
                              >
                                Atualizando…
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tag (campaign-based) */}
                      <td className="py-3 pr-3 hidden sm:table-cell">
                        <Badge
                          className="text-xs"
                          style={{
                            background: tag.color + '22',
                            color: tag.color,
                            border: `1px solid ${tag.color}44`,
                          }}
                        >
                          {tag.tag}
                        </Badge>
                      </td>

                      {/* Spend 7d */}
                      <td className="py-3 pr-3">
                        <span
                          className="text-sm font-mono"
                          style={{ color: 'var(--mit-text-muted)' }}
                        >
                          {spend > 0 ? fmtBRL(spend) : '—'}
                        </span>
                      </td>

                      {/* Compras */}
                      <td className="py-3 pr-3 hidden md:table-cell">
                        {purchases > 0 ? (
                          <span
                            className="text-sm font-mono font-semibold"
                            style={{ color: 'var(--mit-success)' }}
                          >
                            {purchases}
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>—</span>
                        )}
                      </td>

                      {/* ROAS */}
                      <td className="py-3 pr-3 hidden md:table-cell">
                        {roas > 0 ? (
                          <span
                            className="text-sm font-mono font-semibold"
                            style={{
                              color:
                                roas >= 2.5  ? 'var(--mit-success)' :
                                roas >= 1.0  ? 'var(--mit-warning)' :
                                              'var(--mit-danger)',
                            }}
                          >
                            {roas.toFixed(2).replace('.', ',')}x
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>—</span>
                        )}
                      </td>

                      {/* Sinal de decisão */}
                      <td className="py-3">
                        {hint ? (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                            style={{ background: hint.bg, color: hint.color }}
                          >
                            {hint.label}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--mit-text-subtle)' }}>
                            {isActive ? '—' : '○ pausado'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {pending && (
        <ConfirmModal
          open={true}
          campaignName={pending.name}
          budget={Math.round(pending.spend * 100)}
          newStatus={pending.status}
          onConfirm={handleConfirm}
          onCancel={() => setPending(null)}
        />
      )}

      {preview && (
        <CreativeLightbox
          src={preview.src}
          name={preview.name}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  )
}
