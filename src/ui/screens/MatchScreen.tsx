import { useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { teamName, teamShort } from '@/core/LeagueEngine'
import { FlowHeader } from '@/ui/components/FlowHeader'

type Tab = 'overview' | 'events' | 'ratings' | 'media'

export function MatchScreen() {
  const live = useGameStore((s) => s.state!.week.lastMatch)
  const browsingId = useGameStore((s) => s.browsingMatchId)
  const matchLog = useGameStore((s) => s.state!.season.matchLog ?? [])
  const weekStep = useGameStore((s) => s.state!.week.step)
  const acknowledgeMatch = useGameStore((s) => s.acknowledgeMatch)
  const clearBrowsingMatch = useGameStore((s) => s.clearBrowsingMatch)
  const setScreen = useGameStore((s) => s.setScreen)
  const [tab, setTab] = useState<Tab>('overview')

  const match = useMemo(() => {
    if (browsingId) return matchLog.find((m) => m.id === browsingId) ?? live
    return live
  }, [browsingId, matchLog, live])

  const isLiveWeek = weekStep === 'match' && live != null && match?.id === live.id

  if (!match) {
    return (
      <div className="px-4 py-8 pb-28 text-white/50">
        <FlowHeader title="比赛日" />
        暂无比赛数据
      </div>
    )
  }

  const events = match.events ?? []
  const ratings = match.lineupRatings ?? []
  const media = match.mediaComments ?? []
  const appearance =
    match.playerMinutes <= 0
      ? '未出场'
      : match.playerStarted
        ? match.playerSubOffMinute != null
          ? `首发 · ${match.playerSubOffMinute}'换下 · ${match.playerMinutes}'`
          : `首发打满 ${match.playerMinutes}'`
        : `${match.playerSubOnMinute ?? '?'}' 替补登场 · ${match.playerMinutes}'`

  return (
    <div className="fade-in px-4 py-6 pb-28">
      <FlowHeader title="比赛详情" />
      <p className="text-xs tracking-widest text-yellow-400/70">
        {match.roundLabel ?? match.competition.toUpperCase()}
      </p>
      <h2 className="font-display mt-1 text-3xl text-white">赛果复盘</h2>

      <div className="panel slide-up mt-5 p-5 text-center">
        <div className="flex items-center justify-center gap-4">
          <div className="flex-1 text-right">
            <div className="text-sm text-white/50">{teamShort(match.homeTeamId)}</div>
            <div className="font-display text-xl text-white">{teamName(match.homeTeamId)}</div>
          </div>
          <div className="font-display text-4xl text-yellow-300">
            {match.homeGoals} - {match.awayGoals}
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm text-white/50">{teamShort(match.awayTeamId)}</div>
            <div className="font-display text-xl text-white">{teamName(match.awayTeamId)}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2 text-sm">
          <Stat label="评分" value={match.playerRating || '-'} />
          <Stat label="进球" value={match.playerGoals} />
          <Stat label="助攻" value={match.playerAssists} />
          <Stat label="出场" value={match.playerMinutes} />
        </div>
        <p className="mt-3 text-xs text-white/45">{appearance}</p>
        {match.motmName ? (
          <p className="mt-1 text-xs text-yellow-200/70">本场最佳：{match.motmName}</p>
        ) : null}
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto">
        {(
          [
            ['overview', '概览'],
            ['events', '事件'],
            ['ratings', '评分'],
            ['media', '舆论'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`shrink-0 rounded px-3 py-1.5 text-sm ${
              tab === id ? 'bg-[#d4af37]/20 text-[#f0d78c]' : 'bg-white/5 text-white/45'
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <ul className="mt-4 space-y-2">
          {match.highlights.map((h, i) => (
            <li
              key={i}
              className="slide-up rounded-md bg-white/5 px-3 py-2 text-sm text-white/75"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {h}
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'events' ? (
        <div className="mt-4 space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-white/45">暂无详细时间轴（旧存档）。</p>
          ) : (
            events.map((e, i) => (
              <div
                key={`${e.minute}-${e.type}-${i}`}
                className={`flex gap-3 rounded-md px-3 py-2 text-sm ${
                  e.isPlayer ? 'bg-yellow-400/10 text-yellow-100' : 'bg-white/5 text-white/70'
                }`}
              >
                <span className="w-10 shrink-0 tabular-nums text-white/40">{e.minute}'</span>
                <span>{e.text}</span>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === 'ratings' ? (
        <div className="panel mt-4 overflow-hidden">
          <div className="grid grid-cols-[1fr_2.5rem_2rem_2rem_2.5rem] gap-1 border-b border-white/10 px-3 py-2 text-xs text-white/40">
            <span>球员</span>
            <span className="text-center">分</span>
            <span className="text-center">球</span>
            <span className="text-center">助</span>
            <span className="text-center">评</span>
          </div>
          {ratings.length === 0 ? (
            <p className="px-3 py-4 text-sm text-white/45">暂无评分板。</p>
          ) : (
            ratings.slice(0, 22).map((r) => (
              <div
                key={r.playerId}
                className={`grid grid-cols-[1fr_2.5rem_2rem_2rem_2.5rem] gap-1 px-3 py-2 text-sm ${
                  r.isUser ? 'bg-[#d4af37]/10 text-[#f5e6b8]' : 'text-white/75'
                }`}
              >
                <span className="truncate">
                  {r.name}
                  <span className="ml-1 text-[10px] text-white/35">{r.position}</span>
                </span>
                <span className="text-center tabular-nums">{r.minutes}</span>
                <span className="text-center">{r.goals}</span>
                <span className="text-center">{r.assists}</span>
                <span className="text-center font-semibold text-yellow-200">{r.rating}</span>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === 'media' ? (
        <ul className="mt-4 space-y-2">
          {media.length === 0 ? (
            <p className="text-sm text-white/45">暂无媒体评价。</p>
          ) : (
            media.map((c, i) => (
              <li key={i} className="rounded-md bg-white/5 px-3 py-2 text-sm leading-relaxed text-white/70">
                {c}
              </li>
            ))
          )}
        </ul>
      ) : null}

      {isLiveWeek ? (
        <button type="button" className="btn btn-primary mt-8 w-full" onClick={() => acknowledgeMatch()}>
          进入赛后复盘
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-ghost mt-8 w-full"
          onClick={() => {
            clearBrowsingMatch()
            setScreen('league')
          }}
        >
          返回联赛 / 赛程
        </button>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-black/25 py-2">
      <div className="text-white/40">{label}</div>
      <div className="text-xl text-yellow-200">{value}</div>
    </div>
  )
}
