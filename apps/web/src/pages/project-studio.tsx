import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Clapperboard,
  PenLine,
  Plus,
  Redo2,
  Sparkles,
  Undo2,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { formatDuration, type Shot, type ShotStatus } from "@dimples/apa-shared";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useStudio, type StudioMode } from "@/hooks/use-studio";
import { EpisodeStrip } from "@/components/studio/episode-strip";
import { ShotList } from "@/components/studio/shot-list";
import { PreviewPane } from "@/components/studio/preview-pane";
import { InspectorPanel } from "@/components/studio/inspector-panel";
import { Timeline } from "@/components/studio/timeline";
import { ScriptMode } from "@/components/studio/script-mode";

const MODES: { key: StudioMode; label: string }[] = [
  { key: "storyboard", label: "分镜工作台" },
  { key: "script", label: "剧本" },
];

export default function ProjectStudioPage() {
  const { id } = useParams<{ id: string }>();
  const project = {
    id: id ?? "p-002",
    name: "星际摆渡人",
    logline: "末日地球最后一位星际摆渡人，驾驶旧飞船护送三千沉睡者前往新家园。",
    cover: "/covers/p-002.jpg",
    genre: "科幻",
    status: "post" as const,
    progress: 84,
    members: ["白鹿", "程一苇"],
    updatedAt: "2026-10-11T14:30:00.000Z",
  };

  const studio = useStudio();
  const {
    episodes,
    episode,
    activeEpIndex,
    setActiveEpIndex,
    addEpisode,
    updateEpisode,
    activeShot,
    setActiveShotId,
    filteredStatus,
    setFilteredStatus,
    visibleShots,
    total,
    readyCount,
    canUndo,
    canRedo,
    undo,
    redo,
    updateShot,
    addShot,
  } = studio;

  const [mode, setMode] = useState<StudioMode>("storyboard");
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setPlayhead((p) => {
        if (p + 0.1 >= total) {
          setPlaying(false);
          return total;
        }
        return Math.round((p + 0.1) * 10) / 10;
      });
    }, 100);
    return () => clearInterval(t);
  }, [playing, total]);

  function switchEpisode(i: number) {
    setActiveEpIndex(i);
    setPlaying(false);
    setPlayhead(0);
  }

  function togglePlay() {
    if (!playing && playhead >= total) setPlayhead(0);
    setPlaying((p) => !p);
  }

  /** 单镜头生成：draft/keyframe/failed → generating；generating → ready（模拟完成） */
  function generateShot(shot: Shot) {
    if (shot.status === "generating") {
      updateShot(shot.id, { status: "ready" });
    } else {
      updateShot(shot.id, {
        status: "generating",
        failureReason: undefined,
        attempts: (shot.attempts ?? 0) + 1,
      });
    }
  }

  /** 图例筛选联动：自动选中该状态的首个镜头（筛失败即看失败） */
  function handleFilter(s: ShotStatus | null) {
    setFilteredStatus(s);
    if (s) {
      const first = episode.shots.find((x) => x.status === s);
      if (first) setActiveShotId(first.id);
    }
  }

  /** AI 补全全集守卫：无大纲或无剧本时禁用（先有故事，再谈画面） */
  const aiBlocked =
    !episode.synopsis.trim() || episode.scriptScenes.length === 0 || episode.shots.length === 0;

  function completeEpisode() {
    const targets = episode.shots.filter(
      (s) => s.status === "draft" || s.status === "keyframe" || s.status === "failed",
    );
    if (targets.length === 0) {
      toast.info("本集所有镜头均已就绪");
      return;
    }
    for (const s of targets) generateShot(s);
    toast.success(`已提交 ${targets.length} 个镜头的生成任务（演示）`);
  }

  function createShotFromScene(sceneId: string, description: string) {
    addShot({
      sceneId,
      description,
      keyframe: { description },
      status: "draft",
      camera: "固定",
    });
    setMode("storyboard");
    setFilteredStatus(null);
    toast.success("已从场次生成镜头，继续补关键帧");
  }

  const completion = (
    <div
      className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] tabular-nums text-muted-foreground md:flex"
      title={`本集完成度：${readyCount}/${episode.shots.length} 镜就绪`}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          episode.shots.length === 0 ? "bg-zinc-600" : "bg-emerald-500",
        )}
      />
      {episode.shots.length === 0 ? (
        <span>空集</span>
      ) : (
        <>
          <span className="text-foreground/80">
            {readyCount}/{episode.shots.length}
          </span>
          镜就绪
        </>
      )}
      <span className="text-muted-foreground/60">· {formatDuration(total)}</span>
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-svh flex-col bg-background">
        {/* ── 顶栏 ── */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Button variant="ghost" size="icon" className="size-8" asChild>
            <Link to="/projects" aria-label="返回项目列表">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex min-w-0 items-center gap-2">
            <Clapperboard className="size-4 shrink-0 text-muted-foreground" />
            <span className="max-w-40 truncate text-[13px] font-medium sm:max-w-none">
              {project.name}
            </span>
          </div>

          {/* 模式切换 */}
          <div className="ml-1 flex items-center rounded-md border p-0.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={cn(
                  "flex h-6 items-center gap-1 rounded px-2 text-[12px] whitespace-nowrap transition-colors",
                  mode === m.key
                    ? "bg-foreground/[0.08] font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.key === "script" ? <PenLine className="size-3" /> : null}
                <span className="sm:hidden">{m.key === "script" ? "剧本" : "分镜"}</span>
                <span className="max-sm:hidden">{m.label}</span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {completion}
            <div
              className="hidden items-center gap-1 text-[11px] tabular-nums text-muted-foreground lg:flex"
              title="演示数据：本月剩余 AI 生成点数"
            >
              <Sparkles className="size-3" />
              1,280 点
            </div>
            <Separator orientation="vertical" className="hidden h-5 sm:block" />
            <div className="hidden items-center sm:flex">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-r-none"
                onClick={undo}
                disabled={!canUndo}
                aria-label="撤销"
                title="撤销"
              >
                <Undo2 className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-l-none border-l"
                onClick={redo}
                disabled={!canRedo}
                aria-label="重做"
                title="重做"
              >
                <Redo2 className="size-3.5" />
              </Button>
            </div>
            {mode === "storyboard" ? (
              <Button
                variant="outline"
                size="sm"
                className="hidden gap-1.5 sm:inline-flex"
                onClick={() => addShot()}
              >
                <Plus className="size-3.5" />
                镜头
              </Button>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    size="sm"
                    aria-label="AI 补全全集"
                    className={cn("gap-1.5", aiBlocked && "opacity-45 saturate-0")}
                    onClick={completeEpisode}
                    disabled={aiBlocked}
                  >
                    <Sparkles className="size-3.5" />
                    <span className="max-sm:hidden">AI 补全全集</span>
                  </Button>
                </span>
              </TooltipTrigger>
              {aiBlocked ? (
                <TooltipContent>
                  先在「剧本」模式补全本集大纲与场次，再让 AI 按关键帧补全画面
                </TooltipContent>
              ) : null}
            </Tooltip>
          </div>
        </header>

        {/* ── 横向集条 ── */}
        <EpisodeStrip
          episodes={episodes}
          activeIndex={activeEpIndex}
          onSelect={switchEpisode}
          onAdd={addEpisode}
        />

        {/* ── 主体 ── */}
        {mode === "script" ? (
          <ScriptMode
            episode={episode}
            onEpisodeChange={updateEpisode}
            onCreateShotFromScene={createShotFromScene}
          />
        ) : (
          <div className="flex min-h-0 flex-1">
            <aside className="hidden w-72 shrink-0 flex-col border-r lg:flex">
              <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
                <span className="text-[12px] text-muted-foreground">
                  镜头{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {filteredStatus ? `${visibleShots.length}/${episode.shots.length}` : episode.shots.length}
                  </span>
                  <span className="ml-2">成片 {readyCount}</span>
                </span>
                <span className="text-[12px] tabular-nums text-muted-foreground">
                  {formatDuration(total)}
                </span>
              </div>
              <ShotList
                shots={visibleShots}
                activeShotId={activeShot?.id ?? null}
                onSelect={setActiveShotId}
                onAdd={() => addShot()}
                emptyHint={
                  filteredStatus
                    ? "没有符合筛选的镜头，点击时间线图例清除筛选"
                    : "本集还没有镜头，从顶部添加或切到「剧本」从场次生成"
                }
              />
            </aside>

            <main className="flex min-w-0 flex-1 flex-col">
              {/* 移动端镜头横滑条 */}
              <div className="flex gap-1.5 overflow-x-auto border-b p-2 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
                {episode.shots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveShotId(s.id)}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[12px] tabular-nums",
                      s.id === activeShot?.id
                        ? "border-foreground/45 bg-foreground/[0.08] font-medium text-foreground"
                        : "text-muted-foreground hover:border-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        s.status === "ready" && "bg-emerald-400",
                        s.status === "generating" && "bg-[#0070f3]",
                        s.status === "keyframe" && "bg-amber-400",
                        s.status === "failed" && "bg-destructive",
                        s.status === "draft" && "bg-zinc-500",
                      )}
                    />
                    {s.code}
                    <span className="text-muted-foreground/60">{s.duration}s</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => addShot()}
                  className="flex h-9 shrink-0 items-center rounded-md border border-dashed px-2.5 text-[12px] text-muted-foreground"
                >
                  <Plus className="size-3" />
                </button>
              </div>
              <PreviewPane
                shot={activeShot}
                episodeMeta={{
                  number: episode.number,
                  title: episode.title,
                  total: episode.shots.length,
                  index: episode.shots.findIndex((s) => s.id === activeShot?.id) + 1,
                }}
                onGenerate={() => activeShot && generateShot(activeShot)}
              />
              <Timeline
                shots={episode.shots}
                activeShotId={activeShot?.id ?? null}
                onSelect={setActiveShotId}
                total={total}
                statusFilter={filteredStatus}
                onFilterChange={handleFilter}
                playhead={playhead}
                playing={playing}
                onTogglePlay={togglePlay}
              />
            </main>

            <aside className="hidden w-80 shrink-0 flex-col border-l lg:flex">
              {activeShot ? (
                <InspectorPanel
                  shot={activeShot}
                  onChange={(patch) => updateShot(activeShot.id, patch)}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center px-6">
                  <div className="flex max-w-52 flex-col items-center gap-2.5 rounded-lg border border-dashed p-5 text-center text-muted-foreground">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-6 opacity-60"
                    >
                      <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
                      <path d="m6.2 5.3 3.1 3.9" />
                      <path d="m12.4 3.4 3.1 4" />
                      <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                    </svg>
                    <p className="text-[12px] leading-5">
                      选中一个镜头后，在这里编辑关键帧与导演意图
                    </p>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
