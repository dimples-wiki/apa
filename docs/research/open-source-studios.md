# 调研 A：12 个开源影视/短视频工作台（2026-10-17）

## 关键发现
1. **模型编排层空白**：Wan2.2 生态无公认独立短剧工作台——"模型与工作台之间的工业化编排层"缺失，APA 定位（关键帧+模型档位驱动）无成熟开源占位者。
2. **"一键式"三种含义**：①素材拼接型（MPT/NarratoAI/ShortGPT/FunClip）一键=跳过创作；②工业化多 Phase 型（BigBanana/ai-shotlive/ViMax）一键=**计划预审通过后的批量执行**；③Agent 编排型（drama-skills/ViMax）一键=自然语言触发的多阶段循环+先预览后付费+断点续跑。
   → APA 一键定义："按当前已审计划批量执行下一付费环节"，必须带计划预审与断点续跑。
3. **UI 范式分工**：规划层=文档化可 diff 数据（drama-skills 六文档、Remotion 代码即源）；镜头制作层=**网格/表格式画布**（一镜一行批量审阅+九宫格候选，非自由拖拽）；交付层=时间线（Clapper 把时间线当前端是反面教材——生成过程失控）。节点画布属于模型调试层，不上浮创作层（最多作高级视图/导出 ComfyUI JSON）。
4. **Agent 第一公民判据**：能否无 UI 跑通全流程，且 AI 操作面是数据/文件而非按钮。达标者：drama-skills（产线即 skills）、Remotion（AGENTS.md/.claude/.agents/skills，"agent era"）、ViMax、Revideo（渲染目标明示 LLM 可写）。

## 值得吸收（逐项目）
- **Clapper**：实体+提示词与轨道分离；时间线是实体数据的投影
- **MoneyPrinterTurbo**：同一 pipeline 四入口同构（WebUI/API/CLI/AI Agent）+批量 JSONL+阶段截断 --stop-at+单任务失败不阻断；免费兜底+付费可选分层成本
- **ShortGPT**：面向 LLM 的剪辑中间表示（EML）——LLM 直接产出可渲染结构化产物
- **NarratoAI**：视觉 LLM 看片工程化（抽帧+缓存+并发）；供应商收敛 OpenAI 兼容
- **FunClip**：文本可寻址素材（LLM 输出片段索引即可执行）=AI 可执行+人可审核最小范本；CLI/API/UI 三面同构
- **Remotion**：代码/数据是 source of truth，UI 是视图；Composition 参数化模板；官方维护 agent skills
- **Revideo**：渲染目标设计为 LLM 可写；无头渲染服务（拼装环节）
- **DiffSynth**：模型能力（时长/分辨率/显存）作为约束数据进规划器（印证档位设计）
- **BigBanana AI Director**：五 Phase 状态机+先审计划再批量烧钱+九宫格 9 候选+提示词集中管理（版本回滚）+资产跨集沉淀；反面：无 CLI/API 闭源
- **ai-shotlive**：三级 schema（shots→shot_keyframes（首尾帧+提示词+图像）→shot_video_intervals（起止帧+时长））；generation_tasks/render_logs 异步任务表；ZIP 全量导入导出；chat/image/video/audio 四类 provider adapter
- **drama-skills**：**连续性锁**（造型写成常量短语 LOCK-JIANGCHEN-DRESS 跨文档引用+脚本核对）；文档即管线（人可读可 diff AI 可改）；4.1 字/秒估时定镜长；先预览后付费+audit/collect 防重复付费
- **ViMax**：同一管线不同起点（Idea2/Script2/Novel2Video）三入口；候选择优（视觉 LLM 择优可关）；session 恢复+上下文压缩

## 对 APA v3 的直接映射
见 docs/consensus-ai-native.md 第六节（v3）。
