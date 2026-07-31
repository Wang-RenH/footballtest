/** 纯数据模型，无 DOM 依赖 —— 便于后续迁微信小游戏 */

export type Position =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LW'
  | 'RW'
  | 'ST'
  | 'CF'

export type PreferredFoot = 'left' | 'right' | 'both'
export type FamilyBackground = 'poor' | 'working' | 'middle' | 'wealthy'
export type GameMode = 'career' | 'quick'

export type AttributeKey = 'PAC' | 'SHO' | 'PAS' | 'DRI' | 'DEF' | 'PHY'

export type HiddenAttrKey =
  | 'decision'
  | 'workRate'
  | 'leadership'
  | 'composure'
  | 'professionalism'
  | 'consistency'
  | 'injuryProneness'
  | 'bigMatch'
  | 'adaptability'

export type RelationshipKey =
  | 'father'
  | 'mother'
  | 'coach'
  | 'teammates'
  | 'media'
  | 'fans'

export type EventCategory =
  | 'training'
  | 'match'
  | 'life'
  | 'family'
  | 'social'
  | 'injury'
  | 'opportunity'

export type LifeStage =
  | 'enlightenment'
  | 'youth'
  | 'academy'
  | 'pro_early'
  | 'prime'
  | 'late'
  | 'retired'

export type TrainingFocus = AttributeKey | 'REST'

export type LeagueId =
  | 'CSL'
  | 'CL1'
  | 'EPL'
  | 'LaLiga'
  | 'SerieA'
  | 'Bundesliga'
  | 'Ligue1'

export type CompetitionId =
  | 'league'
  | 'cup'
  | 'ucl'
  | 'acl'
  | 'national'
  | 'wc_qualifier'
  | 'asian_cup'
  | 'world_cup'

export type HonorType = 'personal' | 'team'

export type ScreenId =
  | 'home'
  | 'create'
  | 'dashboard'
  | 'event'
  | 'training'
  | 'match'
  | 'league'
  | 'team'
  | 'fixtures'
  | 'career'
  | 'honors'
  | 'archive'
  | 'retirement'
  | 'settings'

export type ApiProviderId = 'none' | 'deepseek' | 'mimo' | 'glm' | 'minimax' | 'custom'

export interface Attributes {
  PAC: number
  SHO: number
  PAS: number
  DRI: number
  DEF: number
  PHY: number
}

export interface HiddenAttributes {
  decision: number
  workRate: number
  leadership: number
  composure: number
  professionalism: number
  consistency: number
  injuryProneness: number
  bigMatch: number
  adaptability: number
}

export interface Relationships {
  father: number
  mother: number
  coach: number
  teammates: number
  media: number
  fans: number
}

export interface CareerStats {
  appearances: number
  goals: number
  assists: number
  cleanSheets: number
  yellowCards: number
  redCards: number
  avgRating: number
  ratingSum: number
  trophies: string[]
}

/** 本赛季个人数据（与联赛榜严格同步） */
export interface SeasonPlayerStats {
  apps: number
  goals: number
  assists: number
  dribbles: number
  ratingSum: number
}

export interface PlayerContract {
  teamId: string
  weeklyWage: number
  monthlyWage: number
  expiresYear: number
  expiresMonth: number
  signingBonus: number
  releaseClause: number | null
}

export interface BulletinItem {
  id: string
  dateLabel: string
  category: 'cup' | 'national' | 'transfer' | 'finance' | 'league' | 'life'
  headline: string
  body: string
}

export interface Injury {
  name: string
  weeksLeft: number
  attrPenalty: Partial<Attributes>
}

export interface Honor {
  id: string
  type: HonorType
  name: string
  seasonYear: number
  competition: string
  description: string
}

