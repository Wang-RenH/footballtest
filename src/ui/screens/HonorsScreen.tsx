import { useGameStore } from '@/store/gameStore'
import { FlowHeader } from '@/ui/components/FlowHeader'

export function HonorsScreen() {
  const player = useGameStore((s) => s.state!.player)
  const personal = player.honors.filter((h) => h.type === 'personal')
  const team = player.honors.filter((h) => h.type === 'team')

  return (
    <div className="fade-in px-4 py-5 pb-28">
      <FlowHeader title="荣誉殿堂" />
      <h2 className="font-card text-3xl text-white">HONOUR ROOM</h2>
      <p className="mt-1 text-sm text-white/45">个人荣誉 · 团队荣誉</p>

      <Section title="团队荣誉" items={team} empty="还没有团队奖杯，去赢下联赛或杯赛吧。" />
      <Section title="个人荣誉" items={personal} empty="金靴、最佳阵容等会在赛季末揭晓。" />

      {player.careerStats.trophies.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-sm tracking-widest text-white/40">奖杯墙</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {player.careerStats.trophies.map((t) => (
              <span
                key={t}
                className="rounded border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-1 text-xs text-[#f0d78c]"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Section({
  title,
  items,
  empty,
}: {
  title: string
  items: { id: string; name: string; seasonYear: number; description: string }[]
  empty: string
}) {
  return (
    <div className="mt-6">
      <h3 className="text-sm tracking-widest text-white/40">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-white/40">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((h) => (
            <li key={h.id} className="panel px-3 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-[#f0d78c]">{h.name}</span>
                <span className="text-xs text-white/40">{h.seasonYear}</span>
              </div>
              <p className="mt-1 text-sm text-white/60">{h.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
