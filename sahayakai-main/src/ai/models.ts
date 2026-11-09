/**
 * Single source of truth for which GCP project, Vertex location and Gemini
 * models the backend calls.
 *
 * The backend runs in `riya-outbound-staging` (since 2026-11-07). Vertex AI in
 * that project only serves the Gemini 3.x family, and only at the `global`
 * location: every 2.x text model (2.5-flash, 2.5-pro, 2.5-flash-lite) returns
 * 404 there, and no regional location (us-central1, asia-south1) serves any
 * Gemini model. Probed 2026-11-09 with generateContent:
 *
 *   global 200: gemini-3-flash-preview, gemini-3.1-flash-lite,
 *               gemini-3.1-pro-preview, gemini-3-pro-image,
 *               gemini-3.1-flash-image, gemini-2.5-flash-image
 *   global 404: gemini-2.5-flash, gemini-2.5-pro, gemini-2.5-flash-lite,
 *               gemini-3-pro-image-preview
 *
 * Every model below is Vertex (billed via Cloud Billing, ADC auth, no API
 * keys), so no flow depends on AI Studio prepaid credit. Each is overridable
 * by env so ops can swap a model without a deploy; a `googleai/*` value
 * switches that slot back to the AI Studio key pool.
 */

const fromEnv = (name: string, fallback: string): string =>
  (process.env[name] ?? '').trim() || fallback;

/** GCP project that hosts Vertex AI. Cloud Run sets GCLOUD_PROJECT. */
export const VERTEX_PROJECT =
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  'riya-outbound-staging';

/** Gemini 3.x is served only from the global endpoint in this project. */
export const VERTEX_LOCATION = fromEnv('VERTEX_LOCATION', 'global');

/** Build-time default text model (fast, multimodal, thinking). */
export const DEFAULT_MODEL = 'vertexai/gemini-3-flash-preview';

export const MODELS = {
  /** General text + multimodal generation. Follows GENKIT_DEFAULT_MODEL. */
  flash: fromEnv('GENKIT_DEFAULT_MODEL', DEFAULT_MODEL),
  /** Cheap, high-volume work: classification, quota fallbacks. */
  flashLite: fromEnv('GENKIT_LITE_MODEL', 'vertexai/gemini-3.1-flash-lite'),
  /** Highest quality reasoning + vision (assignment grading). */
  pro: fromEnv('GENKIT_PRO_MODEL', 'vertexai/gemini-3.1-pro-preview'),
  /** Illustrations (visual aids). */
  image: fromEnv('GENKIT_IMAGE_MODEL', 'vertexai/gemini-3-pro-image'),
  /** Avatars: small, fast image model. */
  avatarImage: fromEnv('GENKIT_AVATAR_IMAGE_MODEL', 'vertexai/gemini-2.5-flash-image'),
} as const;

/** `vertexai/gemini-3-flash-preview` → `gemini-3-flash-preview` (for telemetry). */
export const modelName = (id: string): string => id.replace(/^[a-z]+\//, '');
