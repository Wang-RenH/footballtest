import type {
  ApiProviderId,
  EventCategory,
  EventEffects,
  GameEvent,
  Player,
} from '@/models/types'
import { getLifeStage, POSITION_LABELS } from '@/core/AttributeEngine'
import { uid } from '@/utils/random'

export interface EventContext {
  player: Player
  age: number
  weekLabel: string
  teamName: string
  leagueId: string
  seasonRound: number
  recentHistory: string[]
  aiMemory: string[]
  lastMatchSummary?: string
  lastTrainingNote?: string
  /** 一次生成几条（职业期约 4=一个月） */
  batchCount?: number
  /** 本批次已生成的前文，避免重复 */
  priorNarratives?: string[]
  /** 当前联赛积分榜摘要（含真实队名） */
  leagueTableBrief?: string
  /** 允许出现的俱乐部全称，禁止编造 */
  allowedClubNames?: string[]
  /** 球员性格/隐藏属性/关系摘要 */
  playerProfileBrief?: string
  /** 本周赛程（联赛/杯赛对手） */
  upcomingFixtureBrief?: string
}

export interface CustomChoiceVerdict {
  option: {
    id: string
    text: string
    consequenceText: string
    effects: EventEffects
  }
  /** 给玩家看的裁定说明（不含成长分数字） */
  verdict: string
}

export interface AIProvider {
  name: string
  generateEvent(ctx: EventContext): Promise<GameEvent>
  generateMonthEvents(ctx: EventContext, count: number): Promise<GameEvent[]>
  adjudicateCustomChoice(
    ctx: EventContext,
    eventNarrative: string,
    playerIntent: string,
  ): Promise<CustomChoiceVerdict>
  testConnection(): Promise<{ ok: boolean; detail: string }>
}

const EVENT_SCHEMA = `{"narrative":"≤90字","category":"training|match|life|family|social|injury|opportunity","memoryBeat":"一句剧情节拍","options":[{"id":"a","text":"…","consequenceText":"…","effects":{"attributes":{"PAC":1},"growthScore":10,"funds":0,"morale":0,"fatigue":0,"interest":0,"potential":0}}]}`

const GOD_SYSTEM_PROMPT = `你是《绿茵征途》生涯导演（游戏上帝）。只输出合法JSON，无markdown。

硬性规则：
1. 球队/俱乐部名称只能使用用户消息里【可用俱乐部】列表中的全称；禁止编造任何队名（如“天海雄狮”这类不在列表中的名字一律禁止）。
2. 联赛轮次、排名、对手必须与【积分榜】一致；未成年且无俱乐部时不要硬编职业联赛对阵。
3. 若提供【上场比赛】摘要，叙事中的比分、出场身份/分钟、进球分钟、助攻必须与摘要完全一致，禁止自相矛盾（例如摘要写替补登场却写打满90分钟；摘要 1-0 却写你进两球）。
3b. 若仅有【本周赛程】而无上场摘要：禁止提前写具体出场分钟、替补上下场时间或最终比分。
4. 每个事件必须正好 5 个选项，id 为 a/b/c/d/e。
5. 五个选项要覆盖不同态度，结合球员位置、属性短板、性格与关系，禁止五个都正面讨喜。建议结构：
   - a 进取/拼搏（有代价）
   - b 稳妥/职业
   - c 圆滑/人际关系
   - d 消极/逃避/摆烂（可有短期爽感但长期伤）
   - e 冒险/叛逆/赌一把（高风险高波动）
6. 数值克制：属性单次约 -3~+3；growthScore -60~+120（仅写在 effects，后果文案禁止出现「成长分」字样）；morale/fatigue/interest -20~+15；funds 合理。
7. consequenceText 写剧情结果给玩家看，可含情绪与关系变化，但不要列出具体成长分。
单事件字段：${EVENT_SCHEMA}
若要求多条：输出 JSON 数组，长度必须等于要求条数，事件递进且队名仍须来自列表。`

const ADJUDICATE_PROMPT = `你是绿茵征途的游戏上帝。玩家对当前事件写了自定义行动。请裁定后果。
只输出一个 JSON 对象，无markdown：
{"verdict":"≤60字裁定评语（禁止写成长分）","consequenceText":"≤100字剧情结果（禁止写成长分）","effects":{"attributes":{},"growthScore":0,"funds":0,"morale":0,"fatigue":0,"interest":0,"potential":0}}
规则：结合球员特点与事件；可奖可罚；禁止编造列表外俱乐部；growthScore 只放 effects。`

