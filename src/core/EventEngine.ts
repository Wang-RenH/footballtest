import type {
  EventEffects,
  EventOption,
  GameEvent,
  MatchResult,
  Player,
  TrainingFocus,
  AttributeKey,
} from '@/models/types'
import age0306 from '@/data/events/age_03_06.json'
import age0712 from '@/data/events/age_07_12.json'
import age1317 from '@/data/events/age_13_17.json'
import age1822 from '@/data/events/age_18_22.json'
import age2333 from '@/data/events/age_23_33.json'
import age3440 from '@/data/events/age_34_40.json'
import { applyAttrDelta, ATTR_LABELS } from '@/core/AttributeEngine'
import { teamName } from '@/core/LeagueEngine'
import { clamp, pickRandom, uid } from '@/utils/random'

const RAW = [
  ...age0306,
  ...age0712,
  ...age1317,
  ...age1822,
  ...age2333,
  ...age3440,
] as GameEvent[]

/** 关键/里程碑事件默认一生一次 */
const ALL_EVENTS: GameEvent[] = RAW.map((e) => ({
  ...e,
  once: e.once ?? e.isKeyEvent ?? isMilestoneId(e.id),
}))

function isMilestoneId(id: string): boolean {
  return /TRIAL|SCHOOL|ACADEMY|DEBUT|CONTRACT|CAPTAIN|TRANSFER|RETIRE|U16|SPORTS_SCHOOL|FIRST_MATCH|FIRST_TEAM/i.test(
    id,
  )
}

export function getEventsForAge(age: number, usedIds: string[]): GameEvent[] {
  const used = new Set(usedIds)
  return ALL_EVENTS.filter((e) => {
    if (age < e.ageRange[0] || age > e.ageRange[1]) return false
    if (used.has(e.id)) return false
    return true
  })
}

export function pickWeeklyEvent(
  age: number,
  usedIds: string[],
): { event: GameEvent; source: 'local' | 'generic' } {
  const pool = getEventsForAge(age, usedIds)
  if (pool.length > 0) {
    // 关键未触发事件：适龄时提高权重，但绝不重复
    const key = pool.filter((e) => e.isKeyEvent || e.once)
    const normal = pool.filter((e) => !e.isKeyEvent && !e.once)
    if (key.length > 0 && (normal.length === 0 || Math.random() < 0.35)) {
      return { event: pickRandom(key), source: 'local' }
    }
    if (normal.length > 0) return { event: pickRandom(normal), source: 'local' }
    return { event: pickRandom(pool), source: 'local' }
  }

  // 池耗尽：只用可重复的非 once 事件；仍无则生成通用事件（绝不重复里程碑）
  const repeatable = ALL_EVENTS.filter(
    (e) =>
      age >= e.ageRange[0] &&
      age <= e.ageRange[1] &&
      !e.once &&
      !e.isKeyEvent,
  )
  if (repeatable.length > 0) {
    return { event: pickRandom(repeatable), source: 'local' }
  }
  return { event: createGenericEvent(age), source: 'generic' }
}

const GENERIC_TEMPLATES: Array<(age: number) => GameEvent> = [
  (age) => ({
    id: uid('gen'),
    ageRange: [age, age],
    category: 'training',
    narrative: `${age} 岁的你又在训练场上挥汗。教练喊着节奏，队友们各自较劲。`,
    options: [
      {
        id: 'a',
        text: '加练核心技术',
        effects: { attributes: { DRI: 1 }, growthScore: 35, fatigue: 8 },
        consequenceText: '技术细节又打磨了一层。',
      },
      {
        id: 'b',
        text: '跟体能教练冲刺',
        effects: { attributes: { PAC: 1, PHY: 1 }, growthScore: 30, fatigue: 12 },
        consequenceText: '腿像灌了铅，但速度感回来了。',
      },
      {
        id: 'c',
        text: '观摩录像总结',
        effects: { attributes: { PAS: 1 }, growthScore: 28, hiddenAttributes: { decision: 1 } },
        consequenceText: '你在脑子里把比赛重跑了一遍。',
      },
    ],
  }),
  (age) => ({
    id: uid('gen'),
    ageRange: [age, age],
    category: 'life',
    narrative: `休息日，家人打电话过来关心你的近况。窗外城市灯火，你坐在宿舍床沿。`,
    options: [
      {
        id: 'a',
        text: '好好聊聊近况',
        effects: { relationships: { father: 3, mother: 3 }, morale: 6, growthScore: 25 },
        consequenceText: '心里暖了一下，状态也好了些。',
      },
      {
        id: 'b',
        text: '匆匆敷衍挂断',
        effects: { relationships: { mother: -2 }, growthScore: 5 },
        consequenceText: '电话那头沉默了一会儿。',
      },
      {
        id: 'c',
        text: '约他们周末见面',
        effects: { funds: -800, morale: 8, growthScore: 30, relationships: { father: 4 } },
        consequenceText: '一顿家常菜，比任何补剂都管用。',
      },
    ],
  }),
  (age) => ({
    id: uid('gen'),
    ageRange: [age, age],
    category: 'social',
    narrative: `更衣室里有人拿你最近的表现开玩笑，气氛有点微妙。`,
    options: [
      {
        id: 'a',
        text: '一笑而过，继续训练',
        effects: { relationships: { teammates: 2 }, growthScore: 30, hiddenAttributes: { composure: 1 } },
        consequenceText: '你用态度证明了自己的成熟。',
      },
      {
        id: 'b',
        text: '正面回怼',
        effects: { relationships: { teammates: -4 }, morale: -3, growthScore: 10 },
        consequenceText: '火药味散开了，但隔阂还在。',
      },
      {
        id: 'c',
        text: '私下找对方沟通',
        effects: { relationships: { teammates: 5 }, growthScore: 40 },
        consequenceText: '两人反而更熟了。',
      },
    ],
  }),
]

