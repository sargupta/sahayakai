"use client";

import { useMcpCalling } from "@/features/mcp-demo/calling/use-mcp-calling";
import { McpCallingView } from "@/features/mcp-demo/calling/mcp-calling-view";

/**
 * /mcp-demo/calling — the attendance "Contact" capability consumed through the
 * Sahayak Parent Calling MCP (initiate_parent_call over Streamable HTTP).
 * The app's own /attendance pages are untouched.
 */
export default function McpCallingDemoPage() {
    const state = useMcpCalling();
    return <McpCallingView {...state} />;
}
