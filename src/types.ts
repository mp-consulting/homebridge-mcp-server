import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HomebridgeClient } from './homebridge-client.js';

/**
 * Signature for tool registration functions.
 * Each tools/*.ts file exports a `register` function matching this type.
 */
export type RegisterTools = (server: McpServer, client: HomebridgeClient) => void;
