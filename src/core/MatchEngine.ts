import type {
  MatchEvent,
  MatchLineupRating,
  MatchResult,
  Player,
  SeasonBoardRow,
  Team,
} from '@/models/types'
import { poissonSample, uid, clamp } from '@/utils/random'
import { generateSquad, pickTeammateName } from '@/core/SquadEngine'
import { emptySeasonStats, syncSeasonStatsFromMatch } from '@/core/FinanceEngine'
import { rollInjuryChance } from '@/core/InjuryEngine'

interface Appearance {
  started: boolean
  minutes: number
  subOn: number | null
  subOff: number | null
}

/** 出场身份与分钟一次掷骰，叙事必须对齐此结果 */
export function rollPlayerAppearance(player: Player): Appearance {
  if (player.injury) {
    return { started: false, minutes: 0, subOn: null, subOff: null }
  }

  const coach = player.relationships.coach
  let startChance = 0.5 + (player.OVR - 65) * 0.018 + (coach - 50) * 0.004
  startChance = clamp(startChance, 0.12, 0.9)
  if (player.fatigue > 80) startChance *= 0.7

  if (Math.random() < startChance) {
    const fullChance = 0.4 + coach / 250 - player.fatigue / 400
    if (Math.random() < fullChance) {
      return { started: true, minutes: 90, subOn: null, subOff: null }
    }
    const off = 55 + Math.floor(Math.random() * 28) // 55–82
    return { started: true, minutes: off, subOn: null, subOff: off }
  }

  // 替补：晚些登场，分钟=90-上场分钟
  const on = 58 + Math.floor(Math.random() * 25) // 58–82
  return { started: false, minutes: 90 - on, subOn: on, subOff: null }
}

function onPitch(minute: number, app: Appearance): boolean {
  if (app.minutes <= 0) return false
  if (app.started) {
    if (app.subOff != null) return minute >= 1 && minute <= app.subOff
    return minute >= 1 && minute <= 90
  }
  if (app.subOn != null) return minute >= app.subOn && minute <= 90
  return false
}

