import type { GameTime, LeagueId, LifeStage } from '@/models/types'
import { getLifeStage } from '@/core/AttributeEngine'

/** 游戏内：每年 12 月 × 每周 4 周 */
export const WEEKS_PER_MONTH = 4
export const MONTHS_PER_YEAR = 12

export type WeekCompetition = 'league' | 'cup' | 'none'

export function createTime(age: number, startYear = 2026): GameTime {
  const month = age >= 18 ? 3 : 1
  return {
    year: startYear,
    month,
    week: 1,
    absoluteWeek: 0,
  }
}

export function advanceWeek(time: GameTime): GameTime {
  let { year, month, week, absoluteWeek } = time
  week += 1
  absoluteWeek += 1
  if (week > WEEKS_PER_MONTH) {
    week = 1
    month += 1
    if (month > MONTHS_PER_YEAR) {
      month = 1
      year += 1
    }
  }
  return { year, month, week, absoluteWeek }
}

/** 联赛赛季月份（近似真实窗口） */
export function leagueSeasonMonths(leagueId: LeagueId): { start: number; end: number } {
  if (leagueId === 'CSL' || leagueId === 'CL1') {
    return { start: 3, end: 11 }
  }
  // 五大联赛近似：8 月～次年 5 月（跨年）
  return { start: 8, end: 5 }
}

function inSeasonMonth(month: number, leagueId: LeagueId): boolean {
  const win = leagueSeasonMonths(leagueId)
  if (win.start <= win.end) return month >= win.start && month <= win.end
  return month >= win.start || month <= win.end
}

/**
 * 本周竞赛类型：
 * - 赛季内每月第 1–3 周有比赛，第 4 周轮空
 * - 杯赛占用 4/7/10（欧陆 9/12/2）月第 2 周，该周不打联赛
 */
export function getWeekCompetition(
  time: GameTime,
  age: number,
  leagueId: LeagueId = 'CSL',
): WeekCompetition {
  if (age < 18) return 'none'
  if (!inSeasonMonth(time.month, leagueId)) return 'none'
  if (time.week === 4) return 'none'

  const cupMonths =
    leagueId === 'CSL' || leagueId === 'CL1' ? [4, 7, 10] : [9, 12, 2]

  if (cupMonths.includes(time.month) && time.week === 2) return 'cup'
  return 'league'
}

/**
 * 已淘汰杯赛时：该周改打联赛轮次，避免空窗又卡住赛程进度。
 */
export function getEffectiveCompetition(
  time: GameTime,
  age: number,
  leagueId: LeagueId = 'CSL',
  cupEliminated = false,
): WeekCompetition {
  const c = getWeekCompetition(time, age, leagueId)
  if (c === 'cup' && cupEliminated) return 'league'
  return c
}

export function isMatchWeek(
  time: GameTime,
  age: number,
  leagueId: LeagueId = 'CSL',
  cupEliminated = false,
): boolean {
  return getEffectiveCompetition(time, age, leagueId, cupEliminated) !== 'none'
}

export function isSeasonActive(time: GameTime, leagueId: LeagueId = 'CSL'): boolean {
  return inSeasonMonth(time.month, leagueId)
}

export function shouldBirthday(time: GameTime): boolean {
  return time.month === 3 && time.week === 1
}

export function formatGameDate(time: GameTime): string {
  return `${time.year}年${time.month}月 第${time.week}周`
}

export function stageLabel(stage: LifeStage): string {
  const map: Record<LifeStage, string> = {
    enlightenment: '启蒙期',
    youth: '少年期',
    academy: '青训期',
    pro_early: '职业初期',
    prime: '巅峰期',
    late: '生涯后期',
    retired: '已退役',
  }
  return map[stage]
}

export function stageFromAge(age: number): LifeStage {
  return getLifeStage(age)
}
