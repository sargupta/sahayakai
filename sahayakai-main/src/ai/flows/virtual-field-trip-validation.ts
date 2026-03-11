/**
 * Enhanced validation helper for VirtualFieldTripOutputSchema
 */

export function validateFieldTripOutput(rawOutput: any): { valid: boolean; errors: string[]; data?: any } {
    const errors: string[] = [];

    if (!rawOutput.title) errors.push('Missing "title"');
    if (!rawOutput.stops || !Array.isArray(rawOutput.stops) || rawOutput.stops.length === 0) {
        errors.push('Missing or empty "stops" array');
    } else {
        rawOutput.stops.forEach((stop: any, idx: number) => {
            if (!stop.name) errors.push(`Stop ${idx + 1}: Missing "name"`);
            if (!stop.description) errors.push(`Stop ${idx + 1}: Missing "description"`);
            if (!stop.culturalAnalogy) {
                errors.push(`Stop ${idx + 1}: Missing "culturalAnalogy" (Essential for Bharat-First)`);
            } else if (stop.culturalAnalogy.length < 15) {
                errors.push(`Stop ${idx + 1}: culturalAnalogy is too brief`);
            }
            if (!stop.explanation) {
                errors.push(`Stop ${idx + 1}: Missing "explanation"`);
            }

            // Basic URL check
            if (stop.googleEarthUrl && !stop.googleEarthUrl.startsWith('https://earth.google.com/')) {
                errors.push(`Stop ${idx + 1}: Invalid Google Earth URL`);
            }
        });
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    return { valid: true, errors: [], data: rawOutput };
}

export function sanitizeFieldTripOutput(rawOutput: any): any {
    const sanitized = { ...rawOutput };

    if (Array.isArray(sanitized.stops)) {
        sanitized.stops = sanitized.stops.map((s: any) => ({
            ...s,
            // Ensure any string cleaning if needed
        }));
    }

    return sanitized;
}
