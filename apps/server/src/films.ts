import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * OpenFilm 发行层：APA = 影片库管理 + 素材分类 + 内嵌 OpenFilm Studio。
 * 每部片 = 一个 OpenFilm 项目文件夹（film.html 即协议）；Studio 由 openfilm 官方 CLI 拉起。
 */

const filmsRoot = () => resolve(process.env.APA_FILMS || join(process.cwd(), "apa-films"));
const registryPath = () => resolve(process.env.APA_FILMS_REGISTRY || join(filmsRoot(), ".registry.json"));

interface RegistryEntry {
  studioUrl: string;
  pid: number;
  startedAt: string;
}
let registry: Record<string, RegistryEntry> = existsSync(registryPath())
  ? JSON.parse(readFileSync(registryPath(), "utf8"))
  : {};

function saveRegistry(): void {
  mkdirSync(filmsRoot(), { recursive: true });
  writeFileSync(registryPath(), JSON.stringify(registry, null, 2));
}

let openfilmBin: string | null = null;
function bin(): string {
  if (openfilmBin) return openfilmBin;
  const local = join(process.cwd(), "node_modules", ".bin", "openfilm");
  const serverLocal = join(process.cwd(), "apps", "server", "node_modules", ".bin", "openfilm");
  for (const p of [serverLocal, local]) {
    if (existsSync(p)) return (openfilmBin = p);
  }
  return (openfilmBin = "openfilm");
}

const processes = new Map<string, ChildProcess>();

export interface FilmInfo {
  name: string;
  dir: string;
  hasFilm: boolean;
  assetCount: number;
  updatedAt: string;
  studioUrl: string | null;
  running: boolean;
}

export function listFilms(): FilmInfo[] {
  const root = filmsRoot();
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => {
      const dir = join(root, d.name);
      const hasFilm = existsSync(join(dir, "film.html"));
      let assetCount = 0;
      let updatedAt = "";
      const assets = join(dir, "assets");
      if (existsSync(assets)) {
        const walk = (p: string): void => {
          for (const f of readdirSync(p, { withFileTypes: true })) {
            const fp = join(p, f.name);
            if (f.isDirectory()) walk(fp);
            else {
              assetCount += 1;
              const m = statSync(fp).mtimeMs;
              if (m > (updatedAt ? new Date(updatedAt).getTime() : 0))
                updatedAt = new Date(m).toISOString();
            }
          }
        };
        try {
          walk(assets);
        } catch {
          // 不可读目录跳过
        }
      }
      if (!updatedAt) updatedAt = new Date(statSync(dir).mtimeMs).toISOString();
      return {
        name: d.name,
        dir,
        hasFilm,
        assetCount,
        updatedAt,
        studioUrl: registry[d.name]?.studioUrl ?? null,
        running: Boolean(processes.get(d.name) && !processes.get(d.name)!.killed),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** 拉起 OpenFilm Studio：`openfilm open <name>`（幂等——已存在的项目直接打开）。解析 stdout 拿 Studio 地址。 */
export async function openFilm(name: string): Promise<{ studioUrl: string; dir: string }> {
  const root = filmsRoot();
  mkdirSync(root, { recursive: true });
  const dir = join(root, name);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const existing = processes.get(name);
  if (existing && !existing.killed && registry[name]?.studioUrl)
    return { studioUrl: registry[name].studioUrl, dir };

  return new Promise((resolvePromise, reject) => {
    const child = spawn(bin(), ["open", name], { cwd: root, env: process.env });
    processes.set(name, child);
    let out = "";
    const timer = setTimeout(() => reject(new Error("openfilm open 超时（90s）")), 90_000);
    child.stdout?.on("data", (chunk) => {
      out += String(chunk);
      // "Studio   http://127.0.0.1:4747/open?key=...&to=%2Fprojects%2Fxxx"
      const m = out.match(/Studio\s+(http:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        const studioUrl = m[1];
        registry[name] = {
          studioUrl,
          pid: child.pid ?? 0,
          startedAt: new Date().toISOString(),
        };
        saveRegistry();
        resolvePromise({ studioUrl, dir });
      }
    });
    child.stderr?.on("data", (chunk) => {
      out += String(chunk);
    });
    child.on("exit", (code) => {
      processes.delete(name);
      clearTimeout(timer);
      if (!out.includes("Studio")) reject(new Error(`openfilm 退出（${code}）：${out.slice(-400)}`));
    });
  });
}

/* ───────────── 素材分类（APA 层：assets/ 下按分类子目录） ───────────── */

export const ASSET_CATEGORIES = ["character", "scene", "prop", "audio", "video", "image"] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export interface AssetItem {
  file: string; // 相对 film.html 的路径（粘贴进 film.html 用）
  category: AssetCategory;
  size: number;
  updatedAt: string;
}

export function listAssets(name: string): AssetItem[] {
  const dir = join(filmsRoot(), name, "assets");
  if (!existsSync(dir)) return [];
  const out: AssetItem[] = [];
  for (const cat of ASSET_CATEGORIES) {
    const catDir = join(dir, cat);
    if (!existsSync(catDir)) continue;
    for (const f of readdirSync(catDir, { withFileTypes: true })) {
      if (f.isDirectory()) continue;
      const rel = join("assets", cat, f.name);
      const st = statSync(join(catDir, f.name));
      out.push({
        file: rel.split("\\").join("/"),
        category: cat,
        size: st.size,
        updatedAt: new Date(st.mtimeMs).toISOString(),
      });
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function assetsDir(name: string, category: AssetCategory): string {
  const dir = join(filmsRoot(), name, "assets", category);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function filmDir(name: string): string {
  return join(filmsRoot(), name);
}

export function readRegistryFor(name: string): RegistryEntry | null {
  return registry[name] ?? null;
}
