import { useMemo, useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import type { Project, ProjectStatus } from "@dimples/apa-shared";
import { PROJECT_STATUS_LABELS } from "@dimples/apa-shared";
import { assetUrl, cn, coverGrid } from "@/lib/utils";
import {
  ResourceFormDialog,
  tagList,
  text,
  type FormField,
  type FormValues,
} from "@/components/resource-form-dialog";
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
import { toast } from "sonner";
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
      <CardHeader className="relative h-16 overflow-hidden border-b p-4 sm:h-24">
        {project.cover ? (
          <>
            <img
              src={assetUrl(project.cover)}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />
          </>
        ) : (
          <>
            <div className={`absolute inset-0 ${coverGrid}`} />
            <span
              className="absolute -bottom-3 right-4 text-[64px] leading-none font-semibold tracking-tight select-none [mask-image:linear-gradient(to_bottom,black_45%,transparent_96%)]"
              style={{ color: "var(--cover-word)" }}
            >
              {project.name.slice(0, 1)}
            </span>
          </>
        )}
        <Badge
          variant="secondary"
          className="relative w-fit gap-1.5 border bg-background/75 text-[11px] font-medium backdrop-blur-sm"
        >
          <span className={`size-1.5 rounded-full ${statusDot[project.status]}`} />
          {PROJECT_STATUS_LABELS[project.status]}
        </Badge>
        <ArrowUpRight className="absolute top-3 right-3 z-10 size-4 text-white/90 opacity-0 transition-opacity group-hover:opacity-100" />
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
          <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:text-[11px]">
            {project.progress}%
          </span>
        </div>
        <span
          className="max-w-24 shrink-0 truncate text-xs text-muted-foreground sm:text-[11px]"
          title={project.members.join("、")}
        >
          {project.members[0]}
          {project.members.length > 1 ? ` 等 ${project.members.length} 人` : ""}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground sm:text-[11px]">
          {updatedAt}
        </span>
      </CardFooter>
    </Card>
  );
}

const projectFormFields: FormField[] = [
  {
    kind: "text",
    name: "name",
    label: "项目名称",
    placeholder: "如：长安十二时辰 · 重制",
    required: true,
  },
  { kind: "textarea", name: "logline", label: "一句话故事", placeholder: "用一句话概括这个故事" },
  {
    kind: "text",
    name: "genre",
    label: "题材",
    placeholder: "如：古装悬疑",
    suggestions: ["古装悬疑", "都市情感", "科幻", "悬疑刑侦", "奇幻", "年代", "喜剧", "运动"],
  },
  {
    kind: "select",
    name: "status",
    label: "当前状态",
    options: (Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((key) => ({
      value: key,
      label: PROJECT_STATUS_LABELS[key],
    })),
  },
  { kind: "tags", name: "members", label: "主创成员", placeholder: "输入姓名后回车，最多 8 人" },
];

const progressTone: Record<ProjectStatus, string> = {
  planning:
    "[&>div]:bg-zinc-500 [&>div]:bg-[repeating-linear-gradient(45deg,transparent_0px,transparent_2px,rgba(0,0,0,0.35)_2px,rgba(0,0,0,0.35)_4px)] dark:[&>div]:bg-zinc-600 dark:[&>div]:bg-[repeating-linear-gradient(45deg,transparent_0px,transparent_2px,rgba(255,255,255,0.5)_2px,rgba(255,255,255,0.5)_4px)]",
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
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return null;
    let rows = data;
    if (status !== "all") rows = rows.filter((p) => p.status === status);
    const q = query.trim();
    if (q) rows = rows.filter((p) => (p.name + p.logline + p.genre).includes(q));
    return rows;
  }, [data, query, status]);

  async function handleCreate(values: FormValues) {
    setSubmitting(true);
    try {
      await api.createProject({
        name: text(values, "name"),
        logline: text(values, "logline"),
        genre: text(values, "genre"),
        status: (values.status as ProjectStatus | undefined) ?? undefined,
        members: tagList(values, "members"),
      });
      toast.success("项目已创建");
      reload();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="项目"
        description="管理你的影视项目，从剧本到成片"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            新建项目
          </Button>
        }
      />
      <ResourceFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建项目"
        description="创建一个影视项目，封面可稍后在项目详情中补充"
        submitLabel="创建项目"
        submitting={submitting}
        fields={projectFormFields}
        onSubmit={handleCreate}
      />
      <ListToolbar
        placeholder="搜索项目…"
        unit="个项目"
        count={error ? null : loading ? null : (filtered?.length ?? 0)}
        countHidden={Boolean(error)}
        query={query}
        onQueryChange={setQuery}
      >
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_88%,transparent_100%)] [&::-webkit-scrollbar]:hidden">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              className={cn(
                "h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13px] transition-colors sm:h-9 sm:text-[12px]",
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
      <ListBody>
        {loading ? (
          <CardGridSkeleton
            variant="project"
            count={8}
            cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <div className={"grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"}>
            {filtered?.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </ListBody>
    </div>
  );
}
