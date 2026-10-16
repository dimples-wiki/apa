import {
  AlertTriangle,
  CircleDashed,
  KeySquare,
  Loader2,
  Play,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { Shot } from "@dimples/apa-shared";
import { SHOT_STATUS_LABELS } from "@dimples/apa-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusVariant: Record<Shot["status"], string> = {
  draft: "border-zinc-500/40 text-zinc-400",
  keyframe: "border-amber-500/40 text-amber-400",
  generating: "border-[#0070f3]/40 text-[#0070f3]",
  ready: "border-emerald-500/40 text-emerald-400",
  failed: "border-destructive/50 text-red-400",
};

export function PreviewPane({
  shot,
  episodeMeta,
  onGenerate,
}: {
  shot: Shot | undefined;
  episodeMeta: { number: number; title: string; total: number; index: number };
  onGenerate: () => void;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* 监视器：16:9 画框承载画面，框外留黑 */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black p-3 sm:p-5">
        {shot ? (
          <div className="relative aspect-video max-h-full w-full overflow-hidden rounded-lg border border-white/15 shadow-[0_0_60px_rgba(0,0,0,0.8)]">
            {/* 关键帧预演（未生成前的派生色视觉锚点，显式标注非成片） */}
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: "oklch(0.13 0.02 250)",
                backgroundImage:
                  "radial-gradient(60% 55% at 30% 35%, oklch(0.28 0.05 250), transparent 70%), radial-gradient(45% 40% at 75% 70%, oklch(0.2 0.03 230), transparent 75%)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.15] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
                backgroundSize: "120px 120px",
              }}
            />

            <span
              className="pointer-events-none absolute right-4 top-2 text-[72px] leading-none font-bold tracking-tighter select-none sm:right-6 sm:top-4 sm:text-[100px]"
              style={{ color: "oklch(1 0 0 / 6%)" }}
            >
              {shot.code.split("-")[1]}
            </span>

            {/* 中央状态锚点：让每种镜头状态在监视器里"有物可看" */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {shot.status === "ready" ? (
                <span className="flex size-14 items-center justify-center rounded-full border border-white/25 bg-black/30 backdrop-blur-sm">
                  <Play className="ml-0.5 size-5 fill-white/80 text-white/80" />
                </span>
              ) : shot.status === "generating" ? (
                <span className="flex items-center gap-2 rounded-full border border-[#0070f3]/40 bg-black/40 px-3.5 py-2 text-[12px] text-[#6cb8ff] backdrop-blur-sm">
                  <Loader2 className="size-3.5 animate-spin" />
                  AI 正在依关键帧补全画面…
                </span>
              ) : shot.status === "failed" ? (
                <span className="flex items-center gap-2 rounded-full border border-destructive/40 bg-black/40 px-3.5 py-2 text-[12px] text-red-400 backdrop-blur-sm">
                  <AlertTriangle className="size-3.5" />
                  生成失败 · 可重试
                </span>
              ) : shot.status === "keyframe" ? (
                <span className="flex max-w-56 items-center gap-2 rounded-lg border border-amber-500/30 bg-black/40 px-3.5 py-2 text-[12px] text-amber-300/90 backdrop-blur-sm">
                  <KeySquare className="size-3.5 shrink-0" />
                  <span className="line-clamp-2">{shot.keyframe.description || "关键帧已定"}</span>
                </span>
              ) : (
                <span className="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3.5 py-2 text-[12px] text-white/50 backdrop-blur-sm">
                  <CircleDashed className="size-3.5" />
                  草稿 · 待定关键帧
                </span>
              )}
            </div>

            <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 py-2.5 sm:px-4">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="outline" className={`shrink-0 bg-background/60 backdrop-blur-sm ${statusVariant[shot.status]}`}>
                  {shot.status === "generating" ? (
                    <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-current" />
                  ) : null}
                  {SHOT_STATUS_LABELS[shot.status]}
                </Badge>
                <span className="text-[12px] font-medium tabular-nums text-white/80">
                  {shot.code}
                </span>
                <span className="truncate text-[11px] text-white/40">
                  EP{String(episodeMeta.number).padStart(2, "0")} ·{" "}
                  {String(episodeMeta.index).padStart(2, "0")}/
                  {String(episodeMeta.total).padStart(2, "0")}
                </span>
              </div>
              <span className="shrink-0 text-[12px] tabular-nums text-white/60">
                {shot.duration}s
              </span>
            </div>

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pt-8 pb-2.5 sm:px-4 sm:pb-3">
              <p className="line-clamp-2 text-[12px] leading-5 text-white/85 sm:text-[13px]">
                {shot.description || "（待补充画面描述——在右侧属性面板填写导演意图）"}
              </p>
              {shot.status === "failed" && shot.failureReason ? (
                <p className="mt-1 line-clamp-1 text-[11px] text-red-400">
                  {shot.failureReason}
                </p>
              ) : shot.line ? (
                <p className="mt-1 line-clamp-1 text-[11px] text-white/50">「{shot.line}」</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Sparkles className="size-8" />
            <p className="text-[13px]">监视器待接入画面——添加镜头后，这里预览关键帧与成片</p>
          </div>
        )}
      </div>

      {/* 操作条 */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-t px-4">
        <span className="hidden truncate text-[12px] text-muted-foreground sm:block">
          关键帧驱动 · AI 依首帧补全本镜头画面
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" disabled={!shot}>
            <Wand2 className="size-3.5" />
            编辑关键帧
          </Button>
          <Button size="sm" className="gap-1.5" onClick={onGenerate} disabled={!shot}>
            <Sparkles className="size-3.5" />
            {!shot
              ? "AI 生成本镜头"
              : shot.status === "generating"
                ? "生成中…"
                : shot.status === "failed"
                  ? "重试生成"
                  : "AI 生成本镜头"}
          </Button>
        </div>
      </div>
    </div>
  );
}
