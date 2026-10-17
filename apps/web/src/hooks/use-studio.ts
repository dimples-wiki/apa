import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  allKeyframesPicked,
  episodeCost,
  episodeDuration,
  estimateClipCost,
  selectionRate,
  runOp,
  type Episode,
  type StudioState,
} from "@dimples/apa-shared";

export type StudioMode = "shotlist" | "canvas" | "preview" | "plan" | "insight";

const clone = (eps: Episode[]): Episode[] => structuredClone(eps);

/** 撤销栈永远从 ref 取最新快照（异步生成回调安全） */
export function useStudio() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [ready, setReady] = useState(false);
  const [past, setPast] = useState<Episode[][]>([]);
  const [future, setFuture] = useState<Episode[][]>([]);
  const [activeEpIndex, setActiveEpIndex] = useState(0);
  const [activeKeyframeId, setActiveKeyframeId] = useState<string | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [project, setProject] = useState<StudioState["project"] | null>(null);

  const episodesRef = useRef(episodes);
  episodesRef.current = episodes;
  const projectRef = useRef(project);
  projectRef.current = project;

  // 初始拉取 store（server 单一真源）
  useEffect(() => {
    fetch("/api/studio/state")
      .then((r) => r.json())
      .then((s: Partial<StudioState>) => {
        setEpisodes((s as { episodes: Episode[] }).episodes ?? []);
        if (s.project) setProject(s.project);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  /**
   * 四端同构的提交：本地 runOp 乐观执行（撤销栈快照）+ POST 同一 op 给 server（store 落盘）。
   * CLI `apa op` / MCP call_op / 页面按钮 —— 全部是同一 ops 注册表。
   */
  const commit = useCallback((op: string, args: Record<string, unknown>) => {
    setPast((p) => [...p.slice(-49), clone(episodesRef.current)]);
    setFuture([]);
    setEpisodes((prev) => {
      const next = structuredClone(prev);
      try {
        runOp({ project: projectRef.current!, episodes: next }, op, args);
      } catch (e) {
        console.warn(`op ${op} 本地执行失败：`, (e as Error).message);
        return prev;
      }
      return next;
    });
    fetch("/api/studio/op", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op, args }),
    }).catch(() => undefined);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      setFuture((f) => [clone(episodesRef.current), ...f.slice(0, 49)]);
      setEpisodes(p[p.length - 1]);
      commit("studio.replaceState", { episodes: p[p.length - 1] });
      return p.slice(0, -1);
    });
  }, [commit]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p.slice(-49), clone(episodesRef.current)]);
      setEpisodes(f[0]);
      commit("studio.replaceState", { episodes: f[0] });
      return f.slice(1);
    });
  }, [commit]);

  const episode = episodes.length > 0 ? episodes[Math.min(activeEpIndex, episodes.length - 1)] : null;

  /** 生成类：本地乐观置 generating + delayMs 后本地完成；server 端 scheduleCompletion 同步落盘 */
  const generateKeyframe = useCallback(
    (kfId: string) => {
      const e = episodesRef.current.find((x) => x.keyframes.some((k) => k.id === kfId));
      const k = e?.keyframes.find((x) => x.id === kfId);
      if (!k || k.status === "generating" || k.status === "picked") return;
      const delayMs = 1300;
      commit("keyframe.generate", { kfId, delayMs });
      setTimeout(() => {
        commit("keyframe.completeGeneration", { kfId });
      }, delayMs + 60);
    },
    [commit],
  );

  const generateSegment = useCallback(
    (segId: string) => {
      const e = episodesRef.current.find((x) => x.segments.some((s) => s.id === segId));
      const s = e?.segments.find((x) => x.id === segId);
      if (!s || s.status === "generating" || s.status === "ready" || s.promptStale) return;
      const kf = e?.keyframes.find((k) => k.id === s.fromKeyframeId);
      if (!kf || kf.status !== "picked") return;
      const delayMs = 1600;
      commit("segment.generate", { segId, delayMs });
      setTimeout(() => {
        commit("segment.completeGeneration", { segId });
      }, delayMs + 60);
    },
    [commit],
  );

  const pickImageVariant = useCallback(
    (kfId: string, variantId: string) => commit("keyframe.pick", { kfId, variantId }),
    [commit],
  );
  const rejectImageVariant = useCallback(
    (kfId: string, variantId: string, reason: string) =>
      commit("keyframe.reject", { kfId, variantId, reason }),
    [commit],
  );
  const pickVideoVariant = useCallback(
    (segId: string, variantId: string) => commit("segment.pick", { segId, variantId }),
    [commit],
  );
  const rejectVideoVariant = useCallback(
    (segId: string, variantId: string, reason: string) =>
      commit("segment.reject", { segId, variantId, reason }),
    [commit],
  );
  const updateKeyframe = useCallback(
    (kfId: string, patch: object) => commit("keyframe.patch", { kfId, patch }),
    [commit],
  );
  const updateSegment = useCallback(
    (segId: string, patch: object) => commit("segment.patch", { segId, patch }),
    [commit],
  );
  const insertKeyframes = useCallback(
    (afterKfId: string, n: number) => commit("keyframe.insert", { afterKfId, n }),
    [commit],
  );
  const planKeyframesFromBeats = useCallback(
    (episodeId: string) => commit("episode.planKeyframes", { episodeId }),
    [commit],
  );
  const alignBeatChanges = useCallback(
    (episodeId: string, beatId: string) => commit("episode.alignBeat", { episodeId, beatId }),
    [commit],
  );
  const updateEpisodeMeta = useCallback(
    (episodeId: string, patch: object) => commit("episode.setMeta", { episodeId, patch }),
    [commit],
  );

  const gateOpen = episode ? allKeyframesPicked(episode) : false;

  /** 批量生成：逐个走单个 generate op（server 端各自调度完成） */
  const batchGenerateKeyframes = useCallback(() => {
    if (!episode) return;
    episode.keyframes
      .filter((k) => k.status === "draft")
      .forEach((k, i) => setTimeout(() => generateKeyframe(k.id), i * 250));
  }, [episode, generateKeyframe]);

  const batchGenerateSegments = useCallback(() => {
    if (!episode || !gateOpen) return;
    episode.segments
      .filter((s) => s.status === "draft" || s.status === "planned")
      .forEach((s, i) => setTimeout(() => generateSegment(s.id), i * 250));
  }, [episode, gateOpen, generateSegment]);

  const batchRetryFailed = useCallback(() => {
    if (!episode) return;
    episode.segments
      .filter(
        (s) =>
          (s.status === "stale" || (s.status === "failed" && s.attributedFailure)) &&
          !s.promptStale &&
          episode.keyframes.find((k) => k.id === s.fromKeyframeId)?.status === "picked",
      )
      .forEach((s, i) => setTimeout(() => generateSegment(s.id), i * 250));
  }, [episode, generateSegment]);

  function addEpisode() {
    if (!episode) return;
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
    setPast((p) => [...p.slice(-49), clone(episodesRef.current)]);
    setEpisodes((eps) => [...eps, ep]);
    commit("studio.replaceState", { episodes: [...episodesRef.current, ep] });
    setActiveEpIndex(episodes.length);
    setActiveKeyframeId(null);
    setActiveSegmentId(null);
  }

  const stats = useMemo(() => {
    if (!episode)
      return {
        pickedKf: 0,
        totalKf: 0,
        readySeg: 0,
        totalSeg: 0,
        cost: 0,
        duration: 0,
        selection: { picked: 0, total: 0, ratio: 0 },
      };
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

  const budget = useMemo(() => {
    if (!episode) return { spent: 0, estimate: 0, cap: 1 };
    const spent = episodeCost(episode);
    const pendingEstimate = episode.segments
      .filter((s) => s.status !== "ready")
      .reduce(
        (a, s) => a + estimateClipCost(s.modelId, s.resolution, s.duration) * 2,
        0,
      );
    const cap = episode.segments.reduce(
      (a, s) => a + estimateClipCost(s.modelId, s.resolution, s.duration) * 3,
      0,
    );
    return { spent, estimate: spent + pendingEstimate, cap };
  }, [episode]);

  const unattributedFailed = episode
    ? episode.segments.filter((s) => s.status === "failed" && !s.attributedFailure)
    : [];

  return {
    ready,
    project,
    episodes,
    episode,
    activeEpIndex,
    setActiveEpIndex,
    addEpisode,
    updateEpisodeMeta,
    activeKeyframeId,
    setActiveKeyframeId,
    activeSegmentId,
    setActiveSegmentId,
    updateKeyframe,
    updateSegment,
    generateKeyframe,
    generateSegment,
    pickImageVariant,
    rejectImageVariant,
    pickVideoVariant,
    rejectVideoVariant,
    insertKeyframes,
    planKeyframesFromBeats,
    alignBeatChanges,
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
    attributeFailure: (segId: string, mode: string) => commit("segment.attribute", { segId, mode }),
    unattributedFailed,
    gateOpen,
    stats,
    budget,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
  };
}
