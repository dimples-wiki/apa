import type { Episode, FailureMode, ImageVariant, StudioState } from "./studio";
import {
  allKeyframesPicked,
  episodeCost,
  episodeDuration,
  estimateClipCost,
  formatDuration,
  getModel,
  validateEpisode,
} from "./studio";

/**
 * 统一 ops 注册表：CLI / server API / MCP / Web UI 四端共享的同一组状态机动作。
 * 纯函数（state 已由 store 层克隆，ops 就地修改），无 IO —— 可测试、可序列化。
 * 一工具 = 管线里一个状态机动作（AI 可执行 + 人可审核），命名 = 资源_动作。
 */

type Json = Record<string, unknown>;

export interface StudioProjectMeta {
  id: string;
  name: string;
  format: string;
  aspectRatio: "9:16" | "16:9";
  defaultModelId: string;
  defaultResolution: string;
  episodeCount: number;
}

export interface OpResult {
  note?: string;
  blocked?: string;
  manifest?: unknown;
  plan?: string[];
}

export interface OpDef {
  name: string;
  description: string;
  args: Record<string, "string" | "number" | "boolean" | "json">;
  fn: (state: StudioState, args: Json) => OpResult | void;
}

const nowIso = () => new Date().toISOString();

function ep(state: StudioState, id: string): Episode {
  const e = state.episodes.find((x) => x.id === id);
  if (!e) throw new Error(`episode ${id} 不存在`);
  return e;
}

function kf(state: StudioState, id: string) {
  for (const e of state.episodes) {
    const k = e.keyframes.find((x) => x.id === id);
    if (k) return { ep: e, k };
  }
  throw new Error(`keyframe ${id} 不存在`);
}

function seg(state: StudioState, id: string) {
  for (const e of state.episodes) {
    const s = e.segments.find((x) => x.id === id);
    if (s) return { ep: e, s };
  }
  throw new Error(`segment ${id} 不存在`);
}

function renumber(ep: Episode) {
  ep.keyframes.forEach((k, i) => (k.code = `KF-${String(i + 1).padStart(2, "0")}`));
  ep.segments.forEach((s, i) => (s.code = `SEG-${String(i + 1).padStart(2, "0")}`));
}

/** 按模型档位贪心切分总时长（每段取不超过剩余的最大档位） */
export function splitByDurations(total: number, modelId: string): number[] {
  const durations = [...getModel(modelId).durations].sort((a, b) => b - a);
  const parts: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    const pick = durations.find((d) => d <= remaining) ?? durations[durations.length - 1];
    parts.push(pick);
    remaining -= pick;
  }
  return parts.length ? parts : [durations[durations.length - 1]];
}

/* ───────────────────────── 生成模拟（provider 未接入前的确定性完成） ───────────────────────── */

function completeKeyframe(state: StudioState, kfId: string) {
  const { k } = kf(state, kfId);
  const fresh = (i: number): ImageVariant => ({
    id: `iv-${k.id}-${Date.now()}-${i}`,
    seed: `s-${Math.floor(Math.random() * 9000 + 1000)}`,
    modelVersion: "seedream-4.0",
    requestParams: { resolution: "2K", styleRef: "project-style-anchor" },
    promptSnapshot: k.imagePrompt,
    cost: 0.2,
    createdAt: nowIso(),
  });
  k.variants.push(fresh(0), fresh(1));
  k.status = "review";
}

function completeSegment(state: StudioState, segId: string) {
  const { s } = seg(state, segId);
  const cost = estimateClipCost(s.modelId, s.resolution, s.duration);
  s.variants.push({
    id: `vv-${s.id}-${Date.now()}`,
    seed: `s-${Math.floor(Math.random() * 9000 + 1000)}`,
    modelVersion: getModel(s.modelId).label,
    requestParams: { resolution: s.resolution, duration: s.duration },
    promptSnapshot: s.videoPrompt,
    cost,
    createdAt: nowIso(),
  });
  s.billedAttempts += 1;
  s.cost = (s.cost ?? 0) + cost;
  if (!s.pickedVariantId) s.pickedVariantId = s.variants[s.variants.length - 1].id;
  s.status = "ready";
}

/* ───────────────────────── ops ───────────────────────── */

