import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { actors, costumes, projects, scenes } from "./data.ts";

import { existsSync } from "node:fs";

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
