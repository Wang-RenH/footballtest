import type {
  CreatePlayerInput,
  FamilyBackground,
  GameState,
  Player,
  Team,
} from '@/models/types'
import {
  baseAttributesForPosition,
  calcOVR,
} from '@/core/AttributeEngine'
import { adultBodyTargets, bodyAtAge } from '@/core/BodyEngine'
import { createTime } from '@/core/TimeEngine'
import { markEventUsed, pickWeeklyEvent } from '@/core/EventEngine'
import { ALL_TEAMS, seedRecentSeasonHistory, simulateSeasonProgress, teamsInLeague } from '@/core/LeagueEngine'
import { emptyStandingRows } from '@/core/HonorEngine'
import { emptyInternational } from '@/core/MatchEngine'
import { createContract, emptySeasonStats } from '@/core/FinanceEngine'
import { clamp, randInt, uid } from '@/utils/random'

export const TEAMS = ALL_TEAMS

const FAMILY_FUNDS: Record<FamilyBackground, number> = {
  poor: 8000,
  working: 25000,
  middle: 60000,
  wealthy: 150000,
}

const FAMILY_ATTR_BOOST: Record<FamilyBackground, number> = {
  poor: -2,
  working: 0,
  middle: 2,
  wealthy: 4,
}

const CITIES = [
  '北京',
  '上海',
  '广州',
  '成都',
  '青岛',
  '大连',
  '西安',
  '武汉',
  '杭州',
  '重庆',
  '天津',
  '厦门',
  '济南',
  '昆明',
  '苏州',
  '沈阳',
]

export function getCities(): string[] {
  return CITIES
}

export function createPlayer(input: CreatePlayerInput): Player {
  const age = input.mode === 'quick' ? 18 : 3
  const boost = FAMILY_ATTR_BOOST[input.familyBackground]
  const attributes = baseAttributesForPosition(input.position, age, boost)
  const potential = input.mode === 'quick' ? randInt(72, 88) : randInt(68, 92)
  const adult = adultBodyTargets(input.position)
  const body = bodyAtAge(age, adult.heightCm, adult.weightKg)

  const player: Player = {
    id: uid('player'),
    name: input.name.trim() || '无名球员',
    birthCity: input.birthCity,
    jerseyNumber: input.jerseyNumber,
    position: input.position,
    preferredFoot: input.preferredFoot,
    familyBackground: input.familyBackground,
    adultHeightCm: adult.heightCm,
    adultWeightKg: adult.weightKg,
    heightCm: body.heightCm,
    weightKg: body.weightKg,
    age,
    attributes,
    hiddenAttributes: {
      decision: randInt(8, 14),
      workRate: randInt(9, 15),
      leadership: randInt(5, 12),
      composure: randInt(8, 14),
      professionalism: randInt(8, 15),
      consistency: randInt(8, 14),
      injuryProneness: randInt(5, 12),
      bigMatch: randInt(6, 13),
      adaptability: randInt(8, 14),
    },
    OVR: 0,
    potential,
    growthScore: 0,
    interest: input.mode === 'quick' ? 75 : 40,
    morale: 70,
    fatigue: 10,
    funds: FAMILY_FUNDS[input.familyBackground],
    currentTeamId: null,
    injury: null,
    relationships: {
      father: 70,
      mother: 75,
      coach: 50,
      teammates: 50,
      media: 40,
      fans: 30,
    },
    careerStats: {
      appearances: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      avgRating: 0,
      ratingSum: 0,
      trophies: [],
    },
    seasonStats: emptySeasonStats(),
    contract: null,
    traits: [],
    honors: [],
  }
  player.OVR = calcOVR(player.attributes, player.position)
  return player
}

function assignTeam(player: Player): string {
  const csl = teamsInLeague('CSL')
  const cityTeam = csl.find((t) => t.city === player.birthCity)
  if (cityTeam && Math.random() < 0.55) return cityTeam.id
  const sorted = [...csl].sort(
    (a, b) => Math.abs(a.strength - player.OVR) - Math.abs(b.strength - player.OVR),
  )
  return sorted[0]!.id
}

