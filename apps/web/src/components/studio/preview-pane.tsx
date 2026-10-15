import { Clapperboard, Sparkles, Wand2 } from "lucide-react";
import type { Shot } from "@dimples/apa-shared";
import { SHOT_STATUS_LABELS } from "@dimples/apa-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusVariant: Record<Shot["status"], string> = {
  draft: "border-zinc-500/40 text-zinc-400",
  keyframe: "border-amber-500/40 text-amber-400",
  generating: "border-[#0070f3]/40 text-[#0070f3]",
  ready: "border-emerald-500/40 text-emerald-400",

  failed: "border-destructive/50 bg-destructive/10 text-red-400",};

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
      {/* 画面预览 */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-zinc-950">
        {shot ? (
          <>
            {/* 关键帧画面（AI 生成前的视觉锚点，当前为派生色预演） */}
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

            {/* 中央镜头号水印 */}
            <span
              className="pointer-events-none absolute right-6 top-4 text-[120px] leading-none font-bold tracking-tighter select-none"
              style={{ color: "oklch(1 0 0 / 5%)" }}
            >
              {shot.code.split("-")[1]}
            </span>

            {/* 顶部信息条 */}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cnBadge(statusVariant[shot.status])}>
                  {shot.status === "generating" ? (
                    <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-current" />
                  ) : null}
                  {SHOT_STATUS_LABELS[shot.status]}
                </Badge>
                <span className="text-[12px] font-medium tabular-nums text-white/80">
                  {shot.code}
                </span>
                <span className="text-[11px] text-white/40">
                  EP{String(episodeMeta.number).padStart(2, "0")} · 镜头{" "}
                  {String(episodeMeta.index).padStart(2, "0")}/{episodeMeta.total}
                </span>
              </div>
              <span className="text-[12px] tabular-nums text-white/60">{shot.duration}s</span>
            </div>

            {/* 底部描述渐显 */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-4">
              <p className="max-w-2xl text-[13px] leading-5 text-white/85">
                {shot.description || "（待补充画面描述——在右侧属性面板填写导演意图）"}
              </p>
              {shot.line ? (
                <p className="mt-1.5 text-[12px] text-white/50">「{shot.line}」</p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Clapperboard className="size-8" />
            <p className="text-[13px]">本集暂无镜头，从左栏或顶部按钮添加</p>
          </div>
        )}
      </div>

      {/* 操作条 */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-t px-4">
        <span className="text-[12px] text-muted-foreground">
          关键帧驱动 · AI 依首帧补全本镜头画面
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Wand2 className="size-3.5" />
            编辑关键帧
          </Button>
          <Button size="sm" className="gap-1.5" onClick={onGenerate} disabled={!shot}>
            <Sparkles className="size-3.5" />
            {shot?.status === "generating" ? "生成中…" : "AI 生成本镜头"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function cnBadge(extra: string): string {
  return `bg-background/60 backdrop-blur-sm ${extra}`;
}
