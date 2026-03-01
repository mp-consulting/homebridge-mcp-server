import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HomebridgeClient } from '../../src/homebridge-client.js';
import { register } from '../../src/tools/plugins.js';

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

function mockClient(overrides: Partial<HomebridgeClient> = {}): HomebridgeClient {
  return {
    getAccessories: vi.fn(),
    getAccessoryLayout: vi.fn(),
    setAccessoryCharacteristic: vi.fn(),
    getHomebridgeStatus: vi.fn(),
    getServerInformation: vi.fn(),
    restartServer: vi.fn(),
    getPairingInfo: vi.fn(),
    getCachedAccessories: vi.fn(),
    removeCachedAccessory: vi.fn(),
    resetCachedAccessories: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getPlugins: vi.fn().mockResolvedValue([{ name: 'homebridge-hue', version: '1.0.0' }]),
    searchPlugins: vi.fn().mockResolvedValue([{ name: 'homebridge-camera-ffmpeg' }]),
    lookupPlugin: vi.fn().mockResolvedValue({ name: 'homebridge-hue', description: 'Hue plugin' }),
    getPluginVersions: vi.fn().mockResolvedValue({ tags: { latest: '1.0.0' } }),
    getPluginConfigSchema: vi.fn().mockResolvedValue({ schema: {} }),
    getPluginChangelog: vi.fn().mockResolvedValue('# Changelog\n## 1.0.0'),
    getSystemInfo: vi.fn(),
    ...overrides,
  } as unknown as HomebridgeClient;
}

function extractToolHandlers(client: HomebridgeClient) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  const handlers = new Map<string, ToolHandler>();
  const origTool = server.tool.bind(server);

  vi.spyOn(server, 'tool').mockImplementation((...args: unknown[]) => {
    const handler = args[args.length - 1] as ToolHandler;
    const name = args[0] as string;
    handlers.set(name, handler);
    return origTool(...(args as Parameters<typeof origTool>));
  });

  register(server, client);
  return handlers;
}

describe('plugins tools', () => {
  describe('list_plugins', () => {
    it('returns plugin list', async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('list_plugins')!({});
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual([{ name: 'homebridge-hue', version: '1.0.0' }]);
    });

    it('handles errors', async () => {
      const client = mockClient({
        getPlugins: vi.fn().mockRejectedValue(new Error('fail')),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('list_plugins')!({});
      expect(result.isError).toBe(true);
    });
  });

  describe('search_plugins', () => {
    it('searches and returns results', async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('search_plugins')!({ query: 'camera' });
      expect(client.searchPlugins).toHaveBeenCalledWith('camera');
      expect(result.isError).toBeUndefined();
    });
  });

  describe('lookup_plugin', () => {
    it('returns plugin details', async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('lookup_plugin')!({ pluginName: 'homebridge-hue' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.name).toBe('homebridge-hue');
    });
  });

  describe('get_plugin_versions', () => {
    it('returns versions', async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('get_plugin_versions')!({ pluginName: 'homebridge-hue' });
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.tags.latest).toBe('1.0.0');
    });
  });

  describe('get_plugin_config_schema', () => {
    it('returns config schema', async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('get_plugin_config_schema')!({ pluginName: 'homebridge-hue' });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('get_plugin_changelog', () => {
    it('returns string changelog as-is', async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('get_plugin_changelog')!({ pluginName: 'homebridge-hue' });
      expect(result.content[0].text).toBe('# Changelog\n## 1.0.0');
    });

    it('stringifies non-string changelog', async () => {
      const client = mockClient({
        getPluginChangelog: vi.fn().mockResolvedValue({ entries: [] }),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('get_plugin_changelog')!({ pluginName: 'homebridge-hue' });
      expect(JSON.parse(result.content[0].text)).toEqual({ entries: [] });
    });

    it('handles errors', async () => {
      const client = mockClient({
        getPluginChangelog: vi.fn().mockRejectedValue(new Error('fail')),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('get_plugin_changelog')!({ pluginName: 'x' });
      expect(result.isError).toBe(true);
    });
  });
});
