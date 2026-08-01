# 阿里云轻量 Ubuntu 部署《绿茵征途》

公网 IP 以控制台为准（示例：`39.106.101.56`）。系统：Ubuntu 22.04。

## 0. 控制台

1. **设置密码**（root）并可选重启一次  
2. **防火墙**放行 TCP `22`、`80`（来源 `0.0.0.0/0`）  
3. 用「远程连接」或本机：`ssh root@你的IP`

## 1. 服务器安装 Nginx + 反代

远程终端执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Wang-RenH/footballtest/main/scripts/install-football.sh | bash
```

或：

```bash
apt update && apt install -y nginx git
git clone --depth 1 https://github.com/Wang-RenH/footballtest.git /tmp/footballtest
bash /tmp/footballtest/scripts/install-football.sh
```

看到 `OK: nginx ready` 即可。

## 2. 本机上传前端

```powershell
cd D:\footballl\foootball
npm.cmd run build
scp -r dist/* root@你的IP:/var/www/football/
```

密码输入时屏幕不显示字符，输完回车。  
**不要**设置环境变量 `GITHUB_PAGES=true`（那会打出错误的 `/footballtest/` 路径）。

## 3. 验收

- `http://你的IP/ai-proxy/health` → `ok`  
- `http://你的IP/` → 游戏首页（可强制刷新）  
- 设置里填 API Key → 测试连接  

## 4. 以后更新

重复第 2 步 `build` + `scp` 即可。
