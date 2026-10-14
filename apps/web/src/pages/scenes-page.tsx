import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Scene } from "@filmstudio/shared";
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
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

function SceneCard({ scene, index }: { scene: Scene; index: number }) {
  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-colors hover:border-foreground/25">
      <CardHeader className="relative h-20 overflow-hidden border-b p-3">
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
          className="absolute -bottom-1.5 right-3 text-[48px] leading-none font-semibold tracking-tight select-none [mask-image:linear-gradient(to_bottom,black_45%,transparent_95%)]"
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
      <CardFooter className="items-center justify-between gap-2 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="truncate">{scene.projectName}</span>
        <span className="shrink-0">{scene.tags.join(" · ")}</span>
      </CardFooter>
    </Card>
  );
}

export function ScenesPage() {
  const { data, error, loading, reload } = useApi(api.scenes);
  const [query, setQuery] = useState("");

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
          <Button size="sm" className="gap-1.5" disabled={Boolean(error)}>
            <Plus className="size-3.5" />
            新建场景
          </Button>
        }
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
