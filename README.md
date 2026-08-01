# 绿茵征途 · 单机试玩版

文字驱动的中国球员生涯模拟器。手机/电脑浏览器即可游玩，数据本地存档，无需联网。

## 快速开始

```bash
cd foootball
npm install
npm run dev
```

浏览器打开终端提示的本地地址（一般是 `http://localhost:5173`）。手机同网访问可用电脑局域网 IP。

```bash
npm run build    # 产出 dist/
npm run preview  # 预览生产包
```

## 给别人在线玩（推荐 Cloudflare Pages）

**手机要用 AI：不要用 github.io**（国内常打不开 `workers.dev` 代理）。

按 [`docs/CLOUDFLARE_PAGES.md`](./docs/CLOUDFLARE_PAGES.md) 把仓库接到 Cloudflare Pages，用 `*.pages.dev` 链接分享。

简要步骤：Cloudflare → Workers & Pages → Create → Pages → Connect to Git → 选本仓库 → Build `npm run build` → Output `dist` → 部署。

| 地址 | 游戏 | 手机 AI |
|------|------|---------|
| `*.pages.dev` | 可以 | 可以（同源 `/ai-proxy`） |
| `github.io` | 可以 | 国内常不行 |
| 电脑 `npm run dev` | 可以 | 本机最稳；手机可连电脑局域网 IP |

> 存档在每人浏览器的 localStorage。AI Key 各自在「设置」里填。

### 方案 B：GitHub Pages（仅试玩流程，AI 受限）

仓库已配置 Actions 发布到 `gh-pages`。适合不依赖 AI 的试玩；要 AI 请用上面的 Cloudflare Pages。

### 方案 C：自己买服务器

仅当你要做 **账号登录 / 云存档 / 自建 AI 代理** 时才需要。现阶段不必买服务器。

## 试玩内容

- 快速模式 / 完整生涯
- 本地事件 + 可选 AI
- 赛前→比赛→赛后→训练；联赛赛程、杯赛、射手/助攻/过人榜
- 合同周薪与生活开销、冬窗/夏窗、绿茵日报
- 国字号集训大名单（入选/落选）
- 自动存档（localStorage）

## 技术栈

Vite · React 19 · TypeScript · Tailwind CSS 4 · Zustand
