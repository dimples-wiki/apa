import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { estimateClipCost } from "@dimples/apa-shared";
import { loadState, mutate } from "./store.ts";

/**
 * 生成队列：CLI/MCP 提交任务 → provider 执行 → 完成写回 store。
 * 现状：mock provider（确定性完成）；Seedance/ComfyUI provider 接同接口，配 key 即启用。
 * 语义对齐调研结论：批量提交、单任务失败不阻断、断点可查（jobs.json 持久化）。
 */

export type JobKind = "keyframe" | "segment";
export type JobStatus = "queued" | "running" | "done" | "failed";

export interface GenJob {
  id: string;
  kind: JobKind;
  targetId: string;
  episodeId: string;
  provider: string;
  status: JobStatus;
  cost?: number;
  error?: string;
  createdAt: string;
  finishedAt?: string;
}

const jobsPath = process.env.APA_JOBS || join(process.cwd(), ".apa-jobs.json");

let jobs: GenJob[] = existsSync(jobsPath)
  ? (JSON.parse(readFileSync(jobsPath, "utf8")) as GenJob[])
  : [];

function save(): void {
  const tmp = `${jobsPath}.tmp`;
  writeFileSync(tmp, JSON.stringify(jobs, null, 2));
  renameSync(tmp, jobsPath);
}

export function listJobs(status?: JobStatus): GenJob[] {
  return status ? jobs.filter((j) => j.status === status) : jobs;
}

/* ───────────── provider 接口（批 3 的挂载点） ───────────── */

export interface SegmentGenRequest {
  episodeId: string;
  segId: string;
  /** 注入点契约（画布导出 JSON 同构）：首帧/提示词/seed/时长 */
  injection: {
    firstFrame?: string;
    lastFrame?: string;
    prompt: string;
    seed?: string;
    length: number;
    resolution: string;
    modelId: string;
  };
}

export interface Provider {
  id: string;
  label: string;
  /** 配置就绪才启用（无 key 时 CLI/MCP 提交回落 mock） */
  isConfigured(): boolean;
  generateSegment(req: SegmentGenRequest): Promise<{ seed: string; cost: number; meta: Record<string, unknown> }>;
}

/** mock：确定性完成，成本按 token 公式估算（可验证的默认路径） */
const mockProvider: Provider = {
  id: "mock",
  label: "Mock（演示）",
  isConfigured: () => true,
  async generateSegment(req) {
    const unit = estimateClipCost(req.injection.modelId, req.injection.resolution, req.injection.length);
    return {
      seed: `s-${Math.floor(Math.random() * 9000 + 1000)}`,
      cost: unit,
      meta: { provider: "mock", simulated: true },
    };
  },
};

/**
 * Seedance（火山方舟）provider：按官方 content generation task API 实装。
 * 需环境变量 ARK_API_KEY；APA_SEEDANCE_MODEL 可覆盖（默认 doubao-seedance-1-0-pro）。
 * 文档：POST /api/v3/contents/generations/tasks → GET 轮询 → video_url。
 */