export interface Player {
  id: string
  name: string
  birthCity: string
  jerseyNumber: number
  position: Position
  preferredFoot: PreferredFoot
  familyBackground: FamilyBackground
  /** 成年目标身高，未成年按年龄缩放显示 */
  adultHeightCm: number
  adultWeightKg: number
  heightCm: number
  weightKg: number
  age: number
  attributes: Attributes
  hiddenAttributes: HiddenAttributes
  OVR: number
  potential: number
  growthScore: number
  interest: number
  morale: number
  fatigue: number
  funds: number
  currentTeamId: string | null
  injury: Injury | null
  relationships: Relationships
  careerStats: CareerStats
  /** 本赛季数据，赛季重置；与 leagueBoard 玩家行一致 */
  seasonStats: SeasonPlayerStats
  contract: PlayerContract | null
  traits: string[]
  honors: Honor[]
}

export interface Team {
  id: string
  name: string
  shortName: string
  city: string
  country: string
  league: LeagueId
  reputation: number
  youthAcademy: number
  strength: number
  colors: { primary: string; secondary: string }
}

export interface LeagueStanding {
  teamId: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
}

export interface SeasonSnapshot {
  year: number
  leagueId: LeagueId
  standings: LeagueStanding[]
  championTeamId: string | null
  cupChampionTeamId: string | null
  playerLeagueRank: number | null
  playerStats: { apps: number; goals: number; assists: number; avgRating: number }
}

/** 联赛/杯赛个人数据榜一行 */
export interface SeasonBoardRow {
  playerId: string
  name: string
  teamId: string
  goals: number
  assists: number
  dribbles: number
  apps: number
  ratingSum: number
}

export interface NationalFixture {
  /** 如 2026年3月 第2周 */
  dateLabel: string
  year: number
  month: number
  week: number
  opponent: string
  competition: string
  venue: '主场' | '客场' | '中立场'
  status: 'upcoming' | 'played' | 'skipped'
  result?: string
}

export interface InternationalState {
  nationName: string
  caps: number
  goals: number
  /** 是否在国家队大名单窗口 */
  calledUp: boolean
  /** 当前国字号阶段 */
  stage: 'none' | 'wc_qualifier' | 'asian_cup' | 'world_cup'
  stageLabel: string
  nextWindowLabel: string
  campStatus: 'none' | 'provisional' | 'final' | 'missed'
  provisionalSquad: string[]
  finalSquad: string[] | null
  lastAnnouncement: string | null
  /** 集训报到时间 */
  campReportLabel: string | null
  /** 集训结束/归队 */
  campReturnLabel: string | null
  /** 窗口内国家队比赛 */
  fixtures: NationalFixture[]
}

export interface SeasonState {
  year: number
  round: number
  leagueId: LeagueId
  standings: LeagueStanding[]
  cupRound: number
  cupEliminated: boolean
  playerTeamId: string
  seasonHistory: SeasonSnapshot[]
  /** 本赛季联赛个人榜 */
  leagueBoard: SeasonBoardRow[]
  /** 本赛季国内杯赛个人榜 */
  cupBoard: SeasonBoardRow[]
  /** 本赛季赛果（可翻阅） */
  matchLog: MatchResult[]
  international: InternationalState
}

export type MatchEventType =
  | 'kickoff'
  | 'goal'
  | 'assist_note'
  | 'yellow'
  | 'red'
  | 'sub_on'
  | 'sub_off'
  | 'ht'
  | 'ft'
  | 'chance'

export interface MatchEvent {
  minute: number
  type: MatchEventType
  /** 主队进球后比分等 */
  text: string
  teamId?: string
  scorerName?: string
  assistName?: string
  /** 是否与玩家直接相关 */
  isPlayer?: boolean
}

export interface MatchLineupRating {
  playerId: string
  name: string
  teamId: string
  position: string
  rating: number
  goals: number
  assists: number
  minutes: number
  dribbles: number
  isUser?: boolean
}

export interface MatchResult {
  id: string
  homeTeamId: string
  awayTeamId: string
  homeGoals: number
  awayGoals: number
  playerRating: number
  playerGoals: number
  playerAssists: number
  playerMinutes: number
  playerDribbles: number
  /** 是否首发 */
  playerStarted: boolean
  /** 替补上场分钟；首发则为 null */
  playerSubOnMinute: number | null
  /** 被换下分钟；打满或替补未下则为 null */
  playerSubOffMinute: number | null
  isHome: boolean
  highlights: string[]
  /** 时间轴事件（进球分钟等） */
  events: MatchEvent[]
  /** 双方评分面板 */
  lineupRatings: MatchLineupRating[]
  /** 网络/媒体评价 */
  mediaComments: string[]
  motmName: string
  competition: CompetitionId
  /** 赛季年份/轮次便于赛程页展示 */
  seasonYear?: number
  roundLabel?: string
}

