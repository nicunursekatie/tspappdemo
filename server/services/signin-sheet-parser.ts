import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/production-safe-logger';
import fs from 'fs';
import path from 'path';

/**
 * Sign-in Sheet Photo Parser Service
 * Uses Claude's vision capabilities to extract sandwich collection data from photos
 * of handwritten sign-in sheets
 */

export interface ExtractedCollectionEntry {
  location: string;
  sandwichCount: number;
  volunteerName?: string;
  date?: string;
  confidence: number; // 0.0-1.0
  notes?: string; // Any notes or clarifications about this entry
}

export interface ParsedSignInSheet {
  success: boolean;
  entries: ExtractedCollectionEntry[];
  totalSandwiches: number;
  suggestedDate: string; // YYYY-MM-DD
  overallConfidence: number; // Average confidence across all entries
  warnings: string[]; // Any issues or low-confidence areas
  rawExtraction?: string; // The raw text extraction for debugging
}

// Media types supported by Claude's vision
type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

/**
 * Converts a file to base64 and determines media type
 */
async function fileToBase64(filePath: string): Promise<{ base64: string; mediaType: ImageMediaType }> {
  const buffer = await fs.promises.readFile(filePath);
  const base64 = buffer.toString('base64');

  const ext = path.extname(filePath).toLowerCase();
  let mediaType: ImageMediaType;

  switch (ext) {
    case '.jpg':
    case '.jpeg':
      mediaType = 'image/jpeg';
      break;
    case '.png':
      mediaType = 'image/png';
      break;
    case '.gif':
      mediaType = 'image/gif';
      break;
    case '.webp':
      mediaType = 'image/webp';
      break;
    case '.heic':
    case '.heif':
      // HEIC/HEIF formats are only supported via file upload endpoint (/scan)
      // They are treated as JPEG for Claude's API. The base64 endpoint (/scan-base64)
      // used by the frontend does not accept these formats since browsers typically
      // convert HEIC to JPEG automatically when reading files.
      mediaType = 'image/jpeg';
      break;
    default:
      // Default to jpeg for unknown or unsupported file extensions
      mediaType = 'image/jpeg';
  }

  return { base64, mediaType };
}

/**
 * Internal function that performs the actual Claude API call and parsing
 * Used by both parseSignInSheetPhoto and parseSignInSheetBase64
 */
