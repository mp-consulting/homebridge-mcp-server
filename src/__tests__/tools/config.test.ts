import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HomebridgeClient } from "../../homebridge-client.js";
import { register } from "../../tools/config.js";

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
    getConfig: vi.fn().mockResolvedValue({ bridge: { name: "Homebridge" } }),
    updateConfig: vi.fn().mockResolvedValue(null),
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
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const handlers = new Map<string, ToolHandler>();
  const origTool = server.tool.bind(server);

  vi.spyOn(server, "tool").mockImplementation((...args: unknown[]) => {
    const handler = args[args.length - 1] as ToolHandler;
    const name = args[0] as string;
    handlers.set(name, handler);
    return origTool(...(args as Parameters<typeof origTool>));
  });

  register(server, client);
  return handlers;
}

describe("config tools", () => {
  describe("get_config", () => {
    it("returns config JSON", async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get("get_config")!({});
      expect(JSON.parse(result.content[0].text)).toEqual({ bridge: { name: "Homebridge" } });
    });

    it("handles errors", async () => {
      const client = mockClient({
        getConfig: vi.fn().mockRejectedValue(new Error("fail")),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get("get_config")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error getting config");
    });
  });

  describe("update_config", () => {
    it("returns success message when result is falsy", async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get("update_config")!({ config: { bridge: {} } });
      expect(result.content[0].text).toContain("Config updated successfully");
      expect(client.updateConfig).toHaveBeenCalledWith({ bridge: {} });
    });

    it("returns JSON when result is truthy", async () => {
      const client = mockClient({
        updateConfig: vi.fn().mockResolvedValue({ saved: true }),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get("update_config")!({ config: { bridge: {} } });
      expect(JSON.parse(result.content[0].text)).toEqual({ saved: true });
    });

    it("handles errors", async () => {
      const client = mockClient({
        updateConfig: vi.fn().mockRejectedValue(new Error("fail")),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get("update_config")!({ config: {} });
      expect(result.isError).toBe(true);
    });
  });
});
