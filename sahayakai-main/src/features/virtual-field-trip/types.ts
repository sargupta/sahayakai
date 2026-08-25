import { z } from "zod";
import type { VirtualFieldTripOutput } from "@/ai/flows/virtual-field-trip";

export const formSchema = z.object({
    topic: z.string().min(10, { message: "Topic must be at least 10 characters." }),
    language: z.string().optional(),
    gradeLevel: z.string().optional(),
    subject: z.string().optional(),
});

export type FormValues = z.infer<typeof formSchema>;

/**
 * The only gate on a body that reaches `VirtualFieldTripDisplay`.
 *
 * `/api/ai/virtual-field-trip` answers 202 with an error envelope when the
 * dispatcher's budget expires while the flow keeps writing to Firestore. 202
 * is inside `res.ok`, so an `if (!res.ok)` guard waves that envelope through
 * as a trip, and the display crashes on `trip.stops.map` — the envelope has
 * no `stops`. HTTP status alone cannot answer "is this a trip"; the body has
 * to. Both the generation path and the restore-from-`?id` path narrow here.
 *
 * `stops` is required and non-empty because it is the whole trip: a plan with
 * no stops is not a shorter trip, it is a blank result, and the teacher pays
 * a plan credit for it either way.
 */
export function asVirtualFieldTrip(json: unknown): VirtualFieldTripOutput | null {
    if (!json || typeof json !== "object" || Array.isArray(json)) return null;
    const candidate = json as Partial<VirtualFieldTripOutput>;
    if (!Array.isArray(candidate.stops) || candidate.stops.length === 0) return null;
    return candidate as VirtualFieldTripOutput;
}
