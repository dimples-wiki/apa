import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Clapperboard, Film, Plus, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router";
import {
  episodeDuration,
  formatDuration,
  mockEpisodes,
  type Episode,
  type Shot,
} from "@dimples/apa-shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ShotList } from "@/components/studio/shot-list";
import { PreviewPane } from "@/components/studio/preview-pane";
import { InspectorPanel } from "@/components/studio/inspector-panel";
import { Timeline } from "@/components/studio/timeline";

export default function ProjectStudioPage() {
  const { id } = useParams<{ id: string }>();
  const project = useMemo(
    () => ({
      id: id ?? "p-002",
      name: "星际摆渡人",
      logline: "末日地球最后一位星际摆渡人，驾驶旧飞船护送三千沉睡者前往新家园。",
      cover: "/covers/p-002.jpg",
      genre: "科幻",
      status: "post" as const,
      progress: 84,
      members: ["白鹿", "程一苇"],
      updatedAt: "2026-10-11T14:30:00.000Z",
    }),
    [id],
  );

  const [episodes, setEpisodes] = useState<Episode[]>(() => structuredClone(mockEpisodes));
  const [activeEp, setActiveEp] = useState(0);
  const episode = episodes[activeEp];
  const [activeShotId, setActiveShotId] = useState(episode.shots[0]?.id ?? "");
  const activeShot = episode.shots.find((s) => s.id === activeShotId) ?? episode.shots[0];

  const total = episodeDuration(episode);
  const readyCount = episode.shots.filter((s) => s.status === "ready").length;

  function updateShot(shotId: string, patch: Partial<Shot>) {
    setEpisodes((eps) =>
      eps.map((ep, i) =>
        i === activeEp
          ? { ...ep, shots: ep.shots.map((s) => (s.id === shotId ? { ...s, ...patch } : s)) }
          : ep,
      ),
    );
  }

  function addShot() {
    const code = `S${String(episode.number).padStart(2, "0")}-${String(episode.shots.length + 1).padStart(2, "0")}`;
    const shot: Shot = {
      id: `sh-new-${Date.now()}`,
      code,
      duration: 5,
      description: "",
      camera: "固定",
      keyframe: { description: "" },
      status: "draft",
    };
    setEpisodes((eps) =>
      eps.map((ep, i) => (i === activeEp ? { ...ep, shots: [...ep.shots, shot] } : ep)),
    );
    setActiveShotId(shot.id);
  }

  function addEpisode() {
    const next = episodes.length + 1;
    const ep: Episode = {
      id: `ep-new-${Date.now()}`,
      number: next,
      title: `第 ${next} 集`,
      logline: "",
      shots: [],
    };
    setEpisodes((eps) => [...eps, ep]);
    setActiveEp(episodes.length);
    setActiveShotId("");
  }

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
            <span className="truncate text-[13px] font-medium">{project.name}</span>
          </div>

          <EpisodeSwitcher
            episodes={episodes}
            activeIndex={activeEp}
            onSelect={setActiveEp}
            onAdd={addEpisode}
          />

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={addShot}>
              <Plus className="size-3.5" />
              镜头
            </Button>
            <Button size="sm" className="gap-1.5">
              <Sparkles className="size-3.5" />
              AI 补全全集
            </Button>
          </div>
        </header>

        {/* ── 三栏主体 ── */}
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-72 shrink-0 flex-col border-r lg:flex">
            <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
              <span className="text-[12px] font-medium text-muted-foreground">
                镜头 {episode.shots.length} · 成片 {readyCount}
              </span>
              <span className="text-[12px] tabular-nums text-muted-foreground">
                {formatDuration(total)}
              </span>
            </div>
            <ShotList
              shots={episode.shots}
              activeShotId={activeShotId}
              onSelect={setActiveShotId}
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
                    s.id === activeShotId
                      ? "border-foreground/45 bg-foreground/[0.08] font-medium text-foreground"
                      : "text-muted-foreground hover:border-foreground/30",
                  )}
                >
                  {s.code}
                  <span className="text-muted-foreground/60">{s.duration}s</span>
                </button>
              ))}
              <button
                type="button"
                onClick={addShot}
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
              onGenerate={() =>
                activeShot &&
                updateShot(activeShot.id, {
                  status: activeShot.status === "ready" ? "keyframe" : "ready",
                })
              }
            />
            <Timeline
              shots={episode.shots}
              activeShotId={activeShotId}
              onSelect={setActiveShotId}
              total={total}
            />
          </main>

          <aside className="hidden w-80 shrink-0 flex-col border-l lg:flex">
            {activeShot ? (
              <InspectorPanel
                shot={activeShot}
                onChange={(patch) => updateShot(activeShot.id, patch)}
              />
            ) : null}
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}

function EpisodeSwitcher({
  episodes,
  activeIndex,
  onSelect,
  onAdd,
}: {
  episodes: Episode[];
  activeIndex: number;
  onSelect: (i: number) => void;
  onAdd: () => void;
}) {
  const ep = episodes[activeIndex];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-2.5">
          <Film className="size-3.5 text-muted-foreground" />
          <span className="text-[13px]">
            第 {ep.number} 集 · {ep.title}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>剧集</DropdownMenuLabel>
        {episodes.map((e, i) => (
          <DropdownMenuItem key={e.id} onClick={() => onSelect(i)} className="gap-2">
            <span className="tabular-nums text-muted-foreground">
              EP{String(e.number).padStart(2, "0")}
            </span>
            <span className="flex-1 truncate">{e.title}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {formatDuration(episodeDuration(e))}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAdd} className="gap-2 text-muted-foreground">
          <Plus className="size-3.5" />
          新增一集
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