function randomMinute(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

export function simulateLeagueMatch(
  home: Team,
  away: Team,
  player: Player,
  playerIsHome: boolean,
  competition: MatchResult['competition'] = 'league',
  seasonYear = 2026,
  roundLabel?: string,
): MatchResult {
  const homeStr = home.strength + (playerIsHome ? playerImpact(player) : 0)
  const awayStr = away.strength + (!playerIsHome ? playerImpact(player) : 0)
  const diff = (homeStr - awayStr) / 100

  let homeXg = 1.25 + diff * 1.8
  let awayXg = 1.05 - diff * 1.8
  homeXg = Math.max(0.3, homeXg)
  awayXg = Math.max(0.3, awayXg)

  let homeGoals = poissonSample(homeXg)
  let awayGoals = poissonSample(awayXg)

  const form = (player.morale - 50) / 100
  const fatiguePen = player.fatigue / 200
  const injured = player.injury != null
  const app = rollPlayerAppearance(player)

  const attackBias = ['ST', 'CF', 'LW', 'RW', 'CAM'].includes(player.position)
  const midBias = ['CM', 'CDM', 'CAM'].includes(player.position)

  let playerGoals = 0
  let playerAssists = 0
  const myTeamGoals = playerIsHome ? homeGoals : awayGoals

  if (!injured && app.minutes > 0 && myTeamGoals > 0) {
    const goalChance = attackBias
      ? 0.28 + player.attributes.SHO / 350 + form
      : midBias
        ? 0.1 + player.attributes.SHO / 450
        : 0.04
    if (Math.random() < goalChance - fatiguePen) {
      const want = Math.random() < 0.18 ? 2 : 1
      playerGoals = Math.min(want, myTeamGoals)
    }

    const teammateGoals = myTeamGoals - playerGoals
    if (teammateGoals > 0) {
      const assistChance =
        midBias || attackBias ? 0.18 + player.attributes.PAS / 380 : 0.06
      if (Math.random() < assistChance - fatiguePen) {
        playerAssists = Math.min(1, teammateGoals)
      }
    }
  }

  let cleanSheetBonus = 0
  if (player.position === 'GK' && !injured && app.minutes > 0) {
    const teamGoalsAgainst = playerIsHome ? awayGoals : homeGoals
    if (teamGoalsAgainst === 0) cleanSheetBonus = 1.2
  }

  const playerDribbles =
    app.minutes <= 0
      ? 0
      : Math.max(
          0,
          Math.floor(
            (player.attributes.DRI / 40) * (app.minutes / 90) +
              Math.random() * 3 -
              (attackBias ? 0 : 1),
          ),
        )

  const { events, goalMeta, effectivePlayerGoals, effectivePlayerAssists } = buildMatchTimeline({
    home,
    away,
    homeGoals,
    awayGoals,
    player,
    playerIsHome,
    app,
    playerGoals,
    playerAssists,
    seasonYear,
  })
  // 以时间轴为准，避免「统计进了球但事件不是你」
  playerGoals = effectivePlayerGoals
  playerAssists = effectivePlayerAssists

  // 评分按时间轴确认后的进球/助攻计算
  let rating =
    6.0 +
    player.OVR / 50 +
    form -
    fatiguePen +
    playerGoals * 0.9 +
    playerAssists * 0.6 +
    cleanSheetBonus +
    (Math.random() * 0.8 - 0.4)
  if (injured || app.minutes === 0) rating = 5.0
  if (playerGoals >= 2) rating = Math.max(rating, 8.2)
  if (myTeamGoals === 0 && playerGoals === 0 && !injured && app.minutes > 0) {
    rating = Math.min(rating, 7.2)
  }
  if (!app.started && app.minutes > 0 && app.minutes < 25) {
    rating = Math.min(rating, 7.4)
  }
  rating = Math.round(clamp(rating, 4.0, 10.0) * 10) / 10

  const lineupRatings = buildLineupRatings({
    home,
    away,
    player,
    playerIsHome,
    app,
    rating,
    playerGoals,
    playerAssists,
    playerDribbles,
    seasonYear,
    events,
  })

  const motm =
    [...lineupRatings].sort((a, b) => b.rating - a.rating)[0]?.name ?? player.name

  const mediaComments = buildMediaComments({
    player,
    rating,
    playerGoals,
    playerAssists,
    app,
    homeGoals,
    awayGoals,
    playerIsHome,
    home,
    away,
    motm,
  })

  const highlights = buildHighlightsFromTimeline(
    home,
    away,
    homeGoals,
    awayGoals,
    player,
    app,
    playerGoals,
    playerAssists,
    injured,
    goalMeta,
  )

  return {
    id: uid('match'),
    homeTeamId: home.id,
    awayTeamId: away.id,
    homeGoals,
    awayGoals,
    playerRating: rating,
    playerGoals,
    playerAssists,
    playerMinutes: app.minutes,
    playerDribbles,
    playerStarted: app.started,
    playerSubOnMinute: app.subOn,
    playerSubOffMinute: app.subOff,
    isHome: playerIsHome,
    highlights,
    events,
    lineupRatings,
    mediaComments,
    motmName: motm,
    competition,
    seasonYear,
    roundLabel: roundLabel ?? (competition === 'cup' ? '杯赛' : '联赛'),
  }
}

function playerImpact(player: Player): number {
  if (player.injury) return -4
  return (player.OVR - 65) * 0.15 + (player.morale - 50) * 0.03
}

function pitchWindow(app: Appearance): { lo: number; hi: number } | null {
  if (app.minutes <= 0) return null
  if (app.started) return { lo: 1, hi: app.subOff ?? 90 }
  if (app.subOn != null) return { lo: app.subOn, hi: 90 }
  return null
}

function buildMatchTimeline(args: {
  home: Team
  away: Team
  homeGoals: number
  awayGoals: number
  player: Player
  playerIsHome: boolean
  app: Appearance
  playerGoals: number
  playerAssists: number
  seasonYear: number
}): { events: MatchEvent[]; goalMeta: string[]; effectivePlayerGoals: number; effectivePlayerAssists: number } {
  const {
    home,
    away,
    homeGoals,
    awayGoals,
    player,
    playerIsHome,
    app,
    playerGoals,
    playerAssists,
    seasonYear,
  } = args
  const myTeam = playerIsHome ? home : away
  const oppTeam = playerIsHome ? away : home
  const myGoalsTotal = playerIsHome ? homeGoals : awayGoals
  const oppGoalsTotal = playerIsHome ? awayGoals : homeGoals
  const window = pitchWindow(app)

  const events: MatchEvent[] = [{ minute: 0, type: 'kickoff', text: '比赛开始' }]
  const goalMeta: string[] = []

  type Slot = {
    team: 'home' | 'away'
    minute: number
    scorerIsPlayer: boolean
    assistIsPlayer: boolean
  }
  const slots: Slot[] = []

  // 1) 先把「你的进球」钉在你在场的时间段内
  let placedPlayerGoals = 0
  if (window && playerGoals > 0 && myGoalsTotal > 0) {
    const maxG = Math.min(playerGoals, myGoalsTotal)
    for (let i = 0; i < maxG; i++) {
      const lo = Math.max(window.lo, 6)
      const hi = Math.max(lo, window.hi)
      slots.push({
        team: playerIsHome ? 'home' : 'away',
        minute: randomMinute(lo, hi),
        scorerIsPlayer: true,
        assistIsPlayer: false,
      })
      placedPlayerGoals++
    }
  }

  // 2) 剩余本队进球：队友破门；尽量把助攻留给你（若你在场）
  let placedAssists = 0
  const teammateGoalsNeeded = myGoalsTotal - placedPlayerGoals
  for (let i = 0; i < teammateGoalsNeeded; i++) {
    let minute = randomMinute(6, 90)
    let assistIsPlayer = false
    if (
      window &&
      placedAssists < playerAssists &&
      onPitch(minute, app)
    ) {
      assistIsPlayer = true
      placedAssists++
    } else if (window && placedAssists < playerAssists) {
      // 强制助攻发生在你在场时
      minute = randomMinute(Math.max(window.lo, 6), Math.max(window.lo, window.hi))
      assistIsPlayer = true
      placedAssists++
    }
    slots.push({
      team: playerIsHome ? 'home' : 'away',
      minute,
      scorerIsPlayer: false,
      assistIsPlayer,
    })
  }

  // 3) 对手进球
  for (let i = 0; i < oppGoalsTotal; i++) {
    slots.push({
      team: playerIsHome ? 'away' : 'home',
      minute: randomMinute(6, 90),
      scorerIsPlayer: false,
      assistIsPlayer: false,
    })
  }

  slots.sort((a, b) => a.minute - b.minute)

  // 出场/换人
  if (app.minutes > 0) {
    if (!app.started && app.subOn != null) {
      events.push({
        minute: app.subOn,
        type: 'sub_on',
        text: `${player.name} 替补登场`,
        isPlayer: true,
        teamId: myTeam.id,
      })
    }
    if (app.started && app.subOff != null) {
      events.push({
        minute: app.subOff,
        type: 'sub_off',
        text: `${player.name} 被换下`,
        isPlayer: true,
        teamId: myTeam.id,
      })
    }
  }

  let scoreH = 0
  let scoreA = 0
  for (const slot of slots) {
    const team = slot.team === 'home' ? home : away
    let scorer: string
    let assist: string | undefined
    let isPlayerGoal = false

    if (slot.scorerIsPlayer) {
      scorer = player.name
      isPlayerGoal = true
      if (Math.random() < 0.45) {
        assist = pickTeammateName(team, seasonYear, [player.name])
      }
    } else {
      scorer = pickTeammateName(team, seasonYear, [player.name])
      if (slot.assistIsPlayer) {
        assist = player.name
      } else if (Math.random() < 0.5) {
        assist = pickTeammateName(team, seasonYear, [scorer, player.name])
      }
    }

    if (slot.team === 'home') scoreH += 1
    else scoreA += 1

    const assistBit = assist ? `（助攻 ${assist}）` : ''
    events.push({
      minute: slot.minute,
      type: 'goal',
      text: `${scorer} 破门${assistBit} · ${home.shortName} ${scoreH}-${scoreA} ${away.shortName}`,
      teamId: team.id,
      scorerName: scorer,
      assistName: assist,
      isPlayer: isPlayerGoal || assist === player.name,
    })
    goalMeta.push(`${slot.minute}' ${scorer}${assist ? ` ← ${assist}` : ''}`)
  }

  events.push({ minute: 45, type: 'ht', text: '半场结束' })
  events.push({
    minute: 90,
    type: 'ft',
    text: `全场结束 ${home.shortName} ${homeGoals}-${awayGoals} ${away.shortName}`,
  })

  events.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute
    const order: Record<string, number> = {
      kickoff: 0,
      sub_on: 1,
      goal: 2,
      sub_off: 3,
      ht: 4,
      ft: 5,
    }
    return (order[a.type] ?? 9) - (order[b.type] ?? 9)
  })

  void oppTeam
  return {
    events,
    goalMeta,
    effectivePlayerGoals: placedPlayerGoals,
    effectivePlayerAssists: placedAssists,
  }
}

