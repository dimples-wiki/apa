import { useState } from "react";
import {
  Check,
  Film,
  ImagePlus,
  Images,
  KeySquare,
  Loader2,
  Plus,
  RefreshCcw,
  TriangleAlert,
  Wand2,
  X,
} from "lucide-react";
import {
  BEAT_KIND_LABELS,
  DIALOGUE_STRATEGY_LABELS,
  FAILURE_MODE_ACTIONS,
  KEYFRAME_STATUS_LABELS,
  REFERENCE_TYPE_LABELS,
  SEGMENT_STATUS_LABELS,
  estimateClipCost,
  formatMoney,
  getModel,
  type Keyframe,
  type ReferenceAsset,
  type Segment,
} from "@dimples/apa-shared";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { useStudio } from "@/hooks/use-studio";

type Studio = ReturnType<typeof useStudio>;

const kfStatusStyle: Record<Keyframe["status"], string> = {
  draft: "border-zinc-500/40 text-zinc-400",
  generating: "border-[#0070f3]/50 text-[#6cb8ff]",
  review: "border-amber-500/50 text-amber-400",
  picked: "border-emerald-500/50 text-emerald-400",
};

const segStatusStyle: Record<Segment["status"], string> = {
  draft: "border-zinc-500/40 text-zinc-400",
  planned: "border-violet-500/40 text-violet-400",
  generating: "border-[#0070f3]/50 text-[#6cb8ff]",
  ready: "border-emerald-500/50 text-emerald-400",
  failed: "border-destructive/60 text-red-400",
  stale: "border-amber-500/50 text-amber-400",
};

const beatChipTone: Record<string, string> = {
  hook: "border-red-400/40 text-red-400",
  development: "border-[#0070f3]/40 text-[#6cb8ff]",
  turn: "border-violet-400/40 text-violet-400",
  ending: "border-amber-400/40 text-amber-400",
};

function StatusBadge({ label, cls, pulse }: { label: string; cls: string; pulse?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        cls,
      )}
    >
      {pulse ? <span className="size-1.5 animate-pulse rounded-full bg-current" /> : null}
      {label}
    </span>
  );
}

function BeatChip({
  studio,
  beatId,
}: {
  studio: Studio;
  beatId?: string;
}) {
  const beat = studio.episode?.beats.find((b) => b.id === beatId);
  if (!beat) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full border border-amber-500/40 px-1.5 py-px text-[10px] text-amber-400">
            未挂节拍
          </span>
        </TooltipTrigger>
        <TooltipContent>到「剧本规划」从节拍生成，或编辑帧的归属</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[10px]",
            beatChipTone[beat.kind],
          )}
        >
          {BEAT_KIND_LABELS[beat.kind]}
          {beat.scriptSceneRef ? (
            <span className="tabular-nums opacity-60">{beat.scriptSceneRef}</span>
          ) : null}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-56 text-[11px]">{beat.text}</TooltipContent>
    </Tooltip>
  );
}

function RefChips({ refs }: { refs: ReferenceAsset[] }) {
  if (refs.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {refs.map((r) => (
        <span
          key={r.assetId}
          className="rounded border bg-muted/50 px-1.5 py-px text-[10px] text-muted-foreground"
          title={`${REFERENCE_TYPE_LABELS[r.type]}参考 · 权重 ${r.weight ?? 0.5}`}
        >
          {REFERENCE_TYPE_LABELS[r.type]}·{r.name}
          {r.weight ? <span className="ml-0.5 tabular-nums opacity-60">{r.weight}</span> : null}
        </span>
      ))}
    </span>
  );
}

/** 关键帧缩略位：采纳帧/候选占位（演示数据无真实图，用状态化渐变块） */
function KfThumb({ kf, className }: { kf: Keyframe; className?: string }) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded border",
        kf.status === "picked" ? "border-emerald-500/50" : "border-white/10",
        className,
      )}
      style={{
        aspectRatio: "9 / 16",
        width: 28,
        backgroundColor: "oklch(0.16 0.02 250)",
        backgroundImage:
          "radial-gradient(60% 45% at 40% 32%, oklch(0.28 0.05 250), transparent 72%), radial-gradient(50% 40% at 70% 78%, oklch(0.2 0.04 210), transparent 76%)",
      }}
    >
      {kf.status === "picked" ? (
        <Check className="absolute bottom-0.5 right-0.5 size-2.5 text-emerald-400" />
      ) : null}
    </span>
  );
}

function Checkbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={checked ? "取消选择" : "选择"}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked
          ? "border-foreground bg-foreground text-background"
          : "border-muted-foreground/40 hover:border-foreground/60",
      )}
    >
      {checked ? <Check className="size-3" /> : null}
    </button>
  );
}

function KfActions({
  studio,
  kf,
  onOpenCandidates,
}: {
  studio: Studio;
  kf: Keyframe;
  onOpenCandidates: () => void;
}) {
  if (kf.status === "draft") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-[11px]"
        onClick={(e) => {
          e.stopPropagation();
          studio.generateKeyframe(kf.id);
        }}
      >
        <Wand2 className="size-3" />
        生图
      </Button>
    );
  }
  if (kf.status === "review") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-[11px] text-amber-500 hover:text-amber-400"
        onClick={(e) => {
          e.stopPropagation();
          studio.setActiveKeyframeId(kf.id);
          studio.setActiveSegmentId(null);
          onOpenCandidates();
        }}
      >
        <Images className="size-3" />
        选优
      </Button>
    );
  }
  if (kf.status === "picked") {
    return (
      <span className="flex size-7 items-center justify-center text-emerald-400">
        <Check className="size-4" />
      </span>
    );
  }
  return (
    <span className="flex size-7 items-center justify-center text-[#6cb8ff]">
      <Loader2 className="size-4 animate-spin" />
    </span>
  );
}

function SegActions({
  studio,
  seg,
  onOpenCandidates,
}: {
  studio: Studio;
  seg: Segment;
  onOpenCandidates: () => void;
}) {
  const open = () => {
    studio.setActiveSegmentId(seg.id);
    studio.setActiveKeyframeId(null);
    onOpenCandidates();
  };
  if (seg.status === "failed") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[11px] text-red-400 hover:text-red-300"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          >
            <TriangleAlert className="size-3" />
            归因
          </Button>
        </TooltipTrigger>
        <TooltipContent>失败归因与重写建议</TooltipContent>
      </Tooltip>
    );
  }
  if (seg.status === "ready") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          >
            <Images className="size-3" />
            候选
          </Button>
        </TooltipTrigger>
        <TooltipContent>查看候选片段与参数快照</TooltipContent>
      </Tooltip>
    );
  }
  if (seg.status === "generating") {
    return (
      <span className="flex size-7 items-center justify-center text-[#6cb8ff]">
        <Loader2 className="size-4 animate-spin" />
      </span>
    );
  }
  if (seg.status === "stale") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-[11px] text-amber-500 hover:text-amber-400"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
          >
            <PenLineIcon className="size-3" />
            重写
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          提示词已过期——先在抽屉里重写保存，才解锁重制（防止直接烧钱）
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-[11px] text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
        >
          <PenLineIcon className="size-3" />
          编辑
        </Button>
      </TooltipTrigger>
      <TooltipContent>编辑提示词与模型档位</TooltipContent>
    </Tooltip>
  );
}

function PenLineIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    </svg>
  );
}

