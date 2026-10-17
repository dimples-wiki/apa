import { useEffect, useState } from "react";
import {
  Flag,
  Loader2,
  Plus,
  Play,
  RefreshCcw,
  Sparkles,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import {
  AUDIO_TRACK_LABELS,
  DIALOGUE_STRATEGY_LABELS,
  SEGMENT_STATUS_LABELS,
  estimateClipCost,
  formatDuration,
  formatMoney,
  getModel,
  type AudioTrackKind,
  type Keyframe,
  type Segment,
} from "@dimples/apa-shared";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { useStudio } from "@/hooks/use-studio";

type Studio = ReturnType<typeof useStudio>;

const segBlockStyle: Record<Segment["status"], string> = {
  draft: "border-zinc-700 bg-zinc-900 text-zinc-400",
  planned: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  generating: "border-[#0070f3]/50 bg-[#0070f3]/15 text-[#6cb8ff]",
  ready: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  failed: "border-destructive/60 bg-destructive/10 text-red-300",
  stale:
    "border-amber-500/50 bg-amber-500/10 text-amber-300 bg-[repeating-linear-gradient(45deg,transparent_0px,transparent_5px,rgba(245,158,11,0.08)_5px,rgba(245,158,11,0.08)_10px)]",
};

/** 关键帧节点：状态色与制作清单严格同源 */
const kfNodeTone: Record<Keyframe["status"], { dot: string; text: string }> = {
  draft: { dot: "border-zinc-500 bg-zinc-700/60", text: "text-zinc-400" },
  generating: { dot: "border-[#0070f3] bg-[#0070f3]/40", text: "text-[#6cb8ff]" },
  review: { dot: "border-amber-400 bg-amber-400/30", text: "text-amber-400" },
  picked: { dot: "border-emerald-400 bg-emerald-400/40", text: "text-emerald-400" },
};

function KfNode({
  kf,
  active,
  onClick,
}: {
  kf: Keyframe;
  active: boolean;
  onClick: () => void;
}) {
  const tone = kfNodeTone[kf.status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn("flex flex-col items-center gap-0.5", tone.text)}
        >
          <span
            className={cn(
              "size-2.5 rotate-45 rounded-[2px] border",
              tone.dot,
              active && "ring-2 ring-foreground/50 ring-offset-1 ring-offset-background",
            )}
          />
          <span className="text-[9px] tabular-nums opacity-80">{kf.code}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="text-[11px]">
        {kf.code} · {kf.status === "picked" ? "已定稿" : kf.status === "generating" ? "生成中" : kf.status === "review" ? "待选优" : "待生成"}——点击查看候选
      </TooltipContent>
    </Tooltip>
  );
}

