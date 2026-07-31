import type { Attributes, Player } from '@/models/types'
import { ATTR_LABELS, POSITION_LABELS } from '@/core/AttributeEngine'
import { getTeam } from '@/core/GameFactory'

interface Props {
  player: Player
  compact?: boolean
}

function cardTier(ovr: number): 'bronze' | 'silver' | 'gold' | 'elite' {
  if (ovr >= 85) return 'elite'
  if (ovr >= 75) return 'gold'
  if (ovr >= 65) return 'silver'
  return 'bronze'
}

const TIER_STYLE = {
  bronze: {
    bg: 'linear-gradient(160deg, #8a5a2b 0%, #c48a4a 35%, #6e3f1a 100%)',
    ink: '#2a1608',
    line: 'rgba(255,220,170,0.45)',
  },
  silver: {
    bg: 'linear-gradient(160deg, #7a8494 0%, #d5dde8 40%, #5c6675 100%)',
    ink: '#1a1f28',
    line: 'rgba(255,255,255,0.55)',
  },
  gold: {
    bg: 'linear-gradient(160deg, #b8871b 0%, #f0d78c 38%, #8a6410 100%)',
    ink: '#2a1c05',
    line: 'rgba(255,245,200,0.55)',
  },
  elite: {
    bg: 'linear-gradient(160deg, #1b3a5c 0%, #4fd1c5 30%, #0f2740 70%, #d4af37 100%)',
    ink: '#061018',
    line: 'rgba(212,175,55,0.65)',
  },
} as const

export function PlayerCard({ player, compact }: Props) {
  const team = player.currentTeamId ? getTeam(player.currentTeamId) : null
  const tier = cardTier(player.OVR)
  const style = TIER_STYLE[tier]
  const attrs: (keyof Attributes)[] = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']
  const left = attrs.slice(0, 3)
  const right = attrs.slice(3)

  return (
    <div className={`fifa-card ${compact ? 'fifa-card--compact' : ''}`} style={{ background: style.bg }}>
      <div className="fifa-card__shine" />
      <div className="fifa-card__top">
        <div className="fifa-card__meta" style={{ color: style.ink }}>
          <div className="fifa-card__ovr">{player.OVR}</div>
          <div className="fifa-card__pos">{POSITION_LABELS[player.position]}</div>
          <div className="fifa-card__rule" style={{ borderColor: style.line }} />
          <div className="fifa-card__flag" title={player.birthCity}>
            CN
          </div>
          {team ? (
            <div
              className="fifa-card__club"
              style={{ background: team.colors.primary, color: team.colors.secondary }}
              title={team.name}
            >
              {team.shortName.slice(0, 1)}
            </div>
          ) : null}
        </div>
        <div className="fifa-card__silhouette" aria-hidden>
          <svg viewBox="0 0 120 160" width="100%" height="100%">
            <ellipse cx="60" cy="36" rx="22" ry="24" fill="rgba(0,0,0,0.22)" />
            <path
              d="M30 70 C30 52 90 52 90 70 L95 140 C95 150 25 150 25 140 Z"
              fill="rgba(0,0,0,0.18)"
            />
          </svg>
        </div>
      </div>
      <div className="fifa-card__bottom" style={{ color: style.ink, borderTopColor: style.line }}>
        <div className="fifa-card__name">{player.name}</div>
        {!compact ? (
          <div className="fifa-card__stats" style={{ borderTopColor: style.line }}>
            <ul>
              {left.map((k) => (
                <li key={k}>
                  <b>{player.attributes[k]}</b> {ATTR_LABELS[k]}
                </li>
              ))}
            </ul>
            <ul>
              {right.map((k) => (
                <li key={k}>
                  <b>{player.attributes[k]}</b> {ATTR_LABELS[k]}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="fifa-card__sub">
            {POSITION_LABELS[player.position]} · #{player.jerseyNumber} · {player.age}岁
          </div>
        )}
        {!compact ? (
          <div className="fifa-card__sub">
            {player.heightCm}cm / {player.weightKg}kg · {player.birthCity}
            {team ? ` · ${team.shortName}` : ''}
          </div>
        ) : null}
      </div>
    </div>
  )
}
