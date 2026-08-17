import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { HomebridgeClient } from '../homebridge-client.js';
import { z } from 'zod';
import { statSync, openSync, readSync, closeSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ANSI_REGEX = /\x1b\[[0-9;]*m/g;
const MAX_READ_BYTES = 16 * 1024 * 1024;

function getLogPath(): string {
  return process.env.HOMEBRIDGE_LOG_PATH || join(homedir(), '.homebridge', 'homebridge.log');
}

function readLogTail(): string {
  const path = getLogPath();
  const { size } = statSync(path);
  const start = Math.max(0, size - MAX_READ_BYTES);
  const len = size - start;
  if (len === 0) {
    return '';
  }
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, start);
    return buf.toString('utf8');
  } finally {
    closeSync(fd);
  }
}

function stripAnsi(s: string): string {
  return s.replace(ANSI_REGEX, '');
}

function splitLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

export function register(server: McpServer, _client: HomebridgeClient): void {
  server.tool(
    'get_recent_logs',
    'Return the most recent lines from the Homebridge log file (ANSI-stripped). Reads $HOMEBRIDGE_LOG_PATH or ~/.homebridge/homebridge.log.',
    {
      lines: z
        .number()
        .int()
        .min(1)
        .max(5000)
        .optional()
        .describe('Number of lines to return from the tail (default 200, max 5000).'),
    },
    async ({ lines }) => {
      try {
        const n = lines ?? 200;
        const all = splitLines(readLogTail());
        const taken = all.slice(-n);
        return {
          content: [{ type: 'text', text: stripAnsi(taken.join('\n')) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error reading log file at ${getLogPath()}: ${error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'search_logs',
    'Search the Homebridge log file for matching lines. Returns up to `limit` most recent matches (ANSI-stripped). Useful for finding errors, warnings, or events involving a specific device.',
    {
      pattern: z.string().min(1).describe('Substring or regex pattern to match against each log line.'),
      regex: z
        .boolean()
        .optional()
        .describe('Treat pattern as a JavaScript regex (default: false, treats pattern as a literal substring).'),
      caseSensitive: z.boolean().optional().describe('Case-sensitive match (default: false).'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(2000)
        .optional()
        .describe('Maximum matches to return, taken from the most recent (default 100, max 2000).'),
    },
    async ({ pattern, regex, caseSensitive, limit }) => {
      try {
        const max = limit ?? 100;
        const cs = caseSensitive ?? false;
        let test: (line: string) => boolean;
        if (regex) {
          const re = new RegExp(pattern, cs ? '' : 'i');
          test = (line) => re.test(line);
        } else {
          const needle = cs ? pattern : pattern.toLowerCase();
          test = (line) => (cs ? line : line.toLowerCase()).includes(needle);
        }
        const matches: string[] = [];
        for (const line of splitLines(readLogTail())) {
          if (test(line)) {
            matches.push(line);
          }
        }
        const taken = matches.slice(-max);
        const label = regex
          ? `/${pattern}/${cs ? '' : 'i'}`
          : JSON.stringify(pattern) + (cs ? ' (case-sensitive)' : '');
        const header = `Showing ${taken.length} of ${matches.length} match${matches.length === 1 ? '' : 'es'} for ${label}.`;
        const body = stripAnsi(taken.join('\n'));
        return {
          content: [{ type: 'text', text: body ? `${header}\n\n${body}` : header }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error searching log file at ${getLogPath()}: ${error}` }],
          isError: true,
        };
      }
    },
  );
}
