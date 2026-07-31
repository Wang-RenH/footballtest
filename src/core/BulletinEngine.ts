import type {
  BulletinItem,
  GameState,
  GameTime,
  InternationalState,
  Player,
} from '@/models/types'
import { NATIONAL_STAR_POOL } from '@/data/chinesePlayers'
import { getTransferWindow } from '@/core/FinanceEngine'
import { getWeekCompetition } from '@/core/TimeEngine'
import { uid } from '@/utils/random'

export function pushBulletin(
  list: BulletinItem[],
  item: Omit<BulletinItem, 'id'>,
): BulletinItem[] {
  return [{ ...item, id: uid('bul') }, ...list].slice(0, 40)
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
    items.push({
      dateLabel,
      category: 'national',
      headline: intl.lastAnnouncement,
      body: intl.calledUp
        ? `你已进入大名单。集训名单共 ${intl.provisionalSquad?.length ?? 0} 人：${(intl.provisionalSquad ?? []).slice(0, 8).join('、')}${(intl.provisionalSquad?.length ?? 0) > 8 ? '…' : ''}`
        : `本期大名单未包含你。继续用联赛表现争取下一期征召。名单热门：${(intl.provisionalSquad ?? []).slice(0, 6).join('、')}`,
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
  // 国字号窗口：约 3/6/9/11 月或世界杯年更频繁
  const windowMonth = [3, 6, 9, 11].includes(time.month)
  if (!windowMonth || time.week !== 1 || player.age < 18) {
    return {
      ...prev,
      campStatus: prev.campStatus === 'final' && time.week > 2 ? 'none' : prev.campStatus,
    }
  }

  const threshold = prev.stage === 'world_cup' ? 76 : prev.stage === 'asian_cup' ? 71 : 73
  const formBonus = player.seasonStats.apps >= 5 && player.seasonStats.goals >= 2 ? -3 : 0
  const called = player.OVR >= threshold + formBonus && player.fatigue < 90 && !player.injury

  const stars = [...NATIONAL_STAR_POOL]
  // 打乱取 22–28 人
  for (let i = stars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[stars[i], stars[j]] = [stars[j]!, stars[i]!]
  }
  const size = 24 + Math.floor(Math.random() * 5)
  let squad = stars.slice(0, size).filter((n) => n !== player.name)
  if (called) {
    squad = [player.name, ...squad].slice(0, size)
  }

  const stageWord =
    prev.stage === 'asian_cup'
      ? '亚洲杯集训'
      : prev.stage === 'world_cup'
        ? '世界杯集训'
        : '国家队集训'

  return {
    ...prev,
    calledUp: called,
    campStatus: called ? 'provisional' : 'missed',
    provisionalSquad: squad,
    finalSquad: null,
    caps: called ? prev.caps : prev.caps,
    lastAnnouncement: called
      ? `【大名单】${stageWord}名单公布：你入选！`
      : `【大名单】${stageWord}名单公布：你落选`,
    stageLabel: called ? `${stageWord}·已入选` : `${stageWord}·未入选`,
    nextWindowLabel: called
      ? '本周起进入国家队集训节奏，俱乐部比赛可能轮休'
      : '下一期窗口请保持出场与评分',
  }
}
