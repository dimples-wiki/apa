import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Film, Loader2, Plus, RefreshCcw } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { ListBody } from "@/components/layout/list-state";
import { cn, timeAgo } from "@/lib/utils";

interface FilmInfo {
  name: string;
  dir: string;
  hasFilm: boolean;
  assetCount: number;
  updatedAt: string;
  studioUrl: string | null;
  running: boolean;
}

/** 影片库：前置项目管理页（每部片 = 一个 OpenFilm 项目文件夹） */
export function FilmsPage() {
  const [films, setFilms] = useState<FilmInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    fetch("/api/films")
      .then((r) => r.json())
      .then((d) => setFilms(d.films ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload]);

  async function create() {
    const n = name.trim();
    if (!n) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/films/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body?.error ?? "创建失败");
      setName("");
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col">
      <PageHeader
        title="影片库"
        description="每部片是一个 OpenFilm 项目文件夹——打开即进入 OpenFilm Studio 制作"
        actions={
          <Button size="sm" variant="outline" className="gap-1.5" onClick={reload}>
            <RefreshCcw className="size-3.5" />
            刷新
          </Button>
        }
      />
      <ListBody>
        {/* 新建 */}
        <div className="mx-auto w-full max-w-3xl px-6">
          <div className="flex items-center gap-2">
            <Film className="size-4 text-muted-foreground" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="新片名（如：雾岛来电）——回车创建并打开 Studio"
              className="h-10 flex-1 text-[13px]"
            />
            <Button size="sm" className="h-10 gap-1.5" onClick={create} disabled={creating || !name.trim()}>
              {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              新建影片
            </Button>
          </div>
          {error ? <p className="mt-2 text-[12px] text-red-400">{error}</p> : null}
        </div>

        {/* 列表 */}
        <div className="mx-auto grid w-full max-w-3xl gap-3 px-6 pt-6 sm:grid-cols-2">
          {loading ? (
            <div className="col-span-2 flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> 扫描影片库…
            </div>
          ) : films.length === 0 ? (
            <div className="col-span-2 flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Film className="size-8 opacity-50" />
              <p className="text-[13px]">还没有影片——上面输入片名创建第一部</p>
            </div>
          ) : (
            films.map((f) => (
              <FilmCard key={f.name} film={f} onChanged={reload} />
            ))
          )}
        </div>
      </ListBody>
    </div>
  );
}

function FilmCard({ film, onChanged }: { film: FilmInfo; onChanged: () => void }) {
  const [opening, setOpening] = useState(false);
  const open = useCallback(async () => {
    setOpening(true);
    try {
      await fetch("/api/films/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: film.name }),
      });
    } finally {
      setOpening(false);
      onChanged();
    }
  }, [film.name, onChanged]);

  return (
    <Link
      to={`/studio/${encodeURIComponent(film.name)}`}
      className={cn(
        "group flex flex-col rounded-xl border p-4 transition-colors hover:border-foreground/25",
        film.running && "border-emerald-500/30",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-lg border bg-muted/40">
          <Film className="size-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-medium">{film.name}</h3>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {film.assetCount} 素材 · {timeAgo(film.updatedAt)}
          </p>
        </div>
        {film.running ? (
          <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Studio 运行中
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-[11px]"
          onClick={(e) => {
            e.preventDefault();
            void open();
          }}
        >
          {opening ? <Loader2 className="size-3 animate-spin" /> : <ExternalLink className="size-3" />}
          启动 Studio
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground/60 group-hover:text-foreground">
          进入制作 →
        </span>
      </div>
    </Link>
  );
}

export default FilmsPage;
