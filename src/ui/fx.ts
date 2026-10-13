export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function haptic(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* unsupported */
  }
}

type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number; color: string }

let canvas: HTMLCanvasElement | null = null
let particles: Particle[] = []
let running = false

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.className = 'fx-canvas'
    document.body.appendChild(canvas)
  }
  const dpr = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  const ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

function tick(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  particles = particles.filter((p) => p.life > 0)
  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.18
    p.vx *= 0.985
    p.life -= 0.018
    ctx.globalAlpha = Math.max(0, p.life)
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * (0.4 + p.life * 0.6), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  if (particles.length > 0) requestAnimationFrame(() => tick(ctx))
  else running = false
}

/** Celebration burst in the given colors, centered on an element or the screen. */
export function burst(colors: string[], origin?: Element | null) {
  if (prefersReducedMotion()) return
  const ctx = ensureCanvas()
  if (!ctx) return
  const rect = origin?.getBoundingClientRect()
  const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
  const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 3
  const palette = colors.length > 0 ? colors : ['#ffffff']
  for (let i = 0; i < 70; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 2 + Math.random() * 6
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      life: 0.8 + Math.random() * 0.4,
      size: 2 + Math.random() * 4,
      color: palette[i % palette.length],
    })
  }
  if (!running) {
    running = true
    requestAnimationFrame(() => tick(ctx))
  }
}
