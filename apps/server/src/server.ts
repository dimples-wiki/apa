import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { WebSocketServer } from "ws";
import { Hono } from "hono";
import { type Actor, type Costume, type Project, type Scene } from "@dimples/apa-shared";
import { actors, costumes, projects, scenes } from "./data.ts";
import { loadState, loadOverrides, mutate, scheduleCompletion, toggleLock, writeManual } from "./store.ts";
import { runLook } from "./look.ts";
import { bridgeMessage, buildMcpApp, registerBridgeSocket } from "./mcp.ts";

// monorepo 开发态优先用 apps/web/dist（最新构建）；npm 发布包内无该目录时回落打包快照
const devWebDist = fileURLToPath(new URL("../../web/dist", import.meta.url));
const bundledPublic = fileURLToPath(new URL("./public", import.meta.url));
const webDist = existsSync(devWebDist) ? devWebDist : bundledPublic;

export function startServer(opts: { port: number; hostname: string }) {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, service: "apa" }));
  app.get("/api/projects", (c) => c.json(projects));
  app.get("/api/actors", (c) => c.json(actors));
  app.get("/api/scenes", (c) => c.json(scenes));
  app.get("/api/costumes", (c) => c.json(costumes));

  // ── 工作台 studio API：片协议单一真源（UI by=ui；agent 走 CLI/MCP by=agent 受 locks 守卫）──
  app.get("/api/studio/state", (c) => c.json(loadState()));
  app.post("/api/studio/op", async (c) => {
    const body = await c.req.json<{
      op: string;
      args?: Record<string, unknown>;
      by?: "ui" | "agent";
    }>();
    if (!body.op) return c.json({ error: "op 必填" }, 400);
    try {
      const { result, state } = mutate(body.op, body.args ?? {}, body.by ?? "ui");
      scheduleCompletion(body.op, body.args ?? {});
      return c.json({ ok: true, result: result ?? null, state });
    } catch (e) {
      return c.json({ ok: false, error: (e as Error).message }, 422);
    }
  });
  app.get("/api/studio/overrides", (c) => c.json(loadOverrides()));
  app.post("/api/studio/lock", async (c) => {
    const b = await c.req.json<{ entity: string; locked: boolean }>();
    if (!b.entity) return c.json({ error: "entity 必填" }, 400);
    toggleLock(b.entity, Boolean(b.locked));
    return c.json({ ok: true, overrides: loadOverrides() });
  });
  app.get("/api/studio/look", (c) => {
    try {
      return c.json({ ok: true, report: runLook() });
    } catch (e) {
      return c.json({ ok: false, error: (e as Error).message }, 500);
    }
  });
  app.get("/api/studio/manual", (c) => c.text(writeManual()));

  // ── MCP（streamable HTTP）：业务级工具 + UI 桥工具 ──
  app.route("/mcp", buildMcpApp());

  // ── UI 桥：页面加载时 WS 注册执行器，MCP ui_* 工具经此转发到页面执行 ──

  // —— 创建（内存 store，重启即回演示数据）——
  const seq = (prefix: string, existing: { id: string }[]) => {
    const max = existing.reduce((acc, x) => {
      const n = Number.parseInt(x.id.replace(prefix, ""), 10);
      return Number.isNaN(n) ? acc : Math.max(acc, n);
    }, 0);
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
  };

  app.post("/api/projects", async (c) => {
    const b = await c.req.json<Partial<Project>>();
    if (!b.name?.trim()) return c.json({ error: "name 必填" }, 400);
    const project: Project = {
      id: seq("p-", projects),
      cover: b.cover || undefined,
      name: b.name.trim(),
      logline: b.logline?.trim() || "",
      genre: b.genre?.trim() || "未分类",
      status: b.status ?? "planning",
      progress: 0,
      members: b.members ?? [],
      updatedAt: new Date().toISOString(),
    };
    projects.push(project);
    return c.json(project, 201);
  });

  app.post("/api/actors", async (c) => {
    const b = await c.req.json<Partial<Actor>>();
    if (!b.name?.trim()) return c.json({ error: "name 必填" }, 400);
    const actor: Actor = {
      id: seq("a-", actors),
      avatar: b.avatar || undefined,
      name: b.name.trim(),
      persona: b.persona?.trim() || "",
      accent: b.accent || "indigo",
      tags: b.tags ?? [],
      projectCount: 0,
      createdAt: new Date().toISOString(),
    };
    actors.push(actor);
    return c.json(actor, 201);
  });

  app.post("/api/scenes", async (c) => {
    const b = await c.req.json<Partial<Scene>>();
    if (!b.name?.trim()) return c.json({ error: "name 必填" }, 400);
    const scene: Scene = {
      id: seq("s-", scenes),
      name: b.name.trim(),
      description: b.description?.trim() || "",
      timeOfDay: b.timeOfDay?.trim() || "日",
      tags: b.tags ?? [],
      projectName: b.projectName?.trim() || "未关联",
      createdAt: new Date().toISOString(),
    };
    scenes.push(scene);
    return c.json(scene, 201);
  });

  app.post("/api/costumes", async (c) => {
    const b = await c.req.json<Partial<Costume>>();
    if (!b.name?.trim()) return c.json({ error: "name 必填" }, 400);
    const costume: Costume = {
      id: seq("c-", costumes),
      name: b.name.trim(),
      description: b.description?.trim() || "",
      era: b.era?.trim() || "当代",
      tags: b.tags ?? [],
      createdAt: new Date().toISOString(),
    };
    costumes.push(costume);
    return c.json(costume, 201);
  });

  // 缓存策略：带 hash 的 assets 长缓存；index.html 不缓存（保证发布后立即生效）
  app.use("*", async (c, next) => {
    await next();
    if (!c.req.path.startsWith("/api")) {
      if (c.req.path === "/" || c.req.path.endsWith(".html")) {
        c.header("Cache-Control", "no-cache");
      } else {
        c.header("Cache-Control", "public, max-age=604800");
      }
    }
  });

  // 生产模式：托管前端构建产物，其余路径回退到 SPA 入口
  app.use("*", serveStatic({ root: webDist }));
  app.get("*", async (c) => {
    try {
      const html = await readFile(`${webDist}/index.html`, "utf8");
      // SPA fallback 的 HTML 同样必须 no-cache——否则发新版后深链路由缓存旧 HTML 引已替换的资源
      c.header("Cache-Control", "no-cache");
      return c.html(html);
    } catch {
      return c.text("前端产物缺失，请先在 apps/web 执行构建（vp build）", 404);
    }
  });

  const server = serve({ fetch: app.fetch, port: opts.port, hostname: opts.hostname });

  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws) => {
    registerBridgeSocket({ send: (s) => ws.send(s) });
    ws.on("message", (data) => {
      try {
        bridgeMessage(JSON.parse(String(data)));
      } catch {
        // 忽略非 JSON 帧
      }
    });
    ws.on("close", () => registerBridgeSocket(null));
  });
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/ws/ui-bridge")) {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    } else {
      socket.destroy();
    }
  });
}
