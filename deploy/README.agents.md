# 华清智言 design：内置 Agent 的服务器镜像

面向 Linux x86_64 / AMD64，从当前工作区构建，保留定制界面与 DashScope 接入。
镜像包含 OpenDesign 0.21.1 的当前代码、DeepSeek Harness 0.1.1-rc.2、
OpenDesign 连接组件、CodeWhale（原 DeepSeek TUI）0.10.1，以及 Hermes 0.21.6。
这些是客户端和运行环境，模型通过供应商 API 调用；API Key、登录凭据及个人项目不在镜像内。
定制镜像默认设置 `OD_WHATS_NEW_ENABLED=0`，不拉取或显示官方更新宣传弹窗。
图片、语音和视频沿用应用里的动态媒体配置。Harness 连接组件按任务透传临时工具令牌，
无需把服务商、模型、Key 或工具令牌写入镜像。

## 在新机器启动

准备 Docker Engine 与 Docker Compose v2，建议至少 4 核、8 GB 内存，预留 25 GB 磁盘。
把整个交付目录复制到服务器，在该目录执行：

```bash
sha256sum -c SHA256SUMS
docker load -i hqzy-open-design-0.21.1-agents-20261010-r4-amd64.tar.gz
cd deploy
cp agents.env.example .env
openssl rand -hex 32
```

将生成的随机值填入 `.env` 的 `OD_API_TOKEN`，然后执行：

```bash
docker compose -f docker-compose.agents.yml up -d
docker compose -f docker-compose.agents.yml ps
docker compose -f docker-compose.agents.yml logs --tail=80 open-design
```

服务默认只监听服务器本机。远程访问可在自己的电脑执行 SSH 转发（替换服务器地址）：

```bash
ssh -L 7456:127.0.0.1:7456 -L 3080:127.0.0.1:3080 user@server
```

打开 `http://localhost:7456`，浏览器认证用户名为 `hqzy-design`，密码为 `OD_API_TOKEN`。用户名可通过 `.env` 中的 `OD_API_BASIC_USERNAME` 修改，修改后重新执行 `docker compose -f docker-compose.agents.yml up -d`。
域名访问请使用带 HTTPS 的反向代理，并设置 `OPEN_DESIGN_ALLOWED_ORIGINS` 为实际浏览器来源。

## 配置模型

- **Qwen 云模型（沿用本地 Harness 流程）**：使用 DeepSeek Harness 的 DashScope 模型配置，在应用中选择本地 Agent → DeepSeek Harness → 对应 Qwen 模型。迁移本地实例时需同时迁移 Harness 的模型设置和凭据；仅导入镜像不会带入这些配置。无须额外安装 Qwen Code。
- **DeepSeek TUI / CodeWhale**：可在 `.env` 中设置 `DEEPSEEK_API_KEY`，修改后重新运行 `docker compose ... up -d`。
- **Hermes**：使用下方交互式模型设置；也可在 `.env` 中提供所选供应商支持的 Key。

```bash
docker compose -f docker-compose.agents.yml exec open-design \
  node deploy/agents/entrypoint.ts hermes model
```

DeepSeek Harness 的 Key 在其自己的设置页配置。连接组件已预装。在目标 Linux 服务器上临时启动配置页面：

```bash
docker compose -f docker-compose.agents.yml run --rm dsh-setup
```

此配置服务使用 Linux 主机网络，只绑定服务器的 `127.0.0.1`，并与应用共享持久卷。
通过前面的 SSH 转发打开 `http://localhost:3080`，在模型设置中保存 Key，完成后按 Ctrl+C 关闭。
随后回到 OpenDesign 的本地 Agent 设置，重新扫描并测试相应 Agent。
没有 Key 时，程序安装检查可以通过，实际生成仍需完成供应商认证。

## 数据和升级

数据规则以根目录 [AGENTS.md 的 Daemon data directory contract](../AGENTS.md#daemon-data-directory-contract) 为准。
Compose 的持久卷保存项目、应用设置和 Agent 配置；镜像更新不应清空此卷。
迁移已有环境时需要单独备份并迁移数据，镜像导出不会包含运行数据。
不要执行 `docker compose down -v`，除非确实要删除该部署的数据。

导入后续镜像、修改 `.env` 的 `OPEN_DESIGN_IMAGE`，再运行 `up -d` 即可重建容器。
本包不会自动替换镜像或升级 Agent。Hermes 内的桌面、独立仪表盘与消息网关不随 OpenDesign 启动。
本包运行 OpenDesign 服务器网页版，不启动 Electron；桌面专属的原生幻灯片渲染能力不包含在内。

## 从源码重新构建

在仓库根目录执行：

```bash
docker buildx build --platform linux/amd64 \
  -f deploy/Dockerfile.agents \
  -t hqzy-open-design:0.21.1-agents-20261010-r4-amd64 --load .
```

构建需要联网下载固定版本的依赖。`Dockerfile.agents.dockerignore` 单独限制构建上下文，
排除 `.env`、本机运行数据、缓存和已有构建输出。构建代理可以用 Docker 的
`HTTP_PROXY` / `HTTPS_PROXY` build args 提供，不会保存为容器运行环境。
前后端的 JavaScript 和静态页面使用构建机器的原生架构编译，最终运行依赖按
`--platform linux/amd64` 安装，因此也可以在 Apple Silicon 上构建此服务器镜像。

## 第三方来源

- [OpenDesign](https://github.com/nexu-io/open-design)：Apache-2.0；本地定制构建。
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)：MIT；使用本仓库验证的 0.1.1-rc.2。
- [CodeWhale](https://github.com/codewhale-hq/CodeWhale/releases/tag/v0.10.1)：MIT；官方 Linux x64 二进制并校验 SHA-256。
- [Hermes Agent](https://github.com/NousResearch/hermes-agent/releases/tag/v0.21.6)：MIT；官方运行镜像固定多架构摘要。

第三方依赖仍适用各自许可证；Hermes 和 npm 包保留其发布物中的许可证及声明。