export interface EventEffects {
  attributes?: Partial<Attributes>
  hiddenAttributes?: Partial<Record<HiddenAttrKey, number>>
  relationships?: Partial<Relationships>
  funds?: number
  morale?: number
  fatigue?: number
  interest?: number
  injuryRisk?: number
  growthScore?: number
  potential?: number
}

export interface EventOption {
  id: string
  text: string
  effects: EventEffects
  consequenceText?: string
}

export interface GameEvent {
  id: string
  ageRange: [number, number]
  category: EventCategory
  narrative: string
  options: EventOption[]
  isKeyEvent?: boolean
  /** 一生只触发一次，永不重复 */
  once?: boolean
}

export interface GameTime {
  year: number
  month: number
  week: number
  absoluteWeek: number
}

export interface AttrDelta {
  key: AttributeKey
  before: number
  after: number
  delta: number
}

export interface TrainingResult {
  focus: TrainingFocus
  deltas: AttrDelta[]
  ovrBefore: number
  ovrAfter: number
  fatigueBefore: number
  fatigueAfter: number
  note: string
}

export interface WeekPhase {
  step: 'event' | 'training' | 'match' | 'done'
  currentEvent: GameEvent | null
  lastMatch: MatchResult | null
  lastEventConsequence: string | null
  lastTrainingResult: TrainingResult | null
  trainingDone: boolean
  eventDone: boolean
  eventSource: 'local' | 'ai' | 'generic'
  /** 本周事件角色：赛前 / 赛后复盘 / 日常 */
  eventRole: 'normal' | 'prematch' | 'postmatch'
  /** 赛后建议的训练侧重 */
  suggestedTraining: TrainingFocus | null
}

/** 月度（或少年期章节）预生成事件队列 */
export interface QueuedEventItem {
  event: GameEvent
  source: 'local' | 'ai' | 'generic'
}

export interface GameState {
  version: number
  mode: GameMode
  player: Player
  time: GameTime
  season: SeasonState
  week: WeekPhase
  usedEventIds: string[]
  history: string[]
  /** AI 上帝叙事记忆：关键剧情节拍，供下周生成沿用 */
  aiMemory: string[]
  /** 已生成待消耗的事件（职业期约 4 周/月） */
  eventQueue: QueuedEventItem[]
  /** 主页大事件刊报 */
  bulletin: BulletinItem[]
  retired: boolean
  retirementTitle: string | null
}

export interface SaveSlot {
  id: string
  updatedAt: number
  playerName: string
  age: number
  ovr: number
  summary: string
  state: GameState
}

export interface CareerArchiveEntry {
  id: string
  finishedAt: number
  playerName: string
  position: Position
  birthCity: string
  finalAge: number
  finalOvr: number
  growthScore: number
  grade: string
  appearances: number
  goals: number
  assists: number
  honors: Honor[]
  teamName: string
  seasonsPlayed: number
}

export interface CreatePlayerInput {
  name: string
  birthCity: string
  jerseyNumber: number
  position: Position
  preferredFoot: PreferredFoot
  familyBackground: FamilyBackground
  mode: GameMode
}

export interface AppSettings {
  apiKey: string
  apiProvider: ApiProviderId
  apiEndpoint: string
  /** 用户自选模型名，如 glm-4.5-air / glm-4.6v / deepseek-chat */
  apiModel: string
  /**
   * 线上静态站（GitHub Pages 等）用的跨域代理根，如 https://xxx.workers.dev
   * 本地 npm run dev 可不填（走 Vite /ai-proxy）
   */
  aiProxyBase: string
  difficulty: 'easy' | 'normal' | 'hard'
  useAiEvents: boolean
}
