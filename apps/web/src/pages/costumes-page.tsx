import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { Costume } from "@filmstudio/shared";
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

function CostumeCard({ costume }: { costume: Costume }) {
  return (
    <Card className="group gap-0 overflow-hidden py-0 transition-colors hover:border-foreground/25">
      <CardHeader className="relative h-16 border-b p-3">
        <div className={`absolute inset-0 ${coverGrid}`} />
        <span className="absolute right-2 bottom-0 text-4xl font-semibold tracking-tight text-foreground/[0.06] select-none">
          {costume.name.slice(0, 1)}
        </span>
        <span className="relative w-fit rounded border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {costume.era}
        </span>
      </CardHeader>
      <CardContent className="space-y-1.5 p-4">
        <h3 className="truncate text-[15px] font-medium tracking-tight">{costume.name}</h3>
        <p className="line-clamp-2 min-h-10 text-[12px] leading-5 text-muted-foreground">
          {costume.description}
        </p>
      </CardContent>
      <CardFooter className="border-t px-4 py-2.5 text-[11px] text-muted-foreground">
        {costume.tags.join(" · ")}
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
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" />
            新建服饰
          </Button>
        }
      />
      <ListToolbar
        placeholder="搜索服饰…"
        unit="套服饰"
        count={error || loading ? null : (filtered?.length ?? 0)}
        query={query}
        onQueryChange={setQuery}
      />
      <ListBody>
        {loading ? (
          <CardGridSkeleton variant="costume" count={4} />
        ) : error ? (
          <ErrorState onRetry={reload} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered?.map((costume) => (
              <CostumeCard key={costume.id} costume={costume} />
            ))}
          </div>
        )}
      </ListBody>
    </div>
  );
}
