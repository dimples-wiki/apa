# FilmStudio — AI 影视创作平台

前后端分离的 AI 影视创作平台。Node.js CLI 启动 Web 服务，浏览器访问使用；monorepo 架构，基于 Vite+ 1.0 统一工具链（`vp` 集成 dev / build / lint / fmt / 任务运行），组件库 shadcn/ui，产品风格对标 Linear.app。

## 结构

```
ai-film-studio/
├── apps/
│   ├── web/       # 前端 SPA：React 19 + Tailwind v4 + shadcn/ui + React Router 7
│   └── server/    # 后端：Hono + Node CLI（bin: filmstudio），托管 API 与前端产物
├── packages/
│   └── shared/    # 前后端共享类型
├── vite.config.ts # Vite+ 根配置（lint / fmt / run 统一管理）
└── pnpm-workspace.yaml
```

## 常用命令

| 命令         | 说明                                                          |
| ------------ | ------------------------------------------------------------- |
| `pnpm dev`   | 并行启动前端 dev server（5173）与后端 API（4310，watch 模式） |
| `pnpm serve` | CLI 启动生产模式 Web 服务（构建产物 + API，端口 4310）        |
| `pnpm build` | 构建全部包                                                    |
| `pnpm check` | lint + 格式检查（`vp check`）                                 |
| `pnpm ready` | 检查 + 全量构建                                               |

CLI 更多用法：`node apps/server/src/cli.ts serve --help`（支持 `--port`、`--host`、`--open`）。

## 开发流程

- **开发模式**：`pnpm dev`，打开 http://localhost:5173（`/api` 自动代理到 4310）。
- **生产模式**：`pnpm build && pnpm serve`，打开 http://127.0.0.1:4310。
- 数据目前为服务端内存 mock；数据模型定义在 `packages/shared/src/index.ts`，前后端共用。

## 页面

- `/projects` 项目列表（卡片 + 状态 + 进度）
- `/actors` 演员卡片库
- `/scenes` 场景库
- `/costumes` 服饰库
- `/settings` 系统设置（深色/浅色切换）

侧边栏支持图标折叠（头部按钮或边缘双击），折叠后悬停图标显示菜单提示。
