import type { LampColorSchema } from '../types/preset'
import { addColor, colorsFromSchema, MAX_COLORS, removeColorAt, setColorAt } from '../ble/colors'

type Props = {
  value: LampColorSchema
  onChange: (next: LampColorSchema) => void
}

const SWATCHES = ['#ff3d7f', '#ff8a00', '#ffe14d', '#3dff8a', '#00d4ff', '#4488ff', '#a24dff', '#ffffff']

export function ColorPicker({ value, onChange }: Props) {
  const colors = colorsFromSchema(value)

  return (
    <div className="color-picker">
      <span className="field-label">Colors</span>
      <div className="color-row">
        {colors.map((hex, i) => (
          <div key={i} className="color-dot-wrap">
            <label className="color-dot" style={{ background: hex, boxShadow: `0 0 16px ${hex}88` }}>
              <input
                type="color"
                value={hex}
                onChange={(e) => onChange(setColorAt(value, i, e.target.value))}
                aria-label={`Color ${i + 1}`}
              />
            </label>
            {colors.length > 1 ? (
              <button
                type="button"
                className="color-remove"
                aria-label={`Remove color ${i + 1}`}
                onClick={() => onChange(removeColorAt(value, i))}
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        {colors.length < MAX_COLORS ? (
          <button
            type="button"
            className="color-add squish"
            aria-label="Add color"
            onClick={() => onChange(addColor(value, SWATCHES[colors.length % SWATCHES.length]))}
          >
            +
          </button>
        ) : null}
      </div>
      <div className="swatch-row">
        {SWATCHES.map((hex) => (
          <button
            key={hex}
            type="button"
            className="mini-swatch squish"
            style={{ background: hex }}
            aria-label={`Use ${hex} for the first color`}
            onClick={() => onChange(setColorAt(value, 0, hex))}
          />
        ))}
      </div>
    </div>
  )
}