export function monthBatchSize(age: number): number {
  return age < 18 ? 1 : 4
}

const PROVIDER_DEFAULTS: Record<
  Exclude<ApiProviderId, 'none'>,
  { endpoint: string; proxyPath: string; model: string; label: string }
> = {
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    proxyPath: '/ai-proxy/deepseek/v1/chat/completions',
    model: 'deepseek-chat',
    label: 'DeepSeek',
  },
  mimo: {
    endpoint: 'https://api.xiaomimimo.com/v1/chat/completions',
    proxyPath: '/ai-proxy/mimo/v1/chat/completions',
    model: 'mimo-v2.5-pro',
    label: '小米 MiMo',
  },
  glm: {
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    proxyPath: '/ai-proxy/glm/api/paas/v4/chat/completions',
    model: 'glm-4-flash',
    label: '智谱GLM',
  },
  minimax: {
    endpoint: 'https://api.minimaxi.com/v1/chat/completions',
    proxyPath: '/ai-proxy/minimax/v1/chat/completions',
    model: 'MiniMax-M3',
    label: 'MiniMax',
  },
  custom: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    proxyPath: '',
    model: 'gpt-4o-mini',
    label: '自定义',
  },
}

const KNOWN_ENDPOINTS = new Set(
  Object.values(PROVIDER_DEFAULTS).flatMap((d) => [d.endpoint, d.proxyPath].filter(Boolean)),
)

export function getProviderDefaults(id: ApiProviderId) {
  if (id === 'none') return null
  return PROVIDER_DEFAULTS[id]
}

export const MODEL_PRESETS: Record<Exclude<ApiProviderId, 'none'>, string[]> = {
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  mimo: ['mimo-v2.5-pro'],
  glm: [
    'glm-4-flash',
    'glm-4.5-air',
    'glm-4-air',
    'glm-4-airx',
    'glm-4-plus',
    'glm-4-long',
    'glm-5.2',
    'glm-4.6v',
  ],
  minimax: ['MiniMax-M3', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.1'],
  custom: ['gpt-4o-mini', 'gpt-4o'],
}

export function getDefaultModel(provider: ApiProviderId): string {
  if (provider === 'none') return ''
  return PROVIDER_DEFAULTS[provider].model
}

/** 线上默认跨域代理（Cloudflare Worker），手机/GitHub Pages 开箱即用 */
export const DEFAULT_AI_PROXY_BASE = 'https://footballtest.2829546880.workers.dev'

export function isDevAiProxyAvailable(): boolean {
  return Boolean(import.meta.env.DEV)
}

/** 线上静态站（GitHub Pages）用的跨域代理根 */
export function getHostedProxyBase(overrideFromSettings?: string): string {
  const fromSettings = overrideFromSettings?.trim() || ''
  if (fromSettings) return fromSettings.replace(/\/$/, '')
  const baked = String(import.meta.env.VITE_AI_PROXY_BASE || '').trim()
  if (baked) return baked.replace(/\/$/, '')
  return DEFAULT_AI_PROXY_BASE
}

export function isStaticWebHost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return (
    h.endsWith('github.io') ||
    h.endsWith('pages.dev') ||
    h.endsWith('netlify.app') ||
    h.endsWith('vercel.app')
  )
}