function buildLineupRatings(args: {
  home: Team
  away: Team
  player: Player
  playerIsHome: boolean
  app: Appearance
  rating: number
  playerGoals: number
  playerAssists: number
  playerDribbles: number
  seasonYear: number
  events: MatchEvent[]
}): MatchLineupRating[] {
  const {
    home,
    away,
    player,
    playerIsHome,
    app,
    rating,
    playerGoals,
    playerAssists,
    playerDribbles,
    seasonYear,
    events,
  } = args
  const rows: MatchLineupRating[] = []
  const byName = new Map<string, MatchLineupRating>()

  const ensure = (
    name: string,
    teamId: string,
    position: string,
    ovrHint: number,
  ): MatchLineupRating => {
    let row = byName.get(`${teamId}:${name}`)
    if (!row) {
      row = {
        playerId: `npc_${teamId}_${name}`,
        name,
        teamId,
        position,
        rating: Math.round(clamp(5.8 + ovrHint / 45 + (Math.random() - 0.5) * 0.6, 5.0, 8.5) * 10) / 10,
        goals: 0,
        assists: 0,
        minutes: 70 + Math.floor(Math.random() * 21),
        dribbles: Math.floor(Math.random() * 3),
      }
      byName.set(`${teamId}:${name}`, row)
      rows.push(row)
    }
    return row
  }

  for (const team of [home, away]) {
    const isMy = team.id === (playerIsHome ? home.id : away.id)
    const squad = generateSquad(team, seasonYear, isMy ? player.name : undefined)
    for (const s of squad.slice(0, 11)) {
      if (isMy && s.name === player.name) continue
      ensure(s.name, team.id, s.position, s.ovr)
    }
  }

  // 时间轴进球/助攻写回评分板（禁止随机另造进球）
  for (const ev of events) {
    if (ev.type !== 'goal' || !ev.scorerName || !ev.teamId) continue
    if (ev.scorerName === player.name) continue
    const row = ensure(ev.scorerName, ev.teamId, 'ST', 72)
    row.goals += 1
    row.rating = Math.min(9.5, Math.round((row.rating + 0.7) * 10) / 10)
    if (ev.assistName && ev.assistName !== player.name) {
      const a = ensure(ev.assistName, ev.teamId, 'CAM', 70)
      a.assists += 1
      a.rating = Math.min(9.2, Math.round((a.rating + 0.4) * 10) / 10)
    }
  }

  if (app.minutes > 0) {
    rows.push({
      playerId: player.id,
      name: player.name,
      teamId: playerIsHome ? home.id : away.id,
      position: player.position,
      rating,
      goals: playerGoals,
      assists: playerAssists,
      minutes: app.minutes,
      dribbles: playerDribbles,
      isUser: true,
    })
  }

  return rows.sort((a, b) => b.rating - a.rating)
}

