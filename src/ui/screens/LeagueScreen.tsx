import { useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import {
  getPlayerFixture,
  LEAGUE_LABELS,
  leagueTotalRounds,
  sortedStandings,
  teamName,
} from '@/core/LeagueEngine'
import { sortBoard } from '@/core/MatchEngine'
import { getEffectiveCompetition } from '@/core/TimeEngine'

type Tab = 'table' | 'boards' | 'fixtures' | 'cup' | 'intl' | 'history'

export function LeagueScreen() {
  const state = useGameStore((s) => s.state)!
  const setScreen = useGameStore((s) => s.setScreen)
  const openMatchFromLog = useGameStore((s) => s.openMatchFromLog)
  const [tab, setTab] = useState<Tab>('table')
  const [boardKey, setBoardKey] = useState<'goals' | 'assists' | 'dribbles'>('goals')
  const [boardScope, setBoardScope] = useState<'league' | 'cup'>('league')
  const history = state.season.seasonHistory
  const [histIdx, setHistIdx] = useState(0)

  const view = useMemo(() => {
    if (tab === 'history' && history.length) {
      const snap = history[Math.min(histIdx, history.length - 1)]!
      return {
        year: snap.year,
        rows: sortedStandings(snap.standings),
        label: `${snap.year} ${LEAGUE_LABELS[snap.leagueId]}`,
      }
    }
    return {
      year: state.season.year,
      rows: sortedStandings(state.season.standings),
      label: `${state.season.year} ${LEAGUE_LABELS[state.season.leagueId]}`,
    }
  }, [tab, histIdx, history, state.season])

  const myId = state.player.currentTeamId
  const board = sortBoard(
    boardScope === 'cup' ? state.season.cupBoard ?? [] : state.season.leagueBoard ?? [],
    boardKey,
  ).slice(0, 20)

  const upcoming = useMemo(() => {
    if (!myId || state.player.age < 18) return [] as string[]
    const total = leagueTotalRounds(state.season.leagueId)
    const lines: string[] = []
    for (let r = state.season.round; r < Math.min(state.season.round + 5, total); r++) {
      const fix = getPlayerFixture(state.season.leagueId, myId, r, state.season.year)
      if (!fix) {
        lines.push(`第 ${r + 1} 轮 · 轮空`)
        continue
      }
      lines.push(
        `第 ${fix.roundIndex + 1} 轮 · ${fix.isHome ? '主' : '客'} vs ${teamName(fix.opponentId)}`,
      )
    }
    return lines
  }, [myId, state.player.age, state.season])

  const matchLog = state.season.matchLog ?? []
  const intl = state.season.international
  const weekComp = getEffectiveCompetition(
    state.time,
    state.player.age,
    state.season.leagueId,
    state.season.cupEliminated,
  )

  return (
    <div className="fade-in px-4 py-5 pb-28">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="font-card text-3xl tracking-wide text-white">COMPETITIONS</h2>
          <p className="mt-1 text-sm text-white/45">积分 · 榜单 · 赛程 · 杯赛 · 国字号</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded bg-white/10 px-3 py-1.5 text-xs text-white/70"
          onClick={() => setScreen('team')}
        >
          我的球队
        </button>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ['table', '积分'],
            ['boards', '榜单'],
            ['fixtures', '赛程'],
            ['cup', '杯赛'],
            ['intl', '国字号'],
            ['history', '历史'],
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

      {tab === 'cup' ? (
        <div className="panel mt-4 p-4">
          <h3 className="text-white">足协杯 / 国内杯赛</h3>
          <p className="mt-2 text-sm text-white/60">
            当前轮次：第 {state.season.cupRound} 轮
            {state.season.cupEliminated ? ' · 已淘汰' : ' · 仍在争夺'}
          </p>
          <p className="mt-2 text-xs text-white/40">
            本周竞赛类型：{weekComp === 'cup' ? '杯赛周' : weekComp === 'league' ? '联赛周' : '轮空/休赛'}
          </p>
          <p className="mt-3 text-xs text-white/40">
            杯赛射手榜见「榜单」页切换范围。亚冠/欧冠淘汰赛树后续接入。
          </p>
        </div>
      ) : null}

      {tab === 'intl' ? (
        <div className="panel mt-4 p-4 space-y-3">
          <h3 className="text-white">{intl?.nationName ?? '中国队'}</h3>
          <p className="text-sm text-white/65">
            阶段：{intl?.stageLabel ?? '暂无窗口'} · 国脚出场 {intl?.caps ?? 0} · 国家队进球{' '}
            {intl?.goals ?? 0}
          </p>
          <p className="text-sm text-white/50">{intl?.nextWindowLabel}</p>
          {intl?.lastAnnouncement ? (
            <p className="rounded bg-yellow-400/10 px-3 py-2 text-sm text-yellow-100">
              {intl.lastAnnouncement}
            </p>
          ) : null}
          {(intl?.provisionalSquad?.length ?? 0) > 0 ? (
            <div>
              <p className="text-xs text-white/40">
                {intl?.campStatus === 'missed' ? '本期集训名单（你未入选）' : '本期集训大名单'}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {intl!.provisionalSquad.map((n) => (
                  <span
                    key={n}
                    className={`rounded px-2 py-1 text-xs ${
                      n === state.player.name
                        ? 'bg-[#d4af37]/25 text-[#f0d78c]'
                        : 'bg-white/5 text-white/65'
                    }`}
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-white/40">名单通常在 3/6/9/11 月第 1 周公布。</p>
          )}
          {intl?.calledUp ? (
            <div className="rounded bg-white/5 p-3 text-sm text-white/70">
              <p>报到：{intl.campReportLabel ?? '—'}</p>
              <p className="mt-1">归队：{intl.campReturnLabel ?? '—'}</p>
              {(intl.fixtures?.length ?? 0) > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-white/55">
                  {intl.fixtures.map((f) => (
                    <li key={`${f.dateLabel}-${f.opponent}`}>
                      {f.dateLabel} · {f.competition} · {f.venue} vs {f.opponent}
                      {f.status === 'played' && f.result ? ` · ${f.result}` : ' · 待赛'}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="rounded bg-white/5 p-3 text-xs leading-relaxed text-white/55">
            <p>真实路径继续加深中：完整预选赛积分榜与出线线后续接入。</p>
          </div>
        </div>
      ) : null}

      {tab === 'boards' ? (
        <div className="mt-4">
          <div className="flex gap-2">
            {(
              [
                ['league', '联赛'],
                ['cup', '杯赛'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded px-3 py-1 text-xs ${
                  boardScope === id ? 'bg-white/15 text-white' : 'text-white/40'
                }`}
                onClick={() => setBoardScope(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            {(
              [
                ['goals', '射手'],
                ['assists', '助攻'],
                ['dribbles', '过人'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded px-3 py-1.5 text-sm ${
                  boardKey === id ? 'bg-[#d4af37]/20 text-[#f0d78c]' : 'bg-white/5 text-white/45'
                }`}
                onClick={() => setBoardKey(id)}
              >
                {label}榜
              </button>
            ))}
          </div>
          <div className="panel mt-3 overflow-hidden">
            <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-1 border-b border-white/10 px-3 py-2 text-xs text-white/40">
              <span>#</span>
              <span>球员</span>
              <span>球队</span>
              <span className="text-right">
                {boardKey === 'goals' ? '球' : boardKey === 'assists' ? '助' : '过'}
              </span>
            </div>
            {board.length === 0 ? (
              <p className="px-3 py-6 text-sm text-white/45">尚无数据，踢完比赛后会累计。</p>
            ) : (
              board.map((r, i) => (
                <div
                  key={r.playerId}
                  className={`grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-1 px-3 py-2.5 text-sm ${
                    r.playerId === state.player.id
                      ? 'bg-[#d4af37]/10 text-[#f5e6b8]'
                      : 'text-white/80'
                  }`}
                >
                  <span className="text-white/40">{i + 1}</span>
                  <span className="truncate">{r.name}</span>
                  <span className="truncate text-white/45">{teamName(r.teamId)}</span>
                  <span className="text-right font-semibold">{r[boardKey]}</span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === 'fixtures' ? (
        <div className="mt-4 space-y-4">
          <div className="panel p-4">
            <h3 className="text-white">未来对阵</h3>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-sm text-white/45">少年期或无俱乐部时不显示联赛赛程。</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm text-white/70">
                {upcoming.map((line) => (
                  <li key={line} className="rounded bg-white/5 px-3 py-2">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="text-sm text-white/45">已踢赛果（点开复盘）</h3>
            <div className="mt-2 space-y-2">
              {matchLog.length === 0 ? (
                <p className="text-sm text-white/45">还没有赛果记录。</p>
              ) : (
                matchLog.slice(0, 24).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md bg-white/5 px-3 py-2.5 text-left text-sm text-white/80 hover:bg-white/10"
                    onClick={() => openMatchFromLog(m.id)}
                  >
                    <span className="truncate">
                      {teamName(m.homeTeamId)} {m.homeGoals}-{m.awayGoals} {teamName(m.awayTeamId)}
                    </span>
                    <span className="ml-2 shrink-0 text-xs text-white/40">
                      {m.roundLabel ?? m.competition}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'table' || tab === 'history' ? (
        <>
          {tab === 'history' && history.length > 0 ? (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto">
              {history.map((h, i) => (
                <button
                  key={h.year}
                  type="button"
                  className={`shrink-0 rounded px-2 py-1 text-xs ${
                    histIdx === i ? 'bg-white/15 text-white' : 'text-white/40'
                  }`}
                  onClick={() => setHistIdx(i)}
                >
                  {h.year}
                </button>
              ))}
            </div>
          ) : null}
          {tab === 'history' && history.length === 0 ? (
            <p className="mt-6 text-sm text-white/45">尚无完结赛季，踢完整赛季后会归档到这里。</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-[#f0d78c]/80">{view.label}</p>
              <div className="panel mt-2 overflow-hidden">
                <div className="grid grid-cols-[2rem_1fr_2rem_2rem_2rem] gap-1 border-b border-white/10 px-3 py-2 text-xs text-white/40">
                  <span>#</span>
                  <span>球队</span>
                  <span className="text-center">赛</span>
                  <span className="text-center">净</span>
                  <span className="text-center">分</span>
                </div>
                {view.rows.map((r, i) => {
                  const mine = r.teamId === myId
                  const gd = r.goalsFor - r.goalsAgainst
                  return (
                    <div
                      key={r.teamId}
                      className={`grid grid-cols-[2rem_1fr_2rem_2rem_2rem] gap-1 px-3 py-2.5 text-sm ${
                        mine ? 'bg-[#d4af37]/10 text-[#f5e6b8]' : 'text-white/80'
                      }`}
                    >
                      <span className="text-white/40">{i + 1}</span>
                      <span className="truncate">{teamName(r.teamId)}</span>
                      <span className="text-center">{r.played}</span>
                      <span className="text-center">{gd > 0 ? `+${gd}` : gd}</span>
                      <span className="text-center font-semibold">{r.points}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
