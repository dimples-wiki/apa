import { mockActors, mockCostumes, mockProjects, mockScenes } from "@filmstudio/shared";

/** 静态部署（无后端）时回退到内置演示数据 */
async function withFallback<T>(path: string, fallback: T): Promise<T> {
  try {
    return await request<T>(path);
  } catch {
    return fallback;
  }
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`请求失败 ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

export const api = {
  projects: () => withFallback("/api/projects", mockProjects),
  actors: () => withFallback("/api/actors", mockActors),
  scenes: () => withFallback("/api/scenes", mockScenes),
  costumes: () => withFallback("/api/costumes", mockCostumes),
};
