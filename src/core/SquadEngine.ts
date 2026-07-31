import type { Player, Position, Team } from '@/models/types'
import { CHINESE_PRO_NAMES } from '@/data/chinesePlayers'

const POSITIONS: Position[] = [
  'GK', 'CB', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'ST', 'CF',
]

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export interface SquadMate {
  id: string
  name: string
  position: Position
  jerseyNumber: number
  ovr: number
  role: number
}

/** 为俱乐部生成稳定阵容：优先抽真实职业球员名池 */
export function generateSquad(team: Team, seasonYear: number, excludeName?: string): SquadMate[] {
  const seed = hash(`${team.id}-${seasonYear}-pro`)
  const mates: SquadMate[] = []
  const usedNames = new Set<string>()
  if (excludeName) usedNames.add(excludeName)

  const pool = [...CHINESE_PRO_NAMES]
  // 稳定打乱
  pool.sort((a, b) => hash(`${seed}-${a}`) - hash(`${seed}-${b}`))

  for (let i = 0; i < 18; i++) {
    const h = hash(`${seed}-${i}`)
    let name = pool[i % pool.length]!
    let guard = 0
    while (usedNames.has(name) && guard < pool.length) {
      name = pool[(i + guard + 1) % pool.length]!
      guard++
    }
    usedNames.add(name)
    const position = POSITIONS[i % POSITIONS.length]!
    const ovr = Math.round(
      clamp(team.strength - 8 + (h % 17) + (i < 11 ? 2 : -3), 48, 92),
    )
    mates.push({
      id: `${team.id}_sq_${i}`,
      name,
      position,
      jerseyNumber: ((h % 30) + 1 + i) % 99 || 1,
      ovr,
      role: i < 11 ? 0.7 + (11 - i) * 0.02 : 0.25 + (h % 20) / 100,
    })
  }
  return mates.sort((a, b) => b.ovr - a.ovr)
}

export function squadWithUser(
  team: Team,
  seasonYear: number,
  player: Player,
): Array<SquadMate & { isUser?: boolean }> {
  const others = generateSquad(team, seasonYear, player.name).filter(
    (m) => m.name !== player.name,
  )
  const user: SquadMate & { isUser: boolean } = {
    id: player.id,
    name: player.name,
    position: player.position,
    jerseyNumber: player.jerseyNumber,
    ovr: player.OVR,
    role: 0.85,
    isUser: true,
  }
  return [user, ...others].sort((a, b) => b.ovr - a.ovr).slice(0, 22)
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

export function pickTeammateName(
  team: Team,
  seasonYear: number,
  exclude: string[],
): string {
  const squad = generateSquad(team, seasonYear)
  const pool = squad.filter((s) => !exclude.includes(s.name))
  return pool[Math.floor(Math.random() * Math.max(1, pool.length))]?.name ?? '队友'
}
