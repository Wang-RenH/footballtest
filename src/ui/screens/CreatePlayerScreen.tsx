import { useState } from 'react'
import type {
  CreatePlayerInput,
  FamilyBackground,
  GameMode,
  Position,
  PreferredFoot,
} from '@/models/types'
import { getCities, randomCreateInput } from '@/core/GameFactory'
import { POSITION_LABELS } from '@/core/AttributeEngine'
import { useGameStore } from '@/store/gameStore'

const POSITIONS = Object.keys(POSITION_LABELS) as Position[]

export function CreatePlayerScreen() {
  const startNewGame = useGameStore((s) => s.startNewGame)
  const setScreen = useGameStore((s) => s.setScreen)
  const [form, setForm] = useState<CreatePlayerInput>({
    name: '',
    birthCity: '上海',
    jerseyNumber: 10,
    position: 'ST',
    preferredFoot: 'right',
    familyBackground: 'working',
    mode: 'quick',
  })

  const patch = (p: Partial<CreatePlayerInput>) => setForm((f) => ({ ...f, ...p }))

  return (
    <div className="fade-in px-4 py-6 pb-24">
      <button type="button" className="text-sm text-white/50" onClick={() => setScreen('home')}>
        ← 返回
      </button>
      <h1 className="font-display mt-3 text-3xl text-white">创建球员</h1>
      <p className="mt-1 text-sm text-white/50">打造你的绿茵人设，开启征途。</p>

      <div className="mt-6 flex gap-2">
        {(
          [
            ['quick', '快速模式 · 18岁'],
            ['career', '完整生涯 · 3岁'],
          ] as [GameMode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-sm ${
              form.mode === m
                ? 'bg-yellow-400/20 text-yellow-200 ring-1 ring-yellow-400/40'
                : 'bg-white/5 text-white/50'
            }`}
            onClick={() => patch({ mode: m })}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="mt-5 block text-sm text-white/60">
        姓名
        <input
          className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-yellow-400/50"
          value={form.name}
          placeholder="例如：李浩然"
          onChange={(e) => patch({ name: e.target.value })}
        />
      </label>

      <label className="mt-4 block text-sm text-white/60">
        出生城市
        <select
          className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white"
          value={form.birthCity}
          onChange={(e) => patch({ birthCity: e.target.value })}
        >
          {getCities().map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block text-sm text-white/60">
          球衣号码
          <input
            type="number"
            min={1}
            max={99}
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white"
            value={form.jerseyNumber}
            onChange={(e) => patch({ jerseyNumber: Number(e.target.value) || 1 })}
          />
        </label>
        <label className="block text-sm text-white/60">
          惯用脚
          <select
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white"
            value={form.preferredFoot}
            onChange={(e) => patch({ preferredFoot: e.target.value as PreferredFoot })}
          >
            <option value="right">右脚</option>
            <option value="left">左脚</option>
            <option value="both">双脚</option>
          </select>
        </label>
      </div>

      <label className="mt-4 block text-sm text-white/60">
        场上位置
        <select
          className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white"
          value={form.position}
          onChange={(e) => patch({ position: e.target.value as Position })}
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {POSITION_LABELS[p]} ({p})
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block text-sm text-white/60">
        家庭背景
        <select
          className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white"
          value={form.familyBackground}
          onChange={(e) => patch({ familyBackground: e.target.value as FamilyBackground })}
        >
          <option value="poor">贫困</option>
          <option value="working">工薪</option>
          <option value="middle">中产</option>
          <option value="wealthy">富裕</option>
        </select>
      </label>

      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => setForm(randomCreateInput())}
        >
          随机生成
        </button>
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => startNewGame(form)}
        >
          踏上绿茵
        </button>
      </div>
    </div>
  )
}
