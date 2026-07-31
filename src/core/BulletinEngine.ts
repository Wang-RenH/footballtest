import type {
  BulletinItem,
  GameState,
  GameTime,
  InternationalState,
  NationalFixture,
  Player,
} from '@/models/types'
import { NATIONAL_STAR_POOL } from '@/data/chinesePlayers'
import { getTransferWindow } from '@/core/FinanceEngine'
import { getWeekCompetition } from '@/core/TimeEngine'
import { uid } from '@/utils/random'

const ASIA_OPPONENTS = [
  '日本', '韩国', '澳大利亚', '伊朗', '沙特阿拉伯', '伊拉克',
  '乌兹别克斯坦', '卡塔尔', '阿联酋', '阿曼', '巴林', '约旦',
  '泰国', '越南', '印尼', '叙利亚',
]

export function pushBulletin(
  list: BulletinItem[],
  item: Omit<BulletinItem, 'id'>,
): BulletinItem[] {
  return [{ ...item, id: uid('bul') }, ...list].slice(0, 40)
}

function labelOf(y: number, m: number, w: number) {
  return `${y}年${m}月 第${w}周`
}

function advanceCal(y: number, m: number, w: number, addWeeks: number) {
  let year = y
  let month = m
  let week = w + addWeeks
  while (week > 4) {
    week -= 4
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return { year, month, week }
}

export function buildWeeklyBulletins(state: GameState): BulletinItem[] {
  const { time, player, season } = state
  const dateLabel = `${time.year}年${time.month}月 第${time.week}周`
  const items: Omit<BulletinItem, 'id'>[] = []
  const comp = getWeekCompetition(time, player.age, season.leagueId)
  const window = getTransferWindow(time)

  if (comp === 'cup' && !season.cupEliminated) {
    items.push({
      dateLabel,
      category: 'cup',
      headline: `足协杯第 ${season.cupRound} 轮赛程出炉`,
      body: '国内杯赛周登场，赢球晋级，输球淘汰。关注伤病与轮换。',
    })
  } else if (comp === 'league') {
    items.push({
      dateLabel,
      category: 'league',
      headline: `联赛第 ${season.round + 1} 轮前瞻`,
      body: '积分榜压力与主客场形势将影响出场时间。',
    })
  }

  if (window && time.week === 1) {
    items.push({
      dateLabel,
      category: 'transfer',
      headline: window === 'winter' ? '冬窗正式开启' : '夏窗正式开启',
      body:
        window === 'winter'
          ? '俱乐部可进行引援与清洗。合同年球员留意去留。'
          : '夏窗窗口：表现不佳者可能被租借或出售；明星球员报价增多。',
    })
  }

  const intl = season.international
  if (
    intl?.lastAnnouncement &&
    [3, 6, 9, 11].includes(time.month) &&
    time.week === 1
  ) {
    const nextFix = intl.fixtures?.find((f) => f.status === 'upcoming')
    items.push({
      dateLabel,
      category: 'national',
      headline: intl.lastAnnouncement,
      body: intl.calledUp
        ? `报到：${intl.campReportLabel ?? '本周'}；归队：${intl.campReturnLabel ?? '窗口结束后'}。${
            nextFix
              ? `首场：${nextFix.dateLabel} ${nextFix.venue}对阵${nextFix.opponent}（${nextFix.competition}）。`
              : ''
          }名单：${(intl.provisionalSquad ?? []).slice(0, 8).join('、')}…`
        : `本期大名单未包含你。热门：${(intl.provisionalSquad ?? []).slice(0, 6).join('、')}`,
    })
  }

  // 本周若有国家队比赛
  const todayFix = intl?.fixtures?.find(
    (f) =>
      f.year === time.year &&
      f.month === time.month &&
      f.week === time.week &&
      f.status === 'upcoming',
  )
  if (todayFix && intl?.calledUp) {
    items.push({
      dateLabel,
      category: 'national',
      headline: `国家队赛日：${todayFix.venue} vs ${todayFix.opponent}`,
      body: `${todayFix.competition}。你已入选本期大名单，需随队征战（俱乐部联赛本周可能轮休）。`,
    })
  }

  if (player.contract && player.age >= 18) {
    const monthsLeft =
      (player.contract.expiresYear - time.year) * 12 +
      (player.contract.expiresMonth - time.month)
    if (monthsLeft <= 4 && monthsLeft >= 0 && time.week === 1) {
      items.push({
        dateLabel,
        category: 'finance',
        headline: '合同进入到期倒计时',
        body: `现合同约月薪 ¥${player.contract.monthlyWage.toLocaleString()}，还剩约 ${monthsLeft} 个月。经纪人建议尽早谈续约或留意转会窗。`,
      })
    }
  }

  return items.map((i) => ({ ...i, id: uid('bul') }))
}

export function rollNationalCamp(
  player: Player,
  time: GameTime,
  prev: InternationalState,
): InternationalState {
  const windowMonth = [3, 6, 9, 11].includes(time.month)
  if (!windowMonth || time.week !== 1 || player.age < 18) {
    // 推进本周国家队比赛状态
    const fixtures = (prev.fixtures ?? []).map((f) => {
      if (
        f.status === 'upcoming' &&
        f.year === time.year &&
        f.month === time.month &&
        f.week === time.week &&
        prev.calledUp
      ) {
        const scored = Math.random() < 0.45
        const gf = scored ? 1 + Math.floor(Math.random() * 2) : Math.floor(Math.random() * 2)
        const ga = Math.floor(Math.random() * 2)
        return {
          ...f,
          status: 'played' as const,
          result: `${gf}-${ga}${scored && prev.calledUp ? '（你有出场机会）' : ''}`,
        }
      }
      return f
    })
    const capsGain = fixtures.filter(
      (f, i) =>
        f.status === 'played' &&
        prev.fixtures?.[i]?.status === 'upcoming' &&
        prev.calledUp,
    ).length
    return {
      ...prev,
      fixtures,
      caps: prev.caps + capsGain,
      campStatus:
        prev.campStatus === 'provisional' && time.week >= 4 ? 'none' : prev.campStatus,
      calledUp: prev.campStatus === 'provisional' && time.week >= 4 ? false : prev.calledUp,
    }
  }

  const threshold = prev.stage === 'world_cup' ? 76 : prev.stage === 'asian_cup' ? 71 : 73
  const formBonus =
    player.seasonStats?.apps >= 5 && player.seasonStats?.goals >= 2 ? -3 : 0
  const called =
    player.OVR >= threshold + formBonus && player.fatigue < 90 && !player.injury

  const stars = [...NATIONAL_STAR_POOL]
  for (let i = stars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[stars[i], stars[j]] = [stars[j]!, stars[i]!]
  }
  const size = 24 + Math.floor(Math.random() * 5)
  let squad = stars.slice(0, size).filter((n) => n !== player.name)
  if (called) squad = [player.name, ...squad].slice(0, size)

  const stageWord =
    prev.stage === 'asian_cup'
      ? '亚洲杯集训'
      : prev.stage === 'world_cup'
        ? '世界杯集训'
        : '国家队集训'

  const report = advanceCal(time.year, time.month, time.week, 0)
  const match1 = advanceCal(time.year, time.month, time.week, 1)
  const match2 = advanceCal(time.year, time.month, time.week, 2)
  const ret = advanceCal(time.year, time.month, time.week, 3)

  const pickOpp = () =>
    ASIA_OPPONENTS[Math.floor(Math.random() * ASIA_OPPONENTS.length)]!

  const fixtures: NationalFixture[] = called
    ? [
        {
          dateLabel: labelOf(match1.year, match1.month, match1.week),
          year: match1.year,
          month: match1.month,
          week: match1.week,
          opponent: pickOpp(),
          competition:
            prev.stage === 'asian_cup' ? '亚洲杯' : '世界杯亚洲区预选赛',
          venue: Math.random() < 0.5 ? '主场' : '客场',
          status: 'upcoming',
        },
        {
          dateLabel: labelOf(match2.year, match2.month, match2.week),
          year: match2.year,
          month: match2.month,
          week: match2.week,
          opponent: pickOpp(),
          competition:
            prev.stage === 'asian_cup' ? '亚洲杯' : '世界杯亚洲区预选赛',
          venue: Math.random() < 0.5 ? '客场' : '中立场',
          status: 'upcoming',
        },
      ]
    : []

  return {
    ...prev,
    calledUp: called,
    campStatus: called ? 'provisional' : 'missed',
    provisionalSquad: squad,
    finalSquad: called ? squad.slice(0, 23) : null,
    lastAnnouncement: called
      ? `【大名单】${stageWord}名单公布：你入选！`
      : `【大名单】${stageWord}名单公布：你落选`,
    stageLabel: called ? `${stageWord}·已入选` : `${stageWord}·未入选`,
    campReportLabel: called
      ? `${labelOf(report.year, report.month, report.week)} 赴国家队报到集训`
      : null,
    campReturnLabel: called
      ? `${labelOf(ret.year, ret.month, ret.week)} 结束征召返回俱乐部`
      : null,
    fixtures,
    nextWindowLabel: called
      ? `集训${fixtures[0] ? `，随后 ${fixtures[0].dateLabel} vs ${fixtures[0].opponent}` : ''}`
      : '下一期窗口请保持出场与评分',
  }
}
