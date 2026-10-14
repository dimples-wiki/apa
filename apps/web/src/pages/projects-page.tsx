import { useMemo, useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import type { Project, ProjectStatus } from "@filmstudio/shared";
import { PROJECT_STATUS_LABELS } from "@filmstudio/shared";
import { cn, coverGrid } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import {
  CardGridSkeleton,
  ErrorState,
  ListBody,
  ListToolbar,
} from "@/components/layout/list-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

const statusDot: Record<ProjectStatus, string> = {
  planning: "bg-zinc-400 dark:bg-zinc-500",
  writing: "bg-amber-500",
  shooting: "bg-[#0070f3]",
  post: "bg-violet-500",
  released: "bg-emerald-500",
};

function ProjectCard({ project }: { project: Project }) {
  const updatedAt = new Date(project.updatedAt).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
  });

  return (
    <Card className="group cursor-pointer gap-0 overflow-hidden py-0 transition-colors hover:border-foreground/25">
      <CardHeader className="relative h-24 border-b p-4">
        <div className={`absolute inset-0 ${coverGrid}`} />
        <span
          className="absolute -bottom-3 right-4 text-[64px] leading-none font-semibold tracking-tight select-none [mask-image:linear-gradient(to_bottom,black_45%,transparent_96%)]"
          style={{ color: "var(--cover-word)" }}
        >
          {project.name.slice(0, 1)}
        </span>
        <Badge
          variant="secondary"
          className="relative w-fit gap-1.5 border bg-muted text-[11px] font-medium"
        >
          <span className={`size-1.5 rounded-full ${statusDot[project.status]}`} />
          {PROJECT_STATUS_LABELS[project.status]}
        </Badge>
        <ArrowUpRight className="absolute top-3 right-3 size-4 text-foreground/70 opacity-0 transition-opacity group-hover:opacity-100" />
      </CardHeader>

      <CardContent className="space-y-2 p-4">
        <h3 className="truncate text-[15px] font-medium tracking-tight">{project.name}</h3>
        <p className="line-clamp-2 min-h-10 text-[13px] leading-5 text-muted-foreground [text-wrap:pretty]">
          {project.logline}
        </p>
      </CardContent>

      <CardFooter className="mt-auto items-center gap-3 border-t px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Progress
            value={project.progress}
            className={cn("h-1 w-full", progressTone[project.status])}
          />
          <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
            {project.progress}%
          </span>
        </div>
        <span
          className="max-w-24 shrink-0 truncate text-[11px] text-muted-foreground"
          title={project.members.join("、")}
        >
          {project.members[0]}
          {project.members.length > 1 ? ` 等 ${project.members.length} 人` : ""}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{updatedAt}</span>
      </CardFooter>
    </Card>
  );
}

const progressTone: Record<ProjectStatus, string> = {
  planning:
    "[&>div]:bg-zinc-500 [&>div]:bg-[repeating-linear-gradient(45deg,transparent_0px,transparent_2px,rgba(0,0,0,0.35)_2px,rgba(0,0,0,0.35)_4px)] dark:[&>div]:bg-zinc-600 dark:[&>div]:bg-[repeating-linear-gradient(45deg,transparent_0px,transparent_2px,rgba(255,255,255,0.38)_2px,rgba(255,255,255,0.38)_4px)]",
  writing: "[&>div]:bg-amber-500",
  shooting: "[&>div]:bg-[#0070f3]",
  post: "[&>div]:bg-violet-500",
  released: "[&>div]:bg-emerald-500",
};

const statusFilters: { key: ProjectStatus | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  ...(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((key) => ({
    key,
    label: PROJECT_STATUS_LABELS[key],
  })),
];

export function ProjectsPage() {
  const { data, error, loading, reload } = useApi(api.projects);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "all">("all");

  const filtered = useMemo(() => {
    if (!data) return null;
    let rows = data;
    if (status !== "all") rows = rows.filter((p) => p.status === status);
    const q = query.trim();
    if (q) rows = rows.filter((p) => (p.name + p.logline + p.genre).includes(q));
    return rows;
  }, [data, query, status]);

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="项目"
        description="管理你的影视项目，从剧本到成片"
        actions={
          <Button size="sm" className="gap-1.5" disabled={Boolean(error)}>
            <Plus className="size-3.5" />
            新建项目
          </Button>
        }
      />
      {!error && (
        <ListToolbar
          placeholder="搜索项目…"
          unit="个项目"
          count={loading ? null : (filtered?.length ?? 0)}
          query={query}
          onQueryChange={setQuery}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {statusFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatus(f.key)}
                className={cn(
                  "h-7 rounded-full border px-3 text-[12px] transition-colors",
                  status === f.key
                    ? "border-foreground/45 bg-foreground/8 font-medium text-foreground"
                    : "text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </ListToolbar>
      )}
      <ListBody>
        {loading ? (
          <CardGridSkeleton variant="project" count={6} cols="md:grid-cols-2 xl:grid-cols-3" />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered?.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </ListBody>
    </div>
  );
}
