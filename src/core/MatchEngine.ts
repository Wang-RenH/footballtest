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

  const { events, goalMeta } = buildMatchTimeline({
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
}): { events: MatchEvent[]; goalMeta: string[] } {
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
  const events: MatchEvent[] = [{ minute: 0, type: 'kickoff', text: '比赛开始' }]
  const goalMeta: string[] = []

  const goalSlots: { team: 'home' | 'away'; minute: number }[] = []
  for (let i = 0; i < homeGoals; i++) {
    goalSlots.push({ team: 'home', minute: randomMinute(6, 90) })
  }
  for (let i = 0; i < awayGoals; i++) {
    goalSlots.push({ team: 'away', minute: randomMinute(6, 90) })
  }
  goalSlots.sort((a, b) => a.minute - b.minute)

  // 出场/换人事件
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
  let assignedPlayerGoals = 0
  let assignedPlayerAssists = 0

  for (const slot of goalSlots) {
    const team = slot.team === 'home' ? home : away
    const isMy = (slot.team === 'home') === playerIsHome
    let scorer = pickTeammateName(team, seasonYear, [player.name])
    let assist: string | undefined
    let isPlayerGoal = false

    if (
      isMy &&
      assignedPlayerGoals < playerGoals &&
      onPitch(slot.minute, app)
    ) {
      scorer = player.name
      assignedPlayerGoals += 1
      isPlayerGoal = true
    } else if (
      isMy &&
      assignedPlayerAssists < playerAssists &&
      onPitch(slot.minute, app) &&
      Math.random() < 0.75
    ) {
      assist = player.name
      assignedPlayerAssists += 1
      scorer = pickTeammateName(team, seasonYear, [player.name])
    } else if (Math.random() < 0.55) {
      assist = pickTeammateName(team, seasonYear, [scorer, player.name])
    }

    if (slot.team === 'home') scoreH += 1
    else scoreA += 1

    const assistBit = assist ? `（助攻 ${assist}）` : ''
    const text = `${scorer} 破门${assistBit} · ${home.shortName} ${scoreH}-${scoreA} ${away.shortName}`
    events.push({
      minute: slot.minute,
      type: 'goal',
      text,
      teamId: team.id,
      scorerName: scorer,
      assistName: assist,
      isPlayer: isPlayerGoal || assist === player.name,
    })
    goalMeta.push(`${slot.minute}' ${scorer}${assist ? ` ← ${assist}` : ''}`)
  }

  // 未吃完的球员进球：改写同队已有进球事件（保持总比分不变）
  if (assignedPlayerGoals < playerGoals) {
    for (const ev of events) {
      if (assignedPlayerGoals >= playerGoals) break
      if (ev.type !== 'goal' || !ev.teamId || ev.teamId !== myTeam.id) continue
      if (ev.scorerName === player.name) continue
      if (!onPitch(ev.minute, app)) continue
      ev.scorerName = player.name
      ev.isPlayer = true
      ev.text = `${player.name} 破门${ev.assistName ? `（助攻 ${ev.assistName}）` : ''} · ${home.shortName} …`
      // 重写文案：从 goalMeta 里找同分钟
      const idx = goalMeta.findIndex((g) => g.startsWith(`${ev.minute}'`))
      if (idx >= 0) goalMeta[idx] = `${ev.minute}' ${player.name}${ev.assistName ? ` ← ${ev.assistName}` : ''}`
      assignedPlayerGoals += 1
    }
  }

  // 刷新进球文案比分缀（保持事件顺序上的滚动比分）
  {
    let h = 0
    let a = 0
    for (const ev of events) {
      if (ev.type !== 'goal') continue
      if (ev.teamId === home.id) h += 1
      else a += 1
      const assistBit = ev.assistName ? `（助攻 ${ev.assistName}）` : ''
      ev.text = `${ev.scorerName} 破门${assistBit} · ${home.shortName} ${h}-${a} ${away.shortName}`
    }
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

  return { events, goalMeta }
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
}): MatchLineupRating[] {
  const { home, away, player, playerIsHome, app, rating, playerGoals, playerAssists, playerDribbles, seasonYear } =
    args
  const rows: MatchLineupRating[] = []

  for (const team of [home, away]) {
    const isMy = team.id === (playerIsHome ? home.id : away.id)
    const squad = generateSquad(team, seasonYear, isMy ? player.name : undefined)
    const starters = squad.slice(0, 11)
    for (let i = 0; i < starters.length; i++) {
      const s = starters[i]!
      if (isMy && i === 0) continue // 位置留给玩家插入
      const mins = 70 + Math.floor(Math.random() * 21)
      const g = Math.random() < 0.12 ? 1 : 0
      const a = Math.random() < 0.1 ? 1 : 0
      const r =
        Math.round(
          clamp(5.5 + s.ovr / 40 + g * 0.8 + a * 0.5 + (Math.random() - 0.5), 4.5, 9.2) * 10,
        ) / 10
      rows.push({
        playerId: s.id,
        name: s.name,
        teamId: team.id,
        position: s.position,
        rating: r,
        goals: g,
        assists: a,
        minutes: mins,
        dribbles: Math.floor(Math.random() * 4),
      })
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

  return {
    ...player,
    careerStats: stats,
    seasonStats,
    growthScore: Math.max(0, player.growthScore + growth),
    morale: clamp(morale, 0, 100),
    fatigue: clamp(player.fatigue + (match.playerMinutes > 60 ? 12 : 5), 0, 100),
  }
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
  }
}
