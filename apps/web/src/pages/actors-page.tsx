import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
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
import { coverGrid, grainTexture, hueOf } from "@/lib/utils";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

function hashName(name: string) {
  return name.split("").reduce((acc, ch) => acc + (ch.codePointAt(0) ?? 0), 0);
}

/** 按名字派生色相与光斑位置，让每位演员的"生成形象"可区分 */
function actorCover(name: string, index: number) {
  const h = hashName(name);
  const hue = hueOf(index);
  const x1 = 18 + (h % 50);
  const y1 = 30 + (h % 30);
  const x2 = 55 + ((h >> 3) % 45);
  const y2 = 62 + ((h >> 5) % 38);
  const x3 = 30 + ((h >> 7) % 40);
  const y3 = 45 + ((h >> 2) % 40);
  const dark =
    `radial-gradient(110px 80px at ${x3}% ${y3}%, oklch(0.85 0.06 ${hue}), transparent 70%),` +
    `radial-gradient(180px 130px at ${x1}% ${y1}%, oklch(0.68 0.1 ${hue}), transparent 72%),` +
    `radial-gradient(240px 175px at ${x2}% ${y2}%, oklch(0.5 0.07 ${hue}), transparent 76%)`;
  const light =
    `radial-gradient(90px 65px at ${x3}% ${y3}%, oklch(0.85 0.055 ${hue}), transparent 74%),` +
    `radial-gradient(170px 120px at ${x1}% ${y1}%, oklch(0.62 0.09 ${hue}), transparent 76%),` +
    `radial-gradient(220px 160px at ${x2}% ${y2}%, oklch(0.45 0.09 ${hue}), transparent 76%)`;
  return { dark, light, hue };
}

function ActorCard({ actor, index }: { actor: Actor; index: number }) {
  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-colors hover:border-foreground/25">
      <div className="relative h-16 overflow-hidden border-b sm:h-24">
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            backgroundColor: `oklch(0.19 0.03 ${actorCover(actor.name, index).hue})`,
            backgroundImage: actorCover(actor.name, index).dark,
          }}
        />
        <div
          className="absolute inset-0 dark:hidden"
          style={{
            backgroundColor: `oklch(0.93 0.025 ${actorCover(actor.name, index).hue})`,
            backgroundImage: actorCover(actor.name, index).light,
          }}
        />
        <div className={`absolute inset-0 opacity-40 ${coverGrid}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent dark:from-black/45" />
        <span
          className="absolute -bottom-2 right-3 text-[56px] leading-none font-semibold tracking-tight select-none [mask-image:linear-gradient(to_bottom,black_45%,transparent_95%)]"
          style={{ color: "var(--cover-word)" }}
        >
          {actor.name.slice(0, 1)}
        </span>
        <div className="absolute inset-0 opacity-[0.2] mix-blend-overlay" style={grainTexture} />
      </div>
      <CardContent className="flex-1 space-y-2.5 p-4">
        <div className="space-y-1">
          <h3 className="text-[15px] font-medium tracking-tight">{actor.name}</h3>
          <p className="line-clamp-2 min-h-10 text-[12px] leading-5 text-muted-foreground [text-wrap:pretty]">
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
      <CardFooter className="items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground tabular-nums sm:text-[11px]">
        <span>参演 {actor.projectCount} 个项目</span>
        <span className="text-muted-foreground/70">
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
            {filtered?.map((actor, index) => (
              <ActorCard key={actor.id} actor={actor} index={index} />
            ))}
          </div>
        )}
      </ListBody>
    </div>
  );
}
