import { useCallback, useMemo, useState } from "react";
import {
  episodeDuration,
  mockEpisodes,
  type Episode,
  type Shot,
  type ShotStatus,
} from "@dimples/apa-shared";

export type StudioMode = "storyboard" | "script";

const clone = (eps: Episode[]): Episode[] => structuredClone(eps);

/** 工作台状态中枢：集/镜头数据 + 撤销栈 + 选中 + 状态筛选 */
export function useStudio() {
  const [episodes, setEpisodes] = useState<Episode[]>(() => clone(mockEpisodes));
  const [past, setPast] = useState<Episode[][]>([]);
  const [future, setFuture] = useState<Episode[][]>([]);
  const [activeEpIndex, setActiveEpIndex] = useState(0);
  const [activeShotId, setActiveShotId] = useState<string | null>(
    mockEpisodes[0]?.shots[0]?.id ?? null,
  );
  const [filteredStatus, setFilteredStatus] = useState<ShotStatus | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const episode = episodes[Math.min(activeEpIndex, episodes.length - 1)];
  const activeShot =
    episode.shots.find((s) => s.id === activeShotId) ?? episode.shots[0] ?? null;

  /** 破坏性/编辑性变更统一走 commit（自动入撤销栈） */
  const commit = useCallback(
    (fn: (eps: Episode[]) => Episode[]) => {
      setPast((p) => [...p.slice(-49), clone(episodes)]);
      setFuture([]);
      setEpisodes((eps) => fn(eps));
    },
    [episodes],
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      setFuture((f) => [clone(episodes), ...f.slice(0, 49)]);
      setEpisodes(p[p.length - 1]);
      return p.slice(0, -1);
    });
  }, [episodes]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p.slice(-49), clone(episodes)]);
      setEpisodes(f[0]);
      return f.slice(1);
    });
  }, [episodes]);

  function updateShot(shotId: string, patch: Partial<Shot>) {
    commit((eps) =>
      eps.map((ep, i) =>
        i === activeEpIndex
          ? { ...ep, shots: ep.shots.map((s) => (s.id === shotId ? { ...s, ...patch } : s)) }
          : ep,
      ),
    );
  }

  function addShot(partial?: Partial<Shot>) {
    const ep = episodes[activeEpIndex];
    const shot: Shot = {
      id: `sh-new-${Date.now()}`,
      code: `S${String(ep.number).padStart(2, "0")}-${String(ep.shots.length + 1).padStart(2, "0")}`,
      sceneId: ep.scriptScenes[0]?.id,
      duration: 5,
      description: "",
      camera: "固定",
      keyframe: { description: "" },
      status: "draft",
      ...partial,
    };
    commit((eps) =>
      eps.map((e, i) => (i === activeEpIndex ? { ...e, shots: [...e.shots, shot] } : e)),
    );
    setActiveShotId(shot.id);
  }

  function deleteShot(shotId: string) {
    commit((eps) =>
      eps.map((e, i) =>
        i === activeEpIndex ? { ...e, shots: e.shots.filter((s) => s.id !== shotId) } : e,
      ),
    );
    setActiveShotId((cur) => (cur === shotId ? null : cur));
  }

  function moveShot(shotId: string, dir: -1 | 1) {
    commit((eps) =>
      eps.map((e, i) => {
        if (i !== activeEpIndex) return e;
        const shots = [...e.shots];
        const idx = shots.findIndex((s) => s.id === shotId);
        const next = idx + dir;
        if (idx < 0 || next < 0 || next >= shots.length) return e;
        [shots[idx], shots[next]] = [shots[next], shots[idx]];
        return { ...e, shots };
      }),
    );
  }

  function setShotDuration(shotId: string, duration: number) {
    updateShot(shotId, { duration: Math.max(1, Math.min(60, Math.round(duration))) });
  }

  function addEpisode() {
    const next = episodes.length + 1;
    const ep: Episode = {
      id: `ep-new-${Date.now()}`,
      number: next,
      title: `第 ${next} 集`,
      logline: "",
      synopsis: "",
      scriptScenes: [],
      shots: [],
    };
    commit((eps) => [...eps, ep]);
    setActiveEpIndex(episodes.length);
    setActiveShotId(null);
  }

  function updateEpisode(patch: Partial<Episode>) {
    commit((eps) => eps.map((e, i) => (i === activeEpIndex ? { ...e, ...patch } : e)));
  }

  const statusCounts = useMemo(() => {
    const c: Record<ShotStatus, number> = {
      draft: 0,
      keyframe: 0,
      generating: 0,
      ready: 0,
      failed: 0,
    };
    for (const s of episode.shots) c[s.status] += 1;
    return c;
  }, [episode]);

  const visibleShots = useMemo(
    () =>
      filteredStatus
        ? episode.shots.filter((s) => s.status === filteredStatus)
        : episode.shots,
    [episode, filteredStatus],
  );

  const activeShotIndex = episode.shots.findIndex((s) => s.id === activeShot?.id);

  return {
    episodes,
    episode,
    activeEpIndex,
    setActiveEpIndex,
    addEpisode,
    updateEpisode,
    activeShot,
    activeShotIndex,
    setActiveShotId,
    selectedIds,
    setSelectedIds,
    filteredStatus,
    setFilteredStatus,
    statusCounts,
    visibleShots,
    total: episodeDuration(episode),
    readyCount: statusCounts.ready,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    updateShot,
    addShot,
    deleteShot,
    moveShot,
    setShotDuration,
  };
}
