import { useEffect } from "react";
import { executeUiTool } from "@/lib/ui-executor";

/** UI 桥（页面侧）：server /mcp 的 ui_* 工具经 WS 转发到这里执行。 */
function run(tool: string, args: Record<string, unknown>): unknown {
  return executeUiTool(tool, String(args.selector ?? ""));
}

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
          try {
            const result = run(msg.tool, msg.args ?? {});
            ws?.send(JSON.stringify({ bridgeId: msg.bridgeId, result }));
          } catch (e) {
            ws?.send(JSON.stringify({ bridgeId: msg.bridgeId, error: (e as Error).message }));
          }
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
