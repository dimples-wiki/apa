import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3">
      <span className="rounded-md border bg-muted px-2 py-0.5 text-[11px] font-medium tracking-widest text-muted-foreground">
        404
      </span>
      <p className="text-2xl font-semibold tracking-tight">页面不存在</p>
      <p className="text-[13px] text-muted-foreground">你要找的页面可能已被移动或删除</p>
      <Button asChild size="sm" variant="outline" className="mt-1.5">
        <Link to="/projects">返回项目列表</Link>
      </Button>
    </div>
  );
}
