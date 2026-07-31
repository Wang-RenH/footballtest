import { useMemo } from 'react'
import { useGameStore } from '@/store/gameStore'
import { getTeam } from '@/core/GameFactory'
import { squadWithUser } from '@/core/SquadEngine'
import { POSITION_LABELS } from '@/core/AttributeEngine'
import { FlowHeader } from '@/ui/components/FlowHeader'

export function TeamScreen() {
  const state = useGameStore((s) => s.state)!
  const setScreen = useGameStore((s) => s.setScreen)
  const teamId = state.player.currentTeamId ?? state.season.playerTeamId
  const team = teamId ? getTeam(teamId) : null

  const squad = useMemo(() => {
    if (!team) return []
    return squadWithUser(team, state.season.year, state.player)
  }, [team, state.season.year, state.player])

  if (!team) {
    return (
      <div className="px-4 py-8 pb-28 text-white/50">
        <FlowHeader title="球队" />
        尚未加盟职业俱乐部。成年后将自动挂靠一线队。
        <button type="button" className="btn btn-ghost mt-6 w-full" onClick={() => setScreen('league')}>
          返回联赛
        </button>
      </div>
    )
  }

  return (
    <div className="fade-in px-4 py-5 pb-28">
      <FlowHeader title="球队" />
      <div
        className="mt-2 rounded-lg px-4 py-5"
        style={{
          background: `linear-gradient(135deg, ${team.colors.primary}cc, #0b1018 70%)`,
        }}
      >
        <p className="text-xs tracking-widest text-white/50">{team.city}</p>
        <h2 className="font-display text-3xl text-white">{team.name}</h2>
        <p className="mt-1 text-sm text-white/60">
          实力 {team.strength} · 青训 {team.youthAcademy} · 声誉 {team.reputation}
        </p>
      </div>

      <h3 className="mt-5 text-sm text-white/45">一线队名单（本赛季）</h3>
      <div className="panel mt-2 overflow-hidden">
        <div className="grid grid-cols-[2rem_1fr_3rem_2.5rem] gap-1 border-b border-white/10 px-3 py-2 text-xs text-white/40">
          <span>#</span>
          <span>球员</span>
          <span>位置</span>
          <span className="text-right">OVR</span>
        </div>
        {squad.map((p) => (
          <div
            key={p.id}
            className={`grid grid-cols-[2rem_1fr_3rem_2.5rem] gap-1 px-3 py-2.5 text-sm ${
              'isUser' in p && p.isUser ? 'bg-[#d4af37]/10 text-[#f5e6b8]' : 'text-white/80'
            }`}
          >
            <span className="text-white/40">{p.jerseyNumber}</span>
            <span className="truncate">
              {p.name}
              {'isUser' in p && p.isUser ? (
                <span className="ml-1 text-[10px] text-yellow-200/70">你</span>
              ) : null}
            </span>
            <span className="text-xs text-white/45">{POSITION_LABELS[p.position]}</span>
            <span className="text-right font-semibold">{p.ovr}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
