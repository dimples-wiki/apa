import { Plus, UserRound } from "lucide-react";
import type { Actor } from "@filmstudio/shared";
import { PageHeader } from "@/components/layout/page-header";
import { CardGridSkeleton, ErrorState } from "@/components/layout/list-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

const accentStyles: Record<string, string> = {
  indigo: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300",
  cyan: "bg-cyan-500/15 text-cyan-700 ring-cyan-500/25 dark:text-cyan-300",
  amber: "bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  rose: "bg-rose-500/15 text-rose-700 ring-rose-500/25 dark:text-rose-300",
  emerald: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  violet: "bg-violet-500/15 text-violet-700 ring-violet-500/25 dark:text-violet-300",
};

function ActorCard({ actor }: { actor: Actor }) {
  const accent = accentStyles[actor.accent] ?? accentStyles.indigo;

  return (
    <Card className="gap-3 py-4 transition-colors hover:border-foreground/15">
      <CardContent className="space-y-3 px-4">
        <div className={`flex size-14 items-center justify-center rounded-lg ring-1 ${accent}`}>
          <span className="text-lg font-medium">{actor.name.slice(0, 1)}</span>
        </div>
        <div className="space-y-1">
          <h3 className="text-[14px] font-medium tracking-tight">{actor.name}</h3>
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
      <CardFooter className="border-t px-4 pt-3 text-[11px] text-muted-foreground">
        <UserRound className="mr-1 size-3" />
        参演 {actor.projectCount} 个项目
      </CardFooter>
    </Card>
  );
}

export function ActorsPage() {
  const { data, error, loading } = useApi(api.actors);

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
      <div className="flex-1 px-8 pb-8">
        {loading ? (
          <CardGridSkeleton count={8} />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.map((actor) => (
              <ActorCard key={actor.id} actor={actor} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
