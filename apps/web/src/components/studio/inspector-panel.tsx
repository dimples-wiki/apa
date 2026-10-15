import { Camera, Clapperboard, KeySquare, Type } from "lucide-react";
import type { Shot } from "@dimples/apa-shared";
import { SHOT_STATUS_LABELS } from "@dimples/apa-shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CAMERA_MOVES } from "@dimples/apa-shared";

export function InspectorPanel({
  shot,
  onChange,
}: {
  shot: Shot;
  onChange: (patch: Partial<Shot>) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <Clapperboard className="size-3.5 text-muted-foreground" />
        <span className="text-[12px] font-medium text-muted-foreground">镜头属性</span>
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{shot.code}</span>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* 关键帧 */}
        <div className="grid gap-2">
          <Label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <KeySquare className="size-3.5" />
            首帧关键帧
          </Label>
          <Textarea
            value={shot.keyframe.description}
            onChange={(e) =>
              onChange({ keyframe: { ...shot.keyframe, description: e.target.value } })
            }
            placeholder="描述关键帧画面——AI 依此补全本镜头动态"
            rows={3}
            className="resize-none text-[13px]"
          />
          <p className="text-[11px] leading-4 text-muted-foreground/70">
            关键帧是本镜头的视觉锚点。AI 将依此帧生成整段镜头画面。
          </p>
        </div>

        {/* 画面描述 */}
        <div className="grid gap-2">
          <Label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Type className="size-3.5" />
            画面描述
          </Label>
          <Textarea
            value={shot.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="导演意图：发生了什么、情绪基调…"
            rows={3}
            className="resize-none text-[13px]"
          />
        </div>

        {/* 运镜 */}
        <div className="grid gap-2">
          <Label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Camera className="size-3.5" />
            运镜方式
          </Label>
          <Select value={shot.camera} onValueChange={(v) => onChange({ camera: v })}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMERA_MOVES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 台词 */}
        <div className="grid gap-2">
          <Label className="text-[12px] text-muted-foreground">台词 / 旁白</Label>
          <Textarea
            value={shot.line ?? ""}
            onChange={(e) => onChange({ line: e.target.value })}
            placeholder="本镜头的对白或旁白…"
            rows={2}
            className="resize-none text-[13px]"
          />
        </div>

        {/* 时长 */}
        <div className="grid gap-2">
          <Label className="text-[12px] text-muted-foreground">时长（秒）</Label>
          <Input
            type="number"
            min={1}
            max={30}
            value={shot.duration}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(v) && v >= 1 && v <= 30) onChange({ duration: v });
            }}
            className="h-9 w-24 text-[13px] tabular-nums"
          />
        </div>

        <div className="rounded-md border bg-muted/40 px-3 py-2">
          <p className="text-[11px] leading-4 text-muted-foreground">
            状态：{SHOT_STATUS_LABELS[shot.status]}。
            {shot.status === "ready"
              ? "本镜头画面已生成，可在时间线预览。"
              : shot.status === "generating"
                ? "AI 正在补全本镜头画面…"
                : shot.status === "keyframe"
                  ? "关键帧已定，可在预览区发起 AI 补全。"
                  : "先定关键帧，再由 AI 补全镜头画面。"}
          </p>
        </div>
      </div>
    </div>
  );
}
