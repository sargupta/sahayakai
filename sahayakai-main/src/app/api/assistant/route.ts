
import { NextRequest, NextResponse } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

// Use the verified model
const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    apiKey: process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const { message, history, context } = await req.json();

        const messages = [];

        // System Prompt
        messages.push(new SystemMessage(`
You are 'Sahayak Assistant', a helpful and friendly pedagogical coach for teachers in India.
Your goal is to help teachers improve their practice, plan lessons, and support their students.

CONTEXT (What the user is seeing):
${context || "No specific advice is currently displayed."}

INSTRUCTIONS:
- Answer the user's questions helpfuly.
- If the user asks for a lesson plan, worksheet, or quiz, provide a *brief* outline or draft to help them immediately.
- CRITICAL: After providing the draft, politely suggest they use the specialized tools in the sidebar (Lesson Plan, Worksheet Wizard, etc.) for a more comprehensive and formatted result.
- Be encouraging, practical, and culturally relevant to Indian schools.
- Keep answers concise (under 4 sentences) unless asked for details.
    `));

        // Previous Chat History
        if (history && Array.isArray(history)) {
            history.forEach((turn: any) => {
                if (turn.user) messages.push(new HumanMessage(turn.user));
                if (turn.ai) messages.push(new AIMessage(turn.ai));
            });
        }

        // Current User Message
        messages.push(new HumanMessage(message));

        // Generate Response
        const response = await model.invoke(messages);

        return NextResponse.json({
            response: response.content
        });

    } catch (error: any) {
        console.error("LangChain Error:", error);
        return NextResponse.json(
            { error: "Failed to process chat", details: error.message },
            { status: 500 }
        );
    }
}
