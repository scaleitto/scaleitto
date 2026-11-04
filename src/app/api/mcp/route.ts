import { tokenCaller, touchToken } from "@/features/mcp/tokens";
import { tools } from "@/features/mcp/tools";
import { logError } from "@/server/errors";

// The store's MCP server (Store settings → MCP): Streamable HTTP, JSON answers (no event stream), one JSON-RPC message per
// request. Authorization: Bearer <token created on the MCP tab>. The token's scopes decide which tools are listed and allowed.
const PROTOCOL = "2025-06-18";
type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const reply = (id: Rpc["id"], result: unknown) => Response.json({ jsonrpc: "2.0", id: id ?? null, result });
const fail = (id: Rpc["id"], code: number, message: string, status = 200) => Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });

export async function POST(req: Request) {
  const caller = await tokenCaller(req.headers.get("authorization"));
  if (!caller) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { "Content-Type": "application/json", "WWW-Authenticate": 'Bearer error="invalid_token"' } });
  let msg: Rpc;
  try {
    msg = (await req.json()) as Rpc;
  } catch {
    return fail(null, -32700, "Parse error", 400);
  }
  if (Array.isArray(msg) || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(msg?.id, -32600, "Invalid Request", 400);
  // Notifications (no id) get no answer
  if (msg.id === undefined || msg.id === null) return new Response(null, { status: 202 });
  const allowed = tools.filter((t) => caller.scopes.includes(t.scope));
  try {
    switch (msg.method) {
      case "initialize": {
        const info = (msg.params?.clientInfo ?? {}) as { name?: unknown; version?: unknown };
        await touchToken(caller.tokenId, typeof info.name === "string" ? `${info.name}${typeof info.version === "string" ? ` ${info.version}` : ""}` : undefined);
        return reply(msg.id, { protocolVersion: typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : PROTOCOL, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "scaleitto-store", version: "1.0.0" } });
      }
      case "ping":
        return reply(msg.id, {});
      case "tools/list":
        return reply(msg.id, { tools: allowed.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) });
      case "tools/call": {
        const name = String(msg.params?.name ?? "");
        const tool = allowed.find((t) => t.name === name);
        if (!tool) return fail(msg.id, -32602, tools.some((t) => t.name === name) ? `The token has no access to ${name}` : `Unknown tool ${name}`);
        await touchToken(caller.tokenId);
        const result = await tool.run(caller, (msg.params?.arguments ?? {}) as Record<string, unknown>);
        const isError = Boolean(result && typeof result === "object" && "error" in result);
        return reply(msg.id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError });
      }
      default:
        return fail(msg.id, -32601, "Method not found");
    }
  } catch (err) {
    await logError("mcp", err);
    return fail(msg.id, -32603, "Internal error");
  }
}

export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
