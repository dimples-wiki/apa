import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { coverGrid } from "@/lib/utils";

export function NotFoundPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-3 overflow-hidden">
      <div className={`absolute inset-0 opacity-50 ${coverGrid}`} />
      <span
        className="absolute -bottom-14 right-0 text-[240px] leading-none font-semibold tracking-tight select-none [mask-image:linear-gradient(to_top,black_30%,transparent_72%)]"
        style={{ color: "var(--cover-word)" }}
        aria-hidden
      >
        404
      </span>
      <p className="text-2xl font-semibold tracking-tight">页面不存在</p>
      <p className="text-[13px] text-muted-foreground">你要找的页面可能已被移动或删除</p>
      <Button asChild size="sm" className="mt-1.5">
        <Link to="/projects">返回项目列表</Link>
      </Button>
    </div>
  );
}
