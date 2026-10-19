import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { OP_MAP, OPS, type StudioState } from "@dimples/apa-shared";
import { loadOverrides, loadState, mutate, scheduleCompletion } from "./store.ts";
import { runLook } from "./look.ts";

/**
 * 最小 MCP server（streamable HTTP，JSON-RPC 2.0）：
 * - 业务级工具：镜像创作管线（get_state / validate / call_op / pipeline_*）
 * - UI 桥工具：ui_hover / ui_click / ui_query / ui_snapshot（经 WS 转发到浏览器页面执行——
 *   细粒度到"hover 后 tooltip 出现"这类纯视觉行为的断言）
 */

/* ───────────── UI 桥（页面侧 WS 执行器注册） ───────────── */

let bridgeSocket: { send: (s: string) => void } | null = null;
const pendingUiCalls = new Map<
  string,
  { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
>();

export function registerBridgeSocket(sock: { send: (s: string) => void } | null): void {
  bridgeSocket = sock;
}

export function bridgeMessage(msg: { bridgeId?: string; error?: string; result?: unknown }): void {
  if (!msg.bridgeId) return;
  const p = pendingUiCalls.get(msg.bridgeId);
  if (!p) return;
  clearTimeout(p.timer);
  pendingUiCalls.delete(msg.bridgeId);
  if (msg.error) p.reject(new Error(msg.error));
  else p.resolve(msg.result);
}

async function callUi(tool: string, args: Record<string, unknown>, timeoutMs = 8000): Promise<unknown> {
  if (!bridgeSocket) throw new Error("UI 桥未连接——先在浏览器打开 APA 工作台页面");
  const id = randomUUID();
  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingUiCalls.delete(id);
      reject(new Error(`ui 调用超时（${timeoutMs}ms）`));
    }, timeoutMs);
    pendingUiCalls.set(id, { resolve, reject, timer });
  });
  bridgeSocket.send(JSON.stringify({ bridgeId: id, tool, args }));
  return promise;
}

/* ───────────── 工具实现 ───────────── */

function stateSummary(state: StudioState, episodeId?: string) {
  const e = episodeId
    ? state.episodes.find((x) => x.id === episodeId || String(x.number) === episodeId)
    : state.episodes[0];
  if (!e) return { error: `episode ${episodeId} 不存在` };
  return {
    project: state.project,
    episode: {
      id: e.id,
      number: e.number,
      title: e.title,
      keyframes: e.keyframes.map((k) => ({
        id: k.id,
        code: k.code,
        beat: k.beatId,
        status: k.status,
        shotSize: k.shotSize,
        picked: k.pickedVariantId ?? null,
        candidates: k.variants.length,
        prompt: k.imagePrompt.slice(0, 60),
      })),
      segments: e.segments.map((s) => ({
        id: s.id,
        code: s.code,
        from: s.fromKeyframeId,
        status: s.status,
        promptStale: s.promptStale ?? false,
        model: s.modelId,
        duration: s.duration,
        billed: s.billedAttempts,
        failed: s.failedAttempts,
        cost: s.cost ?? 0,
        attributed: s.attributedFailure ?? null,
      })),
    },
  };
}

const UI_TOOLS = [
  {
    name: "ui_hover",
    description: "悬停页面元素（CSS 选择器），触发 hover 态（如 tooltip）",
    inputSchema: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] },
  },
  {
    name: "ui_click",
    description: "点击页面元素（CSS 选择器）",
    inputSchema: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] },
  },
  {
    name: "ui_query",
    description:
      "查询页面元素状态：{visible, text, classes, attrs}。用于断言 hover 后 tooltip 是否出现等纯视觉行为",
    inputSchema: {
      type: "object",
      properties: { selector: { type: "string" } },
      required: ["selector"],
    },
  },
  {
    name: "ui_snapshot",
    description: "页面语义快照：全部可交互元素的 role/label/selector 列表（agent 定位入口）",
    inputSchema: { type: "object", properties: {} },
  },
];

