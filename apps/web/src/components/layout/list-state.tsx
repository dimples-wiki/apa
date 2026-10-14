import { AlertTriangle, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/** 列表页工具栏：搜索 + 右侧计数 */
export function ListToolbar({
  placeholder,
  unit,
  count,
  query,
  onQueryChange,
}: {
  placeholder: string;
  unit: string;
  /** 加载失败或尚无数据时传 null，隐藏计数 */
  count: number | null;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-8 pb-5">
      <div className="relative w-60">
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 rounded-md bg-card pl-8 text-[13px]"
        />
      </div>
      {count !== null ? (
        <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">
          {count} {unit}
        </span>
      ) : null}
    </div>
  );
}

/** 各资源卡片骨架：几何与真实卡片一致，避免加载完成跳变 */
export function CardSkeleton({ variant }: { variant: "project" | "actor" | "scene" | "costume" }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {variant === "project" ? (
        <div className="relative h-24 border-b bg-foreground/[0.04]">
          <Skeleton className="absolute top-3 left-4 h-5 w-16 rounded-md" />
        </div>
      ) : variant === "actor" ? null : (
        <div className="relative h-16 border-b bg-foreground/[0.04]">
          <Skeleton className="absolute top-2.5 right-3 h-4 w-10 rounded-md" />
        </div>
      )}
      <CardContent className="space-y-2.5 p-4">
        {variant === "actor" ? <Skeleton className="size-14 rounded-lg" /> : null}
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/5" />
        {variant === "actor" ? (
          <div className="flex gap-1 pt-1">
            <Skeleton className="h-5 w-10 rounded" />
            <Skeleton className="h-5 w-10 rounded" />
          </div>
        ) : null}
      </CardContent>
      <div className="border-t px-4 py-3">
        <Skeleton className="h-3 w-24" />
      </div>
    </Card>
  );
}

export function CardGridSkeleton({
  variant,
  count = 6,
}: {
  variant: "project" | "actor" | "scene" | "costume";
  count?: number;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} variant={variant} />
      ))}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-card py-20 text-center">
      <div className="flex size-9 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-4 text-destructive" />
      </div>
      <div>
        <p className="text-[14px] font-medium">无法连接服务</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">请确认后端服务已启动，然后重试</p>
      </div>
      {onRetry ? (
        <Button size="sm" className="mt-1" onClick={onRetry}>
          重试
        </Button>
      ) : null}
    </div>
  );
}

/** 列表网格容器 */
export function ListBody({ children }: { children: ReactNode }) {
  return <div className="flex-1 px-8 pb-8">{children}</div>;
}
