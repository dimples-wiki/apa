#!/usr/bin/env node
import { spawn } from "node:child_process";
import { Command } from "commander";
import { APP_VERSION } from "@dimples/apa-shared";
import { startServer } from "./server.ts";
import { loadState, mutate, scheduleCompletion, storePathOf } from "./store.ts";
import { enqueue, listJobs } from "./queue.ts";

const program = new Command();

program.name("apa").description("APA — AI Pipeline for Auteur").version(APP_VERSION);

function startServe(opts: { port: string; host: string; open: boolean }) {
  const port = Number.parseInt(opts.port, 10);
  const url = `http://${opts.host}:${port}`;
  startServer({ port, hostname: opts.host });
  console.log(`\n  APA 已启动 → ${url}`);
  console.log(`  MCP 端点   → ${url}/mcp（业务级工具 + UI 桥）`);
  console.log(`  store     → ${storePathOf()}\n`);
  if (opts.open) {
    const opener = process.platform === "darwin" ? "open" : "xdg-open";
    spawn(opener, [url], { detached: true, stdio: "ignore" }).unref();
  }
}

program
  .command("serve")
  .description("启动 APA Web 服务（含 /mcp 端点与 UI 桥）")
  .option("-p, --port <port>", "监听端口", "4310")
  .option("-H, --host <host>", "监听地址", "127.0.0.1")
  .option("--open", "启动后自动打开浏览器", false)
  .action(startServe);

/** 解析 episodeId：缺省取第一集；支持集号 */
function resolveEpisode(id?: string): string {
  const state = loadState();
  if (!id) return state.episodes[0].id;
  const e = state.episodes.find((x) => x.id === id || String(x.number) === id);
  if (!e) throw new Error(`episode ${id} 不存在`);
  return e.id;
}

function run(op: string, args: Record<string, unknown>, opts?: { compact?: boolean }) {
  const { result } = mutate(op, args);
  const out = result ?? { ok: true };
  console.log(JSON.stringify(out, null, opts?.compact ? 0 : 2));
}

function asyncOp(op: string, args: Record<string, unknown>) {
  mutate(op, args);
  scheduleCompletion(op, args);
  console.log(JSON.stringify({ ok: true, note: `已提交（delayMs=${args.delayMs ?? 0}）` }, null, 2));
}

const stateCmd = program.command("state").description("读取工作台状态（与 MCP get_state 同一函数）");
stateCmd
  .command("dump")
  .description("打印状态摘要（episodeId 缺省取第一集）")
  .argument("[episodeId]")
  .option("--full", "输出完整 state", false)
  .action((episodeId: string | undefined, opts: { full: boolean }) => {
    const state = loadState();
    const id = resolveEpisode(episodeId);
    const e = state.episodes.find((x) => x.id === id)!;
    if (opts.full) {
      console.log(JSON.stringify(e, null, 2));
      return;
    }
    console.log(
      JSON.stringify(
        {
          project: state.project,
          episode: { id: e.id, number: e.number, title: e.title, store: storePathOf() },
          keyframes: e.keyframes.map((k) => ({
            id: k.id,
            code: k.code,
            status: k.status,
            candidates: k.variants.length,
            picked: k.pickedVariantId ?? null,
          })),
          segments: e.segments.map((s) => ({
            id: s.id,
            code: s.code,
            status: s.status,
            stale: s.promptStale ?? false,
            duration: s.duration,
            billed: s.billedAttempts,
            failed: s.failedAttempts,
          })),
        },
        null,
        2,
      ),
    );
  });

program
  .command("validate")
  .description("管线不变式校验报告")
  .argument("[episodeId]")
  .action((episodeId) => run("studio.validate", { episodeId: resolveEpisode(episodeId) }));

program
  .command("op")
  .description("执行任意管线 op（逃生舱：与 MCP call_op / 页面按钮同构）")
  .argument("<name>")
  .option("-a, --args <json>", "参数 JSON", "{}")
  .option("--compact", "单行输出", false)
  .action((name: string, opts: { args: string; compact: boolean }) => {
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(opts.args);
    } catch {
      throw new Error(`--args 不是合法 JSON：${opts.args}`);
    }
    run(name, args, { compact: opts.compact });
  });

