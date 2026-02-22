import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HomebridgeClient } from "../homebridge-client.js";

export function register(server: McpServer, client: HomebridgeClient): void {
  server.tool(
    "get_system_info",
    "Get system information for the machine running Homebridge (CPU, memory, OS, network interfaces, uptime).",
    {},
    async () => {
      try {
        const info = await client.getSystemInfo();
        return {
          content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting system info: ${error}` }],
          isError: true,
        };
      }
    },
  );
}
