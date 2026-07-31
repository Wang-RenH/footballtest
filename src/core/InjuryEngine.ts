import type { Player } from '@/models/types'
import { clamp } from '@/utils/random'

const INJURY_POOL = [
  { name: '大腿肌肉拉伤', weeks: [1, 3], pac: -3, phy: -1 },
  { name: '踝关节扭伤', weeks: [2, 4], pac: -2, phy: -2 },
  { name: '膝盖撞击伤', weeks: [2, 5], pac: -2, phy: -3 },
  { name: '轻微骨膜炎', weeks: [1, 2], pac: -1, phy: -1 },
  { name: '腹股沟拉伤', weeks: [2, 4], pac: -2, phy: -2 },
]

/** 疲劳过高 / 比赛强度 / 选项风险 → 可能受伤 */
export function rollInjuryChance(
  player: Player,
  extraRisk = 0,
): { player: Player; injured: boolean; note: string | null } {
  if (player.injury) {
    return { player, injured: true, note: null }
  }

  const fatigueRisk = player.fatigue >= 85 ? 0.22 : player.fatigue >= 70 ? 0.1 : player.fatigue >= 55 ? 0.04 : 0.01
  const proneness = player.hiddenAttributes.injuryProneness * 0.008
  const risk = Math.min(0.55, fatigueRisk + proneness + extraRisk)

  if (Math.random() >= risk) {
    return { player, injured: false, note: null }
  }

  const pick = INJURY_POOL[Math.floor(Math.random() * INJURY_POOL.length)]!
  const weeks =
    pick.weeks[0]! + Math.floor(Math.random() * (pick.weeks[1]! - pick.weeks[0]! + 1))
  const medicalBill = 1500 + weeks * 800 + Math.floor(Math.random() * 2000)

  const next: Player = {
    ...player,
    funds: Math.max(0, player.funds - medicalBill),
    morale: clamp(player.morale - 10, 0, 100),
    fatigue: clamp(player.fatigue + 5, 0, 100),
    injury: {
      name: pick.name,
      weeksLeft: weeks,
      attrPenalty: { PAC: pick.pac, PHY: pick.phy },
    },
  }

  return {
    player: next,
    injured: true,
    note: `受伤：${pick.name}（约 ${weeks} 周），医疗开销 -¥${medicalBill.toLocaleString()}`,
  }
}
