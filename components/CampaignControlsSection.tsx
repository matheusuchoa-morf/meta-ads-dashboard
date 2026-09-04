'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, ExternalLink, Pencil, Check, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ConfirmModal } from './ConfirmModal'
import { StatusToggle } from './StatusToggle'
import { fmtBRL } from '@/lib/formatters'

// ─────────────────────────────────────────────────────────────────────────────
// Controle remoto: ligar/desligar e mexer no orçamento de CAMPANHA e CONJUNTO
// direto do celular. O controle de ANÚNCIO (criativo) fica em AdControlsSection.
//
// Detalhe que mais confunde: o toggle reflete o `status` do próprio objeto, não
// o `effective_status`. Um conjunto ACTIVE dentro de campanha pausada tem
// effective_status = CAMPAIGN_PAUSED — ligar ele de novo não faria nada. Então
// o toggle mostra a intenção daquele nível, e a herança vira um aviso ao lado.
// ─────────────────────────────────────────────────────────────────────────────

type Status = 'ACTIVE' | 'PAUSED'

interface Tag { tag: string; label: string; color: string }

interface CampaignRow {
  id: string
  name: string
  objective: string
  status: string
  effective_status: string
  daily_budget: string | null
  lifetime_budget: string | null
  tag: Tag
  spend: number
  metaLink: string
}

interface AdSetRow {
  id: string
  name: string
  status: string
  effective_status: string
  daily_budget: string | null
  lifetime_budget: string | null
  spend: number
}

type Level = 'campaigns' | 'adsets'

// Confirmação assimétrica: subir >20% queima dinheiro, então confirma cedo.
// Cortar é mais seguro, mas um corte de 500 → 5 (dedo gordo) mata a entrega —
// então corte acima da metade também pede confirmação.
const BUDGET_CONFIRM_UP = 1.2
const BUDGET_CONFIRM_DOWN = 0.5

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Texto digitado → centavos. É dinheiro real, então a ambiguidade do ponto
 * precisa ser resolvida do jeito brasileiro:
 *   "150,00" / "1.500,00" → vírgula é decimal, ponto é milhar
 *   "1.500"               → ponto seguido de EXATAMENTE 3 dígitos é milhar → 1500
 *   "150.50" / "150.5"    → ponto seguido de 1-2 dígitos é decimal
 * Sem a regra dos 3 dígitos, quem digita "1.500" pedindo mil e quinhentos
 * receberia R$ 1,50 — erro de 1000x no orçamento.
 */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[^\d.,]/g, '')
  if (!cleaned) return null

  let normalized: string
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '')
  } else {
    normalized = cleaned
  }

  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100)
}

function centsToInput(cents: string | null): string {
  if (!cents) return ''
  return (Number(cents) / 100).toFixed(2).replace('.', ',')
}

/** Aviso quando o estado real difere da intenção daquele nível. */
function inheritedNote(status: string, effective: string): string | null {
  if (status !== 'ACTIVE') return null
  if (effective === 'CAMPAIGN_PAUSED') return 'pausado pela campanha'
  if (effective === 'ADSET_PAUSED') return 'pausado pelo conjunto'
  if (effective === 'PENDING_REVIEW' || effective === 'IN_PROCESS') return 'em revisão'
  if (effective === 'WITH_ISSUES') return 'com problema na Meta'
  return null
}

async function patchJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
  return data as { ok: true; demo?: boolean }
}

function okToast(message: string, demo?: boolean) {
  toast.success(demo ? `${message} (modo demo — nada foi enviado à Meta)` : message)
}

// ─── Editor de orçamento ─────────────────────────────────────────────────────

