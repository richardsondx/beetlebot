#!/usr/bin/env node
import { Command } from "commander";
import { spawnSync } from "node:child_process";
import { api, printJson } from "./client";
import { runTui } from "./tui";

const program = new Command();

program.name("beetlebot").description("beetlebot CLI").version("0.1.0");

type ManagedService = "beetlebot" | "ngrok";

const SYSTEMD_SERVICES: Record<ManagedService, string> = {
  beetlebot: "beetlebot",
  ngrok: "ngrok-beetlebot",
};

function runSystemCommand(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    throw result.error;
  }
  if ((result.status ?? 0) !== 0) {
    process.exit(result.status ?? 1);
  }
}

program
  .command("tui")
  .description("Open interactive beetlebot TUI shell")
  .action(async () => {
    await runTui();
  });

program
  .command("dev")
  .description("Run local runtime checks")
  .action(async () => {
    const [autopilots, jobs] = await Promise.all([
      api<unknown[]>("/api/autopilots"),
      api<unknown[]>("/api/scheduler/jobs"),
    ]);
    printJson({ ok: true, autopilotCount: autopilots.length, schedulerJobs: jobs.length });
  });

const autopilot = program.command("autopilot").description("Autopilot commands");
autopilot.command("list").action(async () => printJson(await api("/api/autopilots")));
autopilot
  .command("preview")
  .argument("<id>")
  .action(async (id: string) =>
    printJson(await api(`/api/autopilots/${id}/preview`, { method: "POST" })),
  );
autopilot
  .command("run")
  .argument("<id>")
  .action(async (id: string) => printJson(await api(`/api/autopilots/${id}/run`, { method: "POST" })));

const pack = program.command("pack").description("Pack commands");
pack.command("list").action(async () => printJson(await api("/api/packs")));
pack
  .command("install")
  .argument("<slug>")
  .action(async (slug: string) =>
    printJson(
      await api("/api/packs/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      }),
    ),
  );

const approvals = program.command("approvals");
approvals.command("list").action(async () => printJson(await api("/api/approvals")));

const audit = program.command("audit");
audit.command("tail").action(async () => printJson(await api("/api/audit")));

const memory = program.command("memory");
memory
  .command("list")
  .option("--bucket <name>")
  .action(async (opts: { bucket?: string }) =>
    printJson(await api(`/api/memory${opts.bucket ? `?bucket=${opts.bucket}` : ""}`)),
  );
memory
  .command("forget")
  .argument("<memoryId>")
  .action(async (memoryId: string) =>
    printJson(
      await api("/api/memory/forget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memoryId }),
      }),
    ),
  );

const runs = program.command("runs");
runs.command("list").action(async () => printJson(await api("/api/autopilot-runs")));
runs
  .command("retry")
  .argument("<runId>")
  .action(async (runId: string) =>
    printJson(await api(`/api/autopilot-runs/${runId}/retry`, { method: "POST" })),
  );

const scheduler = program.command("scheduler");
scheduler.command("status").action(async () => printJson(await api("/api/scheduler/jobs")));

const integrations = program.command("integrations").description("Integration connection commands");
integrations.command("list").action(async () => printJson(await api("/api/integrations")));
integrations
  .command("status")
  .argument("<provider>", "telegram | whatsapp | google_calendar")
  .action(async (provider: string) => printJson(await api(`/api/integrations/${provider}`)));