function createGenericEvent(age: number): GameEvent {
  return pickRandom(GENERIC_TEMPLATES)(age)
}

export function applyEventOption(
  player: Player,
  option: EventOption,
): { player: Player; consequence: string } {
  const effects = option.effects
  let next: Player = {
    ...player,
    attributes: { ...player.attributes },
    hiddenAttributes: { ...player.hiddenAttributes },
    relationships: { ...player.relationships },
    careerStats: { ...player.careerStats },
    honors: [...player.honors],
  }

  if (effects.attributes) {
    next.attributes = applyAttrDelta(next.attributes, effects.attributes, next.potential)
  }
  if (effects.hiddenAttributes) {
    for (const [k, v] of Object.entries(effects.hiddenAttributes)) {
      const key = k as keyof typeof next.hiddenAttributes
      next.hiddenAttributes[key] = clamp(next.hiddenAttributes[key] + (v ?? 0), 1, 20)
    }
  }
  if (effects.relationships) {
    for (const [k, v] of Object.entries(effects.relationships)) {
      const key = k as keyof typeof next.relationships
      next.relationships[key] = clamp(next.relationships[key] + (v ?? 0), 0, 100)
    }
  }
  if (effects.funds != null) next.funds = Math.max(0, next.funds + effects.funds)
  if (effects.morale != null) next.morale = clamp(next.morale + effects.morale, 0, 100)
  if (effects.fatigue != null) next.fatigue = clamp(next.fatigue + effects.fatigue, 0, 100)
  if (effects.interest != null) next.interest = clamp(next.interest + effects.interest, 0, 100)
  if (effects.growthScore != null) next.growthScore = Math.max(0, next.growthScore + effects.growthScore)
  if (effects.potential != null) next.potential = clamp(next.potential + effects.potential, 40, 99)

  if (effects.injuryRisk != null && effects.injuryRisk > 0) {
    const risk = effects.injuryRisk / 100 + next.hiddenAttributes.injuryProneness * 0.01
    if (Math.random() < risk) {
      next.injury = {
        name: '肌肉拉伤',
        weeksLeft: 2 + Math.floor(Math.random() * 3),
        attrPenalty: { PAC: -2, PHY: -1 },
      }
      next.morale = clamp(next.morale - 8, 0, 100)
    }
  }

  return {
    player: next,
    consequence: option.consequenceText ?? '选择已生效。',
  }
}

export function mergeEffectsPreview(effects: EventEffects): string {
  const parts: string[] = []
  if (effects.attributes) {
    for (const [k, v] of Object.entries(effects.attributes)) {
      if (!v) continue
      const label = ATTR_LABELS[k as AttributeKey] ?? k
      parts.push(`${label}${v > 0 ? '+' : ''}${v}`)
    }
  }
  // 成长分对玩家隐藏，退役时再揭晓
  if (effects.funds) parts.push(`资金${effects.funds > 0 ? '+' : ''}${effects.funds}`)
  if (effects.morale) parts.push(`心情${effects.morale > 0 ? '+' : ''}${effects.morale}`)
  if (effects.fatigue) parts.push(`疲劳${effects.fatigue > 0 ? '+' : ''}${effects.fatigue}`)
  if (effects.interest) parts.push(`兴趣${effects.interest > 0 ? '+' : ''}${effects.interest}`)
  return parts.slice(0, 3).join(' · ') || '影响未知'
}

