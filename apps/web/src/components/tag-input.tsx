import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** 标签输入：输入 + Enter/逗号 添加为 chip，点 × 或 Backspace 删除 */
export function TagInput({
  value,
  onChange,
  placeholder,
  max = 8,
  className,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  max?: number;
  className?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const tag = raw.trim().replace(/[,，]$/, "");
    if (!tag || value.includes(tag) || value.length >= max) return;
    onChange([...value, tag]);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
      setDraft("");
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2.5 py-1.5 text-sm focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[11px] text-foreground"
        >
          {tag}
          <button
            type="button"
            aria-label={`移除 ${tag}`}
            className="text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => onChange(value.filter((t) => t !== tag))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          commit(draft);
          setDraft("");
        }}
        placeholder={value.length ? "" : placeholder}
        className="h-6 min-w-16 flex-1 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
