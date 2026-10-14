import type { Actor, Costume, Project, Scene } from "@filmstudio/shared";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`请求失败 ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

export const api = {
  projects: () => request<Project[]>("/api/projects"),
  actors: () => request<Actor[]>("/api/actors"),
  scenes: () => request<Scene[]>("/api/scenes"),
  costumes: () => request<Costume[]>("/api/costumes"),
};