export function resolveChatEndpoint(
  provider: ApiProviderId,
  endpointOverride?: string,
  proxyBaseOverride?: string,
): string {
  if (provider === 'none') return ''
  const def = PROVIDER_DEFAULTS[provider]
  const override = endpointOverride?.trim()

  if (provider === 'custom') {
    return override || def.endpoint
  }

  const isOfficialOrProxy =
    !override ||
    KNOWN_ENDPOINTS.has(override) ||
    override.startsWith('/ai-proxy/') ||
    (provider === 'mimo' && /xiaomimimo\.com|api\.mimo\.ai/i.test(override)) ||
    (provider === 'deepseek' && /api\.deepseek\.com/i.test(override)) ||
    (provider === 'glm' && /bigmodel\.cn/i.test(override)) ||
    (provider === 'minimax' && /minimaxi?\.com/i.test(override))

  // 用户填了自定义完整代理 URL（非官方、非内置 /ai-proxy）→ 原样使用
  if (override && !isOfficialOrProxy) {
    return override
  }

  // 仅本地 Vite 开发服优先走 /ai-proxy
  if (isDevAiProxyAvailable() && def.proxyPath) {
    return def.proxyPath
  }

  // 线上静态站：用默认/配置的 Cloudflare Worker
  const hosted = getHostedProxyBase(proxyBaseOverride)
  if (hosted && def.proxyPath) {
    const path = def.proxyPath.replace(/^\/ai-proxy/, '')
    return `${hosted}${path}`
  }

  // 生产直连官方（多数会因 CORS 失败）
  return override && isOfficialOrProxy && !override.startsWith('/ai-proxy/')
    ? override
    : def.endpoint
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}超时（${ms / 1000}s）`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export class OpenAICompatibleProvider implements AIProvider {
  name: string
  private endpoint: string
  private apiKey: string
  private model: string
  private providerId: ApiProviderId

  constructor(
    endpoint: string,
    apiKey: string,
    model: string,
    label: string,
    providerId: ApiProviderId,
  ) {
    this.endpoint = endpoint
    this.apiKey = apiKey
    this.model = model
    this.name = label
    this.providerId = providerId
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    }
    if (this.providerId === 'mimo') {
      headers['api-key'] = this.apiKey
    }
    return headers
  }

  private buildBody(messages: Array<{ role: string; content: string }>, maxTokens: number) {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: 0.65,
      stream: false,
    }
    // 小米 / 智谱 / MiniMax 新模型默认可能开思考
    if (this.providerId === 'mimo' || this.providerId === 'glm' || this.providerId === 'minimax') {
      body.thinking = { type: 'disabled' }
    }
    if (this.providerId === 'mimo' || this.providerId === 'minimax') {
      body.max_completion_tokens = maxTokens
    } else {
      body.max_tokens = maxTokens
    }
    return body
  }

  private async postChat(
    messages: Array<{ role: string; content: string }>,
    maxTokens: number,
    timeoutMs = 90000,
  ): Promise<Response> {
    try {
      // 超时覆盖整段请求：等响应头 + 读完 body（大事件生成常 >45s）
      return await withTimeout(
        (async () => {
          const res = await fetch(this.endpoint, {
            method: 'POST',
            headers: this.buildHeaders(),
            body: JSON.stringify(this.buildBody(messages, maxTokens)),
          })
          // 预读文本挂到自定义字段，避免外层再读时已过超时窗
          const text = await res.text()
          const wrapped = new Response(text, {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
          })
          return wrapped
        })(),
        timeoutMs,
        'AI 请求',
      )
    } catch (err) {
      throw new Error(formatFetchError(err, this.endpoint))
    }
  }

  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    const res = await this.postChat([{ role: 'user', content: '回复ok即可' }], 16, 25000)
    const text = await res.text()
    if (!res.ok) {
      return { ok: false, detail: formatHttpError(res.status, text) }
    }
    return {
      ok: true,
      detail: `连接成功 · 模型 ${this.model} · ${this.endpoint}`,
    }
  }

  async generateEvent(ctx: EventContext): Promise<GameEvent> {
    const list = await this.generateMonthEvents(ctx, 1)
    return list[0]!
  }

  /** 逐条生成，避免一次吐 4 事件导致超时；设置连通 ≠ 大请求也能很快完成 */
  async generateMonthEvents(ctx: EventContext, count: number): Promise<GameEvent[]> {
    const n = Math.max(1, Math.min(4, count))
    const events: GameEvent[] = []
    let lastErr: Error | null = null
    for (let i = 0; i < n; i++) {
      try {
        const one = await this.generateSingleEvent({
          ...ctx,
          batchCount: 1,
          priorNarratives: events.map((e) => e.narrative.slice(0, 36)),
        })
        events.push(one)
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e))
        break
      }
    }
    if (events.length === 0) {
      throw lastErr ?? new Error('AI 生成失败')
    }
    // 中途超时也先交还已生成部分，本周能继续玩
    return events
  }

  private async generateSingleEvent(ctx: EventContext): Promise<GameEvent> {
    const res = await this.postChat(
      [
        { role: 'system', content: GOD_SYSTEM_PROMPT },
        { role: 'user', content: buildGodUserPrompt(ctx) },
      ],
      900,
      90000,
    )
    const text = await res.text()
    if (!res.ok) throw new Error(formatHttpError(res.status, text))

    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`AI 返回非 JSON 外壳：${text.slice(0, 120)}`)
    }

    const content = extractAssistantText(data)
    if (!content.trim()) {
      const finish = getFinishReason(data)
      throw new Error(
        `AI 返回空内容${finish ? `（finish_reason=${finish}）` : ''}。建议改用 glm-4-flash。原文：${text.slice(0, 160)}`,
      )
    }
    return parseAiEventBatch(content, ctx.age, 1)[0]!
  }

  async adjudicateCustomChoice(
    ctx: EventContext,
    eventNarrative: string,
    playerIntent: string,
  ): Promise<CustomChoiceVerdict> {
    const intent = playerIntent.trim().slice(0, 200)
    if (!intent) throw new Error('请先写下你的做法')
    const res = await this.postChat(
      [
        { role: 'system', content: ADJUDICATE_PROMPT },
        {
          role: 'user',
          content: `${buildGodUserPrompt({ ...ctx, batchCount: 1 })}