function BudgetEditor({
  level, id, name, dailyBudget, lifetimeBudget, onSaved,
}: {
  level: Level
  id: string
  name: string
  dailyBudget: string | null
  lifetimeBudget: string | null
  onSaved: () => void
}) {
  const isLifetime = !dailyBudget && !!lifetimeBudget
  const currentCents = Number(dailyBudget ?? lifetimeBudget ?? 0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => centsToInput(dailyBudget ?? lifetimeBudget))
  const [confirming, setConfirming] = useState<number | null>(null)

  const mutation = useMutation({
    mutationFn: (cents: number) =>
      patchJSON(`/api/${level}/${id}/budget`, isLifetime
        ? { lifetimeBudgetCents: cents }
        : { dailyBudgetCents: cents }),
    onSuccess: (data, cents) => {
      setEditing(false)
      setConfirming(null)
      okToast(`Orçamento ${isLifetime ? 'total' : 'diário'} → ${fmtBRL(cents / 100)}`, data?.demo)
      onSaved()
    },
    onError: (err: Error) => {
      setConfirming(null)
      toast.error(`Não deu pra mudar o orçamento: ${err.message}`)
    },
  })

  function submit() {
    const cents = parseBRLToCents(draft)
    if (cents === null) {
      toast.error('Valor inválido. Use algo como 150 ou 150,00.')
      return
    }
    if (cents === currentCents) {
      setEditing(false)
      return
    }
    const bigJump =
      currentCents > 0 &&
      (cents > currentCents * BUDGET_CONFIRM_UP || cents < currentCents * BUDGET_CONFIRM_DOWN)
    if (bigJump) {
      setConfirming(cents)
      return
    }
    mutation.mutate(cents)
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(centsToInput(dailyBudget ?? lifetimeBudget)); setEditing(true) }}
        className="flex items-center gap-1.5 text-xs rounded-md px-2 py-1 border transition-colors hover:bg-white/5 cursor-pointer"
        style={{ borderColor: 'var(--mit-border)', color: 'var(--mit-text-muted)' }}
        title="Editar orçamento"
      >
        <span className="font-mono" style={{ color: 'var(--mit-text)' }}>
          {fmtBRL(currentCents / 100)}
        </span>
        <span style={{ color: 'var(--mit-text-subtle)' }}>{isLifetime ? '/total' : '/dia'}</span>
        <Pencil size={11} style={{ color: 'var(--mit-text-subtle)' }} />
      </button>
    )
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <div
          className="flex items-center rounded-md border px-2 h-8"
          style={{ borderColor: 'var(--mit-accent)', background: 'var(--mit-bg-elevated)' }}
        >
          <span className="text-xs mr-1" style={{ color: 'var(--mit-text-subtle)' }}>R$</span>
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-20 bg-transparent outline-none text-sm font-mono"
            style={{ color: 'var(--mit-text)' }}
            aria-label={`Orçamento ${isLifetime ? 'total' : 'diário'} de ${name}`}
          />
        </div>
        <button
          onClick={submit}
          disabled={mutation.isPending}
          className="w-8 h-8 rounded-md flex items-center justify-center cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--mit-success)', color: '#fff' }}
          aria-label="Salvar orçamento"
        >
          <Check size={14} />
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={mutation.isPending}
          className="w-8 h-8 rounded-md flex items-center justify-center border cursor-pointer disabled:opacity-50"
          style={{ borderColor: 'var(--mit-border)', color: 'var(--mit-text-subtle)' }}
          aria-label="Cancelar"
        >
          <X size={14} />
        </button>
      </div>

      {confirming !== null && (() => {
        const subindo = confirming > currentCents
        return (
          <ConfirmModal
            open
            title={subindo ? '↑ Subir orçamento?' : '↓ Cortar orçamento?'}
            itemName={name}
            detail={`${fmtBRL(currentCents / 100)} → ${fmtBRL(confirming / 100)} ${isLifetime ? '(total)' : 'por dia'}.`}
            confirmLabel={subindo ? 'Subir' : 'Cortar'}
            tone={subindo ? 'success' : 'danger'}
            onConfirm={() => mutation.mutate(confirming)}
            onCancel={() => setConfirming(null)}
          />
        )
      })()}
    </>
  )
}

// ─── Conjuntos de uma campanha (carregados sob demanda) ─────────────────────

