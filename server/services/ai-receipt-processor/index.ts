import OpenAI from 'openai';
import { logger } from '../../utils/production-safe-logger';
import { parseJsonStrict } from '../../utils/safe-json';

// Lazy-initialize OpenAI client to avoid crashing app if API key is not configured
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error('AI_INTEGRATIONS_OPENAI_API_KEY environment variable is required for receipt processing');
  }

  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }

  return openai;
}

// Receipt processing result
export interface ReceiptProcessingResult {
  vendor: string;
  totalAmount: number;
  purchaseDate: string; // ISO format YYYY-MM-DD
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  suggestedCategory: 'supplies' | 'food' | 'transportation' | 'marketing' | 'equipment' | 'other';
  taxAmount?: number;
  paymentMethod?: string;
  confidence: number; // 0.0 - 1.0
  notes?: string;
  rawText?: string; // For debugging
}

// Input for receipt processing
export interface ReceiptProcessingInput {
  imageUrl: string; // Public URL to the receipt image
  contextHint?: string; // Optional hint about what the expense might be for
}

/**
 * Process a receipt image using GPT-4o Vision to extract structured data
 */
export async function processReceiptImage(
  input: ReceiptProcessingInput
): Promise<ReceiptProcessingResult> {
  const startTime = Date.now();

  try {
    logger.info('Starting AI receipt processing', {
      imageUrl: input.imageUrl,
      contextHint: input.contextHint,
    });

    // Build system prompt
    const systemPrompt = `You are an intelligent receipt processing assistant for The Sandwich Project, a nonprofit organization that makes and distributes sandwiches to people in need.

Your task is to extract structured data from receipt images with high accuracy.

EXTRACTION GUIDELINES:

**Vendor:** The store/restaurant name (e.g., "Costco", "Walmart", "Publix", "Home Depot")

**Total Amount:** The final total paid (not subtotal). Look for terms like "TOTAL", "AMOUNT DUE", "BALANCE DUE"

**Purchase Date:** The transaction date in YYYY-MM-DD format

**Items:** List of purchased items with quantities and prices. Extract as many as visible/legible.
- If quantity not shown, assume 1
- Include item descriptions from the receipt

**Suggested Category:** Based on the items purchased, categorize as:
- supplies: Paper goods, plastic bags, gloves, cleaning supplies, disposable items
- food: Bread, meat, cheese, condiments, snacks, beverages, produce
- transportation: Gas, vehicle maintenance, parking, tolls
- marketing: Printing, promotional materials, signage
- equipment: Tools, appliances, furniture, long-term use items
- other: Anything that doesn't fit above categories

**Tax Amount:** Sales tax if visible (optional)

**Payment Method:** Credit card, cash, check, etc. if visible (optional)

**Confidence:** Your confidence in the extraction accuracy (0.0-1.0)
- 0.9-1.0: All key fields clearly visible and legible
- 0.7-0.89: Most fields visible, minor uncertainties
- 0.5-0.69: Some fields unclear or partially visible
- <0.5: Significant difficulties reading receipt

**Notes:** Any issues, warnings, or important observations (optional)

IMPORTANT RULES:
- If you cannot read a field clearly, use your best estimate but lower the confidence score
- Dollar amounts should be numbers only (no $ symbol)
- Dates must be in YYYY-MM-DD format
- Be conservative with confidence scores - it's better to be accurate about uncertainty

Return your analysis as a JSON object with this structure:
{
  "vendor": "string",
  "totalAmount": number,
  "purchaseDate": "YYYY-MM-DD",
  "items": [
    {
      "name": "string",
      "quantity": number,
      "price": number
    }
  ],
  "suggestedCategory": "supplies|food|transportation|marketing|equipment|other",
  "taxAmount": number or null,
  "paymentMethod": "string" or null,
  "confidence": 0.0-1.0,
  "notes": "string" or null
}`;

    // Build user prompt
    let userPrompt = 'Please extract all data from this receipt image.';
    if (input.contextHint) {
      userPrompt += `\n\nContext hint: This expense is likely for ${input.contextHint}`;
    }

    // Call OpenAI Vision API
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: 'gpt-4o', // Vision-capable model
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: input.imageUrl,
                detail: 'high', // High detail for better text recognition
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1, // Very low temperature for consistent, factual extraction
      max_tokens: 1500,
    });

    const responseContent = completion.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No response content from OpenAI');
    }

    // Parse and validate response
    const result = parseJsonStrict<ReceiptProcessingResult>(responseContent);

    // Validate required fields
    if (!result.vendor || result.totalAmount === undefined || !result.purchaseDate) {
      throw new Error('Invalid response structure from OpenAI - missing required fields');
    }

    // Validate amount is positive
    if (result.totalAmount < 0) {
      logger.warn('Negative total amount detected, taking absolute value', {
        originalAmount: result.totalAmount,
      });
      result.totalAmount = Math.abs(result.totalAmount);
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(result.purchaseDate)) {
      logger.warn('Invalid date format, attempting to correct', {
        originalDate: result.purchaseDate,
      });
      // Try to parse and reformat
      const parsedDate = new Date(result.purchaseDate);
      if (!isNaN(parsedDate.getTime())) {
        result.purchaseDate = parsedDate.toISOString().split('T')[0];
      } else {
        // Use today as fallback
        result.purchaseDate = new Date().toISOString().split('T')[0];
        result.confidence = Math.min(result.confidence, 0.5);
        result.notes = (result.notes || '') + ' Warning: Could not parse date from receipt, using today\'s date.';
      }
    }

    // Ensure confidence is between 0 and 1
    result.confidence = Math.max(0, Math.min(1, result.confidence || 0.7));

    // Ensure items array exists
    if (!result.items) {
      result.items = [];
    }

    const duration = Date.now() - startTime;
    logger.info('AI receipt processing completed', {
      vendor: result.vendor,
      totalAmount: result.totalAmount,
      category: result.suggestedCategory,
      confidence: result.confidence,
      itemCount: result.items.length,
      duration,
    });

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('AI receipt processing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      imageUrl: input.imageUrl,
    });

    // Return fallback result
    return getFallbackReceiptResult(input, error);
  }
}

