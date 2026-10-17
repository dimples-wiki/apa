# 调研 D：webmcp 范式与 CLI-first 先例（2026-10-17）

## webmcp 架构结论
- **两个标杆**：Playwright MCP（70+ 工具，核心=a11y 树快照+ref 机制：browser_snapshot 返回带 role/name/ref 的文本树，click 用 ref 精确指向；每次工具调用返回新快照=自证闭环；verify_* 断言工具+evaluate 逃生舱）；Chrome DevTools MCP（45+ 工具，take_snapshot 优先于截图；已内置 list_webmcp_tools/execute_webmcp_tool 枚举页面自暴露工具）
- **W3C WebMCP 提案**（Chrome+Edge 团队）：网页 navigator.modelContext.registerTool({name,description,inputSchema,execute}) 直接注册业务工具；比 DOM 爬取省 ~89% token；工具随组件挂载/卸载，能力跟页面语境走
- **APA 技术栈命中**：Hono 官方 @hono/mcp 中间件把 MCP server 以 Streamable HTTP 挂到现有 Hono 应用（/mcp 端点）
- **选型：混合——业务级为主（工具读写与 REST/UI 同一份核心状态），DOM 级兜底（a11y 语义优先+data-testid+evaluate 逃生舱）**
- **APA 工具面设计原则：镜像创作管线语言（split_script/plan_keyframes/generate_frame_image/generate_shot_video/select_model/assemble_episode），不是 UI 菜单语言（click_button_3）**
- 工具类别：状态读取（get_project_state/get_timeline_state/get_generation_queue）、管线操作（资源_动作 命名，一工具=管线状态机动作，幂等）、提示词读写单独成类（一等公民）、校验（validate_durations/check_consistency 自证）、evaluate 逃生舱
- **UI 断言三层**：①语义定位（role/label/text 是真相源，data-testid 仅兜底）②确定性等待（wait_for 文本出现）③受控状态直读（get_timeline_state() 返回即断言——业务级最大红利）；hover/tooltip 这类纯视觉行为才落 DOM 层

## CLI-first 结论
- **Remotion 模式（最成熟范本）**：@remotion/cli 是 @remotion/renderer 的薄壳；renderer 同时被 CLI/Lambda/studio 消费——CLI 与 Web UI 共享同一核心
- revideo：core/2d/renderer/ffmpeg/studio 分包，同一 core 被 studio（web）与 renderer（无头）消费
- ShortGPT：核心引擎与 GUI 分离但缺 CLI=明显短板（反面印证）
- 命名风格：资源-动作（Supabase：apa project new / apa shot generate）适合资源多+子资源嵌套场景；core 保持纯领域逻辑+存储接口，IO 在适配层
- 坑：运行时特定依赖泄漏进共享包；共享包变更迫使全体重建；为某消费者写的逻辑被迫全体继承=域模型腐化起点

## APA 目录/命令设计
packages/core（领域模型+状态存储+管线状态机）/ server（REST+@hono/mcp 挂 /mcp）/ mcp（工具注册+schema）/ cli（commander 薄壳）/ ui（React 走 REST/WS）
命令面：apa dev/serve；apa project new|list、script split、episode plan、keyframe plan|add|regen、shot generate|status|retry、asset import|list、render final；apa status / apa state dump <episodeId>（与 MCP get_timeline_state 同一 core 函数——三端同一真相）

## 来源
playwright.dev/mcp（introduction/tools/interaction/best-practices）、github ChromeDevTools/mcp tool-reference、developer.chrome.com blog、zuplo.com what-is-webmcp、w3c-cg.github.io/aikr/webMCP/webmcp-technical-notes、github MiguelsPizza/WebMCP MCP-B Protocol、jsr.io/@hono/mcp、vercel.com/kb hono-mcp 指南、insforge.dev webmcp 对比、tkdodo.eu test-ids-a11y-smell、remotion.dev/docs/cli+renderer、github midrender/revideo、github RayVentura/ShortGPT、supabase docs cli、docs.strapi.io cli
