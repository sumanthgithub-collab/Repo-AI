/**
 * Utility: cn (class-names helper)
 * Merges Tailwind classes with clsx + tailwind-merge to avoid conflicts.
 * Standard shadcn/ui utility.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
