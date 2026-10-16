import type { Project } from "./index";

/** 镜头状态：草稿 → 关键帧已定 → AI 生成中 → 成片就绪 / 失败（可重试） */
export type ShotStatus = "draft" | "keyframe" | "generating" | "ready" | "failed";

/** 剧本改稿后镜头与剧本的同步状态 */
export type ScriptSyncStatus = "synced" | "stale";

/** 声音（台词配音）状态 */
export type VoiceStatus = "none" | "generating" | "final" | "locked";

/** 景别七档（DP 结构化字段，驱动时间线缩写色标） */
export const SHOT_SIZES = [
  { value: "ECU", label: "大特写" },
  { value: "CU", label: "特写" },
  { value: "MCU", label: "近景" },
  { value: "MS", label: "中景" },
  { value: "WS", label: "全景" },
  { value: "LS", label: "远景" },
  { value: "EWS", label: "大远景" },
] as const;

export function shotSizeLabel(size?: string): string {
  return SHOT_SIZES.find((s) => s.value === size)?.label ?? "—";
}

export function shotSizeAbbr(size?: string): string {
  const map: Record<string, string> = {
    ECU: "大特",
    CU: "特",
    MCU: "近",
    MS: "中",
    WS: "全",
    LS: "远",
    EWS: "大远",
  };
  return size ? (map[size] ?? "—") : "—";
}

/** 关键帧：镜头的视觉锚点，AI 依此补全本镜头的画面 */
export interface Keyframe {
  /** 关键帧画面描述（AI 生图提示词的来源） */
  description: string;
  /** 关键帧参考图（可选） */
  imageUrl?: string;
}

/** 镜头：时间线上的最小叙事单元 */
export interface Shot {
  id: string;
  /** 镜头号（如 S01-03：第 1 集第 3 镜） */
  code: string;
  /** 所属场次（关联剧本与左栏分组） */
  sceneId?: string;
  /** 时长（秒） */
  duration: number;
  /** 画面描述（导演意图） */
  description: string;
  /** 运镜方式 */
  camera: string;
  /** 台词 / 旁白（降级自由文本；结构化台词走剧本引用） */
  line?: string;
  /** 首帧关键帧 */
  keyframe: Keyframe;
  status: ShotStatus;
  /** 景别（DP 结构化字段） */
  shotSize?: string;
  /** 灯光氛围（结构化标签） */
  lighting?: {
    timeOfDay?: string;
    lightDirection?: string;
    colorTemp?: string;
    quality?: "soft" | "hard";
  };
  /** 尾帧关键帧（可选，定义运动终点） */
  keyframeEnd?: Keyframe;
  /** 生成失败原因（status=failed 时展示） */
  failureReason?: string;
  /** 剧本改稿后待同步标记 */
  scriptSyncStatus?: ScriptSyncStatus;
  /** 声音状态 */
  voiceStatus?: VoiceStatus;
  /** 累计生成次数（成本归因占位） */
  attempts?: number;
}

/** 剧本块：动作行或对白行（场次内的结构化文本） */
export interface ScriptBlock {
  id: string;
  type: "action" | "dialogue";
  /** 对白块的说话人（引用角色名） */
  character?: string;
  text: string;
}

/** 场次：编剧的戏剧单位，镜头挂场次之下 */
export interface ScriptScene {
  id: string;
  /** 场号（如 S01） */
  sceneNumber: string;
  /** 场头：内/外景 · 地点 · 日/夜 */
  heading: string;
  blocks: ScriptBlock[];
  /** 关联镜头 id 列表 */
  shotIds: string[];
  notes?: string;
}

/** 集大纲四节拍（结构化，一等创作产物） */
export interface BeatSheet {
  hook: string;
  development: string;
  turn: string;
  endingHook: string;
}

/** 集：创作工作台按单集组织 */
export interface Episode {
  id: string;
  number: number;
  title: string;
  logline: string;
  /** 集故事大纲（自由正文） */
  synopsis: string;
  beatSheet?: BeatSheet;
  /** 场次剧本 */
  scriptScenes: ScriptScene[];
  /** 集目标时长（秒），供字数预估/实际片长对比 */
  targetDurationSeconds?: number;
  shots: Shot[];
}

