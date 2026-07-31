import { useState } from 'react'
import type { GameEvent } from '@/models/types'
import { mergeEffectsPreview } from '@/core/EventEngine'
import { ChoiceButton } from '@/ui/components/ChoiceButton'

interface Props {
  event: GameEvent
  onChoose: (optionId: string) => void
  onCustomSubmit: (text: string) => void
  customLoading?: boolean
}

export function EventDialog({ event, onChoose, onCustomSubmit, customLoading }: Props) {
  const [customText, setCustomText] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  return (
    <div className="panel fade-in p-4">
      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-yellow-400/80">
        {event.category} {event.isKeyEvent ? '· 关键' : ''}
      </p>
      <p className="text-[1.05rem] leading-relaxed text-white/90">{event.narrative}</p>
      <div className="mt-4 flex flex-col gap-2">
        {event.options.map((opt, i) => (
          <ChoiceButton
            key={opt.id}
            index={i}
            text={opt.text}
            hint={mergeEffectsPreview(opt.effects)}
            onClick={() => onChoose(opt.id)}
          />
        ))}

        <button
          type="button"
          className="slide-up w-full rounded-md border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-left text-white/80"
          style={{ animationDelay: `${event.options.length * 60}ms` }}
          onClick={() => setShowCustom((v) => !v)}
          disabled={customLoading}
        >
          <div className="font-medium">其他（自己写）</div>
          <div className="mt-1 text-xs text-white/40">提交后由 AI 上帝裁定奖惩</div>
        </button>

        {showCustom ? (
          <div className="rounded-md border border-white/10 bg-black/25 p-3">
            <textarea
              className="min-h-[88px] w-full resize-y rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30"
              placeholder="写下你会怎么做，例如：假装听教练的，下场偷偷省体力…"
              value={customText}
              maxLength={200}
              disabled={customLoading}
              onChange={(e) => setCustomText(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary mt-2 w-full"
              disabled={customLoading || !customText.trim()}
              onClick={() => onCustomSubmit(customText.trim())}
            >
              {customLoading ? '上帝裁定中…' : '提交给 AI 裁定'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
