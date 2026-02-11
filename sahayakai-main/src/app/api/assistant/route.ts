
import { NextRequest, NextResponse } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

// Use the verified model
const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const { message, history, context } = await req.json();

        const messages = [];

        // System Prompt
        messages.push(new SystemMessage(`
You are 'Sahayak Assistant', a helpful and friendly pedagogical coach for teachers in India.
Your goal is to help teachers understand and apply the advice currently shown on their screen.

CONTEXT (What the user is seeing):
${context || "No specific advice is currently displayed."}

INSTRUCTIONS:
- Answer the user's follow-up questions based on the CONTEXT above.
- Be encouraging and practical.
- Keep answers concise (under 3 sentences) unless asked for details.
- If the user asks something unrelated, politely guide them back to teaching or the current context.
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
