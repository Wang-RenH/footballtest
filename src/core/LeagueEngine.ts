import type {
  LeagueId,
  LeagueStanding,
  MatchResult,
  Player,
  SeasonSnapshot,
  Team,
} from '@/models/types'
import cslData from '@/data/teams/csl.json'
import europeData from '@/data/teams/europe.json'
import { simulateLeagueMatch } from '@/core/MatchEngine'
import { pickRandom } from '@/utils/random'

export const ALL_TEAMS = [...cslData, ...europeData] as Team[]

export function teamsInLeague(league: LeagueId): Team[] {
  return ALL_TEAMS.filter((t) => t.league === league)
}

export function getTeamById(id: string): Team {
  return ALL_TEAMS.find((t) => t.id === id) ?? ALL_TEAMS[0]!
}

export function updateStandings(
  standings: LeagueStanding[],
  match: MatchResult,
): LeagueStanding[] {
  return standings.map((row) => {
    if (row.teamId !== match.homeTeamId && row.teamId !== match.awayTeamId) return row
    const isHome = row.teamId === match.homeTeamId
    const gf = isHome ? match.homeGoals : match.awayGoals
    const ga = isHome ? match.awayGoals : match.homeGoals
    const next = { ...row }
    next.played += 1
    next.goalsFor += gf
    next.goalsAgainst += ga
    if (gf > ga) {
      next.won += 1
      next.points += 3
    } else if (gf === ga) {
      next.drawn += 1
      next.points += 1
    } else {
      next.lost += 1
    }
    return next
  })
}

export function sortedStandings(standings: LeagueStanding[]): LeagueStanding[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.goalsFor - a.goalsAgainst
    const gdB = b.goalsFor - b.goalsAgainst
    if (gdB !== gdA) return gdB - gdA
    return b.goalsFor - a.goalsFor
  })
}

export function playPlayerMatchWeek(
  player: Player,
  standings: LeagueStanding[],
  playerTeamId: string,
  competition: MatchResult['competition'] = 'league',
  /** 联赛已完成轮次，下一场用 round（从 0 起） */
  leagueRoundIndex = 0,
  seasonYear = 2026,
): { match: MatchResult; standings: LeagueStanding[]; opponentId: string } {
  const leagueId = getTeamById(playerTeamId).league
  const leagueTeams = standings.map((s) => getTeamById(s.teamId))
  const myTeam = getTeamById(playerTeamId)

  let opponent: Team
  let isHome: boolean

  if (competition === 'league') {
    const fix = getPlayerFixture(leagueId, playerTeamId, leagueRoundIndex, seasonYear)
    if (fix) {
      opponent = getTeamById(fix.opponentId)
      isHome = fix.isHome
    } else {
      // 赛程轮次耗尽：该周视为轮空，不应调用；兜底随机且避开最近对手感
      const opponents = leagueTeams.filter((t) => t.id !== playerTeamId)
      opponent = pickRandom(opponents.length ? opponents : ALL_TEAMS)
      isHome = Math.random() < 0.5
    }
  } else {
    const opponents = leagueTeams.filter((t) => t.id !== playerTeamId)
    // 杯赛用轮次种子挑对手，避免连抽同一队
    const seeded = [...opponents].sort(
      (a, b) =>
        hashSeed(`${seasonYear}-cup-${leagueRoundIndex}-${a.id}`) -
        hashSeed(`${seasonYear}-cup-${leagueRoundIndex}-${b.id}`),
    )
    opponent = seeded[leagueRoundIndex % Math.max(1, seeded.length)] ?? pickRandom(opponents)
    isHome = hashSeed(`${seasonYear}-cup-home-${playerTeamId}-${opponent.id}`) % 2 === 0
  }

  const home = isHome ? myTeam : opponent
  const away = isHome ? opponent : myTeam
  const match = simulateLeagueMatch(
    home,
    away,
    player,
    isHome,
    competition,
    seasonYear,
    competition === 'cup' ? `杯赛第${leagueRoundIndex + 1}轮` : `联赛第${leagueRoundIndex + 1}轮`,
  )
  let next = updateStandings(standings, match)
  if (competition === 'league') {
    next = applyFixtureRoundResults(
      next,
      leagueId,
      leagueRoundIndex,
      seasonYear,
      [myTeam.id, opponent.id],
    )
  } else {
    next = simulateOtherResults(
      next,
      [myTeam.id, opponent.id],
      leagueTeams.map((t) => t.id),
    )
  }
  return { match, standings: next, opponentId: opponent.id }
}

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export interface PlayerFixture {
  roundIndex: number
  opponentId: string
  isHome: boolean
}

