import { Film, KeySquare, Loader2, Wand2 } from "lucide-react";
import type { Shot, ShotStatus } from "@dimples/apa-shared";
import { SHOT_STATUS_LABELS } from "@dimples/apa-shared";
import { cn } from "@/lib/utils";

const statusTone: Record<ShotStatus, string> = {
  draft: "text-muted-foreground",
  keyframe: "text-amber-400",
  generating: "text-[#0070f3]",
  ready: "text-emerald-400",
};

export function ShotList({
  shots,
  activeShotId,
  onSelect,
}: {
  shots: Shot[];
  activeShotId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-1 p-2">
        {shots.map((shot, i) => (
          <button
            key={shot.id}
            type="button"
            onClick={() => onSelect(shot.id)}
            className={cn(
              "group flex w-full items-start gap-2.5 rounded-md border p-2.5 text-left transition-colors",
              shot.id === activeShotId
                ? "border-foreground/25 bg-foreground/[0.06]"
                : "border-transparent hover:border-foreground/15 hover:bg-foreground/[0.04]",
            )}
          >
            {/* 镜头缩略位 */}
            <div
              className={cn(
                "flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded border",
                shot.status === "ready"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : shot.status === "generating"
                    ? "bg-[#0070f3]/10 text-[#0070f3]"
                    : shot.status === "keyframe"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-muted text-muted-foreground",
              )}
            >
              {shot.status === "generating" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : shot.status === "ready" ? (
                <Wand2 className="size-4" />
              ) : shot.status === "keyframe" ? (
                <KeySquare className="size-4" />
              ) : (
                <Film className="size-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-medium tabular-nums">{shot.code}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {shot.duration}s
                </span>
                <span className={cn("ml-auto text-[10px]", statusTone[shot.status])}>
                  {SHOT_STATUS_LABELS[shot.status]}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-4 text-muted-foreground">
                {shot.description || "（待补充画面描述）"}
              </p>
            </div>
            <span className="mt-0.5 hidden text-[10px] tabular-nums text-muted-foreground/60 group-hover:inline">
              {String(i + 1).padStart(2, "0")}
            </span>
          </button>
        ))}
        {shots.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Film className="size-5" />
            <p className="text-[12px]">本集还没有镜头</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