/** 拼装预览：9:16 监视器 + 段信息面板 + 关键帧节点链段时间线（含钩子窗/AI 标识/对白轨） */
export function PreviewView({
  studio,
  onOpenCandidates,
}: {
  studio: Studio;
  onOpenCandidates: () => void;
}) {
  const { episode } = studio;
  const total = episode ? episode.segments.reduce((a, s) => a + s.duration, 0) : 0;
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [insertAt, setInsertAt] = useState<string | null>(null);
  const [markers, setMarkers] = useState<{ atSec: number; note: string }[]>([]);

  const audioTracks: AudioTrackKind[] = ["voice", "sfx", "ambience", "music"];

  useEffect(() => {
    if (!playing || total === 0) return;
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

  if (!episode) return null;

  const activeSeg =
    episode.segments.find((s) => s.id === studio.activeSegmentId) ??
    episode.segments.find((s) => s.status === "ready") ??
    episode.segments[0];
  const activeKf = activeSeg
    ? episode.keyframes.find((k) => k.id === activeSeg.fromKeyframeId)
    : episode.keyframes[0];
  const model = activeSeg ? getModel(activeSeg.modelId) : null;

  function togglePlay() {
    if (!playing && playhead >= total) setPlayhead(0);
    setPlaying((p) => !p);
  }

  /** 审片快捷键：空格播放/暂停 · M 打标记 */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "m" || e.key === "M") {
        setMarkers((prev) => [
          ...prev,
          {
            atSec: Math.round(playhead * 10) / 10,
            note: `看片标记 ${prev.length + 1}`,
          },
        ]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const canGenerate =
    activeSeg &&
    !activeSeg.promptStale &&
    episode.keyframes.find((k) => k.id === activeSeg.fromKeyframeId)?.status === "picked";

  return (
    <div className="flex min-h-0 flex-1">
      {/* ── 左：监视器 + 时间线 ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black p-3 sm:p-4">
          <div className="relative flex h-full max-h-full flex-col overflow-hidden rounded-lg border border-white/15 shadow-[0_0_60px_rgba(0,0,0,0.8)]">
            <div
              className="relative flex-1 overflow-hidden"
              style={{ aspectRatio: "9 / 16", height: "100%" }}
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: "oklch(0.12 0.02 250)",
                  backgroundImage:
                    "radial-gradient(60% 45% at 40% 30%, oklch(0.26 0.05 250), transparent 70%), radial-gradient(50% 40% at 70% 75%, oklch(0.18 0.04 200), transparent 75%)",
                }}
              />
              {/* 顶部信息条 */}
              <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 py-2.5">
                {activeSeg ? (
                  <>
                    <span className="rounded-full border border-white/25 bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white/80">
                      {SEGMENT_STATUS_LABELS[activeSeg.status]}
                    </span>
                    <span className="text-[12px] font-medium tabular-nums text-white/85">
                      {activeSeg.code}
                    </span>
                    <span className="text-[11px] tabular-nums text-white/45">
                      {activeSeg.duration}s · {activeSeg.resolution}
                    </span>
                  </>
                ) : (
                  <span className="text-[12px] text-white/60">本集还没有演绎段</span>
                )}
              </div>
              {/* AI 生成内容标识（合规：每集显式标识） */}
              <span className="absolute right-3 top-10 rounded bg-black/50 px-1.5 py-0.5 text-[9px] tracking-wider text-white/60">
                AI 生成
              </span>
              {/* 中央状态 */}
              {activeSeg?.status === "generating" ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center gap-2 rounded-full border border-[#0070f3]/40 bg-black/50 px-3.5 py-2 text-[12px] text-[#6cb8ff] backdrop-blur">
                    <Loader2 className="size-3.5 animate-spin" /> 正在依首帧演绎…
                  </span>
                </div>
              ) : activeSeg?.status === "failed" ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center gap-2 rounded-full border border-destructive/40 bg-black/50 px-3.5 py-2 text-[12px] text-red-400 backdrop-blur">
                    <TriangleAlert className="size-3.5" /> 生成失败 · 待归因重试
                  </span>
                </div>
              ) : activeSeg?.status === "ready" ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-14 items-center justify-center rounded-full border border-white/25 bg-black/30 backdrop-blur">
                    <Play className="ml-0.5 size-5 fill-white/80 text-white/80" />
                  </span>
                </div>
              ) : activeSeg ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3.5 py-2 text-[12px] text-white/55 backdrop-blur">
                    静帧预演 · 待生成成片
                  </span>
                </div>
              ) : null}
              {/* 底部提示词 */}
              {activeSeg ? (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8">
                  <p className="line-clamp-2 text-[12px] leading-5 text-white/85">
                    {activeSeg.videoPrompt || "（待写演绎提示词）"}
                    {activeSeg.promptStale ? (
                      <span className="ml-1 inline-block rounded bg-amber-500/20 px-1 text-[10px] text-amber-300">
                        待重写
                      </span>
                    ) : null}
                  </p>
                  {activeSeg.dialogue ? (
                    <p className="mt-1 text-[11px] text-white/50">
                      {activeSeg.dialogueStrategy
                        ? DIALOGUE_STRATEGY_LABELS[activeSeg.dialogueStrategy]
                        : "后期配音"}
                      ：「{activeSeg.dialogue}」
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/40 px-1.5 py-0.5 text-[10px] tabular-nums text-white/50">
              {episode.aspectRatio}
            </span>
          </div>
        </div>

        {/* 时间线 */}
        <div className="shrink-0 border-t bg-zinc-950/60">
          <div className="flex h-8 items-center gap-2.5 overflow-hidden border-b px-3 text-[10px] whitespace-nowrap text-muted-foreground">
            <button
              type="button"
              onClick={togglePlay}
              disabled={total === 0}
              aria-label={playing ? "暂停" : "播放"}
              className="flex size-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-foreground/10 disabled:opacity-40"
            >
              {playing ? (
                <span className="flex gap-0.5">
                  <span className="h-2.5 w-0.5 bg-foreground" />
                  <span className="h-2.5 w-0.5 bg-foreground" />
                </span>
              ) : (
                <span className="ml-0.5 size-0 border-y-4 border-l-[7px] border-y-transparent border-l-foreground" />
              )}
            </button>
            <span className="shrink-0 tabular-nums">{formatDuration(playhead)}</span>
            <div className="mx-1 h-3 w-px shrink-0 bg-border" />
            <span className="hidden sm:inline">段时长贴合模型档位</span>
            {episode.hookAtSec ? (
              <span className="hidden shrink-0 items-center gap-1 text-red-400/90 md:flex">
                <span className="h-2 w-2 rounded-sm bg-red-500/60" />
                钩子 0–{episode.hookAtSec}s
              </span>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() =>
                    setMarkers((prev) => [
                      ...prev,
                      { atSec: Math.round(playhead * 10) / 10, note: `看片标记 ${prev.length + 1}` },
                    ])
                  }
                  className="hidden shrink-0 items-center gap-1 rounded px-1 transition-colors hover:text-foreground md:flex"
                >
                  <Flag className="size-3" />
                  打标记 (M)
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[11px]">在当前播放头位置落一个审片标记</TooltipContent>
            </Tooltip>
            <span className="ml-auto shrink-0 tabular-nums">
              总时长 {formatDuration(total)}
              {episode.targetDurationSec
                ? ` / 目标 ${formatDuration(episode.targetDurationSec)}`
                : ""}
            </span>
          </div>

          {/* 节点链 + 段块 + 对白轨 */}
          <div className="relative overflow-x-auto [scrollbar-width:thin]">
            <div className="relative min-w-max px-3 pt-2">
              {/* 钩子窗（前 3 秒） */}
              {episode.hookAtSec && total > 0 ? (
                <div
                  className="pointer-events-none absolute inset-y-6 z-0 rounded-sm border-x border-red-500/40 bg-red-500/10"
                  style={{ left: 12, width: `${(episode.hookAtSec / total) * 100}%` }}
                  title={`前 ${episode.hookAtSec} 秒钩子窗——第一帧必须钉住观众`}
                />
              ) : null}

              {/* 节点链 */}
              <div className="relative z-10 flex items-center gap-0 pb-1.5">
                {episode.keyframes.map((kf, i) => (
                  <div key={kf.id} className="flex items-center">
                    <KfNode
                      kf={kf}
                      active={activeKf?.id === kf.id}
                      onClick={() => {
                        studio.setActiveKeyframeId(kf.id);
                        studio.setActiveSegmentId(null);
                        onOpenCandidates();
                      }}
                    />
                    {i < episode.keyframes.length - 1 ? (
                      <div className="relative mx-1">
                        <button
                          type="button"
                          aria-label="在此处插入关键帧"
                          onClick={() => setInsertAt(insertAt === kf.id ? null : kf.id)}
                          className="flex size-4 items-center justify-center rounded-sm border border-dashed text-muted-foreground/60 transition-colors hover:border-foreground/50 hover:text-foreground"
                        >
                          <Plus className="size-2.5" />
                        </button>
                        {insertAt === kf.id ? (
                          <div className="absolute left-1/2 top-5 z-30 flex -translate-x-1/2 items-center gap-1 rounded-md border bg-background p-1 shadow-lg">
                            {[1, 2, 3].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => {
                                  studio.insertKeyframes(kf.id, n);
                                  setInsertAt(null);
                                }}
                                className="rounded px-2 py-1 text-[11px] tabular-nums text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                              >
                                插 {n} 帧
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* 段块 */}
              <div className="relative z-10 flex h-16 items-stretch gap-px">
                {episode.segments.map((seg) => {
                  const active = seg.id === activeSeg?.id;
                  return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => {
                      studio.setActiveSegmentId(seg.id);
                      studio.setActiveKeyframeId(null);
                      onOpenCandidates();
                    }}
                    style={{ flexGrow: seg.duration, flexBasis: `${seg.duration * 16}px` }}
                      className={cn(
                        "group relative flex min-w-20 flex-col justify-between overflow-hidden rounded border p-1.5 text-left transition-opacity",
                        segBlockStyle[seg.status],
                        active && "ring-2 ring-foreground/60 ring-offset-1 ring-offset-background",
                      )}
                      title={`${seg.code} · ${seg.duration}s · ${seg.videoPrompt}`}
                    >
                      <span className="flex shrink-0 items-center justify-between gap-1">
                        <span className="min-w-0 truncate whitespace-nowrap text-[10px] font-medium tabular-nums opacity-90">
                          {seg.code}
                        </span>
                        <span className="max-w-12 shrink truncate whitespace-nowrap rounded-sm bg-black/30 px-1 text-[9px] tabular-nums">
                          {getModel(seg.modelId).label.replace("Seedance ", "")}
                        </span>
                      </span>
                      <span className="min-h-0 flex-1 truncate text-[10px] leading-4 opacity-60">
                        {seg.dialogue ? `「${seg.dialogue}」` : seg.videoPrompt}
                      </span>
                      <span className="flex shrink-0 items-center justify-between gap-1">
                        <span className="shrink-0 text-[10px] tabular-nums opacity-90">
                          {seg.duration}s
                        </span>
                        {seg.cost ? (
                          <span className="min-w-0 truncate text-[9px] tabular-nums opacity-70">
                            {formatMoney(seg.cost)}
                          </span>
                        ) : seg.status === "failed" ? (
                          <span className="shrink-0 text-[9px] font-medium">失败</span>
                        ) : seg.status === "stale" ? (
                          <RefreshCcw className="size-2.5 shrink-0" />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
                {total > 0 ? (
                  <div
                    className="pointer-events-none absolute inset-y-2 z-20 w-px bg-foreground/70"
                    style={{ left: `calc(12px + (100% - 24px) * ${total > 0 ? playhead / total : 0})` }}
                  />
                ) : null}
              </div>

              {/* 音频多轨（台词/音效/拟音/配乐——成片六要素的工程化）；轨标悬浮，基准与段块对齐 */}
              {audioTracks.map((kind) => {
                const cues = episode.segments.flatMap((s) =>
                  (s.cues ?? []).filter((c) => c.kind === kind).map((c) => ({ seg: s, cue: c })),
                );
                if (cues.length === 0) return null;
                return (
                  <div
                    key={kind}
                    className="relative z-10 h-5 border-t border-white/[0.04]"
                    title={`${AUDIO_TRACK_LABELS[kind]} · ${cues.length} 条`}
                  >
                    <span className="pointer-events-none absolute left-3 top-0.5 z-10 rounded-sm bg-zinc-950/80 px-1 text-[9px] leading-3.5 text-muted-foreground/50">
                      {AUDIO_TRACK_LABELS[kind]}
                      <span className="ml-1 tabular-nums">{cues.length}</span>
                    </span>
                    {cues.map(({ seg, cue }) => {
                      const segStart = episode.segments
                        .slice(0, episode.segments.indexOf(seg))
                        .reduce((a, s) => a + s.duration, 0);
                      const leftPct = total > 0 ? (segStart + (cue.offsetSec ?? 0)) / total : 0;
                      const widthPct = total > 0 ? (cue.durationSec ?? 1) / total : 0;
                      return (
                        <Tooltip key={cue.id}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute top-0.5 h-4 overflow-hidden rounded-sm border border-emerald-500/25 bg-emerald-500/10 px-1"
                              style={{
                                left: `calc(12px + (100% - 24px) * ${leftPct})`,
                                width: `calc((100% - 24px) * ${Math.max(widthPct, 0.03)})`,
                              }}
                              title={`${cue.label}${cue.provider ? ` · ${cue.provider}` : ""}${cue.cost ? ` · ¥${cue.cost.toFixed(2)}` : ""}`}
                            >
                              <p className="truncate pt-0.5 text-[9px] leading-3.5 text-emerald-200/70">
                                {cue.label}
                              </p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="text-[11px]">
                            {AUDIO_TRACK_LABELS[cue.kind]} · {cue.label}
                            {cue.provider ? ` · ${cue.provider}` : ""}
                            {cue.prompt ? ` · ${cue.prompt}` : ""}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                );
              })}
              <div className="h-2" />

              {/* 审片标记旗 */}
              {markers.length > 0 ? (
                <div className="relative z-10 h-3">
                  {markers.map((m, i) => (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <span
                          className="absolute top-0 size-0 border-x-4 border-t-[6px] border-x-transparent border-t-amber-400"
                          style={{
                            left: `calc(12px + (100% - 24px) * ${total > 0 ? m.atSec / total : 0})`,
                          }}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="text-[11px]">
                        {m.note} · {formatDuration(m.atSec)}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ── 右：当前段信息面板（桌面） ── */}
      <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l p-4 lg:flex">
        {activeSeg ? (
          <>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium tabular-nums">{activeSeg.code}</span>
                <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {SEGMENT_STATUS_LABELS[activeSeg.status]}
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                {activeSeg.videoPrompt || "（待写演绎提示词）"}
              </p>
            </div>
            <div className="grid gap-1.5 rounded-lg border bg-muted/20 p-3 text-[11px] tabular-nums text-muted-foreground">
              <div className="flex justify-between">
                <span>模型档位</span>
                <span className="text-foreground/80">
                  {model?.label} · {activeSeg.resolution}
                </span>
              </div>
              <div className="flex justify-between">
                <span>时长档位</span>
                <span className="text-foreground/80">{activeSeg.duration}s</span>
              </div>
              <div className="flex justify-between">
                <span>对白策略</span>
                <span className="text-foreground/80">
                  {DIALOGUE_STRATEGY_LABELS[activeSeg.dialogueStrategy ?? (activeSeg.dialogue ? "tts-post" : "mute")]}
                </span>
              </div>
              <div className="flex justify-between">
                <span>累计成本</span>
                <span className="text-foreground/80">
                  {formatMoney(activeSeg.cost ?? 0)}（计费 {activeSeg.billedAttempts} · 失败{" "}
                  {activeSeg.failedAttempts}）
                </span>
              </div>
              <div className="flex justify-between">
                <span>单次估价</span>
                <span className="text-foreground/80">
                  {formatMoney(estimateClipCost(activeSeg.modelId, activeSeg.resolution, activeSeg.duration))}
                </span>
              </div>
            </div>
            {activeSeg.promptStale ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-4 text-amber-400">
                提示词已过期（上游变更）——在制作清单或候选池改写保存后才能重制。
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={!canGenerate || activeSeg.status === "generating"}
                    onClick={() => studio.generateSegment(activeSeg.id)}
                    className={cn(
                      "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] font-medium transition-colors",
                      canGenerate && activeSeg.status !== "generating"
                        ? "bg-foreground text-background hover:bg-foreground/90"
                        : "cursor-not-allowed bg-muted text-muted-foreground opacity-60",
                    )}
                  >
                    <Wand2 className="size-3.5" />
                    {activeSeg.status === "generating" ? "生成中…" : "生成本段（继承参数）"}
                  </button>
                </TooltipTrigger>
                {!canGenerate ? (
                  <TooltipContent>
                    {activeSeg.promptStale
                      ? "提示词待重写"
                      : "首帧未定稿——先静后动"}
                  </TooltipContent>
                ) : null}
              </Tooltip>
              <button
                type="button"
                onClick={onOpenCandidates}
                className="h-8 rounded-md border px-3 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
              >
                候选池
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[12px] text-muted-foreground">
            <Sparkles className="mr-2 size-4" />
            本集还没有演绎段
          </div>
        )}
      </aside>
    </div>
  );
}
