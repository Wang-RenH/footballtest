import { create } from 'zustand'
import type {
  AttributeKey,
  CreatePlayerInput,
  EventOption,
  GameEvent,
  GameState,
  MatchResult,
  Player,
  QueuedEventItem,
  ScreenId,
  SeasonState,
  TrainingFocus,
  TrainingResult,
} from '@/models/types'
import {
  createNewGame,
  getTeam,
  refreshPlayerOVR,
  TEAMS,
  tryEuropeTransferOffer,
} from '@/core/GameFactory'
import { applyEventOption, markEventUsed, mergeEffectsPreview, pickWeeklyEvent, buildPostMatchEvent } from '@/core/EventEngine'
import { applyTrainingDetailed, calcOVR, ATTR_LABELS } from '@/core/AttributeEngine'
import { applyBirthdayGrowth } from '@/core/BodyEngine'
import {
  advanceWeek,
  formatGameDate,
  getEffectiveCompetition,
  shouldBirthday,
  type WeekCompetition,
} from '@/core/TimeEngine'
import { applyMatchToPlayer, applyMatchToBoard, emptyInternational } from '@/core/MatchEngine'
import {
  applyWeeklyFinance,
  createContract,
  emptySeasonStats,
  getTransferWindow,
} from '@/core/FinanceEngine'
import { buildWeeklyBulletins, pushBulletin, rollNationalCamp } from '@/core/BulletinEngine'
import {
  getPlayerFixture,
  playPlayerMatchWeek,
  teamsInLeague,
  teamName,
  simulateLeagueRound,
  sortedStandings,
} from '@/core/LeagueEngine'
import { maybeAwardSeasonHonors, emptyStandingRows, archiveWorldSeason } from '@/core/HonorEngine'
import { careerBonusScore, gradeFromScore } from '@/core/GrowthScoreEngine'
import {
  saveGame,
  loadGame,
  clearSave,
  hasSave,
  appendCareerArchive,
} from '@/save/SaveManager'
import { createAIProvider, getEventMemoryBeat, monthBatchSize } from '@/ai/AIProvider'
import type { EventContext } from '@/ai/AIProvider'
import { useSettingsStore } from '@/store/settingsStore'
import { clamp, uid } from '@/utils/random'

type PrefetchResult =
  | { ok: true; queue: QueuedEventItem[] }
  | { ok: false; error: string }

let monthEventPrefetch: { key: string; promise: Promise<PrefetchResult> } | null = null
/** 等待 AI 重试时保留的已推进存档壳 */
let pendingAiBatchState: GameState | null = null
/** 递增以作废进行中的旧请求 */
let aiBatchGenId = 0

function clearMonthEventPrefetch() {
  monthEventPrefetch = null
}

function clearPendingAiBatch() {
  pendingAiBatchState = null
}

function invalidateAiBatchRequests() {
  aiBatchGenId += 1
  clearMonthEventPrefetch()
}

function monthEventPrefetchKey(state: GameState): string {
  return [
    state.time.year,
    state.time.month,
    state.time.week,
    state.player.age,
    state.player.OVR,
    state.history.length,
    (state.aiMemory ?? []).length,
  ].join('|')
}

function buildPlayerProfileBrief(player: Player): string {
  const h = player.hiddenAttributes
  const r = player.relationships
  const attrs = player.attributes
  const ranked = (Object.keys(attrs) as (keyof typeof attrs)[])
    .map((k) => ({ k, v: attrs[k] }))
    .sort((a, b) => b.v - a.v)
  const top = ranked.slice(0, 2).map((x) => x.k).join('/')
  const weak = ranked.slice(-2).map((x) => x.k).join('/')
  return `家庭${player.familyBackground} 惯用${player.preferredFoot} 特长约${top} 短板约${weak}；性格:决断${h.decision} 意志${h.workRate} 领袖${h.leadership} 抗压${h.composure} 职业${h.professionalism} 稳定${h.consistency} 伤病倾向${h.injuryProneness} 大赛${h.bigMatch} 适应${h.adaptability}；关系:父${r.father} 母${r.mother} 教练${r.coach} 队友${r.teammates} 媒体${r.media} 球迷${r.fans}；特质:${player.traits.join(',') || '无'}`
}

function competitionOf(state: GameState): WeekCompetition {
  return getEffectiveCompetition(
    state.time,
    state.player.age,
    state.season.leagueId,
    state.season.cupEliminated,
  )
}

function refreshInternational(
  year: number,
  age: number,
  ovr: number,
  prev?: import('@/models/types').InternationalState,
): import('@/models/types').InternationalState {
  const base = { ...emptyInternational(), ...(prev ?? {}) }
  if (age < 18) {
    return {
      ...base,
      stage: 'none',
      stageLabel: '青少年：观赛国字号',
      nextWindowLabel: '成年后按联赛表现进入国家队选拔视野',
    }
  }
  const wcYear = year % 4 === 2
  const asianCupYear = year % 4 === 0
  if (wcYear) {
    return {
      ...base,
      stage: 'wc_qualifier',
      stageLabel: base.calledUp ? '世界杯周期：考察/集训' : '世界杯周期：冲击大名单',
      nextWindowLabel: '亚洲区预选赛 / 附加赛窗口推进中',
    }
  }
  if (asianCupYear) {
    return {
      ...base,
      stage: 'asian_cup',
      stageLabel: '亚洲杯周期',
      nextWindowLabel: `${year} 亚洲杯及相关热身窗口`,
    }
  }
  return {
    ...base,
    stage: 'wc_qualifier',
    stageLabel: '世界杯亚洲区预选赛窗口期',
    nextWindowLabel: '40强赛 / 18强赛节奏推进中',
    calledUp: base.calledUp || ovr >= 74,
  }
}

