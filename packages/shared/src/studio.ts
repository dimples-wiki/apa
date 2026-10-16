/**
 * APA 工作台数据模型（AI-native）
 *
 * 第一性流程：剧本 → 拆集 → 每集规划关键帧（先静后动）→ 帧间演绎段（图生视频，时长=模型档位）→ 成片。
 * 设计守则见 docs/consensus-ai-native.md；提示词是一等公民，时长必须贴合模型档位。
 */

/* ───────────────────────── 视频生成模型规格 ───────────────────────── */

export interface ModelAudio {
  /** 原生音画联合生成（含口型） */
  nativeAudioGen: boolean;
  /** 支持参考音频输入 */
  audioInput: boolean;
  refAudioMaxSegments?: number;
  audioDurationRange?: [number, number];
}

export interface ModelPricing {
  kind: "token" | "matrix";
  /** 每百万 tokens 单价（元） */
  tokenPricePerMillion?: number;
  /** 各分辨率每秒 token 数（token 计费近似公式） */
  tokensPerSecond?: Record<string, number>;
  /** 计费规则：方舟仅成功生成计费 */
  billedOn: "success-only" | "always";
  note?: string;
}

export interface VideoModelSpec {
  id: string;
  label: string;
  vendor: string;
  /** 支持的时长档位（秒）——段的 duration 必须 ∈ 此集合 */
  durations: number[];
  resolutions: string[];
  aspectRatios: string[];
  modes: ("t2v" | "i2v" | "first-last-frame")[];
  audio: ModelAudio;
  pricing: ModelPricing;
}

/** 一手参数表（2026-10 取自火山方舟文档）：lite=5s/10s 两档；2.x 原生音画、至 4K */
export const VIDEO_MODELS: VideoModelSpec[] = [
  {
    id: "seedance-1-0-lite",
    label: "Seedance 1.0 Lite",
    vendor: "火山方舟",
    durations: [5, 10],
    resolutions: ["480p", "720p"],
    aspectRatios: ["9:16", "16:9", "1:1"],
    modes: ["t2v", "i2v"],
    audio: { nativeAudioGen: false, audioInput: false },
    pricing: {
      kind: "token",
      tokenPricePerMillion: 4.2,
      tokensPerSecond: { "480p": 10000, "720p": 22000 },
      billedOn: "success-only",
      note: "仅成功生成计费",
    },
  },
  {
    id: "seedance-1-0-pro",
    label: "Seedance 1.0 Pro",
    vendor: "火山方舟",
    durations: [5, 10],
    resolutions: ["480p", "720p", "1080p"],
    aspectRatios: ["9:16", "16:9", "1:1"],
    modes: ["t2v", "i2v", "first-last-frame"],
    audio: { nativeAudioGen: false, audioInput: false },
    pricing: {
      kind: "token",
      tokenPricePerMillion: 15,
      tokensPerSecond: { "480p": 10000, "720p": 22000, "1080p": 49000 },
      billedOn: "success-only",
      note: "5s/1080p ≈ ¥3.67，仅成功生成计费",
    },
  },
  {
    id: "seedance-2-5",
    label: "Seedance 2.5",
    vendor: "火山方舟",
    durations: [5, 10, 15],
    resolutions: ["720p", "1080p", "4K"],
    aspectRatios: ["9:16", "16:9", "1:1"],
    modes: ["t2v", "i2v", "first-last-frame"],
    audio: { nativeAudioGen: true, audioInput: true, refAudioMaxSegments: 3, audioDurationRange: [2, 15] },
    pricing: {
      kind: "token",
      tokenPricePerMillion: 15,
      tokensPerSecond: { "720p": 22000, "1080p": 49000, "4K": 190000 },
      billedOn: "success-only",
    },
  },
];

export function getModel(id: string): VideoModelSpec {
  return VIDEO_MODELS.find((m) => m.id === id) ?? VIDEO_MODELS[0];
}

