import type { AttributeKey, TrainingFocus } from '@/models/types'
import { ATTR_LABELS } from '@/core/AttributeEngine'
import { useGameStore } from '@/store/gameStore'
import { FlowHeader } from '@/ui/components/FlowHeader'

const FOCUSES: TrainingFocus[] = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY', 'REST']

export function TrainingScreen() {
  const flash = useGameStore((s) => s.flash)
  const chooseTraining = useGameStore((s) => s.chooseTraining)
  const player = useGameStore((s) => s.state!.player)
  const trainingDone = useGameStore((s) => s.state!.week.trainingDone)
  const suggested = useGameStore((s) => s.state!.week.suggestedTraining)
  const eventRole = useGameStore((s) => s.state!.week.eventRole)
  const hasModal = useGameStore((s) => s.trainingModal != null)
  const eventLoading = useGameStore((s) => s.eventLoading)
  const locked = trainingDone || hasModal || eventLoading

  return (
    <div className="fade-in px-4 py-5 pb-28">
      <FlowHeader title="训练安排" />
      <h2 className="font-display text-2xl text-white">本周训练</h2>
      <p className="mt-1 text-sm text-white/50">
        {locked
          ? '本周训练已完成，请等待结算。'
          : eventRole === 'postmatch' && suggested
            ? `赛后建议侧重「${suggested === 'REST' ? '休息恢复' : ATTR_LABELS[suggested as AttributeKey]}」，也可自选。`
            : '选择一项重点，影响属性成长方向。每周仅一次。'}
      </p>
      {flash ? (
        <p className="mt-3 rounded-md bg-white/5 px-3 py-2 text-sm text-white/70">{flash}</p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-2">
        {FOCUSES.map((f, i) => {
          const isSuggested = suggested === f
          return (
            <button
              key={f}
              type="button"
              disabled={locked}
              className={`slide-up rounded-md border px-3 py-4 text-left ${
                locked
                  ? 'cursor-not-allowed border-white/5 bg-white/[0.03] opacity-45'
                  : isSuggested
                    ? 'border-yellow-400/55 bg-yellow-400/10 hover:border-yellow-400/70'
                    : 'border-white/10 bg-white/5 hover:border-yellow-400/40'
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
              onClick={() => chooseTraining(f)}
            >
              <div className="font-medium text-white">
                {f === 'REST' ? '休息恢复' : `${ATTR_LABELS[f as AttributeKey]}训练`}
                {isSuggested && !locked ? (
                  <span className="ml-2 text-[10px] tracking-wider text-yellow-200/80">建议</span>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-white/40">
                {f === 'REST'
                  ? '降低疲劳，微幅回心情'
                  : `当前 ${player.attributes[f as AttributeKey]}`}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
