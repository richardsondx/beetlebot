import blessed from "blessed";
import { api, baseUrl } from "./client";
import type { RichBlock } from "@/lib/chat/rich-message";
import { toPlainText, extractOptions } from "@/lib/chat/rich-message";

type ChatResponse = {
  reply: string;
  blocks?: RichBlock[];
  suggestedActions?: string[];
  confidence?: number;
  fallbackPlan?: string;
  model?: string;
  requestedModel?: string;
  provider?: string;
  responseId?: string | null;
  threadId?: string;
};

type DashboardState = {
  autopilots: Array<{ id: string; name: string; status: string; nextCheckIn: string }>;
  approvals: Array<{ id: string; title: string; amount: number; status: string }>;
  runs: Array<{ id: string; autopilotId: string; status: string; approvalState: string }>;
};

type ModelState = {
  provider: string;
  model: string;
  defaultModel: string;
  envModel: string | null;
  runtimeOverride: string | null;
  recentThreads?: Array<{
    id: string;
    title: string | null;
    updatedAt: string;
    messageCount: number;
  }>;
};

type SlashCommandOption = {
  command: string;
  usage: string;
  description: string;
};

const SLASH_COMMANDS: SlashCommandOption[] = [
  { command: "help", usage: "/help", description: "Show available commands" },
  { command: "status", usage: "/status", description: "Refresh connection and context" },
  { command: "context", usage: "/context [show|hide]", description: "Toggle context panel" },
  { command: "model", usage: "/model", description: "Show or change model (/model set ...)" },
  { command: "new", usage: "/new", description: "Start a new conversation thread" },
  { command: "thread", usage: "/thread", description: "Show current conversation thread" },
  { command: "threads", usage: "/threads", description: "List recent conversation threads" },
  { command: "autopilots", usage: "/autopilots", description: "List autopilots" },
  { command: "packs", usage: "/packs", description: "List available packs" },
  { command: "runs", usage: "/runs", description: "List autopilot runs" },
  { command: "approvals", usage: "/approvals", description: "List approvals" },
  { command: "integrations", usage: "/integrations", description: "List integration statuses" },
  {
    command: "connect",
    usage: "/connect <provider> [key=value...]",
    description: "Connect integration (telegram/whatsapp/google_calendar)",
  },
  {
    command: "disconnect",
    usage: "/disconnect <provider>",
    description: "Disconnect integration",
  },
  { command: "test", usage: "/test <provider>", description: "Run integration health check" },
  { command: "memory", usage: "/memory [bucket]", description: "Inspect memory entries" },
  { command: "preview", usage: "/preview <autopilotId>", description: "Preview an autopilot" },
  { command: "run", usage: "/run <autopilotId>", description: "Run an autopilot" },
  { command: "install", usage: "/install <packSlug>", description: "Install a pack" },
  { command: "retry", usage: "/retry <runId>", description: "Retry a run" },
  { command: "open", usage: "/open <n>", description: "Open option N from the last visual response in browser" },
  { command: "options", usage: "/options", description: "Re-list options from the last visual response" },
  { command: "images", usage: "/images [on|off]", description: "Toggle display of image option summaries" },
  { command: "clear", usage: "/clear", description: "Clear the session panel" },
  { command: "exit", usage: "/exit", description: "Exit the TUI" },
];

function nowTime() {
  return new Date().toLocaleTimeString();
}

async function getDashboardState(): Promise<DashboardState> {
  const [autopilots, approvals, runs] = await Promise.all([
    api<DashboardState["autopilots"]>("/api/autopilots"),
    api<DashboardState["approvals"]>("/api/approvals"),
    api<DashboardState["runs"]>("/api/autopilot-runs"),
  ]);
  return { autopilots, approvals, runs };
}

