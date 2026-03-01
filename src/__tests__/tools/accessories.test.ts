import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HomebridgeClient } from '../../homebridge-client.js';
import { register } from '../../tools/accessories.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAccessory(overrides: Record<string, unknown> = {}) {
  return {
    uniqueId: 'acc-1',
    serviceName: 'Living Room Light',
    type: 'Lightbulb',
    accessoryInformation: { Manufacturer: 'Philips', Model: 'Hue', Name: 'Light' },
    serviceCharacteristics: [{ type: 'On', value: true }],
    values: { On: true, Brightness: 75 },
    ...overrides,
  };
}

function makeRoom(name: string, uniqueIds: string[]) {
  return {
    name,
    services: uniqueIds.map((id) => ({ uniqueId: id })),
  };
}

function mockClient(overrides: Partial<HomebridgeClient> = {}): HomebridgeClient {
  return {
    getAccessories: vi.fn().mockResolvedValue([]),
    getAccessoryLayout: vi.fn().mockResolvedValue([]),
    setAccessoryCharacteristic: vi.fn().mockResolvedValue({ ok: true }),
    getHomebridgeStatus: vi.fn(),
    getServerInformation: vi.fn(),
    restartServer: vi.fn(),
    getPairingInfo: vi.fn(),
    getCachedAccessories: vi.fn(),
    removeCachedAccessory: vi.fn(),
    resetCachedAccessories: vi.fn(),
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

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;

function extractToolHandlers(client: HomebridgeClient) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  const handlers = new Map<string, ToolHandler>();
  const origTool = server.tool.bind(server);

  // Intercept tool registrations to capture handlers
  vi.spyOn(server, 'tool').mockImplementation((...args: unknown[]) => {
    // The handler is always the last argument
    const handler = args[args.length - 1] as ToolHandler;
    const name = args[0] as string;
    handlers.set(name, handler);
    return origTool(...(args as Parameters<typeof origTool>));
  });

  register(server, client);
  return handlers;
}

// ── Tests ──────────────────────────────────────────────────────

describe('accessories tools', () => {
  describe('list_accessories', () => {
    it('returns compact accessories', async () => {
      const acc = makeAccessory();
      const client = mockClient({ getAccessories: vi.fn().mockResolvedValue([acc]) });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('list_accessories')!({});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).toEqual([
        {
          uniqueId: 'acc-1',
          serviceName: 'Living Room Light',
          type: 'Lightbulb',
          manufacturer: 'Philips',
          model: 'Hue',
          values: { On: true, Brightness: 75 },
        },
      ]);
    });

    it('filters by type (case-insensitive)', async () => {
      const light = makeAccessory({ uniqueId: 'l1', type: 'Lightbulb' });
      const sw = makeAccessory({ uniqueId: 's1', type: 'Switch', serviceName: 'Fan' });
      const client = mockClient({ getAccessories: vi.fn().mockResolvedValue([light, sw]) });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('list_accessories')!({ type: 'switch' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].uniqueId).toBe('s1');
    });

    it('filters by manufacturer (case-insensitive, contains)', async () => {
      const philips = makeAccessory({ uniqueId: 'p1' });
      const ikea = makeAccessory({
        uniqueId: 'i1',
        accessoryInformation: { Manufacturer: 'IKEA' },
      });
      const client = mockClient({ getAccessories: vi.fn().mockResolvedValue([philips, ikea]) });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('list_accessories')!({ manufacturer: 'phil' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].uniqueId).toBe('p1');
    });

    it('filters by excludeManufacturer', async () => {
      const philips = makeAccessory({ uniqueId: 'p1' });
      const ikea = makeAccessory({
        uniqueId: 'i1',
        accessoryInformation: { Manufacturer: 'IKEA' },
      });
      const client = mockClient({ getAccessories: vi.fn().mockResolvedValue([philips, ikea]) });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('list_accessories')!({ excludeManufacturer: 'philips' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].uniqueId).toBe('i1');
    });

    it('filters by name (case-insensitive, contains)', async () => {
      const light = makeAccessory({ uniqueId: 'l1', serviceName: 'Living Room Light' });
      const fan = makeAccessory({ uniqueId: 'f1', serviceName: 'Kitchen Fan' });
      const client = mockClient({ getAccessories: vi.fn().mockResolvedValue([light, fan]) });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('list_accessories')!({ name: 'kitchen' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].uniqueId).toBe('f1');
    });

    it('filters by room', async () => {
      const a1 = makeAccessory({ uniqueId: 'a1' });
      const a2 = makeAccessory({ uniqueId: 'a2', serviceName: 'Bedroom Light' });
      const rooms = [makeRoom('Living Room', ['a1']), makeRoom('Bedroom', ['a2'])];
      const client = mockClient({
        getAccessories: vi.fn().mockResolvedValue([a1, a2]),
        getAccessoryLayout: vi.fn().mockResolvedValue(rooms),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('list_accessories')!({ room: 'Bedroom' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].uniqueId).toBe('a2');
    });

    it('returns error when room not found', async () => {
      const rooms = [makeRoom('Living Room', ['a1'])];
      const client = mockClient({
        getAccessories: vi.fn().mockResolvedValue([]),
        getAccessoryLayout: vi.fn().mockResolvedValue(rooms),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('list_accessories')!({ room: 'Garage' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Room not found');
      expect(result.content[0].text).toContain('Living Room');
    });

    it('handles API errors gracefully', async () => {
      const client = mockClient({
        getAccessories: vi.fn().mockRejectedValue(new Error('Network error')),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('list_accessories')!({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error listing accessories');
    });

    it('handles missing accessoryInformation gracefully', async () => {
      const acc = makeAccessory({
        accessoryInformation: {},
        values: undefined,
      });
      const client = mockClient({ getAccessories: vi.fn().mockResolvedValue([acc]) });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('list_accessories')!({});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed[0].manufacturer).toBeNull();
      expect(parsed[0].model).toBeNull();
      expect(parsed[0].values).toEqual({});
    });
  });

  describe('get_accessory', () => {
    it('returns full accessory by uniqueId', async () => {
      const acc = makeAccessory({ uniqueId: 'abc' });
      const client = mockClient({ getAccessories: vi.fn().mockResolvedValue([acc]) });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('get_accessory')!({ uniqueId: 'abc' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.uniqueId).toBe('abc');
      expect(result.isError).toBeUndefined();
    });

    it('returns error when accessory not found', async () => {
      const client = mockClient({ getAccessories: vi.fn().mockResolvedValue([]) });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('get_accessory')!({ uniqueId: 'missing' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('set_accessory', () => {
    it('calls setAccessoryCharacteristic and returns result', async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('set_accessory')!({
        uniqueId: 'acc-1',
        characteristicType: 'Brightness',
        value: 50,
      });

      expect(client.setAccessoryCharacteristic).toHaveBeenCalledWith('acc-1', 'Brightness', 50);
      expect(result.isError).toBeUndefined();
    });

    it('handles errors', async () => {
      const client = mockClient({
        setAccessoryCharacteristic: vi.fn().mockRejectedValue(new Error('fail')),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('set_accessory')!({
        uniqueId: 'x',
        characteristicType: 'On',
        value: true,
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('get_accessory_layout', () => {
    it('returns enriched layout with accessory details', async () => {
      const accessories = [
        makeAccessory({ uniqueId: 'a1', serviceName: 'Lamp', type: 'Lightbulb' }),
      ];
      const layout = [{ name: 'Living Room', services: [{ uniqueId: 'a1' }] }];
      const client = mockClient({
        getAccessories: vi.fn().mockResolvedValue(accessories),
        getAccessoryLayout: vi.fn().mockResolvedValue(layout),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('get_accessory_layout')!({});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed[0].name).toBe('Living Room');
      expect(parsed[0].services[0].serviceName).toBe('Lamp');
      expect(parsed[0].services[0].type).toBe('Lightbulb');
    });

    it('falls back to customName when accessory not in map', async () => {
      const layout = [
        { name: 'Room', services: [{ uniqueId: 'unknown', customName: 'Custom' }] },
      ];
      const client = mockClient({
        getAccessories: vi.fn().mockResolvedValue([]),
        getAccessoryLayout: vi.fn().mockResolvedValue(layout),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get('get_accessory_layout')!({});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed[0].services[0].serviceName).toBe('Custom');
      expect(parsed[0].services[0].type).toBe('Unknown');
    });
  });
});
