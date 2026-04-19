import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculate the percentage of edits made to a text.
 * Returns 0 if identical, 100 if completely different.
 * Uses a simple token-based approach (Levenshtein is too heavy for large texts on client)
 */
export function calculateEditPercentage(original: string, modified: string): number {
  if (original === modified) return 0;
  if (!original) return 100;
  if (!modified) return 100;

  const tokenize = (text: string) => text.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const originalTokens = tokenize(original);
  const modifiedTokens = tokenize(modified);

  const originalSet = new Set(originalTokens);
  const modifiedSet = new Set(modifiedTokens);

  // Intersection: words present in both
  let intersection = 0;
  for (const token of modifiedSet) {
    if (originalSet.has(token)) {
      intersection++;
    }
  }

  // Jaccard Similarity = Intersection / Union
  const union = new Set([...originalTokens, ...modifiedTokens]).size;
  const similarity = intersection / union;

  // Edit Percentage = 1 - Similarity
  return Math.round((1 - similarity) * 100);
}
