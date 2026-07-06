// scripts/mcp-health-check.ts
//
// Health check dos MCP servers declarados em `.mcp/mcp.json`. Sobe cada servidor via
// child_process.spawn, faz o handshake real do protocolo MCP (JSON-RPC 2.0 sobre
// stdio, uma mensagem por linha: `initialize` -> `notifications/initialized` ->
// `tools/list`) e, para o servidor `filesystem`, confirma que `docs/novatech`
// é de fato listável chamando a tool de listagem de diretório descoberta em
// `tools/list`.
//
// Uso: npx tsx scripts/mcp-health-check.ts   (ou `npm run mcp:health`)
//
// Este é um script utilitário fora de `src/` — `console.log`/`console.error` são
// tolerados aqui (ver AGENTS.md > Coding Standards > Logging, que restringe o uso
// direto de console apenas dentro de `src/`).

import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const MCP_CONFIG_PATH = path.join(REPO_ROOT, ".mcp", "mcp.json");

/** Timeout individual (handshake + tools/list, e a checagem extra do filesystem). */
const DEFAULT_TIMEOUT_MS = 8_000;

/** Overrides de timeout por nome de servidor — ajuste aqui se algum server específico precisar de mais tempo. */
const TIMEOUT_OVERRIDES_MS: Record<string, number> = {};

/** Diretório que o servidor `filesystem` precisa conseguir listar de fato (papel do Confluence, ver AGENTS.md). */
const FILESYSTEM_PROBE_DIR = path.join(REPO_ROOT, "docs", "novatech");

const McpServerConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
});

const McpConfigSchema = z.object({
  mcpServers: z.record(McpServerConfigSchema),
});

type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

type JsonRpcId = number;

interface JsonRpcRequestMessage {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

interface JsonRpcResponseMessage {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

type ServerStatus = "UP" | "DOWN" | "DEGRADED";

interface ServerCheckResult {
  name: string;
  status: ServerStatus;
  message?: string;
}

interface McpTool {
  name: string;
  inputSchema?: {
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolCallResult {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
}

/** Erro interno com causa legível, usado para marcar um servidor como DOWN. */
class ServerCheckError extends Error {}

/**
 * Lê e valida `.mcp/mcp.json`. Lança um Error com mensagem clara (nunca deixa o
 * JSON.parse ou o fs estourar uma stack trace crua) se o arquivo não existir,
 * tiver JSON inválido, ou não tiver a chave `mcpServers`.
 */
async function loadMcpConfig(): Promise<Record<string, McpServerConfig>> {
  const relPath = path.relative(REPO_ROOT, MCP_CONFIG_PATH);

  let raw: string;
  try {
    raw = await readFile(MCP_CONFIG_PATH, "utf8");
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`não foi possível ler ${relPath}: ${cause}`);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`${relPath} não é um JSON válido: ${cause}`);
  }

  const parsed = McpConfigSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(
      `${relPath} não tem o formato esperado (chave "mcpServers" ausente ou inválida): ${parsed.error.message}`,
    );
  }

  return parsed.data.mcpServers;
}

/** Cliente JSON-RPC minimalista sobre stdio de um processo filho (uma mensagem por linha). */
class StdioJsonRpcClient {
  private nextId = 1;
  private buffer = "";
  private stderrTail = "";
  private readonly pending = new Map<
    JsonRpcId,
    { resolve: (response: JsonRpcResponseMessage) => void; reject: (err: Error) => void }
  >();

  constructor(private readonly child: ChildProcess) {
    this.child.stdout?.setEncoding("utf8");
    this.child.stdout?.on("data", (chunk: string) => this.onStdoutData(chunk));

    this.child.stderr?.setEncoding("utf8");
    this.child.stderr?.on("data", (chunk: string) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-2_000);
    });

    this.child.on("exit", (code, signal) => {
      const exitError = new ServerCheckError(
        `processo encerrado antes de responder (code=${code ?? "null"}, signal=${signal ?? "null"})` +
          (this.stderrTail.trim() ? ` — stderr: ${this.stderrTail.trim().slice(-500)}` : ""),
      );
      for (const waiter of this.pending.values()) waiter.reject(exitError);
      this.pending.clear();
    });
  }

  getStderrTail(): string {
    return this.stderrTail.trim();
  }

  private onStdoutData(chunk: string): void {
    this.buffer += chunk;
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) continue;

      let message: JsonRpcResponseMessage;
      try {
        message = JSON.parse(line) as JsonRpcResponseMessage;
      } catch {
        continue; // linha não-JSON (ex.: log do servidor vazando para stdout) — ignora
      }

      if (typeof message.id === "number" && this.pending.has(message.id)) {
        const waiter = this.pending.get(message.id);
        this.pending.delete(message.id);
        waiter?.resolve(message);
      }
    }
  }

  notify(method: string, params?: unknown): void {
    const message: JsonRpcRequestMessage = { jsonrpc: "2.0", method, params };
    this.child.stdin?.write(`${JSON.stringify(message)}\n`);
  }

  request(method: string, params?: unknown): Promise<JsonRpcResponseMessage> {
    const id = this.nextId++;
    const message: JsonRpcRequestMessage = { jsonrpc: "2.0", id, method, params };
    return new Promise<JsonRpcResponseMessage>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.child.stdin?.write(`${JSON.stringify(message)}\n`);
      } catch (err) {
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
}

