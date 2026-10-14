import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { APP_VERSION } from "@filmstudio/shared";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-3xl">
      <h2 className="text-[13px] font-medium tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-3 rounded-lg border bg-card">{children}</div>
    </section>
  );
}

function Row({ label, hint, control }: { label: string; hint?: string; control?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-[13px]">{label}</p>
        {hint ? <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p> : null}
      </div>
      {control}
    </div>
  );
}

function ValueLink({ value, tone = "idle" }: { value: string; tone?: "idle" | "off" }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
      <span
        className={`size-1.5 rounded-full ${tone === "off" ? "bg-zinc-400/70 dark:bg-zinc-500/70" : "bg-amber-400 dark:bg-amber-500/80"}`}
      />
      {value}
      <ChevronRight className="size-3.5" />
    </span>
  );
}

const themeOptions: { key: Theme; label: string }[] = [
  { key: "light", label: "浅色" },
  { key: "dark", label: "深色" },
  { key: "system", label: "跟随系统" },
];

export function SettingsPage() {
  const [theme, setThemeState] = useState<Theme>(getTheme);

  function changeTheme(next: Theme) {
    setTheme(next);
    setThemeState(next);
  }

  return (
    <div className="flex min-h-svh flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pb-10 sm:px-8">
        <PageHeader flush title="系统设置" description="平台外观与基础配置" />
        <div className="space-y-8">
          <Section title="外观" description="界面主题与显示偏好">
            <Row
              label="主题"
              hint="深色、浅色或跟随系统自动切换"
              control={
                <div className="flex shrink-0 items-center gap-0.5 rounded-md border bg-foreground/5 p-0.5">
                  {themeOptions.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => changeTheme(opt.key)}
                      className={cn(
                        "h-6.5 rounded-sm px-2.5 text-[12px] transition-colors",
                        theme === opt.key
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              }
            />
          </Section>

          <Section title="AI 服务" description="配置模型与生成服务接入">
            <Row
              label="生成模型"
              hint="用于剧本、形象与场景生成"
              control={<ValueLink value="未接入" tone="off" />}
            />
            <Row
              label="API Key"
              hint="访问密钥，仅保存在本机"
              control={<ValueLink value="未设置" tone="off" />}
            />
          </Section>

          <Section title="关于">
            <Row
              label="版本"
              control={
                <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                  {APP_VERSION}
                </span>
              }
            />
            <Row label="数据存储" control={<ValueLink value="本机存储" tone="off" />} />
          </Section>
        </div>
      </div>
    </div>
  );
}
