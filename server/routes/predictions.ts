import { Router, type Response } from 'express';
import { logger } from '../middleware/logger';
import { predictMonthlySandwichNeeds, predictNextMonths } from '../services/ai-predictions';
import type { AuthenticatedRequest } from '../types/express';

export const predictionsRouter = Router();

// GET /api/predictions/month/:year/:month - Get prediction for a specific month
predictionsRouter.get('/month/:year/:month', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);

    if (
      isNaN(year) ||
      isNaN(month) ||
      year < 2020 ||
      year > 2100 ||
      month < 1 ||
      month > 12
    ) {
      return res.status(400).json({ error: 'Invalid year or month. Year must be between 2020 and 2100, month must be between 1 and 12.' });
    }

    logger.info('Generating prediction', { userId: req.user.id, year, month });

    const prediction = await predictMonthlySandwichNeeds(year, month);

    res.json(prediction);
  } catch (error) {
    logger.error('Error generating prediction', { error });
    res.status(500).json({
      error: 'Failed to generate prediction',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/predictions/upcoming - Get predictions for next 3 months
predictionsRouter.get('/upcoming', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const monthsAhead = parseInt(req.query.months as string) || 3;

    if (monthsAhead < 1 || monthsAhead > 12) {
      return res.status(400).json({ error: 'Months ahead must be between 1 and 12' });
    }

    logger.info('Generating upcoming predictions', { userId: req.user.id, monthsAhead });

    const predictions = await predictNextMonths(monthsAhead);

    // Convert Map to object for JSON response
    const predictionsObject = Object.fromEntries(predictions);

    res.json(predictionsObject);
  } catch (error) {
    logger.error('Error generating upcoming predictions', { error });
    res.status(500).json({
      error: 'Failed to generate predictions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