【当前事件】${eventNarrative}
【玩家自定义行动】${intent}
请裁定。`,
        },
      ],
      500,
      60000,
    )
    const text = await res.text()
    if (!res.ok) throw new Error(formatHttpError(res.status, text))
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`AI 返回非 JSON 外壳：${text.slice(0, 120)}`)
    }
    const content = extractAssistantText(data)
    if (!content.trim()) throw new Error('AI 裁定返回空内容')
    const jsonText = extractJson(content)
    const raw = JSON.parse(jsonText) as {
      verdict?: string
      consequenceText?: string
      effects?: EventOptionEffects
    }
    const effects = sanitizeEffects(raw.effects)
    return {
      verdict: (raw.verdict || '上帝已记下你的选择。').replace(/成长分[+\-−]?\d*/g, '').trim(),
      option: {
        id: 'custom',
        text: intent.slice(0, 40),
        consequenceText: (raw.consequenceText || '你的行动带来了连锁反应。').replace(
          /成长分[+\-−]?\d*/g,
          '',
        ),
        effects,
      },
    }
  }
}

export function createAIProvider(
  provider: ApiProviderId,
  apiKey: string,
  endpointOverride?: string,
  modelOverride?: string,
  proxyBaseOverride?: string,
): AIProvider | null {
  if (provider === 'none' || !apiKey.trim()) return null
  const def = PROVIDER_DEFAULTS[provider]
  const endpoint = resolveChatEndpoint(provider, endpointOverride, proxyBaseOverride)
  const model = (modelOverride?.trim() || def.model).trim()
  return new OpenAICompatibleProvider(
    endpoint,
    apiKey.trim(),
    model,
    def.label,
    provider,
  )
}

function formatHttpError(status: number, body: string): string {
  const snippet = body.slice(0, 220)
  if (status === 402 || /insufficient[_ ]balance|余额不足/i.test(body)) {
    return '账户余额不足（HTTP 402）。请充值或换用其他服务商 / 本地事件库。'
  }
  if (status === 401 || /unauthorized|invalid.*key|鉴权|api.?key/i.test(body)) {
    return 'API Key 无效或未授权（HTTP 401）。'
  }
  if (status === 429) return '请求过于频繁（HTTP 429）。'
  if (status === 404) return '接口或模型不存在（HTTP 404）。'
  if (status === 405) {
    return 'HTTP 405：当前站点没有 AI 代理（GitHub Pages 不能 POST /ai-proxy）。请在设置填写「跨域代理根地址」，或用电脑 npm run dev 本地玩。'
  }
  return `HTTP ${status}: ${snippet || '请求失败'}`
}

/** 把网络/CORS 失败转成可读中文 */
export function formatFetchError(err: unknown, endpointHint?: string): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/超时/.test(msg)) {
    return `${msg}。连通测试只测短回复；生成事件更慢。请点「刷新重试」，或换更快模型（如 glm-4-flash）。`
  }
  if (/failed to fetch|networkerror|load failed|cors/i.test(msg)) {
    const ep = endpointHint || ''
    if (ep.startsWith('/ai-proxy/')) {
      return 'HTTP 代理路径无效：线上站没有 /ai-proxy。请在设置填写「跨域代理根地址」。'
    }
    if (isStaticWebHost() && !/workers\.dev|ai-proxy|localhost/i.test(ep)) {
      return '无法连接 AI（跨域）。手机/GitHub Pages 请在设置填写 Cloudflare Worker「跨域代理根地址」。'
    }
    return `无法连接 AI：${msg}。若在线上站，请检查跨域代理；本地请用 npm run dev。`
  }
  return msg
}

/** 兼容 content / reasoning_content / 多段 content 数组 */
function extractAssistantText(data: unknown): string {
  const root = data as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>
        reasoning_content?: string
      }
      text?: string
    }>
    output_text?: string
  }

  const msg = root.choices?.[0]?.message
  if (!msg) {
    if (typeof root.output_text === 'string') return root.output_text
    return ''
  }

  const fromContent = normalizeContentField(msg.content)
  if (fromContent.trim()) return fromContent

  // 思考模型有时把最终答案也写在 reasoning 里（或 content 被占满后为空）
  const reasoning = msg.reasoning_content?.trim() ?? ''
  if (reasoning) {
    // 优先抽 JSON；否则整段用作解析源
    try {
      return extractJson(reasoning)
    } catch {
      return reasoning
    }
  }

  const choiceText = root.choices?.[0]?.text
  return typeof choiceText === 'string' ? choiceText : ''
}

function normalizeContentField(
  content: string | Array<{ type?: string; text?: string }> | undefined,
): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part.text === 'string') return part.text
        return ''
      })
      .join('')
  }
  return ''
}

function getFinishReason(data: unknown): string | null {
  const reason = (data as { choices?: Array<{ finish_reason?: string }> })?.choices?.[0]
    ?.finish_reason
  return reason ?? null
}

function buildGodUserPrompt(ctx: EventContext): string {
  const p = ctx.player
  const stage = getLifeStage(ctx.age)
  const attrs = `速${p.attributes.PAC} 射${p.attributes.SHO} 传${p.attributes.PAS} 带${p.attributes.DRI} 防${p.attributes.DEF} 身${p.attributes.PHY}`
  const memory = ctx.aiMemory.slice(-5).join(' | ') || '无'
  const recent = ctx.recentHistory.slice(-4).join(' | ') || '无'
  const clubs =
    ctx.allowedClubNames && ctx.allowedClubNames.length
      ? ctx.allowedClubNames.join('、')
      : '（无职业俱乐部名单，勿编造队名）'
  const table = ctx.leagueTableBrief || '（暂无积分榜）'
  const profile = ctx.playerProfileBrief || '无'
  const n = ctx.batchCount ?? 1
  const prior =
    ctx.priorNarratives && ctx.priorNarratives.length
      ? `\n【本月已写勿重复】${ctx.priorNarratives.join(' / ')}`
      : ''
  const ask =
    n <= 1
      ? '输出 1 个事件 JSON 对象（含恰好 5 个选项 a-e）。'
      : `输出长度为 ${n} 的事件 JSON 数组（约一个月/${n}周递进；每事件恰好 5 选项 a-e；队名必须来自可用俱乐部）。`
  return `${ctx.weekLabel} ${stage} 联赛进度约第${ctx.seasonRound}轮
