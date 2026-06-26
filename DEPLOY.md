# 腾讯云部署方案

本文档用于将 `sgcc-exam-miniapp` 的题库 API 服务部署到腾讯云 Ubuntu 24.04 服务器，并通过 `https://api.synexa.cc` 提供给微信小程序访问。

服务器信息：

- 系统：Ubuntu 24.04
- 配置：4 核 4G
- 公网 IP：`101.35.218.126`
- API 域名：`api.synexa.cc`
- Node 服务端口：`3000`

> 本文档只提供命令和配置，不会自动执行。请在服务器 SSH 终端中按步骤操作。

## 1. 部署前准备

### 1.1 配置 DNS

在域名 DNS 控制台添加记录：

| 类型 | 主机记录 | 记录值 |
| --- | --- | --- |
| A | `api` | `101.35.218.126` |

等待 DNS 生效后，本地验证：

```bash
nslookup api.synexa.cc
```

期望返回包含：

```text
101.35.218.126
```

### 1.2 腾讯云安全组

在腾讯云服务器安全组放行：

| 协议 | 端口 | 用途 |
| --- | --- | --- |
| TCP | 22 | SSH |
| TCP | 80 | HTTP / 申请证书 |
| TCP | 443 | HTTPS |

Node 服务端口 `3000` 不建议对公网开放，只由 Nginx 在本机反向代理访问。

## 2. 登录服务器

```bash
ssh ubuntu@101.35.218.126
```

如果使用 root 用户：

```bash
ssh root@101.35.218.126
```

以下命令默认使用有 `sudo` 权限的普通用户执行。

## 3. 安装基础工具

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl wget git unzip ca-certificates gnupg lsb-release build-essential
```

设置服务器时区：

```bash
sudo timedatectl set-timezone Asia/Shanghai
timedatectl
```

## 4. 安装 Node.js LTS

使用 NodeSource 安装 Node.js LTS。

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

验证版本：

```bash
node -v
npm -v
```

## 5. 安装 PM2

```bash
sudo npm install -g pm2
pm2 -v
```

配置 PM2 开机自启：

```bash
pm2 startup systemd
```

执行命令输出里提示的 `sudo env PATH=... pm2 startup ...` 命令，例如：

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

> 上面只是示例，请以 `pm2 startup systemd` 实际输出为准。

## 6. 上传项目代码

推荐部署目录：

```bash
sudo mkdir -p /var/www/sgcc-exam-miniapp
sudo chown -R $USER:$USER /var/www/sgcc-exam-miniapp
```

### 方式 A：使用 Git

如果项目已经推送到 Git 仓库：

```bash
cd /var/www
git clone <你的仓库地址> sgcc-exam-miniapp
cd /var/www/sgcc-exam-miniapp
```

后续更新：

```bash
cd /var/www/sgcc-exam-miniapp
git pull
```

### 方式 B：使用 SCP 上传

在本地电脑执行：

```bash
scp -r E:/BaiduSyncdisk/AI/sgcc-exam-miniapp ubuntu@101.35.218.126:/var/www/
```

如果 Windows PowerShell 对路径处理不稳定，可先压缩后上传：

```bash
scp sgcc-exam-miniapp.zip ubuntu@101.35.218.126:/var/www/
```

服务器解压：

```bash
cd /var/www
unzip sgcc-exam-miniapp.zip
```

## 7. 安装服务端依赖

```bash
cd /var/www/sgcc-exam-miniapp/server
npm install --omit=dev
```

确认全量题库文件存在：

```bash
ls -lh /var/www/sgcc-exam-miniapp/data/parsed/questions.json
```

## 8. 配置服务端环境变量

创建 `.env`：

```bash
cd /var/www/sgcc-exam-miniapp/server
nano .env
```

写入：

```env
SERVER_PORT=3000
NODE_ENV=production
```

如果后续启用 AI 解析能力，再追加：

```env
AI_PROVIDER=deepseek
AI_FALLBACK_PROVIDER=openai
DEEPSEEK_API_KEY=你的DeepSeekKey
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
OPENAI_API_KEY=你的OpenAIKey
OPENAI_MODEL=gpt-4o-mini
```

当前仅部署题库 API 时，不需要填写 AI Key。

## 9. 本地启动测试 Node 服务

```bash
cd /var/www/sgcc-exam-miniapp/server
npm start
```

新开一个 SSH 窗口测试：

```bash
curl http://127.0.0.1:3000/health
curl "http://127.0.0.1:3000/api/catalog"
curl "http://127.0.0.1:3000/api/stats?major=通信运维检修工&level=初级工"
curl "http://127.0.0.1:3000/api/questions?major=通信运维检修工&level=初级工&type=单选题&limit=2"
```

确认正常后，在运行 `npm start` 的窗口按 `Ctrl+C` 停止服务。

## 10. 使用 PM2 托管 Node 服务

```bash
cd /var/www/sgcc-exam-miniapp/server
pm2 start server.js --name sgcc-exam-api
pm2 save
```

查看状态：

```bash
pm2 status
pm2 logs sgcc-exam-api
```

常用命令：

```bash
pm2 restart sgcc-exam-api
pm2 stop sgcc-exam-api
pm2 delete sgcc-exam-api
pm2 logs sgcc-exam-api --lines 100
```

## 11. 安装 Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx
```

浏览器访问：

```text
http://101.35.218.126
```

能看到 Nginx 默认页面即可。

## 12. 配置 api.synexa.cc 反向代理

