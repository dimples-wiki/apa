import { mockActors, mockCostumes, mockProjects, mockScenes } from "@dimples/apa-shared";
import type { Actor, Costume, Project, ProjectStatus, Scene } from "@dimples/apa-shared";

/** 静态部署（无后端）时回退到内置演示数据 */
async function withFallback<T>(path: string, fallback: T): Promise<T> {
  try {
    return await request<T>(path);
  } catch {
    return fallback;
  }
}

async function postJSON<T>(path: string, body: unknown, buildFallback: () => T): Promise<T> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  } catch {
    // 静态部署：本地构造对象（仅内存态，刷新后为演示数据）
    return buildFallback();
  }
}

let seqCounter = 100;
function localId(prefix: string): string {
  seqCounter += 1;
  return `${prefix}-${seqCounter}`;
}
function nowIso(): string {
  return new Date().toISOString();
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`请求失败 ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

export interface ProjectInput {
  name: string;
  logline?: string;
  genre?: string;
  status?: ProjectStatus;
  members?: string[];
  cover?: string;
}
export interface ActorInput {
  name: string;
  persona?: string;
  tags?: string[];
  avatar?: string;
}
export interface SceneInput {
  name: string;
  description?: string;
  timeOfDay?: string;
  tags?: string[];
  projectName?: string;
}
export interface CostumeInput {
  name: string;
  description?: string;
  era?: string;
  tags?: string[];
}

export const api = {
  projects: () => withFallback("/api/projects", mockProjects),
  actors: () => withFallback("/api/actors", mockActors),
  scenes: () => withFallback("/api/scenes", mockScenes),
  costumes: () => withFallback("/api/costumes", mockCostumes),
  createProject: (input: ProjectInput) =>
    postJSON<Project>("/api/projects", input, () => ({
      id: localId("p"),
      cover: input.cover,
      name: input.name,
      logline: input.logline ?? "",
      genre: input.genre ?? "未分类",
      status: input.status ?? "planning",
      progress: 0,
      members: input.members ?? [],
      updatedAt: nowIso(),
    })),
  createActor: (input: ActorInput) =>
    postJSON<Actor>("/api/actors", input, () => ({
      id: localId("a"),
      avatar: input.avatar,
      name: input.name,
      persona: input.persona ?? "",
      accent: "indigo",
      tags: input.tags ?? [],
      projectCount: 0,
      createdAt: nowIso(),
    })),
  createScene: (input: SceneInput) =>
    postJSON<Scene>("/api/scenes", input, () => ({
      id: localId("s"),
      name: input.name,
      description: input.description ?? "",
      timeOfDay: input.timeOfDay ?? "日",
      tags: input.tags ?? [],
      projectName: input.projectName ?? "未关联",
      createdAt: nowIso(),
    })),
  createCostume: (input: CostumeInput) =>
    postJSON<Costume>("/api/costumes", input, () => ({
      id: localId("c"),
      name: input.name,
      description: input.description ?? "",
      era: input.era ?? "当代",
      tags: input.tags ?? [],
      createdAt: nowIso(),
    })),
};
