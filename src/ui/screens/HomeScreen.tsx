import { useGameStore } from '@/store/gameStore'

export function HomeScreen() {
  const hasExistingSave = useGameStore((s) => s.hasExistingSave)
  const setScreen = useGameStore((s) => s.setScreen)
  const continueGame = useGameStore((s) => s.continueGame)

  return (
    <div className="flex min-h-[100dvh] flex-col justify-between px-6 pb-10 pt-16">
      <div className="fade-in">
        <p className="text-xs tracking-[0.35em] text-yellow-400/70">GRASSROOTS TO GLORY</p>
        <h1 className="font-display mt-3 text-5xl leading-tight text-white md:text-6xl">
          绿茵征途
        </h1>
        <p className="mt-4 max-w-sm text-base text-white/60">
          从绿茵启蒙到职业巅峰，书写属于你的中国球员生涯。
        </p>
      </div>

      <div
        className="pointer-events-none my-8 h-40 w-full rounded-lg opacity-80"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, rgba(45,155,108,0.25) 40%, rgba(11,61,46,0.5) 100%), repeating-linear-gradient(90deg, transparent, transparent 28px, rgba(255,255,255,0.04) 28px, rgba(255,255,255,0.04) 30px)',
        }}
        aria-hidden
      />

      <div className="slide-up flex flex-col gap-3">
        <button
          type="button"
          className="btn btn-primary pulse-cta w-full"
          onClick={() => setScreen('create')}
        >
          开始新生涯
        </button>
        {hasExistingSave ? (
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => continueGame()}
          >
            继续游戏
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => setScreen('archive')}
        >
          生涯档案馆
        </button>
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => setScreen('settings')}
        >
          设置
        </button>
      </div>
    </div>
  )
}