/** 单次生成成本估算（token 计费公式，用于档位选择与成本上限倒推） */
export function estimateClipCost(modelId: string, resolution: string, duration: number): number {
  const m = getModel(modelId);
  const perSec = m.pricing.tokensPerSecond?.[resolution] ?? 22000;
  const price = m.pricing.tokenPricePerMillion ?? 0;
  return Math.round(((perSec * duration) / 1_000_000) * price * 100) / 100;
}

/* ───────────────────────── 失败模式（淘汰强制归因） ───────────────────────── */

export const FAILURE_MODES = [
  "肢体崩坏",
  "手指异常",
  "文字乱码",
  "角色漂移",
  "镜头漂移",
  "风格漂移",
  "口型不同步",
  "内容审核拒绝",
  "其他",
] as const;
export type FailureMode = (typeof FAILURE_MODES)[number];

/** 每种失败模式的建议动作（重试面板展示） */
export const FAILURE_MODE_ACTIONS: Record<FailureMode, string> = {
  肢体崩坏: "降低动作幅度，负向词强调肢体完整",
  手指异常: "避免手部特写，或改用道具遮挡",
  文字乱码: "画面内不放文字，文字后期叠加",
  角色漂移: "补挂角色参考图并提高权重，或重选参考帧",
  镜头漂移: "运镜整句描述放句首，或固定镜头",
  风格漂移: "挂风格参考图，统一风格关键词",
  口型不同步: "改用音画同生模型，或后期对口型",
  内容审核拒绝: "修改敏感描述后重写提示词",
  其他: "重写提示词或更换模型档位",
};

/* ───────────────────────── 一致性参考资产 ───────────────────────── */

export type ReferenceType = "character" | "scene" | "outfit" | "prop" | "style";

export const REFERENCE_TYPE_LABELS: Record<ReferenceType, string> = {
  character: "角色",
  scene: "场景",
  outfit: "服装",
  prop: "道具",
  style: "风格",
};

export interface ReferenceAsset {
  assetId: string;
  name: string;
  type: ReferenceType;
  weight?: number;
}

/* ───────────────────────── 候选变体（可复现、可归因） ───────────────────────── */

export interface VariantMeta {
  seed?: string;
  modelVersion: string;
  /** 请求参数快照（分辨率/时长/运镜固定等） */
  requestParams: Record<string, string | number | boolean>;
  promptSnapshot: string;
  /** 该次实际成本（元），仅成功计费次有值 */
  cost?: number;
  createdAt: string;
}

export interface ImageVariant extends VariantMeta {
  id: string;
  imageUrl?: string;
  rejectedReason?: FailureMode;
}

export interface VideoVariant extends VariantMeta {
  id: string;
  videoUrl?: string;
  rejectedReason?: FailureMode;
}

/* ───────────────────────── 关键帧（先静后动的第一阶段对象） ───────────────────────── */

/** 关键帧阶段状态：两阶段闸门——全部 picked 前禁批量视频生成 */
export type KeyframeStatus = "draft" | "generating" | "review" | "picked";

export const KEYFRAME_STATUS_LABELS: Record<KeyframeStatus, string> = {
  draft: "待生成",
  generating: "生成中",
  review: "待选优",
  picked: "已定稿",
};

export interface Keyframe {
  id: string;
  /** 展示编号（KF-01） */
  code: string;
  /** 挂节拍（剧本传导） */
  beatId?: string;
  /** 生图提示词（一等公民） */
  imagePrompt: string;
  negativePrompt?: string;
  references: ReferenceAsset[];
  /** 当前采纳帧 */
  imageUrl?: string;
  variants: ImageVariant[];
  pickedVariantId?: string;
  status: KeyframeStatus;
}

/* ───────────────────────── 帧间演绎段（第二阶段对象） ───────────────────────── */

export type SegmentStatus = "draft" | "planned" | "generating" | "ready" | "failed" | "stale";

export const SEGMENT_STATUS_LABELS: Record<SegmentStatus, string> = {
  draft: "草稿",
  planned: "已规划",
  generating: "生成中",
  ready: "成片就绪",
  failed: "生成失败",
  stale: "待重制",
};

