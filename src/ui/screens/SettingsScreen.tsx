import { useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { useSettingsStore } from '@/store/settingsStore'
import {
  createAIProvider,
  formatFetchError,
  getDefaultModel,
  getProviderDefaults,
  isGitHubPagesHost,
  usesSameOriginAiProxy,
  MODEL_PRESETS,
} from '@/ai/AIProvider'
import type { ApiProviderId } from '@/models/types'

export function SettingsScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const state = useGameStore((s) => s.state)
  const deleteSave = useGameStore((s) => s.deleteSave)
  const settings = useSettingsStore()
  const setSettings = useSettingsStore((s) => s.setSettings)
  const setProvider = useSettingsStore((s) => s.setProvider)
  const [testMsg, setTestMsg] = useState('')
  const [customModel, setCustomModel] = useState(false)

  const onGitHubPages = typeof window !== 'undefined' && isGitHubPagesHost()
  const onSameOriginProxy = typeof window !== 'undefined' && usesSameOriginAiProxy()

  const providers: { id: ApiProviderId; label: string }[] = [
    { id: 'none', label: '本地事件库' },
    { id: 'deepseek', label: 'DeepSeek' },
    { id: 'mimo', label: '小米 MiMo' },
    { id: 'glm', label: '智谱 GLM' },
    { id: 'minimax', label: 'MiniMax' },
    { id: 'custom', label: '自定义兼容' },
  ]

  const presets = useMemo(() => {
    if (settings.apiProvider === 'none') return []
    return MODEL_PRESETS[settings.apiProvider] ?? []
  }, [settings.apiProvider])

  const modelInPresets = presets.includes(settings.apiModel)
  const showCustomModel = customModel || (settings.apiModel !== '' && !modelInPresets)

  async function testAi() {
    setTestMsg('测试中…')
    const p = createAIProvider(
      settings.apiProvider,
      settings.apiKey,
      settings.apiEndpoint,
      settings.apiModel || getDefaultModel(settings.apiProvider),
      settings.aiProxyBase,
    )
    if (!p) {
      setTestMsg('请选择服务商并填写 API Key')
      return
    }
    try {
      const result = await p.testConnection()
      setTestMsg(result.detail)
    } catch (e) {
      setTestMsg(formatFetchError(e))
    }
  }

  return (
    <div className="fade-in px-4 py-5 pb-28">
      <div className="flex items-center justify-between">
        <h2 className="font-card text-3xl text-white">SETTINGS</h2>
        {!state ? (
          <button type="button" className="text-sm text-white/50" onClick={() => setScreen('home')}>
            返回
          </button>
        ) : null}
      </div>

      <div className="panel mt-5 space-y-4 p-4">
        <h3 className="text-sm tracking-widest text-white/40">AI 叙事引擎</h3>
        <p className="text-xs" style={{ color: '#f0d78c' }}>
          {onSameOriginProxy
            ? 'AI 代理：同源 /ai-proxy（可用）'
            : onGitHubPages
              ? '请改用阿里云服务器地址'
              : 'AI 代理：请确认部署方式'}
        </p>
        <p className="text-xs text-white/45">
          Key 仅存本机。线上请打开阿里云 IP 站点；电脑开发用{' '}
          <code className="text-[#f0d78c]">npm run dev</code>。
        </p>
        {onGitHubPages ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
            当前是旧的 GitHub Pages，在线 AI 不可用。请打开{' '}
            <code className="text-[#f0d78c]">http://你的服务器IP/</code>（见 README）。
          </p>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={settings.useAiEvents}
            onChange={(e) => setSettings({ useAiEvents: e.target.checked })}
          />
          启用 AI 事件
        </label>
        <label className="block text-sm text-white/60">
          服务商
          <select
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
            value={settings.apiProvider}
            onChange={(e) => {
              setCustomModel(false)
              setProvider(e.target.value as ApiProviderId)
            }}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        {settings.apiProvider !== 'none' ? (
          <div className="space-y-2">
            <label className="block text-sm text-white/60">
              模型
              {!showCustomModel ? (
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={settings.apiModel || getDefaultModel(settings.apiProvider)}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomModel(true)
                      return
                    }
                    setSettings({ apiModel: e.target.value })
                  }}
                >
                  {presets.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="__custom__">自定义输入…</option>
                </select>
              ) : (
                <input
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={settings.apiModel}
                  placeholder="例如 glm-4.5-air / glm-4.6v"
                  onChange={(e) => setSettings({ apiModel: e.target.value })}
                />
              )}
            </label>
            {showCustomModel ? (
              <button
                type="button"
                className="text-xs text-[#f0d78c]"
                onClick={() => {
                  setCustomModel(false)
                  setSettings({
                    apiModel: getDefaultModel(settings.apiProvider),
                  })
                }}
              >
                返回预设列表
              </button>
            ) : null}
            {settings.apiProvider === 'glm' ? (
              <p className="text-xs text-white/35">
                速度建议选 glm-4-flash（默认）。质量优先可换 glm-4.5-air。
              </p>
            ) : settings.apiProvider === 'minimax' ? (
              <p className="text-xs text-white/35">端点 api.minimaxi.com/v1 · 默认 MiniMax-M3</p>
            ) : (
              <p className="text-xs text-white/35">
                默认：{getProviderDefaults(settings.apiProvider)?.model}
              </p>
            )}
          </div>
        ) : null}

        <label className="block text-sm text-white/60">
          API Key
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
            value={settings.apiKey}
            placeholder={
              settings.apiProvider === 'glm'
                ? '在 open.bigmodel.cn 创建'
                : '仅本地保存'
            }
            onChange={(e) => setSettings({ apiKey: e.target.value })}
          />
        </label>
        <label className="block text-sm text-white/60">
          Endpoint（一般不用改）
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
            value={settings.apiEndpoint}
            onChange={(e) => setSettings({ apiEndpoint: e.target.value })}
          />
        </label>
        <button type="button" className="btn btn-ghost w-full" onClick={() => void testAi()}>
          测试连接
        </button>
        {testMsg ? <p className="text-center text-xs text-[#f0d78c]">{testMsg}</p> : null}
      </div>

      <div className="panel mt-4 space-y-3 p-4">
        <h3 className="text-sm tracking-widest text-white/40">难度</h3>
        <select
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
          value={settings.difficulty}
          onChange={(e) =>
            setSettings({ difficulty: e.target.value as 'easy' | 'normal' | 'hard' })
          }
        >
          <option value="easy">简单</option>
          <option value="normal">普通</option>
          <option value="hard">困难</option>
        </select>
      </div>

      <button
        type="button"
        className="btn btn-ghost mt-4 w-full"
        onClick={() => setScreen('archive')}
      >
        生涯档案馆
      </button>

      {state && !state.retired ? (
        <div className="mt-6 space-y-2">
          <button type="button" className="btn btn-ghost w-full" onClick={() => setScreen('home')}>
            返回主菜单（已自动存档）
          </button>
          <button
            type="button"
            className="btn btn-danger w-full"
            onClick={() => {
              if (confirm('确定删除当前存档？生涯档案不会删除。')) deleteSave()
            }}
          >
            删除当前存档
          </button>
        </div>
      ) : null}
    </div>
  )
}