【球员】${p.name} ${ctx.age}岁 ${POSITION_LABELS[p.position]} OVR${p.OVR}/潜${p.potential} 惯用脚${p.preferredFoot}
【属性】${attrs}
【状态】心${p.morale} 疲${p.fatigue} 趣${p.interest} 资${p.funds} 伤病:${p.injury?.name ?? '无'}
【俱乐部】${ctx.teamName || '无俱乐部'} · ${ctx.leagueId}
【生涯】出场${p.careerStats.appearances} 球${p.careerStats.goals} 助${p.careerStats.assists} 场均${p.careerStats.avgRating || '-'}
【特质画像】${profile}
【可用俱乐部｜禁止编造列表外队名】${clubs}
【积分榜（名次 队名 积分 净胜球）】${table}
训:${ctx.lastTrainingNote || '无'} · 赛:${ctx.lastMatchSummary || '无'}
【本周赛程】${ctx.upcomingFixtureBrief || '无正式比赛'}
记忆:${memory}
近况:${recent}${prior}
${ask}`
}

type RawAiEvent = {
  narrative?: string
  category?: EventCategory
  memoryBeat?: string
  options?: Array<{
    id?: string
    text?: string
    consequenceText?: string
    effects?: EventOptionEffects
  }>
}

function parseAiEventBatch(content: string, age: number, count: number): GameEvent[] {
  const jsonText = extractJsonArrayOrObject(content)
  const parsed = JSON.parse(jsonText) as RawAiEvent | RawAiEvent[]
  const list = Array.isArray(parsed) ? parsed : [parsed]
  const events = list.slice(0, count).map((raw) => normalizeRawEvent(raw, age))
  while (events.length < count) {
    events.push(
      normalizeRawEvent(
        {
          narrative: '平静的一周。训练、休息与等待机会。',
          category: 'life',
          memoryBeat: '波澜不惊的日常',
          options: [
            { id: 'a', text: '加练冲刺', consequenceText: '多练了一程，腿很沉。', effects: { growthScore: 25, fatigue: 8 } },
            { id: 'b', text: '按计划执行', consequenceText: '波澜不惊。', effects: { growthScore: 15 } },
            { id: 'c', text: '帮队友加餐', consequenceText: '关系好了点。', effects: { morale: 3, growthScore: 12 } },
            { id: 'd', text: '偷懒刷手机', consequenceText: '教练皱了眉。', effects: { fatigue: -5, morale: -4, growthScore: -10 } },
            { id: 'e', text: '加练到深夜', consequenceText: '有突破，也埋下伤病隐患。', effects: { growthScore: 40, fatigue: 15, interest: 2 } },
          ],
        },
        age,
      ),
    )
  }
  return events
}

const OPTION_IDS = ['a', 'b', 'c', 'd', 'e'] as const

function normalizeRawEvent(raw: RawAiEvent, age: number): GameEvent {
  const options = (raw.options ?? []).slice(0, 5).map((o, i) => ({
    id: o.id || OPTION_IDS[i]!,
    text: o.text || `选项 ${i + 1}`,
    consequenceText: stripGrowthMention(o.consequenceText || '选择产生了影响。'),
    effects: sanitizeEffects(o.effects),
  }))
  while (options.length < 5) {
    options.push({
      id: OPTION_IDS[options.length]!,
      text: options.length === 3 ? '敷衍了事' : options.length === 4 ? '冒险一搏' : '冷静观察',
      consequenceText: '你走了另一条路。',
      effects: sanitizeEffects(
        options.length >= 3
          ? { growthScore: options.length === 3 ? -8 : 35, morale: options.length === 3 ? -3 : 2, fatigue: options.length === 4 ? 10 : 0 }
          : { growthScore: 10 },
      ),
    })
  }
  const event: GameEvent = {
    id: uid('ai'),
    ageRange: [age, age],
    category: raw.category || 'life',
    narrative: stripGrowthMention(raw.narrative || '本周，命运再次叩门。'),
    options,
    once: false,
    isKeyEvent: false,
  }
  ;(event as GameEvent & { memoryBeat?: string }).memoryBeat = raw.memoryBeat
  return event
}

function stripGrowthMention(text: string): string {
  return text.replace(/成长分[+\-−]?\d*/g, '').replace(/\s{2,}/g, ' ').trim()
}

function extractJsonArrayOrObject(text: string): string {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence ? fence[1]!.trim() : trimmed
  const arrStart = body.indexOf('[')
  const objStart = body.indexOf('{')
  if (arrStart >= 0 && (objStart < 0 || arrStart < objStart)) {
    const end = body.lastIndexOf(']')
    if (end > arrStart) return body.slice(arrStart, end + 1)
  }
  return extractJson(body)
}

export function getEventMemoryBeat(event: GameEvent): string | null {
  const beat = (event as GameEvent & { memoryBeat?: string }).memoryBeat
  return beat?.trim() || null
}

type EventOptionEffects = {
  attributes?: Partial<Record<string, number>>
  growthScore?: number
  funds?: number
  morale?: number
  fatigue?: number
  interest?: number
  potential?: number
}

function sanitizeEffects(effects?: EventOptionEffects) {
  if (!effects) return { growthScore: 20 }
  const attrs: Record<string, number> = {}
  if (effects.attributes) {
    for (const k of ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']) {
      const v = effects.attributes[k]
      if (typeof v === 'number' && v !== 0) {
        attrs[k] = Math.max(-3, Math.min(3, Math.round(v)))
      }
    }
  }
  return {
    attributes: Object.keys(attrs).length ? attrs : undefined,
    growthScore:
      effects.growthScore != null
        ? Math.max(-80, Math.min(150, Math.round(effects.growthScore)))
        : undefined,
    funds:
      effects.funds != null
        ? Math.max(-200000, Math.min(200000, Math.round(effects.funds)))
        : undefined,
    morale:
      effects.morale != null ? Math.max(-20, Math.min(20, Math.round(effects.morale))) : undefined,
    fatigue:
      effects.fatigue != null ? Math.max(-30, Math.min(30, Math.round(effects.fatigue))) : undefined,
    interest:
      effects.interest != null
        ? Math.max(-20, Math.min(20, Math.round(effects.interest)))
        : undefined,
    potential:
      effects.potential != null
        ? Math.max(-2, Math.min(3, Math.round(effects.potential)))
        : undefined,
  }
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) return fenced[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  throw new Error('AI 未返回 JSON')
}
