import { useMemo, useState } from "react";
import { Download, KeySquare, TriangleAlert } from "lucide-react";
import { formatMoney, getModel, type Episode, type Keyframe, type Segment } from "@dimples/apa-shared";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { useStudio } from "@/hooks/use-studio";

type Studio = ReturnType<typeof useStudio>;

const NODE_W = 92;
const NODE_H = 116;
const GAP = 104;
const EDGE_Y = -14;

const nodeTone: Record<Keyframe["status"], { ring: string; text: string; fill: string }> = {
  draft: { ring: "border-zinc-600", text: "text-zinc-400", fill: "bg-zinc-900" },
  generating: { ring: "border-[#0070f3]", text: "text-[#6cb8ff]", fill: "bg-[#0070f3]/10" },
  review: { ring: "border-amber-400", text: "text-amber-400", fill: "bg-amber-400/10" },
  picked: { ring: "border-emerald-400", text: "text-emerald-400", fill: "bg-emerald-400/10" },
};

const edgeTone: Record<Segment["status"], string> = {
  draft: "stroke-zinc-600 text-zinc-400",
  planned: "stroke-violet-400 text-violet-300",
  generating: "stroke-[#0070f3] text-[#6cb8ff]",
  ready: "stroke-emerald-400 text-emerald-300",
  failed: "stroke-red-400 text-red-300",
  stale: "stroke-amber-400 text-amber-300",
};

/**
 * 画布视图：关键帧=节点、演绎段=有向边的生产关系图（与时间线/清单同一 state）。
 * 画布转直观浏览的核心价值 = 关键路径高亮：哪一帧卡住全链一眼可见。
 */
export function CanvasView({
  studio,
  onOpenCandidates,
}: {
  studio: Studio;
  onOpenCandidates: () => void;
}) {
  const { episode } = studio;
  const [insertAt, setInsertAt] = useState<string | null>(null);
  if (!episode) return null;
  return <Canvas episode={episode} studio={studio} onOpenCandidates={onOpenCandidates} insertAt={insertAt} setInsertAt={setInsertAt} />;
}