async function parseSignInSheetInternal(
  base64Data: string,
  mediaType: ImageMediaType,
  contextHint?: string
): Promise<ParsedSignInSheet> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    logger.error('[SignInSheetParser] No ANTHROPIC_API_KEY configured');
    return {
      success: false,
      entries: [],
      totalSandwiches: 0,
      suggestedDate: new Date().toISOString().split('T')[0],
      overallConfidence: 0,
      warnings: ['Anthropic API key not configured. Please set ANTHROPIC_API_KEY in environment variables.'],
    };
  }

  try {
    const client = new Anthropic({ apiKey });
    const today = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are an expert at reading handwritten documents, specifically sign-in sheets from The Sandwich Project - a volunteer organization that collects sandwiches from various locations to help feed people in need.

Your task is to extract structured data from photos of handwritten sign-in sheets. These sheets typically contain:
- Location/site names where sandwiches were dropped off or collected
- Sandwich counts (numbers)
- Sometimes volunteer names
- Dates (often in MM/DD or MM/DD/YYYY format)

IMPORTANT GUIDELINES:
1. Handwriting may be messy - make your best interpretation
2. For each entry, provide a confidence score (0.0-1.0) indicating how sure you are
3. If you can't read something clearly, note it in the warnings
4. Common locations include: Dunwoody, Intown, Downtown, Buckhead, Decatur, Sandy Springs, Marietta
5. Sandwich counts are typically between 10 and 2000 per location
6. If no date is visible, suggest ${today}
7. Extract ALL entries you can find, even partial ones

OUTPUT FORMAT (JSON):
{
  "entries": [
    {
      "location": "Location name (cleaned up, proper case)",
      "sandwichCount": 123,
      "volunteerName": "Name if visible (optional)",
      "date": "YYYY-MM-DD if visible (optional)",
      "confidence": 0.95,
      "notes": "Any relevant notes (optional)"
    }
  ],
  "suggestedDate": "YYYY-MM-DD",
  "warnings": ["List any issues, unreadable sections, or low-confidence areas"],
  "rawExtraction": "Brief description of what you see on the sheet"
}`;

    // Sanitize and limit contextHint to prevent abuse
    let sanitizedContextHint: string | undefined = undefined;
    if (contextHint && typeof contextHint === 'string') {
      // Remove control characters except for common whitespace (\n, \r, \t)
      sanitizedContextHint = contextHint.replace(/[^\x20-\x7E\n\r\t]/g, '').trim();
      // Truncate to 500 characters
      if (sanitizedContextHint.length > 500) {
        sanitizedContextHint = sanitizedContextHint.slice(0, 500);
      }
    }

    const userPrompt = sanitizedContextHint
      ? `Please analyze this sign-in sheet photo and extract all sandwich collection data. Context: ${sanitizedContextHint}`
      : 'Please analyze this sign-in sheet photo and extract all sandwich collection data.';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
      system: systemPrompt,
    });

    // Extract text content from response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON from response
    const responseText = textContent.text;

    // Try to extract JSON from the response (handle potential markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // Try to find JSON object directly
      const jsonObjectMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonStr = jsonObjectMatch[0];
      }
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and clean up the response
    const entries: ExtractedCollectionEntry[] = (parsed.entries || []).map((entry: any) => ({
      location: String(entry.location || 'Unknown').trim(),
      sandwichCount: Math.max(0, parseInt(entry.sandwichCount, 10) || 0),
      volunteerName: entry.volunteerName ? String(entry.volunteerName).trim() : undefined,
      date: entry.date || undefined,
      confidence: Math.min(1, Math.max(0, parseFloat(entry.confidence) || 0.5)),
      notes: entry.notes ? String(entry.notes).trim() : undefined,
    }));

    // Calculate totals and overall confidence
    const totalSandwiches = entries.reduce((sum, entry) => sum + entry.sandwichCount, 0);
    const overallConfidence = entries.length > 0
      ? entries.reduce((sum, entry) => sum + entry.confidence, 0) / entries.length
      : 0;

    // Add warnings for low-confidence entries
    const warnings: string[] = parsed.warnings || [];
    entries.forEach((entry, index) => {
      if (entry.confidence < 0.6) {
        warnings.push(`Entry #${index + 1} (${entry.location}): Low confidence (${Math.round(entry.confidence * 100)}%) - please verify`);
      }
    });

    logger.info(`[SignInSheetParser] Extracted ${entries.length} entries, total: ${totalSandwiches} sandwiches`);

    return {
      success: true,
      entries,
      totalSandwiches,
      suggestedDate: parsed.suggestedDate || today,
      overallConfidence,
      warnings,
      rawExtraction: parsed.rawExtraction,
    };

  } catch (error) {
    logger.error('[SignInSheetParser] Failed to parse sign-in sheet:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      entries: [],
      totalSandwiches: 0,
      suggestedDate: new Date().toISOString().split('T')[0],
      overallConfidence: 0,
      warnings: [`Failed to parse image: ${errorMessage}`],
    };
  }
}

/**
 * Parse a sign-in sheet photo using Claude's vision capabilities
 */
export async function parseSignInSheetPhoto(
  imagePath: string,
  contextHint?: string
): Promise<ParsedSignInSheet> {
  try {
    const { base64, mediaType } = await fileToBase64(imagePath);
    return parseSignInSheetInternal(base64, mediaType, contextHint);
  } catch (error) {
    logger.error('[SignInSheetParser] Failed to read file:', error);
    return {
      success: false,
      entries: [],
      totalSandwiches: 0,
      suggestedDate: new Date().toISOString().split('T')[0],
      overallConfidence: 0,
      warnings: [`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Parse a sign-in sheet from base64 image data directly (for frontend uploads)
 */
export async function parseSignInSheetBase64(
  base64Data: string,
  mimeType: string,
  contextHint?: string
): Promise<ParsedSignInSheet> {
  // Map mime type to Claude's expected format
  let mediaType: ImageMediaType;
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      mediaType = 'image/jpeg';
      break;
    case 'image/png':
      mediaType = 'image/png';
      break;
    case 'image/gif':
      mediaType = 'image/gif';
      break;
    case 'image/webp':
      mediaType = 'image/webp';
      break;
    default:
      mediaType = 'image/jpeg';
  }

  return parseSignInSheetInternal(base64Data, mediaType, contextHint);
}
