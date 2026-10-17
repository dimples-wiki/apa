import { useEffect } from "react";

/**
 * UI 桥（页面侧执行器）：MCP 的 ui_* 工具经 server WS 转发到这里执行。
 * 让 UI 本身可被 agent 测试——细到"hover 后 tooltip 是否出现"的纯视觉断言。
 * 定位规则：`text=xxx` 按可交互元素文本查找（agent 友好）；其余按 CSS 选择器。
 */

function findEl(selector: string): Element | null {
  if (selector.startsWith("text=")) {
    const text = selector.slice(5);
    const els = [...document.querySelectorAll("button,[role=button],a,[role=tab],input,textarea")];
    return (
      els.find((e) => (e.textContent ?? "").trim() === text) ??
      els.find((e) => (e.textContent ?? "").includes(text)) ??
      null
    );
  }
  return document.querySelector(selector);
}

function executeUiTool(tool: string, args: Record<string, unknown>): unknown {
  const selector = String(args.selector ?? "");
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
      return {
        hovered: true,
        selector,
        tag: el.tagName,
        cls: String(el.className).slice(0, 80),
      };
    }
    case "ui_query": {
      if (!el) return { exists: false, visible: false };
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        exists: true,
        visible: rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden",
        text: (el.textContent ?? "").slice(0, 200),
        classes: el.className.toString().slice(0, 200),
        opacity: style.opacity,
        display: style.display,
      };
    }
    case "ui_snapshot": {
      const els = [...document.querySelectorAll("button,[role=button],a,[role=tab],input,textarea,select")];
      return {
        url: location.pathname,
        interactive: els.slice(0, 120).map((e) => {
          const label =
            e.getAttribute("aria-label") ??
            (e.textContent ?? "").trim().slice(0, 40) ??
            e.getAttribute("placeholder") ??
            "";
          return {
            tag: e.tagName.toLowerCase(),
            label,
            text: (e.textContent ?? "").trim().slice(0, 40),
            disabled: (e as HTMLButtonElement).disabled ?? false,
          };
        }),
      };
    }
    default:
      throw new Error(`未知 UI 工具：${tool}`);
  }
}

/** 挂载一次：WS 连 /ws/ui-bridge，断线自动重连 */
export function useUiBridge(): void {
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    function connect() {
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${proto}//${location.host}/ws/ui-bridge`);
      ws.onopen = () => {
        ws?.send(JSON.stringify({ hello: "apa-ui-executor", route: location.pathname }));
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(String(evt.data)) as {
            bridgeId?: string;
            tool?: string;
            args?: Record<string, unknown>;
          };
          if (!msg.bridgeId || !msg.tool) return;
          let result: unknown;
          try {
            result = executeUiTool(msg.tool, msg.args ?? {});
          } catch (e) {
            ws?.send(JSON.stringify({ bridgeId: msg.bridgeId, error: (e as Error).message }));
            return;
          }
          ws?.send(JSON.stringify({ bridgeId: msg.bridgeId, result }));
        } catch {
          // 忽略非 JSON 帧
        }
      };
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, []);
}
