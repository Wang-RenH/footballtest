#!/bin/bash
# 在服务器上执行：bash install-football.sh
set -euo pipefail

apt update
apt install -y nginx
mkdir -p /var/www/football

cat > /etc/nginx/sites-available/football <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/football;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

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

# 系统防火墙（若启用 ufw）
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
fi

nginx -t
systemctl enable nginx
systemctl restart nginx

echo "OK: nginx ready. Upload dist to /var/www/football/"
echo "Health: curl -s http://127.0.0.1/ai-proxy/health"
