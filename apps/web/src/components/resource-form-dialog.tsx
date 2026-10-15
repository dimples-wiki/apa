import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TagInput } from "@/components/tag-input";

export type FormField =
  | {
      kind: "text";
      name: string;
      label: string;
      placeholder?: string;
      required?: boolean;
      /** 输入建议（datalist，不限制自由输入） */
      suggestions?: string[];
    }
  | { kind: "textarea"; name: string; label: string; placeholder?: string; rows?: number }
  | {
      kind: "select";
      name: string;
      label: string;
      options: { value: string; label: string }[];
      /** 空值选项文案（默认预选第一个，允许空时提供“未关联”等占位） */
      emptyLabel?: string;
    }
  | { kind: "tags"; name: string; label: string; placeholder?: string };

export type FormValues = Record<string, string | string[]>;

function defaultsFor(fields: FormField[]): FormValues {
  const v: FormValues = {};
  for (const f of fields)
    v[f.name] = f.kind === "tags" ? [] : f.kind === "select" ? (f.options[0]?.value ?? "") : "";
  return v;
}

export function ResourceFormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  submitLabel,
  submitting = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  fields: FormField[];
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: FormValues) => void | Promise<void>;
}) {
  const [values, setValues] = useState<FormValues>(() => defaultsFor(fields));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues(defaultsFor(fields));
      setError(null);
    }
    // fields 为页面级常量，无需纳入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function set(name: string, value: string | string[]) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function handleSubmit() {
    const missing = fields.find(
      (f) =>
        f.kind === "text" && "required" in f && f.required && !String(values[f.name] ?? "").trim(),
    );
    if (missing) {
      setError(`请填写「${missing.label}」`);
      return;
    }
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch {
      setError("提交失败，请稍后重试");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto text-left sm:max-w-lg sm:text-left"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="grid gap-4 py-1">
          {fields.map((f) => (
            <div key={f.name} className="grid gap-2">
              <Label htmlFor={`ff-${f.name}`}>
                {f.label}
                {f.kind === "text" && "required" in f && f.required ? (
                  <span className="-ml-1 text-destructive">*</span>
                ) : null}
              </Label>
              {f.kind === "text" ? (
                <div className="relative">
                  <Input
                    id={`ff-${f.name}`}
                    value={String(values[f.name] ?? "")}
                    onChange={(e) => set(f.name, e.target.value)}
                    placeholder={"placeholder" in f ? f.placeholder : undefined}
                    className="h-9 pr-8"
                    list={"suggestions" in f && f.suggestions ? `ff-sug-${f.name}` : undefined}
                  />
                  {"suggestions" in f && f.suggestions ? (
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  ) : null}
                  {"suggestions" in f && f.suggestions ? (
                    <datalist id={`ff-sug-${f.name}`}>
                      {(f.suggestions as string[]).map((sug) => (
                        <option key={sug} value={sug} />
                      ))}
                    </datalist>
                  ) : null}
                </div>
              ) : f.kind === "textarea" ? (
                <Textarea
                  id={`ff-${f.name}`}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={"placeholder" in f ? f.placeholder : undefined}
                  rows={"rows" in f ? f.rows : 3}
                  className="resize-none"
                />
              ) : f.kind === "select" ? (
                <Select
                  value={String(values[f.name] ?? "")}
                  onValueChange={(v) => set(f.name, v === "__empty" ? "" : v)}
                >
                  <SelectTrigger id={`ff-${f.name}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {"emptyLabel" in f && f.emptyLabel ? (
                      <SelectItem value="__empty">{f.emptyLabel}</SelectItem>
                    ) : null}
                    {f.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <TagInput
                  value={(values[f.name] as string[]) ?? []}
                  onChange={(tags) => set(f.name, tags)}
                  placeholder={"placeholder" in f ? f.placeholder : undefined}
                />
              )}
            </div>
          ))}
        </div>

        {error ? <p className="text-[12px] text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2 sm:items-center">
          <span className="mr-auto hidden text-[11px] text-muted-foreground sm:inline">
            <kbd className="rounded border bg-muted px-1 font-sans">⌘ ↵</kbd> 提交 ·{" "}
            <kbd className="rounded border bg-muted px-1 font-sans">ESC</kbd> 关闭
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "提交中…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 从表单值提取文本字段 */
export function text(values: FormValues, name: string): string {
  return String(values[name] ?? "").trim();
}

/** 从表单值提取标签数组 */
export function tagList(values: FormValues, name: string): string[] {
  return (values[name] as string[]) ?? [];
}

/** 表单区块容器（移动端全宽、桌面居中窄栏统一用） */
export function FieldGroup({ children }: { children: ReactNode }) {
  return <div className="grid gap-4">{children}</div>;
}