/** 对白生成策略：音画同生（含口型）/ 无声段+后期 TTS / 无声 */
export type DialogueStrategy = "native" | "tts-post" | "mute";

export const DIALOGUE_STRATEGY_LABELS: Record<DialogueStrategy, string> = {
  native: "音画同生",
  "tts-post": "后期配音",
  mute: "无声",
};

export interface Segment {
  id: string;
  code: string;
  /** 起点关键帧 */
  fromKeyframeId: string;
  /** 首帧使用的候选（上游 re-pick 时传播失效） */
  fromVariantId?: string;
  /** 终点关键帧（首尾帧模式；首帧模式可空） */
  toKeyframeId?: string;
  /** 演绎什么剧情（一等公民，直接给图生视频模型） */
  videoPrompt: string;
  /** 插帧/改剧本后待重写标记 */
  promptStale?: boolean;
  modelId: string;
  resolution: string;
  /** 必须 ∈ getModel(modelId).durations */
  duration: number;
  dialogue?: string;
  dialogueStrategy?: DialogueStrategy;
  /** 成功计费次数 */
  billedAttempts: number;
  /** 审核失败次数（不计费） */
  failedAttempts: number;
  /** 失败归因（failed 段必须归因后才允许重试） */
  attributedFailure?: FailureMode;
  /** 累计成本（元） */
  cost?: number;
  variants: VideoVariant[];
  pickedVariantId?: string;
  status: SegmentStatus;
}

/* ───────────────────────── 节拍（剧本 → 关键帧的传导枢纽） ───────────────────────── */

export type BeatKind = "hook" | "development" | "turn" | "ending";

export const BEAT_KIND_LABELS: Record<BeatKind, string> = {
  hook: "钩子",
  development: "推进",
  turn: "转折",
  ending: "结尾钩子",
};

export interface Beat {
  id: string;
  kind: BeatKind;
  /** 挂剧本场号 */
  scriptSceneRef?: string;
  text: string;
  /** 规划挂载的关键帧 */
  keyframeIds: string[];
}

/* ───────────────────────── 集 ───────────────────────── */

export type AspectRatio = "9:16" | "16:9";

export interface Episode {
  id: string;
  number: number;
  title: string;
  /** 本集戏剧目标 */
  dramaticGoal: string;
  logline: string;
  synopsis: string;
  aspectRatio: AspectRatio;
  /** 短剧单集目标 60–120s */
  targetDurationSec?: number;
  /** 前 3 秒钩子位标注 */
  hookAtSec?: number;
  /** 备案号（合规） */
  filingNo?: string;
  beats: Beat[];
  /** 链式：keyframes.length = segments.length + 1 */
  keyframes: Keyframe[];
  segments: Segment[];
}

/* ───────────────────────── 聚合计算 ───────────────────────── */

/** 集时长 = Σ 段时长（段是时间线的原子） */
export function episodeDuration(ep: Episode): number {
  return ep.segments.reduce((acc, s) => acc + s.duration, 0);
}

/** 集累计成本 = Σ 段成本 */
export function episodeCost(ep: Episode): number {
  return ep.segments.reduce((acc, s) => acc + (s.cost ?? 0), 0);
}

/** 选优率：采纳候选 / 总候选（含已淘汰） */
export function selectionRate(ep: Episode): { picked: number; total: number; ratio: number } {
  let picked = 0;
  let total = 0;
  for (const kf of ep.keyframes) {
    total += kf.variants.length;
    if (kf.pickedVariantId) picked += 1;
  }
  for (const seg of ep.segments) {
    total += seg.variants.length;
    if (seg.pickedVariantId) picked += 1;
  }
  return { picked, total, ratio: total === 0 ? 0 : picked / total };
}

