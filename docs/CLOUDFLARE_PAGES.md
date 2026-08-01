# 手机也能用 AI：部署到 Cloudflare Pages（推荐）

国内很多网络 **打不开** `*.workers.dev`，所以 GitHub Pages + 独立 Worker 在手机上会失败。

改用 **Cloudflare Pages**：网站和 `/ai-proxy` 在同一个域名，手机不用访问 workers.dev。

## 操作（你已有 Cloudflare 账号）

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 选中仓库 `Wang-RenH/footballtest`
3. 构建设置：
   - Framework preset: `None` / Vite
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: 留空（仓库根目录就是本项目）
4. **Save and Deploy**
5. 部署完成后，用给出的地址打开，例如：  
   `https://footballtest.pages.dev`  
   （不要再用 `github.io` 测 AI）

## 自检

手机打开：`https://你的项目.pages.dev/ai-proxy/health`  
应显示 `ok`。然后再在游戏设置里测 AI。

## 和 GitHub Pages 的关系

| 地址 | 能否玩 | 手机 AI |
|------|--------|---------|
| github.io | 能 | 国内常不行（依赖 workers.dev） |
| pages.dev | 能 | 同源代理，优先用这个 |
| 电脑 `npm run dev` | 能 | 本机代理，最稳 |

把 **pages.dev 链接** 发给朋友即可。
