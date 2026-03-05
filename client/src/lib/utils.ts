import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts a human-readable name from a custom ID string.
 * Works backwards from the end to collect name parts until hitting metadata or numbers.
 * 
 * @param id - The custom ID to extract the name from
 * @returns The extracted name or the original ID if not a custom format
 * 
 * @example
 * extractNameFromCustomId("custom-1758599094227-Madeline-Hill") // "Madeline Hill"
 * extractNameFromCustomId("custom-temp-volunteer-Jane-Doe") // "Jane Doe"
 * extractNameFromCustomId("custom-temp-team-alpha-volunteer-jane-doe") // "Jane Doe"
 * extractNameFromCustomId("custom-temp-volunteer-mary-ann-smith") // "Mary Ann Smith"
 * extractNameFromCustomId("Kim Ross") // "Kim Ross"
 */
export function extractNameFromCustomId(id: string): string {
  // If it doesn't start with "custom-", return as-is
  if (!id.startsWith('custom-')) {
    return id;
  }
  
  // Remove the "custom-" prefix
  const withoutPrefix = id.substring(7); // "custom-" is 7 characters
  
  // Split by hyphens
  const parts = withoutPrefix.split('-');
  
  // MINIMAL list of common metadata words we KNOW appear in this system
  const knownMetadata = new Set([
    'temp', 'volunteer', 'driver', 'speaker', 'host', 
    'recipient', 'team', 'alpha', 'beta', 'uuid'
  ]);
  
  // Work backwards from the end collecting name parts
  const nameParts: string[] = [];
  
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    
    if (!part) continue;
    
    // Stop if we hit a number (timestamp, ID)
    if (/^\d+$/.test(part)) {
      break;
    }
    
    // Stop if we hit an alphanumeric string (UUID, mixed ID)
    if (/\d/.test(part) && /[a-zA-Z]/.test(part)) {
      break;
    }
    
    // Stop if we hit a known metadata word
    if (knownMetadata.has(part.toLowerCase())) {
      break;
    }
    
    // This is part of the name - add it to the beginning of our array
    nameParts.unshift(part);
  }
  
  // If we didn't find any name parts, fallback
  if (nameParts.length === 0) {
    return withoutPrefix.replace(/-/g, ' ');
  }
  
  // Capitalize and join the name parts
  return nameParts.map(part => {
    // Capitalize first letter, lowercase the rest
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join(' ');
}
