import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { mockEpisodes, runOp, type OpResult, type StudioState } from "@dimples/apa-shared";

/**
 * 片协议 apa-film/0.3（OpenFilm 范式）：项目=文件夹，film.json 是主协议（agent 直接改），
 * overrides.json 是人的覆写层（UI 编辑 shadow + locks——locked 实体 agent 拒改）。
 * server 与 CLI 共享同一文件夹 = 人/agent/脚本三操作者交替编辑互不覆盖的根基。
 */

export interface OverridesFile {
  /** UI 人的编辑 shadow（最近一次人改的实体字段）——agent 手册要求"改前重读、保留人的覆写" */
  shadows: { entity: string; field: string; value: unknown; at: string }[];
  /** locked 实体（agent 一个字都不许改） */
  locks: string[];
}

const projDir = () => resolve(process.env.APA_PROJECT || join(process.cwd(), "apa-project"));

const filmPath = () => join(projDir(), "film.json");
const overridesPath = () => join(projDir(), "overrides.json");
const manualPath = () => join(projDir(), "APA.md");

let cache: StudioState | null = null;

function seed(): StudioState {
  return {
    project: {
      id: "p-007",
      name: "雾岛来电",
      format: "竖屏 AI 短剧",
      aspectRatio: "9:16",
      defaultModelId: "seedance-1-0-pro",
      defaultResolution: "1080p",
      episodeCount: 12,
    },
    episodes: structuredClone(mockEpisodes),
  };
}

export function projectDir(): string {
  return projDir();
}

export function loadState(): StudioState {
  if (cache) return cache;
  if (existsSync(filmPath())) {
    try {
      cache = JSON.parse(readFileSync(filmPath(), "utf8")) as StudioState;
      return cache;
    } catch {
      // film.json 损坏：按协议"带行号报错"精神，这里给出明确错误而不是静默重置
      throw new Error(`film.json 解析失败（${filmPath()}）——请修复或删除该文件以重新 seed`);
    }
  }
  cache = seed();
  saveState();
  writeManual();
  return cache;
}

export function saveState(): void {
  if (!cache) return;
  const tmp = `${filmPath()}.tmp`;
  writeFileSync(tmp, JSON.stringify(cache, null, 2));
  renameSync(tmp, filmPath());
}

export function storePathOf(): string {
  return filmPath();
}

/* ───────────── overrides（人的覆写层 + locks） ───────────── */

export function loadOverrides(): OverridesFile {
  if (existsSync(overridesPath())) {
    try {
      return JSON.parse(readFileSync(overridesPath(), "utf8")) as OverridesFile;
    } catch {
      // 损坏则重建（shadow 只是提示层）
    }
  }
  return { shadows: [], locks: [] };
}

export function saveOverrides(o: OverridesFile): void {
  const tmp = `${overridesPath()}.tmp`;
  writeFileSync(tmp, JSON.stringify(o, null, 2));
  renameSync(tmp, overridesPath());
}

/** 记录一次人的编辑 shadow（保留最近 200 条） */
export function shadowEdit(entity: string, fields: string[], patch: Record<string, unknown>): void {
  const o = loadOverrides();
  for (const f of fields) {
    if (f in patch)
      o.shadows.push({ entity: `${entity}.${f}`, field: f, value: patch[f], at: new Date().toISOString() });
  }
  o.shadows = o.shadows.slice(-200);
  saveOverrides(o);
}

/** locked 实体：agent（by=agent）拒改；人（by=ui）可改（人可以解锁） */
export function assertNotLocked(by: string, entity: string): void {
  if (by !== "agent") return;
  const o = loadOverrides();
  if (o.locks.includes(entity) || o.locks.includes(`${entity}.*`))
    throw new Error(`${entity} 已被人在 UI 锁定——按协议 agent 不许改；请人解锁后再改`);
}

export function toggleLock(entity: string, locked: boolean): void {
  const o = loadOverrides();
  o.locks = o.locks.filter((x) => x !== entity);
  if (locked) o.locks.push(entity);
  saveOverrides(o);
}

/* ───────────── 手册（极薄 skill + 版本化手册的 OpenFilm 分层） ───────────── */

