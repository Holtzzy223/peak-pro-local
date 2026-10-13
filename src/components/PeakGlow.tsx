import type { CSSProperties } from 'react'
import { glowStyleFor } from '../ble/animations'
import type { SessionPhase } from '../ble/PuffcoContext'

type Props = {
  colors: string[]
  animation: string
  phase: SessionPhase
  /** 0..1 fill of the heat ring; null hides it. */
  progress: number | null
  centerLabel?: string
  subLabel?: string
  dimmed?: boolean
}

const RING_R = 108
const RING_C = 2 * Math.PI * RING_R

const GLASS = 'M98 30 L109 30 L127.5 137 L91 142 Z'
const BASE =
  'M89.5 144.5 L150.8 132 C148.5 158 152.5 180 150.6 201 Q120 210 89 205 C88 180 90.5 165 89.5 144.5 Z'

function heatColor(progress: number): string {
  const hue = 210 - progress * 185
  return `hsl(${hue}, 95%, 60%)`
}

export function PeakGlow({ colors, animation, phase, progress, centerLabel, subLabel, dimmed }: Props) {
  const c1 = colors[0] ?? '#4488ff'
  const c2 = colors[1] ?? c1
  const c3 = colors[2] ?? c2
  const style = glowStyleFor(animation)
  const heating = phase === 'preheat' || phase === 'active'
  const vars = { '--g1': c1, '--g2': c2, '--g3': c3 } as CSSProperties

  return (
    <div className={`peak-glow glow-${style} ${heating ? 'is-heating' : ''} ${dimmed ? 'is-dim' : ''}`} style={vars}>
      <svg viewBox="0 0 240 240" className="peak-svg" aria-hidden="true">
        <defs>
          <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.30" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="glassTint" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={c1} stopOpacity="0.55" />
            <stop offset="55%" stopColor={c2} stopOpacity="0.12" />
            <stop offset="100%" stopColor={c2} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lightGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={c1} />
            <stop offset="50%" stopColor={c2} />
            <stop offset="100%" stopColor={c3} />
          </linearGradient>
          <linearGradient id="baseGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2a2a33" />
            <stop offset="35%" stopColor="#1a1a21" />
            <stop offset="100%" stopColor="#0e0e13" />
          </linearGradient>
          <linearGradient id="steelGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8d8f99" />
            <stop offset="40%" stopColor="#f2f3f7" />
            <stop offset="100%" stopColor="#6c6e78" />
          </linearGradient>
          <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <clipPath id="baseClip">
            <path d={BASE} />
          </clipPath>
        </defs>

        <circle cx="120" cy="120" r={RING_R} className="ring-track" />
        {progress !== null ? (
          <circle
            cx="120"
            cy="120"
            r={RING_R}
            className="ring-fill"
            stroke={heatColor(progress)}
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - Math.max(0, Math.min(1, progress)))}
            transform="rotate(-90 120 120)"
          />
        ) : null}

        <g transform="translate(120 120) scale(1.1) translate(-120 -120)">
        <ellipse cx="120" cy="204" rx="44" ry="10" className="glow-halo" fill="url(#lightGrad)" filter="url(#softGlow)" />

        {/* glass */}
        <path d={GLASS} fill="url(#glassGrad)" className="glass" />
        <path d={GLASS} fill="url(#glassTint)" className="glass-tint" />
        <path d="M109.5 68 L100 135 L119 133 Z" className="perc" />
        <path
          d="M101 129 Q110 127 117.6 122 M102.6 117 Q110 115 116.2 110.5 M104.2 105 Q110 103.5 114.6 99.5 M105.8 93 Q110 92 113.1 88.5 M107.4 81 Q110 80.5 111.6 77.5"
          className="perc-twist"
        />
        <line x1="98" y1="30" x2="109" y2="30" className="glass-lip" />

        {/* chamber + carb cap */}
        <rect x="123" y="120" width="19" height="15" fill="url(#steelGrad)" />
        <path d="M123 124 H142 M123 127.5 H142 M123 131 H142" className="steel-ribs" />
        <rect x="120.5" y="108" width="24" height="13" rx="3" className="collar" />
        <rect x="124.5" y="102.5" width="16" height="5.5" rx="2.5" className="cap" />
        <rect x="129.5" y="98.5" width="6" height="4.5" rx="1.5" className="cap-knob" />

        {/* base */}
        <path d={BASE} fill="url(#baseGrad)" className="base" />
        <g clipPath="url(#baseClip)" className="grooves">
          <path d="M86 152 Q122 136 154 140" />
          <path d="M86 160 Q122 145 154 151" />
          <path d="M86 168 Q122 154 154 162" />
          <path d="M86 192 Q118 170 154 150" className="seam" />
        </g>
        <path d="M89.5 144.5 L150.8 132" className="base-top" />
        <circle cx="135" cy="173" r="3.4" className="button" />
        <circle cx="135" cy="173" r="1.4" className="logo-dot" fill={c1} />
        <path d="M89 201.5 Q120 210 150.6 197.5 L150.6 201 Q120 213 89 205 Z" className="light-band" fill="url(#lightGrad)" />
        </g>
      </svg>

      {centerLabel ? (
        <div className="peak-label">
          <span className="peak-label-main">{centerLabel}</span>
          {subLabel ? <span className="peak-label-sub">{subLabel}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
