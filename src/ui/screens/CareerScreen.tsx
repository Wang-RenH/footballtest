import { useGameStore } from '@/store/gameStore'
import { AttributeRadar } from '@/ui/components/AttributeRadar'
import { PlayerCard } from '@/ui/components/PlayerCard'
import { getTeam } from '@/core/GameFactory'

export function CareerScreen() {
  const player = useGameStore((s) => s.state!.player)
  const history = useGameStore((s) => s.state!.history)
  const acceptTransfer = useGameStore((s) => s.acceptTransfer)
  const setScreen = useGameStore((s) => s.setScreen)

  const offers = history
    .filter((h) => h.includes('【转会邀约】') && h.includes('ID:'))
    .map((h) => {
      const id = h.split('ID:')[1]?.trim()
      return id
    })
    .filter(Boolean) as string[]
  const latestOffer = offers[offers.length - 1]
  const offerClub = latestOffer ? getTeam(latestOffer) : null
  const alreadyThere = offerClub && player.currentTeamId === offerClub.id

  return (
    <div className="fade-in px-4 py-5 pb-28">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-card text-3xl text-white">SCOUT REPORT</h2>
        <button
          type="button"
          className="text-sm text-[#f0d78c]"
          onClick={() => setScreen('honors')}
        >
          荣誉殿堂 →
        </button>
      </div>
      <div className="mx-auto max-w-[280px]">
        <PlayerCard player={player} />
      </div>
      <div className="mt-4">
        <AttributeRadar attrs={player.attributes} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Info label="潜力" value={player.potential} />
        <Info label="兴趣" value={player.interest} />
        <Info label="身高/体重" value={`${player.heightCm}cm / ${player.weightKg}kg`} />
        <Info label="成年预估" value={`${player.adultHeightCm}cm / ${player.adultWeightKg}kg`} />
        <Info
          label="出场/进球/助攻"
          value={`${player.careerStats.appearances}/${player.careerStats.goals}/${player.careerStats.assists}`}
        />
        <Info label="场均" value={player.careerStats.avgRating || '-'} />
      </div>

      {offerClub && !alreadyThere ? (
        <div className="panel mt-5 border border-[#d4af37]/30 p-4">
          <p className="text-sm text-[#f0d78c]">转会邀约</p>
          <p className="mt-1 text-white">
            {offerClub.name}（{offerClub.league} · {offerClub.country}）
          </p>
          <button
            type="button"
            className="btn btn-primary mt-3 w-full"
            onClick={() => acceptTransfer(offerClub.id)}
          >
            接受加盟
          </button>
        </div>
      ) : null}

      <h3 className="mt-6 text-sm tracking-widest text-white/40">近期大事</h3>
      <ul className="mt-2 space-y-2">
        {[...history]
          .reverse()
          .slice(0, 8)
          .map((h, i) => (
            <li key={i} className="rounded-md bg-white/5 px-3 py-2 text-sm text-white/65">
              {h.replace(/ID:[^\s]+/, '').trim()}
            </li>
          ))}
      </ul>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-white/5 px-3 py-2">
      <div className="text-xs text-white/40">{label}</div>
      <div className="text-white">{value}</div>
    </div>
  )
}
