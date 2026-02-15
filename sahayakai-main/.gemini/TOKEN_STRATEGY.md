# Token Optimization Strategy

To ensure SahayakAI remains cost-effective and fast during development, we follow a **"Lazy Loading"** approach to project context.

## 🧠 Why .gemini isn't a "Token Sink"

The `.gemini` directory is a **Knowledge Repository**, not a system-level include. It is only leveraged when:
1.  **Onboarding**: I read `INTELLIGENCE.md` to understand the project soul.
2.  **Explicit Need**: If I'm working on the Quiz feature, I only read the Quiz schema.
3.  **Cross-Project Sync**: When moving between Mobile and Web, I check the index to ensure parity.

## ⚡ Performance & Latency

Lazy loading context actually **reduces** overall latency. Here's why:

1.  **Faster Processing**: Processing 2,000 tokens is significantly faster than processing 20,000 tokens. By keeping my context window slim, I respond faster and make fewer mistakes.
2.  **Tool Call Efficiency**: Reading an index file takes milliseconds. The time "lost" in an extra `view_file` call is more than recovered by the faster inference time of a smaller prompt.
3.  **Noise Reduction**: Irrelevant schemas create "distraction." Fewer distractions mean I get the code right the first time, avoiding expensive and slow "retry" cycles.

## 📊 Context Management Stats

| Strategy | Token Weight | Latency Impact | Accuracy |
| :--- | :--- | :--- | :--- |
| **Include Everything** | High (50k+) | 🐢 Slower Inference | 📉 Lower (Noise) |
| **Lazy Loading (Our Way)** | Low (2k - 5k) | 🚀 Faster Inference | 📈 Higher (Focus) |

## 🚀 Advanced Optimization Techniques

### 1. Schema Sharding (Lite Schemas)
For complex flows, we use "Lite" versions of Zod schemas in `.gemini/schemas/web/`.
- **Full Schema**: Contains implementation details, prompts, and internal logic.
- **Lite Schema**: Contains ONLY the `InputSchema` and `OutputSchema` signatures.
- **Agent Action**: Prefer reading `*-lite.ts` for quick task planning to save thousands of tokens.

### 2. Context Lifecycle & Brain Cleanup
The `brain` folder accumulates versions. Periodically run the cleanup script to:
- Prune `.resolved.*` history files.
- Consolidate finished `task.md` files into a single-line summary.

### 3. Tool-Based Discovery
Avoid `ls -R`. Instead:
- Use `find_by_name` for specific files.
- Use `grep_search` to find code items without loading entire files.

## 📊 Token Usage Guidelines

| Content Type | Storage Format | Loading Frequency |
| :--- | :--- | :--- |
| **Project Soul** | Brief Markdown | Every Session |
| **API Schemas** | Sanitized `.ts` | Per-Feature |
| **Design Tokens** | JSON | Per-UI Task |
| **Logic/Flows** | Core Logic Only | As Needed |

## 📊 Updated Guidelines (Agent Strategy)

| Content Type | Strategy | Optimization |
| :--- | :--- | :--- |
| **Logic/Flows** | Lite Schemas | Use `*-lite.ts` |
| **Task History** | Lifecycle | Prune old brain artifacts |
| **Skills** | Conciseness | Strip conversational noise |
