import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { ArrowLeft, Check, Copy, Film, Loader2, Plus, Upload } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AssetItem {
  file: string;
  category: string;
  size: number;
  updatedAt: string;
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: "character", label: "角色" },
  { key: "scene", label: "场景" },
  { key: "prop", label: "道具" },
  { key: "image", label: "图片" },
  { key: "audio", label: "音频" },
  { key: "video", label: "视频" },
];

/** 制作界面：左侧素材分类栏 + 主体内嵌 OpenFilm Studio（agent/人在 Studio 里写片） */
export function FilmStudioPage() {
  const { name = "" } = useParams<{ name: string }>();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [category, setCategory] = useState("character");
  const [studioUrl, setStudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [studioLoading, setStudioLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reloadAssets = useCallback(() => {
    fetch(`/api/films/${encodeURIComponent(name)}/assets`)
      .then((r) => r.json())
      .then((d) => setAssets(d.assets ?? []))
      .catch(() => undefined);
  }, [name]);

  // 拉起/获取 Studio 地址
  useEffect(() => {
    setLoading(true);
    fetch("/api/films/open", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    })
      .then((r) => r.json())
      .then((d) => setStudioUrl(d.studioUrl ?? null))
      .catch(() => setStudioUrl(null))
      .finally(() => setLoading(false));
  }, [name]);

  useEffect(reloadAssets, [reloadAssets, name]);

  function copyPath(file: string) {
    void navigator.clipboard.writeText(file);
    setCopied(file);
    setTimeout(() => setCopied(null), 1500);
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f);
      await fetch(`/api/films/${encodeURIComponent(name)}/assets?category=${category}`, {
        method: "POST",
        body: fd,
      });
    }
    setUploading(false);
    reloadAssets();
  }

  const shown = assets.filter((a) => a.category === category);
  const frameSrc = studioUrl
    ? studioUrl.replace(/([?&])to=/, "$1to=") + (studioUrl.includes("?") ? "&" : "?") + "apa=1"
    : null;

  return (
    <div className="flex h-svh flex-col bg-background">
      {/* 顶栏 */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <Button variant="ghost" size="icon" className="size-8" asChild>
          <Link to="/films" aria-label="返回影片库">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <Film className="size-4 text-muted-foreground" />
        <span className="text-[13px] font-medium">{decodeURIComponent(name)}</span>
        <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
          OpenFilm Studio
        </span>
        <div className="ml-auto flex items-center gap-2">
          {studioUrl ? (
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[11px]" asChild>
              <a href={studioUrl} target="_blank" rel="noreferrer">
                独立窗口打开
              </a>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ── 素材分类栏 ── */}
        <aside className="flex w-64 shrink-0 flex-col border-r">
          <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
            <Plus className="size-3.5 text-muted-foreground" />
            <span className="text-[12px] font-medium text-muted-foreground">素材库</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 gap-1 px-1.5 text-[11px]"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
              上传
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* 分类 tabs */}
          <div className="flex flex-wrap gap-1 border-b p-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] transition-colors",
                  category === c.key
                    ? "border-foreground/40 bg-foreground/[0.08] font-medium text-foreground"
                    : "text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                )}
              >
                {c.label}
                <span className="ml-1 tabular-nums opacity-60">
                  {assets.filter((a) => a.category === c.key).length}
                </span>
              </button>
            ))}
          </div>

          {/* 素材列表 */}
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {shown.length === 0 ? (
              <p className="px-2 py-6 text-center text-[11px] leading-4 text-muted-foreground/70">
                该分类还没有素材——点「上传」入库，点击条目复制相对路径，粘贴进 film.html
              </p>
            ) : (
              shown.map((a) => (
                <button
                  key={a.file}
                  type="button"
                  onClick={() => copyPath(a.file)}
                  className="group mb-1 flex w-full items-center gap-2 rounded-md border border-transparent p-1.5 text-left transition-colors hover:border-foreground/20 hover:bg-foreground/[0.04]"
                  title={`点击复制：${a.file}`}
                >
                  {/\.(png|jpe?g|webp|gif)$/i.test(a.file) ? (
                    <img
                      src={`/api/films/${encodeURIComponent(name)}/asset-file/${a.file}`}
                      alt=""
                      className="size-9 shrink-0 rounded border object-cover"
                    />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded border bg-muted/40 text-[9px] uppercase text-muted-foreground">
                      {a.file.split(".").pop()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px]">{a.file.split("/").pop()}</span>
                    <span className="block text-[10px] tabular-nums text-muted-foreground/60">
                      {(a.size / 1024).toFixed(0)} KB
                    </span>
                  </span>
                  {copied === a.file ? (
                    <Check className="size-3 shrink-0 text-emerald-400" />
                  ) : (
                    <Copy className="size-3 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                  )}
                </button>
              ))
            )}
          </div>

          <p className="shrink-0 border-t p-2.5 text-[10px] leading-4 text-muted-foreground/60">
            素材存于项目 <code className="text-foreground/70">assets/</code> 下按分类子目录——OpenFilm
            的素材面板同样可见，film.html 里用相对路径引用。
          </p>
        </aside>

        {/* ── 主体：内嵌 OpenFilm Studio ── */}
        <main className="relative min-w-0 flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              正在启动 OpenFilm Studio…
            </div>
          ) : frameSrc ? (
            <>
              {studioLoading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background text-[13px] text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  OpenFilm Studio 载入中…
                </div>
              ) : null}
              <iframe
                src={frameSrc}
                title="OpenFilm Studio"
                className="h-full w-full border-0"
                onLoad={() => setStudioLoading(false)}
                allow="clipboard-write"
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Film className="size-8 opacity-50" />
              <p className="text-[13px]">Studio 启动失败——回到影片库重试「启动 Studio」</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default FilmStudioPage;
