import type { Project } from "./index";

/** 镜头状态：草稿 → 关键帧已定 → AI 生成中 → 成片就绪 */
export type ShotStatus = "draft" | "keyframe" | "generating" | "ready";

/** 关键帧：镜头的首帧视觉锚点，AI 依此补全本镜头的画面 */
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
  /** 时长（秒） */
  duration: number;
  /** 画面描述（导演意图） */
  description: string;
  /** 运镜方式 */
  camera: string;
  /** 台词 / 旁白 */
  line?: string;
  /** 首帧关键帧 */
  keyframe: Keyframe;
  status: ShotStatus;
}

/** 集：创作工作台按单集组织 */
export interface Episode {
  id: string;
  number: number;
  title: string;
  logline: string;
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

/** 演示数据：星际摆渡人 · 第一集 */
export const mockEpisodes: Episode[] = [
  {
    id: "ep-001",
    number: 1,
    title: "起航",
    logline: "末世最后一个清晨，摆渡人唤醒自己，也唤醒三千个沉睡的希望。",
    shots: [
      {
        id: "sh-001",
        code: "S01-01",
        duration: 5,
        description: "休眠舱阵列全景，三千个舱体在幽蓝冷光中规律呼吸，尘埃在光柱里缓慢漂浮。",
        camera: "缓推",
        line: "旁白：地球时间，清晨六点十一分。",
        keyframe: { description: "冷蓝调休眠舱阵列，中央主光柱，极端对称构图" },
        status: "ready",
      },
      {
        id: "sh-002",
        code: "S01-02",
        duration: 6,
        description: "主舱盖开启，白霜剥落。主角睁眼，瞳孔里映出舱内警报的红光。",
        camera: "特写",
        line: "主角（低声）：……比预定，早了三年。",
        keyframe: { description: "面部大特写，右半脸覆霜，左半脸映红色警报光" },
        status: "ready",
      },
      {
        id: "sh-003",
        code: "S01-03",
        duration: 4,
        description: "主角漂浮穿过过渡舱走廊，失重状态下货物与私人物件缓缓散开。",
        camera: "跟移",
        keyframe: { description: "零重力走廊，漂浮的旧照片与工具，逆光剪影" },
        status: "generating",
      },
      {
        id: "sh-004",
        code: "S01-04",
        duration: 7,
        description: "操纵舱全景。主角落座船长席，手指划过星图投影，定格在『新家园』坐标。",
        camera: "环绕",
        line: "主角：三千个人，一个目的地。够了。",
        keyframe: { description: "环形操纵舱，星图投影铺满穹顶，人物居中偏左" },
        status: "keyframe",
      },
      {
        id: "sh-005",
        code: "S01-05",
        duration: 4,
        description: "特写：枯瘦的手指按下点火键，指示灯由红转绿。",
        camera: "特写",
        keyframe: { description: "点火键特写，红绿光交界，金属磨损质感" },
        status: "draft",
      },
      {
        id: "sh-006",
        code: "S01-06",
        duration: 8,
        description: "大远景。旧飞船挣脱空间站泊架，姿态引擎喷出淡蓝尾焰，缓缓转向深空。",
        camera: "航拍",
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
    shots: [
      {
        id: "sh-101",
        code: "S02-01",
        duration: 6,
        description: "通讯台特写，绿色波形突然跃出杂讯，主角瞳孔收缩。",
        camera: "固定",
        keyframe: { description: "CRT 通讯台特写，绿色波形跃动" },
        status: "keyframe",
      },
      {
        id: "sh-102",
        code: "S02-02",
        duration: 5,
        description: "主角贴着耳机侧耳，眉头从紧锁到松开——那是人类的语言。",
        camera: "特写",
        keyframe: { description: "侧耳特写，耳机轮廓压出浅痕" },
        status: "draft",
      },
      {
        id: "sh-103",
        code: "S02-03",
        duration: 7,
        description: "驾驶员席与主角对望，两人之间悬着半明半暗的对峙光。",
        camera: "过肩",
        line: "驾驶员：航线是死的。可信号，是活的。",
        keyframe: { description: "过肩对峙，明暗分割打光" },
        status: "draft",
      },
    ],
  },
];
