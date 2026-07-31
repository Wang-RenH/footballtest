# AI 跨域代理（手机 / GitHub Pages）

GitHub Pages 是纯静态站，**不能**像本地 `npm run dev` 那样提供 `/ai-proxy`，手机直接调会得到 **HTTP 405**。

## 一键部署（免费）

1. 打开 [Cloudflare Workers](https://dash.cloudflare.com/) → Create Worker  
2. 把 [`worker.js`](./worker.js) 全文粘贴进去 → Deploy  
3. 复制地址，例如 `https://greenfield-ai.xxx.workers.dev`（不要末尾斜杠）  
4. 手机打开游戏 → **设置** → **跨域代理根地址** 填入该 URL → 测试连接  

Key 仍只存在你手机浏览器本地，Worker 只做转发。
