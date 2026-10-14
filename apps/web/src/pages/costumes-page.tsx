import { Plus, Shirt } from "lucide-react";
import type { Costume } from "@filmstudio/shared";
import { PageHeader } from "@/components/layout/page-header";
import { CardGridSkeleton, ErrorState } from "@/components/layout/list-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

function CostumeCard({ costume }: { costume: Costume }) {
  return (
    <Card className="gap-3 py-4 transition-colors hover:border-foreground/15">
      <CardContent className="space-y-3 px-4">
        <div className="flex items-start justify-between">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Shirt className="size-4.5" />
          </div>
          <span className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {costume.era}
          </span>
        </div>
        <div className="space-y-1">
          <h3 className="text-[14px] font-medium tracking-tight">{costume.name}</h3>
          <p className="line-clamp-2 min-h-10 text-[12px] leading-5 text-muted-foreground">
            {costume.description}
          </p>
        </div>
      </CardContent>
      <CardFooter className="border-t px-4 pt-3 text-[11px] text-muted-foreground">
        {costume.tags.join(" · ")}
      </CardFooter>
    </Card>
  );
}

export function CostumesPage() {
  const { data, error, loading } = useApi(api.costumes);

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
      <div className="flex-1 px-8 pb-8">
        {loading ? (
          <CardGridSkeleton count={8} />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.map((costume) => (
              <CostumeCard key={costume.id} costume={costume} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
