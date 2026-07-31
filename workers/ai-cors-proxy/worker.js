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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      request.headers.get('Access-Control-Request-Headers') ||
      'Authorization, Content-Type, Accept',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean)
    const key = parts[0]
    const base = TARGETS[key]
    if (!base) {
      return new Response(
        'Unknown provider. Use /deepseek/... /mimo/... /glm/... /minimax/...',
        { status: 404, headers: { ...corsHeaders(request), 'Content-Type': 'text/plain' } },
      )
    }

    const rest = '/' + parts.slice(1).join('/')
    const target = base + rest + url.search
    const headers = new Headers(request.headers)
    headers.delete('host')
    headers.delete('origin')
    headers.delete('referer')

    const init = {
      method: request.method,
      headers,
      redirect: 'follow',
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer()
    }

    const upstream = await fetch(target, init)
    const out = new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers,
    })
    const cors = corsHeaders(request)
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v)
    return out
  },
}
