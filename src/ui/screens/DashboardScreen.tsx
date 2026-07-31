import { useGameStore } from '@/store/gameStore'
import { PlayerCard } from '@/ui/components/PlayerCard'
import { formatGameDate, stageLabel } from '@/core/TimeEngine'
import { getLifeStage } from '@/core/AttributeEngine'
import { getTeam } from '@/core/GameFactory'
import { avgSeasonRating, contractSummary, getTransferWindow } from '@/core/FinanceEngine'

export function DashboardScreen() {
  const state = useGameStore((s) => s.state)!
  const setScreen = useGameStore((s) => s.setScreen)
  const flash = useGameStore((s) => s.flash)
  const eventLoading = useGameStore((s) => s.eventLoading)
  const awaitingAiRetry = useGameStore((s) => s.awaitingAiRetry)
  const aiError = useGameStore((s) => s.aiError)
  const cancelEventLoading = useGameStore((s) => s.cancelEventLoading)
  const retryAiEventBatch = useGameStore((s) => s.retryAiEventBatch)
  const regenerateCurrentWeekEvent = useGameStore((s) => s.regenerateCurrentWeekEvent)
  const regeneratingEvent = useGameStore((s) => s.regeneratingEvent)
  const resumeStuckWeek = useGameStore((s) => s.resumeStuckWeek)
  const retireNow = useGameStore((s) => s.retireNow)
  const { player, time, week } = state
  const team = player.currentTeamId ? getTeam(player.currentTeamId) : null
  const queueLeft = state.eventQueue?.length ?? 0
  const waitingForAi = eventLoading || awaitingAiRetry
  const seasonStats = player.seasonStats ?? {
    apps: 0,
    goals: 0,
    assists: 0,
    dribbles: 0,
    ratingSum: 0,
  }
  const bulletin = state.bulletin ?? []
  const tw = getTransferWindow(time)
  const intl = state.season.international

  return (
    <div className="fade-in px-4 py-5 pb-28">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs tracking-widest text-white/40">{formatGameDate(time)}</p>
          <p className="text-sm text-yellow-200/80">
            {stageLabel(getLifeStage(player.age))}
            {team ? ` · ${team.name}` : ''}
            {tw ? ` · ${tw === 'winter' ? '冬窗' : '夏窗'}` : ''}
          </p>
        </div>
        <div className="text-right text-xs text-white/45">
          <div>资金 ¥{player.funds.toLocaleString()}</div>
          <div>
            心情 {player.morale} · 疲劳 {player.fatigue}
          </div>
          {player.contract ? (
            <div className="mt-0.5 text-white/35">
              周薪 ¥{player.contract.weeklyWage.toLocaleString()}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-[280px]">
        <PlayerCard player={player} />
      </div>

      {bulletin.length > 0 ? (
        <div className="panel mt-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <h3 className="font-display text-lg text-white">绿茵日报</h3>
            <span className="text-[10px] text-white/35">大事件刊报</span>
          </div>
          <ul className="max-h-48 space-y-0 overflow-y-auto">
            {bulletin.slice(0, 6).map((b) => (
              <li key={b.id} className="border-b border-white/5 px-3 py-2.5 last:border-0">
                <p className="text-[10px] tracking-wider text-white/35">
                  {b.dateLabel} · {b.category}
                </p>
                <p className="text-sm text-[#f0d78c]">{b.headline}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/55">{b.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {intl?.lastAnnouncement && player.age >= 18 ? (
        <button
          type="button"
          className="mt-3 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/70"
          onClick={() => setScreen('league')}
        >
          国字号：{intl.stageLabel}
          {intl.calledUp ? ' · 已入选大名单' : ''}
          <span className="mt-0.5 block text-xs text-white/40">去联赛页查看集训名单 →</span>
        </button>
      ) : null}

      {player.injury ? (
        <div className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          伤病：{player.injury.name}（约 {player.injury.weeksLeft} 周）
        </div>
      ) : null}

      {flash ? (
        <div className="slide-up mt-3 rounded-md border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-100">
          {flash}
        </div>
      ) : null}

      {player.contract ? (
        <p className="mt-3 text-xs text-white/40">{contractSummary(player.contract)}</p>
      ) : null}

      <div className="panel mt-5 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl text-white">
            {week.step === 'event' && week.eventRole === 'prematch'
              ? '赛前抉择'
              : week.step === 'event' && week.eventRole === 'postmatch'
                ? '赛后复盘'
                : week.step === 'training'
                  ? '本周训练'
                  : week.step === 'match'
                    ? '比赛日'
                    : '本周事件'}
          </h3>
          <span className="text-[10px] tracking-wider text-white/35">
            {eventLoading
              ? '编排中'
              : awaitingAiRetry
                ? '待重试'
                : week.eventSource === 'ai'
                  ? `AI 上帝${queueLeft ? ` · 余${queueLeft}` : ''}`
                  : week.eventSource === 'generic'
                    ? '日常'
                    : '本地'}
          </span>
        </div>
        {waitingForAi && !week.currentEvent ? (
          <>
            <p className="mt-2 text-sm text-white/65">
              {awaitingAiRetry
                ? `生成中断：${aiError || '请求失败/超时'}。可刷新重试接上进度，或改用本地事件。`
                : player.age < 18
                  ? '正在编排下一章节剧情（单条约 1 分钟内）…可先去「联赛 / 生涯」逛逛。'
                  : '正在逐周生成月度剧情（约 4 次请求，可能需 1～3 分钟）…可先逛别处，失败可刷新重试。'}
            </p>
            {eventLoading ? (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-[#f0d78c]/70" />
              </div>
            ) : null}
            <div className="mt-4 flex flex-col gap-2">
              {awaitingAiRetry ? (
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  onClick={() => retryAiEventBatch()}
                >
                  刷新重试 AI
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => cancelEventLoading()}
              >
                取消并改用本地事件
              </button>
            </div>
          </>
        ) : week.step === 'event' && week.currentEvent ? (
          <>
            <p className="mt-2 line-clamp-3 text-sm text-white/65">{week.currentEvent.narrative}</p>
            <button
              type="button"
              className="btn btn-primary mt-4 w-full"
              disabled={regeneratingEvent}
              onClick={() => setScreen('event')}
            >
              阅读并选择
            </button>
            {week.eventRole !== 'postmatch' ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost mt-2 w-full"
                  disabled={regeneratingEvent || eventLoading || awaitingAiRetry}
                  onClick={() => void regenerateCurrentWeekEvent()}
                >
                  {regeneratingEvent ? 'AI 重新生成中…' : 'AI 重新生成本周事件'}
                </button>
                <p className="mt-1 text-[11px] text-white/35">仅本周开始、尚未抉择时可刷新剧情</p>
              </>
            ) : null}
          </>
        ) : week.step === 'training' ? (
          <>
            <p className="mt-2 text-sm text-white/65">
              {week.eventRole === 'postmatch'
                ? '赛后复盘已完成，按本场表现安排训练。'
                : '事件已处理，请安排本周训练。'}
            </p>
            <button
              type="button"
              className="btn btn-primary mt-4 w-full"
              onClick={() => setScreen('training')}
            >
              去训练
            </button>
          </>
        ) : week.step === 'match' ? (
          <>
            <p className="mt-2 text-sm text-white/65">比赛已结束，查看赛果后进入赛后复盘。</p>
            <button
              type="button"
              className="btn btn-primary mt-4 w-full"
              onClick={() => setScreen('match')}
            >
              查看比赛
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-white/65">
              本周流程已结束，但还没有新事件（常见于生成中断或刷新页面）。点下方继续即可。
            </p>
            <button
              type="button"
              className="btn btn-primary mt-4 w-full"
              disabled={eventLoading || regeneratingEvent}
              onClick={() => resumeStuckWeek()}
            >
              生成本周事件 / 继续
            </button>
            <button
              type="button"
              className="btn btn-ghost mt-2 w-full"
              disabled={eventLoading}
              onClick={() => cancelEventLoading()}
            >
              用本地事件继续
            </button>
          </>
        )}
      </div>

      <p className="mt-5 text-xs text-white/40">本赛季（与射手榜同步）</p>
      <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
        <Stat label="出场" value={seasonStats.apps} />
        <Stat label="进球" value={seasonStats.goals} />
        <Stat label="助攻" value={seasonStats.assists} />
        <Stat label="场均评分" value={avgSeasonRating(seasonStats) || '-'} />
      </div>
      <p className="mt-3 text-xs text-white/40">生涯累计</p>
      <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
        <Stat label="出场" value={player.careerStats.appearances} />
        <Stat label="进球" value={player.careerStats.goals} />
        <Stat label="助攻" value={player.careerStats.assists} />
        <Stat label="场均评分" value={player.careerStats.avgRating || '-'} />
      </div>

      {player.age >= 34 ? (
        <button type="button" className="btn btn-danger mt-6 w-full" onClick={() => retireNow()}>
          宣布退役
        </button>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-white/5 px-3 py-2">
      <div className="text-xs text-white/40">{label}</div>
      <div className="text-lg text-white">{value}</div>
    </div>
  )
}