function buildMediaComments(args: {
  player: Player
  rating: number
  playerGoals: number
  playerAssists: number
  app: Appearance
  homeGoals: number
  awayGoals: number
  playerIsHome: boolean
  home: Team
  away: Team
  motm: string
}): string[] {
  const { player, rating, playerGoals, playerAssists, app, homeGoals, awayGoals, playerIsHome, home, away, motm } =
    args
  const my = playerIsHome ? homeGoals : awayGoals
  const opp = playerIsHome ? awayGoals : homeGoals
  const comments: string[] = []

  if (app.minutes === 0) {
    comments.push('【伤病名单】本场缺阵，社交平台多为关心与催问复出时间。')
    return comments
  }

  const role = app.started
    ? app.subOff
      ? `首发并在 ${app.subOff}' 被换下`
      : '打满全场'
    : `${app.subOn}' 替补登场出场 ${app.minutes} 分钟`

  comments.push(`【出场】${player.name} ${role}，官方评分 ${rating}。`)

  if (playerGoals > 0) {
    comments.push(
      `【高光】球迷区刷屏：进球被做成动图，话题#${player.name}时刻# 冲上热搜候选。`,
    )
  } else if (rating >= 7.5) {
    comments.push('【口碑】技术流博主点评：无球跑动与对抗值得加练后的回报。')
  } else if (rating < 6) {
    comments.push('【质疑】有球迷喊换人，也有人说不该把锅全扣在他身上。')
  } else {
    comments.push('【平淡】论坛评价两极：中规中矩，下一场再看。')
  }

  if (playerAssists > 0) {
    comments.push('【助攻】传球选择被教练组点名表扬。')
  }

  comments.push(
    `【赛果】${home.shortName} ${homeGoals}-${awayGoals} ${away.shortName}（你队 ${my}-${opp}）。本场最佳：${motm}。`,
  )

  const mediaRel = player.relationships.media
  if (mediaRel > 70) comments.push('【媒体】熟识记者发文偏护，称其态度端正。')
  else if (mediaRel < 35) comments.push('【媒体】个别账号阴阳怪气，公关需要灭火。')

  return comments
}