/** Mata o processo (e o grupo, já que ele roda `detached` para cobrir subprocessos do npx). */
function killChild(child: ChildProcess): void {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function extractTools(result: unknown): McpTool[] {
  if (result && typeof result === "object" && Array.isArray((result as { tools?: unknown }).tools)) {
    return (result as { tools: McpTool[] }).tools;
  }
  return [];
}

/** Escolhe qual propriedade do inputSchema representa o caminho a listar (normalmente "path"). */
function pickPathArgKey(tool: McpTool): string {
  const keys = Object.keys(tool.inputSchema?.properties ?? {});
  return keys.find((key) => /^path$/i.test(key)) ?? keys.find((key) => /dir/i.test(key)) ?? keys[0] ?? "path";
}

/**
 * Checagem específica do servidor `filesystem`: descobre a tool de listagem de
 * diretório a partir de `tools/list` (não hardcoded) e confirma que `docs/novatech`
 * é de fato acessível. Se o handshake genérico já funcionou mas essa chamada falhar,
 * o resultado é DEGRADED (não DOWN).
 */
async function checkFilesystemAccess(
  client: StdioJsonRpcClient,
  tools: McpTool[],
): Promise<{ status: ServerStatus; message?: string }> {
  const relProbeDir = path.relative(REPO_ROOT, FILESYSTEM_PROBE_DIR);
  const listTool =
    tools.find((tool) => /list.?directory/i.test(tool.name)) ??
    tools.find((tool) => /directory.?tree/i.test(tool.name));

  if (!listTool) {
    return {
      status: "DEGRADED",
      message: `handshake respondeu, mas nenhuma tool de listagem de diretório foi encontrada em tools/list para confirmar acesso a ${relProbeDir}`,
    };
  }

  try {
    const pathArgKey = pickPathArgKey(listTool);
    const response = await client.request("tools/call", {
      name: listTool.name,
      arguments: { [pathArgKey]: FILESYSTEM_PROBE_DIR },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    const result = response.result as McpToolCallResult | undefined;
    if (result?.isError) {
      const text = result.content
        ?.map((entry) => entry.text)
        .filter(Boolean)
        .join(" ");
      throw new Error(text || "tool retornou isError sem detalhes");
    }

    return { status: "UP" };
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    return {
      status: "DEGRADED",
      message: `handshake respondeu, mas o acesso a ${relProbeDir} via tool "${listTool.name}" falhou: ${cause}`,
    };
  }
}

/**
 * Sobe um servidor MCP, faz o handshake `initialize` -> `notifications/initialized`
 * -> `tools/list` com timeout individual, e (só para o servidor `filesystem`) confirma
 * acesso real a `docs/novatech`. Nunca lança — qualquer falha vira um ServerCheckResult
 * DOWN ou DEGRADED, para que a checagem dos demais servidores não seja interrompida.
 */
async function checkServer(name: string, config: McpServerConfig, timeoutMs: number): Promise<ServerCheckResult> {
  const child = spawn(config.command, config.args, {
    cwd: REPO_ROOT,
    env: config.env ? { ...process.env, ...config.env } : process.env,
    stdio: ["pipe", "pipe", "pipe"],
    detached: true,
  });

  const client = new StdioJsonRpcClient(child);
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new ServerCheckError(`sem resposta dentro do timeout de ${timeoutMs}ms`));
    }, timeoutMs);
  });

  const spawnErrorPromise = new Promise<never>((_, reject) => {
    child.on("error", (err) => {
      reject(new ServerCheckError(`falha ao iniciar o processo "${config.command}": ${err.message}`));
    });
  });

  const handshakePromise = (async (): Promise<{ status: ServerStatus; message?: string }> => {
    const initResponse = await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "mcp-health-check", version: "0.1.0" },
    });
    if (initResponse.error) {
      throw new ServerCheckError(`"initialize" retornou erro JSON-RPC: ${initResponse.error.message}`);
    }

    client.notify("notifications/initialized");

    const toolsResponse = await client.request("tools/list");
    if (toolsResponse.error) {
      throw new ServerCheckError(`"tools/list" retornou erro JSON-RPC: ${toolsResponse.error.message}`);
    }

    if (name === "filesystem") {
      return checkFilesystemAccess(client, extractTools(toolsResponse.result));
    }

    return { status: "UP" };
  })();

  try {
    const { status, message } = await Promise.race([handshakePromise, timeoutPromise, spawnErrorPromise]);
    return { name, status, message };
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    const stderrTail = client.getStderrTail();
    const message =
      stderrTail && !cause.includes("stderr:") ? `${cause} — stderr: ${stderrTail.slice(-300)}` : cause;
    return { name, status: "DOWN", message };
  } finally {
    clearTimeout(timeoutHandle);
    killChild(child);
  }
}

function formatSummaryLine(result: ServerCheckResult): string {
  const status = result.status.padEnd(9);
  return result.message ? `  ${status} ${result.name} — ${result.message}` : `  ${status} ${result.name}`;
}

async function main(): Promise<void> {
  let servers: Record<string, McpServerConfig>;
  try {
    servers = await loadMcpConfig();
  } catch (err) {
    console.error(`[mcp-health-check] erro de configuração: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }

  const entries = Object.entries(servers);
  if (entries.length === 0) {
    console.error(
      `[mcp-health-check] erro de configuração: "mcpServers" está vazio em ${path.relative(REPO_ROOT, MCP_CONFIG_PATH)}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `[mcp-health-check] checando ${entries.length} servidor(es) MCP declarados em ${path.relative(REPO_ROOT, MCP_CONFIG_PATH)}...\n`,
  );

  const results = await Promise.all(
    entries.map(([name, config]) => checkServer(name, config, TIMEOUT_OVERRIDES_MS[name] ?? DEFAULT_TIMEOUT_MS)),
  );

  console.log("Resumo:");
  for (const result of results) {
    console.log(formatSummaryLine(result));
  }

  const allUp = results.every((result) => result.status === "UP");
  process.exitCode = allUp ? 0 : 1;
}

main().catch((err) => {
  console.error(
    `[mcp-health-check] erro inesperado: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
  );
  process.exitCode = 1;
});
