'use client'

/** Chavinha ON/OFF usada no controle de campanha, conjunto e anúncio.
 *  Alvo de toque de 44px (mínimo confortável no celular). */
export function StatusToggle({
  active, disabled, onClick, label,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label ?? (active ? 'Pausar' : 'Ativar')}
      aria-pressed={active}
      className="relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 focus:outline-none focus-visible:ring-2 cursor-pointer disabled:cursor-wait"
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