创建 Nginx 配置：

```bash
sudo nano /etc/nginx/sites-available/api.synexa.cc
```

写入：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.synexa.cc;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/api.synexa.cc /etc/nginx/sites-enabled/api.synexa.cc
```

可选：删除默认站点：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

检查配置：

```bash
sudo nginx -t
```

重载 Nginx：

```bash
sudo systemctl reload nginx
```

HTTP 测试：

```bash
curl https://api.synexa.cc/health
curl "https://api.synexa.cc/api/questions?major=通信运维检修工&level=初级工&limit=1"
```

## 13. 配置 HTTPS

使用 Let's Encrypt + Certbot。

安装 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
```

申请证书并自动改写 Nginx 配置：

```bash
sudo certbot --nginx -d api.synexa.cc
```

按提示填写邮箱、同意协议，并选择是否将 HTTP 自动跳转 HTTPS。建议选择自动跳转。

验证自动续期：

```bash
sudo certbot renew --dry-run
```

HTTPS 测试：

```bash
curl https://api.synexa.cc/health
curl "https://api.synexa.cc/api/catalog"
```

## 14. 微信小程序适配

### 14.1 小程序代码配置

小程序端 API 地址位于：

```text
miniprogram/utils/config.js
```

应保持为：

```js
const DEFAULT_API_BASE_URL = "https://api.synexa.cc";
```

### 14.2 微信公众平台配置 request 合法域名

进入微信公众平台：

```text
开发管理 -> 开发设置 -> 服务器域名 -> request 合法域名
```

添加：

```text
https://api.synexa.cc
```

注意：

- 必须是 HTTPS。
- 域名不能带路径。
- 证书必须有效且链完整。
- 配置后，微信开发者工具里需要刷新项目配置或重新编译。

### 14.3 微信开发者工具测试

建议先关闭：

```text
详情 -> 本地设置 -> 不校验合法域名、web-view、TLS 版本以及 HTTPS 证书
```

再真机预览测试，确认正式域名在微信环境下可访问。

## 15. 小程序审核说明建议

提交审核时可填写：

```text
本版本为电力职业技能考试题库练习工具。小程序通过 https://api.synexa.cc 获取题库目录、题目列表和题库统计数据，用于提供专业/等级题库选择、题型练习、顺序刷题、随机练习、模拟考试、错题本和收藏功能。当前版本不要求用户登录，不收集姓名、手机号、身份证号等个人身份信息，不接入广告、支付、会员或第三方数据统计服务。答题记录、错题、收藏和考试结果仅保存在用户本机微信小程序本地存储中。
```

## 16. 更新部署流程

以后代码更新后，在服务器执行：

```bash
cd /var/www/sgcc-exam-miniapp
git pull
cd server
npm install --omit=dev
pm2 restart sgcc-exam-api
pm2 logs sgcc-exam-api --lines 50
```

验证：

```bash
curl https://api.synexa.cc/health
curl "https://api.synexa.cc/api/stats?major=通信运维检修工&level=初级工"
```

## 17. 常见问题

### 17.1 curl api.synexa.cc 不通

检查 DNS：

```bash
nslookup api.synexa.cc
```

检查安全组是否放行 80/443。

检查 Nginx 状态：

```bash
sudo systemctl status nginx
sudo nginx -t
```

### 17.2 HTTPS 证书申请失败

确认：

- `api.synexa.cc` 已解析到 `101.35.218.126`
- 腾讯云安全组已放行 80
- Nginx 正在运行

重新执行：

```bash
sudo certbot --nginx -d api.synexa.cc
```

### 17.3 502 Bad Gateway

通常是 Node 服务未运行或端口不对。

```bash
pm2 status
pm2 logs sgcc-exam-api --lines 100
curl http://127.0.0.1:3000/health
```

如果服务没启动：

```bash
cd /var/www/sgcc-exam-miniapp/server
pm2 start server.js --name sgcc-exam-api
pm2 save
```

### 17.4 微信小程序请求失败

检查：

```bash
curl https://api.synexa.cc/health
```

再检查微信公众平台是否添加：

```text
https://api.synexa.cc
```

并确认小程序代码里：

```text
miniprogram/utils/config.js
```

配置的是：

```js
const DEFAULT_API_BASE_URL = "https://api.synexa.cc";
```

### 17.5 题库接口返回慢

当前服务直接读取并缓存 `data/parsed/questions.json`。首次启动会加载全量题库，后续请求走内存缓存。

如果后续访问量变大，建议升级为：

- SQLite / PostgreSQL 存储题库
- 按专业、等级、题型建立索引
- Nginx 开启 gzip
- 增加接口缓存

## 18. 最终验收清单

服务器端：

```bash
curl https://api.synexa.cc/health
curl "https://api.synexa.cc/api/catalog"
curl "https://api.synexa.cc/api/stats?major=通信运维检修工&level=初级工"
curl "https://api.synexa.cc/api/questions?major=通信运维检修工&level=初级工&type=单选题&limit=2"
```

PM2：

```bash
pm2 status
```

Nginx：

```bash
sudo nginx -t
sudo systemctl status nginx
```

HTTPS：

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

微信公众平台：

```text
request 合法域名已添加 https://api.synexa.cc
```

小程序：

```text
首页能加载全量专业/等级
当前题库统计正常
单选题/多选题/判断题卡片能进入对应练习
顺序刷题正常
随机练习正常
模拟考试正常
错题本正常
收藏题目正常
关于我们/隐私说明为联网版文案
```

