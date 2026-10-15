import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Scene } from "@dimples/apa-shared";
import { PageHeader } from "@/components/layout/page-header";
import {
  CardGridSkeleton,
  ErrorState,
  ListBody,
  ListToolbar,
} from "@/components/layout/list-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { coverGrid, grainTexture, sceneHue } from "@/lib/utils";
import {
  ResourceFormDialog,
  tagList,
  text,
  type FormField,
  type FormValues,
} from "@/components/resource-form-dialog";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

function SceneCard({ scene, index }: { scene: Scene; index: number }) {
  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-colors hover:border-foreground/25">
      <CardHeader className="relative h-14 overflow-hidden border-b p-3 sm:h-20">
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `oklch(0.9 0.04 ${sceneHue(scene.timeOfDay, index)})` }}
        />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            backgroundColor: `oklch(0.16 0.035 ${sceneHue(scene.timeOfDay, index)})`,
            backgroundImage: `radial-gradient(160px 90px at 75% 110%, oklch(0.45 0.09 ${sceneHue(scene.timeOfDay, index)}), transparent 75%)`,
          }}
        />
        <div className={`absolute inset-0 ${coverGrid}`} />
        <div className="absolute inset-0 opacity-[0.12] mix-blend-overlay" style={grainTexture} />
        <span
          className="absolute -bottom-1 right-3 text-[36px] sm:text-[48px] leading-none font-semibold tracking-tight select-none [mask-image:linear-gradient(to_bottom,black_45%,transparent_95%)]"
          style={{ color: "var(--cover-word)" }}
        >
          {scene.name.slice(0, 1)}
        </span>
        <span className="absolute top-2.5 left-3 rounded border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground backdrop-blur-sm">
          {scene.timeOfDay}
        </span>
      </CardHeader>
      <CardContent className="space-y-1.5 p-4">
        <h3 className="truncate text-[15px] font-medium tracking-tight">{scene.name}</h3>
        <p className="line-clamp-2 min-h-10 text-[12px] leading-5 text-muted-foreground [text-wrap:pretty]">
          {scene.description}
        </p>
      </CardContent>
      <CardFooter className="items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground sm:text-[11px]">
        <span className="truncate">{scene.projectName}</span>
        <span className="shrink-0">{scene.tags.join(" · ")}</span>
      </CardFooter>
    </Card>
  );
}

export function ScenesPage() {
  const { data, error, loading, reload } = useApi(api.scenes);
  const projects = useApi(api.projects);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const projectOptions = (projects.data ?? []).map((p) => ({ value: p.name, label: p.name }));
  const formFields: FormField[] = [
    {
      kind: "text",
      name: "name",
      label: "场景名称",
      placeholder: "如：长安西市 · 夜市",
      required: true,
    },
    { kind: "textarea", name: "description", label: "场景描述", placeholder: "空间、光线、氛围…" },
    {
      kind: "select",
      name: "timeOfDay",
      label: "时段",
      options: [
        { value: "日", label: "日" },
        { value: "黄昏", label: "黄昏" },
        { value: "夜", label: "夜" },
        { value: "无自然光", label: "无自然光" },
      ],
    },
    { kind: "tags", name: "tags", label: "标签", placeholder: "输入标签后回车，如：内景 · 棚拍" },
    {
      kind: "select",
      name: "projectName",
      label: "关联项目",
      emptyLabel: "不关联项目",
      options: projectOptions,
    },
  ];

  async function handleCreate(values: FormValues) {
    setSubmitting(true);
    try {
      await api.createScene({
        name: text(values, "name"),
        description: text(values, "description"),
        timeOfDay: text(values, "timeOfDay"),
        tags: tagList(values, "tags"),
        projectName: text(values, "projectName"),
      });
      toast.success("场景已创建");
      reload();
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!data) return null;
    if (!q) return data;
    return data.filter((s) => (s.name + s.description + s.tags.join()).includes(q));
  }, [data, query]);

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="场景"
        description="项目共用的场景素材库"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            新建场景
          </Button>
        }
      />
      <ResourceFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建场景"
        description="沉淀一个可复用的场景资产"
        submitLabel="创建场景"
        submitting={submitting}
        fields={formFields}
        onSubmit={handleCreate}
      />
      {!error && (
        <ListToolbar
          placeholder="搜索场景…"
          unit="个场景"
          count={error || loading ? null : (filtered?.length ?? 0)}
          countHidden={Boolean(error)}
          query={query}
          onQueryChange={setQuery}
        />
      )}
      <ListBody>
        {loading ? (
          <CardGridSkeleton
            variant="scene"
            count={4}
            cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <div className={"grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"}>
            {filtered?.map((scene, index) => (
              <SceneCard key={scene.id} scene={scene} index={index} />
            ))}
          </div>
        )}
      </ListBody>
    </div>
  );
}
