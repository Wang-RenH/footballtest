# 绿茵征途 · 单机试玩版

文字驱动的中国球员生涯模拟器。数据存在浏览器本地；可选 AI 叙事。

## 本地开发

```bash
cd foootball
npm install
npm run dev
```

打开 `http://localhost:5173`。Windows PowerShell 若禁止脚本，用 `npm.cmd run dev`。

手机同网可访问电脑局域网 IP（如 `http://192.168.x.x:5173`），AI 走本机 Vite 代理。

```bash
npm run build     # 产出 dist/（给服务器用，base 为 /）
npm run preview
```

## 线上部署（阿里云轻量 + Nginx）★ 推荐

国内手机要稳定用 AI，请用自建服务器，**不要用** GitHub Pages / Cloudflare workers.dev。

完整步骤：[docs/ALIYUN_DEPLOY.md](./docs/ALIYUN_DEPLOY.md)

当前示例地址（以你控制台 IP 为准）：

- 游戏：`http://39.106.101.56/`
- 代理自检：`http://39.106.101.56/ai-proxy/health` → `ok`

更新发布（本机）：

```powershell
cd D:\footballl\foootball
npm.cmd run build
scp -r dist/* root@你的公网IP:/var/www/football/
```

服务器首次安装脚本：`scripts/install-football.sh`

> 存档在每人浏览器的 localStorage。AI Key 在「设置」里各自填写，只存本机。

## 试玩内容

- 快速模式 / 完整生涯
- 本地事件 + 可选 AI
- 赛前→比赛→赛后→训练；联赛赛程、杯赛、射手/助攻/过人榜
- 合同周薪与生活开销、冬窗/夏窗、绿茵日报
- 国字号集训大名单（入选/落选）
- 自动存档（localStorage）

## 技术栈

Vite · React 19 · TypeScript · Tailwind CSS 4 · Zustand
