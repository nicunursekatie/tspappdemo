# AI Features Implementation

## Overview
Four AI-powered features have been implemented to enhance The Sandwich Project platform:
1. ✅ **Receipt Auto-processing** - Extract data from receipt images automatically
2. ✅ **Intelligent Event Categorization** - Auto-categorize events using AI
3. ✅ **Auto-generated Impact Reports** - Monthly/quarterly/annual reports with AI
4. ✅ **Predictive Analytics** - Forecast sandwich needs for upcoming months

## 🎯 Feature 1: Receipt Auto-processing

### Implementation
- **Service**: `/server/services/ai-receipt-processor/index.ts`
- **API Endpoint**: `POST /api/expenses/process-receipt`
- **Model**: GPT-4o (Vision)

### How It Works
1. User uploads receipt image via expenses form
2. Image is uploaded to object storage
3. GPT-4o Vision extracts:
   - Vendor name
   - Total amount
   - Purchase date
   - Itemized list
   - Suggested category
   - Tax amount (if visible)
4. Frontend form auto-fills with extracted data
5. User reviews and confirms

### API Usage
```typescript
POST /api/expenses/process-receipt
Content-Type: multipart/form-data

Response:
{
  "vendor": "Costco",
  "totalAmount": 47.23,
  "purchaseDate": "2025-01-15",
  "items": [
    { "name": "Bread", "quantity": 10, "price": 20.00 },
    { "name": "Turkey", "quantity": 5, "price": 25.00 }
  ],
  "suggestedCategory": "food",
  "confidence": 0.95,
  "receiptUrl": "https://...",
  "receiptFileName": "receipt.jpg"
}
```

### Cost Estimate
- ~$0.01 per receipt
- Monthly (50 receipts): ~$0.50

---

## 🏷️ Feature 2: Intelligent Event Categorization

### Implementation
- **Service**: `/server/services/ai-event-categorization/index.ts`
- **API Endpoint**: `POST /api/event-requests/:id/ai-categorize`
- **Database**: New columns in `event_requests` table
  - `auto_categories` (JSONB)
  - `categorized_at` (timestamp)
  - `categorized_by` (varchar)
- **Model**: GPT-4o-mini

### How It Works
1. Event request is created or updated
2. AI analyzes:
   - Organization name
   - Organization category
   - Description
   - Sandwich count
   - Location
3. Returns categorization:
   - **Event Type**: corporate, school, nonprofit, community, religious, government, other
   - **Event Size**: small (1-50), medium (51-150), large (151-300), extra_large (301+)
   - **Special Needs**: dietary, refrigeration, delivery, volunteers, speakers, drivers
   - **Target Audience**: Description of recipients
   - **Confidence Score**: 0.0 - 1.0

### API Usage
```typescript
POST /api/event-requests/:id/ai-categorize

Response:
{
  "eventType": "school",
  "eventSize": "large",
  "specialNeeds": ["dietary", "volunteers"],
  "targetAudience": "elementary school students",
  "confidence": 0.92,
  "reasoning": "Organization name indicates elementary school...",
  "suggestedTags": ["school", "large", "elementary"]
}
```

### Database Schema
```sql
-- Added to event_requests table
auto_categories JSONB,
categorized_at TIMESTAMP,
categorized_by VARCHAR(255)
```

### Migration
- **File**: `/migrations/0015_add_ai_categorization.sql`
- Run with: `npm run db:migrate`

### Cost Estimate
- ~$0.001 per event
- Monthly (100 events): ~$0.10

---

## 📊 Feature 3: Auto-generated Impact Reports

### Implementation
- **Service**: `/server/services/ai-impact-reports/index.ts`
- **API Routes**: `/server/routes/impact-reports.ts`
- **Cron Job**: Monthly generation (1st of each month at 9 AM)
- **Database**: New `impact_reports` table
- **Model**: GPT-4o

### How It Works
1. **Data Gathering**: Aggregates data for the report period
   - Completed events
   - Sandwiches distributed
   - Organizations served
   - Volunteers engaged
   - Expenses
2. **AI Generation**: Creates comprehensive report with:
   - Executive summary (2-3 paragraphs)
   - Full content (markdown formatted)
   - Key highlights (3-5 achievements)
   - Trends analysis (growth, seasonal, etc.)
3. **Storage**: Saved to database with metadata
4. **Export**: Can be generated as PDF

### API Endpoints

