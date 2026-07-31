import type { CareerArchiveEntry, GameState, SaveSlot } from '@/models/types'
import { getStorage } from '@/save/StorageAdapter'
import { emptyStandingRows } from '@/core/HonorEngine'
import {
  seedRecentSeasonHistory,
  simulateSeasonProgress,
  teamsInLeague,
  getTeamById,
} from '@/core/LeagueEngine'
import { emptyInternational, syncPlayerToBoard } from '@/core/MatchEngine'
import { createContract } from '@/core/FinanceEngine'

const SAVE_KEY = 'greenfield_career_save_v2'
const SAVE_KEY_LEGACY = 'greenfield_career_save_v1'
const SETTINGS_KEY = 'greenfield_settings_v1'
const ARCHIVE_KEY = 'greenfield_career_archive_v1'

export function saveGame(state: GameState): SaveSlot {
  const slot: SaveSlot = {
    id: 'auto',
    updatedAt: Date.now(),
    playerName: state.player.name,
    age: state.player.age,
    ovr: state.player.OVR,
    summary: `${state.time.year}年 · OVR ${state.player.OVR} · ${state.retired ? '已退役' : '进行中'}`,
    state,
  }
  getStorage().setItem(SAVE_KEY, JSON.stringify(slot))
  return slot
}

export function loadGame(): SaveSlot | null {
  const raw = getStorage().getItem(SAVE_KEY) ?? getStorage().getItem(SAVE_KEY_LEGACY)
  if (!raw) return null
  try {
    const slot = JSON.parse(raw) as SaveSlot
    slot.state = migrateState(slot.state)
    return slot
  } catch {
    return null
  }
}

function migrateState(state: GameState): GameState {
  const p = state.player as GameState['player'] & {
    adultHeightCm?: number
    adultWeightKg?: number
    honors?: GameState['player']['honors']
    seasonStats?: GameState['player']['seasonStats']
    contract?: GameState['player']['contract']
  }
  if (!p.adultHeightCm) {
    p.adultHeightCm = Math.max(p.heightCm, 175)
    p.adultWeightKg = Math.max(p.weightKg, 70)
  }
  if (!p.honors) p.honors = []

  // 旧档：本赛季统计缺失时，用生涯数据回填，避免主页 9 球 / 榜单 0 球
  if (!p.seasonStats) {
    const c = p.careerStats
    p.seasonStats = {
      apps: c.appearances,
      goals: c.goals,
      assists: c.assists,
      dribbles: 0,
      ratingSum: c.ratingSum,
    }
  }
  if (p.contract === undefined) p.contract = null
  if (!p.contract && p.currentTeamId && p.age >= 18) {
    try {
      const team = getTeamById(p.currentTeamId)
      p.contract = createContract(p, team, state.time)
    } catch {
      p.contract = null
    }
  }

  if (!state.season.seasonHistory) state.season.seasonHistory = []
  if (!state.season.leagueId) state.season.leagueId = 'CSL'
  if (state.season.cupRound == null) state.season.cupRound = 1
  if (state.season.cupEliminated == null) state.season.cupEliminated = false
  if (!state.week.lastTrainingResult) state.week.lastTrainingResult = null
  if (!state.week.eventSource) state.week.eventSource = 'local'
  if (!state.week.eventRole) state.week.eventRole = 'normal'
  if (state.week.suggestedTraining === undefined) state.week.suggestedTraining = null
  if (!state.aiMemory) {
    state.aiMemory = [`续档：${state.player.name}，${state.player.age}岁`]
  }
  if (!state.eventQueue) state.eventQueue = []
  if (!state.bulletin) state.bulletin = []
  if (!state.season.leagueBoard) state.season.leagueBoard = []
  if (!state.season.cupBoard) state.season.cupBoard = []
  if (!state.season.matchLog) state.season.matchLog = []

  const intl = state.season.international ?? emptyInternational()
  state.season.international = {
    ...emptyInternational(),
    ...intl,
    provisionalSquad: intl.provisionalSquad ?? [],
    finalSquad: intl.finalSquad ?? null,
    campStatus: intl.campStatus ?? 'none',
    lastAnnouncement: intl.lastAnnouncement ?? null,
  }

  // 榜单玩家行与 seasonStats 对齐
  state.season.leagueBoard = syncPlayerToBoard(state.season.leagueBoard, p)
  state.season.cupBoard = syncPlayerToBoard(state.season.cupBoard, p)

  if (
    state.player.age < 18 &&
    (!state.season.seasonHistory?.length ||
      state.season.standings.every((r) => r.played === 0))
  ) {
    const leagueId = state.season.leagueId || 'CSL'
    if (!state.season.seasonHistory?.length) {
      state.season.seasonHistory = seedRecentSeasonHistory(leagueId, state.time.year - 1, 3)
    }
    if (state.season.standings.every((r) => r.played === 0)) {
      const rounds = Math.min(18, Math.max(4, (timeMonthWeekRounds(state))))
      state.season.standings = simulateSeasonProgress(
        emptyStandingRows(teamsInLeague(leagueId).map((t) => t.id)),
        rounds,
      )
      state.season.round = rounds
    }
  }
  state.version = Math.max(state.version ?? 2, 4)
  return state
}

function timeMonthWeekRounds(state: GameState): number {
  return Math.min(18, Math.max(4, (state.time.month - 1) * 2 + state.time.week))
}

export function clearSave(): void {
  getStorage().removeItem(SAVE_KEY)
  getStorage().removeItem(SAVE_KEY_LEGACY)
}

export function hasSave(): boolean {
  return loadGame() != null
}

export function loadSettingsJson(): string | null {
  return getStorage().getItem(SETTINGS_KEY)
}

export function saveSettingsJson(json: string): void {
  getStorage().setItem(SETTINGS_KEY, json)
}

export function loadCareerArchive(): CareerArchiveEntry[] {
  const raw = getStorage().getItem(ARCHIVE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as CareerArchiveEntry[]
  } catch {
    return []
  }
}

export function appendCareerArchive(entry: CareerArchiveEntry): void {
  const list = loadCareerArchive()
  list.unshift(entry)
  getStorage().setItem(ARCHIVE_KEY, JSON.stringify(list.slice(0, 50)))
}
