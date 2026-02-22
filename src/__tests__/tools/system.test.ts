import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HomebridgeClient } from "../../homebridge-client.js";
import { register } from "../../tools/system.js";

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
    getPlugins: vi.fn(),
    searchPlugins: vi.fn(),
    lookupPlugin: vi.fn(),
    getPluginVersions: vi.fn(),
    getPluginConfigSchema: vi.fn(),
    getPluginChangelog: vi.fn(),
    getSystemInfo: vi.fn().mockResolvedValue({ cpu: { model: "ARM" }, memory: { total: 4096 } }),
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

describe("system tools", () => {
  describe("get_system_info", () => {
    it("returns system info", async () => {
      const client = mockClient();
      const handlers = extractToolHandlers(client);
      const result = await handlers.get("get_system_info")!({});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.cpu.model).toBe("ARM");
      expect(parsed.memory.total).toBe(4096);
    });

    it("handles errors", async () => {
      const client = mockClient({
        getSystemInfo: vi.fn().mockRejectedValue(new Error("fail")),
      });
      const handlers = extractToolHandlers(client);
      const result = await handlers.get("get_system_info")!({});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error getting system info");
    });
  });
});
