import { useState } from "react";
import { Moon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Switch } from "@/components/ui/switch";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="max-w-2xl">
      <h2 className="text-[13px] font-medium tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-3 rounded-lg border bg-card">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[13px]">{label}</p>
        {hint ? <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p> : null}
      </div>
      {control}
    </div>
  );
}

export function SettingsPage() {
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));

  function toggleDark(enabled: boolean) {
    document.documentElement.classList.toggle("dark", enabled);
    setDark(enabled);
  }

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader title="系统设置" description="平台外观与基础配置" />
      <div className="flex-1 space-y-8 px-8 pb-10">
        <Section title="外观" description="界面主题与显示偏好">
          <Row
            label="深色模式"
            hint="Linear 风格的近黑界面，关闭后切换为浅色"
            control={
              <div className="flex items-center gap-2">
                <Moon className="size-3.5 text-muted-foreground" />
                <Switch checked={dark} onCheckedChange={toggleDark} />
              </div>
            }
          />
        </Section>

        <Section title="AI 服务" description="配置模型与生成服务接入">
          <Row
            label="生成模型"
            hint="用于剧本、形象与场景生成"
            control={<span className="text-[12px] text-muted-foreground">未接入</span>}
          />
          <Row
            label="API Key"
            hint="访问密钥，仅保存在本地"
            control={<span className="text-[12px] text-muted-foreground">未设置</span>}
          />
        </Section>

        <Section title="关于">
          <Row
            label="版本"
            control={<span className="text-[12px] tabular-nums text-muted-foreground">0.0.0</span>}
          />
          <Row
            label="数据存储"
            control={
              <span className="text-[12px] text-muted-foreground">本地内存（开发阶段）</span>
            }
          />
        </Section>
      </div>
    </div>
  );
}
