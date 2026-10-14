import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3">
      <p className="text-[15px] font-semibold">页面不存在</p>
      <p className="text-[13px] text-muted-foreground">你要找的页面可能已被移动或删除</p>
      <Button asChild size="sm" variant="outline" className="mt-1">
        <Link to="/projects">返回项目列表</Link>
      </Button>
    </div>
  );
}
