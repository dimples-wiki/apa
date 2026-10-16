import { useEffect, useRef } from "react";
import type { Shot } from "@dimples/apa-shared";
import { formatDuration, formatTimecode } from "@dimples/apa-shared";
import { cn } from "@/lib/utils";

const statusBlock: Record<Shot["status"], string> = {
  draft: "border-zinc-700 bg-zinc-900 text-zinc-400",
  keyframe: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  generating: "border-[#0070f3]/50 bg-[#0070f3]/15 text-[#6cb8ff]",
  ready: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  failed:
    "border-destructive/60 bg-destructive/10 text-red-300 bg-[repeating-linear-gradient(45deg,transparent_0px,transparent_4px,rgba(239,68,68,0.12)_4px,rgba(239,68,68,0.12)_8px)]",
};

const statusLegend: Record<Shot["status"], string> = {
  draft: "bg-zinc-500",
  keyframe: "bg-amber-400",
  generating: "bg-[#0070f3]",
  ready: "bg-emerald-400",
  failed: "bg-destructive",
};

export function Timeline({
  shots,
  activeShotId,
  onSelect,
  total,
  statusFilter,
  onFilterChange,
  playhead,
  playing,
  onTogglePlay,
}: {
  shots: Shot[];
  activeShotId: string | null;
  onSelect: (id: string) => void;
  total: number;
  statusFilter: Shot["status"] | null;
  onFilterChange: (s: Shot["status"] | null) => void;
  playhead: number;
  playing: boolean;
  onTogglePlay: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (playing && scrollRef.current) {
      const el = scrollRef.current;
      const pct = total > 0 ? playhead / total : 0;
      el.scrollLeft = Math.max(0, pct * el.scrollWidth - el.clientWidth / 2);
    }
  }, [playhead, playing, total]);

  const statuses: Shot["status"][] = ["draft", "keyframe", "generating", "ready", "failed"];
  const statusLabel: Record<Shot["status"], string> = {
    draft: "草稿",
    keyframe: "关键帧",
    generating: "生成中",
    ready: "就绪",
    failed: "失败",
  };

  return (
    <div className="shrink-0 border-t bg-zinc-950/60">
      {/* 图例 + 播放控制 */}
      <div className="flex h-8 items-center gap-2.5 overflow-hidden border-b px-3 text-[10px] whitespace-nowrap text-muted-foreground sm:gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={shots.length === 0}
          aria-label={playing ? "暂停" : "播放"}
          className="flex size-5 items-center justify-center rounded transition-colors hover:bg-foreground/10 disabled:opacity-40"
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
        <span className="shrink-0 tabular-nums">{formatTimecode(playhead)}</span>
        <div className="mx-1 h-3 w-px shrink-0 bg-border" />
        {shots.length > 0 ? (
          statuses.map((st) => {
            const count = shots.filter((s) => s.status === st).length;
            const active = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                title={`筛选${statusLabel[st]}镜头`}
                onClick={() => onFilterChange(active ? null : st)}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded px-1 transition-colors hover:text-foreground",
                  active && "bg-foreground/10 text-foreground",
                )}
              >
                <span className={cn("size-1.5 rounded-full", statusLegend[st])} />
                <span className="hidden sm:inline">{statusLabel[st]}</span>
                {count}
              </button>
            );
          })
        ) : (
          <span>空集</span>
        )}
        <span className="ml-auto shrink-0 tabular-nums">总时长 {formatDuration(total)}</span>
      </div>

      {/* 轨道 */}
      <div ref={scrollRef} className="relative overflow-x-auto">
        <div className="flex h-20 items-stretch gap-px p-2">
          {shots.map((shot) => {
            const active = shot.id === activeShotId;
            const filteredOut = statusFilter && shot.status !== statusFilter;
            return (
              <button
                key={shot.id}
                type="button"
                onClick={() => onSelect(shot.id)}
                style={{ flexGrow: shot.duration, flexBasis: `${shot.duration * 14}px` }}
                className={cn(
                  "group relative flex min-w-16 flex-col justify-between overflow-hidden rounded border p-1.5 text-left transition-opacity",
                  statusBlock[shot.status],
                  active && "ring-2 ring-foreground/60 ring-offset-1 ring-offset-background",
                  filteredOut && "opacity-30",
                )}
                title={`${shot.code} · ${shot.duration}s · ${shot.description}`}
              >
                <div className="flex shrink-0 items-center justify-between gap-1">
                  <span className="truncate whitespace-nowrap text-[10px] font-medium tabular-nums opacity-90">
                    {shot.code}
                  </span>
                  {shot.keyframe.description ? (
                    <span className="size-1.5 shrink-0 rotate-45 bg-current opacity-60" title="关键帧" />
                  ) : null}
                </div>
                <span className="min-h-0 flex-1 truncate text-[10px] leading-4 opacity-60">
                  {shot.line ?? shot.camera}
                </span>
                <span className="flex shrink-0 items-center justify-between">
                  <span className="text-[10px] tabular-nums opacity-90">{shot.duration}s</span>
                  {shot.status === "failed" ? (
                    <span className="text-[9px] font-medium text-red-400">失败</span>
                  ) : null}
                </span>
              </button>
            );
          })}
          {shots.length > 0 && total > 0 ? (
            <div
              className="pointer-events-none absolute inset-y-2 z-10 w-px bg-foreground/80"
              style={{ left: `${total > 0 ? (playhead / total) * 100 : 0}%` }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
