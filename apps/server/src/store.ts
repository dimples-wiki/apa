import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  mockEpisodes,
  runOp,
  type OpResult,
  type StudioState,
} from "@dimples/apa-shared";

/**
 * store：JSON 文件单一真源（CLI / server API / MCP 四端共享同一文件）。
 * 原子写（tmp + rename）；无文件时 seed 演示数据。
 */

const storePath = process.env.APA_STORE || join(process.cwd(), ".apa-store.json");

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

export function loadState(): StudioState {
  if (cache) return cache;
  if (existsSync(storePath)) {
    try {
      cache = JSON.parse(readFileSync(storePath, "utf8")) as StudioState;
      return cache;
    } catch {
      // 损坏文件回退 seed
    }
  }
  cache = seed();
  saveState();
  return cache;
}

export function storePathOf(): string {
  return storePath;
}

export function saveState(): void {
  if (!cache) return;
  const tmp = `${storePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(cache, null, 2));
  renameSync(tmp, storePath);
}

export interface MutateResult {
  state: StudioState;
  result: OpResult | void;
}

/** 克隆 → 执行 op → 原子落盘。op 抛错时不落盘（调用方收到异常）。 */
export function mutate(op: string, args: Record<string, unknown>): MutateResult {
  const current = loadState();
  const next = structuredClone(current);
  const result = runOp(next, op, args);
  cache = next;
  saveState();
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
      mutate(completeOp, { [idKey]: args[idKey] });
    } catch {
      // 实体可能已被删除/回滚——忽略
    }
  }, delayMs).unref();
}
