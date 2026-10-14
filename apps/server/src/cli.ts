import { spawn } from "node:child_process";
import { Command } from "commander";
import { APP_VERSION } from "@filmstudio/shared";
import { startServer } from "./server.ts";

const program = new Command();

program.name("filmstudio").description("FilmStudio — AI 影视创作平台").version(APP_VERSION);

program
  .command("serve")
  .description("启动 FilmStudio Web 服务，通过浏览器访问")
  .option("-p, --port <port>", "监听端口", "4310")
  .option("-H, --host <host>", "监听地址", "127.0.0.1")
  .option("--open", "启动后自动打开浏览器", false)
  .action(async (opts: { port: string; host: string; open: boolean }) => {
    const port = Number.parseInt(opts.port, 10);
    const url = `http://${opts.host}:${port}`;
    startServer({ port, hostname: opts.host });
    console.log(`\n  FilmStudio 已启动 → ${url}\n`);
    if (opts.open) {
      const opener = process.platform === "darwin" ? "open" : "xdg-open";
      spawn(opener, [url], { detached: true, stdio: "ignore" }).unref();
    }
  });

program.parse();