/** 段行间的插帧入口 */
function InsertRow({
  onInsert,
}: {
  onInsert: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex h-7 items-center px-3 sm:px-4">
      <div className="flex w-full items-center gap-2 sm:opacity-0 sm:transition-opacity sm:group-hover/segrow:opacity-100">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 rounded border border-dashed px-1.5 py-px text-[10px] text-muted-foreground transition-colors hover:border-foreground/50 hover:text-foreground"
        >
          <Plus className="size-2.5" />
          在此插入关键帧
        </button>
        <div className="h-px flex-1 bg-border/40" />
      </div>
      {open ? (
        <div className="absolute left-10 top-0 z-30 flex items-center gap-1 rounded-md border bg-background p-1 shadow-lg">
          <span className="px-1 text-[10px] text-muted-foreground">段时长将按模型档位重切：</span>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                onInsert(n);
                setOpen(false);
              }}
              className="rounded px-2 py-1 text-[11px] tabular-nums text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              插 {n} 帧
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ShotListTable({
  studio,
  onOpenCandidates,
}: {
  studio: Studio;
  onOpenCandidates: () => void;
}) {
  const { selectedIds, toggleSelect, gateOpen, stats } = studio;
  const episode = studio.episode;
  if (!episode) return null;
  const anySelected = selectedIds.size > 0;
  const draftKfSelected = episode.keyframes.filter(
    (k) => selectedIds.has(k.id) && k.status === "draft",
  ).length;
  const draftSegSelected = episode.segments.filter(
    (s) => selectedIds.has(s.id) && (s.status === "draft" || s.status === "planned"),
  ).length;

  const dialogueStrategyOf = (s: Segment) =>
    s.dialogueStrategy ?? (s.dialogue ? "tts-post" : "mute");

  const costTitle = (s: Segment) => {
    if (!s.cost) return "尚无计费";
    const unit = estimateClipCost(s.modelId, s.resolution, s.duration);
    const m = getModel(s.modelId);
    return `${s.billedAttempts} 次成功生成 × ${formatMoney(unit)}/条（${m.pricing.tokenPricePerMillion}元/百万 tokens · 仅成功计费，审核失败不计费）`;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* ── 关键帧区头（先静后动 · 第一阶段） ── */}
      <div className="sticky top-0 z-10 flex h-10 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
        <KeySquare className="size-3.5 shrink-0 text-amber-400" />
        <span className="text-[12px] font-medium">关键帧</span>
        <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">
          先静后动 · {stats.pickedKf}/{stats.totalKf} 已定稿
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground sm:hidden">
          {stats.pickedKf}/{stats.totalKf} 定稿
        </span>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-[12px]"
            onClick={studio.batchGenerateKeyframes}
            disabled={!episode.keyframes.some((k) => k.status === "draft")}
          >
            <ImagePlus className="size-3.5" />
            批量生成
          </Button>
        </div>
      </div>

      {/* ── 关键帧行 ── */}
      <div>
        {episode.keyframes.map((kf) => {
          const active = studio.activeKeyframeId === kf.id;
          const selected = selectedIds.has(kf.id);
          const pickedCount = kf.variants.filter((v) => !v.rejectedReason).length;
          return (
            <div
              key={kf.id}
              role="button"
              tabIndex={0}
              onClick={() => studio.setActiveKeyframeId(kf.id)}
              className={cn(
                "cursor-pointer border-b transition-colors",
                active ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]",
              )}
            >
              {/* 桌面行 */}
              <div className="hidden items-start gap-3 px-4 py-2.5 sm:flex">
                <span className="mt-3">
                  <Checkbox checked={selected} onToggle={() => toggleSelect(kf.id)} />
                </span>
                <KfThumb kf={kf} className="mt-0.5" />
                <span className="mt-0.5 flex w-24 shrink-0 flex-col items-start gap-1">
                  <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                    {kf.code}
                  </span>
                  <BeatChip studio={studio} beatId={kf.beatId} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "line-clamp-2 text-[13px] leading-5",
                      kf.imagePrompt ? "text-foreground/90" : "text-muted-foreground/50",
                    )}
                  >
                    {kf.imagePrompt || "（待写生图提示词——这一帧要给生图模型什么画面）"}
                  </span>
                  <RefChips refs={kf.references} />
                  {kf.negativePrompt ? (
                    <span className="mt-1 block text-[10px] text-red-400/70">
                      负向：{kf.negativePrompt}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
                  <Images className="size-3" />
                  {pickedCount}/{kf.variants.length}
                </span>
                <StatusBadge
                  label={KEYFRAME_STATUS_LABELS[kf.status]}
                  cls={kfStatusStyle[kf.status]}
                  pulse={kf.status === "generating"}
                />
                <span className="flex w-24 shrink-0 justify-end">
                  <KfActions studio={studio} kf={kf} onOpenCandidates={onOpenCandidates} />
                </span>
              </div>

              {/* 移动卡片 */}
              <div className="flex gap-2.5 px-3 py-2.5 sm:hidden">
                <div className="flex flex-col items-center gap-1.5">
                  <Checkbox checked={selected} onToggle={() => toggleSelect(kf.id)} />
                  <KfThumb kf={kf} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                      {kf.code}
                    </span>
                    <BeatChip studio={studio} beatId={kf.beatId} />
                    <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                      候选 {pickedCount}/{kf.variants.length}
                    </span>
                    <StatusBadge
                      label={KEYFRAME_STATUS_LABELS[kf.status]}
                      cls={kfStatusStyle[kf.status]}
                      pulse={kf.status === "generating"}
                    />
                  </div>
                  <p
                    className={cn(
                      "line-clamp-3 text-[12px] leading-5",
                      kf.imagePrompt ? "text-foreground/90" : "text-muted-foreground/50",
                    )}
                  >
                    {kf.imagePrompt || "（待写生图提示词）"}
                  </p>
                  <div className="flex items-center gap-1">
                    <RefChips refs={kf.references} />
                    {kf.status !== "picked" ? (
                      <span className="ml-auto shrink-0">
                        <KfActions studio={studio} kf={kf} onOpenCandidates={onOpenCandidates} />
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 演绎段区头（第二阶段，两阶段闸门） ── */}
      <div className="sticky top-10 z-10 flex h-10 items-center gap-3 border-y bg-background/95 px-3 backdrop-blur sm:px-4">
        <Film className="size-3.5 shrink-0 text-[#0070f3]" />
        <span className="text-[12px] font-medium">演绎段</span>
        <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">
          图生视频 · {stats.readySeg}/{stats.totalSeg} 就绪
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground sm:hidden">
          {stats.readySeg}/{stats.totalSeg} 就绪
        </span>
        {gateOpen ? (
          <span className="hidden items-center gap-1 text-[11px] text-emerald-500 md:flex">
            <Check className="size-3" />
            静帧已全部定稿
          </span>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="hidden items-center gap-1 text-[11px] text-amber-500 md:flex">
                <TriangleAlert className="size-3" />
                闸门未开：还有 {stats.totalKf - stats.pickedKf} 帧未定稿
              </span>
            </TooltipTrigger>
            <TooltipContent>先静后动：全部关键帧定稿前，批量生成视频保持禁用</TooltipContent>
          </Tooltip>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-[12px]"
                onClick={studio.batchRetryFailed}
                disabled={
                  studio.unattributedFailed.length > 0 ||
                  !episode.segments.some(
                    (s) =>
                      (s.status === "stale" || (s.status === "failed" && s.attributedFailure)) &&
                      !s.promptStale,
                  )
                }
              >
                <RefreshCcw className="size-3.5" />
                <span className="hidden sm:inline">重试失败/待重制</span>
                <span className="sm:hidden">重试</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {studio.unattributedFailed.length > 0
                ? `先归因失败段：${studio.unattributedFailed.map((s) => s.code).join("、")}（归因→重写→重制）`
                : "重试已归因的失败段与待重制段（继承参数）"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                className={cn("h-7 gap-1.5 text-[12px]", !gateOpen && "opacity-45 saturate-0")}
                onClick={studio.batchGenerateSegments}
                disabled={!gateOpen}
              >
                <Wand2 className="size-3.5" />
                <span className="hidden sm:inline">批量生成视频</span>
                <span className="sm:hidden">批量生成</span>
              </Button>
            </TooltipTrigger>
            {!gateOpen ? (
              <TooltipContent>先静后动：全部关键帧定稿前，批量生成视频保持禁用</TooltipContent>
            ) : null}
          </Tooltip>
        </div>
      </div>

      {/* ── 段行（含行间插帧入口） ── */}
      <div className="group/segrow">
        {episode.segments.map((seg, idx) => {
          const active = studio.activeSegmentId === seg.id;
          const selected = selectedIds.has(seg.id);
          const model = getModel(seg.modelId);
          const strategy = dialogueStrategyOf(seg);
          return (
            <div key={seg.id}>
              <InsertRow
                onInsert={(n) => studio.insertKeyframes(seg.fromKeyframeId, n)}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => studio.setActiveSegmentId(seg.id)}
                className={cn(
                  "cursor-pointer border-b transition-colors",
                  active ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]",
                  seg.status === "stale" && "bg-amber-500/[0.04]",
                )}
              >
                {/* 桌面行 */}
                <div className="hidden items-start gap-3 px-4 py-2.5 sm:flex">
                  <span className="mt-3">
                    <Checkbox checked={selected} onToggle={() => toggleSelect(seg.id)} />
                  </span>
                  <span className="mt-0.5 flex w-24 shrink-0 flex-col items-start gap-1">
                    <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                      {seg.code}
                    </span>
                    <span className="rounded bg-muted/60 px-1 py-px text-[10px] tabular-nums text-muted-foreground">
                      {model.label.replace("Seedance ", "")} · {seg.duration}s
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "line-clamp-2 text-[13px] leading-5",
                        seg.videoPrompt
                          ? seg.promptStale
                            ? "text-amber-300/90"
                            : "text-foreground/90"
                          : "text-muted-foreground/50",
                      )}
                    >
                      {seg.videoPrompt || "（待写演绎提示词——这两帧之间要发生什么剧情）"}
                      {seg.promptStale ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1.5 inline-block cursor-help rounded bg-amber-500/15 px-1 py-px align-middle text-[10px] text-amber-400">
                              待重写
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            上游关键帧换帧或插帧，本段提示词已不成立——重写后再重制
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span
                        className={cn(
                          "rounded border bg-muted/50 px-1.5 py-px",
                          strategy === "native" && !model.audio.nativeAudioGen
                            ? "border-destructive/40 text-red-400"
                            : "",
                        )}
                        title={
                          strategy === "native" && !model.audio.nativeAudioGen
                            ? "当前模型不支持音画同生——换 2.x 档或降级后期配音"
                            : "对白生成策略"
                        }
                      >
                        {DIALOGUE_STRATEGY_LABELS[strategy]}
                      </span>
                      {seg.dialogue ? <span>「{seg.dialogue}」</span> : null}
                    </span>
                  </span>
                  <span className="mt-0.5 hidden shrink-0 flex-col items-end gap-0.5 text-[11px] tabular-nums text-muted-foreground lg:flex">
                    <span
                      className={cn(
                        seg.billedAttempts + seg.failedAttempts >= 15
                          ? "text-red-400"
                          : seg.billedAttempts + seg.failedAttempts >= 10
                            ? "text-amber-400"
                            : "",
                      )}
                      title="预算梯度：单镜累计生成（计费+失败）/15——≥10 转黄预警，15 封顶禁止再生成，必须换镜重写"
                    >
                      {seg.resolution} · 计费 {seg.billedAttempts} · 失败 {seg.failedAttempts} ·{" "}
                      {seg.billedAttempts + seg.failedAttempts}/15
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help text-[10px]">
                          {seg.cost ? (
                            <span className="text-foreground/70">{formatMoney(seg.cost)}</span>
                          ) : seg.failedAttempts > 0 ? (
                            <span className="text-red-400/80">失败 {seg.failedAttempts} 次 · ¥0</span>
                          ) : (
                            "未生成"
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="text-[11px]">{costTitle(seg)}</TooltipContent>
                    </Tooltip>
                  </span>
                  <StatusBadge
                    label={SEGMENT_STATUS_LABELS[seg.status]}
                    cls={segStatusStyle[seg.status]}
                    pulse={seg.status === "generating"}
                  />
                  <span className="flex w-24 shrink-0 justify-end">
                    <SegActions studio={studio} seg={seg} onOpenCandidates={onOpenCandidates} />
                  </span>
                </div>

                {/* 移动卡片 */}
                <div className="flex flex-col gap-1.5 px-3 py-2.5 sm:hidden">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={selected} onToggle={() => toggleSelect(seg.id)} />
                    <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                      {seg.code}
                    </span>
                    <span className="rounded bg-muted/60 px-1 py-px text-[10px] tabular-nums text-muted-foreground">
                      {model.label.replace("Seedance ", "")} · {seg.duration}s
                    </span>
                    <span className="ml-auto">
                      <StatusBadge
                        label={SEGMENT_STATUS_LABELS[seg.status]}
                        cls={segStatusStyle[seg.status]}
                        pulse={seg.status === "generating"}
                      />
                    </span>
                  </div>
                  <p
                    className={cn(
                      "line-clamp-3 text-[12px] leading-5",
                      seg.videoPrompt
                        ? seg.promptStale
                          ? "text-amber-300/90"
                          : "text-foreground/90"
                        : "text-muted-foreground/50",
                    )}
                  >
                    {seg.videoPrompt || "（待写演绎提示词）"}
                    {seg.promptStale ? (
                      <span className="ml-1 inline-block rounded bg-amber-500/15 px-1 align-middle text-[10px] text-amber-400">
                        待重写
                      </span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="rounded border bg-muted/50 px-1.5 py-px">
                      {DIALOGUE_STRATEGY_LABELS[strategy]}
                    </span>
                    {seg.dialogue ? <span>「{seg.dialogue}」</span> : null}
                    <span className="tabular-nums">
                      计费 {seg.billedAttempts} · 失败 {seg.failedAttempts}
                      {seg.cost ? (
                        <span className="ml-1 text-foreground/70">{formatMoney(seg.cost)}</span>
                      ) : null}
                    </span>
                    <span className="ml-auto">
                      <SegActions studio={studio} seg={seg} onOpenCandidates={onOpenCandidates} />
                    </span>
                  </div>
                </div>
              </div>
              {idx === episode.segments.length - 1 ? (
                <InsertRow onInsert={(n) => studio.insertKeyframes(seg.fromKeyframeId, n)} />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* 批量操作浮条 */}
      {anySelected ? (
        <div className="sticky bottom-3 z-20 mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-xl items-center gap-1.5 rounded-full border bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur sm:w-fit sm:gap-2">
          <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
            已选 {selectedIds.size}
          </span>
          <div className="h-4 w-px shrink-0 bg-border" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-[11px]"
            disabled={draftKfSelected === 0}
            onClick={() => {
              episode.keyframes
                .filter((k) => selectedIds.has(k.id) && k.status === "draft")
                .forEach((k, i) => setTimeout(() => studio.generateKeyframe(k.id), i * 250));
              studio.setSelectedIds(new Set());
            }}
          >
            <ImagePlus className="size-3" />
            生成静帧{draftKfSelected > 0 ? ` ${draftKfSelected}` : ""}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[11px]"
                disabled={!gateOpen || draftSegSelected === 0}
                onClick={() => {
                  episode.segments
                    .filter(
                      (s) =>
                        selectedIds.has(s.id) && (s.status === "draft" || s.status === "planned"),
                    )
                    .forEach((s, i) => setTimeout(() => studio.generateSegment(s.id), i * 250));
                  studio.setSelectedIds(new Set());
                }}
              >
                <Film className="size-3" />
                生成视频{draftSegSelected > 0 ? ` ${draftSegSelected}` : ""}
              </Button>
            </TooltipTrigger>
            {!gateOpen ? <TooltipContent>两阶段闸门：静帧未全部定稿</TooltipContent> : null}
          </Tooltip>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 gap-1 px-2 text-[11px] text-muted-foreground"
            onClick={() => studio.setSelectedIds(new Set())}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : null}

      {/* 失败归因卡 */}
      {episode.segments.some((s) => s.status === "failed") ? (
        <div className="mx-3 mb-4 mt-3 rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3 sm:mx-4">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-3.5 text-red-400" />
            <span className="text-[12px] font-medium text-red-300">失败归因</span>
          </div>
          {episode.segments
            .filter((s) => s.status === "failed")
            .map((s) => (
              <p key={s.id} className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
                <span className="font-medium tabular-nums text-foreground/80">{s.code}</span>
                ：内容审核拒绝（{s.failedAttempts} 次，不计费）——建议：
                {FAILURE_MODE_ACTIONS["内容审核拒绝"]}
              </p>
            ))}
        </div>
      ) : null}
    </div>
  );
}
