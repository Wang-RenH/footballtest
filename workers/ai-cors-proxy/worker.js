const TARGETS = {
  deepseek: 'https://api.deepseek.com',
  mimo: 'https://api.xiaomimimo.com',
  glm: 'https://open.bigmodel.cn',
  minimax: 'https://api.minimaxi.com',
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      request.headers.get('Access-Control-Request-Headers') ||
      'Authorization, Content-Type, Accept, api-key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function withCors(request, body, init = {}) {
  const headers = new Headers(init.headers || {})
  const cors = corsHeaders(request)
  for (const [k, v] of Object.entries(cors)) headers.set(k, v)
  return new Response(body, { ...init, headers })
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return withCors(request, null, { status: 204 })
    }

    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)

    // 连通探测：不转发上游，秒回
    if (parts.length === 0 || parts[0] === 'health') {
      return withCors(request, 'ok', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    const key = parts[0]
    const base = TARGETS[key]
    if (!base) {
      return withCors(
        request,
        'Unknown provider. Use /deepseek/... /mimo/... /glm/... /minimax/...',
        { status: 404, headers: { 'Content-Type': 'text/plain' } },
      )
    }

    const rest = '/' + parts.slice(1).join('/')
    const target = base + rest + url.search

    // 只转发上游需要的头，避免浏览器/CF 头导致卡住
    const headers = new Headers()
    headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json')
    const auth = request.headers.get('Authorization')
    if (auth) headers.set('Authorization', auth)
    const apiKey = request.headers.get('api-key')
    if (apiKey) headers.set('api-key', apiKey)

    const init = {
      method: request.method,
      headers,
      redirect: 'follow',
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer()
    }

    let upstream
    try {
      upstream = await fetch(target, init)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return withCors(request, `Upstream fetch failed: ${msg}`, {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    const outHeaders = new Headers(upstream.headers)
    outHeaders.delete('content-encoding')
    outHeaders.delete('content-length')
    const cors = corsHeaders(request)
    for (const [k, v] of Object.entries(cors)) outHeaders.set(k, v)

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    })
  },
}
