import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { type Actor, type Costume, type Project, type Scene } from "@dimples/apa-shared";
import { actors, costumes, projects, scenes } from "./data.ts";

const bundledPublic = fileURLToPath(new URL("./public", import.meta.url));
const devWebDist = fileURLToPath(new URL("../../web/dist", import.meta.url));
const webDist = existsSync(bundledPublic) ? bundledPublic : devWebDist;

export function startServer(opts: { port: number; hostname: string }) {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, service: "apa" }));
  app.get("/api/projects", (c) => c.json(projects));
  app.get("/api/actors", (c) => c.json(actors));
  app.get("/api/scenes", (c) => c.json(scenes));
  app.get("/api/costumes", (c) => c.json(costumes));

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

  // 静态资源长缓存（文件更新随构建产物版本变化）
  app.use("*", async (c, next) => {
    await next();
    if (!c.req.path.startsWith("/api")) {
      c.header("Cache-Control", "public, max-age=604800");
    }
  });

  // 生产模式：托管前端构建产物，其余路径回退到 SPA 入口
  app.use("*", serveStatic({ root: webDist }));
  app.get("*", async (c) => {
    try {
      const html = await readFile(`${webDist}/index.html`, "utf8");
      return c.html(html);
    } catch {
      return c.text("前端产物缺失，请先在 apps/web 执行构建（vp build）", 404);
    }
  });

  serve({ fetch: app.fetch, port: opts.port, hostname: opts.hostname });
}
