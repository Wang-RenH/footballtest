import type {
  GameTime,
  Player,
  PlayerContract,
  SeasonPlayerStats,
  Team,
} from '@/models/types'
import { clamp } from '@/utils/random'

export function emptySeasonStats(): SeasonPlayerStats {
  return { apps: 0, goals: 0, assists: 0, dribbles: 0, ratingSum: 0 }
}

export function calcWeeklyWage(ovr: number, leagueRep: number): number {
  const base = 800 + ovr * ovr * 1.2 + leagueRep * 40
  return Math.round(base / 50) * 50
}

export function createContract(
  player: Player,
  team: Team,
  time: GameTime,
): PlayerContract {
  const weeklyWage = calcWeeklyWage(player.OVR, team.reputation)
  return {
    teamId: team.id,
    weeklyWage,
    monthlyWage: weeklyWage * 4,
    expiresYear: time.year + (player.age < 23 ? 3 : 2),
    expiresMonth: time.month,
    signingBonus: weeklyWage * 8,
    releaseClause: weeklyWage * 200,
  }
}

/** 中超习惯：冬窗约 1–2 月，夏窗约 6–7 月 */
export function getTransferWindow(time: GameTime): 'winter' | 'summer' | null {
  if (time.month === 1 || time.month === 2) return 'winter'
  if (time.month === 6 || time.month === 7) return 'summer'
  return null
}

export function livingCostWeekly(player: Player): number {
  const cityBoost = player.currentTeamId ? 900 : 350
  const lifestyle = 400 + player.age * 25 + Math.floor(player.funds / 50000) * 150
  const injuryCare = player.injury ? 600 : 0
  return cityBoost + lifestyle + injuryCare
}

export interface FinanceWeekResult {
  player: Player
  lines: string[]
  bulletin?: { headline: string; body: string; category: 'finance' | 'life' }
}

/** 职业期每周：发周薪、扣生活费，偶发大额支出 */
export function applyWeeklyFinance(player: Player, _time: GameTime): FinanceWeekResult {
  if (player.age < 18) {
    const allowance = 200 + Math.floor(player.relationships.father / 10) * 50
    const next = { ...player, funds: player.funds + allowance }
    return {
      player: next,
      lines: [`家庭零花 +¥${allowance}`],
    }
  }

  const lines: string[] = []
  let funds = player.funds
  const contract = player.contract
  let bulletin: FinanceWeekResult['bulletin']

  if (contract && player.currentTeamId) {
    funds += contract.weeklyWage
    lines.push(`俱乐部周薪 +¥${contract.weeklyWage.toLocaleString()}`)
  } else {
    const casual = 500 + Math.floor(player.OVR * 20)
    funds += casual
    lines.push(`训练补贴 +¥${casual.toLocaleString()}`)
  }

  const cost = livingCostWeekly(player)
  funds -= cost
  lines.push(`生活开销 -¥${cost.toLocaleString()}`)

  // 偶发大事花钱（提高一点可见度）
  const roll = Math.random()
  if (roll < 0.06) {
    const fine = 3000 + Math.floor(Math.random() * 12000)
    funds -= fine
    lines.push(`突发支出（医疗/罚单/家庭） -¥${fine.toLocaleString()}`)
    bulletin = {
      category: 'finance',
      headline: '钱包告急：一笔意外开销',
      body: `本周额外支出约 ¥${fine.toLocaleString()}，经纪人提醒注意现金流。`,
    }
  } else if (roll < 0.09) {
    const legal = 8000 + Math.floor(Math.random() * 20000)
    funds -= legal
    lines.push(`法律纠纷和解金 -¥${legal.toLocaleString()}`)
    bulletin = {
      category: 'life',
      headline: '传闻：球员陷入民事纠纷',
      body: `相关和解金额约 ¥${legal.toLocaleString()}。俱乐部公关建议低调处理。`,
    }
  }

  const net = funds - player.funds
  lines.unshift(`本周资金净变动 ${net >= 0 ? '+' : ''}¥${net.toLocaleString()}（余额 ¥${Math.max(0, funds).toLocaleString()}）`)

  return {
    player: { ...player, funds: Math.max(0, funds) },
    lines,
    bulletin,
  }
}

export function contractSummary(contract: PlayerContract | null | undefined): string {
  if (!contract) return '无职业合同'
  return `周薪 ¥${contract.weeklyWage.toLocaleString()}（约月薪 ¥${contract.monthlyWage.toLocaleString()}）· 至 ${contract.expiresYear}年${contract.expiresMonth}月`
}

export function shouldOfferNewContract(player: Player, time: GameTime): boolean {
  const c = player.contract
  if (!c || !player.currentTeamId) return false
  const monthsLeft =
    (c.expiresYear - time.year) * 12 + (c.expiresMonth - time.month)
  return monthsLeft <= 6 && monthsLeft >= 0
}

export function renewContractOffer(player: Player, team: Team, time: GameTime): PlayerContract {
  const bump = 1.08 + Math.max(0, player.OVR - 70) * 0.01
  const weekly = Math.round((calcWeeklyWage(player.OVR, team.reputation) * bump) / 50) * 50
  return {
    teamId: team.id,
    weeklyWage: weekly,
    monthlyWage: weekly * 4,
    expiresYear: time.year + 3,
    expiresMonth: time.month,
    signingBonus: weekly * 10,
    releaseClause: weekly * 220,
  }
}

export function syncSeasonStatsFromMatch(
  stats: SeasonPlayerStats,
  goals: number,
  assists: number,
  dribbles: number,
  rating: number,
  played: boolean,
): SeasonPlayerStats {
  if (!played) return { ...stats }
  return {
    apps: stats.apps + 1,
    goals: stats.goals + goals,
    assists: stats.assists + assists,
    dribbles: stats.dribbles + dribbles,
    ratingSum: Math.round((stats.ratingSum + rating) * 10) / 10,
  }
}

export function avgSeasonRating(stats: SeasonPlayerStats): number {
  if (stats.apps <= 0) return 0
  return Math.round((stats.ratingSum / stats.apps) * 10) / 10
}

export function clampFunds(n: number) {
  return clamp(n, 0, 999_999_999)
}
