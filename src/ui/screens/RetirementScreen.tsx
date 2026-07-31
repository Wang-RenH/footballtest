import { useGameStore } from '@/store/gameStore'
import { gradeFromScore } from '@/core/GrowthScoreEngine'

export function RetirementScreen() {
  const state = useGameStore((s) => s.state)!
  const setScreen = useGameStore((s) => s.setScreen)
  const deleteSave = useGameStore((s) => s.deleteSave)
  const { player, retirementTitle } = state
  const grade = gradeFromScore(player.growthScore)

  return (
    <div className="fade-in flex min-h-[100dvh] flex-col px-5 py-10">
      <p className="text-xs tracking-[0.3em] text-yellow-400/70">CAREER COMPLETE</p>
      <h1 className="font-display mt-3 text-4xl text-white">退役终章</h1>
      <p className="mt-2 text-white/55">
        {player.name} 的绿茵故事，写到了这里。
      </p>

      <div className="panel slide-up mt-8 p-6 text-center">
        <p className="text-sm text-white/45">隐藏成长分揭晓</p>
        <p className="font-display mt-2 text-5xl text-yellow-300">{player.growthScore}</p>
        <p className="mt-3 text-xl text-white">{retirementTitle ?? `${grade.title} · ${grade.en}`}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 text-sm">
        <Box label="出场" value={player.careerStats.appearances} />
        <Box label="进球" value={player.careerStats.goals} />
        <Box label="助攻" value={player.careerStats.assists} />
        <Box label="场均评分" value={player.careerStats.avgRating || '-'} />
        <Box label="最终 OVR" value={player.OVR} />
        <Box label="退役年龄" value={player.age} />
      </div>

      <div className="mt-auto flex flex-col gap-3 pt-10">
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => {
            deleteSave()
            setScreen('create')
          }}
        >
          开启新一周目
        </button>
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => {
            deleteSave()
            setScreen('home')
          }}
        >
          返回首页
        </button>
      </div>
    </div>
  )
}

function Box({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-white/5 px-3 py-3">
      <div className="text-xs text-white/40">{label}</div>
      <div className="text-lg text-white">{value}</div>
    </div>
  )
}
