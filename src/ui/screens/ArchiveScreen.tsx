import { useMemo } from 'react'
import { loadCareerArchive } from '@/save/SaveManager'
import { useGameStore } from '@/store/gameStore'
import { POSITION_LABELS } from '@/core/AttributeEngine'

export function ArchiveScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const entries = useMemo(() => loadCareerArchive(), [])

  return (
    <div className="fade-in px-4 py-5 pb-28">
      <button type="button" className="text-sm text-white/50" onClick={() => setScreen('home')}>
        ← 返回
      </button>
      <h2 className="font-card mt-3 text-3xl text-white">CAREER LOG</h2>
      <p className="mt-1 text-sm text-white/45">本地生涯档案馆 · 已完成的周目</p>

      {entries.length === 0 ? (
        <p className="mt-8 text-sm text-white/40">还没有完结的生涯。退役后会自动写入这里。</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-xl text-white">{e.playerName}</div>
                  <div className="mt-1 text-xs text-white/45">
                    {POSITION_LABELS[e.position]} · {e.birthCity} · {e.teamName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg text-[#f0d78c]">{e.finalOvr}</div>
                  <div className="text-[10px] text-white/40">OVR</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <Stat label="评级" value={e.grade || '-'} />
                <Stat label="成长分" value={e.growthScore} />
                <Stat label="荣誉" value={e.honors.length} />
              </div>
              <div className="mt-2 text-xs text-white/40">
                {e.appearances} 场 / {e.goals} 球 / {e.assists} 助 · 退役 {e.finalAge} 岁
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-black/25 px-2 py-2">
      <div className="text-white/35">{label}</div>
      <div className="truncate text-white">{value}</div>
    </div>
  )
}
