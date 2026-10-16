# 共识文档：工作台 AI-native 重构（深度模式四问驱动 · v2 修订版）

> 2026-10-17。依据系统级 skill `~/.agents/skills/ai-drama-director/SKILL.md`：复杂任务进入更深度的版本，而不是把摊子铺得更大。本文档是重构需求的唯一入口，四问回答先于实现。
> v2：吸收制片顾问 agent 挑战的 10 条意见（4×P0、5×P1、1×P2），修正地基事实与验收门槛。

## 一、深度模式四问

### 问 1：顶尖大牛会做哪些我们根本没提到的动作？

以真实从业者为准（国内首部爆款付费 AI 短剧《兴安岭诡事》团队；AI 视频头部创作者 PJ Accetturo）：

1. **竖屏 9:16 是短剧的默认画幅**。现有工作台是 16:9 电影思维——错位。短剧在手机竖屏播放：单集 1–2 分钟、全剧 60–100 集、前 3 秒必须出钩子。画幅与平台规格是项目第一决定。
2. **先定一致性资产，再谈镜头**：角色三视图+服装+场景+道具参考图先入库（带权重），每个镜头生图挂参考。工作台需要资产库（人物/场景/服装/道具分型），不是花名册。
3. **两阶段验收（先静后动）**：全片关键帧静帧定稿后才烧钱图生视频。批量静帧生成→批量审片→批量重试是主工作流，不是逐镜点击。
4. **候选池与选优率是核心工作对象**：PJ Ace 公开数据 300–400 次生成出 15 个可用镜头（≈20–27:1，单人 2–3 天，总成本约 $2,000）。每个镜头是候选胶片条，不是单一产物。
5. **shot list 表格是真正的工作文件**（Runway AI Shot List 方法论）：每镜一行，提示词直接转生成任务。**工作台默认主视图=shot list 表**，时间线只是拼装预览。
6. **对白参与时长与生成策略决策**：台词字数→TTS 时长→决定段数与档位；对白生成策略按模型能力分派（音画同生含口型 / 无声段+后期 TTS / 无声）。
7. **失败模式分类库**：肢体崩坏/手指/文字乱码/角色漂移/镜头漂移/风格漂移/口型不同步，各有针对性动作（改负向词/换参考图/重写提示词/换模型档），淘汰时强制选原因——这是报表数据源。

### 问 2：从哪种最原始的底层材料入手？

1. **模型 API 参数表与价格表（按版本取值，注明来源日期）**：
   - Seedance 1.0 lite：5s/10s 两档，480p/720p；
   - Seedance 1.0 pro：480p/720p/1080p、24fps，官方页面标注时长 2–12s（不同接入层取值有差异，以接入时 API 文档为准）；
   - Seedance 2.x（2026-10 现役）：最长 15s、分辨率至 4K、**原生音画联合生成**（参考音频输入，单段 [2,15]s、最多 3 段）；
   - 火山方舟按 token 后付费：1.0 pro ¥15/百万 tokens（活动 ¥7.5）、pro-fast ¥4.2，仅成功生成计费、审核失败不收费，5s/1080p≈¥3.67/条。
2. **真实短剧剧本与分镜脚本原文**（场号/景别/机位/台词/预估秒数）。
3. **从业者一手复盘**：《兴安岭诡事》公开可查事实——2025-02-19 上线、11 集（前 5 免费后 6 付费、9.9 元解锁）、抖音端播放超 5800 万；镜头由即梦/可灵/Runway 生成，人负责编剧/分镜/剪辑（"60 万成本/5 人"未见一手出处，不作基线）。
4. **平台与合规规范原文**：AI 生成内容标识办法（2025-09-01 施行，显式+隐式双标识，强制国标 GB 45438-2025）；微短剧按成本三级管理（≥100 万发行许可证 / 60–100 万平台备案 / <60 万平台管理）；付费短剧须过备案与标识关。
5. **真实生成日志**：prompt→产物对照与失败样本库。

### 问 3：具体用什么分析方法和专业工具？

