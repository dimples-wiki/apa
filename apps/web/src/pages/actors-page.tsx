import { useMemo, useState } from "react";
import { Plus, UserRound } from "lucide-react";
import type { Actor } from "@filmstudio/shared";
import { PageHeader } from "@/components/layout/page-header";
import {
  CardGridSkeleton,
  ErrorState,
  ListBody,
  ListToolbar,
} from "@/components/layout/list-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

function ActorCard({ actor }: { actor: Actor }) {
  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-colors hover:border-foreground/25">
      <div className="relative flex h-24 items-center justify-center border-b bg-gradient-to-br from-foreground/[0.08] to-foreground/[0.015]">
        <UserRound className="size-11 text-foreground/[0.16]" strokeWidth={1.25} />
        <span className="absolute top-2.5 right-3 text-[11px] text-muted-foreground">
          {actor.name.slice(0, 1)}
        </span>
      </div>
      <CardContent className="space-y-2.5 p-4">
        <div className="space-y-1">
          <h3 className="text-[15px] font-medium tracking-tight">{actor.name}</h3>
          <p className="line-clamp-2 min-h-10 text-[12px] leading-5 text-muted-foreground">
            {actor.persona}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
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
      <CardFooter className="border-t px-4 pt-3 text-[11px] text-muted-foreground tabular-nums">
        参演 {actor.projectCount} 个项目
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
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" />
            新建演员
          </Button>
        }
      />
      <ListToolbar
        placeholder="搜索演员…"
        unit="位演员"
        count={error || loading ? null : (filtered?.length ?? 0)}
        query={query}
        onQueryChange={setQuery}
      />
      <ListBody>
        {loading ? (
          <CardGridSkeleton variant="actor" count={6} />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered?.map((actor) => (
              <ActorCard key={actor.id} actor={actor} />
            ))}
          </div>
        )}
      </ListBody>
    </div>
  );
}
