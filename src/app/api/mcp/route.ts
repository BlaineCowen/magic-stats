import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { keyFrom, overLimit } from "@/lib/mcp/keys";
import { buildServer } from "@/lib/mcp/server";

/**
 * The Magic Stats connector (MCP over streamable HTTP), for ChatGPT apps,
 * Claude custom connectors and other MCP clients. Connect with
 *   https://projects.blainecowen.com/api/mcp?key=ms_...
 * Keys come from scripts/mcp-key.mjs; with no keys file, every call is refused.
 * Stateless: each request gets a fresh server and plain JSON replies, so there
 * are no sessions to keep and no event streams for the proxy to buffer.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (status: number, body: unknown, headers?: HeadersInit) =>
  Response.json(body, { status, headers });

async function handle(request: Request): Promise<Response> {
  const key = keyFrom(request);
  if (!key) {
    return json(
      401,
      {
        jsonrpc: "2.0",
        error: { code: -32001, message: "Missing or unknown Magic Stats key." },
        id: null,
      },
      { "WWW-Authenticate": 'Bearer realm="magic-stats"' },
    );
  }
  if (request.method === "POST") {
    const broke = overLimit(key.id);
    if (broke) {
      return json(
        429,
        {
          jsonrpc: "2.0",
          error: {
            code: -32002,
            message: `Limit reached (${broke}). Try again later.`,
          },
          id: null,
        },
        { "Retry-After": "60" },
      );
    }
  }
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = buildServer(key);
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // The JSON reply is complete once handleRequest resolves.
    void server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
