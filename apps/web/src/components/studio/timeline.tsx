import { KeySquare } from "lucide-react";
import type { Shot } from "@dimples/apa-shared";
import { formatDuration } from "@dimples/apa-shared";
import { cn } from "@/lib/utils";

/** 状态 → 镜头块颜色语言（与镜头列表一致） */
const blockTone: Record<Shot["status"], string> = {
  draft: "border-zinc-700 bg-zinc-900 text-zinc-500",
  keyframe: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  generating: "border-[#0070f3]/50 bg-[#0070f3]/15 text-[#6cb8ff] animate-pulse",
  ready: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  failed:
    "border-destructive/60 bg-destructive/10 text-red-300 [background-image:repeating-linear-gradient(45deg,transparent_0px,transparent_4px,rgba(239,68,68,0.12)_4px,rgba(239,68,68,0.12)_8px)]",
};

export function Timeline({
  shots,
  activeShotId,
  onSelect,
  total,
}: {
  shots: Shot[];
  activeShotId: string;
  onSelect: (id: string) => void;
  total: number;
}) {
  return (
    <div className="shrink-0 border-t">
      {/* 标尺 */}
      <div className="flex h-6 items-center justify-between border-b px-4 text-[10px] tabular-nums text-muted-foreground/60">
        <span>时间线 · 关键帧驱动</span>
        <span>总时长 {formatDuration(total)}</span>
      </div>

      {/* 轨道 */}
      <div className="flex h-24 items-stretch gap-px overflow-x-auto bg-zinc-950/60 p-2">
        {shots.length === 0 ? (
          <div className="flex w-full items-center justify-center text-[11px] text-muted-foreground/60">
            镜头块将按时长比例排列在此轨道
          </div>
        ) : (
          shots.map((shot, i) => (
            <button
              key={shot.id}
              type="button"
              onClick={() => onSelect(shot.id)}
              style={{ flexGrow: shot.duration, flexBasis: `${shot.duration * 14}px` }}
              className={cn(
                "group relative flex min-w-14 flex-col justify-between overflow-hidden rounded border p-1.5 text-left transition-colors",
                blockTone[shot.status],
                shot.id === activeShotId &&
                  "ring-2 ring-foreground/60 ring-offset-1 ring-offset-background",
              )}
              title={`${shot.code} · ${shot.duration}s · ${shot.description}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-medium tabular-nums opacity-80">{shot.code}</span>
                {shot.keyframe.description ? <KeySquare className="size-2.5 opacity-70" /> : null}
              </div>
              <span className="truncate text-[10px] opacity-60">{shot.camera}</span>
              <span className="text-[10px] tabular-nums opacity-90">{shot.duration}s</span>
              {shot.status === "keyframe" ? (
                <span
                  className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current opacity-60"
                  title="关键帧已定"
                />
              ) : null}
              <span className="sr-only">{`镜头 ${i + 1}`}</span>
            </button>
          ))
        )}
        {shots.length > 0 ? (
          <div className="flex min-w-16 flex-col items-center justify-center rounded border border-dashed border-muted-foreground/25 text-muted-foreground/40">
            <span className="text-[10px]">+</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