#### Generate Report
```typescript
POST /api/impact-reports/generate
{
  "startDate": "2025-01-01",
  "endDate": "2025-01-31",
  "reportType": "monthly"  // or "quarterly", "annual", "custom"
}

Response:
{
  "id": 1,
  "title": "Making a Difference: January 2025 Impact Report",
  "executiveSummary": "In January 2025, The Sandwich Project...",
  "content": "# Introduction\n\n...",  // Full markdown report
  "metrics": {
    "eventsCompleted": 45,
    "sandwichesDistributed": 12500,
    "peopleServed": 12500,
    "volunteersEngaged": 85,
    "organizationsServed": 32
  },
  "highlights": [
    {
      "title": "Record Month for Sandwiches",
      "description": "Distributed 12,500 sandwiches...",
      "metric": "12,500 sandwiches"
    }
  ],
  "status": "draft"
}
```

#### List Reports
```typescript
GET /api/impact-reports

Response: [array of reports]
```

#### Get Single Report
```typescript
GET /api/impact-reports/:id
```

#### Publish Report
```typescript
PATCH /api/impact-reports/:id/publish
```

### Database Schema
```sql
CREATE TABLE impact_reports (
  id SERIAL PRIMARY KEY,
  report_type VARCHAR(50) NOT NULL,  -- 'monthly', 'quarterly', 'annual', 'custom'
  report_period VARCHAR(50) NOT NULL,  -- e.g., '2025-01', '2025-Q1', '2025'
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,

  -- Report content
  title TEXT NOT NULL,
  executive_summary TEXT NOT NULL,
  content TEXT NOT NULL,  -- Markdown format

  -- Key metrics (JSONB)
  metrics JSONB,
  highlights JSONB,
  trends JSONB,

  -- Generation metadata
  generated_at TIMESTAMP DEFAULT NOW(),
  generated_by VARCHAR(255),
  ai_model VARCHAR(100),
  regeneration_count INTEGER DEFAULT 0,

  -- Publishing
  status VARCHAR(50) DEFAULT 'draft',
  published_at TIMESTAMP,
  published_by VARCHAR(255),

  -- Export
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Migration
- **File**: `/migrations/0016_add_impact_reports.sql`
- Run with: `npm run db:migrate`

### Cron Job
- **Schedule**: 1st of each month at 9:00 AM EST
- **Function**: `generateMonthlyImpactReport()`
- **Location**: `/server/services/cron-jobs.ts`

### Cost Estimate
- ~$0.20 per report
- Monthly (1 report): ~$0.20

---

## 📈 Feature 4: Predictive Analytics

### Implementation
- **Service**: `/server/services/ai-predictions/index.ts`
- **API Routes**: `/server/routes/predictions.ts`
- **Model**: GPT-4o-mini

### How It Works
1. **Historical Analysis**: Gathers last 12 months of data
   - Events per month
   - Sandwiches distributed
   - Seasonal patterns
2. **Statistical Baseline**: Calculates averages and trends
3. **AI Enhancement**: GPT-4o-mini analyzes patterns and provides insights
4. **Seasonal Adjustments**: Applies known factors (holidays, school schedules)
5. **Confidence Intervals**: Provides range (±20%)

### API Endpoints

#### Predict Specific Month
```typescript
GET /api/predictions/month/:year/:month

Example: GET /api/predictions/month/2025/12

Response:
{
  "predictedSandwichCount": 15000,
  "confidenceLow": 12000,
  "confidenceHigh": 18000,
  "predictedEventCount": 50,
  "alertLevel": "high",  // 'low', 'normal', 'high'
  "reasoning": "December typically sees 30% increase due to holidays...",
  "recommendations": [
    "Start recruiting extra volunteers early",
    "Ensure adequate storage capacity",
    "Plan for increased supply purchases"
  ],
  "basedOnData": {
    "historicalMonths": 12,
    "averageSandwiches": 11500,
    "trend": "increasing"
  }
}
```

#### Predict Upcoming Months
```typescript
GET /api/predictions/upcoming?months=3

