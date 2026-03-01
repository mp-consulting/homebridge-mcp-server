import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HomebridgeClient } from '../homebridge-client.js';

export function register(server: McpServer, client: HomebridgeClient): void {
  server.tool(
    'get_config',
    'Read the current Homebridge config.json file content. Returns the full configuration including bridge settings, accessories, and platforms.',
    {},
    async () => {
      try {
        const config = await client.getConfig();
        return {
          content: [{ type: 'text', text: JSON.stringify(config, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting config: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'update_config',
    'Update the Homebridge config.json file. You must provide the FULL config object — it replaces the entire file. Use get_config first to read the current config, then modify and pass back the complete object.',
    {
      config: z
        .record(z.string(), z.unknown())
        .describe('The complete config.json object to write'),
    },
    async ({ config }) => {
      try {
        const result = await client.updateConfig(config);
        return {
          content: [
            {
              type: 'text',
              text: result
                ? JSON.stringify(result, null, 2)
                : 'Config updated successfully. A Homebridge restart may be required for changes to take effect.',
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error updating config: ${error}` }],
          isError: true,
        };
      }
    },
  );
}
