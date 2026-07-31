# AI 跨域代理（手机 / GitHub Pages）

GitHub Pages 没有本地 `/ai-proxy`，手机需要这个 Worker。

## 部署 / 更新（改过 worker.js 后必须重新粘贴）

1. Cloudflare → Workers & Pages → 你的 Worker → **Edit code**
2. 全选删除，粘贴本目录 [`worker.js`](./worker.js) 全文
3. **Deploy**
4. 浏览器打开：`https://你的地址.workers.dev/health`  
   应显示 `ok`。若一直转圈，多半是当前网络访问不了 `workers.dev`（国内常见），需换网络/加速，或游戏里改用「本地事件库」。

游戏已默认填入代理地址，一般不用在设置里改。
