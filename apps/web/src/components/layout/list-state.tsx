import { AlertTriangle, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { coverGrid } from "@/lib/utils";
import { cn } from "@/lib/utils";

/** 列表页工具栏：搜索 + 右侧计数 */
export function ListToolbar({
  placeholder,
  unit,
  count,
  countHidden = false,
  query,
  onQueryChange,
  children,
}: {
  placeholder: string;
  unit: string;
  /** null = 加载中（显示骨架占位）；undefined 由调用方用 hiddenCount 控制 */
  count: number | null;
  /** 错误态彻底隐藏计数位 */
  countHidden?: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-8 pb-5">
      <div className="relative w-72">
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          disabled={countHidden}
          className="h-8 rounded-md bg-card pr-8 pl-8 text-[13px]"
        />
        {!countHidden ? (
          <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border bg-muted px-1 font-sans text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        ) : null}
      </div>
      {children ? <div className="ml-auto">{children}</div> : null}
      {countHidden ? null : count !== null ? (
        <span className="ml-auto text-[12px] tabular-nums text-muted-foreground">
          {count} {unit}
        </span>
      ) : count !== undefined && !children ? (
        <Skeleton className="ml-auto h-3.5 w-14" />
      ) : null}
    </div>
  );
}

/** 各资源卡片骨架：与真实卡片逐块对应，避免加载完成跳变 */
export function CardSkeleton({ variant }: { variant: "project" | "actor" | "scene" | "costume" }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="relative h-24 border-b bg-foreground/[0.05]">
        {variant === "project" ? (
          <Skeleton className="absolute top-3 left-4 h-5 w-16 rounded-md" />
        ) : (
          <Skeleton className="absolute top-3 right-3 h-3.5 w-12 rounded" />
        )}
      </div>
      <CardContent className="space-y-2.5 p-4">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/5" />
        {variant === "actor" ? (
          <div className="flex gap-1 pt-0.5">
            <Skeleton className="h-3 w-14" />
          </div>
        ) : null}
      </CardContent>
      <div className="flex items-center gap-2.5 border-t px-4 py-3">
        {variant === "project" ? (
          <>
            <Skeleton className="h-1.5 min-w-0 flex-1" />
            <Skeleton className="h-3 w-7" />
          </>
        ) : (
          <Skeleton className="h-3 w-24" />
        )}
        <Skeleton className="ml-auto h-3 w-12" />
      </div>
    </Card>
  );
}

export function CardGridSkeleton({
  variant,
  count = 6,
  cols = "md:grid-cols-2 xl:grid-cols-3",
}: {
  variant: "project" | "actor" | "scene" | "costume";
  count?: number;
  cols?: string;
}) {
  return (
    <div className={cn("grid gap-4", cols)}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} variant={variant} />
      ))}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center py-4">
      <div className="relative flex w-full max-w-xl flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border bg-card py-14 text-center shadow-xs">
        <div className={`absolute inset-0 opacity-60 ${coverGrid}`} />
        <span
          className="absolute -top-4 right-4 text-[120px] leading-none font-semibold tracking-tight select-none [mask-image:linear-gradient(200deg,black_60%,transparent_80%)]"
          style={{ color: "var(--cover-word)" }}
          aria-hidden
        >
          !
        </span>
        <div className="relative flex size-9 items-center justify-center rounded-full bg-destructive/15">
          <AlertTriangle className="size-4 text-destructive" />
        </div>
        <div className="relative">
          <p className="text-[14px] font-medium">无法连接服务</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">网络连接异常，请检查后重试</p>
        </div>
        {onRetry ? (
          <Button size="sm" className="relative mt-1" onClick={onRetry}>
            重试
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** 列表网格容器 */
export function ListBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col px-8 pb-8">{children}</div>;
}
