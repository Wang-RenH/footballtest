import { create } from 'zustand'
import type { ApiProviderId, AppSettings } from '@/models/types'
import { loadSettingsJson, saveSettingsJson } from '@/save/SaveManager'
import { getDefaultModel, getProviderDefaults, DEFAULT_AI_PROXY_BASE } from '@/ai/AIProvider'

const DEFAULTS: AppSettings = {
  apiKey: '',
  apiProvider: 'none',
  apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
  apiModel: '',
  aiProxyBase: DEFAULT_AI_PROXY_BASE,
  difficulty: 'normal',
  useAiEvents: false,
}

function load(): AppSettings {
  const raw = loadSettingsJson()
  if (!raw) return { ...DEFAULTS }
  try {
    const parsed = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) }
    if (!parsed.apiModel && parsed.apiProvider !== 'none') {
      parsed.apiModel = getDefaultModel(parsed.apiProvider)
    }
    // 清理已废弃的 workers.dev 默认值
    if (/workers\.dev/i.test(parsed.aiProxyBase || '')) {
      parsed.aiProxyBase = ''
    }
    return parsed
  } catch {
    return { ...DEFAULTS }
  }
}

interface SettingsStore extends AppSettings {
  setSettings: (patch: Partial<AppSettings>) => void
  setProvider: (id: ApiProviderId) => void
}

function persist(data: AppSettings) {
  saveSettingsJson(
    JSON.stringify({
      apiKey: data.apiKey,
      apiProvider: data.apiProvider,
      apiEndpoint: data.apiEndpoint,
      apiModel: data.apiModel,
      aiProxyBase: data.aiProxyBase,
      difficulty: data.difficulty,
      useAiEvents: data.useAiEvents,
    }),
  )
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...load(),
  setSettings: (patch) => {
    const merged = { ...get(), ...patch }
    const { setSettings: _s, setProvider: _p, ...data } = merged
    persist(data)
    set(patch)
  },
  setProvider: (id) => {
    const def = getProviderDefaults(id)
    get().setSettings({
      apiProvider: id,
      apiEndpoint: def?.endpoint ?? '',
      apiModel: def?.model ?? '',
      useAiEvents: id !== 'none',
    })
  },
}))
