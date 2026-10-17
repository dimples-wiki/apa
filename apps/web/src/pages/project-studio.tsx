import { useState } from "react";
import {
  ArrowLeft,
  Clapperboard,
  FileCheck,
  Layers,
  ListChecks,
  PenLine,
  Redo2,
  Undo2,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { formatDuration, formatMoney } from "@dimples/apa-shared";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useStudio, type StudioMode } from "@/hooks/use-studio";
import { EpisodeStrip } from "@/components/studio/episode-strip";
import { ShotListTable } from "@/components/studio/shot-list-table";
import { CandidateDrawer } from "@/components/studio/candidate-drawer";
import { PreviewView } from "@/components/studio/preview-view";
import { PlanView } from "@/components/studio/plan-view";
import { InsightView } from "@/components/studio/insight-view";

const MODES: { key: StudioMode; label: string; icon: typeof ListChecks }[] = [
  { key: "shotlist", label: "制作清单", icon: ListChecks },
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
        ) : mode === "preview" ? (
          <PreviewView studio={studio} onOpenCandidates={() => setDrawerOpen(true)} />
        ) : mode === "insight" ? (
          <InsightView studio={studio} />
        ) : (
          <PlanView studio={studio} />
        )}

        <CandidateDrawer studio={studio} open={drawerOpen} onOpenChange={setDrawerOpen} />
      </div>
    </TooltipProvider>
  );
}
