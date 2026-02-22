import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HomebridgeClient } from "../homebridge-client.js";

interface RawAccessory {
  uniqueId: string;
  serviceName: string;
  type: string;
  accessoryInformation: { Manufacturer?: string; Model?: string; Name?: string };
  serviceCharacteristics: Array<{ type: string; value: unknown }>;
  values: Record<string, unknown>;
}

interface RawRoom {
  name: string;
  services: Array<{ uniqueId: string; customName?: string }>;
}

function compactAccessory(acc: RawAccessory) {
  return {
    uniqueId: acc.uniqueId,
    serviceName: acc.serviceName,
    type: acc.type,
    manufacturer: acc.accessoryInformation?.Manufacturer ?? null,
    model: acc.accessoryInformation?.Model ?? null,
    values: acc.values ?? {},
  };
}

export function register(server: McpServer, client: HomebridgeClient): void {
  server.tool(
    "list_accessories",
    "List all Homebridge accessories with their current state (on/off, brightness, temperature, etc.)",
    {
      room: z.string().optional().describe("Filter by room name (case-insensitive)"),
      type: z.string().optional().describe("Filter by accessory type (e.g. 'Lightbulb', 'Switch', 'Thermostat')"),
      manufacturer: z.string().optional().describe("Filter by manufacturer (case-insensitive, contains match)"),
      excludeManufacturer: z.string().optional().describe("Exclude accessories from this manufacturer (case-insensitive, contains match)"),
      name: z.string().optional().describe("Filter by service name (case-insensitive, contains match)"),
    },
    async ({ room, type, manufacturer, excludeManufacturer, name }) => {
      try {
        let accessories = (await client.getAccessories()) as RawAccessory[];

        // Room filter: resolve UIDs from layout
        if (room) {
          const layout = (await client.getAccessoryLayout()) as RawRoom[];
          const matchedRoom = layout.find(
            (r) => r.name.toLowerCase() === room.toLowerCase(),
          );
          if (!matchedRoom) {
            return {
              content: [{ type: "text", text: `Room not found: "${room}". Available rooms: ${layout.map((r) => r.name).join(", ")}` }],
              isError: true,
            };
          }
          const roomUids = new Set(matchedRoom.services.map((s) => s.uniqueId));
          accessories = accessories.filter((a) => roomUids.has(a.uniqueId));
        }

        if (type) {
          accessories = accessories.filter(
            (a) => a.type?.toLowerCase() === type.toLowerCase(),
          );
        }

        if (manufacturer) {
          const mfr = manufacturer.toLowerCase();
          accessories = accessories.filter(
            (a) => a.accessoryInformation?.Manufacturer?.toLowerCase().includes(mfr),
          );
        }

        if (excludeManufacturer) {
          const excl = excludeManufacturer.toLowerCase();
          accessories = accessories.filter(
            (a) => !a.accessoryInformation?.Manufacturer?.toLowerCase().includes(excl),
          );
        }

        if (name) {
          const n = name.toLowerCase();
          accessories = accessories.filter(
            (a) => a.serviceName?.toLowerCase().includes(n),
          );
        }

        const compact = accessories.map(compactAccessory);
        return {
          content: [{ type: "text", text: JSON.stringify(compact, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error listing accessories: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "get_accessory",
    "Get detailed information about a specific accessory by its uniqueId. Use list_accessories first to find the uniqueId.",
    { uniqueId: z.string().describe("The unique identifier of the accessory") },
    async ({ uniqueId }) => {
      try {
        const accessories = await client.getAccessories();
        const accessory = (accessories as Array<Record<string, unknown>>).find(
          (a) => a.uniqueId === uniqueId,
        );
        if (!accessory) {
          return {
            content: [{ type: "text", text: `Accessory not found with uniqueId: ${uniqueId}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text", text: JSON.stringify(accessory, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting accessory: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "set_accessory",
    "Control a Homebridge accessory — turn it on/off, set brightness, color temperature, etc. Use list_accessories first to find the uniqueId and available characteristicTypes.",
    {
      uniqueId: z.string().describe("The unique identifier of the accessory"),
      characteristicType: z
        .string()
        .describe(
          "The characteristic to set (e.g. 'On', 'Brightness', 'ColorTemperature', 'Hue', 'Saturation', 'TargetTemperature', 'TargetDoorState')",
        ),
      value: z
        .union([z.string(), z.number(), z.boolean()])
        .describe("The value to set (e.g. true/false for On, 0-100 for Brightness)"),
    },
    async ({ uniqueId, characteristicType, value }) => {
      try {
        const result = await client.setAccessoryCharacteristic(uniqueId, characteristicType, value);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error setting accessory: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "get_accessory_layout",
    "Get the accessories room layout as configured in the Homebridge UI.",
    {},
    async () => {
      try {
        const [layout, accessories] = await Promise.all([
          client.getAccessoryLayout() as Promise<RawRoom[]>,
          client.getAccessories() as Promise<RawAccessory[]>,
        ]);

        const accessoryMap = new Map<string, RawAccessory>();
        for (const acc of accessories) {
          accessoryMap.set(acc.uniqueId, acc);
        }

        const enriched = layout.map((room) => ({
          name: room.name,
          services: room.services.map((svc) => {
            const acc = accessoryMap.get(svc.uniqueId);
            return {
              uniqueId: svc.uniqueId,
              serviceName: acc?.serviceName ?? svc.customName ?? "Unknown",
              type: acc?.type ?? "Unknown",
              manufacturer: acc?.accessoryInformation?.Manufacturer ?? null,
            };
          }),
        }));

        return {
          content: [{ type: "text", text: JSON.stringify(enriched, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error getting layout: ${error}` }],
          isError: true,
        };
      }
    },
  );
}
