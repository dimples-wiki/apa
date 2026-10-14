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
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

const coverGrid =
  "[background-image:linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] [background-size:24px_24px]";

function SceneCard({ scene }: { scene: Scene }) {
  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-colors hover:border-foreground/25">
      <CardHeader className="relative h-16 border-b p-3">
        <div className={`absolute inset-0 ${coverGrid}`} />
        <span className="absolute right-2 bottom-0 text-4xl font-semibold tracking-tight text-foreground/[0.06] select-none">
          {scene.name.slice(0, 1)}
        </span>
        <span className="relative w-fit rounded border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {scene.timeOfDay}
        </span>
      </CardHeader>
      <CardContent className="space-y-1.5 p-4">
        <h3 className="truncate text-[15px] font-medium tracking-tight">{scene.name}</h3>
        <p className="line-clamp-2 min-h-10 text-[12px] leading-5 text-muted-foreground">
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
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" />
            新建场景
          </Button>
        }
      />
      <ListToolbar
        placeholder="搜索场景…"
        unit="个场景"
        count={error || loading ? null : (filtered?.length ?? 0)}
        query={query}
        onQueryChange={setQuery}
      />
      <ListBody>
        {loading ? (
          <CardGridSkeleton variant="scene" count={4} />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered?.map((scene) => (
              <SceneCard key={scene.id} scene={scene} />
            ))}
          </div>
        )}
      </ListBody>
    </div>
  );
}
