import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Clapperboard,
  FileCheck,
  Layers,
  ListChecks,
  PenLine,
  Redo2,
  Sparkles,
  Undo2,
  Workflow,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { formatDuration, formatMoney } from "@dimples/apa-shared";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useStudio, type StudioMode } from "@/hooks/use-studio";
import { useUiBridge } from "@/hooks/use-ui-bridge";
import { initWebMcp, registerCommand } from "@/lib/webmcp";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CanvasView } from "@/components/studio/canvas-view";
import { EpisodeStrip } from "@/components/studio/episode-strip";
import { ShotListTable } from "@/components/studio/shot-list-table";
import { CandidateDrawer } from "@/components/studio/candidate-drawer";
import { PreviewView } from "@/components/studio/preview-view";
import { PlanView } from "@/components/studio/plan-view";
import { InsightView } from "@/components/studio/insight-view";

const MODES: { key: StudioMode; label: string; icon: typeof ListChecks }[] = [
  { key: "shotlist", label: "制作清单", icon: ListChecks },
  { key: "canvas", label: "管线画布", icon: Workflow },
  { key: "preview", label: "拼装预览", icon: Layers },
  { key: "plan", label: "剧本规划", icon: PenLine },
  { key: "insight", label: "质检素材", icon: FileCheck },
];