const kf = program.command("keyframe").description("关键帧操作");
kf.command("generate")
  .argument("<kfId>")
  .option("-d, --delay <ms>", "异步完成延迟（毫秒，模拟生成耗时）", "0")
  .action((kfId: string, o: { delay: string }) =>
    asyncOp("keyframe.generate", { kfId, delayMs: Number(o.delay) }),
  );
kf.command("pick")
  .argument("<kfId>")
  .argument("<variantId>")
  .action((kfId, variantId) => run("keyframe.pick", { kfId, variantId }));
kf.command("reject")
  .argument("<kfId>")
  .argument("<variantId>")
  .argument("<reason>", "失败归因")
  .action((kfId, variantId, reason) => run("keyframe.reject", { kfId, variantId, reason }));
kf.command("insert")
  .argument("<afterKfId>")
  .option("-n, --count <n>", "插入帧数", "1")
  .action((afterKfId: string, o: { count: string }) =>
    run("keyframe.insert", { afterKfId, n: Number(o.count) }),
  );

const seg = program.command("segment").description("演绎段操作");
seg.command("generate")
  .argument("<segId>")
  .option("-d, --delay <ms>", "异步完成延迟（毫秒）", "0")
  .action((segId: string, o: { delay: string }) =>
    asyncOp("segment.generate", { segId, delayMs: Number(o.delay) }),
  );
seg.command("attribute")
  .argument("<segId>")
  .argument("<mode>", "失败归因（如：内容审核拒绝）")
  .action((segId, mode) => run("segment.attribute", { segId, mode }));

const batch = program.command("batch").description("批量执行（闸门内建）");
batch
  .command("keyframes")
  .argument("[episodeId]")
  .action((episodeId) => run("batch.generateKeyframes", { episodeId: resolveEpisode(episodeId), sync: true }));
batch
  .command("videos")
  .argument("[episodeId]")
  .action((episodeId) => run("batch.generateSegments", { episodeId: resolveEpisode(episodeId), sync: true }));
batch
  .command("retry")
  .argument("[episodeId]")
  .action((episodeId) => run("batch.retryFailed", { episodeId: resolveEpisode(episodeId), sync: true }));

const jobsCmd = program.command("jobs").description("生成队列（provider 任务与断点查询）");
jobsCmd
  .command("list")
  .option("-s, --status <status>", "queued | running | done | failed")
  .action((o: { status?: string }) => {
    console.log(JSON.stringify(listJobs(o.status as never), null, 2));
  });
jobsCmd
  .command("submit")
  .description("提交一段到 provider 队列（默认走首个已配置 provider；无 key 回落 mock）")
  .argument("<segId>")
  .option("-p, --provider <id>", "seedance | comfyui | mock")
  .action((segId: string, o: { provider?: string }) => {
    const state = loadState();
    for (const e of state.episodes) {
      const s = e.segments.find((x) => x.id === segId || x.code === segId);
      if (!s) continue;
      const targetId = s.id;
      const kf = e.keyframes.find((k) => k.id === s.fromKeyframeId);
      enqueue({
        kind: "segment",
        targetId,
        providerId: o.provider,
        injection: {
          firstFrame: kf?.pickedVariantId ? `variant:${kf.pickedVariantId}` : undefined,
          prompt: s.videoPrompt,
          seed: s.variants.find((v) => v.id === s.pickedVariantId)?.seed,
          length: s.duration,
          resolution: s.resolution,
          modelId: s.modelId,
        },
      }).then((job) => console.log(JSON.stringify(job, null, 2)));
      return;
    }
    throw new Error(`segment ${segId} 不存在`);
  });

const pipeline = program.command("pipeline").description("一键管线（计划预审 → 批量执行 → 粗剪清单）");
pipeline
  .command("plan")
  .argument("[episodeId]")
  .action((episodeId) => run("pipeline.plan", { episodeId: resolveEpisode(episodeId) }));
pipeline
  .command("execute")
  .argument("[episodeId]")
  .option("-s, --stage <stage>", "keyframes | videos", "keyframes")
  .action((episodeId: string | undefined, o: { stage: string }) =>
    run("pipeline.execute", { episodeId: resolveEpisode(episodeId), stage: o.stage, sync: true }),
  );
pipeline
  .command("finalize")
  .argument("[episodeId]")
  .action((episodeId) => run("pipeline.finalize", { episodeId: resolveEpisode(episodeId) }));

// 无子命令时默认启动服务
program.action(() => startServe({ port: "4310", host: "127.0.0.1", open: false }));

program.parse();
