import OpenAI from 'openai';
import { db } from '../../db';
import { eventRequests, sandwichCollections } from '../../../shared/schema';
import { and, eq, gte, lt } from 'drizzle-orm';
import { logger } from '../../utils/production-safe-logger';
import { parseJsonStrict } from '../../utils/safe-json';

// Lazy-initialize OpenAI client to avoid crashing app if API key is not configured
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error('AI_INTEGRATIONS_OPENAI_API_KEY environment variable is required for predictions');
  }

  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }

  return openai;
}

export interface PredictionResult {
  predictedSandwichCount: number;
  confidenceLow: number;
  confidenceHigh: number;
  predictedEventCount: number;
  alertLevel: 'low' | 'normal' | 'high';
  reasoning: string;
  recommendations: string[];
  basedOnData: {
    historicalMonths: number;
    averageSandwiches: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
}

/**
 * Predict sandwich needs for a future month using historical data + AI insights
 */
export async function predictMonthlySandwichNeeds(
  targetYear: number,
  targetMonth: number
): Promise<PredictionResult> {
  try {
    logger.info('Generating prediction', { targetYear, targetMonth });

    // 1. Get historical data (12 months before target month, excluding target month)
    const endDate = new Date(targetYear, targetMonth - 1, 1);
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - 12);

    const historicalEvents = await db.query.eventRequests.findMany({
      where: and(
        eq(eventRequests.status, 'completed'),
        gte(eventRequests.scheduledEventDate, startDate),
        lt(eventRequests.scheduledEventDate, endDate)
      ),
    });

    // 2. Calculate historical statistics
    const monthlyData: Array<{ month: string; events: number; sandwiches: number }> = [];
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(startDate);
      monthDate.setMonth(monthDate.getMonth() + i);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

      const monthEvents = historicalEvents.filter(e =>
        e.scheduledEventDate &&
        e.scheduledEventDate >= monthStart &&
        e.scheduledEventDate <= monthEnd
      );

      const monthSandwiches = monthEvents.reduce((sum, e) =>
        sum + (e.actualSandwichCount || e.estimatedSandwichCount || 0), 0
      );

      monthlyData.push({
        month: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
        events: monthEvents.length,
        sandwiches: monthSandwiches,
      });
    }

    // 3. Calculate basic statistics
    const totalSandwiches = monthlyData.reduce((sum, m) => sum + m.sandwiches, 0);
    const avgSandwiches = totalSandwiches / 12;
    const avgEvents = monthlyData.reduce((sum, m) => sum + m.events, 0) / 12;

    // Calculate trend
    const recentAvg = monthlyData.slice(-3).reduce((sum, m) => sum + m.sandwiches, 0) / 3;
    const olderAvg = monthlyData.slice(0, 3).reduce((sum, m) => sum + m.sandwiches, 0) / 3;
    const trend = recentAvg > olderAvg * 1.1 ? 'increasing' :
                  recentAvg < olderAvg * 0.9 ? 'decreasing' : 'stable';

    // 4. Use AI for insights
    const aiPrediction = await generateAIPrediction(monthlyData, targetYear, targetMonth, avgSandwiches, trend);

    // 5. Use AI prediction directly (AI already considers seasonality in its analysis)
    // The AI prompt explicitly asks it to account for seasonal patterns, holidays, etc.
    const predictedSandwiches = aiPrediction.predictedSandwichCount || Math.round(avgSandwiches);

    // Calculate confidence interval (±20%)
    const confidenceLow = Math.round(predictedSandwiches * 0.8);
    const confidenceHigh = Math.round(predictedSandwiches * 1.2);

    // Determine alert level
    const alertLevel = predictedSandwiches > avgSandwiches * 1.3 ? 'high' :
                       predictedSandwiches < avgSandwiches * 0.7 ? 'low' : 'normal';

    return {
      predictedSandwichCount: predictedSandwiches,
      confidenceLow,
      confidenceHigh,
      predictedEventCount: Math.round(avgEvents),
      alertLevel,
      reasoning: aiPrediction.reasoning,
      recommendations: aiPrediction.recommendations,
      basedOnData: {
        historicalMonths: 12,
        averageSandwiches: Math.round(avgSandwiches),
        trend,
      },
    };

  } catch (error) {
    logger.error('Prediction generation failed', { error });
    throw error;
  }
}

/**
 * Generate AI-powered insights and predictions
 */
async function generateAIPrediction(
  historicalData: any[],
  targetYear: number,
  targetMonth: number,
  avgSandwiches: number,
  trend: string
): Promise<any> {
  try {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a predictive analytics assistant for The Sandwich Project.

Analyze historical data and predict future sandwich needs considering:
- Seasonal patterns (holidays, school schedules, etc.)
- Growth trends
- Special events (MLK Day in January, Thanksgiving in November, etc.)
- Community needs

Return JSON:
{
  "predictedSandwichCount": number,
  "reasoning": "brief explanation of prediction",
  "recommendations": ["array of 2-3 actionable recommendations"]
}`,
        },
        {
          role: 'user',
          content: `Predict sandwich needs for ${monthNames[targetMonth - 1]} ${targetYear}.

Historical data (last 12 months):
${JSON.stringify(historicalData, null, 2)}

Current trend: ${trend}
12-month average: ${Math.round(avgSandwiches)} sandwiches/month`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error('No response from AI');

    return parseJsonStrict(content);
  } catch (error) {
    logger.warn('AI prediction failed, using fallback', { error });
    return {
      predictedSandwichCount: Math.round(avgSandwiches),
      reasoning: 'Based on 12-month historical average',
      recommendations: ['Continue current operations', 'Monitor demand closely'],
    };
  }
}

/**
 * Get predictions for next N months
 */
export async function predictNextMonths(monthsAhead: number = 3): Promise<Map<string, PredictionResult>> {
  const predictions = new Map<string, PredictionResult>();

  const today = new Date();

  for (let i = 1; i <= monthsAhead; i++) {
    const targetDate = new Date(today);
    targetDate.setMonth(targetDate.getMonth() + i);

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;

    const prediction = await predictMonthlySandwichNeeds(year, month);
    predictions.set(key, prediction);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return predictions;
}