integrations
  .command("connect")
  .argument("<provider>", "telegram | whatsapp | google_calendar")
  .option("--bot-token <token>", "Telegram bot token")
  .option("--access-token <token>", "WhatsApp access token")
  .option("--phone-number-id <id>", "WhatsApp phone number id")
  .option("--business-account-id <id>", "WhatsApp business account id")
  .option("--code <code>", "Google OAuth authorization code")
  .option("--calendar-id <id>", "Google Calendar id")
  .option("--redirect-uri <uri>", "Google OAuth redirect uri override")
  .option("--client-id <id>", "Google OAuth client id override")
  .option("--client-secret <secret>", "Google OAuth client secret override")
  .action(async (provider: string, opts: Record<string, string | undefined>) => {
    const body: Record<string, string> = {};
    if (provider === "telegram" && opts.botToken) body.botToken = opts.botToken;
    if (provider === "whatsapp") {
      if (opts.accessToken) body.accessToken = opts.accessToken;
      if (opts.phoneNumberId) body.phoneNumberId = opts.phoneNumberId;
      if (opts.businessAccountId) body.businessAccountId = opts.businessAccountId;
    }
    if (provider === "google_calendar") {
      if (opts.code) body.code = opts.code;
      if (opts.calendarId) body.calendarId = opts.calendarId;
      if (opts.redirectUri) body.redirectUri = opts.redirectUri;
      if (opts.clientId) body.clientId = opts.clientId;
      if (opts.clientSecret) body.clientSecret = opts.clientSecret;
    }
    const response = await api<{ authorizeUrl?: string; message?: string }>(
      `/api/integrations/${provider}/connect`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    printJson(response);
    if (response.authorizeUrl) {
      console.log(
        "Google OAuth pending. Open authorizeUrl in a browser, then rerun with --code <oauth_code>.",
      );
    }
  });
integrations
  .command("disconnect")
  .argument("<provider>", "telegram | whatsapp | google_calendar")
  .action(async (provider: string) =>
    printJson(await api(`/api/integrations/${provider}/disconnect`, { method: "POST" })),
  );
integrations
  .command("test")
  .argument("<provider>", "telegram | whatsapp | google_calendar")
  .action(async (provider: string) =>
    printJson(await api(`/api/integrations/${provider}/test`, { method: "POST" })),
  );

const svc = program
  .command("svc")
  .alias("service")
  .description("Systemd + ngrok helper commands (self-host)");

svc
  .command("status")
  .argument("[service]", "beetlebot | ngrok", "beetlebot")
  .action((service: ManagedService) => {
    const unit = SYSTEMD_SERVICES[service];
    if (!unit) throw new Error(`Unknown service: ${service}`);
    runSystemCommand("systemctl", ["status", unit, "--no-pager"]);
  });

svc
  .command("restart")
  .argument("[service]", "beetlebot | ngrok", "beetlebot")
  .action((service: ManagedService) => {
    const unit = SYSTEMD_SERVICES[service];
    if (!unit) throw new Error(`Unknown service: ${service}`);
    runSystemCommand("systemctl", ["restart", unit]);
    runSystemCommand("systemctl", ["status", unit, "--no-pager"]);
  });

svc
  .command("logs")
  .argument("[service]", "beetlebot | ngrok", "beetlebot")
  .option("-n, --lines <count>", "Number of log lines", "100")
  .action((service: ManagedService, opts: { lines: string }) => {
    const unit = SYSTEMD_SERVICES[service];
    if (!unit) throw new Error(`Unknown service: ${service}`);
    const lines = String(Math.max(1, parseInt(opts.lines, 10) || 100));
    runSystemCommand("journalctl", ["-u", unit, "-n", lines, "--no-pager"]);
  });

svc
  .command("endpoint")
  .description("Show active ngrok public URL(s)")
  .action(() => {
    const result = spawnSync("curl", ["-s", "http://127.0.0.1:4040/api/tunnels"], {
      encoding: "utf8",
      env: process.env,
    });
    if (result.error) throw result.error;
    if ((result.status ?? 0) !== 0) {
      process.exit(result.status ?? 1);
    }
    const payload = JSON.parse(result.stdout || "{}") as {
      tunnels?: Array<{ name?: string; public_url?: string }>;
    };
    const urls =
      payload.tunnels
        ?.filter((tunnel) => typeof tunnel.public_url === "string")
        .map((tunnel) => ({ name: tunnel.name ?? "tunnel", publicUrl: tunnel.public_url })) ?? [];
    if (!urls.length) {
      throw new Error("No ngrok tunnels found at http://127.0.0.1:4040/api/tunnels");
    }
    printJson({ tunnels: urls });
  });

void program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

