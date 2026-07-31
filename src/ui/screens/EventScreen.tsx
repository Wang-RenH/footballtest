import { useGameStore } from '@/store/gameStore'
import { EventDialog } from '@/ui/components/EventDialog'
import { FlowHeader } from '@/ui/components/FlowHeader'

export function EventScreen() {
  const state = useGameStore((s) => s.state)!
  const chooseEventOption = useGameStore((s) => s.chooseEventOption)
  const submitCustomChoice = useGameStore((s) => s.submitCustomChoice)
  const customAdjudicating = useGameStore((s) => s.customAdjudicating)
  const regeneratingEvent = useGameStore((s) => s.regeneratingEvent)
  const regenerateCurrentWeekEvent = useGameStore((s) => s.regenerateCurrentWeekEvent)
  const event = state.week.currentEvent
  const role = state.week.eventRole
  const title =
    role === 'prematch' ? '赛前抉择' : role === 'postmatch' ? '赛后复盘' : '本周抉择'
  const canRegen =
    state.week.step === 'event' &&
    Boolean(event) &&
    !state.week.eventDone &&
    role !== 'postmatch' &&
    !regeneratingEvent

  if (!event) {
    return (
      <div className="px-4 py-8 pb-28 text-white/60">
        <FlowHeader title={title} />
        暂无事件
      </div>
    )
  }

  return (
    <div className="px-4 py-5 pb-28">
      <FlowHeader title={title} />
      {canRegen ? (
        <button
          type="button"
          className="btn btn-ghost mb-3 w-full"
          disabled={customAdjudicating || regeneratingEvent}
          onClick={() => void regenerateCurrentWeekEvent()}
        >
          {regeneratingEvent ? 'AI 重新生成中…' : 'AI 重新生成本周事件'}
        </button>
      ) : null}
      <EventDialog
        event={event}
        customLoading={customAdjudicating || regeneratingEvent}
        onChoose={(id) => {
          const opt = event.options.find((o) => o.id === id)
          if (opt) chooseEventOption(opt)
        }}
        onCustomSubmit={(text) => {
          void submitCustomChoice(text)
        }}
      />
    </div>
  )
}
