
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SAHAYAK_SOUL_PROMPT } from "@/ai/soul";
import { logger } from "@/lib/utils";
import { getSecret } from "@/lib/secrets";

// ─── Types ──────────────────────────────────────────────────────────────────

interface VidyaAction {
    type: "NAVIGATE_AND_FILL";
    flow: string;
    label: string;
    params: {
        topic?: string | null;
        subject?: string | null;
        gradeLevel?: string | null;
        language?: string | null;
    };
}

interface VidyaResponse {
    response: string;
    action: VidyaAction | null;
}

// ─── API Route ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    try {
        const { message, history, context } = await req.json();
        logger.info("VIDYA Mentor request received", { requestId, messageLength: message?.length });

        const apiKey = await getSecret('GOOGLE_GENAI_API_KEY');
        if (!apiKey || apiKey.length < 10) {
            throw new Error("Invalid or missing GOOGLE_GENAI_API_KEY");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                responseMimeType: "application/json",
                maxOutputTokens: 1024,
                temperature: 0.5,
            },
        });

        // Build system prompt
        const systemPrompt = `
${SAHAYAK_SOUL_PROMPT}

CURRENT SCREEN CONTEXT:
${context || "Teacher is on the SahayakAI dashboard."}

IMPORTANT: You MUST respond ONLY with a valid JSON object matching this exact structure:
{
  "response": "<your warm message>",
  "action": null or { "type": "NAVIGATE_AND_FILL", "flow": "<key>", "label": "<human label>", "params": { "topic": "...", "subject": "...", "gradeLevel": "...", "language": "en" } }
}
`;

        // Build conversation history
        const chatHistory = [];
        if (history && Array.isArray(history)) {
            for (const turn of history) {
                if (turn.user) {
                    chatHistory.push({ role: "user", parts: [{ text: turn.user }] });
                }
                if (turn.ai) {
                    chatHistory.push({ role: "model", parts: [{ text: turn.ai }] });
                }
            }
        }

        // Start chat with system prompt
        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: '{"response": "Namaste! Main VIDYA hoon — aapki Senior Pedagogical Mentor. Main aapke saath sabhi SahayakAI tools use kar sakti hoon. Kya help chahiye?", "action": null}' }] },
                ...chatHistory,
            ],
        });

        const result = await chat.sendMessage(message);
        const rawText = result.response.text();

        // Parse the JSON response safely
        let parsed: VidyaResponse;
        try {
            parsed = JSON.parse(rawText);
        } catch {
            // Fallback if model returns malformed JSON
            logger.warn("VIDYA returned non-JSON, falling back", { requestId, rawText });
            parsed = {
                response: typeof rawText === "string" ? rawText : "Mujhe samajh nahi aaya. Kripya dobara poochein.",
                action: null,
            };
        }

        return NextResponse.json({
            response: parsed.response || "Kuch problem hua. Dobara try karein.",
            action: parsed.action || null,
            requestId,
        });

    } catch (error: any) {
        logger.error("VIDYA API Error", error, { requestId });
        return NextResponse.json(
            {
                response: "Main abhi ek chhoti mushkil se guzar rahi hoon. Thodi der mein dobara try karein! 🙏",
                action: null,
                details: error.message
            },
            { status: 500 }
        );
    }
}