/** 项目工作台（项目 → 多集） */
export interface ProjectStudio {
  project: Project;
  episodes: Episode[];
}

export const SHOT_STATUS_LABELS: Record<ShotStatus, string> = {
  draft: "草稿",
  keyframe: "关键帧已定",
  generating: "生成中",
  ready: "成片就绪",
  failed: "生成失败",
};

export const CAMERA_MOVES = [
  "固定",
  "缓推",
  "缓拉",
  "左摇",
  "右摇",
  "跟移",
  "手持",
  "环绕",
  "升格",
  "航拍",
] as const;

export function episodeDuration(episode: Episode): number {
  return episode.shots.reduce((acc, s) => acc + s.duration, 0);
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 时间码 mm:ss.ff（25fps 占位） */
export function formatTimecode(seconds: number): string {
  const totalFrames = Math.round(seconds * 25);
  const ff = totalFrames % 25;
  const totalSeconds = Math.floor(totalFrames / 25);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(ff).padStart(2, "0")}`;
}

/** 演示数据：星际摆渡人 · 前两集 */
export const mockEpisodes: Episode[] = [
  {
    id: "ep-001",
    number: 1,
    title: "起航",
    logline: "末世最后一个清晨，摆渡人唤醒自己，也唤醒三千个沉睡的希望。",
    synopsis:
      "飞船『渡轮七号』在深空航行第三年。摆渡人程野从提前三年的休眠中被警报唤醒，发现全船仍在沉睡、航线偏移。他与副驾老周确认：一段来自未知坐标的信号改变了航向。程野决定先按下点火键，把船开起来——答案在路上找。",
    beatSheet: {
      hook: "提前三年苏醒——不是故障，是有人在深夜改了航线。",
      development: "程野逐一排查：燃料充足、航线被覆盖、信号源来自船头方向。",
      turn: "老周承认：三个月前他收到了信号，选择沉默。",
      endingHook: "点火。不是去查信号，而是带着三千人一起赴约。",
    },
    scriptScenes: [
      {
        id: "sc-001",
        sceneNumber: "S01",
        heading: "内景 · 休眠舱大厅 · 无自然光",
        blocks: [
          {
            id: "sb-001",
            type: "action",
            text: "蓝光呼吸般明灭。舱盖依次开启，白霜剥落。程野赤脚落地，呵出白气。",
          },
          {
            id: "sb-002",
            type: "dialogue",
            character: "程野",
            text: "比预定……早了三年。",
          },
        ],
        shotIds: ["sh-001", "sh-002"],
      },
      {
        id: "sc-002",
        sceneNumber: "S02",
        heading: "内景 · 操纵舱 · 无自然光",
        blocks: [
          { id: "sb-003", type: "action", text: "星图投影铺满穹顶。程野划过坐标，指尖停住。" },
          {
            id: "sb-004",
            type: "dialogue",
            character: "程野",
            text: "三千个人，一个目的地。够了。",
          },
        ],
        shotIds: ["sh-004", "sh-005"],
      },
    ],
    targetDurationSeconds: 240,
    shots: [
      {
        id: "sh-001",
        code: "S01-01",
        sceneId: "sc-001",
        duration: 5,
        description: "休眠舱阵列全景，三千个舱体在幽蓝冷光中规律呼吸，尘埃在光柱里缓慢漂浮。",
        camera: "缓推",
        shotSize: "WS",
        lighting: { timeOfDay: "无自然光", colorTemp: "8000K", quality: "hard" },
        line: "旁白：地球时间，清晨六点十一分。",
        keyframe: { description: "冷蓝调休眠舱阵列，中央主光柱，极端对称构图" },
        status: "ready",
      },
      {
        id: "sh-002",
        code: "S01-02",
        sceneId: "sc-001",
        duration: 6,
        description: "主舱盖开启，白霜剥落。主角睁眼，瞳孔里映出舱内警报的红光。",
        camera: "固定",
        shotSize: "CU",
        lighting: {
          timeOfDay: "无自然光",
          lightDirection: "侧光",
          colorTemp: "3200K",
          quality: "hard",
        },
        line: "主角（低声）：……比预定，早了三年。",
        keyframe: { description: "面部大特写，右半脸覆霜，左半脸映红色警报光" },
        status: "ready",
      },
      {
        id: "sh-003",
        code: "S01-03",
        sceneId: "sc-001",
        duration: 4,
        description: "主角漂浮穿过过渡舱走廊，失重状态下货物与私人物件缓缓散开。",
        camera: "跟移",
        shotSize: "MS",
        keyframe: { description: "零重力走廊，漂浮的旧照片与工具，逆光剪影" },
        status: "generating",
      },
      {
        id: "sh-004",
        code: "S01-04",
        sceneId: "sc-002",
        duration: 7,
        description: "操纵舱全景。主角落座船长席，手指划过星图投影，定格在『新家园』坐标。",
        camera: "环绕",
        shotSize: "WS",
        line: "主角：三千个人，一个目的地。够了。",
        keyframe: { description: "环形操纵舱，星图投影铺满穹顶，人物居中偏左" },
        status: "keyframe",
      },
      {
        id: "sh-005",
        code: "S01-05",
        sceneId: "sc-002",
        duration: 4,
        description: "特写：枯瘦的手指按下点火键，指示灯由红转绿。",
        camera: "缓推",
        shotSize: "ECU",
        keyframe: { description: "点火键特写，红绿光交界，金属磨损质感" },
        status: "failed",
        failureReason: "生成超时（配额队列拥堵），可重试",
      },
      {
        id: "sh-006",
        code: "S01-06",
        duration: 8,
        description: "大远景。旧飞船挣脱空间站泊架，姿态引擎喷出淡蓝尾焰，缓缓转向深空。",
        camera: "航拍",
        shotSize: "EWS",
        line: "旁白：摆渡人出发。此去，不再回航。",
        keyframe: { description: "深空大远景，飞船微小剪影，尾焰是唯一光源" },
        status: "draft",
      },
    ],
  },
  {
    id: "ep-002",
    number: 2,
    title: "信号",
    logline: "一段不该存在的求救信号，让三千个梦第一次动摇。",
    synopsis:
      "深夜，通讯台捕捉到一段重复的求救信号。程野与老周就是否转向爆发争执——航线是三千人的性命，信号可能是三年的欺骗。最终程野选择相信信号：因为发出信号的声音，和他女儿一模一样。",
    scriptScenes: [
      {
        id: "sc-101",
        sceneNumber: "S01",
        heading: "内景 · 通讯台 · 无自然光",
        blocks: [
          { id: "sb-101", type: "action", text: "绿色波形在杂讯里突然立起。程野猛地抬头。" },
          {
            id: "sb-102",
            type: "dialogue",
            character: "老周",
            text: "这个频段……二十年前就禁用了。",
          },
        ],
        shotIds: ["sh-101", "sh-102", "sh-103"],
      },
    ],
    shots: [
      {
        id: "sh-101",
        code: "S02-01",
        sceneId: "sc-101",
        duration: 6,
        description: "通讯台特写，绿色波形突然跃出杂讯，主角瞳孔收缩。",
        camera: "固定",
        shotSize: "ECU",
        keyframe: { description: "CRT 通讯台特写，绿色波形跃动" },
        status: "keyframe",
        scriptSyncStatus: "stale",
      },
      {
        id: "sh-102",
        code: "S02-02",
        sceneId: "sc-101",
        duration: 5,
        description: "主角贴着耳机侧耳，眉头从紧锁到松开——那是人类的语言。",
        camera: "固定",
        shotSize: "CU",
        keyframe: { description: "贴耳特写，侧光勾勒耳机轮廓" },
        status: "failed",
        failureReason: "提示词触发内容安全拦截，建议修改关键帧描述后重试",
      },
      {
        id: "sh-103",
        code: "S02-03",
        sceneId: "sc-101",
        duration: 7,
        description: "驾驶员席与主角对望，两人之间悬着半明半暗的对峙光。",
        camera: "跟移",
        shotSize: "MS",
        line: "驾驶员：航线是死的。可信号，是活的。",
        keyframe: { description: "过肩对峙，明暗分割打光" },
        status: "draft",
      },
    ],
  },
];
