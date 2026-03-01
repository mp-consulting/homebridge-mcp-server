import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HomebridgeClient } from '../../homebridge-client.js';
import { register } from '../../tools/server.js';

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

function mockClient(overrides: Partial<HomebridgeClient> = {}): HomebridgeClient {
  return {
    getAccessories: vi.fn(),
    getAccessoryLayout: vi.fn(),
    setAccessoryCharacteristic: vi.fn(),
    getHomebridgeStatus: vi.fn().mockResolvedValue({ status: 'up' }),
    getServerInformation: vi.fn().mockResolvedValue({ version: '1.0.0' }),
    restartServer: vi.fn().mockResolvedValue(null),
    getPairingInfo: vi.fn().mockResolvedValue({ setupCode: '123-45-678' }),
    getCachedAccessories: vi.fn().mockResolvedValue([]),
    removeCachedAccessory: vi.fn().mockResolvedValue(undefined),
    resetCachedAccessories: vi.fn().mockResolvedValue(undefined),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getPlugins: vi.fn(),
    searchPlugins: vi.fn(),
    lookupPlugin: vi.fn(),
    getPluginVersions: vi.fn(),
    getPluginConfigSchema: vi.fn(),
    getPluginChangelog: vi.fn(),
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

describe('server tools', () => {
  describe('get_homebridge_status', () => {
    it('returns status', async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('get_homebridge_status')!({});
      expect(JSON.parse(result.content[0].text)).toEqual({ status: 'up' });
    });

    it('handles errors', async () => {
      const client = mockClient({
        getHomebridgeStatus: vi.fn().mockRejectedValue(new Error('fail')),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('get_homebridge_status')!({});
      expect(result.isError).toBe(true);
    });
  });

  describe('get_server_status', () => {
    it('returns server information', async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('get_server_status')!({});
      expect(JSON.parse(result.content[0].text)).toEqual({ version: '1.0.0' });
    });
  });

  describe('restart_homebridge', () => {
    it('returns success message when result is falsy', async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('restart_homebridge')!({});
      expect(result.content[0].text).toContain('restart initiated successfully');
    });

    it('returns JSON when result is truthy', async () => {
      const client = mockClient({
        restartServer: vi.fn().mockResolvedValue({ status: 'restarting' }),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('restart_homebridge')!({});
      expect(JSON.parse(result.content[0].text)).toEqual({ status: 'restarting' });
    });
  });

  describe('get_pairing_info', () => {
    it('returns pairing info', async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('get_pairing_info')!({});
      expect(JSON.parse(result.content[0].text)).toEqual({ setupCode: '123-45-678' });
    });
  });

  describe('get_cached_accessories', () => {
    it('returns cached accessories', async () => {
      const client = mockClient({
        getCachedAccessories: vi.fn().mockResolvedValue([{ uuid: 'u1' }]),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('get_cached_accessories')!({});
      expect(JSON.parse(result.content[0].text)).toEqual([{ uuid: 'u1' }]);
    });
  });

  describe('remove_cached_accessory', () => {
    it('returns success message', async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('remove_cached_accessory')!({ uuid: 'u1' });
      expect(result.content[0].text).toContain('u1');
      expect(result.content[0].text).toContain('removed successfully');
    });

    it('handles errors', async () => {
      const client = mockClient({
        removeCachedAccessory: vi.fn().mockRejectedValue(new Error('fail')),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('remove_cached_accessory')!({ uuid: 'u1' });
      expect(result.isError).toBe(true);
    });
  });

  describe('reset_cached_accessories', () => {
    it('returns success message', async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('reset_cached_accessories')!({});
      expect(result.content[0].text).toContain('reset');
    });
  });
});
