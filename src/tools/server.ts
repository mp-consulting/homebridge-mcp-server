import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HomebridgeClient } from '../homebridge-client.js';

export function register(server: McpServer, client: HomebridgeClient): void {
  server.tool(
    'get_homebridge_status',
    'Check if Homebridge is running and get its current status (up/down, version, plugins status).',
    {},
    async () => {
      try {
        const status = await client.getHomebridgeStatus();
        return {
          content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting Homebridge status: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'get_server_status',
    'Get Homebridge server information including version, Node.js version, uptime, OS details, and Homebridge instance ID.',
    {},
    async () => {
      try {
        const info = await client.getServerInformation();
        return {
          content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting server info: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'restart_homebridge',
    'Restart the Homebridge service. This will temporarily make all accessories unavailable.',
    {},
    async () => {
      try {
        const result = await client.restartServer();
        return {
          content: [
            {
              type: 'text',
              text: result
                ? JSON.stringify(result, null, 2)
                : 'Homebridge restart initiated successfully.',
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error restarting Homebridge: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'get_pairing_info',
    'Get the HomeKit pairing information (setup code, QR code URL) for this Homebridge instance.',
    {},
    async () => {
      try {
        const pairing = await client.getPairingInfo();
        return {
          content: [{ type: 'text', text: JSON.stringify(pairing, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting pairing info: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'get_cached_accessories',
    'List all cached accessories stored by Homebridge. These persist across restarts.',
    {},
    async () => {
      try {
        const cached = await client.getCachedAccessories();
        return {
          content: [{ type: 'text', text: JSON.stringify(cached, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting cached accessories: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'remove_cached_accessory',
    'Remove a specific cached accessory by its UUID. Useful for cleaning up stale accessories.',
    {
      uuid: z.string().describe('The UUID of the cached accessory to remove'),
    },
    async ({ uuid }) => {
      try {
        await client.removeCachedAccessory(uuid);
        return {
          content: [{ type: 'text', text: `Cached accessory ${uuid} removed successfully.` }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error removing cached accessory: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'reset_cached_accessories',
    'Reset ALL cached accessories. WARNING: This removes all cached accessories and requires a Homebridge restart.',
    {},
    async () => {
      try {
        await client.resetCachedAccessories();
        return {
          content: [
            {
              type: 'text',
              text: 'All cached accessories have been reset. A Homebridge restart may be required.',
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error resetting cached accessories: ${error}` }],
          isError: true,
        };
      }
    },
  );
}