export const OPS: OpDef[] = [
  {
    name: "studio.replaceState",
    description: "全量替换 episodes（undo/redo 同步通道）",
    args: { episodes: "json" },
    fn: (state, args) => {
      state.episodes = args.episodes as Episode[];
    },
  },
  {
    name: "episode.setMeta",
    description: "修改集元数据（标题/戏剧目标/大纲/画幅/目标时长/钩子位/备案号）",
    args: { episodeId: "string", patch: "json" },
    fn: (state, args) => {
      Object.assign(ep(state, String(args.episodeId)), args.patch as object);
    },
  },
  {
    name: "keyframe.patch",
    description: "修改关键帧（提示词/负向词/参考/景别）；已有采纳产物时置待重写语义由前端提示",
    args: { kfId: "string", patch: "json" },
    fn: (state, args) => {
      Object.assign(kf(state, String(args.kfId)).k, args.patch as object);
    },
  },
  {
    name: "keyframe.generate",
    description:
      "生成关键帧静帧。hold=true 置 generating 后等待 provider 回调（队列用）；delayMs 由 server 调度异步完成；都不传则同步完成注入候选",
    args: { kfId: "string", delayMs: "number", hold: "boolean" },
    fn: (state, args) => {
      const { k } = kf(state, String(args.kfId));
      if (k.status === "generating" || k.status === "picked") return;
      k.status = "generating";
      if (!args.delayMs && !args.hold) completeKeyframe(state, String(args.kfId));
    },
  },
  {
    name: "keyframe.completeGeneration",
    description: "生成完成回调：注入候选并置待选优（server 定时器/真实 provider 回调用）",
    args: { kfId: "string" },
    fn: (state, args) => {
      const { k } = kf(state, String(args.kfId));
      if (k.status === "generating") completeKeyframe(state, String(args.kfId));
    },
  },
  {
    name: "keyframe.pick",
    description: "采纳候选为定稿帧；下游 ready 段自动置 stale（首帧已变的失效传播）",
    args: { kfId: "string", variantId: "string" },
    fn: (state, args) => {
      const kfId = String(args.kfId);
      const { k } = kf(state, kfId);
      k.pickedVariantId = String(args.variantId);
      k.status = "picked";
      k.imageUrl = `variant:${args.variantId}`;
      for (const e of state.episodes)
        for (const s of e.segments)
          if (s.fromKeyframeId === kfId && s.status === "ready" && s.pickedVariantId) {
            s.status = "stale";
            s.promptStale = true;
          }
    },
  },
  {
    name: "keyframe.reject",
    description: "淘汰候选（强制失败归因）",
    args: { kfId: "string", variantId: "string", reason: "string" },
    fn: (state, args) => {
      const { k } = kf(state, String(args.kfId));
      const v = k.variants.find((x) => x.id === args.variantId);
      if (!v) throw new Error(`variant ${args.variantId} 不存在`);
      v.rejectedReason = String(args.reason) as FailureMode;
    },
  },
  {
    name: "segment.patch",
    description:
      "修改演绎段（提示词/模型/分辨率/时长/对白策略）；换模型时吸附合法档位；已有产物时置 promptStale",
    args: { segId: "string", patch: "json" },
    fn: (state, args) => {
      const { s } = seg(state, String(args.segId));
      const patch = { ...(args.patch as object) } as Record<string, unknown>;
      if (typeof patch.modelId === "string" && patch.modelId !== s.modelId) {
        const next = getModel(patch.modelId);
        if (!next.durations.includes(s.duration))
          s.duration =
            next.durations.find((d) => d >= s.duration) ?? next.durations[next.durations.length - 1];
        if (!next.resolutions.includes(s.resolution))
          s.resolution = next.resolutions[next.resolutions.length - 1];
        if (s.dialogueStrategy === "native" && !next.audio.nativeAudioGen)
          s.dialogueStrategy = "tts-post";
      }
      if (typeof patch.duration === "number") {
        const m = getModel(s.modelId);
        if (!m.durations.includes(patch.duration))
          throw new Error(`时长 ${patch.duration}s 不在 ${m.label} 档位 ${m.durations.join("/")} 内——请拆段`);
      }
      const dirtied = s.variants.length > 0 || s.status === "ready";
      Object.assign(s, patch);
      if (dirtied && (patch.videoPrompt !== undefined || patch.modelId !== undefined || patch.duration !== undefined)) {
        s.promptStale = true;
        if (s.status === "ready") s.status = "stale";
      }
    },
  },
  {
    name: "segment.generate",
    description:
      "图生视频（两阶段闸门：首帧已定稿+提示词未过期+预算 15 次内）。hold=true 队列模式等 provider 回调；delayMs 由 server 调度异步完成；都不传则同步完成",
    args: { segId: "string", delayMs: "number", hold: "boolean" },
    fn: (state, args) => {
      const { s } = seg(state, String(args.segId));
      if (s.status === "generating" || s.status === "ready") return;
      if (s.promptStale) throw new Error(`${s.code} 提示词已过期——先重写保存`);
      if (s.billedAttempts + s.failedAttempts >= 15)
        throw new Error(`${s.code} 单镜预算 15 次封顶——必须换镜重写`);
      const k = state.episodes.flatMap((e) => e.keyframes).find((x) => x.id === s.fromKeyframeId);
      if (!k || k.status !== "picked") throw new Error(`首帧未定稿——先静后动`);
      s.status = "generating";
      if (!args.delayMs && !args.hold) completeSegment(state, String(args.segId));
    },
  },
  {
    name: "segment.completeGeneration",
    description: "生成完成回调（注入候选并计费）",
    args: { segId: "string" },
    fn: (state, args) => {
      const { s } = seg(state, String(args.segId));
      if (s.status === "generating") completeSegment(state, String(args.segId));
    },
  },
  {
    name: "segment.pick",
    description: "采纳候选片段",
    args: { segId: "string", variantId: "string" },
    fn: (state, args) => {
      const { s } = seg(state, String(args.segId));
      s.pickedVariantId = String(args.variantId);
      s.status = "ready";
    },
  },
  {
    name: "segment.reject",
    description: "淘汰候选片段（强制归因）",
    args: { segId: "string", variantId: "string", reason: "string" },
    fn: (state, args) => {
      const { s } = seg(state, String(args.segId));
      const v = s.variants.find((x) => x.id === args.variantId);
      if (!v) throw new Error(`variant ${args.variantId} 不存在`);
      v.rejectedReason = String(args.reason) as FailureMode;
    },
  },
  {
    name: "segment.attribute",
    description: "失败归因（failed 段归因后才能进批量重试）",
    args: { segId: "string", mode: "string" },
    fn: (state, args) => {
      seg(state, String(args.segId)).s.attributedFailure = String(args.mode) as FailureMode;
    },
  },
  {
    name: "keyframe.insert",
    description:
      "在某关键帧后插入 N 帧：原段时长+5s*N 按模型档位重切为 N+1 段，全部置待重写（提示词已不成立）",
    args: { afterKfId: "string", n: "number" },
    fn: (state, args) => {
      const e = state.episodes.find((x) => x.keyframes.some((k) => k.id === args.afterKfId));
      if (!e) throw new Error(`keyframe ${args.afterKfId} 不存在`);
      const idx = e.keyframes.findIndex((k) => k.id === args.afterKfId);
      const n = Math.max(1, Math.min(3, Number(args.n) || 1));
      const segIdx = e.segments.findIndex((s) => s.fromKeyframeId === args.afterKfId);
      const origin = segIdx >= 0 ? e.segments[segIdx] : null;
      const modelId = origin?.modelId ?? state.project.defaultModelId;
      const newKfs = Array.from({ length: n }, (_, i) => ({
        id: `kf-new-${Date.now()}-${i}`,
        code: "",
        imagePrompt: "",
        references: [],
        variants: [],
        status: "draft" as const,
      }));
      e.keyframes.splice(idx + 1, 0, ...newKfs);
      if (origin) {
        const parts = splitByDurations(origin.duration + 5 * n, modelId);
        e.segments.splice(segIdx, 1);
        const inserted = parts.map((d, i) => ({
          id: `${origin.id}-x${i}-${Date.now()}`,
          code: "",
          fromKeyframeId: i === 0 ? String(args.afterKfId) : newKfs[i - 1].id,
          fromVariantId: i === 0 ? origin.fromVariantId : undefined,
          toKeyframeId: i === parts.length - 1 ? origin.toKeyframeId : newKfs[i].id,
          videoPrompt: i === 0 ? origin.videoPrompt : "",
          promptStale: true,
          modelId,
          resolution: origin.resolution,
          duration: d,
          dialogue: i === 0 ? origin.dialogue : undefined,
          dialogueStrategy: origin.dialogueStrategy,
          billedAttempts: 0,
          failedAttempts: 0,
          cost: 0,
          variants: [],
          status: "draft" as const,
        }));
        e.segments.splice(segIdx, 0, ...inserted);
      }
      renumber(e);
    },
  },
  {
    name: "episode.planKeyframes",
    description: "从节拍生成关键帧骨架（每未挂帧的节拍 1 帧）并补齐相邻段",
    args: { episodeId: "string" },
    fn: (state, args) => {
      const e = ep(state, String(args.episodeId));
      const modelId = state.project.defaultModelId;
      const added: string[] = [];
      e.beats.forEach((b, bi) => {
        if (b.keyframeIds.length > 0) return;
        const id = `kf-plan-${Date.now()}-${bi}`;
        e.keyframes.push({
          id,
          code: "",
          beatId: b.id,
          imagePrompt: `${b.text}——竖屏构图，胶片颗粒`,
          references: [],
          variants: [],
          status: "draft",
        });
        b.keyframeIds.push(id);
        added.push(id);
      });
      for (let i = 0; i < e.keyframes.length - 1; i++) {
        const from = e.keyframes[i];
        if (e.segments.some((s) => s.fromKeyframeId === from.id)) continue;
        e.segments.push({
          id: `seg-plan-${Date.now()}-${i}`,
          code: "",
          fromKeyframeId: from.id,
          toKeyframeId: e.keyframes[i + 1].id,
          videoPrompt: "",
          modelId,
          resolution: state.project.defaultResolution,
          duration: getModel(modelId).durations[0],
          billedAttempts: 0,
          failedAttempts: 0,
          cost: 0,
          variants: [],
          status: "draft",
        });
      }
      renumber(e);
    },
  },
  {
    name: "episode.alignBeat",
    description: "节拍变更对齐：挂载本拍的演绎段置待重制+提示词待重写",
    args: { episodeId: "string", beatId: "string" },
    fn: (state, args) => {
      const e = ep(state, String(args.episodeId));
      const ids = new Set(e.keyframes.filter((k) => k.beatId === args.beatId).map((k) => k.id));
      for (const s of e.segments)
        if (ids.has(s.fromKeyframeId) && s.status !== "draft") {
          s.status = "stale";
          s.promptStale = true;
        }
    },
  },
  {
    name: "batch.generateKeyframes",
    description: "批量生成全部待生成帧（sync 时逐个完成）",
    args: { episodeId: "string", sync: "boolean" },
    fn: (state, args) => {
      const e = ep(state, String(args.episodeId));
      const targets = e.keyframes.filter((k) => k.status === "draft");
      for (const k of targets) {
        k.status = "generating";
        if (args.sync) completeKeyframe(state, k.id);
      }
      return { note: `已提交 ${targets.length} 帧` };
    },
  },
  {
    name: "batch.generateSegments",
    description: "批量生成视频（两阶段闸门内建：未全定稿则 blocked）",
    args: { episodeId: "string", sync: "boolean" },
    fn: (state, args) => {
      const e = ep(state, String(args.episodeId));
      if (!allKeyframesPicked(e))
        return { blocked: `闸门未开：${e.keyframes.filter((k) => k.status !== "picked").length} 帧未定稿` };
      const targets = e.segments.filter((s) => s.status === "draft" || s.status === "planned");
      for (const s of targets) {
        if (s.promptStale) continue;
        s.status = "generating";
        if (args.sync) completeSegment(state, s.id);
      }
      return { note: `已提交 ${targets.length} 段` };
    },
  },
  {
    name: "batch.retryFailed",
    description: "批量重试：失败段需已归因、提示词未过期、首帧已定稿",
    args: { episodeId: "string", sync: "boolean" },
    fn: (state, args) => {
      const e = ep(state, String(args.episodeId));
      const targets = e.segments.filter(
        (s) =>
          (s.status === "stale" || (s.status === "failed" && s.attributedFailure)) &&
          !s.promptStale &&
          e.keyframes.find((k) => k.id === s.fromKeyframeId)?.status === "picked",
      );
      for (const s of targets) {
        s.status = "generating";
        if (args.sync) completeSegment(state, s.id);
      }
      return { note: `已重试 ${targets.length} 段` };
    },
  },
  {
    name: "pipeline.plan",
    description:
      "一键·计划预审：校验节拍覆盖→生成关键帧骨架→补齐演绎段→输出计划摘要（人审后再 execute）",
    args: { episodeId: "string" },
    fn: (state, args) => {
      const id = String(args.episodeId);
      const e = ep(state, id);
      const plan: string[] = [];
      if (e.keyframes.length === 0) {
        const def = OPS.find((o) => o.name === "episode.planKeyframes")!;
        def.fn(state, { episodeId: id });
        plan.push(`从 ${e.beats.length} 个节拍生成关键帧骨架`);
      }
      renumber(e);
      const est = e.segments.length * 3.67;
      plan.push(
        `计划：${e.keyframes.length} 帧 / ${e.segments.length} 段 / 预估成本 ¥${est.toFixed(2)}（上限倍数 ×3=¥${(est * 3).toFixed(2)}）`,
      );
      plan.push(`人审点：①关键帧提示词 ②一致性参考 ③档位切分——确认后 pipeline.execute`);
      return { plan };
    },
  },
  {
    name: "pipeline.execute",
    description: "一键·批量执行（stage=keyframes|videos，闸门内建，返回 blocked 或执行摘要）",
    args: { episodeId: "string", stage: "string", sync: "boolean" },
    fn: (state, args) => {
      const name = args.stage === "videos" ? "batch.generateSegments" : "batch.generateKeyframes";
      const def = OPS.find((o) => o.name === name)!;
      return def.fn(state, { episodeId: args.episodeId, sync: args.sync }) as OpResult;
    },
  },
  {
    name: "pipeline.finalize",
    description:
      "一键·粗剪清单：picked 变体按时间线导出结构化 JSON（规范命名/起止/台词/资产），可导剪映/EDL",
    args: { episodeId: "string" },
    fn: (state, args) => {
      const e = ep(state, String(args.episodeId));
      let cursor = 0;
      const rows = e.segments.map((s) => {
        const start = cursor;
        cursor += s.duration;
        const v = s.variants.find((x) => x.id === s.pickedVariantId);
        return {
          seg: s.code,
          file: `${e.number}s/${e.number}_${s.code}_${s.pickedVariantId ?? "UNPICKED"}.mp4`,
          startSec: start,
          durationSec: s.duration,
          status: s.status,
          ready: s.status === "ready" && Boolean(v),
          dialogue: s.dialogue ?? null,
          model: getModel(s.modelId).label,
          cost: s.cost ?? 0,
        };
      });
      return {
        manifest: {
          episode: `${e.number} - ${e.title}`,
          aspectRatio: e.aspectRatio,
          totalDuration: formatDuration(episodeDuration(e)),
          totalCost: episodeCost(e),
          missing: rows.filter((r) => !r.ready).map((r) => r.seg),
          rows,
        },
        note: `粗剪清单：${rows.filter((r) => r.ready).length}/${rows.length} 段就绪`,
      };
    },
  },
  {
    name: "studio.validate",
    description: "管线不变式校验报告（8 项）",
    args: { episodeId: "string" },
    fn: (state, args) => {
      const e = ep(state, String(args.episodeId));
      const budget = {
        spent: episodeCost(e),
        estimate:
          episodeCost(e) +
          e.segments
            .filter((s) => s.status !== "ready")
            .reduce((a, s) => a + estimateClipCost(s.modelId, s.resolution, s.duration) * 2, 0),
        cap: e.segments.reduce(
          (a, s) => a + estimateClipCost(s.modelId, s.resolution, s.duration) * 3,
          0,
        ),
      };
      return { manifest: validateEpisode(e, budget) };
    },
  },
];

export const OP_MAP = new Map(OPS.map((o) => [o.name, o]));

/** store 层调用：克隆 state → 执行 op → 返回结果（异常抛出由调用方回滚） */
export function runOp(state: StudioState, op: string, args: Json): OpResult | void {
  const def = OP_MAP.get(op);
  if (!def) throw new Error(`未知 op：${op}`);
  return def.fn(state, args);
}
