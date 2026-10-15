import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 卡头网格纹理（1px 网格线 + 24px 间距，颜色随主题变量） */
export const coverGrid =
  "[background-image:linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] [background-size:24px_24px]";

/** 细噪点纹理（叠加在生成式头图上，消除渐变色带、增加胶片颗粒感） */
export const grainTexture = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
  backgroundSize: "120px 120px",
};

/** 黄金角派生色相（跳过低饱和土棕区，保证任意序号色相都可用作品牌底色） */
export function hueOf(seed: number): number {
  let hue = Math.round((seed * 137.508) % 360);
  if (hue > 20 && hue < 75) hue = (hue + 45) % 360;
  return hue;
}

/** 场景时段 → 语义色相 */
export function sceneHue(timeOfDay: string, index = 0): number {
  const base = timeOfDay.includes("夜")
    ? 250
    : timeOfDay.includes("无自然光")
      ? 185
      : timeOfDay.includes("黄昏") || timeOfDay.includes("晨")
        ? 30
        : 100;
  return (base + ((index % 3) - 1) * 8 + 360) % 360;
}

/** 服饰/演员按名字派生（跳土棕区） */
export function actorHueOf(name: string): number {
  return hueOf(name.codePointAt(0) ?? 0);
}

/** 拼接部署 base 前缀的静态资源地址（GitHub Pages 子路径部署兼容） */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