export function buildMcpApp(): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const rpc = await c.req.json<{
      id?: unknown;
      method: string;
      params?: Record<string, unknown>;
    }>();

    const respond = (result: unknown) => c.json({ jsonrpc: "2.0", id: rpc.id ?? null, result });
    const rpcError = (code: number, message: string) =>
      c.json({ jsonrpc: "2.0", id: rpc.id ?? null, error: { code, message } });

    if (rpc.method === "initialize") {
      return respond({
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "apa-studio", version: "0.1.0" },
      });
    }

    if (rpc.method === "tools/list") {
      const businessTools = [
        {
          name: "get_state",
          description:
            "读取工作台状态摘要（项目/集/关键帧/演绎段全量——agent 的感知层，返回即断言）",
          inputSchema: {
            type: "object",
            properties: { episodeId: { type: "string", description: "集 id 或集号，缺省取第一集" } },
          },
        },
        {
          name: "list_ops",
          description: "列出全部管线 ops（名称/描述/参数——call_op 的可调用面）",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "call_op",
          description:
            "执行一个管线 op（与 CLI `apa op` / 页面按钮完全同构）。generate 类支持 delayMs 异步完成模拟",
          inputSchema: {
            type: "object",
            properties: {
              op: { type: "string" },
              args: { type: "object", additionalProperties: true },
            },
            required: ["op"],
          },
        },
        {
          name: "validate",
          description: "管线不变式校验报告（8 项：档位/首帧/归因/待重写/备案/钩子/预算/时长差）",
          inputSchema: {
            type: "object",
            properties: { episodeId: { type: "string" } },
          },
        },
        {
          name: "look",
          description:
            "apa look——确定性审片自检（档位/台词估时/节拍覆盖/人的覆写 shadow 与 locks）。agent 生成后必跑",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "get_overrides",
          description:
            "读取人的覆写层：shadows（人在 UI 最近改过的字段——改同字段前先读）与 locks（人锁定的实体，你改会被拒）",
          inputSchema: { type: "object", properties: {} },
        },
        ...UI_TOOLS,
      ];
      return respond({ tools: businessTools });
    }

    if (rpc.method === "tools/call") {
      const name = String(rpc.params?.name ?? "");
      const args = (rpc.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        let result: unknown;
        switch (name) {
          case "get_state":
            result = stateSummary(loadState(), args.episodeId as string | undefined);
            break;
          case "list_ops":
            result = OPS.map((o) => ({
              name: o.name,
              description: o.description,
              args: o.args,
            }));
            break;
          case "call_op": {
            const op = String(args.op ?? "");
            if (!OP_MAP.has(op)) return rpcError(-32602, `未知 op：${op}`);
            const opArgs = (args.args ?? {}) as Record<string, unknown>;
            const { result: opResult, state } = mutate(op, opArgs, "agent");
            scheduleCompletion(op, opArgs);
            result = {
              note: (opResult as { note?: string })?.note,
              blocked: (opResult as { blocked?: string })?.blocked,
              plan: (opResult as { plan?: string[] })?.plan,
              manifest: (opResult as { manifest?: unknown })?.manifest,
              stateSummary: stateSummary(state, opArgs.episodeId as string | undefined),
            };
            break;
          }
          case "validate": {
            const { result: r } = mutate("studio.validate", args, "agent");
            result = (r as { manifest?: unknown })?.manifest;
            break;
          }
          case "look": {
            result = runLook();
            break;
          }
          case "get_overrides": {
            result = loadOverrides();
            break;
          }
          case "ui_hover":
          case "ui_click":
          case "ui_query":
          case "ui_snapshot":
            result = await callUi(name, args);
            break;
          default:
            return rpcError(-32602, `未知工具：${name}`);
        }
        return respond({
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (e) {
        return respond({
          content: [{ type: "text", text: `错误：${(e as Error).message}` }],
          isError: true,
        });
      }
    }

    if (rpc.method === "notifications/initialized") return c.json({ jsonrpc: "2.0", id: null, result: {} });

    return rpcError(-32601, `未知方法：${rpc.method}`);
  });

  return app;
}