function upcomingFixtureBrief(base: GameState): string {
  const comp = competitionOf(base)
  if (comp === 'none' || !base.player.currentTeamId || base.player.age < 18) {
    return '本周无正式比赛（轮空/休赛/日常）'
  }
  if (comp === 'cup') {
    return `本周足协杯第${base.season.cupRound}轮。赛前叙事禁止编造具体出场分钟/替补时间，比赛结果由引擎结算。`
  }
  const fix = getPlayerFixture(
    base.season.leagueId,
    base.player.currentTeamId,
    base.season.round,
    base.season.year,
  )
  if (!fix) return `本周联赛第${base.season.round + 1}轮（赛程轮空）`
  return `本周联赛第${fix.roundIndex + 1}轮：${fix.isHome ? '主场' : '客场'}对阵${teamName(fix.opponentId)}。赛前叙事禁止编造具体出场分钟/替补时间，比赛结果由引擎结算。`
}

function buildEventContext(base: GameState): EventContext {
  const match = base.week.lastMatch
  const lastMatchSummary = match
    ? (() => {
        const role =
          match.playerMinutes <= 0
            ? '未出场'
            : match.playerStarted
              ? match.playerSubOffMinute != null
                ? `首发并在${match.playerSubOffMinute}'被换下，共${match.playerMinutes}分钟`
                : `首发打满${match.playerMinutes}分钟`
              : `${match.playerSubOnMinute ?? '?'}'替补登场，共${match.playerMinutes}分钟（禁止写成打满90分钟）`
        const scoredAt = (match.events ?? [])
          .filter((e) => e.type === 'goal' && e.scorerName === base.player.name)
          .map((e) => `${e.minute}'`)
          .join('、')
        return `比分必须一致：${teamName(match.homeTeamId)} ${match.homeGoals}-${match.awayGoals} ${teamName(match.awayTeamId)}；出场身份：${role}；你进球${match.playerGoals}${scoredAt ? `（${scoredAt}）` : ''} 助攻${match.playerAssists} 评分${match.playerRating} 过人${match.playerDribbles ?? 0}（个人进球≤本队进球；出场分钟与身份禁止自相矛盾）`
      })()
    : undefined
  const clubs = teamsInLeague(base.season.leagueId)
  const table = sortedStandings(base.season.standings)
    .slice(0, 8)
    .map((row, i) => {
      const gd = row.goalsFor - row.goalsAgainst
      return `${i + 1}.${teamName(row.teamId)} ${row.points}分 净${gd > 0 ? '+' : ''}${gd} 赛${row.played}`
    })
    .join('；')
  return {
    player: base.player,
    age: base.player.age,
    weekLabel: formatGameDate(base.time),
    teamName: base.player.currentTeamId
      ? getTeam(base.player.currentTeamId).name
      : '无俱乐部',
    leagueId: base.season.leagueId,
    seasonRound: Math.max(base.season.round, 1),
    recentHistory: base.history,
    aiMemory: base.aiMemory ?? [],
    lastMatchSummary,
    lastTrainingNote: base.week.lastTrainingResult?.note,
    allowedClubNames: clubs.map((t) => t.name),
    leagueTableBrief: table || '积分榜尚未开打',
    playerProfileBrief: buildPlayerProfileBrief(base.player),
    upcomingFixtureBrief: upcomingFixtureBrief(base),
  }
}

/** 按赛程打本周正式比赛（联赛固定对手 / 杯赛种子对手） */
function runScheduledMatch(state: GameState): {
  player: Player
  season: SeasonState
  match: MatchResult
} | null {
  const player0 = state.player
  if (player0.age < 18 || !player0.currentTeamId) return null
  const competition = competitionOf(state)
  if (competition === 'none') return null

  const roundIndex =
    competition === 'league' ? state.season.round : Math.max(0, state.season.cupRound - 1)
  const { match, standings } = playPlayerMatchWeek(
    player0,
    state.season.standings,
    player0.currentTeamId,
    competition,
    roundIndex,
    state.season.year,
  )
  let player = applyMatchToPlayer(player0, match)
  player = refreshPlayerOVR(player)

  let season: SeasonState = {
    ...state.season,
    standings,
    round: competition === 'league' ? state.season.round + 1 : state.season.round,
    leagueBoard: state.season.leagueBoard ?? [],
    cupBoard: state.season.cupBoard ?? [],
    matchLog: state.season.matchLog ?? [],
    international: state.season.international ?? emptyInternational(),
  }
  if (competition === 'cup') {
    const won =
      (match.isHome && match.homeGoals > match.awayGoals) ||
      (!match.isHome && match.awayGoals > match.homeGoals)
    season = {
      ...season,
      cupRound: won ? season.cupRound + 1 : season.cupRound,
      cupEliminated: !won,
      cupBoard: applyMatchToBoard(season.cupBoard, match, player),
    }
  } else {
    season = {
      ...season,
      leagueBoard: applyMatchToBoard(season.leagueBoard, match, player),
    }
  }
  season = {
    ...season,
    matchLog: [match, ...season.matchLog].slice(0, 80),
  }
  return { player, season, match }
}

function localMonthQueue(base: GameState, count: number): QueuedEventItem[] {
  let used = [...base.usedEventIds]
  const items: QueuedEventItem[] = []
  for (let i = 0; i < count; i++) {
    const local = pickWeeklyEvent(base.player.age, used)
    used = markEventUsed(used, local.event)
    items.push({ event: local.event, source: local.source })
  }
  return items
}

function attachFromQueue(state: GameState): GameState | null {
  const queue = [...(state.eventQueue ?? [])]
  if (!queue.length) return null
  const item = queue.shift()!
  return {
    ...attachEvent(state, item.event, item.source, getEventMemoryBeat(item.event)),
    eventQueue: queue,
  }
}

function emptyWeekShell(state: GameState): GameState {
  return {
    ...state,
    eventQueue: state.eventQueue ?? [],
    week: {
      step: 'done',
      currentEvent: null,
      lastMatch: null,
      lastEventConsequence: null,
      lastTrainingResult: null,
      trainingDone: false,
      eventDone: false,
      eventSource: 'local',
      eventRole: 'normal',
      suggestedTraining: null,
    },
  }
}

