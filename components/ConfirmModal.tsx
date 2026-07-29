'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  campaignName: string
  /**
   * Daily budget in centavos as returned by Meta Ads API (e.g. 15000 = R$150).
   * The component divides by 100 before displaying the value.
   */
  budget: number
  newStatus: 'ACTIVE' | 'PAUSED'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ open, campaignName, budget, newStatus, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent style={{ background: 'var(--mit-bg-card)', borderColor: 'var(--mit-border)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--mit-gold)' }}>
            {newStatus === 'PAUSED' ? '⏸ Pausar campanha?' : '▶ Reativar campanha?'}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm" style={{ color: 'var(--mit-text-muted)' }}>
          <strong style={{ color: 'var(--mit-text)' }}>{campaignName}</strong>
          <br />
          Orçamento diário: R$ {(budget / 100).toFixed(2)} — acima de R$100/dia.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button
            onClick={onConfirm}
            style={{
              background: newStatus === 'PAUSED' ? 'var(--mit-danger)' : 'var(--mit-success)',
              color: '#fff',
              border: 'none'
            }}
          >
            {newStatus === 'PAUSED' ? 'Pausar' : 'Reativar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