const seedanceProvider: Provider = {
  id: "seedance",
  label: "Seedance（火山方舟）",
  isConfigured: () => Boolean(process.env.ARK_API_KEY),
  async generateSegment(req) {
    const key = process.env.ARK_API_KEY;
    if (!key) throw new Error("ARK_API_KEY 未配置");
    const model = process.env.APA_SEEDANCE_MODEL || "doubao-seedance-1-0-pro";
    const base = process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com";
    const text = req.injection.lastFrame
      ? `${req.injection.prompt} 首帧参考已附，尾帧向目标画面过渡`
      : req.injection.prompt;
    const res = await fetch(`${base}/api/v3/contents/generations/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        content: [
          ...(req.injection.firstFrame
            ? [{ type: "image_url", image_url: { url: req.injection.firstFrame }, role: "first_frame" }]
            : []),
          ...(req.injection.lastFrame
            ? [{ type: "image_url", image_url: { url: req.injection.lastFrame }, role: "last_frame" }]
            : []),
          { type: "text", text: `--resolution ${req.injection.resolution} --duration ${req.injection.length} ${text}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Seedance 提交失败 ${res.status}: ${await res.text()}`);
    const { id } = (await res.json()) as { id: string };
    // 轮询至完成（单任务最长 10 分钟；失败/审核拒绝抛错由队列记 failed）
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const poll = await fetch(`${base}/api/v3/contents/generations/tasks/${id}`, {
        headers: { authorization: `Bearer ${key}` },
      });
      const body = (await poll.json()) as {
        status: string;
        content?: { video_url: string };
        error?: { message: string };
      };
      if (body.status === "succeeded") {
        return {
          seed: id,
          cost: estimateClipCost("seedance-1-0-pro", req.injection.resolution, req.injection.length),
          meta: { provider: "seedance", taskId: id, videoUrl: body.content?.video_url },
        };
      }
      if (body.status === "failed") throw new Error(`Seedance 失败：${body.error?.message ?? "未知"}`);
    }
    throw new Error("Seedance 轮询超时（10 分钟）");
  },
};

/**
 * ComfyUI provider：工作流模板 + 命名注入点（API 格式 JSON 由 APA_COMFY_WORKFLOW 提供，
 * 注入点用 {{FIRST_FRAME}}/{{PROMPT}}/{{SEED}}/{{LENGTH}} 占位）。文档：POST /prompt → WS/history。
 */
const comfyProvider: Provider = {
  id: "comfyui",
  label: "ComfyUI（本地）",
  isConfigured: () => Boolean(process.env.APA_COMFY_HOST && process.env.APA_COMFY_WORKFLOW),
  async generateSegment(req) {
    const host = process.env.APA_COMFY_HOST!;
    const tpl = JSON.parse(readFileSync(process.env.APA_COMFY_WORKFLOW!, "utf8")) as Record<
      string,
      { class_type: string; inputs: Record<string, unknown> }
    >;
    for (const node of Object.values(tpl)) {
      for (const [k, v] of Object.entries(node.inputs)) {
        if (typeof v === "string") {
          if (v === "{{PROMPT}}") node.inputs[k] = req.injection.prompt;
          if (v === "{{SEED}}") node.inputs[k] = Number(req.injection.seed ?? Date.now() % 1e9);
          if (v === "{{LENGTH}}") node.inputs[k] = req.injection.length;
          if (v === "{{FIRST_FRAME}}" && req.injection.firstFrame) node.inputs[k] = req.injection.firstFrame;
        }
      }
    }
    const res = await fetch(`${host}/prompt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: tpl, client_id: `apa-${Date.now()}` }),
    });
    if (!res.ok) throw new Error(`ComfyUI 提交失败 ${res.status}`);
    const { prompt_id: taskId } = (await res.json()) as { prompt_id: string };
    // 轮询 /history（简化：不建 WS 长连）
    for (let i = 0; i < 200; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const hist = await fetch(`${host}/history/${taskId}`);
      const body = (await hist.json()) as Record<string, { status?: { completed?: boolean } }>;
      const entry = body[taskId];
      if (entry?.status?.completed) {
        return {
          seed: taskId,
          cost: 0,
          meta: { provider: "comfyui", taskId, host },
        };
      }
    }
    throw new Error("ComfyUI 轮询超时");
  },
};

const PROVIDERS: Provider[] = [seedanceProvider, comfyProvider, mockProvider];

export function resolveProvider(preferred?: string): Provider {
  if (preferred) {
    const p = PROVIDERS.find((x) => x.id === preferred);
    if (!p) throw new Error(`未知 provider：${preferred}`);
    if (!p.isConfigured()) throw new Error(`provider ${p.id} 未配置（缺 key/host）`);
    return p;
  }
  return PROVIDERS.find((p) => p.isConfigured()) ?? mockProvider;
}

/* ───────────── 入队与执行 ───────────── */

/** 提交一个生成任务：先在 store 置 generating（闸门校验在 op 内），provider 异步执行后写回 */
export async function enqueue(opts: {
  kind: JobKind;
  targetId: string;
  providerId?: string;
  injection: SegmentGenRequest["injection"];
}): Promise<GenJob> {
  const provider = resolveProvider(opts.providerId);
  const job: GenJob = {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: opts.kind,
    targetId: opts.targetId,
    episodeId: "",
    provider: provider.id,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  jobs.push(job);
  save();

  job.episodeId = findEpisodeId(opts.targetId);

  // 闸门校验 + 置 generating（hold 模式：等 provider 回调写回）
  mutate(opts.kind === "segment" ? "segment.generate" : "keyframe.generate", {
    [opts.kind === "segment" ? "segId" : "kfId"]: opts.targetId,
    hold: true,
  });

  job.status = "running";
  save();

  provider
    .generateSegment({ episodeId: job.episodeId, segId: opts.targetId, injection: opts.injection })
    .then((out) => {
      console.error("[queue] provider done, writing back", opts.targetId);
      job.status = "done";
      job.cost = out.cost;
      job.finishedAt = new Date().toISOString();
      save();
      mutate(opts.kind === "segment" ? "segment.completeGeneration" : "keyframe.completeGeneration", {
        [opts.kind === "segment" ? "segId" : "kfId"]: opts.targetId,
      });
    })
    .catch((e: Error) => {
      console.error("[queue] provider failed:", e.message);
      job.status = "failed";
      job.error = e.message;
      job.finishedAt = new Date().toISOString();
      save();
    });

  return job;
}

function findEpisodeId(targetId: string): string {
  const state = loadState();
  for (const e of state.episodes) {
    if (e.keyframes.some((k) => k.id === targetId) || e.segments.some((s) => s.id === targetId))
      return e.id;
  }
  return state.episodes[0]?.id ?? "";
}

