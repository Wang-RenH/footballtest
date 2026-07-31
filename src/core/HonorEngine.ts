import type { Honor, LeagueStanding, Player, SeasonSnapshot, SeasonState } from '@/models/types'
import { sortedStandings } from '@/core/LeagueEngine'
import { uid } from '@/utils/random'

export function maybeAwardSeasonHonors(
  player: Player,
  season: SeasonState,
  year: number,
): { player: Player; honors: Honor[]; snapshot: SeasonSnapshot } {
  const rows = sortedStandings(season.standings)
  const myRank = rows.findIndex((r) => r.teamId === season.playerTeamId) + 1
  const champion = rows[0]?.teamId ?? null
  const honors: Honor[] = []

  if (champion === season.playerTeamId && player.careerStats.appearances > 0) {
    honors.push({
      id: uid('honor'),
      type: 'team',
      name: leagueTitle(season.leagueId),
      seasonYear: year,
      competition: season.leagueId,
      description: `${year} 赛季联赛冠军`,
    })
  }

  if (!season.cupEliminated && season.cupRound >= 4 && Math.random() < 0.35) {
    honors.push({
      id: uid('honor'),
      type: 'team',
      name: '足协杯冠军',
      seasonYear: year,
      competition: 'cup',
      description: `${year} 足协杯夺冠`,
    })
  }

  // 个人：金靴简化——本赛季进球够多
  if (player.careerStats.goals >= 15 && player.position !== 'GK') {
    const already = player.honors.some(
      (h) => h.name === '联赛金靴' && h.seasonYear === year,
    )
    if (!already && Math.random() < 0.4) {
      honors.push({
        id: uid('honor'),
        type: 'personal',
        name: '联赛金靴',
        seasonYear: year,
        competition: season.leagueId,
        description: `${year} 赛季联赛最佳射手`,
      })
    }
  }

  if (player.careerStats.avgRating >= 7.5 && player.careerStats.appearances >= 10) {
    const already = player.honors.some(
      (h) => h.name === '赛季最佳阵容' && h.seasonYear === year,
    )
    if (!already && Math.random() < 0.45) {
      honors.push({
        id: uid('honor'),
        type: 'personal',
        name: '赛季最佳阵容',
        seasonYear: year,
        competition: season.leagueId,
        description: `${year} 媒体评选最佳阵容`,
      })
    }
  }

  const snapshot: SeasonSnapshot = {
    year,
    leagueId: season.leagueId,
    standings: season.standings.map((s) => ({ ...s })),
    championTeamId: champion,
    cupChampionTeamId: honors.find((h) => h.name === '足协杯冠军')
      ? season.playerTeamId
      : null,
    playerLeagueRank: myRank || null,
    playerStats: {
      apps: player.careerStats.appearances,
      goals: player.careerStats.goals,
      assists: player.careerStats.assists,
      avgRating: player.careerStats.avgRating,
    },
  }

  return {
    player: {
      ...player,
      honors: [...player.honors, ...honors],
      careerStats: {
        ...player.careerStats,
        trophies: [
          ...player.careerStats.trophies,
          ...honors.map((h) => `${h.seasonYear} ${h.name}`),
        ],
      },
    },
    honors,
    snapshot,
  }
}

function leagueTitle(id: string): string {
  const map: Record<string, string> = {
    CSL: '中超冠军',
    CL1: '中甲冠军',
    EPL: '英超冠军',
    LaLiga: '西甲冠军',
    SerieA: '意甲冠军',
    Bundesliga: '德甲冠军',
    Ligue1: '法甲冠军',
  }
  return map[id] ?? '联赛冠军'
}

export function emptyStandingRows(teamIds: string[]): LeagueStanding[] {
  return teamIds.map((teamId) => ({
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }))
}

/** 不发球员荣誉，仅归档世界联赛结果（少年期观赛用） */
export function archiveWorldSeason(season: SeasonState, year: number): SeasonSnapshot {
  const rows = sortedStandings(season.standings)
  return {
    year,
    leagueId: season.leagueId,
    standings: season.standings.map((s) => ({ ...s })),
    championTeamId: rows[0]?.teamId ?? null,
    cupChampionTeamId: null,
    playerLeagueRank: null,
    playerStats: { apps: 0, goals: 0, assists: 0, avgRating: 0 },
  }
}