/** 两阶段闸门：全部关键帧定稿后才能批量生成视频 */
export function allKeyframesPicked(ep: Episode): boolean {
  return ep.keyframes.length > 0 && ep.keyframes.every((k) => k.status === "picked");
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatMoney(yuan: number): string {
  return `¥${yuan.toFixed(2)}`;
}

/* ───────────────────────── 演示数据：竖屏 AI 短剧《雾岛来电》 ───────────────────────── */

/** 生图候选占位（演示数据用渐变块代替真实图） */
const now = "2026-10-17T02:00:00.000Z";

function imgVariant(
  id: string,
  seed: string,
  rejectedReason?: FailureMode,
): ImageVariant {
  return {
    id,
    seed,
    modelVersion: "seedream-4.0",
    requestParams: { resolution: "2K", styleRef: "fog-island-anchor" },
    promptSnapshot: "",
    cost: rejectedReason ? undefined : 0.2,
    createdAt: now,
    rejectedReason,
  };
}

export const mockEpisodes: Episode[] = [
  {
    id: "ep-001",
    number: 1,
    title: "凌晨三点的来电",
    dramaticGoal: "用一通不可能存在的电话，把观众钉在前 3 秒",
    logline: "守岛接线员林晚在凌晨三点接到已故姐姐的号码，电话那头只说了一句：快离开岛。",
    synopsis:
      "台风夜，守岛气象站的接线员林晚值最后一班岗。凌晨三点，座机响起——来电显示是三年前坠海的姐姐。电话那头的海浪声里，姐姐只说：快离开岛。林晚挂断，铃声再次响起，这次来电人写着她自己的名字。",
    aspectRatio: "9:16",
    targetDurationSec: 75,
    hookAtSec: 3,
    filingNo: "微短剧备字〔2026〕第 0871 号",
    beats: [
      {
        id: "beat-001",
        kind: "hook",
        scriptSceneRef: "S01",
        text: "凌晨三点，已故姐姐的号码在座机上亮起，海浪声从听筒里涌出。",
        keyframeIds: ["kf-001"],
      },
      {
        id: "beat-002",
        kind: "development",
        scriptSceneRef: "S01",
        text: "林晚接起电话，听筒里只有一句：快离开岛。风声骤然变大。",
        keyframeIds: ["kf-002", "kf-003"],
      },
      {
        id: "beat-003",
        kind: "turn",
        scriptSceneRef: "S02",
        text: "她翻出三年前的通话记录，同一个号码，坠海当晚 23:47 也来过一通。",
        keyframeIds: ["kf-004"],
      },
      {
        id: "beat-004",
        kind: "ending",
        scriptSceneRef: "S02",
        text: "她挂断电话。座机第三次响起，来电人：林晚（本机）。",
        keyframeIds: ["kf-005", "kf-006"],
      },
    ],
    keyframes: [
      {
        id: "kf-001",
        code: "KF-01",
        beatId: "beat-001",
        imagePrompt:
          "竖屏特写：台风夜的老式座机在黑暗气象站值班室里亮起来电屏，屏幕特写显示『姐姐』两个字与凌晨 03:00，暖黄台灯光只照亮话机一角，胶片颗粒，冷蓝背景",
        negativePrompt: "文字乱码，多余手指，现代智能手机",
        references: [
          { assetId: "ch-linwan", name: "林晚", type: "character", weight: 0.8 },
          { assetId: "sc-station", name: "气象站值班室", type: "scene", weight: 0.6 },
          { assetId: "pr-phone", name: "老式座机", type: "prop", weight: 0.5 },
          { assetId: "sty-fogisland", name: "雾岛冷调", type: "style", weight: 0.4 },
        ],
        variants: [
          imgVariant("iv-001a", "s-1101"),
          imgVariant("iv-001b", "s-1102", "文字乱码"),
          imgVariant("iv-001c", "s-1103"),
        ],
        pickedVariantId: "iv-001a",
        imageUrl: undefined,
        status: "picked",
      },
      {
        id: "kf-002",
        code: "KF-02",
        beatId: "beat-002",
        imagePrompt:
          "竖屏近景：年轻女接线员握着听筒侧脸，耳机后海浪声可视化成淡蓝色波纹扩散，冷调侧光，瞳孔里映着仪器微光，胶片颗粒",
        negativePrompt: "手指异常，表情夸张",
        references: [
          { assetId: "ch-linwan", name: "林晚", type: "character", weight: 0.9 },
          { assetId: "sty-fogisland", name: "雾岛冷调", type: "style", weight: 0.4 },
        ],
        variants: [imgVariant("iv-002a", "s-1201"), imgVariant("iv-002b", "s-1202"), imgVariant("iv-002c", "s-1203", "角色漂移")],
        pickedVariantId: undefined,
        status: "review",
      },
      {
        id: "kf-003",
        code: "KF-03",
        beatId: "beat-002",
        imagePrompt:
          "竖屏大远景：台风夜的气象站孤岛全貌，探照灯束刺进雨幕，海面泛起不自然的青绿色磷光，闪电定格瞬间",
        references: [
          { assetId: "sc-island", name: "雾岛全貌", type: "scene", weight: 0.8 },
          { assetId: "sty-fogisland", name: "雾岛冷调", type: "style", weight: 0.5 },
        ],
        variants: [],
        status: "generating",
      },
      {
        id: "kf-004",
        code: "KF-04",
        beatId: "beat-003",
        imagePrompt:
          "竖屏俯拍：泛黄的通话记录单摊在桌面，红笔圈出 23:47，旁边是姐姐的旧照片，台灯暖光与窗外冷蓝雨夜对比",
        negativePrompt: "文字乱码",
        references: [
          { assetId: "ch-linwan", name: "林晚", type: "character", weight: 0.3 },
          { assetId: "pr-records", name: "通话记录单", type: "prop", weight: 0.7 },
        ],
        variants: [imgVariant("iv-004a", "s-1401"), imgVariant("iv-004b", "s-1402")],
        pickedVariantId: "iv-004a",
        status: "picked",
      },
      {
        id: "kf-005",
        code: "KF-05",
        beatId: "beat-004",
        imagePrompt:
          "竖屏特写：林晚的手指悬在座机挂断键上方微微颤抖，指节发白，背景来电灯第三次亮起，红色警示光",
        references: [{ assetId: "ch-linwan", name: "林晚", type: "character", weight: 0.7 }],
        variants: [],
        status: "draft",
      },
      {
        id: "kf-006",
        code: "KF-06",
        beatId: "beat-004",
        imagePrompt:
          "竖屏极特写：座机来电屏的近距镜头，屏幕上显示『林晚（本机）』，屏幕反光里隐约有第二个身影站在身后，恐怖氛围",
        negativePrompt: "文字乱码，多余肢体",
        references: [
          { assetId: "pr-phone", name: "老式座机", type: "prop", weight: 0.8 },
          { assetId: "sty-fogisland", name: "雾岛冷调", type: "style", weight: 0.5 },
        ],
        variants: [],
        status: "draft",
      },
    ],
    segments: [
      {
        id: "seg-001",
        code: "SEG-01",
        fromKeyframeId: "kf-001",
        fromVariantId: "iv-001a",
        toKeyframeId: "kf-002",
        videoPrompt:
          "镜头缓缓推近来电屏，『姐姐』两个字在雨夜微光里明灭；话机铃声震动带动桌面水洼涟漪，冷蓝光里一缕暖黄台灯光忽明忽暗",
        modelId: "seedance-1-0-pro",
        resolution: "1080p",
        duration: 5,
        billedAttempts: 4,
        failedAttempts: 1,
        cost: 14.68,
        variants: [
          {
            id: "vv-001a",
            seed: "s-2101",
            modelVersion: "seedance-1-0-pro",
            requestParams: { resolution: "1080p", duration: 5, camerafixed: false },
            promptSnapshot: "镜头缓缓推近来电屏…",
            cost: 3.67,
            createdAt: now,
          },
          {
            id: "vv-001b",
            seed: "s-2102",
            modelVersion: "seedance-1-0-pro",
            requestParams: { resolution: "1080p", duration: 5, camerafixed: true },
            promptSnapshot: "镜头缓缓推近来电屏…",
            cost: 3.67,
            createdAt: now,
            rejectedReason: "镜头漂移",
          },
        ],
        pickedVariantId: "vv-001a",
        dialogueStrategy: "mute",
        status: "ready",
      },
      {
        id: "seg-002",
        code: "SEG-02",
        fromKeyframeId: "kf-002",
        toKeyframeId: "kf-003",
        videoPrompt:
          "林晚侧脸贴着听筒，海浪声可视化波纹从耳机后扩散；镜头环绕半周，窗外闪电两次劈亮雨幕，她瞳孔收缩",
        promptStale: true,
        modelId: "seedance-1-0-pro",
        resolution: "1080p",
        duration: 10,
        dialogue: "快……离开岛。",
        dialogueStrategy: "tts-post",
        billedAttempts: 1,
        failedAttempts: 0,
        cost: 10.78,
        variants: [
          {
            id: "vv-002a",
            seed: "s-2201",
            modelVersion: "seedance-1-0-pro",
            requestParams: { resolution: "1080p", duration: 10, camerafixed: false },
            promptSnapshot: "林晚侧脸贴着听筒…",
            cost: 10.78,
            createdAt: now,
          },
        ],
        pickedVariantId: undefined,
        status: "stale",
      },
      {
        id: "seg-003",
        code: "SEG-03",
        fromKeyframeId: "kf-003",
        toKeyframeId: "kf-004",
        videoPrompt:
          "无人机视角急速下降冲向气象站，探照灯束扫过镜头，青绿色磷光在海面下流动汇聚成漩涡图案",
        modelId: "seedance-1-0-pro",
        resolution: "1080p",
        duration: 5,
        billedAttempts: 0,
        failedAttempts: 2,
        cost: 0,
        variants: [],
        pickedVariantId: undefined,
        dialogueStrategy: "mute",
        status: "failed",
      },
      {
        id: "seg-004",
        code: "SEG-04",
        fromKeyframeId: "kf-004",
        toKeyframeId: "kf-005",
        videoPrompt:
          "俯拍桌面，林晚的手指抚过泛黄记录单上的红圈，纸页边缘被穿堂风掀动；镜头缓摇至旧照片，照片里的姐姐笑容渐渐与雨痕重叠",
        modelId: "seedance-1-0-pro",
        resolution: "1080p",
        duration: 10,
        billedAttempts: 0,
        failedAttempts: 0,
        cost: 0,
        variants: [],
        pickedVariantId: undefined,
        dialogueStrategy: "mute",
        status: "planned",
      },
      {
        id: "seg-005",
        code: "SEG-05",
        fromKeyframeId: "kf-005",
        fromVariantId: undefined,
        toKeyframeId: "kf-006",
        videoPrompt:
          "手指悬停颤抖后按下挂断，铃声戛然而止一拍寂静，随即来电灯第三次爆亮成红色，镜头急推至来电屏",
        promptStale: true,
        modelId: "seedance-2-5",
        resolution: "1080p",
        duration: 15,
        dialogue: "（电话那头，自己的声音）喂……我是林晚。",
        dialogueStrategy: "native",
        billedAttempts: 0,
        failedAttempts: 0,
        cost: 0,
        variants: [],
        pickedVariantId: undefined,
        status: "draft",
      },
    ],
  },
];

/** 参考资产库（一致性资产先行） */
export const mockReferenceAssets: ReferenceAsset[] = [
  { assetId: "ch-linwan", name: "林晚", type: "character" },
  { assetId: "sc-station", name: "气象站值班室", type: "scene" },
  { assetId: "sc-island", name: "雾岛全貌", type: "scene" },
  { assetId: "pr-phone", name: "老式座机", type: "prop" },
  { assetId: "pr-records", name: "通话记录单", type: "prop" },
  { assetId: "sty-fogisland", name: "雾岛冷调", type: "style" },
];

/** mock 项目（shot list 顶栏信息） */
export const mockStudioProject = {
  id: "p-007",
  name: "雾岛来电",
  format: "竖屏 AI 短剧",
  aspectRatio: "9:16" as AspectRatio,
  defaultModelId: "seedance-1-0-pro",
  defaultResolution: "1080p",
  episodeCount: 12,
};
