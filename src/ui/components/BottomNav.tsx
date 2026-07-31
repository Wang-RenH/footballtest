import { useGameStore } from '@/store/gameStore'
import type { ScreenId } from '@/models/types'

const TABS = [
  { id: 'dashboard', label: '本周' },
  { id: 'league', label: '联赛' },
  { id: 'career', label: '生涯' },
  { id: 'settings', label: '更多' },
] as const

const WEEK_FLOW: ScreenId[] = ['dashboard', 'event', 'training', 'match']
const CAREER_FLOW: ScreenId[] = ['career', 'honors']
const LEAGUE_FLOW: ScreenId[] = ['league', 'team', 'fixtures']

export function BottomNav() {
  const screen = useGameStore((s) => s.screen)
  const setScreen = useGameStore((s) => s.setScreen)
  const state = useGameStore((s) => s.state)

  if (!state || state.retired) return null
  if (screen === 'create' || screen === 'home' || screen === 'archive') return null

  return (
    <nav className="sticky bottom-0 z-20 border-t border-white/10 bg-[#0b1018]/95 backdrop-blur">
      <div className="mx-auto grid max-w-[720px] grid-cols-4">
        {TABS.map((t) => {
          const active =
            t.id === 'dashboard'
              ? WEEK_FLOW.includes(screen)
              : t.id === 'career'
                ? CAREER_FLOW.includes(screen)
                : t.id === 'league'
                  ? LEAGUE_FLOW.includes(screen)
                  : screen === t.id
          return (
            <button
              key={t.id}
              type="button"
              className={`py-3 text-sm ${active ? 'text-[#f0d78c]' : 'text-white/45'}`}
              onClick={() => setScreen(t.id)}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
