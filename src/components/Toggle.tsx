import { haptic } from '../ui/fx'

type Props = {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}

export function Toggle({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'on' : ''}`}
      onClick={() => {
        haptic(8)
        onChange(!checked)
      }}
    >
      <span className="toggle-knob" />
    </button>
  )
}
