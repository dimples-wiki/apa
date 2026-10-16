import { CircleDashed, Film, KeySquare, Loader2, Plus, RotateCcw } from "lucide-react";
import type { Shot } from "@dimples/apa-shared";
import { shotSizeAbbr } from "@dimples/apa-shared";
import { cn } from "@/lib/utils";

const statusIcon: Record<Shot["status"], { Icon: typeof Film; cls: string }> = {
  draft: { Icon: CircleDashed, cls: "border-zinc-700 bg-zinc-900 text-zinc-500" },
  keyframe: { Icon: KeySquare, cls: "border-amber-500/40 bg-amber-500/10 text-amber-400" },
  generating: {
    Icon: Loader2,
    cls: "border-[#0070f3]/50 bg-[#0070f3]/10 text-[#6cb8ff]",
  },
  ready: { Icon: Film, cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" },
  failed: { Icon: RotateCcw, cls: "border-destructive/50 bg-destructive/10 text-red-400" },
};

/** 左栏镜头列表：状态图标 + 镜头号/景别 + 时长 + 描述 + 待同步标记 */
export function ShotList({
  shots,
  activeShotId,
  onSelect,
  onAdd,
  emptyHint = "本集还没有镜头，从顶部添加",
}: {
  shots: Shot[];
  activeShotId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  emptyHint?: string;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {shots.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-muted-foreground">
          <Film className="size-7 opacity-60" />
          <p className="text-[12px]">{emptyHint}</p>
        </div>
      ) : (
        shots.map((shot) => {
          const { Icon, cls } = statusIcon[shot.status];
          const active = shot.id === activeShotId;
          return (
            <button
              key={shot.id}
              type="button"
              onClick={() => onSelect(shot.id)}
              className={cn(
                "flex w-full gap-2.5 border-b px-3 py-2.5 text-left transition-colors last:border-b-0",
                active ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded border",
                  cls,
                )}
              >
                <Icon
                  className={cn("size-3.5", shot.status === "generating" && "animate-spin")}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-[12px] font-medium tabular-nums">{shot.code}</span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {shotSizeAbbr(shot.shotSize)}
                  </span>
                  {shot.scriptSyncStatus === "stale" ? (
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-amber-400"
                      title="剧本已改稿，此镜头待同步"
                    />
                  ) : null}
                  <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                    {shot.duration}s
                  </span>
                </span>
                <span
                  className={cn(
                    "mt-0.5 line-clamp-2 block text-[11px] leading-4",
                    shot.description ? "text-muted-foreground" : "text-muted-foreground/50",
                  )}
                >
                  {shot.description ||
                    (shot.status === "failed" ? shot.failureReason : "（待补充画面描述）")}
                </span>
              </span>
            </button>
          );
        })
      )}
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-1.5 py-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.03] hover:text-foreground"
      >
        <Plus className="size-3.5" />
        新增镜头
      </button>
    </div>
  );
}
