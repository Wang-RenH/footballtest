import type { Attributes } from '@/models/types'

interface Props {
  attrs: Attributes
  size?: number
}

const KEYS: (keyof Attributes)[] = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']
const LABELS = ['速度', '射门', '传球', '盘带', '防守', '身体']

export function AttributeRadar({ attrs, size = 180 }: Props) {
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38
  const points = KEYS.map((k, i) => {
    const angle = (Math.PI * 2 * i) / KEYS.length - Math.PI / 2
    const val = attrs[k] / 100
    return {
      x: cx + Math.cos(angle) * r * val,
      y: cy + Math.sin(angle) * r * val,
      lx: cx + Math.cos(angle) * r * 1.18,
      ly: cy + Math.sin(angle) * r * 1.18,
      label: LABELS[i]!,
    }
  })
  const poly = points.map((p) => `${p.x},${p.y}`).join(' ')
  const grid = [0.33, 0.66, 1].map((scale) =>
    KEYS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / KEYS.length - Math.PI / 2
      return `${cx + Math.cos(angle) * r * scale},${cy + Math.sin(angle) * r * scale}`
    }).join(' '),
  )

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {grid.map((g, i) => (
        <polygon key={i} points={g} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      ))}
      {KEYS.map((_, i) => {
        const angle = (Math.PI * 2 * i) / KEYS.length - Math.PI / 2
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(angle) * r}
            y2={cy + Math.sin(angle) * r}
            stroke="rgba(255,255,255,0.1)"
          />
        )
      })}
      <polygon points={poly} fill="rgba(232,197,71,0.35)" stroke="#e8c547" strokeWidth={2} />
      {points.map((p, i) => (
        <text
          key={i}
          x={p.lx}
          y={p.ly}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.65)"
          fontSize={10}
        >
          {p.label}
        </text>
      ))}
    </svg>
  )
}
