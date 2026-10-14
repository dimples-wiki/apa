import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Project, ProjectStatus } from "@filmstudio/shared";
import { PROJECT_STATUS_LABELS } from "@filmstudio/shared";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

const coverGrid =
  "[background-image:linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] [background-size:24px_24px]";

function ProjectCard({ project }: { project: Project }) {
  const updatedAt = new Date(project.updatedAt).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
  });

  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-colors hover:border-foreground/25">
      <CardHeader className="relative h-24 border-b p-4">
        <div className={`absolute inset-0 ${coverGrid}`} />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/[0.035] to-transparent" />
        <span className="absolute right-3 bottom-1 text-6xl font-semibold tracking-tight text-foreground/[0.06] select-none">
          {project.name.slice(0, 1)}
        </span>
        <Badge
          variant="secondary"
          className="relative w-fit gap-1.5 border bg-muted text-[11px] font-medium"
        >
          <span className={`size-1.5 rounded-full ${statusDot[project.status]}`} />
          {PROJECT_STATUS_LABELS[project.status]}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-2 p-4">
        <h3 className="truncate text-[15px] font-medium tracking-tight">{project.name}</h3>
        <p className="line-clamp-2 min-h-10 text-[13px] leading-5 text-muted-foreground">
          {project.logline}
        </p>
      </CardContent>

      <CardFooter className="mt-auto items-center gap-3 border-t px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Progress value={project.progress} className="h-1 w-full" />
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {project.progress}%
          </span>
        </div>
        <div className="flex shrink-0 items-center -space-x-1.5">
          {project.members.slice(0, 2).map((member) => (
            <Avatar key={member} title={member} className="size-6 ring-2 ring-card">
              <AvatarFallback className="bg-foreground/8 text-[10px] font-medium text-foreground/75">
                {member.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          ))}
          {project.members.length > 2 ? (
            <span className="pl-3.5 text-[11px] tabular-nums text-muted-foreground">
              +{project.members.length - 2}
            </span>
          ) : null}
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{updatedAt}</span>
      </CardFooter>
    </Card>
  );
}

export function ProjectsPage() {
  const { data, error, loading, reload } = useApi(api.projects);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!data) return null;
    if (!q) return data;
    return data.filter((p) => (p.name + p.logline + p.genre).includes(q));
  }, [data, query]);

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="项目列表"
        description="管理你的影视项目，从剧本到成片"
        actions={
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" />
            新建项目
          </Button>
        }
      />
      <ListToolbar
        placeholder="搜索项目…"
        unit="个项目"
        count={error || loading ? null : (filtered?.length ?? 0)}
        query={query}
        onQueryChange={setQuery}
      />
      <ListBody>
        {loading ? (
          <CardGridSkeleton variant="project" count={6} />
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