Response:
{
  "2025-12": { /* prediction for December */ },
  "2026-01": { /* prediction for January */ },
  "2026-02": { /* prediction for February */ }
}
```

### Cost Estimate
- ~$0.01 per prediction
- Monthly (3-month forecast): ~$0.03

---

## 💰 Total Cost Estimates

### Monthly Operating Costs (Moderate Usage)
- Receipt Processing (50 receipts): **$0.50**
- Event Categorization (100 events): **$0.10**
- Impact Reports (1 report): **$0.20**
- Predictive Analytics (3 forecasts): **$0.03**

**Total: ~$1-5/month** (very affordable for a nonprofit!)

---

## 🔧 Setup Instructions

### 1. Environment Variables
Add to `.env`:
```bash
AI_INTEGRATIONS_OPENAI_API_KEY=sk-proj-your-key-here
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1  # optional
```

### 2. Run Database Migrations
```bash
npm run db:migrate
```

This will create:
- `auto_categories` column in `event_requests` table
- `impact_reports` table
- Necessary indexes

### 3. Start Application
```bash
npm run dev  # Development
npm start    # Production
```

The cron jobs will automatically start and run on schedule.

---

## 📖 Usage Guide

### Receipt Auto-processing
1. Navigate to Expenses page
2. Click "Add Expense"
3. Upload receipt image
4. Click "Auto-fill from Receipt" button
5. Review extracted data
6. Confirm and save

*(UI integration pending - API ready)*

### Event Categorization
1. Create or view event request
2. Click "Categorize Event" button (or auto-categorize on creation)
3. Review AI suggestions
4. Accept or manually override
5. Categories saved to event record

*(UI integration pending - API ready)*

### Impact Reports
1. Navigate to Impact Reports page
2. Click "Generate Report"
3. Select date range and report type
4. Click "Generate"
5. Wait ~30 seconds for AI to generate
6. Review, edit if needed, then publish
7. Export as PDF (feature pending)

*(UI page creation pending - API ready)*

### Predictive Analytics
1. Navigate to Dashboard
2. View "Forecasts" section
3. See predictions for next 3 months
4. Click on a month for detailed prediction
5. Review recommendations

*(Dashboard integration pending - API ready)*

---

## 🛠️ Technical Architecture

### AI Services Location
```
server/services/
├── ai-event-categorization/
│   └── index.ts
├── ai-impact-reports/
│   └── index.ts
├── ai-predictions/
│   └── index.ts
└── ai-receipt-processor/
    └── index.ts
```

### API Routes Location
```
server/routes/
├── expenses.ts  (includes receipt processing endpoint)
├── event-requests.ts  (includes categorization endpoint)
├── impact-reports.ts
└── predictions.ts
```

### Database Migrations
```
migrations/
├── 0015_add_ai_categorization.sql
└── 0016_add_impact_reports.sql
```

### Cron Jobs
- **File**: `server/services/cron-jobs.ts`
- **Jobs**:
  - Monthly impact report generation (1st of month, 9 AM)
  - Volunteer reminders (existing)
  - Host availability scraper (existing)

---

## 🔒 Security & Best Practices

### API Key Security
- ✅ API key stored in environment variables
- ✅ Never committed to version control
- ✅ Server-side only (not exposed to client)

### Cost Controls
- ✅ Rate limiting built-in (100ms-200ms delays between batch operations)
- ✅ Fallback logic if AI unavailable
- ✅ Confidence scores to assess quality
- ✅ Caching where possible

### Error Handling
- ✅ Try-catch blocks on all AI calls
- ✅ Graceful degradation (heuristic fallbacks)
- ✅ Comprehensive logging
- ✅ User-friendly error messages

### Data Privacy
- ✅ No sensitive data sent to AI
- ✅ User data anonymized where possible
- ✅ Compliance with nonprofit data standards

---

## 🚀 Next Steps (UI Integration)

### To Complete the Features:
1. **Receipt Processing UI**
   - Add "Auto-fill from Receipt" button to ExpensesPage
   - Show loading state during processing
   - Display confidence score
   - Allow manual corrections

2. **Event Categorization UI**
   - Add category badge display to event cards
   - Show "Categorize" button on event details
   - Display confidence and reasoning
   - Allow manual override

3. **Impact Reports Page**
   - Create new page at `/impact-reports`
   - List all reports with filters
   - Report viewer with markdown rendering
   - PDF export functionality
   - Publish/unpublish workflow

4. **Predictive Analytics Dashboard**
   - Add forecast cards to main dashboard
   - Monthly prediction charts
   - Alert indicators (high/low)
   - Recommendation display

---

## 📚 Additional Resources

### OpenAI Models Used
- **GPT-4o**: Impact reports, predictions, receipt vision ($2.50/$10 per 1M tokens)
- **GPT-4o-mini**: Event categorization, prediction insights ($0.15/$0.60 per 1M tokens)

### Documentation
- [OpenAI API Docs](https://platform.openai.com/docs)
- [GPT-4o Vision Guide](https://platform.openai.com/docs/guides/vision)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Node-cron](https://www.npmjs.com/package/node-cron)

---

## ✅ Implementation Summary

All four AI features have been successfully implemented with:
- ✅ Backend services complete
- ✅ API endpoints functional
- ✅ Database schema updated
- ✅ Migrations created
- ✅ Cron jobs scheduled
- ✅ Error handling and logging
- ✅ Cost optimization
- ⏳ UI integration (pending)

**Status**: Backend complete, ready for frontend integration!
