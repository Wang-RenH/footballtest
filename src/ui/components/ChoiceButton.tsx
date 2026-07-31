interface Props {
  text: string
  hint?: string
  onClick: () => void
  index?: number
}

export function ChoiceButton({ text, hint, onClick, index = 0 }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="slide-up w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-yellow-400/40 hover:bg-white/10"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="font-medium text-white">{text}</div>
      {hint ? <div className="mt-1 text-xs text-white/40">{hint}</div> : null}
    </button>
  )
}
