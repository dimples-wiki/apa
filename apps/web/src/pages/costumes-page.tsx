import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Costume } from "@dimples/apa-shared";
import { PageHeader } from "@/components/layout/page-header";
import {
  CardGridSkeleton,
  ErrorState,
  ListBody,
  ListToolbar,
} from "@/components/layout/list-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { coverGrid, grainTexture } from "@/lib/utils";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

function CostumeCard({ costume, index }: { costume: Costume; index: number }) {
  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-colors hover:border-foreground/25">
      <CardHeader className="relative h-14 overflow-hidden border-b p-3 sm:h-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: `oklch(0.9 0.03 ${Math.round((index * 137.508) % 360)})`,
          }}
        />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            backgroundColor: `oklch(0.16 0.03 ${Math.round((index * 137.508) % 360)})`,
            backgroundImage: `radial-gradient(160px 90px at 75% 110%, oklch(0.45 0.08 ${Math.round((index * 137.508) % 360)}), transparent 75%)`,
          }}
        />
        <div className={`absolute inset-0 ${coverGrid}`} />
        <div className="absolute inset-0 opacity-[0.12] mix-blend-overlay" style={grainTexture} />
        <span
          className="absolute -bottom-1 right-3 text-[36px] sm:text-[48px] leading-none font-semibold tracking-tight select-none [mask-image:linear-gradient(to_bottom,black_45%,transparent_95%)]"
          style={{ color: "var(--cover-word)" }}
        >
          {costume.era.startsWith(costume.name.slice(0, 1))
            ? costume.name.replace(/\s/g, "").slice(1, 2)
            : costume.name.slice(0, 1)}
        </span>
        <span className="absolute top-2.5 left-3 rounded border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground backdrop-blur-sm">
          {costume.era}
        </span>
      </CardHeader>
      <CardContent className="space-y-1.5 p-4">
        <h3 className="truncate text-[15px] font-medium tracking-tight">{costume.name}</h3>
        <p className="line-clamp-2 min-h-10 text-[12px] leading-5 text-muted-foreground [text-wrap:pretty]">
          {costume.description}
        </p>
      </CardContent>
      <CardFooter className="items-center justify-between border-t px-4 py-2.5 text-xs text-muted-foreground sm:text-[11px]">
        <span className="truncate">{costume.tags.join(" · ")}</span>
        <span className="shrink-0 text-muted-foreground/70 tabular-nums">
          {new Date(costume.createdAt).toLocaleDateString("zh-CN", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </CardFooter>
    </Card>
  );
}

export function CostumesPage() {
  const { data, error, loading, reload } = useApi(api.costumes);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!data) return null;
    if (!q) return data;
    return data.filter((c) => (c.name + c.description + c.tags.join()).includes(q));
  }, [data, query]);

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="服饰"
        description="角色服饰与造型设定库"
        actions={
          <Button size="sm" className="gap-1.5" disabled={Boolean(error)}>
            <Plus className="size-3.5" />
            新建服饰
          </Button>
        }
      />
      {!error && (
        <ListToolbar
          placeholder="搜索服饰…"
          unit="套服饰"
          count={error || loading ? null : (filtered?.length ?? 0)}
          countHidden={Boolean(error)}
          query={query}
          onQueryChange={setQuery}
        />
      )}
      <ListBody>
        {loading ? (
          <CardGridSkeleton
            variant="costume"
            count={4}
            cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <div className={"grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"}>
            {filtered?.map((costume, index) => (
              <CostumeCard key={costume.id} costume={costume} index={index} />
            ))}
          </div>
        )}
      </ListBody>
    </div>
  );
}
