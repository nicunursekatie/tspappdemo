/**
 * Organization Name Canonicalization Utility
 *
 * Single source of truth for normalizing and matching organization names.
 * This prevents duplicate logic and ensures consistent matching across the platform.
 */

/**
 * Normalize an organization name for comparison purposes.
 *
 * Algorithm:
 * 1. Trim whitespace and convert to lowercase
 * 2. Remove leading "The "
 * 3. Expand common abbreviations (St. -> Saint, Mt. -> Mount)
 * 4. Remove punctuation
 * 5. Collapse all whitespace
 *
 * @param name - The organization name to canonicalize
 * @returns Normalized name for comparison
 *
 * @example
 * canonicalizeOrgName("The First Baptist Church") => "firstbaptistchurch"
 * canonicalizeOrgName("FBC") => "fbc"
 * canonicalizeOrgName("St. Mary's") => "saintmarys"
 */
export function canonicalizeOrgName(name: string): string {
  if (!name || typeof name !== 'string') return '';

  let canonical = name.trim().toLowerCase();

  // Remove leading "The" or "The " (common prefix that shouldn't affect matching)
  canonical = canonical.replace(/^the\s+/, '');

  // Expand common abbreviations to improve matching
  canonical = canonical.replace(/\bst\b\.?/g, 'saint');
  canonical = canonical.replace(/\bmt\b\.?/g, 'mount');

  // Remove common punctuation
  canonical = canonical.replace(/[&.,;:!?"'\-_]/g, '');

  // Collapse all whitespace (multiple spaces to none)
  canonical = canonical.replace(/\s+/g, '');

  return canonical;
}

/**
 * Check if two organization names refer to the same organization.
 * Uses substring matching for cases like "Allied World" vs "Allied World Assurance".
 *
 * @param name1 - First organization name
 * @param name2 - Second organization name
 * @param minLength - Minimum length for substring matching (default: 8 chars)
 * @returns true if names likely refer to same organization
 *
 * @example
 * organizationNamesMatch("First Baptist Church", "FBC") => false (too short)
 * organizationNamesMatch("Allied World", "Allied World Assurance") => true (substring)
 * organizationNamesMatch("First Baptist", "First Baptist Church") => true (substring)
 */
export function organizationNamesMatch(
  name1: string,
  name2: string,
  minLength: number = 8
): boolean {
  const canonical1 = canonicalizeOrgName(name1);
  const canonical2 = canonicalizeOrgName(name2);

  if (!canonical1 || !canonical2) return false;

  // Exact match after canonicalization
  if (canonical1 === canonical2) return true;

  // Substring match: one name contains the other
  // Minimum length prevents false positives from short abbreviations
  if (canonical1.length >= minLength && canonical2.length >= minLength) {
    return canonical1.includes(canonical2) || canonical2.includes(canonical1);
  }

  return false;
}

/**
 * Calculate similarity score between two organization names.
 * Returns a value between 0 (completely different) and 1 (identical).
 *
 * Scoring:
 * - 1.0: Exact match after canonicalization
 * - 0.85-0.95: Substring match (only if shorter name is >= 60% of longer name's length
 *   AND both names are at least 8 chars — prevents false positives from generic
 *   substrings like "School" or "High School" matching inside longer names)
 * - 0.0-0.85: Levenshtein distance based similarity
 *
 * @param name1 - First organization name
 * @param name2 - Second organization name
 * @returns Similarity score from 0 to 1
 *
 * @example
 * calculateSimilarity("First Baptist Church", "First Baptist Church") => 1.0
 * calculateSimilarity("Allied World", "Allied World Assurance") => ~0.90
 * calculateSimilarity("FBC", "First Baptist Church") => ~0.30
 * calculateSimilarity("High School", "Johns Creek High School Lacrosse Team") => ~0.45 (Levenshtein, not substring)
 */
export function calculateSimilarity(name1: string, name2: string): number {
  const canon1 = canonicalizeOrgName(name1);
  const canon2 = canonicalizeOrgName(name2);

  if (!canon1 || !canon2) return 0;

  // Exact match
  if (canon1 === canon2) return 1.0;

  // Substring match - only valid when the shorter name is a substantial portion
  // of the longer name. This prevents generic fragments like "highschool" (10 chars)
  // from matching inside "johnscreekhighschoollacrosseteam" (31 chars) at 32% ratio.
  const shorter = Math.min(canon1.length, canon2.length);
  const longer = Math.max(canon1.length, canon2.length);
  const lengthRatio = shorter / longer;
  const MIN_SUBSTRING_LENGTH = 8;
  const MIN_LENGTH_RATIO = 0.6;

  if (
    shorter >= MIN_SUBSTRING_LENGTH &&
    lengthRatio >= MIN_LENGTH_RATIO &&
    (canon1.includes(canon2) || canon2.includes(canon1))
  ) {
    // Score between 0.85 and 0.95 based on length ratio
    return 0.85 + (0.10 * lengthRatio);
  }

  // Levenshtein distance based similarity
  const distance = levenshteinDistance(canon1, canon2);
  const maxLen = Math.max(canon1.length, canon2.length);

  if (maxLen === 0) return 0;

  return Math.max(0, 1 - (distance / maxLen));
}

/**
 * Calculate Levenshtein distance between two strings.
 * The minimum number of single-character edits (insertions, deletions, substitutions)
 * required to change one string into the other.
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance between the strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a 2D array for dynamic programming
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first column (deletion costs)
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }

  // Initialize first row (insertion costs)
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}
