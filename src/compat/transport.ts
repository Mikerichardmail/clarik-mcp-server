// ─── Transport Heartbeat ───
// 30-second heartbeat ping to keep stdio connection alive.
// On ping failure: log error and exit gracefully.
// stdio only — NEVER SSE or HTTP.

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Setup a 30-second heartbeat ping on the given transport.
 * Keeps the stdio connection alive.
 * On failure: logs error and exits gracefully (process.exit(0)).
 *
 * @param transport - The MCP transport instance (stdio)
 */
export function setupHeartbeat(transport: any): void {
  // Clear any existing heartbeat
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  heartbeatTimer = setInterval(async () => {
    try {
      // Send a JSON-RPC ping notification via the transport
      if (transport && typeof transport.send === 'function') {
        await transport.send({
          jsonrpc: '2.0',
          method: 'notifications/ping',
          params: {},
        });
      } else if (transport && typeof transport.write === 'function') {
        // Fallback for raw stdio streams
        const pingMessage = JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/ping',
          params: {},
        });
        transport.write(pingMessage + '\n');
      }
    } catch (error) {
      console.error('[clarik] Heartbeat ping failed — connection may be lost:', error);
      stopHeartbeat();
      // Exit gracefully on connection loss
      process.exit(0);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Don't keep the process alive just for heartbeats
  if (heartbeatTimer && typeof heartbeatTimer.unref === 'function') {
    heartbeatTimer.unref();
  }
}

/**
 * Stop the heartbeat timer.
 * Called internally on failure or externally during cleanup.
 */
export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
