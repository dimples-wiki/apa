import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Actor } from "@dimples/apa-shared";
import { PageHeader } from "@/components/layout/page-header";
import {
  CardGridSkeleton,
  ErrorState,
  ListBody,
  ListToolbar,
} from "@/components/layout/list-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { assetUrl, hueOf } from "@/lib/utils";
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

function ActorCard({ actor }: { actor: Actor }) {
  const hue = hueOf(actor.name.codePointAt(0) ?? 0);
  return (
    <Card className="gap-3 py-4 transition-colors hover:border-foreground/25">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {actor.avatar ? (
            <img
              src={assetUrl(actor.avatar)}
              alt={actor.name}
              loading="lazy"
              className="size-14 shrink-0 rounded-full object-cover ring-1 ring-foreground/10"
            />
          ) : (
            <div
              className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/20"
              style={{
                backgroundColor: `oklch(0.55 0.1 ${hue})`,
                backgroundImage: `radial-gradient(42px 32px at 68% 28%, oklch(0.75 0.1 ${hue}), transparent 74%)`,
              }}
            >
              <span className="text-lg font-medium text-white/90">{actor.name.slice(0, 1)}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-medium tracking-tight">{actor.name}</h3>
            <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
              参演 {actor.projectCount} 个项目
            </p>
          </div>
        </div>
        <p className="mt-3 line-clamp-2 min-h-10 text-[12px] leading-5 text-muted-foreground [text-wrap:pretty]">
          {actor.persona}
        </p>
      </CardContent>
      <CardFooter className="items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground tabular-nums sm:text-[11px]">
        <span className="truncate">{actor.tags.join(" · ")}</span>
        <span
          className="shrink-0 text-muted-foreground/70"
          title={`创建于 ${new Date(actor.createdAt).toLocaleDateString("zh-CN")}`}
        >
          {new Date(actor.createdAt).toLocaleDateString("zh-CN", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </CardFooter>
    </Card>
  );
}

export function ActorsPage() {
  const { data, error, loading, reload } = useApi(api.actors);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const formFields: FormField[] = [
    {
      kind: "text",
      name: "name",
      label: "演员名称",
      placeholder: "角色名或演员名",
      required: true,
    },
    {
      kind: "textarea",
      name: "persona",
      label: "形象描述",
      placeholder: "外形、气质、声线、代表作…",
    },
    { kind: "tags", name: "tags", label: "戏路标签", placeholder: "输入标签后回车" },
  ];

  async function handleCreate(values: FormValues) {
    setSubmitting(true);
    try {
      await api.createActor({
        name: text(values, "name"),
        persona: text(values, "persona"),
        tags: tagList(values, "tags"),
      });
      toast.success("演员已创建");
      reload();
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!data) return null;
    if (!q) return data;
    return data.filter((a) => (a.name + a.persona + a.tags.join()).includes(q));
  }, [data, query]);

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="演员"
        description="AI 生成的演员形象库，可在各项目中复用"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            新建演员
          </Button>
        }
      />
      <ResourceFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建演员"
        description="创建演员档案，形象可稍后用 AI 生成"
        submitLabel="创建演员"
        submitting={submitting}
        fields={formFields}
        onSubmit={handleCreate}
      />
      {!error && (
        <ListToolbar
          placeholder="搜索演员…"
          unit="位演员"
          count={error || loading ? null : (filtered?.length ?? 0)}
          countHidden={Boolean(error)}
          query={query}
          onQueryChange={setQuery}
        />
      )}
      <ListBody>
        {loading ? (
          <CardGridSkeleton
            variant="actor"
            count={8}
            cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filtered?.map((actor) => (
              <ActorCard key={actor.id} actor={actor} />
            ))}
          </div>
        )}
      </ListBody>
    </div>
  );
}
