/** 应用版本（package.json 同步） */
export const APP_VERSION = "0.1.0";

/** 项目状态 */
export type ProjectStatus = "planning" | "writing" | "shooting" | "post" | "released";

export interface Project {
  id: string;
  name: string;
  /** 封面图（/public/covers） */
  cover?: string;
  logline: string;
  genre: string;
  status: ProjectStatus;
  /** 0-100 */
  progress: number;
  /** 成员显示名列表（先占位，后续接用户系统） */
  members: string[];
  updatedAt: string;
}

export interface Actor {
  id: string;
  name: string;
  /** 头像（/public/avatars） */
  avatar?: string;
  /** AI 形象描述 */
  persona: string;
  tags: string[];
  /** 参演项目数 */
  projectCount: number;
  /** 头像底色 token（占位，后续生成形象图） */
  accent: string;
  createdAt: string;
}

export interface Scene {
  id: string;
  name: string;
  description: string;
  /** 日/夜/黄昏等 */
  timeOfDay: string;
  tags: string[];
  projectName: string;
  createdAt: string;
}

export interface Costume {
  id: string;
  name: string;
  description: string;
  /** 时代/风格 */
  era: string;
  tags: string[];
  createdAt: string;
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "筹备中",
  writing: "剧本创作",
  shooting: "拍摄中",
  post: "后期制作",
  released: "已发布",
};

export { mockProjects, mockActors, mockScenes, mockCostumes } from "./mock";

export * from "./studio";
