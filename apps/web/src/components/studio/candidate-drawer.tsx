import { useEffect, useState } from "react";
import { Check, Images, KeySquare, RefreshCcw, Sparkles, Wand2 } from "lucide-react";
import {
  DIALOGUE_STRATEGY_LABELS,
  FAILURE_MODES,
  FAILURE_MODE_ACTIONS,
  VIDEO_MODELS,
  estimateClipCost,
  formatMoney,
  getModel,
  type DialogueStrategy,
  type FailureMode,
  type ImageVariant,
  type VideoVariant,
} from "@dimples/apa-shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { useStudio } from "@/hooks/use-studio";

type Studio = ReturnType<typeof useStudio>;

function VariantMetaLine({ v }: { v: ImageVariant | VideoVariant }) {
  const params = Object.entries(v.requestParams)
    .map(([k, val]) => `${k}=${val}`)
    .join(" · ");
  return (
    <p className="mt-1 truncate text-[10px] leading-4 tabular-nums text-muted-foreground/70">
      seed {v.seed ?? "—"} · {v.modelVersion} · {params || "默认参数"} ·{" "}
      {v.cost !== undefined ? formatMoney(v.cost) : "审核失败不计费"} ·{" "}
      {new Date(v.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
    </p>
  );
}

function RejectSelect({ onReject }: { onReject: (reason: FailureMode) => void }) {
  return (
    <Select onValueChange={(v) => onReject(v as FailureMode)}>
      <SelectTrigger className="h-7 w-[110px] gap-1 border-destructive/40 text-[11px] text-red-400 hover:text-red-300">
        <SelectValue placeholder="淘汰 (j)" />
      </SelectTrigger>
      <SelectContent>
        {FAILURE_MODES.map((m) => (
          <SelectItem key={m} value={m} className="text-[12px]">
            {m}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** 候选池抽屉：候选选优（j/k）+ 提示词编辑 + 档位联动 + 失败归因——段/帧的完整编辑面 */
export function CandidateDrawer({
  studio,
  open,
  onOpenChange,
}: {
  studio: Studio;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { episode, activeKeyframeId, activeSegmentId, updateKeyframe, updateSegment } = studio;
  if (!episode) return null;
  const kf = episode.keyframes.find((k) => k.id === activeKeyframeId);
  const seg = episode.segments.find((s) => s.id === activeSegmentId);
  const isKf = Boolean(kf) && !seg;
  const focus = isKf ? kf : seg;

  const [promptDraft, setPromptDraft] = useState("");
  const [negDraft, setNegDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    setPromptDraft(isKf ? (kf?.imagePrompt ?? "") : (seg?.videoPrompt ?? ""));
    setNegDraft(kf?.negativePrompt ?? "");
  }, [open, focus?.id, isKf, kf?.imagePrompt, kf?.negativePrompt, seg?.videoPrompt]);

  // 键盘流：k 采纳聚焦候选（j 留给下拉触发，避免与输入冲突）
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) return;
      const row = el?.closest("[data-variant-id]");
      const vid = row?.getAttribute("data-variant-id");
      if (!vid || e.key !== "k") return;
      if (kf) studio.pickImageVariant(kf.id, vid);
      if (seg && seg.variants.some((v) => v.id === vid)) studio.pickVideoVariant(seg.id, vid);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, kf, seg, studio]);

  /** 保存提示词：已有产物的段自动置待重写（改提示词 = 重生成） */
  function savePrompt() {
    if (isKf && kf) {
      updateKeyframe(kf.id, { imagePrompt: promptDraft, negativePrompt: negDraft || undefined });
    } else if (seg) {
      const dirtied = seg.variants.length > 0 || seg.status === "ready";
      updateSegment(seg.id, {
        videoPrompt: promptDraft,
        ...(dirtied ? { promptStale: true, status: seg.status === "draft" ? "draft" : "stale" } : {}),
      });
    }
  }

  /** 档位联动：换模型吸附时长到合法档位 */
  function changeModel(modelId: string) {
    if (!seg) return;
    const next = getModel(modelId);
    const duration = next.durations.includes(seg.duration)
      ? seg.duration
      : (next.durations.find((d) => d >= seg.duration) ?? next.durations[next.durations.length - 1]);
    const resolution = next.resolutions.includes(seg.resolution)
      ? seg.resolution
      : next.resolutions[next.resolutions.length - 1];
    const strategy =
      seg.dialogueStrategy === "native" && !next.audio.nativeAudioGen
        ? ("tts-post" as DialogueStrategy)
        : seg.dialogueStrategy;
    updateSegment(seg.id, { modelId, duration, resolution, dialogueStrategy: strategy });
  }

  function changeStrategy(strategy: DialogueStrategy) {
    if (!seg) return;
    updateSegment(seg.id, { dialogueStrategy: strategy });
  }

  const model = seg ? getModel(seg.modelId) : null;
  const unitCost = seg ? estimateClipCost(seg.modelId, seg.resolution, seg.duration) : 0;
  const promptDirty = !isKf && seg !== undefined && promptDraft !== seg.videoPrompt;
  const fromKf = seg ? episode.keyframes.find((k) => k.id === seg.fromKeyframeId) : undefined;
  const canGenerateSeg =
    seg &&
    !seg.promptStale &&
    !promptDirty &&
    (seg.billedAttempts + seg.failedAttempts < 15) &&
    episode.keyframes.find((k) => k.id === seg.fromKeyframeId)?.status === "picked";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader className="shrink-0 border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-[13px]">
            {isKf ? (
              <KeySquare className="size-3.5 text-amber-400" />
            ) : (
              <Sparkles className="size-3.5 text-[#0070f3]" />
            )}
            {isKf ? `关键帧 ${kf?.code}` : `演绎段 ${seg?.code}`} · 编辑与选优
          </SheetTitle>
          <SheetDescription className="text-[11px] leading-4">
            {isKf
              ? "k = 采纳聚焦候选 · 淘汰必须归因（驱动重试策略与失败报表）· 点击淘汰下拉"
              : "k = 采纳候选片段 · 淘汰/归因驱动重试策略与失败报表 · 点击淘汰下拉"}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {/* ── 提示词编辑（一等公民） ── */}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">
                {isKf ? "生图提示词" : "演绎提示词（给图生视频模型）"}
              </Label>
              {promptDraft !== (isKf ? kf?.imagePrompt : seg?.videoPrompt) ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-amber-400">
                  {isKf
                    ? "未保存更改"
                    : "未保存更改 · 保存后将置为待重写，需重制才能出新片"}
                </span>
                <Button size="sm" className="ml-auto h-6 gap-1 px-2 text-[11px]" onClick={savePrompt}>
                  <Check className="size-3" />
                  保存
                </Button>
              </div>
            ) : null}
            </div>
            <Textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              rows={4}
              className="resize-none text-[12px] leading-5"
            />
            {isKf ? (
              <input
                value={negDraft}
                onChange={(e) => setNegDraft(e.target.value)}
                placeholder="负向提示词（逗号分隔，如：手指异常, 文字乱码）"
                className="h-8 rounded-md border bg-transparent px-2.5 text-[11px] text-red-300/90 placeholder:text-red-400/40"
              />
            ) : null}
            {!isKf && seg?.promptStale ? (
              <p className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-4 text-amber-400">
                本段提示词已过期（上游变更）——改写保存后才能重制。
              </p>
            ) : null}
          </div>

          {/* ── 段：档位联动 + 对白策略 + 计费明细 ── */}
          {!isKf && seg && model ? (
            <div className="grid gap-2.5 rounded-lg border p-3">
              {/* 首帧绑定（闸门可见化） */}
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground">首帧绑定</span>
                {fromKf ? (
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 tabular-nums",
                      fromKf.status === "picked"
                        ? "border-emerald-500/50 text-emerald-400"
                        : "border-amber-500/50 text-amber-400",
                    )}
                  >
                    {fromKf.code}
                    {fromKf.status === "picked" ? " · 已定稿，可生成" : ` · ${fromKf.status === "generating" ? "生成中" : "未定稿，生成已禁用"}`}
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="grid gap-1">
                  <Label className="text-[10px] text-muted-foreground">模型</Label>
                  <Select value={seg.modelId} onValueChange={changeModel}>
                    <SelectTrigger className="h-8 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-[12px]">
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] text-muted-foreground">分辨率</Label>
                  <Select
                    value={seg.resolution}
                    onValueChange={(v) => updateSegment(seg.id, { resolution: v })}
                  >
                    <SelectTrigger className="h-8 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {model.resolutions.map((r) => (
                        <SelectItem key={r} value={r} className="text-[12px]">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] text-muted-foreground">时长档位</Label>
                  <Select
                    value={String(seg.duration)}
                    onValueChange={(v) => updateSegment(seg.id, { duration: Number(v) })}
                  >
                    <SelectTrigger className="h-8 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {model.durations.map((d) => (
                        <SelectItem key={d} value={String(d)} className="text-[12px]">
                          {d}s
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="grid gap-1">
                  <Label className="text-[10px] text-muted-foreground">对白策略</Label>
                  <Select value={strategyVal(seg)} onValueChange={(v) => changeStrategy(v as DialogueStrategy)}>
                    <SelectTrigger className="h-8 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["native", "tts-post", "mute"] as DialogueStrategy[]).map((s) => (
                        <SelectItem
                          key={s}
                          value={s}
                          disabled={s === "native" && !model.audio.nativeAudioGen}
                          className="text-[12px]"
                        >
                          {DIALOGUE_STRATEGY_LABELS[s]}
                          {s === "native" && !model.audio.nativeAudioGen ? "（需 2.x）" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] text-muted-foreground">单次成本（估）</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex h-8 items-center rounded-md border px-2 text-[12px] tabular-nums">
                        {formatMoney(unitCost)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="text-[11px]">
                      {seg.resolution}·{seg.duration}s → tokens×{model.pricing.tokenPricePerMillion}{" "}
                      元/百万 · 仅成功计费
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <p className="text-[10px] leading-4 tabular-nums text-muted-foreground">
                已花 {formatMoney(seg.cost ?? 0)}（计费 {seg.billedAttempts} · 审核失败{" "}
                {seg.failedAttempts} 不计费）
              </p>
            </div>
          ) : null}

          {/* ── 失败归因 ── */}
          {!isKf && seg?.status === "failed" ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3">
              <p className="text-[12px] font-medium text-red-300">
                失败归因（{seg.failedAttempts} 次失败 · 计费 ¥0）
              </p>
              {seg.attributedFailure ? (
                <div className="mt-1.5">
                  <p className="text-[11px] text-red-300/90">
                    已归因：{seg.attributedFailure}——{FAILURE_MODE_ACTIONS[seg.attributedFailure]}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    改写提示词保存后，「重试失败/待重制」才会纳入本段。
                  </p>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    选择失败原因后按建议动作重写，再重制——未归因前批量重试保持禁用。
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {FAILURE_MODES.filter(
                      (m) =>
                        m !== "口型不同步" || (seg.dialogue && seg.dialogueStrategy !== "mute"),
                    ).map((m) => (
                      <button
                        key={m}
                        type="button"
                        title={FAILURE_MODE_ACTIONS[m]}
                        onClick={() => studio.attributeFailure(seg.id, m)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-destructive/60 hover:text-red-300",
                          m === "内容审核拒绝" && "border-destructive/40",
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {/* ── 候选池 ── */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">候选池</Label>
              {isKf && kf ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[11px]"
                  disabled={kf.status === "generating"}
                  onClick={() => studio.generateKeyframe(kf.id)}
                >
                  <Wand2 className="size-3" />
                  再生成 2 候选
                </Button>
              ) : null}
              {!isKf && seg ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className={cn("h-6 gap-1 px-2 text-[11px]", !canGenerateSeg && "opacity-45 saturate-0")}
                      disabled={!canGenerateSeg || seg.status === "generating"}
                      onClick={() => studio.generateSegment(seg.id)}
                    >
                      <RefreshCcw className="size-3" />
                      对照重试（继承参数）
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {seg.promptStale || promptDirty
                      ? "提示词已修改未保存/已过期——先保存改写"
                      : seg.billedAttempts + seg.failedAttempts >= 15
                        ? "单镜预算 15 次封顶——必须换镜重写"
                        : "继承 seed 与参数再生成一组做对照；换镜重写请改提示词后保存"}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>

            {isKf && kf ? (
              kf.variants.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-[12px] text-muted-foreground">
                  还没有候选——点上方「再生成」
                </div>
              ) : (
                kf.variants.map((v, i) => (
                  <div
                    key={v.id}
                    data-variant-id={v.id}
                    tabIndex={0}
                    className={cn(
                      "rounded-lg border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
                      v.rejectedReason && "opacity-55",
                      kf.pickedVariantId === v.id && "border-emerald-500/50",
                    )}
                  >
                    <div
                      className="relative mb-2 aspect-[3/4] w-full overflow-hidden rounded-md"
                      style={{
                        backgroundColor: "oklch(0.24 0.03 250)",
                        backgroundImage:
                          "radial-gradient(55% 45% at 35% 28%, oklch(0.48 0.07 250), transparent 72%), radial-gradient(45% 38% at 72% 72%, oklch(0.34 0.05 220), transparent 76%), radial-gradient(30% 25% at 50% 55%, oklch(0.4 0.04 260), transparent 80%)",
                      }}
                    >
                      <span className="absolute bottom-2 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] tabular-nums text-white/70">
                        候选 {i + 1}
                      </span>
                      {kf.pickedVariantId === v.id ? (
                        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-emerald-500/50 bg-black/60 px-2 py-0.5 text-[10px] text-emerald-400">
                          <Check className="size-3" /> 已采纳
                        </span>
                      ) : null}
                    </div>
                    <VariantMetaLine v={v} />
                    {v.rejectedReason ? (
                      <p className="mt-1 text-[11px] text-red-400/80">
                        已淘汰：{v.rejectedReason}——{FAILURE_MODE_ACTIONS[v.rejectedReason]}
                      </p>
                    ) : (
                      <div className="mt-2 flex items-center justify-end gap-1.5">
                        <RejectSelect onReject={(r) => studio.rejectImageVariant(kf.id, v.id, r)} />
                        <Button
                          size="sm"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => studio.pickImageVariant(kf.id, v.id)}
                        >
                          <Check className="size-3" />
                          采纳 <span className="opacity-60">(k)</span>
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )
            ) : null}

            {!isKf && seg ? (
              seg.variants.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-[12px] text-muted-foreground">
                  <Images className="size-6 opacity-60" />
                  还没有候选片段
                  {seg.promptStale ? "——先改写提示词" : ""}
                </div>
              ) : (
                seg.variants.map((v, i) => (
                  <div
                    key={v.id}
                    data-variant-id={v.id}
                    tabIndex={0}
                    className={cn(
                      "rounded-lg border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
                      v.rejectedReason && "opacity-55",
                      seg.pickedVariantId === v.id && "border-emerald-500/50",
                    )}
                  >
                    <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-md bg-zinc-900">
                      <span className="absolute bottom-2 left-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] tabular-nums text-white/70">
                        片段 {i + 1} · {seg.duration}s
                      </span>
                      {seg.pickedVariantId === v.id ? (
                        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-emerald-500/50 bg-black/60 px-2 py-0.5 text-[10px] text-emerald-400">
                          <Check className="size-3" /> 已采纳
                        </span>
                      ) : null}
                    </div>
                    <VariantMetaLine v={v} />
                    {v.rejectedReason ? (
                      <p className="mt-1 text-[11px] text-red-400/80">
                        已淘汰：{v.rejectedReason}——{FAILURE_MODE_ACTIONS[v.rejectedReason]}
                      </p>
                    ) : (
                      <div className="mt-2 flex items-center justify-end gap-1.5">
                        <RejectSelect onReject={(r) => studio.rejectVideoVariant(seg.id, v.id, r)} />
                        <Button
                          size="sm"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => studio.pickVideoVariant(seg.id, v.id)}
                        >
                          <Check className="size-3" />
                          采纳 <span className="opacity-60">(k)</span>
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function strategyVal(seg: { dialogueStrategy?: DialogueStrategy; dialogue?: string }): string {
  return seg.dialogueStrategy ?? (seg.dialogue ? "tts-post" : "mute");
}
