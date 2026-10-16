import { useState } from "react";
import { Film, Plus, Sparkles } from "lucide-react";
import type { Episode } from "@dimples/apa-shared";
import { formatDuration } from "@dimples/apa-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** 剧本模式：集大纲（四节拍）+ 场次剧本编辑器 */
export function ScriptMode({
  episode,
  onEpisodeChange,
  onCreateShotFromScene,
}: {
  episode: Episode;
  onEpisodeChange: (patch: Partial<Episode>) => void;
  onCreateShotFromScene: (sceneId: string, description: string) => void;
}) {
  const [activeSceneId, setActiveSceneId] = useState(episode.scriptScenes[0]?.id ?? "");
  const activeScene =
    episode.scriptScenes.find((s) => s.id === activeSceneId) ?? episode.scriptScenes[0];

  const charCount = episode.scriptScenes.reduce(
    (acc, sc) => acc + sc.blocks.reduce((a, b) => a + b.text.length, 0),
    0,
  );
  const estimated = Math.round(charCount / 4.5);
  const target = episode.targetDurationSeconds ?? 240;

  function updateScene(sceneId: string, patch: Partial<(typeof episode.scriptScenes)[number]>) {
    onEpisodeChange({
      scriptScenes: episode.scriptScenes.map((sc) =>
        sc.id === sceneId ? { ...sc, ...patch } : sc,
      ),
    });
  }

  function addScene() {
    const num = episode.scriptScenes.length + 1;
    onEpisodeChange({
      scriptScenes: [
        ...episode.scriptScenes,
        {
          id: `sc-new-${Date.now()}`,
          sceneNumber: `S${String(num).padStart(2, "0")}`,
          heading: `内景 · 新场景 · 日`,
          blocks: [{ id: `sb-${Date.now()}`, type: "action", text: "" }],
          shotIds: [],
        },
      ],
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* 集大纲 */}
      <div className="shrink-0 border-b p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-medium text-muted-foreground">本集大纲</span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            场次正文 {charCount} 字 ≈ 预估 {formatDuration(estimated)} / 目标{" "}
            {formatDuration(target)}
          </span>
        </div>
        <Textarea
          value={episode.synopsis}
          onChange={(e) => onEpisodeChange({ synopsis: e.target.value })}
          placeholder="本集故事大纲：先立钩子与转折，再决定每个镜头要不要存在…"
          rows={3}
          className="resize-none text-[13px]"
        />
        {episode.beatSheet ? (
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] leading-4 text-muted-foreground sm:grid-cols-4">
            {(
              [
                ["钩子", episode.beatSheet.hook],
                ["推进", episode.beatSheet.development],
                ["转折", episode.beatSheet.turn],
                ["结尾钩子", episode.beatSheet.endingHook],
              ] as const
            ).map(([label, text]) => (
              <div key={label} className="rounded border bg-muted/40 px-2 py-1.5">
                <span className="text-[10px] font-medium text-foreground/70">{label}</span>
                <p className="mt-0.5 line-clamp-2">{text}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* 场次编辑 */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* 场次列表：移动端横滑 chips / 桌面端侧栏 */}
        <div className="hidden w-56 shrink-0 flex-col border-r lg:flex">
          <div className="flex h-10 items-center justify-between border-b px-3">
            <span className="text-[12px] font-medium text-muted-foreground">
              场次 {episode.scriptScenes.length}
            </span>
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]">
              <Plus className="size-3" />
              场
            </Button>
          </div>
          <div className="p-2">
            {episode.scriptScenes.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => setActiveSceneId(sc.id)}
                className={cn(
                  "mb-1 flex w-full items-center gap-2 rounded-md border p-2 text-left text-[12px] transition-colors",
                  sc.id === activeScene?.id
                    ? "border-foreground/25 bg-foreground/[0.06]"
                    : "border-transparent hover:border-foreground/15 hover:bg-foreground/[0.04]",
                )}
              >
                <span className="tabular-nums text-muted-foreground">{sc.sceneNumber}</span>
                <span className="flex-1 truncate">{sc.heading}</span>
              </button>
            ))}
            <Button variant="ghost" size="sm" className="mt-1 w-full gap-1 text-[11px] text-muted-foreground" onClick={addScene}>
              <Plus className="size-3" />
              新增场次
            </Button>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b p-2 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
          {episode.scriptScenes.map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => setActiveSceneId(sc.id)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[12px]",
                sc.id === activeScene?.id
                  ? "border-foreground/45 bg-foreground/[0.08] font-medium text-foreground"
                  : "text-muted-foreground hover:border-foreground/30",
              )}
            >
              <span className="tabular-nums">{sc.sceneNumber}</span>
              <span className="max-w-32 truncate">{sc.heading}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={addScene}
            className="flex h-9 shrink-0 items-center rounded-md border border-dashed px-2.5 text-[12px] text-muted-foreground"
          >
            <Plus className="size-3" />
          </button>
        </div>

        {/* 场次编辑器 */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
          {activeScene ? (
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="grid gap-2">
                <span className="text-[12px] font-medium text-muted-foreground">场头</span>
                <div className="flex items-center gap-1.5">
                  <span className="rounded border bg-muted/40 px-2 py-1.5 text-[13px] tabular-nums text-muted-foreground">
                    {activeScene.sceneNumber}
                  </span>
                  <Input
                    value={activeScene.heading}
                    onChange={(e) => updateScene(activeScene.id, { heading: e.target.value })}
                    className="h-9 flex-1 text-[13px]"
                  />
                </div>
              </div>

              {activeScene.blocks.map((block) => (
                <div
                  key={block.id}
                  className={cn("grid gap-1.5", block.type === "dialogue" && "pl-6")}
                >
                  {block.type === "dialogue" ? (
                    <span className="text-[11px] font-medium tracking-wide text-foreground/70 uppercase">
                      {block.character}
                    </span>
                  ) : null}
                  <Textarea
                    value={block.text}
                    onChange={(e) =>
                      updateScene(activeScene.id, {
                        blocks: activeScene.blocks.map((b) =>
                          b.id === block.id ? { ...b, text: e.target.value } : b,
                        ),
                      })
                    }
                    rows={Math.max(2, Math.ceil(block.text.length / 36))}
                    className={cn(
                      "resize-none text-[13px] leading-6",
                      block.type === "dialogue" && "border-l-2 border-l-muted pl-3",
                    )}
                  />
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="mt-2 gap-1.5 self-start"
                onClick={() =>
                  onCreateShotFromScene(activeScene.id, activeScene.blocks.map((b) => b.text).join(" "))
                }
              >
                <Sparkles className="size-3.5" />
                从本场生成镜头
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Film className="size-8" />
              <p className="text-[13px]">本集还没有场次，从下方新增</p>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={addScene}>
                <Plus className="size-3.5" />
                新增场次
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
