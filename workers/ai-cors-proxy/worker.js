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

function applyCors(request, headers) {
  const cors = corsHeaders(request)
  for (const [k, v] of Object.entries(cors)) headers.set(k, v)
  return headers
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: applyCors(request, new Headers()),
      })
    }

    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)

    if (parts.length === 0 || parts[0] === 'health') {
      return new Response('ok', {
        status: 200,
        headers: applyCors(
          request,
          new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
        ),
      })
    }

    const key = parts[0]
    const base = TARGETS[key]
    if (!base) {
      return new Response(
        'Unknown provider. Use /deepseek/... /mimo/... /glm/... /minimax/...',
        {
          status: 404,
          headers: applyCors(
            request,
            new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
          ),
        },
      )
    }

    const rest = '/' + parts.slice(1).join('/')
    const target = base + rest + url.search

    const headers = new Headers()
    headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json')
    const auth = request.headers.get('Authorization')
    if (auth) headers.set('Authorization', auth)
    const apiKeyHeader = request.headers.get('api-key')
    if (apiKeyHeader) headers.set('api-key', apiKeyHeader)

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
      return new Response(`Upstream fetch failed: ${msg}`, {
        status: 502,
        headers: applyCors(
          request,
          new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
        ),
      })
    }

    // 读成明文再返回，避免删 content-encoding 后正文仍是 gzip 导致浏览器解不开
    const buf = await upstream.arrayBuffer()
    const outHeaders = new Headers()
    outHeaders.set(
      'Content-Type',
      upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
    )
    applyCors(request, outHeaders)

    return new Response(buf, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    })
  },
}
