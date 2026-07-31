import { useGameStore } from '@/store/gameStore'
import { BottomNav } from '@/ui/components/BottomNav'
import { TrainingResultModal } from '@/ui/components/TrainingResultModal'
import { HomeScreen } from '@/ui/screens/HomeScreen'
import { CreatePlayerScreen } from '@/ui/screens/CreatePlayerScreen'
import { DashboardScreen } from '@/ui/screens/DashboardScreen'
import { EventScreen } from '@/ui/screens/EventScreen'
import { TrainingScreen } from '@/ui/screens/TrainingScreen'
import { MatchScreen } from '@/ui/screens/MatchScreen'
import { LeagueScreen } from '@/ui/screens/LeagueScreen'
import { TeamScreen } from '@/ui/screens/TeamScreen'
import { CareerScreen } from '@/ui/screens/CareerScreen'
import { HonorsScreen } from '@/ui/screens/HonorsScreen'
import { ArchiveScreen } from '@/ui/screens/ArchiveScreen'
import { RetirementScreen } from '@/ui/screens/RetirementScreen'
import { SettingsScreen } from '@/ui/screens/SettingsScreen'

export default function App() {
  const screen = useGameStore((s) => s.screen)
  const state = useGameStore((s) => s.state)
  const eventReadyToast = useGameStore((s) => s.eventReadyToast)
  const dismissEventReadyToast = useGameStore((s) => s.dismissEventReadyToast)
  const choiceVerdict = useGameStore((s) => s.choiceVerdict)
  const dismissChoiceVerdict = useGameStore((s) => s.dismissChoiceVerdict)
  const setScreen = useGameStore((s) => s.setScreen)
  const weekStep = state?.week.step

  const needsState =
    screen === 'dashboard' ||
    screen === 'event' ||
    screen === 'training' ||
    screen === 'match' ||
    screen === 'league' ||
    screen === 'team' ||
    screen === 'career' ||
    screen === 'honors' ||
    screen === 'retirement'

  if (needsState && !state) {
    return (
      <div className="app-shell">
        <HomeScreen />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <main className="flex-1">
        {screen === 'home' && <HomeScreen />}
        {screen === 'create' && <CreatePlayerScreen />}
        {screen === 'dashboard' && <DashboardScreen />}
        {screen === 'event' && <EventScreen />}
        {screen === 'training' && <TrainingScreen />}
        {screen === 'match' && <MatchScreen />}
        {screen === 'league' && <LeagueScreen />}
        {screen === 'team' && <TeamScreen />}
        {screen === 'career' && <CareerScreen />}
        {screen === 'honors' && <HonorsScreen />}
        {screen === 'archive' && <ArchiveScreen />}
        {screen === 'retirement' && <RetirementScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </main>
      <BottomNav />
      <TrainingResultModal />
      {choiceVerdict ? (
        <div className="modal-backdrop" style={{ zIndex: 65 }}>
          <div className="modal-panel text-center">
            <p className="modal-kicker">GAME GOD</p>
            <h3 className="font-display text-xl text-[var(--ink)]">裁定结果</h3>
            <p className="mt-3 text-sm leading-relaxed text-black/70">{choiceVerdict.verdict}</p>
            <p className="mt-3 rounded-md bg-black/5 px-3 py-2 text-left text-sm text-black/75">
              {choiceVerdict.consequence}
            </p>
            {choiceVerdict.preview ? (
              <p className="mt-2 text-xs text-black/45">可见影响：{choiceVerdict.preview}</p>
            ) : null}
            <button
              type="button"
              className="btn btn-primary mt-6 w-full"
              onClick={() => dismissChoiceVerdict()}
            >
              {weekStep === 'match' ? '查看比赛' : '继续去训练'}
            </button>
          </div>
        </div>
      ) : null}
      {eventReadyToast ? (
        <div className="modal-backdrop" style={{ zIndex: 60 }}>
          <div className="modal-panel text-center">
            <p className="modal-kicker">GAME GOD</p>
            <h3 className="font-display text-xl text-[var(--ink)]">{eventReadyToast}</h3>
            <p className="mt-2 text-sm text-black/55">回本周主界面即可阅读并选择。</p>
            <button
              type="button"
              className="btn btn-primary mt-6 w-full"
              onClick={() => {
                dismissEventReadyToast()
                setScreen('dashboard')
              }}
            >
              去看本周事件
            </button>
            <button
              type="button"
              className="btn btn-ghost mt-2 w-full !text-[var(--ink)] !border-black/15"
              onClick={() => dismissEventReadyToast()}
            >
              稍后再说
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
