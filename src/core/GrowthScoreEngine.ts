export interface GrowthGrade {
  min: number
  title: string
  en: string
}

export const GROWTH_GRADES: GrowthGrade[] = [
  { min: 9000, title: '传奇', en: 'Legend' },
  { min: 7500, title: '巨星', en: 'Superstar' },
  { min: 6000, title: '球星', en: 'Star Player' },
  { min: 4500, title: '主力', en: 'Regular Starter' },
  { min: 3000, title: '轮换', en: 'Rotation Player' },
  { min: 1500, title: '替补', en: 'Bench Player' },
  { min: 0, title: '失败者', en: 'Flop' },
]

export function gradeFromScore(score: number): GrowthGrade {
  for (const g of GROWTH_GRADES) {
    if (score >= g.min) return g
  }
  return GROWTH_GRADES[GROWTH_GRADES.length - 1]!
}

export function careerBonusScore(params: {
  appearances: number
  goals: number
  assists: number
  avgRating: number
  ovr: number
}): number {
  const { appearances, goals, assists, avgRating, ovr } = params
  return Math.round(
    appearances * 2 +
      goals * 12 +
      assists * 8 +
      avgRating * 80 +
      ovr * 5,
  )
}