/**
 * Fallback result when AI processing fails
 */
function getFallbackReceiptResult(
  input: ReceiptProcessingInput,
  error: unknown
): ReceiptProcessingResult {
  logger.info('Using fallback receipt processing');

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  return {
    vendor: 'Unknown Vendor',
    totalAmount: 0,
    purchaseDate: new Date().toISOString().split('T')[0],
    items: [],
    suggestedCategory: 'other',
    confidence: 0.0,
    notes: `AI processing failed: ${errorMessage}. Please fill in manually.`,
  };
}

/**
 * Batch process multiple receipts (useful for processing multiple expenses at once)
 */
export async function batchProcessReceipts(
  receipts: ReceiptProcessingInput[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<number, ReceiptProcessingResult>> {
  const results = new Map<number, ReceiptProcessingResult>();

  logger.info('Starting batch receipt processing', { count: receipts.length });

  for (let i = 0; i < receipts.length; i++) {
    try {
      const result = await processReceiptImage(receipts[i]);
      results.set(i, result);

      if (onProgress) {
        onProgress(i + 1, receipts.length);
      }

      // Rate limiting: wait 200ms between requests to avoid OpenAI rate limits
      if (i < receipts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      logger.error('Failed to process receipt in batch', {
        index: i,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info('Batch receipt processing completed', {
    total: receipts.length,
    successful: results.size,
  });

  return results;
}

/**
 * Estimate cost of processing a receipt
 * GPT-4o Vision pricing (as of Jan 2025):
 * - Input: $2.50/1M tokens
 * - Output: $10/1M tokens
 * - Images (high detail): ~765 tokens per image
 */
export function estimateReceiptProcessingCost(): {
  perReceipt: number;
  per100Receipts: number;
  per1000Receipts: number;
} {
  // Approximate token usage per receipt:
  // - System prompt: ~600 tokens
  // - Image: ~765 tokens (high detail)
  // - Response: ~300 tokens
  // Total input: ~1365 tokens
  // Total output: ~300 tokens

  const inputTokens = 1365;
  const outputTokens = 300;

  const inputCost = (inputTokens / 1_000_000) * 2.50;
  const outputCost = (outputTokens / 1_000_000) * 10.00;
  const perReceipt = inputCost + outputCost;

  return {
    perReceipt: Math.round(perReceipt * 1000) / 1000, // Round to 3 decimal places
    per100Receipts: Math.round(perReceipt * 100 * 100) / 100,
    per1000Receipts: Math.round(perReceipt * 1000 * 100) / 100,
  };
}