export function writeManual(): string {
  const s = cache ?? seed();
  const manual = `# APA.md — 片项目手册（apa-film/0.3）

项目：${s.project.name}（${s.project.format} · ${s.project.aspectRatio} · 默认 ${s.project.defaultModelId}/${s.project.defaultResolution}）

## 给 coding agent 的协作规则
1. 本文件夹是一部片子：\`film.json\` 是主协议（声明式、可 diff），你可以直接读写它；\`APA.md\` 是本手册。
2. **改前重读 film.json，只改要改的**；保持 JSON 合法（解析失败会被 server 拒绝）。
3. **overrides.json 是人的覆写层**：\`shadows\` 是人在 UI 里最近改过的字段——改同一字段前先看它；\`locks\` 里的实体是**人锁定的，你一个字都不许改**（server 也会拒绝你）。
4. 时长纪律：每段 \`duration\` 必须属于所用模型的档位（Seedance 1.0 lite/pro = 5s/10s；2.5 至 15s）；台词字数 ÷ 4.1 ≈ 该段时长。
5. 先静后动：所有关键帧 status=picked 之前，不要把任何段推入生成。
6. 自检：\`apa look\`（时长/一致性/命名/覆写冲突报告）； \`apa validate\`（8 项不变式）。
7. 常用命令：\`apa pipeline plan\` → 人审 → \`apa pipeline execute -s keyframes\` → \`apa pipeline finalize\`。

## 结构
- project：全局（名称/画幅/默认模型档位）
- episodes[]：集（beats 节拍 → keyframes 关键帧 → segments 帧间演绎段）
- 关键帧 = 生图提示词（imagePrompt，一等公民）+ 参考资产（references，一致性）
- 演绎段 = 视频演绎提示词（videoPrompt）+ 模型档位 + 对白策略 + 候选池（variants，选优）
`;
  writeFileSync(manualPath(), manual);
  return manual;
}


/* ───────────── mutate：四端唯一写入口（locked 守卫 + shadow） ───────────── */

export interface MutateResult {
  state: StudioState;
  result: OpResult | void;
}

function entityOf(args: Record<string, unknown>): { entity: string } | null {
  if (args.kfId) return { entity: `keyframe:${args.kfId}` };
  if (args.segId) return { entity: `segment:${args.segId}` };
  if (args.episodeId) return { entity: `episode:${args.episodeId}` };
  return null;
}

const PATCH_OPS = new Set(["keyframe.patch", "segment.patch", "episode.setMeta"]);
const WRITE_OPS = new Set([
  "keyframe.patch", "keyframe.generate", "keyframe.pick", "keyframe.reject", "keyframe.insert",
  "segment.patch", "segment.generate", "segment.pick", "segment.reject", "segment.attribute",
  "episode.setMeta", "episode.planKeyframes", "episode.alignBeat",
  "batch.generateKeyframes", "batch.generateSegments", "batch.retryFailed",
]);

/** 克隆 → 执行 op → 原子落盘。by=agent 受 locks 守卫；by=ui 记 shadow（OpenFilm overrides 范式）。 */
export function mutate(
  op: string,
  args: Record<string, unknown>,
  by: "ui" | "agent" = "ui",
): MutateResult {
  const current = loadState();
  const next = structuredClone(current);
  const result = runOp(next, op, args);
  cache = next;
  saveState();

  if (WRITE_OPS.has(op)) {
    const ent = entityOf(args);
    if (ent && by === "agent") assertNotLocked(by, ent.entity);
    if (ent && by === "ui" && PATCH_OPS.has(op)) {
      const patch = (args.patch as Record<string, unknown>) ?? {};
      shadowEdit(ent.entity, Object.keys(patch), patch);
    }
  }
  return { state: next, result };
}

/** generate 类 op 的异步完成调度（provider 模拟） */
export function scheduleCompletion(op: string, args: Record<string, unknown>): void {
  const delayMs = Number(args.delayMs ?? 0);
  if (!delayMs) return;
  const completeOp =
    op === "keyframe.generate" ? "keyframe.completeGeneration" : "segment.completeGeneration";
  const idKey = op === "keyframe.generate" ? "kfId" : "segId";
  setTimeout(() => {
    try {
      mutate(completeOp, { [idKey]: args[idKey] }, "agent");
    } catch {
      // 实体可能已被删除/回滚——忽略
    }
  }, delayMs).unref();
}