export function markEventUsed(usedIds: string[], event: GameEvent): string[] {
  if (!event.once && !event.isKeyEvent) {
    // 可重复事件也记入近期，避免连抽同一条
    const next = [...usedIds, event.id]
    return next.slice(-120)
  }
  // 一次性事件永久保留
  if (usedIds.includes(event.id)) return usedIds
  return [...usedIds, event.id]
}

/** 赛后复盘事件：根据本场表现给个性化选项与训练建议 */
export function buildPostMatchEvent(
  player: Player,
  match: MatchResult,
): { event: GameEvent; suggestedTraining: TrainingFocus } {
  const myGoals = match.isHome ? match.homeGoals : match.awayGoals
  const oppGoals = match.isHome ? match.awayGoals : match.homeGoals
  const won = myGoals > oppGoals
  const draw = myGoals === oppGoals
  const oppId = match.isHome ? match.awayTeamId : match.homeTeamId
  const opp = teamName(oppId)
  const resultWord = won ? '取胜' : draw ? '战平' : '落败'

  let suggested: TrainingFocus = 'DRI'
  if (player.fatigue >= 75) suggested = 'REST'
  else if (match.playerRating < 6) suggested = 'PHY'
  else if (match.playerGoals > 0 || match.playerAssists > 0) {
    suggested = match.playerAssists > match.playerGoals ? 'PAS' : 'SHO'
  } else if (['CB', 'LB', 'RB', 'CDM'].includes(player.position)) suggested = 'DEF'
  else if (match.playerRating >= 8) suggested = 'PAS'

  const focusLabel =
    suggested === 'REST' ? '恢复' : ATTR_LABELS[suggested as AttributeKey] ?? suggested

  const appearance =
    match.playerMinutes <= 0
      ? '未出场'
      : match.playerStarted
        ? match.playerSubOffMinute != null
          ? `首发并在 ${match.playerSubOffMinute}' 被换下（共 ${match.playerMinutes} 分钟）`
          : `首发打满 ${match.playerMinutes} 分钟`
        : `第 ${match.playerSubOnMinute ?? '?'} 分钟替补登场（共 ${match.playerMinutes} 分钟）`

  const scoredAt = (match.events ?? [])
    .filter((e) => e.type === 'goal' && e.scorerName === player.name)
    .map((e) => `${e.minute}'`)
    .join('、')

  const narrative = `对阵${opp} ${myGoals}-${oppGoals} ${resultWord}。你${appearance}，评分 ${match.playerRating}${
    match.playerGoals
      ? `，打进 ${match.playerGoals} 球${scoredAt ? `（${scoredAt}）` : ''}`
      : ''
  }${match.playerAssists ? `，助攻 ${match.playerAssists} 次` : ''}。教练组要你对照本场表现，安排本周训练重点。`

  const event: GameEvent = {
    id: uid('postmatch'),
    ageRange: [player.age, player.age],
    category: 'match',
    narrative,
    once: false,
    options: [
      {
        id: 'a',
        text:
          suggested === 'REST'
            ? '主动申请减量恢复'
            : `按教练建议主练「${focusLabel}」`,
        consequenceText: '训练计划已按本场复盘对齐。',
        effects: { growthScore: 25, fatigue: suggested === 'REST' ? -8 : 4, morale: won ? 4 : 1 },
      },
      {
        id: 'b',
        text: '加练体能，把比赛强度吃透',
        consequenceText: '体能课很硬，腿有点沉。',
        effects: { attributes: { PHY: 1 }, growthScore: 30, fatigue: 12 },
      },
      {
        id: 'c',
        text: '看录像复盘传球与决策',
        consequenceText: '你在会议室里把关键回合看了三遍。',
        effects: { attributes: { PAS: 1 }, growthScore: 28, hiddenAttributes: { decision: 1 } },
      },
      {
        id: 'd',
        text: won ? '庆祝过度，训练打卡了事' : '情绪低落，敷衍完训练',
        consequenceText: won ? '派对很嗨，第二天状态一般。' : '教练看在眼里，没有当场发作。',
        effects: {
          growthScore: -5,
          morale: won ? 6 : -4,
          fatigue: won ? 6 : -2,
          relationships: { coach: -2 },
        },
      },
      {
        id: 'e',
        text: '加练到深夜，赌下一场首发',
        consequenceText: '你留下加练，风险与回报一并上升。',
        effects: { growthScore: 40, fatigue: 16, interest: 3 },
      },
    ],
  }

  return { event, suggestedTraining: suggested }
}

