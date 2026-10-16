import { useCallback, useMemo, useRef, useState } from "react";
import {
  episodeCost,
  episodeDuration,
  estimateClipCost,
  getModel,
  mockEpisodes,
  selectionRate,
  allKeyframesPicked,
  type Episode,
  type ImageVariant,
  type Keyframe,
  type Segment,
  type FailureMode,
} from "@dimples/apa-shared";

export type StudioMode = "shotlist" | "preview" | "plan";

const clone = (eps: Episode[]): Episode[] => structuredClone(eps);

const nowIso = () => new Date().toISOString();

function placeholderImageVariant(kf: Keyframe, i: number): ImageVariant {
  return {
    id: `iv-${kf.id}-${Date.now()}-${i}`,
    seed: `s-${Math.floor(Math.random() * 9000 + 1000)}`,
    modelVersion: "seedream-4.0",
    requestParams: { resolution: "2K", styleRef: "project-style-anchor" },
    promptSnapshot: kf.imagePrompt,
    cost: 0.2,
    createdAt: nowIso(),
  };
}

/** 按模型档位贪心切分总时长（每段取不超过剩余时长的最大档位） */
function splitByDurations(total: number, modelId: string): number[] {
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

/** 工作台状态中枢：集/关键帧/演绎段 + 撤销栈 + 选择 + 批量 + 两阶段闸门 */
export function useStudio() {
  const [episodes, setEpisodes] = useState<Episode[]>(() => clone(mockEpisodes));
  const [past, setPast] = useState<Episode[][]>([]);
  const [future, setFuture] = useState<Episode[][]>([]);
  const [activeEpIndex, setActiveEpIndex] = useState(0);
  const [activeKeyframeId, setActiveKeyframeId] = useState<string | null>(
    mockEpisodes[0]?.keyframes[0]?.id ?? null,
  );
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /** 撤销栈永远从 ref 取最新快照（异步生成回调安全） */
  const episodesRef = useRef(episodes);
  episodesRef.current = episodes;

  const commit = useCallback((fn: (eps: Episode[]) => Episode[]) => {
    setPast((p) => [...p.slice(-49), clone(episodesRef.current)]);
    setFuture([]);
    setEpisodes((eps) => fn(eps));
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      setFuture((f) => [clone(episodesRef.current), ...f.slice(0, 49)]);
      setEpisodes(p[p.length - 1]);
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p.slice(-49), clone(episodesRef.current)]);
      setEpisodes(f[0]);
      return f.slice(1);
    });
  }, []);

  const episode = episodes[Math.min(activeEpIndex, episodes.length - 1)];

  /** 按 id 定位关键帧/段修改（跨集安全） */
  const patchKeyframe = useCallback(
    (kfId: string, patch: Partial<Keyframe>) => {
      commit((eps) =>
        eps.map((ep) => ({
          ...ep,
          keyframes: ep.keyframes.map((k) => (k.id === kfId ? { ...k, ...patch } : k)),
        })),
      );
    },
    [commit],
  );

  const patchSegment = useCallback(
    (segId: string, patch: Partial<Segment>) => {
      commit((eps) =>
        eps.map((ep) => ({
          ...ep,
          segments: ep.segments.map((s) => (s.id === segId ? { ...s, ...patch } : s)),
        })),
      );
    },
    [commit],
  );

  /** 模拟生图：draft → generating → 注入候选 → review（异步用 commit+ref，撤销安全） */
  const generateKeyframe = useCallback(
    (kfId: string) => {
      const kf = episode.keyframes.find((k) => k.id === kfId);
      if (!kf || kf.status === "generating" || kf.status === "picked") return;
      patchKeyframe(kfId, { status: "generating" });
      setTimeout(() => {
        commit((eps) =>
          eps.map((ep) => ({
            ...ep,
            keyframes: ep.keyframes.map((k) => {
              if (k.id !== kfId) return k;
              const fresh = placeholderImageVariant(k, 0);
              const fresh2 = placeholderImageVariant(k, 1);
              return {
                ...k,
                status: "review" as const,
                variants: [...k.variants, fresh, fresh2],
              };
            }),
          })),
        );
      }, 1300);
    },
    [episode, patchKeyframe, commit],
  );

  /** 模拟图生视频：仅当首帧已定稿且提示词未过期（两阶段闸门 + promptStale 校验）；完成后注入候选并计费 */
  const generateSegment = useCallback(
    (segId: string) => {
      const seg = episode.segments.find((s) => s.id === segId);
      if (!seg || seg.status === "generating" || seg.status === "ready") return;
      if (seg.promptStale) return; // 提示词待重写——重写前不许烧钱
      const kf = episode.keyframes.find((k) => k.id === seg.fromKeyframeId);
      if (!kf || kf.status !== "picked") return; // 首帧未定稿——闸门拦截
      patchSegment(segId, { status: "generating" });
      setTimeout(() => {
        commit((eps) =>
          eps.map((ep) => ({
            ...ep,
            segments: ep.segments.map((s) => {
              if (s.id !== segId) return s;
              const cost = estimateClipCost(s.modelId, s.resolution, s.duration);
              const variant = {
                id: `vv-${s.id}-${Date.now()}`,
                seed: `s-${Math.floor(Math.random() * 9000 + 1000)}`,
                modelVersion: getModel(s.modelId).label,
                requestParams: { resolution: s.resolution, duration: s.duration },
                promptSnapshot: s.videoPrompt,
                cost,
                createdAt: nowIso(),
              };
              return {
                ...s,
                status: "ready" as const,
                billedAttempts: s.billedAttempts + 1,
                cost: (s.cost ?? 0) + cost,
                variants: [...s.variants, variant],
                pickedVariantId: s.pickedVariantId ?? variant.id,
              };
            }),
          })),
        );
      }, 1600);
    },
    [episode, patchSegment, commit],
  );

  /** 选优 / 淘汰（强制归因） */
  const pickImageVariant = useCallback(
    (kfId: string, variantId: string) => {
      patchKeyframe(kfId, {
        pickedVariantId: variantId,
        status: "picked",
        imageUrl: `variant:${variantId}`,
      });
      // 采纳后，引用此帧起点的段若未定稿，标记待重制（首帧变了）
      commit((eps) =>
        eps.map((ep) => ({
          ...ep,
          segments: ep.segments.map((s) =>
            s.fromKeyframeId === kfId && s.status === "ready" && s.pickedVariantId
              ? { ...s, status: "stale" as const, promptStale: true }
              : s,
          ),
        })),
      );
    },
    [patchKeyframe, commit],
  );

  const rejectImageVariant = useCallback(
    (kfId: string, variantId: string, reason: FailureMode) => {
      const kf = episode.keyframes.find((k) => k.id === kfId);
      if (!kf) return;
      patchKeyframe(kfId, {
        variants: kf.variants.map((v) =>
          v.id === variantId ? { ...v, rejectedReason: reason } : v,
        ),
      });
    },
    [episode, patchKeyframe],
  );

  const pickVideoVariant = useCallback(
    (segId: string, variantId: string) => {
      patchSegment(segId, { pickedVariantId: variantId, status: "ready" });
    },
    [patchSegment],
  );

  const rejectVideoVariant = useCallback(
    (segId: string, variantId: string, reason: FailureMode) => {
      const seg = episode.segments.find((s) => s.id === segId);
      if (!seg) return;
      patchSegment(segId, {
        variants: seg.variants.map((v) =>
          v.id === variantId ? { ...v, rejectedReason: reason } : v,
        ),
      });
    },
    [episode, patchSegment],
  );

  /** 在某关键帧之后插入 N 个关键帧：原段按时长档位重切，原提示词置待重写 */
  const insertKeyframes = useCallback(
    (afterKfId: string, n: number) => {
      commit((eps) =>
        eps.map((ep) => {
          const idx = ep.keyframes.findIndex((k) => k.id === afterKfId);
          if (idx < 0) return ep;
          const segIdx = ep.segments.findIndex((s) => s.fromKeyframeId === afterKfId);
          const originSeg = segIdx >= 0 ? ep.segments[segIdx] : null;
          const modelId = originSeg?.modelId ?? "seedance-1-0-pro";
          const resolution = originSeg?.resolution ?? "1080p";

          const newKfs: Keyframe[] = Array.from({ length: n }, (_, i) => ({
            id: `kf-new-${Date.now()}-${i}`,
            code: "",
            imagePrompt: "",
            negativePrompt: undefined,
            references: originSeg ? [] : [],
            variants: [],
            status: "draft" as const,
          }));
          const keyframes = [...ep.keyframes.slice(0, idx + 1), ...newKfs, ...ep.keyframes.slice(idx + 1)];
          keyframes.forEach((k, i) => (k.code = `KF-${String(i + 1).padStart(2, "0")}`));

          const newSegs: Segment[] = [];
          if (originSeg) {
            // 插入 n 帧 = 该处叙事延长 n×5s；总时长按模型档位贪心重切为 n+1 段
            const parts = splitByDurations(originSeg.duration + 5 * n, modelId);
            // 重新编号段并接上新关键帧链
            const others = ep.segments.filter((_, i) => i !== segIdx);
            const inserted = parts.map((d, i) => ({
              id: `${originSeg.id}-x${i}-${Date.now()}`,
              code: "",
              fromKeyframeId: i === 0 ? afterKfId : newKfs[i - 1].id,
              fromVariantId: i === 0 ? originSeg.fromVariantId : undefined,
              toKeyframeId: i === parts.length - 1 ? originSeg.toKeyframeId : newKfs[i].id,
              videoPrompt: i === 0 ? originSeg.videoPrompt : "",
              promptStale: true,
              modelId,
              resolution,
              duration: d,
              dialogue: i === 0 ? originSeg.dialogue : undefined,
              dialogueStrategy: originSeg.dialogueStrategy,
              billedAttempts: 0,
              failedAttempts: 0,
              cost: 0,
              variants: [],
              pickedVariantId: undefined,
              status: "draft" as const,
            }));
            newSegs.push(...inserted);
            const all = [...others.slice(0, segIdx), ...inserted, ...others.slice(segIdx)];
            all.forEach((s, i) => (s.code = `SEG-${String(i + 1).padStart(2, "0")}`));
            return { ...ep, keyframes, segments: all };
          }
          return { ...ep, keyframes };
        }),
      );
    },
    [commit],
  );

  /** 批量操作 */
  const batchGenerateKeyframes = useCallback(() => {
    const targets = episode.keyframes.filter((k) => k.status === "draft");
    targets.forEach((k, i) => setTimeout(() => generateKeyframe(k.id), i * 250));
  }, [episode, generateKeyframe]);

  /** 两阶段闸门：全部关键帧 picked 后才允许批量生成视频 */
  const gateOpen = allKeyframesPicked(episode);

  const batchGenerateSegments = useCallback(() => {
    if (!gateOpen) return;
    const targets = episode.segments.filter((s) => s.status === "draft" || s.status === "planned");
    targets.forEach((s, i) => setTimeout(() => generateSegment(s.id), i * 250));
  }, [episode, gateOpen, generateSegment]);

  /** 批量重试：仅重制「提示词未过期且首帧已定稿」的失败/待重制段（闸门硬拦截） */
  const batchRetryFailed = useCallback(() => {
    episode.segments
      .filter(
        (s) =>
          (s.status === "failed" || s.status === "stale") &&
          !s.promptStale &&
          episode.keyframes.find((k) => k.id === s.fromKeyframeId)?.status === "picked",
      )
      .forEach((s, i) => setTimeout(() => generateSegment(s.id), i * 250));
  }, [episode, generateSegment]);

  /** 剧本/节拍变更对齐：把挂在该节拍下的演绎段置为待重制+提示词待重写 */
  const alignBeatChanges = useCallback(
    (beatId: string) => {
      const kfIds = new Set(episode.keyframes.filter((k) => k.beatId === beatId).map((k) => k.id));
      commit((eps) =>
        eps.map((ep) => ({
          ...ep,
          segments: ep.segments.map((s) =>
            kfIds.has(s.fromKeyframeId) && s.status !== "draft"
              ? { ...s, status: "stale" as const, promptStale: true }
              : s,
          ),
        })),
      );
    },
    [episode, commit],
  );

  function addEpisode() {
    const next = episodes.length + 1;
    const ep: Episode = {
      id: `ep-new-${Date.now()}`,
      number: next,
      title: `第 ${next} 集`,
      dramaticGoal: "",
      logline: "",
      synopsis: "",
      aspectRatio: "9:16",
      targetDurationSec: 75,
      beats: [],
      keyframes: [],
      segments: [],
    };
    commit((eps) => [...eps, ep]);
    setActiveEpIndex(episodes.length);
    setActiveKeyframeId(null);
    setActiveSegmentId(null);
  }

  function updateEpisodeMeta(patch: Partial<Episode>) {
    commit((eps) => eps.map((e, i) => (i === activeEpIndex ? { ...e, ...patch } : e)));
  }

  /** 模拟拆集/关键帧规划：从节拍生成关键帧骨架（每个节拍至少 1 帧） */
  const planKeyframesFromBeats = useCallback(() => {
    commit((eps) =>
      eps.map((e, i) => {
        if (i !== activeEpIndex || e.beats.length === 0) return e;
        const kfs: Keyframe[] = e.beats.flatMap((b, bi) =>
          b.keyframeIds.length
            ? []
            : [
                {
                  id: `kf-plan-${Date.now()}-${bi}`,
                  code: "",
                  beatId: b.id,
                  imagePrompt: `${b.text}——竖屏构图，胶片颗粒`,
                  references: [],
                  variants: [],
                  status: "draft" as const,
                },
              ],
        );
        const keyframes = [...e.keyframes, ...kfs];
        keyframes.forEach((k, i) => (k.code = `KF-${String(i + 1).padStart(2, "0")}`));
        const segments = [...e.segments];
        // 为新增关键帧补相邻段
        for (let i = e.keyframes.length; i < keyframes.length; i++) {
          segments.push({
            id: `seg-plan-${Date.now()}-${i}`,
            code: "",
            fromKeyframeId: keyframes[i].id,
            toKeyframeId: keyframes[i + 1]?.id,
            videoPrompt: "",
            modelId: "seedance-1-0-pro",
            resolution: "1080p",
            duration: 5,
            billedAttempts: 0,
            failedAttempts: 0,
            cost: 0,
            variants: [],
            pickedVariantId: undefined,
            status: "draft" as const,
          });
        }
        segments.forEach((s, i) => (s.code = `SEG-${String(i + 1).padStart(2, "0")}`));
        return { ...e, keyframes, segments };
      }),
    );
  }, [activeEpIndex, commit]);

  const stats = useMemo(() => {
    const pickedKf = episode.keyframes.filter((k) => k.status === "picked").length;
    const readySeg = episode.segments.filter((s) => s.status === "ready").length;
    return {
      pickedKf,
      totalKf: episode.keyframes.length,
      readySeg,
      totalSeg: episode.segments.length,
      cost: episodeCost(episode),
      duration: episodeDuration(episode),
      selection: selectionRate(episode),
    };
  }, [episode]);

  /** 预算三要素：已花 / 完成预估（含待生成段×2 重试）/ 上限（全部段×3） */
  const budget = useMemo(() => {
    const spent = episodeCost(episode);
    const pending = episode.segments.filter((s) => s.status !== "ready");
    const pendingEstimate = pending.reduce(
      (a, s) => a + estimateClipCost(s.modelId, s.resolution, s.duration) * 2,
      0,
    );
    const cap = episode.segments.reduce(
      (a, s) => a + estimateClipCost(s.modelId, s.resolution, s.duration) * 3,
      0,
    );
    return { spent, estimate: spent + pendingEstimate, cap };
  }, [episode]);

  return {
    episodes,
    episode,
    activeEpIndex,
    setActiveEpIndex,
    addEpisode,
    updateEpisodeMeta,
    budget,
    alignBeatChanges,
    activeKeyframeId,
    setActiveKeyframeId,
    activeSegmentId,
    setActiveSegmentId,
    updateKeyframe: patchKeyframe,
    updateSegment: patchSegment,
    generateKeyframe,
    generateSegment,
    pickImageVariant,
    rejectImageVariant,
    pickVideoVariant,
    rejectVideoVariant,
    insertKeyframes,
    planKeyframesFromBeats,
    selectedIds,
    toggleSelect: (id: string) =>
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    setSelectedIds,
    batchGenerateKeyframes,
    batchGenerateSegments,
    batchRetryFailed,
    gateOpen,
    stats,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
  };
}