function Canvas({
  episode,
  studio,
  onOpenCandidates,
  insertAt,
  setInsertAt,
}: {
  episode: Episode;
  studio: Studio;
  onOpenCandidates: () => void;
  insertAt: string | null;
  setInsertAt: (v: string | null) => void;
}) {
  const width = Math.max(720, episode.keyframes.length * (NODE_W + GAP) + 96);
  const nodeX = (i: number) => 48 + i * (NODE_W + GAP);
  const nodeY = 96;

  // 关键路径：from 帧未定稿的段 → 边标警 + 下游节点警示
  const blockedFrom = useMemo(() => {
    const set = new Set<string>();
    for (const s of episode.segments) {
      const k = episode.keyframes.find((x) => x.id === s.fromKeyframeId);
      if (s.status !== "ready" && (!k || k.status !== "picked")) set.add(s.fromKeyframeId);
    }
    return set;
  }, [episode]);

  function exportPipeline() {
    const manifest = {
      format: "apa-pipeline/1",
      episode: `${episode.number} - ${episode.title}`,
      aspectRatio: episode.aspectRatio,
      nodes: episode.keyframes.map((k) => ({
        id: k.id,
        code: k.code,
        status: k.status,
        shotSize: k.shotSize ?? null,
        imagePrompt: k.imagePrompt,
        negativePrompt: k.negativePrompt ?? null,
        references: k.references,
        pickedVariant: k.pickedVariantId ?? null,
      })),
      edges: episode.segments.map((s) => ({
        id: s.id,
        code: s.code,
        from: s.fromKeyframeId,
        to: s.toKeyframeId ?? null,
        status: s.status,
        model: s.modelId,
        resolution: s.resolution,
        duration: s.duration,
        // ComfyUI 注入点（批 3 接真实 provider 时的映射契约）
        injectionPoints: {
          firstFrame: s.fromVariantId ?? null,
          lastFrame: s.toKeyframeId ?? null,
          prompt: s.videoPrompt,
          seed: s.variants.find((v) => v.id === s.pickedVariantId)?.seed ?? null,
          length: s.duration,
        },
        cost: s.cost ?? 0,
      })),
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `EP${String(episode.number).padStart(2, "0")}_pipeline.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b px-4">
        <KeySquare className="size-3.5 text-muted-foreground" />
        <span className="text-[12px] font-medium">管线画布</span>
        <span className="text-[11px] text-muted-foreground">
          关键帧=节点 · 演绎段=有向边 · 红链=卡住全系的未定稿帧
        </span>
        <div className="ml-auto flex items-center gap-2">
          {blockedFrom.size > 0 ? (
            <span className="flex items-center gap-1 text-[11px] text-red-400">
              <TriangleAlert className="size-3" />
              关键路径 {blockedFrom.size} 帧阻塞
            </span>
          ) : (
            <span className="text-[11px] text-emerald-500">全链畅通</span>
          )}
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[12px]" onClick={exportPipeline}>
            <Download className="size-3.5" />
            导出管线 JSON
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <svg width={width} height={280} className="block">
          {/* 边（演绎段） */}
          {episode.segments.map((s) => {
            const fromIdx = episode.keyframes.findIndex((k) => k.id === s.fromKeyframeId);
            const toIdx = episode.keyframes.findIndex((k) => k.id === s.toKeyframeId);
            if (fromIdx < 0) return null;
            const x1 = nodeX(fromIdx) + NODE_W;
            const x2 = toIdx >= 0 ? nodeX(toIdx) : x1 + GAP;
            const mid = (x1 + x2) / 2;
            const blocked = blockedFrom.has(s.fromKeyframeId);
            const active = studio.activeSegmentId === s.id;
            return (
              <g
                key={s.id}
                className={cn("cursor-pointer", edgeTone[s.status])}
                onClick={() => {
                  studio.setActiveSegmentId(s.id);
                  studio.setActiveKeyframeId(null);
                  onOpenCandidates();
                }}
              >
                <line
                  x1={x1 + 4}
                  y1={nodeY + NODE_H / 2}
                  x2={x2 - 4}
                  y2={nodeY + NODE_H / 2}
                  strokeWidth={active ? 3 : 2}
                  strokeDasharray={s.status === "stale" || s.status === "failed" ? "6 4" : undefined}
                  className={cn(
                    "transition-all",
                    blocked && !active ? "opacity-50" : "",
                    // stroke 颜色来自父 g 的 class（tailwind stroke-*）
                  )}
                  stroke="currentColor"
                />
                <rect x={mid - 46} y={nodeY + NODE_H / 2 + EDGE_Y - 15} width={92} height={22} rx={4}
                  className="fill-background" stroke="currentColor" strokeOpacity={0.4} />
                <text x={mid} y={nodeY + NODE_H / 2 + EDGE_Y} textAnchor="middle"
                  className="fill-current text-[10px] tabular-nums">
                  {s.code} · {s.duration}s{s.cost ? ` · ${formatMoney(s.cost)}` : ""}
                </text>
              </g>
            );
          })}

          {/* 节点（关键帧） */}
          {episode.keyframes.map((kf, i) => {
            const tone = nodeTone[kf.status];
            const active = studio.activeKeyframeId === kf.id;
            const blocked = blockedFrom.has(kf.id);
            return (
              <g key={kf.id}>
                <foreignObject x={nodeX(i)} y={nodeY} width={NODE_W} height={NODE_H}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          studio.setActiveKeyframeId(kf.id);
                          studio.setActiveSegmentId(null);
                          onOpenCandidates();
                        }}
                        className={cn(
                          "flex h-full cursor-pointer flex-col rounded-lg border p-2 text-left transition-colors",
                          tone.ring,
                          tone.fill,
                          active && "ring-2 ring-foreground/60",
                          blocked && "shadow-[0_0_0_2px_rgba(239,68,68,0.5)]",
                          kf.status === "picked" && !blocked && "shadow-none",
                        )}
                      >
                        <span className={cn("text-[10px] font-medium tabular-nums", tone.text)}>
                          {kf.code}
                        </span>
                        <span className="mt-0.5 text-[9px] leading-3 text-muted-foreground/70">
                          {kf.shotSize ?? kf.references[0]?.name ?? "—"}
                        </span>
                        <span className="mt-auto truncate text-[9px] text-muted-foreground/50">
                          {kf.status === "picked" ? "已定稿" : kf.status === "generating" ? "生成中" : kf.status === "review" ? "待选优" : "待生成"}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-56 text-[11px]">
                      {kf.imagePrompt || "（待写生图提示词）"}
                    </TooltipContent>
                  </Tooltip>
                </foreignObject>
                {/* 节点间插帧 */}
                {i < episode.keyframes.length - 1 ? (
                  <foreignObject x={nodeX(i) + NODE_W - 10} y={nodeY + NODE_H / 2 - 12} width={24} height={24}>
                    <div className="relative">
                      <button
                        type="button"
                        aria-label="在此处插入关键帧"
                        onClick={() => setInsertAt(insertAt === kf.id ? null : kf.id)}
                        className="flex size-5 items-center justify-center rounded border border-dashed bg-background text-[10px] text-muted-foreground transition-colors hover:border-foreground/50 hover:text-foreground"
                      >
                        +
                      </button>
                      {insertAt === kf.id ? (
                        <div className="absolute left-0 top-6 z-30 flex items-center gap-1 rounded-md border bg-background p-1 shadow-lg">
                          {[1, 2, 3].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                studio.insertKeyframes(kf.id, n);
                                setInsertAt(null);
                              }}
                              className="rounded px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                            >
                              插{n}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </foreignObject>
                ) : null}
              </g>
            );
          })}
        </svg>

        {episode.keyframes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <KeySquare className="size-8 opacity-60" />
            <p className="text-[13px]">
              本集还是空画布——到「剧本规划」从节拍生成关键帧骨架，或 `apa pipeline plan`
            </p>
          </div>
        ) : null}
      </div>

      {/* 底部：选中段摘要 */}
      {studio.activeSegmentId ? (
        <div className="shrink-0 border-t px-4 py-2">
          {(() => {
            const s = episode.segments.find((x) => x.id === studio.activeSegmentId);
            if (!s) return null;
            const model = getModel(s.modelId);
            return (
              <p className="truncate text-[11px] text-muted-foreground">
                <span className="font-medium tabular-nums text-foreground/80">{s.code}</span>
                {" · "}
                {model.label} · {s.resolution} · {s.duration}s · {s.status}
                {s.promptStale ? " · 提示词待重写" : ""}
                {" — "}
                {s.videoPrompt || "（待写演绎提示词）"}
              </p>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}