export function createNewGame(input: CreatePlayerInput): GameState {
  const player = createPlayer(input)
  if (input.mode === 'quick' || player.age >= 18) {
    player.currentTeamId = assignTeam(player)
    player.funds += 20000
    const team = ALL_TEAMS.find((t) => t.id === player.currentTeamId)!
    const time0 = createTime(player.age)
    player.contract = createContract(player, team, time0)
    player.funds += player.contract.signingBonus
  }

  const time = createTime(player.age)
  const { event, source } = pickWeeklyEvent(player.age, [])
  const leagueId = 'CSL' as const
  const leagueTeams = teamsInLeague(leagueId)
  const historyYears = seedRecentSeasonHistory(leagueId, time.year - 1, 3)
  const progressRounds = Math.min(20, Math.max(4, (time.month - 1) * 2 + time.week))
  const standings = simulateSeasonProgress(
    emptyStandingRows(leagueTeams.map((t) => t.id)),
    progressRounds,
  )

  return {
    version: 3,
    mode: input.mode,
    player,
    time,
    season: {
      year: time.year,
      round: progressRounds,
      leagueId,
      standings,
      cupRound: 1,
      cupEliminated: false,
      playerTeamId: player.currentTeamId ?? leagueTeams[0]!.id,
      seasonHistory: historyYears,
      leagueBoard: [],
      cupBoard: [],
      matchLog: [],
      international: emptyInternational(),
    },
    week: {
      step: 'event',
      currentEvent: event,
      lastMatch: null,
      lastEventConsequence: null,
      lastTrainingResult: null,
      trainingDone: false,
      eventDone: false,
      eventSource: source,
      eventRole: 'normal',
      suggestedTraining: null,
    },
    usedEventIds: markEventUsed([], event),
    history: [
      `${player.name} 的足球生涯开始了。`,
      `你可以在「联赛」查看中超近况与近年冠军，为将来择队做准备。`,
    ],
    aiMemory: [`开局：${player.name}，${player.age}岁，${player.position}，出生于${player.birthCity}`],
    eventQueue: [],
    bulletin: [
      {
        id: uid('bul'),
        dateLabel: `${time.year}年${time.month}月`,
        category: 'life',
        headline: `${player.name} 开启绿茵征途`,
        body:
          player.age >= 18
            ? `加盟一线队，${player.contract ? `周薪约 ¥${player.contract.weeklyWage}` : '合同待定'}。关注联赛、杯赛与国字号窗口。`
            : '少年启蒙阶段：兴趣、家庭与青训将塑造未来。',
      },
    ],
    retired: false,
    retirementTitle: null,
  }
}

export function getTeam(id: string): Team {
  return ALL_TEAMS.find((t) => t.id === id) ?? ALL_TEAMS[0]!
}

export function randomCreateInput(): CreatePlayerInput {
  const surnames = ['李', '王', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙']
  const names = ['浩然', '子轩', '宇轩', '明泽', '俊杰', '天宇', '志强', '一鸣', '嘉豪', '博文']
  const positions = [
    'GK',
    'CB',
    'LB',
    'RB',
    'CDM',
    'CM',
    'CAM',
    'LW',
    'RW',
    'ST',
    'CF',
  ] as const
  return {
    name: pick(surnames) + pick(names),
    birthCity: pick(CITIES),
    jerseyNumber: randInt(1, 99),
    position: pick([...positions]),
    preferredFoot: pick(['left', 'right', 'both'] as const),
    familyBackground: pick(['poor', 'working', 'middle', 'wealthy'] as const),
    mode: 'quick',
  }
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

export function refreshPlayerOVR(player: Player): Player {
  return {
    ...player,
    OVR: calcOVR(player.attributes, player.position),
    morale: clamp(player.morale, 0, 100),
    fatigue: clamp(player.fatigue, 0, 100),
  }
}

/** 高 OVR 有机会接到欧洲球会橄榄枝 */
export function tryEuropeTransferOffer(player: Player): string | null {
  if (player.age < 20 || player.age > 32) return null
  if (player.OVR < 78) return null
  const current = player.currentTeamId ? getTeam(player.currentTeamId) : null
  if (current && current.league !== 'CSL' && current.league !== 'CL1') return null
  if (Math.random() > 0.12) return null
  const europe = ALL_TEAMS.filter((t) => !['CSL', 'CL1'].includes(t.league))
  const club = europe[Math.floor(Math.random() * europe.length)]!
  return club.id
}