function buildHighlightsFromTimeline(
  home: Team,
  away: Team,
  hg: number,
  ag: number,
  player: Player,
  app: Appearance,
  pGoals: number,
  pAssists: number,
  injured: boolean,
  goalMeta: string[],
): string[] {
  const lines: string[] = []
  if (injured || app.minutes === 0) {
    lines.push(`${player.name} 因伤或缺席，本场未出场。`)
  } else if (app.started && app.subOff != null) {
    lines.push(`${player.name} 首发出场，第 ${app.subOff} 分钟被换下（共 ${app.minutes} 分钟）。`)
  } else if (app.started) {
    lines.push(`${player.name} 首发打满 ${app.minutes} 分钟。`)
  } else if (app.subOn != null) {
    lines.push(
      `${player.name} 第 ${app.subOn} 分钟替补登场，出场 ${app.minutes} 分钟（非打满 90 分钟）。`,
    )
  }

  for (const g of goalMeta.slice(0, 5)) {
    lines.push(`进球：${g}`)
  }
  if (pGoals > 0) lines.push(`${player.name} 本场 ${pGoals} 球。`)
  if (pAssists > 0) lines.push(`${player.name} 本场 ${pAssists} 次助攻。`)
  lines.push(`全场结束：${home.shortName} ${hg}-${ag} ${away.shortName}`)
  return lines
}

export function applyMatchToPlayer(player: Player, match: MatchResult): Player {
  if (match.playerMinutes <= 0 && player.injury) {
    return {
      ...player,
      careerStats: { ...player.careerStats },
      seasonStats: { ...(player.seasonStats ?? emptySeasonStats()) },
    }
  }

  const stats = { ...player.careerStats }
  const played = match.playerMinutes > 0
  stats.appearances += played ? 1 : 0
  stats.goals += match.playerGoals
  stats.assists += match.playerAssists
  if (player.position === 'GK') {
    const conceded = match.isHome ? match.awayGoals : match.homeGoals
    if (conceded === 0 && played) stats.cleanSheets += 1
  }
  stats.ratingSum += match.playerRating
  const apps = Math.max(1, stats.appearances)
  stats.avgRating = Math.round((stats.ratingSum / apps) * 10) / 10

  const seasonStats = syncSeasonStatsFromMatch(
    player.seasonStats ?? emptySeasonStats(),
    match.playerGoals,
    match.playerAssists,
    match.playerDribbles ?? 0,
    match.playerRating,
    played,
  )

  let growth = 0
  if (match.playerRating >= 8) growth = 40
  else if (match.playerRating >= 7) growth = 25
  else if (match.playerRating >= 6) growth = 10
  else growth = -5

  growth += match.playerGoals * 15 + match.playerAssists * 10

  let morale = player.morale
  const teamWon =
    (match.isHome && match.homeGoals > match.awayGoals) ||
    (!match.isHome && match.awayGoals > match.homeGoals)
  const teamDraw = match.homeGoals === match.awayGoals
  if (teamWon) morale += 4
  else if (!teamDraw) morale -= 3
  if (match.playerRating >= 7.5) morale += 5
  if (match.playerRating < 5.5) morale -= 6

  let next: Player = {
    ...player,
    careerStats: stats,
    seasonStats,
    growthScore: Math.max(0, player.growthScore + growth),
    morale: clamp(morale, 0, 100),
    fatigue: clamp(player.fatigue + (match.playerMinutes > 60 ? 12 : 5), 0, 100),
  }

  // 高强度比赛后疲劳过高可能受伤
  if (played && !player.injury) {
    const extra = match.playerMinutes >= 80 ? 0.06 : match.playerMinutes >= 60 ? 0.03 : 0.01
    const rolled = rollInjuryChance(next, extra)
    next = rolled.player
  }

  return next
}

