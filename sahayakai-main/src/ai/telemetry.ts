import { enableFirebaseTelemetry } from "@genkit-ai/firebase";

let initialized = false;

export async function initTelemetry(): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  const isProduction = process.env.NODE_ENV === "production";

  try {
    if (isProduction) {
      await enableFirebaseTelemetry({
        forceDevExport: false,
        metricExportIntervalMillis: 60_000,
      });
    } else {
      // In dev, Genkit Dev UI handles traces natively
      await enableFirebaseTelemetry({
        forceDevExport: false,
      });
    }

    console.log(
      `Telemetry initialized (env: ${isProduction ? "production" : "development"})`
    );
  } catch (error) {
    console.error("Failed to initialize telemetry — continuing without it:", error);
  }
}
