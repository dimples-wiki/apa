# APA.md — 片项目手册（apa-film/0.3）

项目：雾岛来电（竖屏 AI 短剧 · 9:16 · 默认 seedance-1-0-pro/1080p）

## 给 coding agent 的协作规则
1. 本文件夹是一部片子：`film.json` 是主协议（声明式、可 diff），你可以直接读写它；`APA.md` 是本手册。
2. **改前重读 film.json，只改要改的**；保持 JSON 合法（解析失败会被 server 拒绝）。
3. **overrides.json 是人的覆写层**：`shadows` 是人在 UI 里最近改过的字段——改同一字段前先看它；`locks` 里的实体是**人锁定的，你一个字都不许改**（server 也会拒绝你）。
4. 时长纪律：每段 `duration` 必须属于所用模型的档位（Seedance 1.0 lite/pro = 5s/10s；2.5 至 15s）；台词字数 ÷ 4.1 ≈ 该段时长。
5. 先静后动：所有关键帧 status=picked 之前，不要把任何段推入生成。
6. 自检：`apa look`（时长/一致性/命名/覆写冲突报告）； `apa validate`（8 项不变式）。
7. 常用命令：`apa pipeline plan` → 人审 → `apa pipeline execute -s keyframes` → `apa pipeline finalize`。

## 结构
- project：全局（名称/画幅/默认模型档位）
- episodes[]：集（beats 节拍 → keyframes 关键帧 → segments 帧间演绎段）
- 关键帧 = 生图提示词（imagePrompt，一等公民）+ 参考资产（references，一致性）
- 演绎段 = 视频演绎提示词（videoPrompt）+ 模型档位 + 对白策略 + 候选池（variants，选优）