/** 玩家行与 seasonStats 严格对齐；NPC 进球累加 */
export function applyMatchToBoard(
  board: SeasonBoardRow[],
  match: MatchResult,
  player: Player,
): SeasonBoardRow[] {
  const next = board.map((r) => ({ ...r }))
  const upsertNpc = (
    playerId: string,
    name: string,
    teamId: string,
    patch: Partial<SeasonBoardRow>,
  ) => {
    let row = next.find((r) => r.playerId === playerId)
    if (!row) {
      row = {
        playerId,
        name,
        teamId,
        goals: 0,
        assists: 0,
        dribbles: 0,
        apps: 0,
        ratingSum: 0,
      }
      next.push(row)
    }
    row.goals += patch.goals ?? 0
    row.assists += patch.assists ?? 0
    row.dribbles += patch.dribbles ?? 0
    row.apps += patch.apps ?? 0
    row.ratingSum += patch.ratingSum ?? 0
  }

  const ss = player.seasonStats ?? emptySeasonStats()
  const teamId = player.currentTeamId ?? (match.isHome ? match.homeTeamId : match.awayTeamId)
  const existingIdx = next.findIndex((r) => r.playerId === player.id)
  const playerRow: SeasonBoardRow = {
    playerId: player.id,
    name: player.name,
    teamId,
    goals: ss.goals,
    assists: ss.assists,
    dribbles: ss.dribbles,
    apps: ss.apps,
    ratingSum: ss.ratingSum,
  }
  if (existingIdx >= 0) next[existingIdx] = playerRow
  else next.push(playerRow)

  for (const ev of match.events ?? []) {
    if (ev.type !== 'goal' || !ev.scorerName || ev.scorerName === player.name) continue
    const tid = ev.teamId ?? match.homeTeamId
    upsertNpc(`npc_${tid}_${ev.scorerName}`, ev.scorerName, tid, { goals: 1 })
    if (ev.assistName && ev.assistName !== player.name) {
      upsertNpc(`npc_${tid}_${ev.assistName}`, ev.assistName, tid, { assists: 1 })
    }
  }

  return next
}

/** 存档修复：用 seasonStats（或生涯回填）写回榜单玩家行 */
export function syncPlayerToBoard(
  board: SeasonBoardRow[],
  player: Player,
): SeasonBoardRow[] {
  const ss = player.seasonStats ?? emptySeasonStats()
  const teamId = player.currentTeamId ?? 'unknown'
  const next = board.filter((r) => r.playerId !== player.id)
  if (ss.apps > 0 || ss.goals > 0 || ss.assists > 0) {
    next.push({
      playerId: player.id,
      name: player.name,
      teamId,
      goals: ss.goals,
      assists: ss.assists,
      dribbles: ss.dribbles,
      apps: ss.apps,
      ratingSum: ss.ratingSum,
    })
  }
  return next
}

export function sortBoard(
  board: SeasonBoardRow[],
  key: 'goals' | 'assists' | 'dribbles',
): SeasonBoardRow[] {
  return [...board].sort((a, b) => {
    if (b[key] !== a[key]) return b[key] - a[key]
    return b.ratingSum - a.ratingSum
  })
}

export function emptyInternational(): import('@/models/types').InternationalState {
  return {
    nationName: '中国队',
    caps: 0,
    goals: 0,
    calledUp: false,
    stage: 'none',
    stageLabel: '暂无国字号赛事窗口',
    nextWindowLabel: '世界杯预选赛 / 亚洲杯窗口将按日历开启',
    campStatus: 'none',
    provisionalSquad: [],
    finalSquad: null,
    lastAnnouncement: null,
    campReportLabel: null,
    campReturnLabel: null,
    fixtures: [],
  }
}
