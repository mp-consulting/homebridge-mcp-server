import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HomebridgeClient } from '../homebridge-client.js';

export function register(server: McpServer, client: HomebridgeClient): void {
  server.tool(
    'list_plugins',
    'List all currently installed Homebridge plugins with their versions and update status.',
    {},
    async () => {
      try {
        const plugins = await client.getPlugins();
        return {
          content: [{ type: 'text', text: JSON.stringify(plugins, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error listing plugins: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'search_plugins',
    'Search the npm registry for Homebridge plugins matching a query.',
    {
      query: z.string().describe("Search query (e.g. 'hue', 'camera', 'thermostat')"),
    },
    async ({ query }) => {
      try {
        const results = await client.searchPlugins(query);
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error searching plugins: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'lookup_plugin',
    'Get detailed information about a specific Homebridge plugin from the npm registry.',
    {
      pluginName: z
        .string()
        .describe("The npm package name of the plugin (e.g. 'homebridge-hue')"),
    },
    async ({ pluginName }) => {
      try {
        const plugin = await client.lookupPlugin(pluginName);
        return {
          content: [{ type: 'text', text: JSON.stringify(plugin, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error looking up plugin: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'get_plugin_versions',
    'Get available versions and dist-tags for a specific Homebridge plugin.',
    {
      pluginName: z
        .string()
        .describe("The npm package name of the plugin (e.g. 'homebridge-hue')"),
    },
    async ({ pluginName }) => {
      try {
        const versions = await client.getPluginVersions(pluginName);
        return {
          content: [{ type: 'text', text: JSON.stringify(versions, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting plugin versions: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'get_plugin_config_schema',
    'Get the config.schema.json for a plugin, which describes how to configure it in Homebridge.',
    {
      pluginName: z
        .string()
        .describe("The npm package name of the plugin (e.g. 'homebridge-hue')"),
    },
    async ({ pluginName }) => {
      try {
        const schema = await client.getPluginConfigSchema(pluginName);
        return {
          content: [{ type: 'text', text: JSON.stringify(schema, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting plugin config schema: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'get_plugin_changelog',
    'Get the CHANGELOG.md content for an installed Homebridge plugin.',
    {
      pluginName: z
        .string()
        .describe("The npm package name of the plugin (e.g. 'homebridge-hue')"),
    },
    async ({ pluginName }) => {
      try {
        const changelog = await client.getPluginChangelog(pluginName);
        return {
          content: [
            {
              type: 'text',
              text: typeof changelog === 'string' ? changelog : JSON.stringify(changelog, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error getting plugin changelog: ${error}` }],
          isError: true,
        };
      }
    },
  );
}
