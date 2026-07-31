import type { TrainingResult } from '@/models/types'
import { ATTR_LABELS } from '@/core/AttributeEngine'
import { useGameStore } from '@/store/gameStore'

export function TrainingResultModal() {
  const result = useGameStore((s) => s.trainingModal)
  const dismiss = useGameStore((s) => s.dismissTrainingModal)
  if (!result) return null

  return (
    <div className="modal-backdrop fade-in" role="dialog" aria-modal="true">
      <div className="modal-panel slide-up">
        <p className="modal-kicker">训练结算</p>
        <h3 className="font-display text-2xl text-[var(--ink)]">
          {result.focus === 'REST' ? '休息恢复' : `${ATTR_LABELS[result.focus]}训练完成`}
        </h3>
        <p className="mt-2 text-sm text-black/55">{result.note}</p>

        {result.deltas.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {result.deltas.map((d) => (
              <li
                key={d.key}
                className="flex items-center justify-between rounded-md bg-black/5 px-3 py-2 text-sm"
              >
                <span>{ATTR_LABELS[d.key]}</span>
                <span className="font-semibold tabular-nums">
                  {d.before}
                  <span className="mx-1 text-black/35">→</span>
                  {d.after}
                  <span className={d.delta > 0 ? 'ml-2 text-emerald-700' : 'ml-2 text-rose-700'}>
                    ({d.delta > 0 ? '+' : ''}
                    {d.delta})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md bg-black/5 px-3 py-2">
            <div className="text-xs text-black/40">OVR</div>
            <div className="font-semibold">
              {result.ovrBefore} → {result.ovrAfter}
              {result.ovrAfter !== result.ovrBefore ? (
                <span className="ml-1 text-emerald-700">
                  ({result.ovrAfter - result.ovrBefore > 0 ? '+' : ''}
                  {result.ovrAfter - result.ovrBefore})
                </span>
              ) : null}
            </div>
          </div>
          <div className="rounded-md bg-black/5 px-3 py-2">
            <div className="text-xs text-black/40">疲劳</div>
            <div className="font-semibold">
              {result.fatigueBefore} → {result.fatigueAfter}
            </div>
          </div>
        </div>

        <button type="button" className="btn btn-primary mt-6 w-full" onClick={() => dismiss()}>
          完成本周
        </button>
      </div>
    </div>
  )
}

export type { TrainingResult }
