import { useState } from "react";
import { ArrowRightLeft, Clapperboard, Sparkles, Timer, TriangleAlert } from "lucide-react";
import {
  BEAT_KIND_LABELS,
  type BeatKind,
  formatDuration,
} from "@dimples/apa-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { useStudio } from "@/hooks/use-studio";

type Studio = ReturnType<typeof useStudio>;

/** 节拍类型标签（低饱和底色，不复用状态色语言，避免语义冲突） */
const beatTag: Record<BeatKind, string> = {
  hook: "bg-rose-500/10 text-rose-300/90",
  development: "bg-sky-500/10 text-sky-300/90",
  turn: "bg-purple-500/10 text-purple-300/90",
  ending: "bg-amber-500/10 text-amber-300/90",
};

/** 剧本规划：集元数据 + 四节拍 + 关键帧规划（拆集产物，人可改） */
export function PlanView({ studio }: { studio: Studio }) {
  const { episode, updateEpisodeMeta, planKeyframesFromBeats, alignBeatChanges } = studio;
  const plannedDur = episode.segments.reduce((a, s) => a + s.duration, 0);
  const target = episode.targetDurationSec ?? 75;
  const unlinked = episode.keyframes.filter((k) => !k.beatId).length;
  const [aligned, setAligned] = useState<Record<string, boolean>>({});

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-4 pb-10 sm:p-6">
        {/* 集元数据 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label className="text-[12px] text-muted-foreground">本集标题 / 戏剧目标</Label>
            <Input
              value={episode.title}
              onChange={(e) => updateEpisodeMeta({ title: e.target.value })}
              className="h-9 text-[13px]"
            />
            <Textarea
              value={episode.dramaticGoal}
              onChange={(e) => updateEpisodeMeta({ dramaticGoal: e.target.value })}
              placeholder="这一集要把观众钉在哪？（戏剧目标）"
              rows={2}
              className="resize-none text-[13px]"
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-[12px] text-muted-foreground">本集大纲（拆集与关键帧规划的依据）</Label>
            <Textarea
              value={episode.synopsis}
              onChange={(e) => updateEpisodeMeta({ synopsis: e.target.value })}
              placeholder="先有故事，再决定每一帧要不要存在…"
              rows={4}
              className="resize-none text-[13px] leading-5"
            />
          </div>
        </div>

        {/* 规格行 */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
          <span className="rounded-full border px-2.5 py-1">
            画幅 {episode.aspectRatio}
          </span>
          <span className="flex items-center gap-1 rounded-full border px-2.5 py-1">
            <Timer className="size-3" />
            规划 {formatDuration(plannedDur)} / 目标 {formatDuration(target)}
          </span>
          {episode.hookAtSec ? (
            <span className="rounded-full border border-red-400/40 px-2.5 py-1 text-red-400">
              前 {episode.hookAtSec}s 钩子位
            </span>
          ) : null}
          {episode.filingNo ? (
            <span className="rounded-full border px-2.5 py-1" title="微短剧备案（合规）">
              {episode.filingNo}
            </span>
          ) : null}
          {plannedDur < target ? (
            <span className="flex items-center gap-1 text-amber-500">
              <TriangleAlert className="size-3" />
              还差 {formatDuration(target - plannedDur)}——继续拆节拍或加关键帧
            </span>
          ) : null}
        </div>

        {/* 四节拍 */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-[12px] text-muted-foreground">节拍（剧本传导枢纽）</Label>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-[12px]"
              onClick={planKeyframesFromBeats}
              disabled={episode.beats.length === 0}
            >
              <Sparkles className="size-3.5" />
              从节拍生成关键帧骨架
            </Button>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {episode.beats.map((b) => {
              const kfCount = episode.keyframes.filter((k) => k.beatId === b.id).length;
              const segCount = episode.segments.filter((s) => {
                const kf = episode.keyframes.find((k) => k.id === s.fromKeyframeId);
                return kf?.beatId === b.id;
              }).length;
              return (
                <div key={b.id} className="rounded-md border border-l-2 border-l-border bg-muted/30 p-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-px text-[10px] font-medium",
                        beatTag[b.kind],
                      )}
                    >
                      {BEAT_KIND_LABELS[b.kind]}
                    </span>
                    {b.scriptSceneRef ? (
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {b.scriptSceneRef}
                      </span>
                    ) : null}
                    <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                      {kfCount} 帧 · {segCount} 段
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{b.text}</p>
                  <button
                    type="button"
                    onClick={() => {
                      alignBeatChanges(b.id);
                      setAligned((p) => ({ ...p, [b.id]: true }));
                    }}
                    className={cn(
                      "mt-1.5 flex items-center gap-1 text-[10px] transition-colors",
                      aligned[b.id]
                        ? "cursor-default text-emerald-500"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    title="改完节拍后，把挂载在本拍下的演绎段标记为待重制（提示词待重写）"
                  >
                    <ArrowRightLeft className="size-2.5" />
                    {aligned[b.id] ? "已对齐——演绎段置为待重制" : "变更对齐到演绎段"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 关键帧规划说明 */}
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <Clapperboard className="size-3.5 text-muted-foreground" />
            <span className="text-[12px] font-medium">规划产出</span>
          </div>
          <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
            本集规划 <span className="tabular-nums text-foreground/85">{episode.keyframes.length}</span> 个关键帧、
            <span className="tabular-nums text-foreground/85"> {episode.segments.length}</span> 段演绎；
            段时长全部贴合所选模型的时长档位（5s/10s/15s）。
            {unlinked > 0 ? ` ${unlinked} 帧未挂节拍。` : ""}
            切到「制作清单」写提示词、生成与选优。
          </p>
        </div>
      </div>
    </div>
  );
}