export default function ProjectStudioPage() {
  const { id } = useParams<{ id: string }>();
  const project = {
    id: id ?? "p-007",
    name: "雾岛来电",
    format: "竖屏 AI 短剧 · 12 集",
  };
  const studio = useStudio();
  const { episode, stats, budget, canUndo, canRedo, undo, redo } = studio;
  const [mode, setMode] = useState<StudioMode>("shotlist");
  const [drawerOpen, setDrawerOpen] = useState(false);
  useUiBridge();

  // ── Chrome WebMCP / window.__apaWebMcp：页面级命令总线（事无巨细的工具面）──
  const studioRef = useRef(studio);
  studioRef.current = studio;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const drawerRef = useRef(drawerOpen);
  drawerRef.current = drawerOpen;

  useEffect(() => {
    const s = () => studioRef.current;
    const resolveKf = (id: string) => {
      const e = s().episode;
      return e?.keyframes.find((k) => k.id === id || k.code === id);
    };
    const resolveSeg = (id: string) => {
      const e = s().episode;
      return e?.segments.find((x) => x.id === id || x.code === id);
    };
    const requireKf = (id: string) => {
      const k = resolveKf(id);
      if (!k) throw new Error(`关键帧不存在：${id}`);
      return k;
    };
    const requireSeg = (id: string) => {
      const x = resolveSeg(id);
      if (!x) throw new Error(`演绎段不存在：${id}`);
      return x;
    };

    registerCommand("ui_state", () => ({
      mode: modeRef.current,
      episode: s().episode?.id ?? null,
      activeKeyframeId: s().activeKeyframeId,
      activeSegmentId: s().activeSegmentId,
      drawerOpen: drawerRef.current,
      selected: [...s().selectedIds],
      gateOpen: s().gateOpen,
      stats: s().stats,
    }));
    registerCommand("navigate", (a) => setMode(a.mode as StudioMode));
    registerCommand("select_episode", (a) => {
      const idx = Number(a.index ?? 1) - 1;
      s().setActiveEpIndex(Math.max(0, idx));
      s().setSelectedIds(new Set());
    });
    registerCommand("select_keyframe", (a) => {
      const k = requireKf(String(a.id));
      s().setActiveKeyframeId(k.id);
      s().setActiveSegmentId(null);
      setDrawerOpen(true);
    });
    registerCommand("select_segment", (a) => {
      const x = requireSeg(String(a.id));
      s().setActiveSegmentId(x.id);
      s().setActiveKeyframeId(null);
      setDrawerOpen(true);
    });
    registerCommand("keyframe_generate", (a) => s().generateKeyframe(requireKf(String(a.id)).id));
    registerCommand("keyframe_pick", (a) =>
      s().pickImageVariant(requireKf(String(a.id)).id, String(a.variantId)),
    );
    registerCommand("keyframe_reject", (a) =>
      s().rejectImageVariant(requireKf(String(a.id)).id, String(a.variantId), String(a.reason)),
    );
    registerCommand("keyframe_insert", (a) => {
      const k = requireKf(String(a.afterId));
      s().insertKeyframes(k.id, Number(a.n ?? 1));
    });
    registerCommand("segment_generate", (a) => s().generateSegment(requireSeg(String(a.id)).id));
    registerCommand("segment_attribute", (a) =>
      s().attributeFailure(requireSeg(String(a.id)).id, String(a.mode)),
    );
    registerCommand("batch_generate_keyframes", () => s().batchGenerateKeyframes());
    registerCommand("batch_generate_segments", () => s().batchGenerateSegments());
    registerCommand("batch_retry", () => s().batchRetryFailed());
    registerCommand("undo", () => s().undo());
    registerCommand("redo", () => s().redo());
    registerCommand("open_candidates", () => setDrawerOpen(true));
    registerCommand("close_drawer", () => setDrawerOpen(false));

    initWebMcp();
  }, []);

  /** 一键管线（环节级批量执行 + 计划预审；与 CLI apa pipeline / MCP pipeline_* 同一 ops） */
  function pipeline(op: "pipeline.plan" | "pipeline.execute" | "pipeline.finalize", stage?: string) {
    if (!episode) return;
    const eid = episode.id;
    fetch("/api/studio/op", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        op,
        args: { episodeId: eid, ...(stage ? { stage, sync: true } : {}) },
      }),
    })
      .then((r) => r.json())
      .then((res) => {
        const note =
          res?.result?.note ??
          res?.result?.blocked ??
          (res?.result?.manifest ? "清单已生成（见控制台）" : "已完成");
        console.log("[pipeline]", op, res?.result);
        toast(note as string);
        if (op === "pipeline.plan" || op === "pipeline.execute") {
          fetch("/api/studio/state")
            .then((r) => r.json())
            .then((s: { episodes: typeof episode }) => {
              // 以 server 为准刷新（本地乐观与 server 完成态对齐）
              studio.setSelectedIds(new Set());
              window.dispatchEvent(new CustomEvent("apa:state-refreshed", { detail: s.episodes }));
            });
        }
      });
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-svh flex-col bg-background">
        {!episode ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
            正在从 store 载入工作台…
          </div>
        ) : (
        <>
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
            <span className="max-w-36 truncate text-[13px] font-medium sm:max-w-none">
              {project.name}
            </span>
            <span className="hidden rounded-full border px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground md:inline">
              {episode.aspectRatio} · {project.format}
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
                <m.icon className="size-3" />
                <span className="hidden sm:inline">{m.label}</span>
                <span className="sm:hidden">{m.label.slice(0, 2)}</span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* 管线总览徽章：定稿/成本/选优率 */}
            <div className="hidden items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] tabular-nums text-muted-foreground lg:flex">
              <span className="flex items-center gap-1">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    stats.pickedKf === stats.totalKf && stats.totalKf > 0
                      ? "bg-emerald-500"
                      : "bg-amber-400",
                  )}
                />
                {stats.pickedKf}/{stats.totalKf} 帧 · {stats.readySeg}/{stats.totalSeg} 段
              </span>
              <span className="text-border">|</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex cursor-help items-center gap-1.5">
                    <span className="text-foreground/75">{formatMoney(stats.cost)}</span>
                    <span className="relative h-1 w-12 overflow-hidden rounded-full bg-muted">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/70"
                        style={{ width: `${Math.min(100, (budget.spent / (budget.cap || 1)) * 100)}%` }}
                      />
                      <span
                        className={cn(
                          "absolute inset-y-0 w-px",
                          budget.estimate > budget.cap * 0.8 ? "bg-red-400" : "bg-foreground/60",
                        )}
                        style={{ left: `${Math.min(100, (budget.estimate / (budget.cap || 1)) * 100)}%` }}
                      />
                    </span>
                    <span
                      className={cn(
                        budget.estimate > budget.cap * 0.8 ? "text-red-400" : "text-muted-foreground/60",
                      )}
                    >
                      预估 {formatMoney(budget.estimate)}
                    </span>
                    <span className="text-muted-foreground/60">/ {formatMoney(budget.cap)}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-[11px] leading-4">
                  已花 {formatMoney(budget.spent)}（仅成功计费）· 完成预估{" "}
                  {formatMoney(budget.estimate)}（待生成段 ×2 重试）· 上限 {formatMoney(budget.cap)}{" "}
                  （全部段 ×3）· 预估超上限 80% 转红
                </TooltipContent>
              </Tooltip>
              <span className="text-border">|</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    选优 {Math.round(stats.selection.ratio * 100)}%
                  </span>
                </TooltipTrigger>
                <TooltipContent className="text-[11px]">
                  {stats.selection.picked}/{stats.selection.total} 采纳 · 行业基线 20–27:1 生成:可用
                </TooltipContent>
              </Tooltip>
              <span className="text-border">|</span>
              <span>{formatDuration(stats.duration)}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="hidden gap-1.5 md:inline-flex">
                  <Sparkles className="size-3.5" />
                  一键管线
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => pipeline("pipeline.plan")}>
                  生成计划（剧本→帧骨架）
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => pipeline("pipeline.execute", "keyframes")}>
                  执行：批量生成静帧
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => pipeline("pipeline.execute", "videos")}>
                  执行：批量生成视频
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => pipeline("pipeline.finalize")}>
                  粗剪清单（导出）
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          </div>
        </header>

        {/* ── 横向集条 ── */}
        <EpisodeStrip
          episodes={studio.episodes}
          activeIndex={studio.activeEpIndex}
          onSelect={(i) => {
            studio.setActiveEpIndex(i);
            studio.setSelectedIds(new Set());
          }}
          onAdd={studio.addEpisode}
        />

        {/* ── 主体 ── */}
        {mode === "shotlist" ? (
          <ShotListTable studio={studio} onOpenCandidates={() => setDrawerOpen(true)} />
        ) : mode === "canvas" ? (
          <CanvasView studio={studio} onOpenCandidates={() => setDrawerOpen(true)} />
        ) : mode === "preview" ? (
          <PreviewView studio={studio} onOpenCandidates={() => setDrawerOpen(true)} />
        ) : mode === "insight" ? (
          <InsightView studio={studio} />
        ) : (
          <PlanView studio={studio} />
        )}

        <CandidateDrawer studio={studio} open={drawerOpen} onOpenChange={setDrawerOpen} />
        </>
        )}
      </div>
    </TooltipProvider>
  );
}
