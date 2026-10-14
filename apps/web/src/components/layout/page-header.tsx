import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  flush = false,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** 用于已自带横向边距的居中容器内 */
  flush?: boolean;
}) {
  return (
    <header
      className={
        flush
          ? "flex items-center justify-between gap-3 pt-5 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pt-7"
          : "flex items-center justify-between gap-3 px-4 pt-5 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-8 sm:pt-7"
      }
    >
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
        {description ? (
          <p className="mt-1 hidden text-[13px] text-muted-foreground sm:block">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
