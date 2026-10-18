/** UI 执行器：webmcp 工具与 WS 桥共用的页面级交互实现。定位规则：text= 精确优先，fallback CSS。 */

export function findEl(selector: string): Element | null {
  if (selector.startsWith("text=")) {
    const text = selector.slice(5);
    const els = [
      ...document.querySelectorAll("button,[role=button],a,[role=tab],input,textarea"),
    ];
    return (
      els.find((e) => (e.textContent ?? "").trim() === text) ??
      els.find((e) => (e.textContent ?? "").includes(text)) ??
      null
    );
  }
  return document.querySelector(selector);
}

export function executeUiTool(tool: string, selector: string): unknown {
  const el = selector ? findEl(selector) : null;
  switch (tool) {
    case "ui_click": {
      if (!el) throw new Error(`元素不存在：${selector}`);
      (el as HTMLElement).click();
      return { clicked: true, selector };
    }
    case "ui_hover": {
      if (!el) throw new Error(`元素不存在：${selector}`);
      const rect = el.getBoundingClientRect();
      const opts = {
        bubbles: true,
        clientX: rect.x + rect.width / 2,
        clientY: rect.y + rect.height / 2,
        pointerType: "mouse",
        isPrimary: true,
      };
      el.dispatchEvent(new PointerEvent("pointermove", opts));
      el.dispatchEvent(new PointerEvent("pointerover", opts));
      el.dispatchEvent(new PointerEvent("pointerenter", { ...opts, bubbles: false }));
      el.dispatchEvent(new MouseEvent("mouseover", opts));
      el.dispatchEvent(new MouseEvent("mouseenter", { ...opts, bubbles: false }));
      el.dispatchEvent(new MouseEvent("mousemove", opts));
      el.dispatchEvent(new FocusEvent("focus"));
      return { hovered: true, selector, tag: el.tagName };
    }
    case "ui_query": {
      if (!el) return { exists: false, visible: false };
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        exists: true,
        visible:
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden",
        text: (el.textContent ?? "").slice(0, 200),
        classes: el.className.toString().slice(0, 200),
        opacity: style.opacity,
        display: style.display,
      };
    }
    case "ui_snapshot": {
      const els = [
        ...document.querySelectorAll("button,[role=button],a,[role=tab],input,textarea,select"),
      ];
      return {
        url: location.pathname,
        interactive: els.slice(0, 120).map((e) => ({
          tag: e.tagName.toLowerCase(),
          label:
            e.getAttribute("aria-label") ??
            (e.textContent ?? "").trim().slice(0, 40) ??
            e.getAttribute("placeholder") ??
            "",
          text: (e.textContent ?? "").trim().slice(0, 40),
          disabled: (e as HTMLButtonElement).disabled ?? false,
        })),
      };
    }
    default:
      throw new Error(`未知 UI 工具：${tool}`);
  }
}
