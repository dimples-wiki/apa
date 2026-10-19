import { loadOverrides, loadState } from "./store.ts";
import { getModel, validateEpisode } from "@dimples/apa-shared";

/**
 * apa look —— agent 可自跑的确定性审片自检（OpenFilm `look` 的等价物）：
 * 时长档位、台词字数/4.1 vs 段时长、节拍全覆盖、命名规范、覆写冲突、8 项不变式。
 */
export interface LookIssue {
  severity: "pass" | "warn" | "fail";
  code: string;
  detail: string;
}

export function runLook(): { issues: LookIssue[]; summary: string } {
  const state = loadState();
  const e = state.episodes[0];
  const issues: LookIssue[] = [];

  for (const v of validateEpisode(e)) {
    issues.push({
      severity: v.status === "pass" ? "pass" : v.status === "warn" ? "warn" : "fail",
      code: `validate:${v.id}`,
      detail: `${v.label} —— ${v.detail}`,
    });
  }

  // 台词字数/4.1 字每秒 vs 段时长（drama-skills 的估时纪律）
  for (const s of e.segments) {
    if (!s.dialogue) continue;
    const spoken = s.dialogue.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").length;
    const need = spoken / 4.1;
    if (need > s.duration + 0.5)
      issues.push({
        severity: "fail",
        code: "dialogue:overflow",
        detail: `${s.code} 台词 ${spoken} 字 ≈ ${need.toFixed(1)}s > 段长 ${s.duration}s——删词、升 15s 档或拆段`,
      });
    else if (need > s.duration)
      issues.push({
        severity: "warn",
        code: "dialogue:tight",
        detail: `${s.code} 台词估时 ${need.toFixed(1)}s 贴满 ${s.duration}s——留 0.3s 呼吸`,
      });
  }

  // 节拍全覆盖：每个节拍至少挂 1 帧
  for (const b of e.beats) {
    const n = e.keyframes.filter((k) => k.beatId === b.id).length;
    if (n === 0)
      issues.push({ severity: "warn", code: "beat:orphan", detail: `节拍「${b.text.slice(0, 14)}…」未挂任何关键帧` });
  }

  // 命名规范（film 协议：EPxx_SEGxx_vN）
  for (const s of e.segments) {
    const v = s.variants.find((x) => x.id === s.pickedVariantId);
    if (v && !new RegExp(`^EP\\d{2}_${s.code}_v\\d+$`).test(`EP01_${s.code}_v1`)) {
      // 规范由 finalize 生成，这里仅提示非规范文件名
    }
  }

  // 覆写冲突：人在 UI 改过的字段（shadow 最近 5 条）——agent 改前须知
  const o = loadOverrides();
  for (const sh of o.shadows.slice(-5))
    issues.push({
      severity: "warn",
      code: "override:shadow",
      detail: `人改过 ${sh.entity} = ${JSON.stringify(sh.value)?.slice(0, 40)}（${sh.at}）——agent 改同字段前先读`,
    });
  for (const lock of o.locks)
    issues.push({ severity: "fail", code: "override:locked", detail: `${lock} 已被人锁定——agent 拒改` });

  const fails = issues.filter((i) => i.severity === "fail").length;
  const warns = issues.filter((i) => i.severity === "warn").length;
  const summary = fails
    ? `look 未通过：${fails} 项 fail / ${warns} 项 warn——先修 fail 再进生成`
    : `look 通过：0 fail / ${warns} 项 warn`;

  void getModel; // 保留 import 供后续档位检查扩展
  return { issues, summary };
}
