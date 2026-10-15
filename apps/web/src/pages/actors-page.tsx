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
import { assetUrl, hueOf } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

function ActorCard({ actor }: { actor: Actor }) {
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
                backgroundColor: `oklch(0.55 0.1 ${hueOf(actor.name.codePointAt(0) ?? 0)})`,
                backgroundImage: `radial-gradient(42px 32px at 68% 28%, oklch(0.75 0.1 ${hueOf(actor.name.codePointAt(0) ?? 0)}), transparent 74%)`,
              }}
            >
              <span className="text-lg font-medium text-white/90">
                {actor.name.slice(0, 1)}
              </span>
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
        <div className="mt-3 flex flex-wrap gap-1">
          {actor.tags.map((tag) => (
            <span
              key={tag}
              className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      </CardContent>
      <CardFooter className="items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground tabular-nums sm:text-[11px]">
        <span className="truncate">{actor.persona.split("，")[0]}</span>
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
          <Button size="sm" className="gap-1.5" disabled={Boolean(error)}>
            <Plus className="size-3.5" />
            新建演员
          </Button>
        }
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
            count={6}
            cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <div className={"grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"}>
            {filtered?.map((actor) => (
              <ActorCard key={actor.id} actor={actor} />
            ))}
          </div>
        )}
      </ListBody>
    </div>
  );
}
