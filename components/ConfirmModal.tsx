'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  /** Título do diálogo. Ex.: "▶ Reativar anúncio?" */
  title: string
  /** Nome do objeto afetado (campanha, conjunto ou anúncio). */
  itemName: string
  /** Linha de contexto que justifica a confirmação. Ex.: "Gastou R$ 82,00 nos últimos 7 dias." */
  detail?: string
  confirmLabel: string
  /** danger = vermelho (pausar/reduzir), success = verde (ativar/subir). */
  tone?: 'danger' | 'success'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open, title, itemName, detail, confirmLabel, tone = 'success', onConfirm, onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--mit-gold)' }}>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm" style={{ color: 'var(--mit-text-muted)' }}>
          <strong style={{ color: 'var(--mit-text)' }}>{itemName}</strong>
          {detail && (
            <>
              <br />
              {detail}
            </>
          )}
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button
            onClick={onConfirm}
            style={{
              background: tone === 'danger' ? 'var(--mit-danger)' : 'var(--mit-success)',
              color: '#fff',
              border: 'none',
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
