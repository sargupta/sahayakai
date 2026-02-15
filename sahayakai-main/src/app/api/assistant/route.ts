
import { NextRequest, NextResponse } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { googleSearch } from "@/ai/tools/google-search";
import { SAHAYAK_SOUL_PROMPT } from "@/ai/soul";
import { logger } from "@/lib/utils";

import { getSecret } from "@/lib/secrets";

// LangChain/Gemini-compatible tool definition
const googleSearchTool = {
    name: "googleSearch",
    description: "Performs a Google search to get up-to-date information or find videos.",
    schema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The search query."
            }
        },
        required: ["query"]
    }
};

// Initialize model with tools
const getModel = async () => {
    logger.info("Initializing Assistant Model...");
    const apiKey = await getSecret('GOOGLE_GENAI_API_KEY');

    if (!apiKey || apiKey.length < 10) {
        throw new Error("Invalid or missing GOOGLE_GENAI_API_KEY in environment/Secret Manager.");
    }

    const model = new ChatGoogleGenerativeAI({
        model: "gemini-2.0-flash",
        apiKey: apiKey,
        maxOutputTokens: 512,
        temperature: 0.7,
    });

    logger.info("Model initialized, binding tools...");
    return model.bindTools([googleSearchTool]);
};

export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    try {
        const { message, history, context } = await req.json();

        logger.info("Voice Assistant request received", { requestId, messageLength: message?.length });

        const model = await getModel();
        const messages: BaseMessage[] = [];

        // 1. System Prompt (Soul + Context)
        messages.push(new SystemMessage(`
${SAHAYAK_SOUL_PROMPT}

You are currently acting as a pedagogical coach for a teacher. 
The teacher is looking at a specific piece of advice or content on their screen.

SCREEN CONTEXT:
${context || "The user is on the dashboard or a general page."}

INSTRUCTIONS:
- Help the teacher understand and apply the advice from the context.
- Use the googleSearch tool if they ask about external facts, current events, or specific educational standards not in the context.
- Keep answers concise (2-3 sentences) unless a detailed explanation is requested.
- If the user asks something completely unrelated, gently guide them back to teaching.
- Respond in the language used by the user (Hindi/English/Hinglish).
`));

        // 2. Previous Chat History
        if (history && Array.isArray(history)) {
            history.forEach((turn: any) => {
                if (turn.user) messages.push(new HumanMessage(turn.user));
                if (turn.ai) messages.push(new AIMessage(turn.ai));
            });
        }

        // 3. Current User Message
        messages.push(new HumanMessage(message));

        // 4. Generate Response with Tool Handling
        let response = await model.invoke(messages);

        // Basic tool calling loop (if model decides to search)
        if (response.tool_calls && response.tool_calls.length > 0) {
            logger.info("Voice Assistant triggering tool calls", { requestId, tool: response.tool_calls[0].name });
            for (const toolCall of response.tool_calls) {
                if (toolCall.name === "googleSearch") {
                    const toolResult = await googleSearch.invoke(toolCall.args);
                    messages.push(response);
                    messages.push(new HumanMessage({
                        content: JSON.stringify(toolResult),
                        additional_kwargs: { tool_call_id: toolCall.id }
                    } as any));
                }
            }
            response = await model.invoke(messages);
        }

        return NextResponse.json({
            response: response.content,
            requestId
        });

    } catch (error: any) {
        logger.error("Voice Assistant API Error", error, { requestId });
        return NextResponse.json(
            {
                error: "I'm having a bit of trouble connecting right now. Let's try again in a moment.",
                details: error.message
            },
            { status: 500 }
        );
    }
}
