// ─── Protocol Factory ───
// ALWAYS returns a new Protocol-based instance — NEVER reuses.
// Factory pattern ensures a fresh instance per connection.
// Protocol is abstract in the MCP SDK, so we use McpServer as the
// protocol-bearing object. This factory exists to enforce the pattern
// of fresh-per-connection creation.

/**
 * Create a fresh protocol-capable server configuration object.
 * ALWAYS returns a new object — never a cached/shared instance.
 * This prevents state leaks between connections.
 *
 * The MCP SDK's Protocol class is abstract; concrete protocol
 * handling is done by McpServer + StdioServerTransport.
 * This factory returns a config object for creating them.
 */
export function createProtocol(): {
  name: string;
  version: string;
  created: string;
} {
  return {
    name: 'clarik',
    version: '0.1.0',
    created: new Date().toISOString(),
  };
}