async function fetchMonthQueue(
  base: GameState,
  opts?: { allowLocalFallback?: boolean },
): Promise<{
  queue: QueuedEventItem[]
  aiError: string | null
  /** true=AI 失败且未降级，需玩家刷新重试 */
  needsRetry: boolean
}> {
  const allowLocal = opts?.allowLocalFallback !== false
  const count = monthBatchSize(base.player.age)
  const settings = useSettingsStore.getState()
  const wantAi =
    settings.useAiEvents && settings.apiProvider !== 'none' && Boolean(settings.apiKey?.trim())

  if (wantAi) {
    const key = monthEventPrefetchKey(base)
    if (monthEventPrefetch?.key === key) {
      const result = await monthEventPrefetch.promise
      monthEventPrefetch = null
      if (result.ok) return { queue: result.queue, aiError: null, needsRetry: false }
      if (!allowLocal) {
        return { queue: [], aiError: result.error, needsRetry: true }
      }
      return {
        queue: localMonthQueue(base, count),
        aiError: `AI 失败已降级本地：${result.error}`,
        needsRetry: false,
      }
    }

    const provider = createAIProvider(
      settings.apiProvider,
      settings.apiKey,
      settings.apiEndpoint,
      settings.apiModel,
    )
    if (provider) {
      try {
        const events = await provider.generateMonthEvents(buildEventContext(base), count)
        return {
          queue: events.map((event) => ({ event, source: 'ai' as const })),
          aiError: null,
          needsRetry: false,
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'AI 生成失败'
        if (!allowLocal) {
          return { queue: [], aiError: msg, needsRetry: true }
        }
        return {
          queue: localMonthQueue(base, count),
          aiError: `AI 失败已降级本地：${msg}`,
          needsRetry: false,
        }
      }
    }
  }

  clearMonthEventPrefetch()
  return { queue: localMonthQueue(base, count), aiError: null, needsRetry: false }
}

function startMonthEventPrefetch(timed: GameState) {
  if (timed.retired) return
  if ((timed.eventQueue ?? []).length > 0) return
  const settings = useSettingsStore.getState()
  const wantAi =
    settings.useAiEvents && settings.apiProvider !== 'none' && Boolean(settings.apiKey?.trim())
  if (!wantAi) return
  const provider = createAIProvider(
    settings.apiProvider,
    settings.apiKey,
    settings.apiEndpoint,
    settings.apiModel,
  )
  if (!provider) return

  const key = monthEventPrefetchKey(timed)
  if (monthEventPrefetch?.key === key) return
  const count = monthBatchSize(timed.player.age)

  monthEventPrefetch = {
    key,
    promise: provider
      .generateMonthEvents(buildEventContext(timed), count)
      .then(
        (events): PrefetchResult => ({
          ok: true,
          queue: events.map((event) => ({ event, source: 'ai' as const })),
        }),
      )
      .catch(
        (e): PrefetchResult => ({
          ok: false,
          error: e instanceof Error ? e.message : 'AI 生成失败',
        }),
      ),
  }
}

interface GameStore {
  screen: ScreenId
  state: GameState | null
  hasExistingSave: boolean
  flash: string | null
  trainingModal: TrainingResult | null
  /** true=正在后台生成月度事件，不挡导航 */
  eventLoading: boolean
  /** AI 失败/超时，等待玩家点刷新 */
  awaitingAiRetry: boolean
  /** 本周伊始重新生成当前事件中 */
  regeneratingEvent: boolean
  aiError: string | null
  eventReadyToast: string | null
  customAdjudicating: boolean
  choiceVerdict: { verdict: string; consequence: string; preview: string } | null
  /** 从赛程页翻看历史赛果 */
  browsingMatchId: string | null

  setScreen: (s: ScreenId) => void
  refreshSaveFlag: () => void
  startNewGame: (input: CreatePlayerInput) => void
  continueGame: () => boolean
  chooseEventOption: (option: EventOption) => void
  submitCustomChoice: (text: string) => Promise<void>
  dismissChoiceVerdict: () => void
  chooseTraining: (focus: TrainingFocus) => void
  dismissTrainingModal: () => void
  acknowledgeMatch: () => void
  openMatchFromLog: (matchId: string) => void
  clearBrowsingMatch: () => void
  cancelEventLoading: () => void
  retryAiEventBatch: () => void
  regenerateCurrentWeekEvent: () => Promise<void>
  /** 卡在「本周已完成」无事件时，重新拉本周剧情 */
  resumeStuckWeek: () => void
  dismissEventReadyToast: () => void
  retireNow: () => void
  deleteSave: () => void
  acceptTransfer: (teamId: string) => void
}

function persist(state: GameState) {
  saveGame(state)
}

function assignTeamLazy(player: Player): string {
  const cityTeam = TEAMS.find((t) => t.city === player.birthCity && t.league === 'CSL')
  if (cityTeam) return cityTeam.id
  const csl = TEAMS.filter((t) => t.league === 'CSL')
  return csl[Math.floor(Math.random() * csl.length)]!.id
}

function archiveIfRetired(state: GameState) {
  if (!state.retired) return
  const team = state.player.currentTeamId ? getTeam(state.player.currentTeamId) : null
  appendCareerArchive({
    id: uid('archive'),
    finishedAt: Date.now(),
    playerName: state.player.name,
    position: state.player.position,
    birthCity: state.player.birthCity,
    finalAge: state.player.age,
    finalOvr: state.player.OVR,
    growthScore: state.player.growthScore,
    grade: state.retirementTitle ?? '',
    appearances: state.player.careerStats.appearances,
    goals: state.player.careerStats.goals,
    assists: state.player.careerStats.assists,
    honors: state.player.honors,
    teamName: team?.name ?? '无俱乐部',
    seasonsPlayed: state.season.seasonHistory.length,
  })
}

function finishRetirement(state: GameState): GameState {
  const bonus = careerBonusScore({
    appearances: state.player.careerStats.appearances,
    goals: state.player.careerStats.goals,
    assists: state.player.careerStats.assists,
    avgRating: state.player.careerStats.avgRating || 6,
    ovr: state.player.OVR,
  })
  const total = state.player.growthScore + bonus
  const grade = gradeFromScore(total)
  const retired: GameState = {
    ...state,
    player: { ...state.player, growthScore: total },
    retired: true,
    retirementTitle: `${grade.title} · ${grade.en}`,
    history: [...state.history, `退役揭晓：成长分 ${total}，评级「${grade.title}」。`],
  }
  archiveIfRetired(retired)
  return retired
}

/** 只推进时间/赛季，不抽事件 */
function advanceTimeOnly(state: GameState): GameState {
  let player = { ...state.player }
  let time = { ...state.time }
  let season = { ...state.season, standings: state.season.standings.map((s) => ({ ...s })) }
  const history = [...state.history]
  const aiMemory = [...(state.aiMemory ?? [])]

  player.fatigue = clamp(player.fatigue - 6, 0, 100)

  const steps = player.age < 18 ? 24 : 1
  for (let i = 0; i < steps; i++) {
    time = advanceWeek(time)

    // 少年期：每周推进世界联赛一轮（无球员正式赛）
    // 职业期：轮次只由赛程比赛 runScheduledMatch 推进，避免重复/乱序对手
    if (player.age < 18) {
      season = {
        ...season,
        standings: simulateLeagueRound(season.standings),
        round: season.round + 1,
      }
    }

    if (time.month === 12 && time.week === 1) {
      if (player.age >= 18) {
        const awarded = maybeAwardSeasonHonors(player, season, season.year)
        player = awarded.player
        if (awarded.honors.length) {
          const line = `${season.year} 赛季荣誉：${awarded.honors.map((h) => h.name).join('、')}`
          history.push(line)
          aiMemory.push(line)
        }
        season = {
          ...season,
          seasonHistory: [...season.seasonHistory, awarded.snapshot],
          year: time.year + 1,
          round: 0,
          cupRound: 1,
          cupEliminated: false,
          standings: emptyStandingRows(teamsInLeague(season.leagueId).map((t) => t.id)),
          leagueBoard: [],
          cupBoard: [],
          matchLog: [],
          international: refreshInternational(
            time.year + 1,
            player.age,
            player.OVR,
            season.international,
          ),
        }
        player = { ...player, seasonStats: emptySeasonStats() }
      } else {
        const snap = archiveWorldSeason(season, season.year)
        const champ = snap.championTeamId ? getTeam(snap.championTeamId).name : '未知'
        history.push(`${season.year} 中超落幕：冠军 ${champ}`)
        aiMemory.push(`${season.year}赛季冠军 ${champ}`)
        season = {
          ...season,
          seasonHistory: [...season.seasonHistory, snap],
          year: time.year + 1,
          round: 0,
          cupRound: 1,
          cupEliminated: false,
          standings: emptyStandingRows(teamsInLeague(season.leagueId).map((t) => t.id)),
          leagueBoard: [],
          cupBoard: [],
          matchLog: [],
          international: refreshInternational(
            time.year + 1,
            player.age,
            player.OVR,
            season.international,
          ),
        }
        player = { ...player, seasonStats: emptySeasonStats() }
      }
      history.push(`${season.year} 新赛季开始。`)
    }

    if (shouldBirthday(time)) {
      player.age += 1
      const body = applyBirthdayGrowth(player.age, player.adultHeightCm, player.adultWeightKg)
      player.heightCm = body.heightCm
      player.weightKg = body.weightKg
      const birthLine = `${formatGameDate(time)}：${player.name} ${player.age} 岁（${player.heightCm}cm / ${player.weightKg}kg）`
      history.push(birthLine)
      aiMemory.push(`${player.age}岁生日`)

      if (player.age === 18 && !player.currentTeamId) {
        player.currentTeamId = assignTeamLazy(player)
        const club = getTeam(player.currentTeamId)
        player.contract = createContract(player, club, time)
        player.funds += 15000 + player.contract.signingBonus
        season.playerTeamId = player.currentTeamId
        history.push(
          `你正式加盟${club.name}！${player.contract.weeklyWage} 周薪，签约至 ${player.contract.expiresYear}年。`,
        )
        aiMemory.push(`18岁加盟 ${club.name}`)
      }

      const offer = tryEuropeTransferOffer(player)
      if (offer) {
        const club = getTeam(offer)
        history.push(`【转会邀约】${club.name}（${club.league}）向你抛出橄榄枝。ID:${offer}`)
        aiMemory.push(`收到 ${club.name} 转会邀约`)
      }

      if (player.age > 38) {
        return finishRetirement({ ...state, player, time, season, history, aiMemory })
      }

      if (player.age === 7 && player.interest < 25 && state.mode === 'career') {
        return finishRetirement({
          ...state,
          player,
          time,
          season,
          history: [...history, '对足球的兴趣逐渐淡去，这条路走到了尽头。'],
          aiMemory,
        })
      }
    }
  }

  // 周薪 / 生活费（替代旧的固定补贴）
  const finance = applyWeeklyFinance(player, time)
  player = finance.player
  history.push(...finance.lines.slice(0, 2))

  player = refreshPlayerOVR(player)

  let bulletin = [...(state.bulletin ?? [])]
  if (finance.bulletin) {
    bulletin = pushBulletin(bulletin, {
      dateLabel: formatGameDate(time),
      ...finance.bulletin,
    })
  }

  // 国字号阶段 + 集训大名单掷骰
  let international = refreshInternational(
    time.year,
    player.age,
    player.OVR,
    season.international,
  )
  international = rollNationalCamp(player, time, international)
  if (international.calledUp && international.campStatus === 'provisional') {
    international = { ...international, caps: international.caps + 0 }
    // 入选集训不自动加帽，正式比赛再加；这里只发刊报
  }
  season = { ...season, international }

  const weeklyNews = buildWeeklyBulletins({
    ...state,
    player,
    time,
    season,
    bulletin,
  })
  for (const n of weeklyNews.slice(0, 2)) {
    bulletin = pushBulletin(bulletin, n)
  }

  const tw = getTransferWindow(time)
  if (tw && time.week === 1) {
    aiMemory.push(tw === 'winter' ? '冬窗开启' : '夏窗开启')
  }

  return {
    ...state,
    player,
    time,
    season: {
      ...season,
      year: Math.max(season.year, time.year),
      playerTeamId: player.currentTeamId ?? season.playerTeamId,
    },
    history: history.slice(-80),
    aiMemory: aiMemory.slice(-40),
    eventQueue: state.eventQueue ?? [],
    bulletin: bulletin.slice(0, 40),
    week: {
      step: 'done',
      currentEvent: null,
      lastMatch: null,
      lastEventConsequence: null,
      lastTrainingResult: null,
      trainingDone: false,
      eventDone: false,
      eventSource: 'local',
      eventRole: 'normal',
      suggestedTraining: null,
    },
  }
}

function resolveEventRole(state: GameState): 'normal' | 'prematch' | 'postmatch' {
  return competitionOf(state) === 'none' ? 'normal' : 'prematch'
}

function attachEvent(
  state: GameState,
  event: GameEvent,
  source: 'local' | 'ai' | 'generic',
  memoryBeat?: string | null,
  role?: 'normal' | 'prematch' | 'postmatch',
): GameState {
  const used = markEventUsed(state.usedEventIds, event)
  const aiMemory = [...(state.aiMemory ?? [])]
  if (memoryBeat) aiMemory.push(memoryBeat)
  else if (source === 'ai') aiMemory.push(event.narrative.slice(0, 60))
  const eventRole = role ?? resolveEventRole(state)

  return {
    ...state,
    usedEventIds: used,
    aiMemory: aiMemory.slice(-40),
    eventQueue: state.eventQueue ?? [],
    week: {
      step: 'event',
      currentEvent: event,
      lastMatch: state.week.lastMatch,
      lastEventConsequence: null,
      lastTrainingResult: null,
      trainingDone: false,
      eventDone: false,
      eventSource: source,
      eventRole,
      suggestedTraining: state.week.suggestedTraining ?? null,
    },
  }
}

function localCustomVerdict(intent: string): {
  option: EventOption
  verdict: string
} {
  const harsh = /偷懒|摆烂|拒绝|逃|骂|摆|摸鱼|装病/.test(intent)
  const bold = /加练|拼命|冲|赌|冒险|顶撞/.test(intent)
  if (harsh) {
    return {
      verdict: '你的态度被看在眼里，短期轻松，长期信誉受损。',
      option: {
        id: 'custom',
        text: intent.slice(0, 40),
        consequenceText: '周围人开始对你有看法，训练氛围也冷了些。',
        effects: { growthScore: -20, morale: -6, fatigue: -4, relationships: { coach: -4, teammates: -3 } },
      },
    }
  }
  if (bold) {
    return {
      verdict: '你押上了身体与名誉，结果好坏参半。',
      option: {
        id: 'custom',
        text: intent.slice(0, 40),
        consequenceText: '你拼出了存在感，也把疲劳和风险一起扛上了肩。',
        effects: { growthScore: 35, fatigue: 12, morale: 4, interest: 3 },
      },
    }
  }
  return {
    verdict: '你的做法不算出格，影响中性偏稳。',
    option: {
      id: 'custom',
      text: intent.slice(0, 40),
      consequenceText: '事情按你的方式推进了一点，没有大起大落。',
      effects: { growthScore: 12, morale: 2 },
    },
  }
}

function applyChosenOption(
  get: () => GameStore,
  set: (
    partial: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>),
  ) => void,
  option: EventOption,
  customVerdict: string | null,
) {
  const cur = get().state
  if (!cur || cur.week.step !== 'event' || !cur.week.currentEvent || get().eventLoading) return
  if (get().regeneratingEvent || get().customAdjudicating) return

  const retireChoice =
    cur.week.currentEvent.id === 'AGE_36_RETIRE_TALK_001' && option.id === 'a'

  const { player, consequence } = applyEventOption(cur.player, option)
  const refreshed = refreshPlayerOVR(player)
  refreshed.OVR = calcOVR(refreshed.attributes, refreshed.position)

  const memory = [...(cur.aiMemory ?? [])]
  memory.push(`选择：${option.text} → ${consequence.slice(0, 40)}`)

  if (retireChoice) {
    const retired = finishRetirement({
      ...cur,
      player: refreshed,
      history: [...cur.history.slice(-40), consequence],
      aiMemory: memory,
    })
    set({
      state: retired,
      screen: 'retirement',
      flash: consequence,
      customAdjudicating: false,
      choiceVerdict: null,
    })
    persist(retired)
    return
  }

  const role = cur.week.eventRole ?? 'normal'

  // 赛前抉择 → 直接进入本周正式比赛（训练留到赛后）
  if (role === 'prematch') {
    const played = runScheduledMatch({ ...cur, player: refreshed })
    if (played) {
      const nextMatch: GameState = {
        ...cur,
        player: played.player,
        season: played.season,
        aiMemory: memory.slice(-40),
        week: {
          ...cur.week,
          eventDone: true,
          lastEventConsequence: consequence,
          lastMatch: played.match,
          step: 'match',
          trainingDone: false,
          currentEvent: cur.week.currentEvent,
        },
        history: [...cur.history.slice(-40), consequence],
      }
      const preview = mergeEffectsPreview(option.effects)
      if (customVerdict) {
        set({
          state: nextMatch,
          customAdjudicating: false,
          choiceVerdict: {
            verdict: customVerdict,
            consequence,
            preview,
          },
          flash: null,
        })
      } else {
        set({
          state: nextMatch,
          screen: 'match',
          flash: consequence,
          customAdjudicating: false,
          choiceVerdict: null,
        })
      }
      persist(nextMatch)
      return
    }
  }

  const next: GameState = {
    ...cur,
    player: refreshed,
    aiMemory: memory.slice(-40),
    week: {
      ...cur.week,
      eventDone: true,
      lastEventConsequence: consequence,
      step: 'training',
      trainingDone: false,
      currentEvent: cur.week.currentEvent,
    },
    history: [...cur.history.slice(-40), consequence],
  }

  const preview = mergeEffectsPreview(option.effects)
  if (customVerdict) {
    set({
      state: next,
      customAdjudicating: false,
      choiceVerdict: {
        verdict: customVerdict,
        consequence,
        preview,
      },
      flash: null,
    })
  } else {
    set({
      state: next,
      screen: 'training',
      flash: consequence,
      customAdjudicating: false,
      choiceVerdict: null,
    })
  }
  persist(next)
}

