import { executeUiTool, findEl } from "@/lib/ui-executor";

/**
 * Chrome WebMCP（navigator.modelContext）：页面级工具注册。
 * - 注册后在 DevTools → Application → WebMCP 面板可见，浏览器 agent（Gemini Nano / DevTools agent）可直接调用
 * - 工具面事无巨细：业务 op（与 CLI/MCP 同一 store）、页面导航、实体选择、批量动作、纯 UI 交互（hover/click/query）
 * - navigator.modelContext 不可用时兜底挂 window.__apaWebMcp（同样可编程调用）
 */

type Json = Record<string, unknown>;
type Tool = {
  name: string;
  description: string;
  inputSchema?: object;
  execute: (args: Json) => Promise<unknown> | unknown;
};

const commands = new Map<string, (args: Json) => unknown>();

/** 页面级命令注册（project-studio 挂载时把 React 状态操作注册进来） */
export function registerCommand(name: string, fn: (args: Json) => unknown): void {
  commands.set(name, fn);
}

export function hasCommand(name: string): boolean {
  return commands.has(name);
}

async function apiOp(op: string, args: Json = {}): Promise<unknown> {
  const res = await fetch("/api/studio/op", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op, args }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error ?? `op ${op} 失败`);
  return body?.result ?? { ok: true };
}

async function apiState(): Promise<unknown> {
  const res = await fetch("/api/studio/state");
  const s = await res.json();
  const e = s.episodes?.[0];
  return {
    project: s.project,
    episode: e
      ? {
          id: e.id,
          number: e.number,
          title: e.title,
          keyframes: e.keyframes.map((k: Record<string, unknown>) => ({
            id: k.id, code: k.code, status: k.status, candidates: (k.variants as unknown[])?.length ?? 0,
          })),
          segments: e.segments.map((sg: Record<string, unknown>) => ({
            id: sg.id, code: sg.code, status: sg.status, stale: sg.promptStale ?? false,
            duration: sg.duration, billed: sg.billedAttempts, failed: sg.failedAttempts,
          })),
        }
      : null,
  };
}

function runCommand(name: string, args: Json): unknown {
  const fn = commands.get(name);
  if (!fn) throw new Error(`命令 ${name} 不可用（当前模式未注册）`);
  return fn(args);
}

/** selector 解析与 UI 执行复用 use-ui-bridge 的实现（text= 精确优先） */
function ui(tool: string, args: Json): unknown {
  return executeUiTool(tool, String(args.selector ?? ""));
}

