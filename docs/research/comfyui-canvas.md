# 调研 B：ComfyUI 画布型生态与开源视频模型工作流（2026-10-17）

## 核心结论
1. **集成模型**："每镜头 = 一份 API 格式工作流模板 + 命名注入点（首帧/尾帧/提示词/seed/length）"。ComfyUI API：POST /prompt（返回 prompt_id）→ WS ws://host/ws?clientId（executing node=null 即完成；二进制帧可回传预览图）→ GET /history/{id} → GET /view 取产物；辅助 /upload/image、/queue、/interrupt、/object_info（节点参数 schema 可动态渲染配置表单）。封装先例：comfy_api_simplified、comfy-catapult、comfyui-api-wrapper（共同抽象=工作流模板+命名参数注入点）。
2. **画布型优劣**：节点图适合单镜头效果调优+管线搭建复用；不适合叙事管理（集-场-镜层级）、批量生产（队列+进度+版本）、审片协作。社区短剧管线全是"剧本→分镜图（一致性锁 here）→I2V/FLF2V 逐镜→剪辑"，剧级组织靠外部表格/剪映。混合项目 NodeTool（画布+sketch 时间线+脚本，agent-first，可接 ComfyUI 组件）方向成立但早期——**混合 studio 位置是空的**。
3. **APA 借鉴**：节点图思想内化为"镜头生成管线模板"（一致性引用/首尾帧来源/提示词/模型档位的可配置模板），用户面用表单/模板而非裸节点图；画布视图定位=管线可视化+高级编辑（导出 ComfyUI JSON 给专家）。剧级结构坚持时间线。
4. **首尾帧链式衔接=时间线自动数据流**：镜头 N 尾帧自动落盘为 N+1 首帧候选，UI 画"衔接锁"。坑：120 帧以上乒乓首尾帧过渡不平滑（Kijai wrapper issue #1342）。
5. **一致性在图像层**：三视图+多参考（StoryMaker 锁整体人物/GoLora/In-Context LoRA/Qwen-Edit 多参考趋势；PuLID 锁脸权重~0.8+风格锁+姿势控制三层叠加）。角色资产是数据模型，视频层只调 I2V/FLF2V。
6. **硬件档位**：Wan2.2 5B TI2V 8GB/480p；14B GGUF Q4 8-12GB（+Lightning LoRA 4步）；16-24GB=720p 单镜。HunyuanVideo 13B 需 28-45GB（性价比低）；HV1.5 8.3B ~14GB。LTX 速度快（4090 5s 数秒-1 分钟）。**瓶颈=单镜 3-10 分钟生成时长 → 队列管理（批量入队/进度推送/失败重试）是刚需**，ComfyUI /queue+WS 提供原语。

## 来源
docs.comfy.org（Wan2.2 教程/API examples/server routes/Fun InP）、zhuanlan.zhihu.com/p/2063707470401365950（六步管线：角色→服装→换装→三视图→分镜场景含首尾帧→多参考图生视频）、cnblogs.com/posstos（Qwen 写剧本拆分镜+ComfyUI 出图出视频，8GB 可跑）、arxiv 2409.12576（StoryMaker）、nodetool.ai、github kijai issue #1342、Clore 模型对比、wan27.org GGUF 指南
