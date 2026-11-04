// Store settings → MCP: what an access token may do (Zimam's checkboxes). Pure: used by the settings page and the server.
export const readScopes = ["read_orders", "read_products", "read_analytics", "read_delivery"] as const;
export const writeScopes = ["write_orders", "write_products", "assign_delivery"] as const;
export const mcpScopes = [...readScopes, ...writeScopes] as const;
export type McpScope = (typeof mcpScopes)[number];
export const cleanScopes = (v: unknown): McpScope[] => [...new Set((Array.isArray(v) ? v : []).filter((s): s is McpScope => (mcpScopes as readonly string[]).includes(s)))];
