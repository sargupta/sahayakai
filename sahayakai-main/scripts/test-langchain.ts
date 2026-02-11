
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

async function testLangChain() {
    console.log("🧪 Starting LangChain + Gemini Connection Test...");

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("❌ Error: API Key not found in environment variables.");
        console.log("Current Env Vars:", Object.keys(process.env).filter(k => k.includes("KEY") || k.includes("GOOGLE")));
        process.exit(1);
    } else {
        console.log(`🔑 API Key found (Length: ${apiKey.length})`);
    }
    try {
        console.log("Model Config:", { model: "gemini-2.5-flash", apiKey: "HIDDEN" });
        const model = new ChatGoogleGenerativeAI({
            model: "gemini-2.5-flash",
            apiKey: apiKey.trim(),
        });

        console.log("🤖 Sending 'Hello' to Gemini...");
        // Try passing a string directly to avoid Message object issues
        const response = await model.invoke("Hello! Are you working?");

        console.log("✅ Success! Response from Gemini:");
        console.log("--------------------------------------------------");
        console.log(response.content);
        console.log("--------------------------------------------------");

    } catch (error: any) {
        console.error("❌ Test Failed:", error.message);
        if (error.message.includes("429")) {
            console.error("⚠️ Quota Exceeded. Please check API limits.");
        }
    }
}

testLangChain();
