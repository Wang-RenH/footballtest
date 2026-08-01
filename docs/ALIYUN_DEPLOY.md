# 阿里云轻量 Ubuntu 部署《绿茵征途》

服务器示例：Ubuntu 22.04 · 公网 IP `39.106.101.56`（以控制台为准）

## 0. 控制台先做

1. 点 **设置密码**，设好 root 密码并记住  
2. 防火墙/安全组放行：**22**、**80**（有 HTTPS 再开 443）  
3. 本机 PowerShell 测试登录：

```bash
ssh root@39.106.101.56
```

能进去再继续。

## 1. 服务器上一键安装 Nginx

在 SSH 里执行：

```bash
apt update
apt install -y nginx
mkdir -p /var/www/football
```

## 2. 写入站点配置

```bash
cat > /etc/nginx/sites-available/football <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/football;
    index index.html;

    # 游戏前端（SPA）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # AI 反代（替代 workers.dev）
    location /ai-proxy/deepseek/ {
        proxy_pass https://api.deepseek.com/;
        proxy_ssl_server_name on;
        proxy_set_header Host api.deepseek.com;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header Content-Type $http_content_type;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
        client_max_body_size 4m;
    }

    location /ai-proxy/mimo/ {
        proxy_pass https://api.xiaomimimo.com/;
        proxy_ssl_server_name on;
        proxy_set_header Host api.xiaomimimo.com;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header api-key $http_api_key;
        proxy_set_header Content-Type $http_content_type;
        proxy_read_timeout 180s;
        client_max_body_size 4m;
    }

    location /ai-proxy/glm/ {
        proxy_pass https://open.bigmodel.cn/;
        proxy_ssl_server_name on;
        proxy_set_header Host open.bigmodel.cn;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header Content-Type $http_content_type;
        proxy_read_timeout 180s;
        client_max_body_size 4m;
    }

    location /ai-proxy/minimax/ {
        proxy_pass https://api.minimaxi.com/;
        proxy_ssl_server_name on;
        proxy_set_header Host api.minimaxi.com;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header Content-Type $http_content_type;
        proxy_read_timeout 180s;
        client_max_body_size 4m;
    }

    location = /ai-proxy/health {
        default_type text/plain;
        return 200 'ok';
    }
}
EOF

ln -sfn /etc/nginx/sites-available/football /etc/nginx/sites-enabled/football
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## 3. 本机打包并上传（在你的 Windows 电脑上）

在项目目录：

```powershell
cd D:\footballl\foootball
npm run build
scp -r dist/* root@39.106.101.56:/var/www/football/
```

若 `scp` 不可用，可用 WinSCP 把 `dist` 里全部文件拖到服务器 `/var/www/football/`。

## 4. 验收

手机/电脑打开：

- 游戏：`http://39.106.101.56/`
- 代理：`http://39.106.101.56/ai-proxy/health` → 应显示 `ok`

然后在游戏设置里填 API Key → 测试连接。

## 5. 以后更新游戏

本机重新 `npm run build`，再执行一次 `scp` 即可。