type RoundMatches = { homeId: string; awayId: string }[]

function getSeasonRounds(leagueId: LeagueId, seasonYear: number): RoundMatches[] {
  const teams = teamsInLeague(leagueId).map((t) => t.id)
  const ids = [...teams]
  if (ids.length % 2 === 1) ids.push('__bye__')
  ids.sort((a, b) => hashSeed(`${seasonYear}-${a}`) - hashSeed(`${seasonYear}-${b}`))
  const n = ids.length
  const half = n / 2
  const rot = ids.slice(1)
  const firstLeg: RoundMatches[] = []
  for (let r = 0; r < n - 1; r++) {
    const circle = [ids[0]!, ...rot]
    const matches: RoundMatches = []
    for (let i = 0; i < half; i++) {
      let homeId = circle[i]!
      let awayId = circle[n - 1 - i]!
      if (homeId === '__bye__' || awayId === '__bye__') continue
      if (r % 2 === 1) [homeId, awayId] = [awayId, homeId]
      matches.push({ homeId, awayId })
    }
    firstLeg.push(matches)
    rot.push(rot.shift()!)
  }
  const second = firstLeg.map((round) =>
    round.map((m) => ({ homeId: m.awayId, awayId: m.homeId })),
  )
  return [...firstLeg, ...second]
}

export function getPlayerFixture(
  leagueId: LeagueId,
  teamId: string,
  roundIndex: number,
  seasonYear: number,
): PlayerFixture | null {
  const rounds = getSeasonRounds(leagueId, seasonYear)
  if (roundIndex < 0 || roundIndex >= rounds.length) return null
  const round = rounds[roundIndex]!
  for (const m of round) {
    if (m.homeId === teamId) {
      return { roundIndex, opponentId: m.awayId, isHome: true }
    }
    if (m.awayId === teamId) {
      return { roundIndex, opponentId: m.homeId, isHome: false }
    }
  }
  return null
}

export function leagueTotalRounds(leagueId: LeagueId): number {
  const n = teamsInLeague(leagueId).length
  const even = n % 2 === 0 ? n : n + 1
  return (even - 1) * 2
}

function stubMatch(
  partial: Pick<
    MatchResult,
    'id' | 'homeTeamId' | 'awayTeamId' | 'homeGoals' | 'awayGoals' | 'competition'
  >,
): MatchResult {
  return {
    ...partial,
    playerRating: 0,
    playerGoals: 0,
    playerAssists: 0,
    playerMinutes: 0,
    playerDribbles: 0,
    playerStarted: false,
    playerSubOnMinute: null,
    playerSubOffMinute: null,
    isHome: true,
    highlights: [],
    events: [],
    lineupRatings: [],
    mediaComments: [],
    motmName: '',
  }
}

function applyFixtureRoundResults(
  standings: LeagueStanding[],
  leagueId: LeagueId,
  roundIndex: number,
  seasonYear: number,
  exclude: string[],
): LeagueStanding[] {
  const rounds = getSeasonRounds(leagueId, seasonYear)
  const round = rounds[roundIndex]
  if (!round) return simulateOtherResults(standings, exclude, standings.map((s) => s.teamId))
  let next = standings.map((s) => ({ ...s }))
  for (const m of round) {
    if (exclude.includes(m.homeId) || exclude.includes(m.awayId)) continue
    const home = getTeamById(m.homeId)
    const away = getTeamById(m.awayId)
    const homeAdv = (home.strength - away.strength) / 25
    const hg = Math.max(0, Math.floor(Math.random() * 3 + homeAdv + (Math.random() < 0.45 ? 1 : 0)))
    const ag = Math.max(0, Math.floor(Math.random() * 3 - homeAdv * 0.6 + (Math.random() < 0.4 ? 1 : 0)))
    next = updateStandings(
      next,
      stubMatch({
        id: `fix_${roundIndex}_${m.homeId}`,
        homeTeamId: m.homeId,
        awayTeamId: m.awayId,
        homeGoals: hg,
        awayGoals: ag,
        competition: 'league',
      }),
    )
  }
  return next
}

