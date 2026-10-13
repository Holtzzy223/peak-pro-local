import { usePuffco } from '../ble/PuffcoContext'
import { prettyAnimationName } from '../ble/animations'
import { applyAnimation, lampName } from '../ble/colors'
import type { LampColorSchema } from '../types/preset'

type Props = {
  value: LampColorSchema
  onChange: (next: LampColorSchema) => void
}

export function AnimationPicker({ value, onChange }: Props) {
  const { animations } = usePuffco()
  const current = lampName(value)
  const names = Array.from(new Set(['solid', ...Object.keys(animations), current]))

  return (
    <div className="field">
      <span className="field-label">Animation</span>
      <div className="chip-row">
        {names.map((name) => (
          <button
            key={name}
            type="button"
            className={`chip squish ${name === current ? 'active' : ''}`}
            onClick={() => {
              if (name === current) return
              onChange(applyAnimation(value, name, name === 'solid' ? undefined : animations[name]))
            }}
          >
            {prettyAnimationName(name)}
          </button>
        ))}
      </div>
      {names.length <= 1 ? (
        <p className="hint left">
          Only Solid is known so far. Animations already set on your Peak show up here automatically
          after you connect, and you can reuse them on any slot.
        </p>
      ) : null}
    </div>
  )
}
