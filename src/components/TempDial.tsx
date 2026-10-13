import { useRef, type PointerEvent } from 'react'
import { haptic } from '../ui/fx'

type Props = {
  value: number
  min: number
  max: number
  unit: string
  label: string
  onChange: (value: number) => void
}

const START = -225
const SWEEP = 270
const R = 70

function polar(deg: number, r = R) {
  const rad = (deg * Math.PI) / 180
  return { x: 90 + r * Math.cos(rad), y: 90 + r * Math.sin(rad) }
}

function arcPath(fromDeg: number, toDeg: number) {
  const a = polar(fromDeg)
  const b = polar(toDeg)
  const large = toDeg - fromDeg > 180 ? 1 : 0
  return `M ${a.x} ${a.y} A ${R} ${R} 0 ${large} 1 ${b.x} ${b.y}`
}

export function TempDial({ value, min, max, unit, label, onChange }: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const lastStep = useRef(value)
  const frac = (Math.min(max, Math.max(min, value)) - min) / (max - min)
  const endDeg = START + SWEEP * frac
  const knob = polar(endDeg)

  const updateFromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - (rect.left + rect.width / 2)
    const y = e.clientY - (rect.top + rect.height / 2)
    let deg = (Math.atan2(y, x) * 180) / Math.PI
    let rel = deg - START
    while (rel < 0) rel += 360
    while (rel >= 360) rel -= 360
    if (rel > SWEEP) rel = rel - SWEEP < (360 - SWEEP) / 2 ? SWEEP : 0
    deg = rel / SWEEP
    const next = Math.round(min + deg * (max - min))
    if (Math.abs(next - lastStep.current) >= 5) {
      haptic(4)
      lastStep.current = next
    }
    onChange(next)
  }

  return (
    <div className="dial">
      <svg
        ref={ref}
        viewBox="0 0 180 180"
        className="dial-svg"
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          updateFromPointer(e)
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'touch') {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) updateFromPointer(e)
          }
        }}
      >
        <path d={arcPath(START, START + SWEEP)} className="dial-track" />
        <path d={arcPath(START, Math.max(START + 0.01, endDeg))} className="dial-fill" />
        <circle cx={knob.x} cy={knob.y} r="11" className="dial-knob" />
      </svg>
      <div className="dial-readout">
        <span className="dial-value">{value}</span>
        <span className="dial-unit">{unit}</span>
      </div>
    </div>
  )
}
