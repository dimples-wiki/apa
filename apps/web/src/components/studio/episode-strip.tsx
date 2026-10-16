import { Plus } from "lucide-react";
import type { Episode } from "@dimples/apa-shared";
import { episodeDuration, formatDuration } from "@dimples/apa-shared";
import { cn } from "@/lib/utils";

/** 横向集条：集卡（EP+标题+四色迷你条）+ 尾卡新集 + 右端共 N 集 */
export function EpisodeStrip({
  episodes,
  activeIndex,
  onSelect,
  onAdd,
}: {
  episodes: Episode[];
  activeIndex: number;
  onSelect: (i: number) => void;
  onAdd: () => void;
}) {
  const statusColors = [
    { key: "ready", dot: "bg-emerald-400" },
    { key: "generating", dot: "bg-[#0070f3]" },
    { key: "keyframe", dot: "bg-amber-400" },
    { key: "draft", dot: "bg-zinc-500" },
    { key: "failed", dot: "bg-red-500" },
  ];

  function miniBar(ep: Episode): string[] {
    const total = episodeDuration(ep) || 1;
    const buckets: Record<string, number> = {};
    for (const s of ep.shots) buckets[s.status] = (buckets[s.status] ?? 0) + s.duration;
    return statusColors.map(({ key }) => `${((buckets[key] ?? 0) / total) * 100}%`);
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span className="shrink-0 text-[11px] text-muted-foreground">
        共 {episodes.length} 集
      </span>
      <div className="mx-1 h-4 w-px bg-border" />
      {episodes.map((ep, i) => {
        const bars = miniBar(ep);
        const active = i === activeIndex;
        return (
          <button
            key={ep.id}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "flex h-11 w-44 shrink-0 flex-col justify-center gap-1 rounded-md border px-3 text-left transition-colors",
              active
                ? "border-foreground/40 bg-foreground/[0.07]"
                : "border-transparent hover:border-foreground/20 hover:bg-foreground/[0.04]",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                EP{String(ep.number).padStart(2, "0")}
              </span>
              <span className="truncate text-[12px] font-medium">{ep.title}</span>
              <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                {formatDuration(episodeDuration(ep))}
              </span>
            </div>
            <div className="flex h-1 gap-px overflow-hidden rounded-full">
              {bars.map((w, j) => (
                <span
                  key={j}
                  className={cn("h-full", statusColors[j].dot)}
                  style={{ width: w }}
                />
              ))}
              {episodeDuration(ep) === 0 ? (
                <span className="h-full w-full rounded-full bg-muted" />
              ) : null}
            </div>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        aria-label="新增一集"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