export async function runTui() {
  const screen = blessed.screen({
    smartCSR: true,
    title: "beetlebot tui",
    fullUnicode: true,
  });

  const header = blessed.box({
    top: 0,
    left: 0,
    width: "100%",
    height: 3,
    border: "line",
    tags: true,
    style: { border: { fg: "cyan" }, fg: "white" },
    content: " 🪲 beetlebot | {yellow-fg}●{/yellow-fg} connecting... ",
  });

  const transcript = blessed.log({
    label: " session ",
    top: 3,
    left: 0,
    width: "100%",
    height: "100%-7",
    border: "line",
    tags: true,
    scrollback: 1000,
    scrollable: true,
    alwaysScroll: false,
    scrollbar: { ch: " ", track: { bg: "gray" }, style: { bg: "green" } },
    keys: true,
    mouse: true,
    style: { border: { fg: "green" }, fg: "white" },
  });

  const contextPanel = blessed.box({
    label: " context ",
    top: "center",
    left: "center",
    width: "80%",
    height: "70%",
    border: "line",
    tags: true,
    scrollable: true,
    alwaysScroll: false,
    scrollbar: { ch: " ", track: { bg: "gray" }, style: { bg: "cyan" } },
    style: { border: { fg: "magenta" }, fg: "white" },
    content: "context hidden - run /context show",
    hidden: true,
  });

  const inputLabel = blessed.box({
    bottom: 3,
    left: 0,
    width: "100%",
    height: 1,
    content:
      " enter message or slash command (type / for menu, Tab/Enter to accept) ",
    style: { fg: "gray" },
  });

  const slashMenu = blessed.list({
    label: " slash commands ",
    bottom: 4,
    left: 0,
    width: "100%",
    height: 10,
    border: "line",
    tags: true,
    keys: false,
    mouse: true,
    hidden: true,
    style: {
      border: { fg: "blue" },
      fg: "white",
      selected: { bg: "blue", fg: "white", bold: true },
      item: { fg: "white" },
    },
  });

  const input = blessed.textbox({
    bottom: 0,
    left: 0,
    width: "100%",
    height: 3,
    border: "line",
    inputOnFocus: true,
    keys: true,
    mouse: true,
    style: { border: { fg: "yellow" }, fg: "white" },
  });

  screen.append(header);
  screen.append(transcript);
  screen.append(contextPanel);
  screen.append(inputLabel);
  screen.append(slashMenu);
  screen.append(input);

  function setSession(connected: boolean, details: string) {
    const indicator = connected ? "{green-fg}●{/green-fg}" : "{red-fg}●{/red-fg}";
    header.setContent(` 🪲 beetlebot | ${indicator} ${details} `);
    screen.render();
  }

  function logLine(line: string) {
    transcript.log(`[${nowTime()}] ${line}`);
    screen.render();
  }

  function formatContext(state: DashboardState) {
    const autopilotLines = state.autopilots
      .slice(0, 8)
      .map((item) => `- ${item.name} ({yellow-fg}${item.status}{/yellow-fg})`);
    const approvalLines = state.approvals
      .slice(0, 8)
      .map((item) => `- ${item.title} (${item.amount})`);
    const runLines = state.runs
      .slice(0, 8)
      .map((item) => `- ${item.autopilotId}: {cyan-fg}${item.status}{/cyan-fg}/${item.approvalState}`);

    return [
      "{bold}autopilots{/bold}",
      autopilotLines.length ? autopilotLines.join("\n") : "- none",
      "",
      "{bold}approvals{/bold}",
      approvalLines.length ? approvalLines.join("\n") : "- none",
      "",
      "{bold}runs{/bold}",
      runLines.length ? runLines.join("\n") : "- none",
      "",
      "{gray-fg}tip:{/gray-fg} /context hide to close",
    ].join("\n");
  }

  let contextVisible = false;
  let latestContextContent = "loading context...";
  let activeThreadId: string | null = null;

  // Visual options state: tracks numbered options from the last rich response
  let lastOptions: Array<{ index: number; title: string; url: string }> = [];
  let showImages = true; // toggle with /images on|off

  function setContextVisible(nextVisible: boolean) {
    contextVisible = nextVisible;
    if (contextVisible) {
      contextPanel.setContent(latestContextContent);
      contextPanel.show();
      contextPanel.setFront();
    } else {
      contextPanel.hide();
    }
    input.focus();
    screen.render();
  }

  let slashMatches: SlashCommandOption[] = [];
  let slashSelection = 0;

  function hideSlashMenu() {
    slashMenu.hide();
  }

  function showSlashMenu() {
    slashMenu.show();
    slashMenu.setFront();
  }

  function getInputValue() {
    return input.getValue().replace(/\n/g, "");
  }

  function setInputValue(value: string) {
    input.setValue(value);
  }

  function renderSlashMenuItems() {
    slashMenu.setItems(
      slashMatches.map(
        (item) =>
          `{bold}${item.usage}{/bold} {gray-fg}${item.description}{/gray-fg}`,
      ),
    );
    const index = Math.min(Math.max(slashSelection, 0), Math.max(slashMatches.length - 1, 0));
    slashSelection = index;
    slashMenu.select(index);
  }

  function updateSlashMenuFromInput() {
    const trimmed = getInputValue().trim();
    if (!trimmed.startsWith("/")) {
      hideSlashMenu();
      screen.render();
      return;
    }
    const query = trimmed.slice(1);
    const hasArgs = /\s/.test(query);
    if (hasArgs) {
      hideSlashMenu();
      screen.render();
      return;
    }
    const prefix = query.toLowerCase();
    slashMatches = SLASH_COMMANDS.filter((item) => item.command.startsWith(prefix));
    if (!slashMatches.length) {
      hideSlashMenu();
      screen.render();
      return;
    }
    if (slashSelection >= slashMatches.length) slashSelection = 0;
    renderSlashMenuItems();
    showSlashMenu();
    screen.render();
  }

  function applySlashSelection() {
    if (!slashMenu.visible || !slashMatches.length) return false;
    const command = slashMatches[slashSelection];
    setInputValue(`/${command.command} `);
    hideSlashMenu();
    screen.render();
    return true;
  }

  function moveSlashSelection(offset: number) {
    if (!slashMenu.visible || !slashMatches.length) return false;
    slashSelection = (slashSelection + offset + slashMatches.length) % slashMatches.length;
    renderSlashMenuItems();
    screen.render();
    return true;
  }

  async function refreshSidebar() {
    try {
      const state = await getDashboardState();
      latestContextContent = formatContext(state);
      if (contextVisible) {
        contextPanel.setContent(latestContextContent);
      }
      setSession(true, `base ${baseUrl} | autopilots ${state.autopilots.length}`);
    } catch (error) {
      setSession(false, `base ${baseUrl} | ${error instanceof Error ? error.message : "unknown error"}`);
      latestContextContent = "{red-fg}Unable to load context from API{/red-fg}";
      if (contextVisible) {
        contextPanel.setContent(latestContextContent);
      }
    }
    screen.render();
  }

  async function runSlashCommand(raw: string) {
    const [cmd, ...args] = raw.slice(1).trim().split(/\s+/);
    switch (cmd) {
      case "help":
        logLine(
          "{green-fg}Commands{/green-fg}: /help /status /context [show|hide] /model [/set <name>|/reset] /new /thread [id] /threads /autopilots /packs /runs /approvals /integrations",
        );
        logLine(
          "{green-fg}Actions{/green-fg}: /connect <provider> [k=v] /disconnect <provider> /test <provider> /preview <id> /run <id> /install <slug> /retry <runId> /memory [bucket] /clear /exit",
        );
        break;
      case "status":
        await refreshSidebar();
        logLine("Status refreshed.");
        break;
      case "context": {
        const mode = args[0]?.toLowerCase();
        if (mode === "show") {
          setContextVisible(true);
          logLine("Context panel opened.");
          break;
        }
        if (mode === "hide") {
          setContextVisible(false);
          logLine("Context panel hidden.");
          break;
        }
        setContextVisible(!contextVisible);
        logLine(contextVisible ? "Context panel opened." : "Context panel hidden.");
        break;
      }
      case "model": {
        const sub = args[0]?.toLowerCase();
        if (sub === "set") {
          const nextModel = args.slice(1).join(" ").trim();
          if (!nextModel) throw new Error("Usage: /model set <provider/model>");
          const state = await api<ModelState>("/api/chat", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: nextModel }),
          });
          logLine(
            `{green-fg}model updated{/green-fg}: ${state.model} {gray-fg}(env: ${
              state.envModel ?? "none"
            }, runtime: ${state.runtimeOverride ?? "none"}){/gray-fg}`,
          );
          break;
        }
        if (sub === "reset") {
          const state = await api<ModelState>("/api/chat", { method: "DELETE" });
          logLine(
            `{green-fg}model reset{/green-fg}: ${state.model} {gray-fg}(env: ${
              state.envModel ?? "none"
            }, runtime: ${state.runtimeOverride ?? "none"}){/gray-fg}`,
          );
          break;
        }
        const state = await api<ModelState>("/api/chat");
        logLine(
          `{green-fg}model{/green-fg}: ${state.model} | provider: ${state.provider} | default: ${
            state.defaultModel
          } | env: ${state.envModel ?? "none"} | runtime: ${state.runtimeOverride ?? "none"}`,
        );
        break;
      }
      case "new":
        activeThreadId = null;
        logLine("Started a new conversation thread.");
        break;
      case "thread":
        if (args[0]) {
          activeThreadId = args[0];
          logLine(`Active thread set to ${activeThreadId}`);
          break;
        }
        logLine(
          activeThreadId
            ? `{green-fg}thread{/green-fg}: ${activeThreadId} {gray-fg}(use /thread <id> to switch){/gray-fg}`
            : "{yellow-fg}thread{/yellow-fg}: none (next message will create one)",
        );
        break;
      case "threads": {
        const state = await api<ModelState>("/api/chat");
        const threads = state.recentThreads ?? [];
        if (!threads.length) {
          logLine("No conversation threads yet.");
          break;
        }
        logLine("{green-fg}recent threads{/green-fg}:");
        for (const thread of threads) {
          const title = (thread.title ?? "(untitled)").slice(0, 60);
          const mark = thread.id === activeThreadId ? "*" : "-";
          logLine(
            `${mark} ${thread.id} (${thread.messageCount} msgs) ${title} {gray-fg}${new Date(
              thread.updatedAt,
            ).toLocaleString()}{/gray-fg}`,
          );
        }
        break;
      }
      case "autopilots":
        logLine(JSON.stringify(await api("/api/autopilots"), null, 2));
        break;
      case "packs":
        logLine(JSON.stringify(await api("/api/packs"), null, 2));
        break;
      case "runs":
        logLine(JSON.stringify(await api("/api/autopilot-runs"), null, 2));
        break;
      case "approvals":
        logLine(JSON.stringify(await api("/api/approvals"), null, 2));
        break;
      case "integrations":
        logLine(JSON.stringify(await api("/api/integrations"), null, 2));
        break;
      case "connect": {
        const provider = args[0];
        if (!provider) throw new Error("Usage: /connect <provider> [key=value...]");
        const extra: Record<string, string> = {};
        for (const token of args.slice(1)) {
          const idx = token.indexOf("=");
          if (idx <= 0) continue;
          const key = token.slice(0, idx);
          const value = token.slice(idx + 1);
          extra[key] = value;
        }
        const response = await api<{ authorizeUrl?: string; message?: string }>(
          `/api/integrations/${provider}/connect`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(extra),
          },
        );
        logLine(JSON.stringify(response, null, 2));
        if (response.authorizeUrl) {
          logLine(`Open this URL to authorize Google: ${response.authorizeUrl}`);
          logLine("Then run: /connect google_calendar code=<oauth_code>");
        }
        break;
      }
      case "disconnect":
        if (!args[0]) throw new Error("Usage: /disconnect <provider>");
        logLine(JSON.stringify(await api(`/api/integrations/${args[0]}/disconnect`, { method: "POST" }), null, 2));
        break;
      case "test":
        if (!args[0]) throw new Error("Usage: /test <provider>");
        logLine(JSON.stringify(await api(`/api/integrations/${args[0]}/test`, { method: "POST" }), null, 2));
        break;
      case "memory": {
        const bucket = args[0];
        const query = bucket ? `?bucket=${encodeURIComponent(bucket)}` : "";
        logLine(JSON.stringify(await api(`/api/memory${query}`), null, 2));
        break;
      }
      case "preview":
        if (!args[0]) throw new Error("Usage: /preview <autopilotId>");
        logLine(JSON.stringify(await api(`/api/autopilots/${args[0]}/preview`, { method: "POST" }), null, 2));
        break;
      case "run":
        if (!args[0]) throw new Error("Usage: /run <autopilotId>");
        logLine(JSON.stringify(await api(`/api/autopilots/${args[0]}/run`, { method: "POST" }), null, 2));
        break;
      case "install":
        if (!args[0]) throw new Error("Usage: /install <packSlug>");
        logLine(
          JSON.stringify(
            await api(`/api/packs/install`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug: args[0] }),
            }),
            null,
            2,
          ),
        );
        break;
      case "retry":
        if (!args[0]) throw new Error("Usage: /retry <runId>");
        logLine(JSON.stringify(await api(`/api/autopilot-runs/${args[0]}/retry`, { method: "POST" }), null, 2));
        break;
      case "open": {
        const n = parseInt(args[0] ?? "", 10);
        if (isNaN(n) || n < 1) throw new Error("Usage: /open <n>  (use /options to see the list)");
        const opt = lastOptions.find((o) => o.index === n);
        if (!opt) {
          throw new Error(
            `No option [${n}] in the last response. Available: ${lastOptions.map((o) => o.index).join(", ")}`,
          );
        }
        // Use platform open command
        const { exec } = await import("child_process");
        const openCmd =
          process.platform === "win32"
            ? `start "" "${opt.url}"`
            : process.platform === "darwin"
              ? `open "${opt.url}"`
              : `xdg-open "${opt.url}"`;
        exec(openCmd, (err) => {
          if (err) logLine(`{red-fg}Failed to open browser: ${err.message}{/red-fg}`);
        });
        logLine(`{green-fg}Opening in browser:{/green-fg} ${opt.title}`);
        logLine(`  {blue-fg}${opt.url}{/blue-fg}`);
        break;
      }

      case "options": {
        if (!lastOptions.length) {
          logLine("{gray-fg}No visual options from the last response yet.{/gray-fg}");
          break;
        }
        logLine("{cyan-fg}── last visual options ──{/cyan-fg}");
        for (const opt of lastOptions) {
          logLine(`  {bold}[${opt.index}]{/bold} ${opt.title}`);
          logLine(`      {blue-fg}${opt.url}{/blue-fg}`);
        }
        break;
      }

      case "images": {
        const sub = args[0]?.toLowerCase();
        if (sub === "off") {
          showImages = false;
          logLine("{gray-fg}Image option summaries disabled.{/gray-fg}");
        } else {
          showImages = true;
          logLine("{green-fg}Image option summaries enabled.{/green-fg}");
        }
        break;
      }

      case "clear":
        transcript.setContent("");
        break;
      case "exit":
      case "quit":
        screen.destroy();
        process.exit(0);
      default:
        throw new Error(`Unknown command: /${cmd}`);
    }
  }

  function logRichResponse(response: ChatResponse) {
    // Always log the text reply
    logLine(`{green-fg}beetlebot>{/green-fg} ${response.reply}`);

    if (response.blocks?.length && showImages) {
      // Build AssistantMessage for extraction utilities
      const msg = { text: response.reply, blocks: response.blocks };
      const options = extractOptions(msg);

      if (options.length > 0) {
        lastOptions = options;
        logLine("{cyan-fg}── visual options ──{/cyan-fg}");
        for (const opt of options) {
          logLine(`  {bold}[${opt.index}]{/bold} ${opt.title}`);
          logLine(`      {blue-fg}${opt.url}{/blue-fg}`);
        }
        logLine("{gray-fg}tip: /open <n> to open in browser · /options to re-list{/gray-fg}");
      } else {
        // Blocks without navigable URLs — render as text summary
        const plain = toPlainText(msg);
        if (plain !== response.reply) {
          logLine("{cyan-fg}── details ──{/cyan-fg}");
          logLine(plain.slice(response.reply.length).trim());
        }
      }
    }
  }

  async function handleInput(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      if (trimmed.startsWith("/")) {
        logLine(`{yellow-fg}${trimmed}{/yellow-fg}`);
        await runSlashCommand(trimmed);
      } else {
        logLine(`{cyan-fg}you>{/cyan-fg} ${trimmed}`);
        const response = await api<ChatResponse>("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, threadId: activeThreadId ?? undefined }),
        });
        if (response.threadId) {
          const wasThreadUnset = !activeThreadId;
          activeThreadId = response.threadId;
          if (wasThreadUnset) {
            logLine(`{gray-fg}thread:{/gray-fg} ${activeThreadId}`);
          }
        }
        logRichResponse(response);
        if (response.model) {
          const requested =
            response.requestedModel && response.requestedModel !== response.model
              ? ` (requested: ${response.requestedModel})`
              : "";
          logLine(`{gray-fg}model:{/gray-fg} ${response.provider ?? "openrouter"}/${response.model}${requested}`);
        }
        if (response.fallbackPlan) {
          logLine(`{gray-fg}fallback:{/gray-fg} ${response.fallbackPlan}`);
        }
        if (response.suggestedActions?.length) {
          logLine(`{gray-fg}suggested:{/gray-fg} ${response.suggestedActions.join(", ")}`);
        }
      }
      await refreshSidebar();
    } catch (error) {
      logLine(`{red-fg}error:{/red-fg} ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  input.on("submit", (value) => {
    const trimmed = value.trim();
    let nextValue = value;
    if (slashMenu.visible && slashMatches.length && trimmed.startsWith("/")) {
      const typedCommand = trimmed.slice(1).split(/\s+/)[0];
      const isKnownCommand = SLASH_COMMANDS.some((item) => item.command === typedCommand);
      if (!isKnownCommand) {
        nextValue = `/${slashMatches[slashSelection].command}`;
      }
    }
    input.clearValue();
    hideSlashMenu();
    screen.render();
    void handleInput(nextValue);
    input.focus();
  });

  input.on("keypress", () => {
    setTimeout(() => {
      updateSlashMenuFromInput();
    }, 0);
  });

  input.key(["tab"], () => {
    applySlashSelection();
  });

  input.key(["down"], () => {
    moveSlashSelection(1);
  });

  input.key(["up"], () => {
    moveSlashSelection(-1);
  });

  input.key(["escape"], () => {
    hideSlashMenu();
    screen.render();
  });

  let lastWheelAt = 0;
  function smoothWheelScroll(target: blessed.Widgets.BoxElement | blessed.Widgets.Log) {
    target.on("wheelup", () => {
      const now = Date.now();
      if (now - lastWheelAt < 40) return;
      lastWheelAt = now;
      target.scroll(-1);
      screen.render();
    });
    target.on("wheeldown", () => {
      const now = Date.now();
      if (now - lastWheelAt < 40) return;
      lastWheelAt = now;
      target.scroll(1);
      screen.render();
    });
  }
  smoothWheelScroll(transcript);
  smoothWheelScroll(contextPanel);

  slashMenu.on("select", (_item, index) => {
    if (typeof index === "number") {
      slashSelection = index;
    }
    if (applySlashSelection()) {
      setTimeout(() => input.focus(), 0);
    }
  });

  screen.key(["escape", "q", "C-c"], () => {
    screen.destroy();
    process.exit(0);
  });

  screen.key(["C-l"], () => {
    transcript.setContent("");
    screen.render();
  });

  screen.key(["C-k"], () => {
    setContextVisible(!contextVisible);
  });

  screen.render();
  logLine("{green-fg}beetlebot tui ready{/green-fg} - type /help");
  try {
    const state = await api<ModelState>("/api/chat");
    if (state.recentThreads?.[0]?.id) {
      activeThreadId = state.recentThreads[0].id;
      logLine(`{gray-fg}resumed thread:{/gray-fg} ${activeThreadId}`);
    }
  } catch {
    // no-op: chat endpoint might be unavailable at startup
  }
  await refreshSidebar();
  input.focus();

  const interval = setInterval(() => {
    void refreshSidebar();
  }, 10000);

  screen.on("destroy", () => {
    clearInterval(interval);
  });
}

