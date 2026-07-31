import type { Position } from '@/models/types'
import { clamp, randInt } from '@/utils/random'

/** 成年目标体型（按位置） */
export function adultBodyTargets(position: Position): { heightCm: number; weightKg: number } {
  const tall = position === 'GK' || position === 'CB'
  const heightCm = (tall ? 186 : 178) + randInt(-4, 4)
  const bmi = tall ? 23.2 : 22.4
  const weightKg = Math.round((bmi * (heightCm / 100) ** 2) + randInt(-3, 3))
  return { heightCm, weightKg }
}

/**
 * 按年龄缩放显示身高体重（儿童不会出现成年体型）
 * 参考大致生长曲线简化
 */
export function bodyAtAge(
  age: number,
  adultHeight: number,
  adultWeight: number,
): { heightCm: number; weightKg: number } {
  const t = growthFactor(age)
  const heightCm = Math.round(clamp(adultHeight * t, 90, adultHeight))
  // 体重随身高立方近似，再压一点脂肪比例
  const weightCm = Math.round(
    clamp(adultWeight * t * t * t * (0.85 + t * 0.15), 12, adultWeight),
  )
  return { heightCm, weightKg: weightCm }
}

function growthFactor(age: number): number {
  if (age <= 3) return 0.55
  if (age <= 6) return 0.55 + ((age - 3) / 3) * 0.1
  if (age <= 10) return 0.65 + ((age - 6) / 4) * 0.12
  if (age <= 14) return 0.77 + ((age - 10) / 4) * 0.12
  if (age <= 17) return 0.89 + ((age - 14) / 3) * 0.08
  return 1
}

export function applyBirthdayGrowth(
  age: number,
  adultHeight: number,
  adultWeight: number,
): { heightCm: number; weightKg: number } {
  return bodyAtAge(age, adultHeight, adultWeight)
}
