# AI Chat Pattern

This document describes how to add AI-powered chat assistants to pages in the application. The system provides a reusable floating chat component that can be configured for different data contexts.

## Overview

The AI Chat pattern provides:
- **Floating chat button** in the bottom-right corner
- **Context-aware AI responses** based on the page's data
- **Chart generation** - AI can create bar, line, and pie charts
- **Export capabilities** - Charts can be exported as CSV, PNG, or copied to clipboard
- **Markdown rendering** - AI responses display with proper formatting

## Components

### FloatingAIChat (Client)

**Location:** `client/src/components/floating-ai-chat.tsx`

A reusable floating chat component that can be added to any page.

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `contextType` | `'collections' \| 'events' \| 'impact-reports'` | Yes | Determines which data the AI has access to |
| `title` | `string` | No | Header title (default: "AI Assistant") |
| `subtitle` | `string` | No | Header subtitle (default: "Ask questions about your data") |
| `suggestedQuestions` | `string[]` | No | Custom suggested questions (has defaults per context) |
| `contextData` | `Record<string, any>` | No | Additional context data to pass to the AI |

### API Endpoint (Server)

**Location:** `server/routes/ai-chat.ts`
**Endpoint:** `POST /api/ai-chat`

Handles AI chat requests with context-specific data loading.

**Request Body:**

```typescript
{
  message: string;              // User's question
  contextType: string;          // 'collections' | 'events' | 'impact-reports'
  contextData?: object;         // Optional additional context
  conversationHistory?: array;  // Previous messages for context
}
```

**Response:**

```typescript
{
  response: string;    // AI's text response (markdown)
  chart?: {            // Optional chart data
    type: 'bar' | 'line' | 'pie';
    title: string;
    data: Array<{ name: string; value: number }>;
    xKey?: string;
    yKey?: string;
    description?: string;
  };
  contextType: string;
}
```

## Quick Start

### Adding AI Chat to a Page

1. **Import the component:**

```tsx
import { FloatingAIChat } from '@/components/floating-ai-chat';
```

2. **Add to your component's JSX** (typically at the end, before closing `</div>`):

```tsx
export default function MyPage() {
  return (
    <div>
      {/* Your page content */}

      {/* AI Assistant */}
      <FloatingAIChat
        contextType="collections"
        title="Collection Insights"
        subtitle="Ask about your collection data"
      />
    </div>
  );
}
```

### With Custom Suggested Questions

```tsx
<FloatingAIChat
  contextType="events"
  title="Event Assistant"
  subtitle="Get insights about events"
  suggestedQuestions={[
    "Which organizations have the most events?",
    "Show me events by category",
    "What's our busiest month?",
    "Compare school vs corporate events",
  ]}
/>
```

## Context Types

### `collections`

Data available:
- Total collections and sandwiches
- Host statistics (collections per host, sandwiches per host)
- Monthly collection trends
- Day-of-week patterns
- Top hosts by sandwich count

Example questions:
- "Which host collected the most sandwiches?"
- "What's our average collection size?"
- "Show collections by month"
- "Which days have the most collections?"

### `events`

Data available:
- Total events and sandwiches
- Events by category (school, church, corporate, etc.)
- Events by status (new, scheduled, completed, etc.)
- Monthly event trends

Example questions:
- "Which organizations have the most events?"
- "Show me events by category"
- "What's our monthly event trend?"
- "How many events are scheduled vs completed?"

### `impact-reports`

Data available:
- Combined collections and events data
- Comprehensive metrics across both data types

Example questions:
- "What's our total impact this year?"
- "Compare collection vs event sandwiches"
- "Show overall monthly trends"

## Adding a New Context Type

To add support for a new data context:

### 1. Update the type definition

In `client/src/components/floating-ai-chat.tsx`:

```typescript
export type AIContextType = 'collections' | 'events' | 'impact-reports' | 'your-new-type';
```

### 2. Add default questions

```typescript
const DEFAULT_QUESTIONS: Record<AIContextType, string[]> = {
  // ... existing types
  'your-new-type': [
    "Question 1?",
    "Question 2?",
    "Question 3?",
    "Question 4?",
  ],
};
```

### 3. Add backend context builder

In `server/routes/ai-chat.ts`, add a new function:

```typescript
async function buildYourNewTypeContext(contextData?: Record<string, any>): Promise<string> {
  // Fetch your data
  const data = await db.query.yourTable.findMany();

  // Calculate relevant metrics
  // ...

  // Return formatted summary for AI
  return `
## Your Data Summary

### Overall Metrics
- Total Items: ${data.length}
- Other Metric: ${otherMetric}

### Breakdown
${breakdown.map(item => `- ${item.name}: ${item.value}`).join('\n')}
`;
}
```

### 4. Add case to switch statement

```typescript
switch (contextType) {
  case 'collections':
    dataSummary = await buildCollectionsContext(contextData);
    break;
  case 'your-new-type':
    dataSummary = await buildYourNewTypeContext(contextData);
    break;
  // ... other cases
}
```

## Best Practices

### DO:
- Provide context-specific suggested questions that match available data
- Use clear, descriptive titles and subtitles
- Test that the AI can answer the suggested questions accurately
- Include the most useful metrics in the context builder

### DON'T:
- Add AI chat to pages where it doesn't add value
- Expect the AI to know about data not included in the context
- Overload the context with too much data (keep summaries concise)

## Anti-Hallucination Rules

The AI is configured with strict rules to prevent hallucination:

1. Only uses data provided in the context summary
2. Does NOT invent sandwich types (no "vegetarian", "turkey", etc.)
3. Categories refer to organization types, not sandwich types
4. Admits when information is not available in the data
5. Never makes up statistics

## Files

| File | Purpose |
|------|---------|
| `client/src/components/floating-ai-chat.tsx` | Reusable floating chat UI component |
| `server/routes/ai-chat.ts` | API endpoint with context switching |
| `server/routes/index.ts` | Route registration (line ~478) |

## Current Usage

| Page | Context Type | Location |
|------|--------------|----------|
| Collection Log | `collections` | `client/src/components/sandwich-collection-log.tsx` |
| Event Impact Reports | `impact-reports` | `client/src/pages/event-impact-reports.tsx` (as tab, not floating) |

## Related Documentation

- [OpenAI API](https://platform.openai.com/docs/api-reference) - AI model API
- [Recharts](https://recharts.org/) - Chart library used for visualizations

---

**Last Updated:** 2025-11-28
