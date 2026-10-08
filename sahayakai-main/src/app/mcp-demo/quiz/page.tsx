"use client";

import { McpQuizView } from '@/features/mcp-demo/quiz/mcp-quiz-view';
import { useMcpQuiz } from '@/features/mcp-demo/quiz/use-mcp-quiz';

/**
 * /mcp-demo/quiz — Sahayak's Quiz Generator consumed through the Sahayak MCP
 * server (create_quiz over Streamable HTTP) via the authenticated demo API.
 * Docs: docs/mcp/quiz/README.md
 */
export default function McpQuizDemoPage() {
    const state = useMcpQuiz();
    return <McpQuizView {...state} />;
}
