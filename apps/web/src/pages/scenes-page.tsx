import { MapPin, Plus, Sun, Moon, Sunset } from "lucide-react";
import type { Scene } from "@filmstudio/shared";
import { PageHeader } from "@/components/layout/page-header";
import { CardGridSkeleton, ErrorState } from "@/components/layout/list-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

function timeIcon(timeOfDay: string) {
  if (timeOfDay.includes("夜")) return Moon;
  if (timeOfDay.includes("黄昏") || timeOfDay.includes("晨")) return Sunset;
  if (timeOfDay.includes("日")) return Sun;
  return Sun;
}

function SceneCard({ scene }: { scene: Scene }) {
  const TimeIcon = timeIcon(scene.timeOfDay);

  return (
    <Card className="gap-3 py-4 transition-colors hover:border-foreground/15">
      <CardContent className="space-y-3 px-4">
        <div className="flex items-start justify-between">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <MapPin className="size-4.5" />
          </div>
          <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground">
            <TimeIcon className="size-3" />
            {scene.timeOfDay}
          </span>
        </div>
        <div className="space-y-1">
          <h3 className="text-[14px] font-medium tracking-tight">{scene.name}</h3>
          <p className="line-clamp-2 min-h-10 text-[12px] leading-5 text-muted-foreground">
            {scene.description}
          </p>
        </div>
      </CardContent>
      <CardFooter className="items-center justify-between gap-2 border-t px-4 pt-3 text-[11px] text-muted-foreground">
        <span className="truncate">{scene.projectName}</span>
        <span className="shrink-0">{scene.tags.join(" · ")}</span>
      </CardFooter>
    </Card>
  );
}

export function ScenesPage() {
  const { data, error, loading } = useApi(api.scenes);

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
      <div className="flex-1 px-8 pb-8">
        {loading ? (
          <CardGridSkeleton count={8} />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.map((scene) => (
              <SceneCard key={scene.id} scene={scene} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
