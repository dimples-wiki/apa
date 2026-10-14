import { Film, Plus } from "lucide-react";
import type { Project, ProjectStatus } from "@filmstudio/shared";
import { PROJECT_STATUS_LABELS } from "@filmstudio/shared";
import { PageHeader } from "@/components/layout/page-header";
import { CardGridSkeleton, ErrorState } from "@/components/layout/list-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

const statusDot: Record<ProjectStatus, string> = {
  planning: "bg-sky-400",
  writing: "bg-amber-400",
  shooting: "bg-emerald-400",
  post: "bg-violet-400",
  released: "bg-teal-400",
};

const coverGradients = [
  "from-indigo-500/45 to-purple-600/10",
  "from-cyan-500/40 to-blue-600/10",
  "from-amber-500/40 to-rose-500/10",
  "from-emerald-500/40 to-teal-600/10",
  "from-rose-500/40 to-violet-600/10",
  "from-violet-500/45 to-indigo-600/10",
];

function coverOf(name: string) {
  const sum = name.split("").reduce((acc, ch) => acc + (ch.codePointAt(0) ?? 0), 0);
  return coverGradients[sum % coverGradients.length];
}

const avatarPalette = [
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
];

function avatarOf(name: string) {
  const sum = name.split("").reduce((acc, ch) => acc + (ch.codePointAt(0) ?? 0), 0);
  return avatarPalette[sum % avatarPalette.length];
}

function ProjectCard({ project }: { project: Project }) {
  const updatedAt = new Date(project.updatedAt).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
  });

  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-colors hover:border-foreground/15">
      <CardHeader className="relative h-24 border-b bg-gradient-to-br p-4">
        <div className={`absolute inset-0 bg-gradient-to-br ${coverOf(project.name)}`} />
        <Film className="absolute right-3 bottom-2 size-12 text-foreground/8 transition-colors group-hover:text-foreground/12" />
        <Badge
          variant="secondary"
          className="relative w-fit gap-1.5 border bg-background/60 text-[11px] font-medium backdrop-blur-sm"
        >
          <span className={`size-1.5 rounded-full ${statusDot[project.status]}`} />
          {PROJECT_STATUS_LABELS[project.status]}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-2 p-4">
        <h3 className="truncate text-[14px] font-medium tracking-tight">{project.name}</h3>
        <p className="line-clamp-2 min-h-10 text-[13px] leading-5 text-muted-foreground">
          {project.logline}
        </p>
      </CardContent>

      <CardFooter className="mt-auto items-center gap-3 border-t px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Progress value={project.progress} className="h-1 w-full" />
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {project.progress}%
          </span>
        </div>
        <div className="flex items-center -space-x-1.5">
          {project.members.slice(0, 3).map((member) => (
            <Avatar key={member} className="size-5 ring-2 ring-card">
              <AvatarFallback className={`text-[9px] font-medium ${avatarOf(member)}`}>
                {member.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          ))}
          {project.members.length > 3 ? (
            <span className="pl-3 text-[11px] text-muted-foreground">
              +{project.members.length - 3}
            </span>
          ) : null}
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">{updatedAt}</span>
      </CardFooter>
    </Card>
  );
}

export function ProjectsPage() {
  const { data, error, loading } = useApi(api.projects);

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
      <div className="flex-1 px-8 pb-8">
        {loading ? (
          <CardGridSkeleton count={6} />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data?.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