/** 非阻断：有队列则立刻出事件；否则进主界面加载，可浏览其他页 */
function beginNextPeriod(
  set: (
    partial: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>),
  ) => void,
  timed: GameState,
) {
  if (timed.retired) {
    set({ state: timed, screen: 'retirement', eventLoading: false, trainingModal: null })
    persist(timed)
    return
  }

  const fromQueue = attachFromQueue({ ...timed, eventQueue: timed.eventQueue ?? [] })
  if (fromQueue) {
    set({
      state: fromQueue,
      screen: 'dashboard',
      eventLoading: false,
      trainingModal: null,
      aiError: null,
    })
    persist(fromQueue)
    return
  }

  const shell = emptyWeekShell(timed)
  pendingAiBatchState = timed
  set({
    state: shell,
    screen: 'dashboard',
    eventLoading: true,
    trainingModal: null,
    aiError: null,
    eventReadyToast: null,
    awaitingAiRetry: false,
  })
  persist(shell)

  void runAiBatchGeneration(set, timed)
}

async function runAiBatchGeneration(
  set: (
    partial: Partial<GameStore> | ((s: GameStore) => Partial<GameStore>),
  ) => void,
  timed: GameState,
) {
  const genId = ++aiBatchGenId
  clearMonthEventPrefetch()

  const settings = useSettingsStore.getState()
  const wantAi =
    settings.useAiEvents && settings.apiProvider !== 'none' && Boolean(settings.apiKey?.trim())

  const { queue, aiError, needsRetry } = await fetchMonthQueue(timed, {
    allowLocalFallback: !wantAi,
  })

  if (genId !== aiBatchGenId) return

  if (needsRetry) {
    pendingAiBatchState = timed
    set({
      eventLoading: false,
      awaitingAiRetry: true,
      aiError: aiError ?? 'AI 请求失败',
      flash: aiError ?? 'AI 请求失败，可点击刷新重试',
      eventReadyToast: null,
    })
    return
  }

  const attached = attachFromQueue({ ...timed, eventQueue: queue })
  const fallback = pickWeeklyEvent(timed.player.age, timed.usedEventIds)
  const next =
    attached ??
    attachEvent({ ...timed, eventQueue: [] }, fallback.event, fallback.source, null)
  const readyMsg =
    monthBatchSize(timed.player.age) > 1
      ? '本月剧情已就绪，可以继续本周事件了'
      : '新章节剧情已就绪，可以继续了'
  clearPendingAiBatch()
  set({
    state: next,
    eventLoading: false,
    awaitingAiRetry: false,
    aiError,
    flash: aiError,
    eventReadyToast: aiError ? null : readyMsg,
  })
  persist(next)
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'home',
  state: null,
  hasExistingSave: hasSave(),
  flash: null,
  trainingModal: null,
  eventLoading: false,
  awaitingAiRetry: false,
  regeneratingEvent: false,
  aiError: null,
  eventReadyToast: null,
  customAdjudicating: false,
  choiceVerdict: null,
  browsingMatchId: null,

  setScreen: (s) => {
    set({ screen: s })
  },

  refreshSaveFlag: () => set({ hasExistingSave: hasSave() }),

  startNewGame: (input) => {
    const state = createNewGame(input)
    persist(state)
    clearPendingAiBatch()
    invalidateAiBatchRequests()
    set({
      state,
      screen: 'dashboard',
      hasExistingSave: true,
      flash: null,
      trainingModal: null,
      eventLoading: false,
      aiError: null,
      eventReadyToast: null,
      customAdjudicating: false,
      choiceVerdict: null,
      awaitingAiRetry: false,
      regeneratingEvent: false,
    })
  },

  continueGame: () => {
    const slot = loadGame()
    if (!slot) return false
    clearMonthEventPrefetch()
    clearPendingAiBatch()
    invalidateAiBatchRequests()
    set({
      state: slot.state,
      screen: slot.state.retired ? 'retirement' : 'dashboard',
      hasExistingSave: true,
      trainingModal: null,
      eventLoading: false,
      aiError: null,
      eventReadyToast: null,
      customAdjudicating: false,
      choiceVerdict: null,
      awaitingAiRetry: false,
      regeneratingEvent: false,
    })
    // 续档若卡在无事件的 done，自动接上
    const st = slot.state
    if (
      !st.retired &&
      st.week.step === 'done' &&
      !st.week.currentEvent
    ) {
      queueMicrotask(() => get().resumeStuckWeek())
    }
    return true
  },

  chooseEventOption: (option) => {
    applyChosenOption(get, set, option, null)
  },

  submitCustomChoice: async (text) => {
    const cur = get().state
    if (
      !cur ||
      cur.week.step !== 'event' ||
      !cur.week.currentEvent ||
      get().eventLoading ||
      get().customAdjudicating
    ) {
      return
    }
    const intent = text.trim().slice(0, 200)
    if (!intent) return

    set({ customAdjudicating: true, aiError: null })
    const settings = useSettingsStore.getState()
    const wantAi =
      settings.useAiEvents && settings.apiProvider !== 'none' && Boolean(settings.apiKey?.trim())
    const provider = wantAi
      ? createAIProvider(
          settings.apiProvider,
          settings.apiKey,
          settings.apiEndpoint,
          settings.apiModel,
        )
      : null

    try {
      let verdictText: string
      let option: EventOption
      if (provider) {
        const result = await provider.adjudicateCustomChoice(
          buildEventContext(cur),
          cur.week.currentEvent.narrative,
          intent,
        )
        option = result.option
        verdictText = result.verdict
      } else {
        const local = localCustomVerdict(intent)
        option = local.option
        verdictText = local.verdict
      }
      applyChosenOption(get, set, option, verdictText)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '自定义裁定失败'
      set({
        customAdjudicating: false,
        aiError: msg,
        flash: msg,
      })
    }
  },

  dismissChoiceVerdict: () => {
    const step = get().state?.week.step
    set({
      choiceVerdict: null,
      screen: step === 'match' ? 'match' : 'training',
    })
  },

  chooseTraining: (focus) => {
    const cur = get().state
    if (!cur || cur.week.step !== 'training' || cur.week.trainingDone || get().eventLoading) return
    if (get().trainingModal) return

    let player = { ...cur.player, attributes: { ...cur.player.attributes } }
    const fatigueBefore = player.fatigue
    const ovrBefore = player.OVR
    let result: TrainingResult

    if (focus !== 'REST') {
      const trained = applyTrainingDetailed(
        player.attributes,
        focus as AttributeKey,
        player.age,
        player.potential,
        player.hiddenAttributes.workRate,
        player.position,
      )
      player.attributes = trained.attrs
      player.fatigue = clamp(player.fatigue + 8, 0, 100)
      player = refreshPlayerOVR(player)
      result = {
        focus,
        deltas: trained.deltas,
        ovrBefore: trained.ovrBefore,
        ovrAfter: trained.ovrAfter,
        fatigueBefore,
        fatigueAfter: player.fatigue,
        note:
          trained.deltas.length > 0
            ? trained.deltas
                .map(
                  (d) =>
                    `${ATTR_LABELS[d.key]} ${d.before}→${d.after}（${d.delta > 0 ? '+' : ''}${d.delta}）`,
                )
                .join('，')
            : '本周训练未能拉开明显差距，继续坚持。',
      }
    } else {
      player.fatigue = clamp(player.fatigue - 20, 0, 100)
      player.morale = clamp(player.morale + 3, 0, 100)
      player = refreshPlayerOVR(player)
      result = {
        focus: 'REST',
        deltas: [],
        ovrBefore,
        ovrAfter: player.OVR,
        fatigueBefore,
        fatigueAfter: player.fatigue,
        note: `休息恢复：疲劳 ${fatigueBefore}→${player.fatigue}`,
      }
    }

    if (player.injury) {
      const weeksLeft = player.injury.weeksLeft - 1
      player.injury = weeksLeft <= 0 ? null : { ...player.injury, weeksLeft }
      if (!player.injury) player.morale = clamp(player.morale + 5, 0, 100)
    }

    const next: GameState = {
      ...cur,
      player,
      week: {
        ...cur.week,
        trainingDone: true,
        lastTrainingResult: result,
        step: 'training',
      },
    }
    set({ state: next, trainingModal: result, flash: null })
    persist(next)

    // 训练后即本周收尾：读结果时预生成下周，缩短等待
    const timed = advanceTimeOnly({
      ...next,
      week: { ...next.week, step: 'done' },
    })
    startMonthEventPrefetch(timed)
  },

  dismissTrainingModal: () => {
    const cur = get().state
    const modal = get().trainingModal
    if (!cur || !modal || get().eventLoading) {
      set({ trainingModal: null })
      return
    }

    // 比赛已在赛前抉择后完成；训练后只推进时间
    const withTraining: GameState = {
      ...cur,
      week: { ...cur.week, lastTrainingResult: modal, step: 'done' },
    }
    const timed = advanceTimeOnly(withTraining)
    beginNextPeriod(set, timed)
  },

  acknowledgeMatch: () => {
    const cur = get().state
    if (!cur || cur.week.step !== 'match' || get().eventLoading) return
    const match = cur.week.lastMatch
    if (!match) {
      beginNextPeriod(
        set,
        advanceTimeOnly({ ...cur, week: { ...cur.week, step: 'done' } }),
      )
      return
    }

    const { event, suggestedTraining } = buildPostMatchEvent(cur.player, match)
    const attached = attachEvent(cur, event, 'local', '赛后复盘', 'postmatch')
    const next: GameState = {
      ...attached,
      week: {
        ...attached.week,
        lastMatch: match,
        lastTrainingResult: cur.week.lastTrainingResult,
        suggestedTraining,
        eventRole: 'postmatch',
      },
    }
    set({
      state: next,
      screen: 'event',
      flash: '比赛结束，教练组安排赛后复盘',
      trainingModal: null,
      browsingMatchId: null,
    })
    persist(next)
  },

  openMatchFromLog: (matchId) => {
    set({ browsingMatchId: matchId, screen: 'match' })
  },

  clearBrowsingMatch: () => {
    set({ browsingMatchId: null })
  },

  cancelEventLoading: () => {
    const cur = get().state
    invalidateAiBatchRequests()
    const base = pendingAiBatchState ?? cur
    clearPendingAiBatch()
    if (!base) {
      set({ eventLoading: false, awaitingAiRetry: false, eventReadyToast: null })
      return
    }
    // 即使当前不是 loading，也可用于「本周已完成无事件」脱困
    const count = monthBatchSize(base.player.age)
    const queue = localMonthQueue(base, count)
    const next = attachFromQueue({ ...base, eventQueue: queue })!
    set({
      state: next,
      screen: 'dashboard',
      eventLoading: false,
      awaitingAiRetry: false,
      aiError: null,
      flash: '已用本地事件继续',
      eventReadyToast: null,
    })
    persist(next)
  },

  retryAiEventBatch: () => {
    const timed = pendingAiBatchState
    if (!timed || get().eventLoading) return
    set({
      eventLoading: true,
      awaitingAiRetry: false,
      aiError: null,
      flash: null,
      eventReadyToast: null,
    })
    void runAiBatchGeneration(set, timed)
  },

  regenerateCurrentWeekEvent: async () => {
    const cur = get().state
    // 仅本周伊始：有事件、尚未选择
    if (
      !cur ||
      cur.week.step !== 'event' ||
      !cur.week.currentEvent ||
      cur.week.eventDone ||
      cur.week.eventRole === 'postmatch' ||
      get().eventLoading ||
      get().awaitingAiRetry ||
      get().customAdjudicating ||
      get().regeneratingEvent
    ) {
      return
    }

    const settings = useSettingsStore.getState()
    const wantAi =
      settings.useAiEvents && settings.apiProvider !== 'none' && Boolean(settings.apiKey?.trim())
    if (!wantAi) {
      set({ flash: '请先在设置中启用 AI 并填写 Key' })
      return
    }
    const provider = createAIProvider(
      settings.apiProvider,
      settings.apiKey,
      settings.apiEndpoint,
      settings.apiModel,
    )
    if (!provider) {
      set({ flash: '无法创建 AI 服务，请检查设置' })
      return
    }

    set({ regeneratingEvent: true, aiError: null, flash: '正在重新生成本周事件…' })
    try {
      const event = await provider.generateEvent({
        ...buildEventContext(cur),
        priorNarratives: [cur.week.currentEvent.narrative.slice(0, 48)],
      })
      const beat = getEventMemoryBeat(event)
      const aiMemory = [...(cur.aiMemory ?? [])]
      if (beat) aiMemory.push(beat)
      else aiMemory.push(event.narrative.slice(0, 60))

      const next: GameState = {
        ...cur,
        usedEventIds: markEventUsed(cur.usedEventIds, event),
        aiMemory: aiMemory.slice(-40),
        week: {
          ...cur.week,
          currentEvent: event,
          eventSource: 'ai',
          eventDone: false,
          step: 'event',
        },
      }
      set({
        state: next,
        regeneratingEvent: false,
        flash: '已重新生成本周事件',
        screen: 'dashboard',
      })
      persist(next)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '重新生成失败'
      set({
        regeneratingEvent: false,
        aiError: msg,
        flash: `重新生成失败：${msg}`,
      })
    }
  },

  resumeStuckWeek: () => {
    const cur = get().state
    if (!cur || cur.retired || get().eventLoading || get().regeneratingEvent) return
    // 训练/比赛中途不抢
    if (cur.week.step === 'training' || cur.week.step === 'match') return
    if (cur.week.step === 'event' && cur.week.currentEvent) return

    // 无事件的 done / 空壳：用当前时间轴重新拉事件（时间已推进过则不再 advance）
    const base: GameState = {
      ...cur,
      week: {
        ...cur.week,
        step: 'done',
        currentEvent: null,
      },
    }
    pendingAiBatchState = base
    beginNextPeriod(set, base)
  },

  dismissEventReadyToast: () => {
    set({ eventReadyToast: null })
  },

  acceptTransfer: (teamId) => {
    const cur = get().state
    if (!cur || get().eventLoading) return
    const club = getTeam(teamId)
    const contract = createContract(cur.player, club, cur.time)
    const player = {
      ...cur.player,
      currentTeamId: teamId,
      funds: cur.player.funds + 50000 + contract.signingBonus,
      contract,
      seasonStats: emptySeasonStats(),
      relationships: { ...cur.player.relationships, fans: 40, coach: 55 },
    }
    const leagueTeams = teamsInLeague(club.league)
    const next: GameState = {
      ...cur,
      player,
      season: {
        ...cur.season,
        leagueId: club.league,
        playerTeamId: teamId,
        standings: emptyStandingRows(leagueTeams.map((t) => t.id)),
        round: 0,
        cupRound: 1,
        cupEliminated: false,
        leagueBoard: [],
        cupBoard: [],
        matchLog: [],
      },
      history: [
        ...cur.history,
        `你正式加盟 ${club.name}（${club.league}）！周薪 ¥${contract.weeklyWage.toLocaleString()}`,
      ],
      aiMemory: [...(cur.aiMemory ?? []), `加盟 ${club.name}`].slice(-40),
      bulletin: pushBulletin(cur.bulletin ?? [], {
        dateLabel: formatGameDate(cur.time),
        category: 'transfer',
        headline: `转会达成：加盟${club.name}`,
        body: `签约周薪 ¥${contract.weeklyWage.toLocaleString()}，约月薪 ¥${contract.monthlyWage.toLocaleString()}，至 ${contract.expiresYear}年${contract.expiresMonth}月。`,
      }),
    }
    set({ state: next, flash: `欢迎来到 ${club.name}` })
    persist(next)
  },

  retireNow: () => {
    const cur = get().state
    if (!cur || get().eventLoading) return
    const retired = finishRetirement(cur)
    set({ state: retired, screen: 'retirement' })
    persist(retired)
  },

  deleteSave: () => {
    clearSave()
    clearPendingAiBatch()
    invalidateAiBatchRequests()
    set({
      state: null,
      hasExistingSave: false,
      screen: 'home',
      trainingModal: null,
      eventLoading: false,
      awaitingAiRetry: false,
      regeneratingEvent: false,
      aiError: null,
      eventReadyToast: null,
      choiceVerdict: null,
    })
  },
}))
