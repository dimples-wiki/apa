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
          ? "flex flex-col gap-3 pt-6 pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pt-7"
          : "flex flex-col gap-3 px-4 pt-6 pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-8 sm:pt-7"
      }
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