1. 结构化提示词模板（主体+动作+镜头语言整句+光线+风格+负向词）；固定 seed 批量对比；5 条一批 fast 档试错再上高质量档。
2. Shot list 数字化：一行=一个生成任务，行内生成/选优/成本/失败归因，支持全选批量操作。
3. LLM 节拍拆解：剧本→Beat（节拍，挂场号）→关键帧规划；**档位吸附**逻辑——台词/TTS 时长决定段数与关键帧密度，每段时长必须 ∈ durations 集合，超出即拆段（而不是反过来"按台词反推档位"）。
4. 成本核算：billedAttempts（成功计费）与 failedAttempts（审核失败不计费）分开；价格=token 单价×tokens(分辨率,时长) 或价目矩阵。
5. 一致性验证：参考资产锁定 + 人脸 embedding 相似度阈值 + 人审双门槛。
6. 节奏检验：前 3 秒钩子位标注、每 15–30 秒反转卡点表。

### 问 4：什么外部工具或客观指标能铁证如山？

**可判定验收清单**（全部量化）：
- 成片：9:16、60–90s、含**口型正确的对白**（音画同生或 TTS+对口型）+ BGM + 字幕 + 每集显式 AI 标识，抖音上传过审；
- 生成效率：每镜平均生成次数 ≤15（对标 PJ Ace 20–27:1）；
- 成本：每集 API 成本上限 = 5s/1080p≈¥3.67 × 段数 × 预期重试倍数（写入验收）；
- 一致性：人脸 embedding 相似度阈值 + 人审；
- 拆解盲测：LLM 拆解 vs 人工，节拍一致率 / 关键帧数量偏差 ≤±20%；
- 盲评维度：管线符合度 + 成片可用性占权重，UI 精致度降为单项。

## 二、需求重构（数据模型 AI-native 化）

```ts
// 视频生成模型规格（官方 API 版本化取值，数据驱动）
interface VideoModelSpec {
  id: string;                     // "seedance-1.0-lite" | "seedance-1.0-pro" | "seedance-2.x"
  label: string;
  durations: number[];            // lite=[5,10]；pro 按接入文档；2.x 至 [15]
  resolutions: string[];          // ["480p","720p","1080p","4K"?]
  aspectRatios: string[];         // ["9:16","16:9","1:1"]
  modes: ("t2v" | "i2v" | "first-last-frame")[];
  audio: {                        // 音频能力（2.x 原生音画）
    nativeAudioGen: boolean;      // 音画同生（含口型）
    audioInput: boolean;          // 参考音频输入
    refAudioMaxSegments?: number; // 最多 3 段
    audioDurationRange?: [number, number];
  };
  pricing: {                      // 成本铁证的计费模型
    kind: "token" | "matrix";
    tokenPricePerMillion?: number;       // 如 ¥15
    tokensPerClip?: (res: string, dur: number) => number;
    matrix?: Record<string, Record<string, number>>; // price[res][duration]
    billedOn: "success-only" | "always";  // 方舟仅成功计费
  };
}

// 节拍：剧本→关键帧的传导枢纽
interface Beat {
  id: string;
  scriptSceneRef: string;         // 挂剧本场号
  text: string;                   // 节拍内容（钩子/推进/转折/结尾钩子…）
  keyframeIds: string[];
}

// 一致性参考资产（带类型与权重）
interface ReferenceAsset {
  assetId: string;                // 角色/场景/服装/道具库
  type: "character" | "scene" | "outfit" | "prop" | "style";
  weight?: number;
}

// 关键帧 = 生图提示词的产物锚点（先静后动的第一阶段对象）
interface Keyframe {
  id: string;
  beatId?: string;                // 挂节拍
  imagePrompt: string;            // 一等公民
  negativePrompt?: string;
  references: ReferenceAsset[];
  imageUrl?: string;              // 当前采纳帧
  variants: ImageVariant[];       // 候选池
  pickedVariantId?: string;
}

// 候选变体（可复现、可归因）
interface VariantMeta {
  seed?: string;
  modelVersion: string;
  requestParams: Record<string, unknown>; // 分辨率/fps/duration/camerafixed 快照
  promptSnapshot: string;
  cost?: number;                  // 该次实际成本
  createdAt: string;
  rejectedReason?: FailureMode;   // 淘汰时强制选择
}

// 失败模式分类（挂淘汰原因，驱动建议动作与报表）
type FailureMode =
  | "肢体崩坏" | "手指异常" | "文字乱码" | "角色漂移"
  | "镜头漂移" | "风格漂移" | "口型不同步" | "内容审核拒绝" | "其他";

// 帧间演绎段 = 一次图生视频调用（第二阶段对象）
interface Segment {
  id: string;
  fromKeyframeId: string;
  fromVariantId?: string;         // 首帧用的是哪个候选——上游 re-pick 时传播失效
  toKeyframeId?: string;          // 首尾帧模式；首帧模式可空
  videoPrompt: string;            // 演绎什么剧情（一等公民）
  promptStale?: boolean;          // 插帧/改剧本后待重写标记
  modelId: string;
  duration: number;               // 必须 ∈ modelSpec.durations
  dialogue?: string;
  dialogueStrategy?: "native" | "tts-post" | "mute"; // 音画同生/后期TTS/无声
  billedAttempts: number;         // 成功计费次数
  failedAttempts: number;         // 审核失败（不计费）次数
  variants: VideoVariant[];
  pickedVariantId?: string;
  status: "draft" | "planned" | "generating" | "ready" | "failed" | "stale";
}

// 集 = 从剧本拆解的规划单元
interface Episode {
  id: string;
  number: number;
  title: string;
  dramaticGoal: string;           // 本集戏剧目标
  synopsis: string;
  aspectRatio: "9:16" | "16:9";   // 项目级默认，集可覆盖
  targetDurationSec?: number;     // 短剧 60–120s
  hookAtSec?: number;             // 前 3 秒钩子位标注（规划视图强制）
  filingNo?: string;              // 备案号（合规）
  beats: Beat[];
  keyframes: Keyframe[];          // 链式：keyframes.length = segments.length + 1
  segments: Segment[];
}
```