function buildTools(): Tool[] {
  return [
    // ── 感知 ──
    { name: "apa_get_state", description: "读取工作台 store 状态摘要（项目/集/关键帧/演绎段——返回即断言）", execute: () => apiState() },
    { name: "apa_validate", description: "管线不变式校验报告（8 项：档位/首帧/归因/待重写/备案/钩子/预算/时长差）", execute: () => apiOp("studio.validate", {}) },
    { name: "apa_list_ops", description: "列出全部管线 ops（与 CLI apa op / MCP call_op 同一注册表）", execute: async () => {
        const res = await fetch("/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method: "tools/list", params: {} }) });
        return (await res.json()).result?.tools?.map((t: { name: string }) => t.name);
      } },
    { name: "apa_get_ui_state", description: "当前页面 UI 状态：模式/活跃集/选中关键帧/演绎段/抽屉开关", execute: () => runCommand("ui_state", {}) },
    { name: "apa_snapshot", description: "页面语义快照：全部可交互元素（tag/label/text）——agent 定位入口", execute: () => ui("ui_snapshot", {}) },
    { name: "apa_query", description: "查询元素状态 {exists,visible,text,classes}（断言 hover 后 tooltip 是否出现等纯视觉行为）", inputSchema: { type: "object", properties: { selector: { type: "string", description: "text=xxx 或 CSS 选择器" } }, required: ["selector"] }, execute: (a) => ui("ui_query", a) },

    // ── 通用业务 op ──
    { name: "apa_op", description: "执行任意管线 op（资源_动作命名，与 CLI apa op / MCP call_op 同构）。generate 类支持 delayMs/hold", inputSchema: { type: "object", properties: { op: { type: "string" }, args: { type: "object" } }, required: ["op"] }, execute: (a) => apiOp(String(a.op), (a.args as Json) ?? {}) },

    // ── 一键管线 ──
    { name: "apa_pipeline_plan", description: "一键·计划预审：剧本→节拍→关键帧骨架→段切分，输出可审计划", execute: () => apiOp("pipeline.plan", {}) },
    { name: "apa_pipeline_execute_keyframes", description: "一键·批量生成静帧（闸门内建）", execute: () => apiOp("pipeline.execute", { stage: "keyframes", sync: true }) },
    { name: "apa_pipeline_execute_videos", description: "一键·批量生成视频（闸门内建，未定稿返回 blocked）", execute: () => apiOp("pipeline.execute", { stage: "videos", sync: true }) },
    { name: "apa_pipeline_finalize", description: "一键·粗剪清单（picked 变体按时间线导出规范命名 JSON）", execute: () => apiOp("pipeline.finalize", {}) },

    // ── 页面导航与选择 ──
    { name: "apa_navigate", description: "切换工作台模式：shotlist 制作清单 | canvas 管线画布 | preview 拼装预览 | plan 剧本规划 | insight 质检素材", inputSchema: { type: "object", properties: { mode: { type: "string" } }, required: ["mode"] }, execute: (a) => runCommand("navigate", a) },
    { name: "apa_select_episode", description: "切换集（序号从 1 开始）", inputSchema: { type: "object", properties: { index: { type: "number" } }, required: ["index"] }, execute: (a) => runCommand("select_episode", a) },
    { name: "apa_select_keyframe", description: "选中关键帧（id 如 kf-001 或 code 如 KF-01）并打开候选池", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }, execute: (a) => runCommand("select_keyframe", a) },
    { name: "apa_select_segment", description: "选中演绎段（id 如 seg-001 或 code 如 SEG-01）并打开候选池", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }, execute: (a) => runCommand("select_segment", a) },

    // ── 关键帧/段操作（细粒度） ──
    { name: "apa_keyframe_generate", description: "生成关键帧静帧（delayMs=1300 异步完成）", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }, execute: (a) => runCommand("keyframe_generate", a) },
    { name: "apa_keyframe_pick", description: "采纳关键帧候选为定稿（下游 ready 段自动置 stale）", inputSchema: { type: "object", properties: { id: { type: "string" }, variantId: { type: "string" } }, required: ["id", "variantId"] }, execute: (a) => runCommand("keyframe_pick", a) },
    { name: "apa_keyframe_reject", description: "淘汰关键帧候选（强制失败归因）", inputSchema: { type: "object", properties: { id: { type: "string" }, variantId: { type: "string" }, reason: { type: "string" } }, required: ["id", "variantId", "reason"] }, execute: (a) => runCommand("keyframe_reject", a) },
    { name: "apa_keyframe_insert", description: "在某帧后插入 N 个关键帧（段时长按模型档位重切、原段置待重写）", inputSchema: { type: "object", properties: { afterId: { type: "string" }, n: { type: "number" } }, required: ["afterId", "n"] }, execute: (a) => runCommand("keyframe_insert", a) },
    { name: "apa_segment_generate", description: "图生视频（两阶段闸门：首帧定稿+提示词未过期+预算内）", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] }, execute: (a) => runCommand("segment_generate", a) },
    { name: "apa_segment_attribute", description: "失败归因（failed 段归因后才可批量重试）", inputSchema: { type: "object", properties: { id: { type: "string" }, mode: { type: "string" } }, required: ["id", "mode"] }, execute: (a) => runCommand("segment_attribute", a) },
    { name: "apa_batch_generate_keyframes", description: "批量生成全部待生成帧", execute: () => runCommand("batch_generate_keyframes", {}) },
    { name: "apa_batch_generate_segments", description: "批量生成视频（闸门内建）", execute: () => runCommand("batch_generate_segments", {}) },
    { name: "apa_batch_retry", description: "批量重试已归因的失败/待重制段", execute: () => runCommand("batch_retry", {}) },

    // ── 撤销/候选池 ──
    { name: "apa_undo", description: "撤销上一步（与页面撤销按钮同源）", execute: () => runCommand("undo", {}) },
    { name: "apa_redo", description: "重做", execute: () => runCommand("redo", {}) },
    { name: "apa_open_candidates", description: "打开当前选中实体的候选池抽屉", execute: () => runCommand("open_candidates", {}) },
    { name: "apa_close_drawer", description: "关闭抽屉", execute: () => runCommand("close_drawer", {}) },

    // ── 纯 UI 交互（hover/click 级断言） ──
    { name: "apa_hover", description: "悬停元素触发 hover 态（Radix tooltip 等）；配合 apa_query 断言出现", inputSchema: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] }, execute: async (a) => {
        const r = ui("ui_hover", a);
        await new Promise((res) => setTimeout(res, 450));
        return r;
      } },
    { name: "apa_click", description: "点击元素（text= 精确优先匹配可交互元素）", inputSchema: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] }, execute: (a) => ui("ui_click", a) },
  ];
}

let initialized = false;

/** 在工作台页面 mount 时调用一次 */
export function initWebMcp(): void {
  if (initialized) return;
  initialized = true;

  const tools = buildTools();
  const mc = (navigator as unknown as { modelContext?: { registerTool: (t: unknown) => void } })
    .modelContext;

  let registered = 0;
  if (mc?.registerTool) {
    for (const t of tools) {
      try {
        mc.registerTool({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema ?? { type: "object", properties: {} },
          execute: (args: Json) => t.execute(args ?? {}),
        });
        registered += 1;
      } catch (e) {
        console.warn(`[apa][WebMCP] 注册失败 ${t.name}:`, (e as Error).message);
      }
    }
  }

  // 兜底：无论 Chrome WebMCP 是否可用，都挂 window.__apaWebMcp（可编程调用同一工具面）
  (window as unknown as Record<string, unknown>).__apaWebMcp = {
    available: Boolean(mc?.registerTool),
    tools: Object.fromEntries(tools.map((t) => [t.name, t.description])),
    async call(name: string, args: Json = {}) {
      const t = tools.find((x) => x.name === name);
      if (!t) throw new Error(`未知工具：${name}（可用：${tools.map((x) => x.name).join(", ")}）`);
      return t.execute(args);
    },
    findEl,
  };

  console.info(
    `[apa] WebMCP：${registered}/${tools.length} 个工具已注册到 navigator.modelContext` +
      (mc?.registerTool
        ? "——DevTools → Application → WebMCP 可见"
        : "（此浏览器无 navigator.modelContext：Chrome 需 146+ 或 chrome://flags/#webmcp 启用；已挂 window.__apaWebMcp 兜底）"),
  );
}
