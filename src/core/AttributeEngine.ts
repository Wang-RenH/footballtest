import type { AttributeKey, Attributes, LifeStage, Position } from '@/models/types'
import positionWeights from '@/data/attributes/position_weights.json'
import growthRates from '@/data/attributes/growth_rates.json'
import { clamp } from '@/utils/random'

const weights = positionWeights as Record<Position, Record<AttributeKey, number>>
const rates = growthRates as Record<
  string,
  { minAge: number; maxAge: number; attrGainMult: number; eventsPerYear: number }
>

export function getLifeStage(age: number): LifeStage {
  if (age <= 6) return 'enlightenment'
  if (age <= 12) return 'youth'
  if (age <= 17) return 'academy'
  if (age <= 22) return 'pro_early'
  if (age <= 33) return 'prime'
  if (age <= 38) return 'late'
  return 'retired'
}

export function calcOVR(attrs: Attributes, position: Position): number {
  const w = weights[position]
  const sum =
    attrs.PAC * w.PAC +
    attrs.SHO * w.SHO +
    attrs.PAS * w.PAS +
    attrs.DRI * w.DRI +
    attrs.DEF * w.DEF +
    attrs.PHY * w.PHY
  return Math.round(clamp(sum, 1, 99))
}

export function getGrowthMult(age: number): number {
  const stage = getLifeStage(age)
  if (stage === 'retired') return 0
  return rates[stage]?.attrGainMult ?? 0.5
}

export function applyAttrDelta(
  attrs: Attributes,
  delta: Partial<Attributes>,
  potential: number,
): Attributes {
  const next = { ...attrs }
  ;(Object.keys(delta) as AttributeKey[]).forEach((k) => {
    const d = delta[k] ?? 0
    next[k] = clamp(Math.round(next[k] + d), 1, Math.min(99, potential + 5))
  })
  return next
}

export function applyTrainingDetailed(
  attrs: Attributes,
  focus: AttributeKey,
  age: number,
  potential: number,
  workRate: number,
  position: Position,
): { attrs: Attributes; deltas: { key: AttributeKey; before: number; after: number; delta: number }[]; ovrBefore: number; ovrAfter: number } {
  const ovrBefore = calcOVR(attrs, position)
  const before = { ...attrs }
  const mult = getGrowthMult(age)
  let next: Attributes
  if (mult <= 0) {
    next = applyAttrDelta(
      attrs,
      { [focus]: 0.4, PHY: -0.3 } as Partial<Attributes>,
      potential,
    )
  } else {
    const base = 1.4 + workRate * 0.06
    const gain = Math.max(1, Math.round(base * mult * randJitter()))
    // 副属性轻微连带
    const sideKeys: AttributeKey[] = (['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'] as AttributeKey[]).filter(
      (k) => k !== focus,
    )
    const side = sideKeys[Math.floor(Math.random() * sideKeys.length)]!
    const delta: Partial<Attributes> = { [focus]: gain }
    if (Math.random() < 0.35) delta[side] = Math.random() < 0.5 ? 1 : 0
    next = applyAttrDelta(attrs, delta, potential)
  }
  const keys: AttributeKey[] = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']
  const deltas = keys
    .map((key) => ({
      key,
      before: before[key],
      after: next[key],
      delta: next[key] - before[key],
    }))
    .filter((d) => d.delta !== 0)
  const ovrAfter = calcOVR(next, position)
  return { attrs: next, deltas, ovrBefore, ovrAfter }
}

/** @deprecated 使用 applyTrainingDetailed */
export function applyTraining(
  attrs: Attributes,
  focus: AttributeKey,
  age: number,
  potential: number,
  workRate: number,
): Attributes {
  return applyTrainingDetailed(attrs, focus, age, potential, workRate, 'ST').attrs
}

function randJitter(): number {
  return 0.75 + Math.random() * 0.5
}

/** 按位置生成初始六维 */
export function baseAttributesForPosition(
  position: Position,
  age: number,
  familyBoost: number,
): Attributes {
  const stage = getLifeStage(age)
  let base = 35
  if (stage === 'enlightenment') base = 12
  else if (stage === 'youth') base = 28
  else if (stage === 'academy') base = 48
  else if (stage === 'pro_early') base = 62
  else base = 68

  base += familyBoost

  const primary: Record<Position, AttributeKey[]> = {
    GK: ['DEF', 'PHY', 'PAS'],
    CB: ['DEF', 'PHY', 'PAS'],
    LB: ['PAC', 'DEF', 'PAS'],
    RB: ['PAC', 'DEF', 'PAS'],
    CDM: ['DEF', 'PAS', 'PHY'],
    CM: ['PAS', 'DRI', 'PHY'],
    CAM: ['PAS', 'DRI', 'SHO'],
    LW: ['PAC', 'DRI', 'SHO'],
    RW: ['PAC', 'DRI', 'SHO'],
    ST: ['SHO', 'PAC', 'PHY'],
    CF: ['SHO', 'DRI', 'PAS'],
  }

  const keys: AttributeKey[] = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']
  const prefs = primary[position]
  const attrs = {} as Attributes
  keys.forEach((k) => {
    const bonus = prefs.includes(k) ? 8 + Math.random() * 6 : Math.random() * 4
    attrs[k] = Math.round(clamp(base + bonus + (Math.random() * 6 - 3), 1, 85))
  })
  return attrs
}

export const ATTR_LABELS: Record<AttributeKey, string> = {
  PAC: '速度',
  SHO: '射门',
  PAS: '传球',
  DRI: '盘带',
  DEF: '防守',
  PHY: '身体',
}

export const POSITION_LABELS: Record<Position, string> = {
  GK: '门将',
  CB: '中后卫',
  LB: '左后卫',
  RB: '右后卫',
  CDM: '后腰',
  CM: '中场',
  CAM: '前腰',
  LW: '左边锋',
  RW: '右边锋',
  ST: '前锋',
  CF: '影锋',
}
