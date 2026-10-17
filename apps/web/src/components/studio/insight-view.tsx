import { useMemo, useState } from "react";
import {
  Check,
  CircleAlert,
  FileText,
  Layers,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  AUDIO_TRACK_LABELS,
  REFERENCE_TYPE_LABELS,
  mockReferenceAssets,
  validateEpisode,
  type CheckStatus,
  type ReferenceType,
} from "@dimples/apa-shared";
import { cn } from "@/lib/utils";
import type { useStudio } from "@/hooks/use-studio";

type Studio = ReturnType<typeof useStudio>;

const checkTone: Record<CheckStatus, { dot: string; text: string; row: string }> = {
  pass: { dot: "bg-emerald-500", text: "text-emerald-400", row: "" },
  warn: { dot: "bg-amber-500", text: "text-amber-400", row: "bg-amber-500/[0.04]" },
  fail: { dot: "bg-red-500", text: "text-red-400", row: "bg-destructive/[0.06]" },
};

const typeAccent: Record<ReferenceType, string> = {
  character: "text-rose-300/90",
  scene: "text-sky-300/90",
  outfit: "text-violet-300/90",
  prop: "text-amber-300/90",
  style: "text-emerald-300/90",
};

function VersionCard({ studio, versionId }: { studio: Studio; versionId: string }) {
  const v = studio.episode?.versions?.find((x) => x.id === versionId);
  if (!v) return null;
  const sections: { title: string; items: string[]; tone: string }[] = [
    { title: "依据", items: v.basis, tone: "text-muted-foreground" },
    { title: "问题", items: v.problems, tone: "text-amber-300/90" },
    { title: "改法", items: v.changes, tone: "text-foreground/85" },
    { title: "量化效果", items: v.metrics, tone: "text-emerald-300/90" },
  ];
  return (
    <div className="rounded-lg border bg-muted/20 p-3.5">
      <div className="flex items-center gap-2">
        <FileText className="size-3.5 text-muted-foreground" />
        <span className="text-[13px] font-medium">{v.label}</span>
        {v.isCurrent ? (
          <span className="rounded-full border border-emerald-500/40 px-1.5 py-px text-[10px] text-emerald-400">
            当前
          </span>
        ) : null}
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          {new Date(v.createdAt).toLocaleString("zh-CN", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map((s) => (
          <div key={s.title} className="rounded-md border bg-background/50 p-2.5">
            <p className="text-[10px] font-medium text-muted-foreground">{s.title}</p>
            <ul className="mt-1 space-y-1">
              {s.items.map((item, i) => (
                <li key={i} className={cn("text-[11px] leading-4", s.tone)}>
                  {i + 1}. {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {v.costByProvider && Object.keys(v.costByProvider).length > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] tabular-nums text-muted-foreground">
          <span className="text-muted-foreground/70">该版花费（按供应商）：</span>
          {Object.entries(v.costByProvider).map(([p, c]) => (
            <span key={p} className="rounded border bg-muted/50 px-1.5 py-px">
              {p} ¥{c.toFixed(2)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 质检页：版本档案（依据→问题→改法→量化效果） + 管线校验报告 + 素材库 */
export function InsightView({ studio }: { studio: Studio }) {
  const { episode, budget } = studio;
  if (!episode) return null;
  const versions = episode.versions ?? [];
  const [versionId, setVersionId] = useState(versions.find((v) => v.isCurrent)?.id ?? versions[0]?.id);
  const checks = useMemo(() => validateEpisode(episode, budget), [episode, budget]);
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;

  // 素材库使用统计（从当前集的 references 汇总演示）
  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const kf of episode.keyframes)
      for (const r of kf.references) map.set(r.assetId, (map.get(r.assetId) ?? 0) + 1);
    return map;
  }, [episode]);

  const audioStats = useMemo(() => {
    const byKind = new Map<string, number>();
    let cost = 0;
    for (const seg of episode.segments)
      for (const cue of seg.cues ?? []) {
        byKind.set(cue.kind, (byKind.get(cue.kind) ?? 0) + 1);
        cost += cue.cost ?? 0;
      }
    return { byKind, cost };
  }, [episode]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 p-4 pb-10 sm:p-6">
        {/* ── 版本档案 ── */}
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-muted-foreground">版本档案</span>
            <span className="text-[11px] text-muted-foreground/60">
              依据 → 问题 → 改法 → 量化效果——重生成是迭代资产，不是失败记录
            </span>
            <div className="ml-auto flex items-center gap-1">
              {versions.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVersionId(v.id)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[12px] transition-colors",
                    versionId === v.id
                      ? "border-foreground/40 bg-foreground/[0.07] font-medium text-foreground"
                      : "text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                  )}
                >
                  {v.label}
                  {v.isCurrent ? <span className="ml-1 text-emerald-400">●</span> : null}
                </button>
              ))}
            </div>
          </div>
          {versionId ? <VersionCard studio={studio} versionId={versionId} /> : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          {/* ── 校验报告 ── */}
          <div className="lg:col-span-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[12px] font-medium text-muted-foreground">
                管线校验（进真实生成前的放行检查）
              </span>
              {failCount > 0 ? (
                <span className="flex items-center gap-1 rounded-full border border-destructive/40 px-2 py-0.5 text-[10px] text-red-400">
                  <X className="size-3" />
                  {failCount} 项阻断
                </span>
              ) : null}
              {warnCount > 0 ? (
                <span className="flex items-center gap-1 rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-400">
                  <TriangleAlert className="size-3" />
                  {warnCount} 项预警
                </span>
              ) : null}
            </div>
            <div className="overflow-hidden rounded-lg border">
              {checks.map((c, i) => {
                const tone = checkTone[c.status];
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5",
                      i > 0 && "border-t",
                      tone.row,
                    )}
                  >
                    {c.status === "pass" ? (
                      <Check className={cn("size-3.5 shrink-0", tone.text)} />
                    ) : c.status === "warn" ? (
                      <TriangleAlert className={cn("size-3.5 shrink-0", tone.text)} />
                    ) : (
                      <X className={cn("size-3.5 shrink-0", tone.text)} />
                    )}
                    <span className="w-44 shrink-0 text-[12px] font-medium">{c.label}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                      {c.detail}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-px text-[10px]",
                        c.status === "pass" && "border-emerald-500/40 text-emerald-400",
                        c.status === "warn" && "border-amber-500/40 text-amber-400",
                        c.status === "fail" && "border-destructive/50 text-red-400",
                      )}
                    >
                      {c.status === "pass" ? "通过" : c.status === "warn" ? "预警" : "阻断"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 音频元素统计 */}
            <div className="mt-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Layers className="size-3.5 text-muted-foreground" />
                <span className="text-[12px] font-medium">音频元素清单</span>
                <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                  {audioStats.cost > 0 ? `合计 ¥${audioStats.cost.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(AUDIO_TRACK_LABELS).map(([kind, label]) => (
                  <span
                    key={kind}
                    className="rounded border bg-muted/40 px-2 py-1 text-[11px] tabular-nums text-muted-foreground"
                  >
                    {label}
                    <span className="ml-1.5 font-medium text-foreground/80">
                      {audioStats.byKind.get(kind) ?? 0}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── 素材库 ── */}
          <div className="lg:col-span-2">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[12px] font-medium text-muted-foreground">
                素材库（一致性资产先行）
              </span>
            </div>
            <div className="grid gap-1.5">
              {mockReferenceAssets.map((asset) => {
                const used = usage.get(asset.assetId) ?? 0;
                return (
                  <div key={asset.assetId} className="rounded-lg border p-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn("text-[10px] font-medium", typeAccent[asset.type])}
                      >
                        {REFERENCE_TYPE_LABELS[asset.type]}
                      </span>
                      <span className="text-[12px] font-medium">{asset.name}</span>
                      <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                        本集引用 {used}
                      </span>
                    </div>
                    {asset.description ? (
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                        {asset.description}
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/40"
                          style={{
                            width: `${Math.min(100, ((asset.usageCount ?? 0) / 6) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground/70">
                        热度 {asset.usageCount ?? 0}
                      </span>
                    </div>
                  </div>
                );
              })}
              <p className="mt-1 flex items-start gap-1.5 text-[10px] leading-4 text-muted-foreground/70">
                <CircleAlert className="mt-0.5 size-3 shrink-0" />
                角色/场景资产先出三视图与参考图，再进镜头——没有一致性就没有"剧"。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