关键交互定义：
- **插入关键帧**：在第 i/i+1 帧之间插入 N 个（N 可选），原段时长按档位重切分为 N+1 段，**原段 videoPrompt 置为待重写态**（不静默保留）；
- **失效传播**：关键帧 re-pick 候选或插入帧时，下游段自动置 `stale` 并锁定批量生成；
- **拆集**：剧本→LLM 规划集列表（含戏剧目标/钩子位），人可改；
- **两阶段闸门**：本集关键帧全部 picked 之前，视频批量生成禁用；
- **重试语义**："重新生成"默认继承 seed+参数做对照；"换镜重写"才开新参数，且必须选 FailureMode。

## 三、UI 重构方向

1. **主工作视图 = shot list 表**（一行=一个关键帧/演绎段，行内生成/选优/成本/失败归因/批量操作）；时间线降级为拼装预览视图；
2. 项目创建即定画幅（9:16 短剧默认），监视器按画幅渲染；
3. 关键帧卡 = 生图提示词 + 参考资产（类型+权重）+ 候选胶片条；段卡 = 视频提示词 + 模型档位 + 对白策略 + 候选池；
4. **键盘选优流**：j=淘汰（强制选原因）/ k=采纳，支撑一天数百条的评审吞吐；
5. 每集成本条（billed/failed 分列）与选优率常驻；
6. 规划视图：剧本拆集 → 节拍 → 每集关键帧规划（数量可调、钩子位标注）→ 进入两阶段生产；
7. 合规位：每集 AI 标识开关与备案号字段。

## 四、验收铁证（可判定清单）

见问 4——成片六要素（9:16/60–90s/口型对白/BGM/字幕/AI 标识 + 抖音过审）、每镜 ≤15 次、每集成本上限公式、一致性双门槛、拆解盲测 ≤±20%、盲评含管线维度。

## 五、实现批次

1. **批 1 数据模型**：shared 重写（VideoModelSpec/Beat/ReferenceAsset/Keyframe/Variant/FailureMode/Segment/Episode），mock 换竖屏短剧真实结构示例（含候选池、失败归因、成本数据）；
2. **批 2 管线 UI**：shot list 主视图 + 规划视图（拆集/节拍/关键帧规划）+ 候选池选优（j/k）+ 批量生成/重试 + 拼装预览时间线（块=Segment、插入 N 帧、stale 传播）+ 9:16 监视器 + 成本条；
3. **批 3 铁证**：Seedance API 接入（server 代理，billed/failed 分账）+ 成本/选优率看板 + 盲评维度更新 + 1 集端到端成片。
