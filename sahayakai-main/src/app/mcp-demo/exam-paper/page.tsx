"use client";

import { McpExamPaperView } from '@/features/mcp-demo/exam-paper/mcp-exam-paper-view';
import { useMcpExamPaper } from '@/features/mcp-demo/exam-paper/use-mcp-exam-paper';

export default function McpExamPaperDemoPage() {
    const state = useMcpExamPaper();
    return <McpExamPaperView {...state} />;
}
