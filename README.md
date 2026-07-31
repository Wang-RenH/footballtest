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

## 给别人在线玩（推荐，不必先买服务器）

这是 **Vite 静态前端**，最省事的方式是丢到免费静态托管：

### 方案 A：GitHub + Vercel / Cloudflare Pages（推荐）

1. 把仓库推到 GitHub
2. 用 [Vercel](https://vercel.com) 或 [Cloudflare Pages](https://pages.cloudflare.com) 导入该仓库
3. 构建设置：
   - Root：`foootball`（若仓库根目录就是本项目则留空）
   - Build：`npm run build`
   - Output：`dist`
4. 绑定免费域名后，把链接发给朋友即可打开游玩

> 存档在每人浏览器的 localStorage，互不影响。AI Key 各自在「设置」里填。

### 方案 B：GitHub Pages

```bash
cd foootball
npm run build
```

把 `dist/` 发到 `gh-pages` 分支。若站点不在域名根路径，需在 `vite.config.ts` 设 `base: '/repo/'`。

### 方案 C：自己买服务器

仅当你要做 **账号登录 / 云存档 / 自建 AI 代理** 时才需要：

- 轻量：一台 1核2G + Nginx 托管 `dist/`
- AI 代理：服务器反代 API，避免 CORS 并保管 Key
- 云存档：再加后端或微信云开发接 `StorageAdapter`

**现在阶段不建议先买服务器**；先用 Vercel/Cloudflare 上线试玩即可。

## 试玩内容

- 快速模式 / 完整生涯
- 本地事件 + 可选 AI
- 赛前→比赛→赛后→训练；联赛赛程、杯赛、射手/助攻/过人榜
- 合同周薪与生活开销、冬窗/夏窗、绿茵日报
- 国字号集训大名单（入选/落选）
- 自动存档（localStorage）

## 技术栈

Vite · React 19 · TypeScript · Tailwind CSS 4 · Zustand
