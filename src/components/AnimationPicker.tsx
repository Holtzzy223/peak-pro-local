import { usePuffco } from '../ble/PuffcoContext'
import { animationKey, prettyAnimationName } from '../ble/animations'
import { applyAnimation, lampName } from '../ble/colors'
import type { LampColorSchema } from '../types/preset'

type Props = {
  value: LampColorSchema
  onChange: (next: LampColorSchema) => void
}

const TUNABLE = [
  { key: 'speed', label: 'Speed' },
  { key: 'bright', label: 'Brightness' },
] as const

export function AnimationPicker({ value, onChange }: Props) {
  const { animations } = usePuffco()
  const current = animationKey(value)
  const keys = Array.from(new Set(['solid', ...Object.keys(animations), current]))
  const param = value.lamp.param ?? {}

  const setParam = (key: string, n: number) => {
    onChange({ ...value, lamp: { ...value.lamp, param: { ...param, [key]: n } } })
  }

  return (
    <div className="field">
      <span className="field-label">Animation</span>
      <div className="chip-row">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            className={`chip squish ${key === current ? 'active' : ''}`}
            onClick={() => {
              if (key === current) return
              const template = key === 'solid' ? undefined : animations[key]
              onChange(applyAnimation(value, template ? lampName(template) : key, template))
            }}
          >
            {prettyAnimationName(key)}
          </button>
        ))}
      </div>
      {keys.length <= 1 ? (
        <p className="hint left">
          Only Solid is known so far. Animations already set on your Peak show up here automatically
          after you connect, and you can reuse them on any slot.
        </p>
      ) : null}
      {TUNABLE.filter((t) => typeof param[t.key] === 'number').map((t) => (
        <label key={t.key} className="field">
          <span className="field-label">
            {t.label}
            <span className="field-value">{Math.round(((param[t.key] as number) / 255) * 100)}%</span>
          </span>
          <input
            type="range"
            min={1}
            max={255}
            value={param[t.key] as number}
            onChange={(e) => setParam(t.key, Number(e.target.value))}
          />
        </label>
      ))}
    </div>
  )
}
