import { Composio } from "@composio/core";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const composio = new Composio({
    apiKey: process.env.COMPOSIO_API_KEY,
  });

  const userId = process.env.USER_ID || "default-user";

  const session = await composio.create(userId);

  console.log("\nComposio MCP URL:");
  console.log(session.mcp.url);

  console.log("\nMCP headers:");
  console.log(JSON.stringify(session.mcp.headers, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});