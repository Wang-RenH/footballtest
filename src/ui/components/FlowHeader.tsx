import { useGameStore } from '@/store/gameStore'

interface Props {
  title?: string
}

/** 抉择/训练/比赛等流程页顶部：可随时回仪表盘或主菜单 */
export function FlowHeader({ title }: Props) {
  const setScreen = useGameStore((s) => s.setScreen)

  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <button
        type="button"
        className="text-sm text-white/55 transition hover:text-yellow-200"
        onClick={() => setScreen('dashboard')}
      >
        ← 返回本周
      </button>
      {title ? <span className="text-xs tracking-widest text-white/35">{title}</span> : <span />}
      <button
        type="button"
        className="text-sm text-white/55 transition hover:text-yellow-200"
        onClick={() => setScreen('home')}
      >
        主菜单
      </button>
    </div>
  )
}