function simulateOtherResults(
  standings: LeagueStanding[],
  exclude: string[],
  poolIds: string[],
): LeagueStanding[] {
  let next = standings.map((s) => ({ ...s }))
  const pool = poolIds.filter((id) => !exclude.includes(id))
  for (let i = 0; i < Math.min(4, Math.floor(pool.length / 2)); i++) {
    if (pool.length < 2) break
    const a = pickRandom(pool)
    let b = pickRandom(pool)
    if (a === b) continue
    const hg = Math.floor(Math.random() * 4)
    const ag = Math.floor(Math.random() * 4)
    next = updateStandings(
      next,
      stubMatch({
        id: `sim_${i}`,
        homeTeamId: a,
        awayTeamId: b,
        homeGoals: hg,
        awayGoals: ag,
        competition: 'league',
      }),
    )
  }
  return next
}

export function teamName(id: string): string {
  return getTeamById(id).name
}

export function teamShort(id: string): string {
  return getTeamById(id).shortName
}

/** 按球队实力模拟一轮完整联赛（每队一场） */
export function simulateLeagueRound(standings: LeagueStanding[]): LeagueStanding[] {
  const ids = standings.map((s) => s.teamId)
  const shuffled = [...ids].sort(() => Math.random() - 0.5)
  let next = standings.map((s) => ({ ...s }))
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    const homeId = shuffled[i]!
    const awayId = shuffled[i + 1]!
    const home = getTeamById(homeId)
    const away = getTeamById(awayId)
    const homeAdv = (home.strength - away.strength) / 25
    const hg = Math.max(0, Math.floor(Math.random() * 3 + homeAdv + (Math.random() < 0.45 ? 1 : 0)))
    const ag = Math.max(0, Math.floor(Math.random() * 3 - homeAdv * 0.6 + (Math.random() < 0.4 ? 1 : 0)))
    next = updateStandings(
      next,
      stubMatch({
        id: `world_${homeId}_${awayId}_${Math.random().toString(36).slice(2, 6)}`,
        homeTeamId: homeId,
        awayTeamId: awayId,
        homeGoals: hg,
        awayGoals: ag,
        competition: 'league',
      }),
    )
  }
  return next
}

/** 模拟完整赛季积分榜 */
export function simulateFullSeasonStandings(leagueId: LeagueId): LeagueStanding[] {
  const teams = teamsInLeague(leagueId)
  let standings = teams.map((t) => ({
    teamId: t.id,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }))
  const rounds = Math.max(15, teams.length * 2 - 2)
  for (let r = 0; r < rounds; r++) {
    standings = simulateLeagueRound(standings)
  }
  return standings
}

/** 生成近年联赛归档（少年期也能看到豪门兴衰） */
export function seedRecentSeasonHistory(
  leagueId: LeagueId,
  lastCompletedYear: number,
  count: number,
): SeasonSnapshot[] {
  const snaps: SeasonSnapshot[] = []
  for (let i = count; i >= 1; i--) {
    const year = lastCompletedYear - i + 1
    const standings = simulateFullSeasonStandings(leagueId)
    const rows = sortedStandings(standings)
    snaps.push({
      year,
      leagueId,
      standings,
      championTeamId: rows[0]?.teamId ?? null,
      cupChampionTeamId: pickRandom(standings).teamId,
      playerLeagueRank: null,
      playerStats: { apps: 0, goals: 0, assists: 0, avgRating: 0 },
    })
  }
  return snaps
}

/** 按月份推进若干轮，让本赛季榜有内容 */
export function simulateSeasonProgress(
  standings: LeagueStanding[],
  rounds: number,
): LeagueStanding[] {
  let next = standings.map((s) => ({ ...s }))
  for (let i = 0; i < rounds; i++) {
    next = simulateLeagueRound(next)
  }
  return next
}

export const LEAGUE_LABELS: Record<LeagueId, string> = {
  CSL: '中超联赛',
  CL1: '中甲联赛',
  EPL: '英超',
  LaLiga: '西甲',
  SerieA: '意甲',
  Bundesliga: '德甲',
  Ligue1: '法甲',
}