function AdSetList({ campaignId, campaignName }: { campaignId: string; campaignName: string }) {
  const qc = useQueryClient()
  const [pending, setPending] = useState<{ id: string; name: string } | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['control-adsets', campaignId],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/adsets`).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }),
    refetchInterval: 60_000,
  })

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      patchJSON(`/api/adsets/${id}/status`, { status }),
    onSuccess: (res, vars) => {
      setPending(null)
      okToast(vars.status === 'ACTIVE' ? 'Conjunto ativado' : 'Conjunto pausado', res?.demo)
      qc.invalidateQueries({ queryKey: ['control-adsets', campaignId] })
    },
    onError: (err: Error) => {
      setPending(null)
      toast.error(`Não deu pra mudar o conjunto: ${err.message}`)
    },
  })

  if (isLoading) {
    return <p className="text-xs py-2" style={{ color: 'var(--mit-text-subtle)' }}>Carregando conjuntos…</p>
  }
  if (error) {
    return <p className="text-xs py-2" style={{ color: 'var(--mit-danger)' }}>Não deu pra carregar os conjuntos.</p>
  }

  const adsets: AdSetRow[] = data?.adsets ?? []
  if (adsets.length === 0) {
    return <p className="text-xs py-2" style={{ color: 'var(--mit-text-subtle)' }}>Nenhum conjunto nesta campanha.</p>
  }

  return (
    <>
      <ul className="space-y-2 pt-1">
        {adsets.map(a => {
          const isOn = a.status === 'ACTIVE'
          const note = inheritedNote(a.status, a.effective_status)
          const busy = mutation.isPending && mutation.variables?.id === a.id
          const hasBudget = !!(a.daily_budget || a.lifetime_budget)
          return (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5"
              style={{
                borderColor: 'var(--mit-border)',
                background: 'var(--mit-bg-elevated)',
                opacity: isOn ? 1 : 0.6,
              }}
            >
              <StatusToggle
                active={isOn}
                disabled={busy}
                onClick={() => {
                  if (isOn) mutation.mutate({ id: a.id, status: 'PAUSED' })
                  else setPending({ id: a.id, name: a.name })
                }}
                label={isOn ? `Pausar conjunto ${a.name}` : `Ativar conjunto ${a.name}`}
              />
              {/* No celular o nome ocupa o resto da 1ª linha e o orçamento cai
                  pra 2ª — nome de conjunto é longo e cortar tudo faz você
                  pausar o conjunto errado. */}
              <div className="min-w-0 flex-1 basis-[calc(100%-3.75rem)] sm:basis-auto">
                <p className="text-[13px] leading-snug line-clamp-2" style={{ color: 'var(--mit-text)' }} title={a.name}>
                  {a.name}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--mit-text-subtle)' }}>
                  {fmtBRL(a.spend)} hoje{note ? ` · ${note}` : ''}
                </p>
              </div>
              <div className="pl-14 sm:pl-0 shrink-0">
                {hasBudget ? (
                  <BudgetEditor
                    level="adsets"
                    id={a.id}
                    name={a.name}
                    dailyBudget={a.daily_budget}
                    lifetimeBudget={a.lifetime_budget}
                    onSaved={() => qc.invalidateQueries({ queryKey: ['control-adsets', campaignId] })}
                  />
                ) : (
                  <span className="text-[11px]" style={{ color: 'var(--mit-text-subtle)' }}>
                    orçamento na campanha
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {pending && (
        <ConfirmModal
          open
          title="▶ Ativar conjunto?"
          itemName={pending.name}
          detail={`Campanha: ${campaignName}. Ele volta a gastar assim que a Meta liberar.`}
          confirmLabel="Ativar"
          tone="success"
          onConfirm={() => mutation.mutate({ id: pending.id, status: 'ACTIVE' })}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  )
}

// ─── Seção principal ─────────────────────────────────────────────────────────

export function CampaignControlsSection({ tagFilter }: { tagFilter?: string }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<CampaignRow | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['control-campaigns', tagFilter ?? ''],
    queryFn: () =>
      fetch(`/api/control${tagFilter ? `?tagFilter=${encodeURIComponent(tagFilter)}` : ''}`)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        }),
    refetchInterval: 30_000,
  })

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      patchJSON(`/api/campaigns/${id}/status`, { status }),
    onSuccess: (res, vars) => {
      setPending(null)
      okToast(vars.status === 'ACTIVE' ? 'Campanha ativada' : 'Campanha pausada', res?.demo)
      qc.invalidateQueries({ queryKey: ['control-campaigns'] })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    },
    onError: (err: Error) => {
      setPending(null)
      toast.error(`Não deu pra mudar a campanha: ${err.message}`)
    },
  })

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) {
    return (
      <section
        className="rounded-xl border p-6 animate-pulse"
        style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
      >
        <div className="h-4 w-44 rounded mb-5" style={{ background: 'var(--mit-bg-elevated)' }} />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-lg mb-2" style={{ background: 'var(--mit-bg-elevated)' }} />
        ))}
      </section>
    )
  }

  const campaigns: CampaignRow[] = data?.campaigns ?? []
  const activeCount = campaigns.filter(c => c.status === 'ACTIVE').length
  const spendTotal = campaigns.reduce((sum, c) => sum + (c.spend ?? 0), 0)

  return (
    <>
      <section
        className="rounded-xl border p-4 sm:p-6"
        style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--mit-gold)' }}>
              Controle de Campanhas
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>
              Liga/desliga e orçamento — campanha e conjunto, do celular
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs" style={{ color: 'var(--mit-text-subtle)' }}>
              {activeCount}/{campaigns.length} ativa{campaigns.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs font-mono" style={{ color: 'var(--mit-text-muted)' }}>
              {fmtBRL(spendTotal)} hoje
            </p>
          </div>
        </div>

        {error && (
          <p className="text-sm mb-3" style={{ color: 'var(--mit-danger)' }}>
            Não deu pra carregar as campanhas. Verifique o token da Meta.
          </p>
        )}

        {!error && campaigns.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--mit-text-subtle)' }}>
            Nenhuma campanha encontrada{tagFilter ? ` para o filtro "${tagFilter}"` : ''}.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {campaigns.map(c => {
              const isOn = c.status === 'ACTIVE'
              const note = inheritedNote(c.status, c.effective_status)
              const busy = mutation.isPending && mutation.variables?.id === c.id
              const hasBudget = !!(c.daily_budget || c.lifetime_budget)
              const isExpanded = expanded.has(c.id)

              return (
                <li
                  key={c.id}
                  className="rounded-lg border p-3"
                  style={{
                    borderColor: 'var(--mit-border)',
                    background: 'var(--mit-bg-dark)',
                    opacity: isOn ? 1 : 0.7,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <StatusToggle
                      active={isOn}
                      disabled={busy}
                      onClick={() => {
                        if (isOn) mutation.mutate({ id: c.id, status: 'PAUSED' })
                        else setPending(c)
                      }}
                      label={isOn ? `Pausar campanha ${c.name}` : `Ativar campanha ${c.name}`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-1.5">
                        <span
                          className="text-sm font-medium leading-snug line-clamp-2"
                          style={{ color: 'var(--mit-text)' }}
                          title={c.name}
                        >
                          {c.name}
                        </span>
                        {c.metaLink && c.metaLink !== '#' && (
                          <a
                            href={c.metaLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir no Meta"
                            className="shrink-0 mt-1 opacity-50 hover:opacity-100 transition-opacity"
                            style={{ color: 'var(--mit-text-subtle)' }}
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--mit-text-subtle)' }}>
                        {fmtBRL(c.spend)} hoje
                        {note ? ` · ${note}` : ''}
                        {busy ? ' · atualizando…' : ''}
                      </p>
                    </div>

                    <Badge
                      className="text-xs shrink-0 hidden sm:inline-flex"
                      style={{
                        background: c.tag.color + '22',
                        color: c.tag.color,
                        border: `1px solid ${c.tag.color}44`,
                      }}
                    >
                      {c.tag.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3 pl-[56px] sm:pl-14">
                    {hasBudget ? (
                      <BudgetEditor
                        level="campaigns"
                        id={c.id}
                        name={c.name}
                        dailyBudget={c.daily_budget}
                        lifetimeBudget={c.lifetime_budget}
                        onSaved={() => qc.invalidateQueries({ queryKey: ['control-campaigns'] })}
                      />
                    ) : (
                      <span className="text-[11px]" style={{ color: 'var(--mit-text-subtle)' }}>
                        sem CBO — orçamento fica nos conjuntos
                      </span>
                    )}

                    <button
                      onClick={() => toggleExpand(c.id)}
                      className="flex items-center gap-1 text-xs rounded-md px-2 py-1 border transition-colors hover:bg-white/5 cursor-pointer"
                      style={{ borderColor: 'var(--mit-border)', color: 'var(--mit-text-muted)' }}
                    >
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      Conjuntos
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 pl-2 sm:pl-14">
                      <AdSetList campaignId={c.id} campaignName={c.name} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <p
          className="text-[11px] leading-relaxed mt-4 rounded-lg border px-3 py-2"
          style={{ background: 'var(--mit-bg-elevated)', borderColor: 'var(--mit-border)', color: 'var(--mit-text-muted)' }}
        >
          Pausar é um clique. Ativar, subir mais de 20% ou cortar pela metade
          pedem confirmação — é a proteção contra dedo gordo em tela pequena. Um
          teto de gasto diário pode ser definido no servidor com{' '}
          <code>META_MAX_DAILY_BUDGET</code>.
        </p>
      </section>

      {pending && (
        <ConfirmModal
          open
          title="▶ Ativar campanha?"
          itemName={pending.name}
          detail={
            pending.daily_budget
              ? `Volta a gastar até ${fmtBRL(Number(pending.daily_budget) / 100)} por dia.`
              : 'Volta a gastar conforme o orçamento dos conjuntos.'
          }
          confirmLabel="Ativar"
          tone="success"
          onConfirm={() => mutation.mutate({ id: pending.id, status: 'ACTIVE' })}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  )
}
