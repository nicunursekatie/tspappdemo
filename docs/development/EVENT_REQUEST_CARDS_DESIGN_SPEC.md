# Event Request Cards Design Specification
**Version:** 1.0  
**Date:** October 29, 2025  
**Purpose:** Comprehensive visual hierarchy standardization for NewRequestCard, InProcessCard, and ScheduledCard components

---

## Table of Contents
1. [Typography Tokens](#typography-tokens)
2. [Badge Variants](#badge-variants)
3. [Section Layout Standards](#section-layout-standards)
4. [Spacing Rules](#spacing-rules)
5. [Color Reference](#color-reference)
6. [Implementation Checklist](#implementation-checklist)

---

## 1. Typography Tokens

All typography should use Tailwind's responsive scale system, not fixed pixel sizes. Use the following standard classes across all three card types:

### 1.1 Organization Name
**Purpose:** Primary card identifier, most prominent text element

```tsx
className="text-xl font-bold text-[#236383]"
```

**Breakdown:**
- Size: `text-xl` (1.25rem / 20px)
- Weight: `font-bold` (700)
- Color: `text-[#236383]` (Brand Primary - dark teal-blue)
- Line Height: Default (1.5)

**Responsive Alternative (if needed):**
```tsx
className="text-lg sm:text-xl md:text-2xl font-bold text-[#236383]"
```

### 1.2 Department Text
**Purpose:** Secondary organizational identifier

```tsx
className="text-sm font-normal text-[#646464]"
```

**Breakdown:**
- Size: `text-sm` (0.875rem / 14px)
- Weight: `font-normal` (400)
- Color: `text-[#646464]` (dark gray, distinct from org name)
- Separator: Use `&bull;` entity for separation
- Display: Inline with organization name

**Example:**
```tsx
<h3 className="text-xl font-bold text-[#236383]">
  Mountain West Church
  {request.department && (
    <span className="text-sm font-normal text-[#646464] ml-2">
      &bull; {request.department}
    </span>
  )}
</h3>
```

### 1.3 Section Headers
**Purpose:** Organize content into logical groups

```tsx
className="text-sm font-semibold text-[#007E8C] uppercase tracking-wide"
```

**Breakdown:**
- Size: `text-sm` (0.875rem / 14px)
- Weight: `font-semibold` (600)
- Color: `text-[#007E8C]` (Brand Teal - consistent accent)
- Transform: `uppercase` (all caps for clear hierarchy)
- Tracking: `tracking-wide` (letter spacing for readability)
- Icon Size: `w-4 h-4` (when icons accompany headers)
- Icon Color: `text-[#007E8C]` (matches header text)

**Examples:**
```tsx
// Standard section header
<div className="flex items-center gap-2 mb-2">
  <Calendar className="w-4 h-4 text-[#007E8C]" />
  <span className="text-sm font-semibold text-[#007E8C] uppercase tracking-wide">
    Event Details
  </span>
</div>

// Alternative without icon
<p className="text-sm font-semibold text-[#007E8C] uppercase tracking-wide mb-2">
  Contact Information
</p>
```

### 1.4 Primary Content (Dates, Times, Names)
**Purpose:** Key information that users need to quickly scan

```tsx
className="text-base font-medium text-gray-900"
```

**Breakdown:**
- Size: `text-base` (1rem / 16px)
- Weight: `font-medium` (500)
- Color: `text-gray-900` (high contrast, easy to read)

**Emphasized Primary Content (e.g., date values, counts):**
```tsx
className="text-lg font-bold text-[#236383]"
```

**Breakdown:**
- Size: `text-lg` (1.125rem / 18px)
- Weight: `font-bold` (700)
- Color: `text-[#236383]` (Brand Primary for emphasis)

**Examples:**
```tsx
// Contact name
<span className="text-base font-medium text-gray-900">
  {request.firstName} {request.lastName}
</span>

// Event date (emphasized)
<span className="text-lg font-bold text-[#236383]">
  December 6, 2025
</span>

// Time values
<span className="text-base font-medium text-gray-900">
  10:00 AM - 12:00 PM
</span>
```

### 1.5 Secondary/Meta Information (Labels, Timestamps)
**Purpose:** Supporting information, less prominent than primary content

```tsx
className="text-sm text-gray-600"
```

**Breakdown:**
- Size: `text-sm` (0.875rem / 14px)
- Weight: `font-normal` (400, default)
- Color: `text-gray-600` (reduced contrast for hierarchy)

**Label Variation (when preceding a value):**
```tsx
className="text-sm font-medium text-gray-700"
```

**Extra Small Meta (timestamps, helper text):**
```tsx
className="text-xs text-gray-500"
```

**Examples:**
```tsx
// Field label followed by value
<div className="flex items-center gap-2">
  <span className="text-sm font-medium text-gray-700">Recipients:</span>
  <span className="text-base font-medium text-gray-900">
    Mountain West Church
  </span>
</div>

// Timestamp or helper text
<span className="text-xs text-gray-500">
  Assigned on {new Date(request.tspContactAssignedDate).toLocaleDateString()}
</span>

// Relative time
<span className="text-sm text-gray-600">
  (3 days ago)
</span>
```

### 1.6 Body Text (Messages, Notes)
**Purpose:** Longer form content within sections

```tsx
className="text-sm text-gray-700"
```

**Breakdown:**
- Size: `text-sm` (0.875rem / 14px)
- Weight: `font-normal` (400)
- Color: `text-gray-700` (readable but not dominant)
- White Space: Use `whitespace-pre-wrap` for user-entered content to preserve formatting

**Example:**
```tsx
<p className="text-sm text-gray-700 whitespace-pre-wrap">
  {request.message}
</p>
```

### 1.7 Icon Sizing Standards
**Purpose:** Consistent visual weight for icons

- **Small icons** (inline with text): `w-3 h-3`
- **Standard icons** (section headers, field labels): `w-4 h-4`
- **Large icons** (prominent features): `w-5 h-5`
- **Extra large icons** (visual emphasis): `w-6 h-6`

---

## 2. Badge Variants

### 2.1 PRIMARY Badges (Interactive, Status-Changing)

**Use Cases:** Date Confirmed/Pending, On Official Sheet, In Process status toggles

**Visual Style:** Gradient backgrounds with bold colors to indicate interactivity

**Base Classes:**
```tsx
className="px-3 py-1 text-sm font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-1.5 shadow-sm border"
```

#### PRIMARY Badge States:

**Confirmed/Active State:**
```tsx
className="bg-gradient-to-br from-[#007E8C] to-[#47B3CB] text-white border border-[#007E8C] px-3 py-1 text-sm font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-1.5 shadow-sm"
```

**Color Values:**
- Gradient From: `#007E8C` (Brand Teal)
- Gradient To: `#47B3CB` (Teal Light)
- Text: White
- Border: `#007E8C` (Brand Teal)

**Pending/Inactive State:**
```tsx
className="bg-gradient-to-br from-gray-500 to-gray-600 text-white border border-gray-500 px-3 py-1 text-sm font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-1.5 shadow-sm"
```

**Color Values:**
- Gradient From: `gray-500` (#6B7280)
- Gradient To: `gray-600` (#4B5563)
- Text: White
- Border: `gray-500`

**Alternative Active State (Official Sheet):**
```tsx
className="bg-gradient-to-br from-[#236383] to-[#007E8C] text-white border border-[#236383] px-3 py-1 text-sm font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-1.5 shadow-sm"
```

**Color Values:**
- Gradient From: `#236383` (Brand Primary)
- Gradient To: `#007E8C` (Brand Teal)
- Text: White
- Border: `#236383`

**Examples:**
```tsx
// Date Confirmed/Pending Toggle
<Badge
  onClick={() => toggleConfirmation()}
  className={`px-3 py-1 text-sm font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-1.5 shadow-sm border ${
    request.isConfirmed
      ? 'bg-gradient-to-br from-[#007E8C] to-[#47B3CB] text-white border-[#007E8C]'
      : 'bg-gradient-to-br from-gray-500 to-gray-600 text-white border-gray-500'
  }`}
  title="Click to toggle confirmation status"
>
  {request.isConfirmed ? '✓ Date Confirmed' : 'Date Pending'}
</Badge>

// On Official Sheet Toggle
<Badge
  onClick={() => toggleOfficialSheet()}
  className={`px-3 py-1 text-sm font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-1.5 shadow-sm border ${
    request.addedToOfficialSheet
      ? 'bg-gradient-to-br from-[#236383] to-[#007E8C] text-white border-[#236383]'
      : 'bg-gradient-to-br from-gray-500 to-gray-600 text-white border-gray-500'
  }`}
>
  {request.addedToOfficialSheet ? 'On Official Sheet' : 'Not on Sheet'}
</Badge>
```

### 2.2 INFORMATIONAL Badges (Display-Only, Contextual)

**Use Cases:** Sandwich count, staffing needs, manual entry, missing info, toolkit sent, etc.

**Visual Style:** Lighter, softer colors with solid backgrounds (no gradients)

**Base Classes:**
```tsx
className="px-2.5 py-0.5 text-sm font-medium rounded-full inline-flex items-center gap-1 border"
```

#### INFORMATIONAL Badge Variants:

**Neutral Information (Sandwich count, general info):**
```tsx
className="bg-[#FBAD3F]/10 text-[#D68319] border-[#FBAD3F]/30 px-2.5 py-0.5 text-sm font-medium rounded-full inline-flex items-center gap-1"
```

**Color Values:**
- Background: `#FBAD3F` at 10% opacity (very light orange)
- Text: `#D68319` (darker orange for contrast)
- Border: `#FBAD3F` at 30% opacity

**Success/Positive Information (Fully staffed, toolkit sent):**
```tsx
className="bg-[#007E8C]/10 text-[#007E8C] border-[#007E8C]/25 px-2.5 py-0.5 text-sm font-medium rounded-full inline-flex items-center gap-1"
```

**Color Values:**
- Background: `#007E8C` at 10% opacity (very light teal)
- Text: `#007E8C` (Brand Teal)
- Border: `#007E8C` at 25% opacity

**Warning/Action Needed (Needs follow-up, staffing needs):**
```tsx
className="bg-amber-50 text-amber-700 border-amber-300 px-2.5 py-0.5 text-sm font-medium rounded-full inline-flex items-center gap-1"
```

**Color Values:**
- Background: `amber-50` (Tailwind's light amber)
- Text: `amber-700` (Tailwind's dark amber)
- Border: `amber-300`

**Error/Missing Information (Critical issues):**
```tsx
className="bg-[#A31C41]/10 text-[#A31C41] border-[#A31C41] px-2.5 py-0.5 text-sm font-medium rounded-full inline-flex items-center gap-1"
```

**Color Values:**
- Background: `#A31C41` at 10% opacity (very light burgundy)
- Text: `#A31C41` (Brand Burgundy)
- Border: `#A31C41` (solid burgundy for emphasis)

**Critical Error/Urgent (Animated for attention):**
```tsx
className="bg-[#A31C41]/10 text-[#A31C41] border-[#A31C41] px-2.5 py-0.5 text-sm font-medium rounded-full inline-flex items-center gap-1 animate-pulse"
```

**Icon Guidelines for INFORMATIONAL Badges:**
- Icon size: `w-3 h-3`
- Icon placement: Before text
- Common icons: `Package`, `AlertTriangle`, `CheckCircle`, `FileText`, `Car`, `Users`

**Examples:**
```tsx
// Sandwich count badge
<Badge className="bg-[#FBAD3F]/10 text-[#D68319] border-[#FBAD3F]/30 px-2.5 py-0.5 text-sm font-medium rounded-full inline-flex items-center gap-1">
  <Package className="w-3 h-3" />
  500 sandwiches
</Badge>

// Fully staffed badge
<Badge className="bg-[#007E8C]/10 text-[#007E8C] border-[#007E8C]/25 px-2.5 py-0.5 text-sm font-medium rounded-full inline-flex items-center gap-1">
  <CheckCircle className="w-3 h-3" />
  Fully Staffed
</Badge>

// Needs follow-up badge
<Badge className="bg-amber-50 text-amber-700 border-amber-300 px-2.5 py-0.5 text-sm font-medium rounded-full inline-flex items-center gap-1">
  <AlertTriangle className="w-3 h-3" />
  Needs follow-up
</Badge>

// Missing information badge
<Badge className="bg-[#A31C41]/10 text-[#A31C41] border-[#A31C41] px-2.5 py-0.5 text-sm font-medium rounded-full inline-flex items-center gap-1">
  <AlertTriangle className="w-3 h-3" />
  Missing: Start Time
</Badge>

// Staffing needs badge (warning level)
<Badge className="bg-amber-50 text-amber-700 border-amber-300 px-2.5 py-0.5 text-sm font-medium rounded-full inline-flex items-center gap-1">
  <Car className="w-3 h-3" />
  2 drivers needed
</Badge>

// Manual entry badge (neutral info)
<Badge className="bg-[#FBAD3F]/10 text-[#D68319] border-[#FBAD3F]/30 px-2.5 py-0.5 text-sm font-medium rounded-full inline-flex items-center gap-1">
  <FileText className="w-3 h-3" />
  Manual Entry
</Badge>
```

### 2.3 Badge Decision Tree

Use this decision tree to choose the correct badge variant:

```
Does the user click this badge to change a status?
├── YES → PRIMARY Badge (with gradient)
│   └── Examples: Date Confirmed/Pending, On Official Sheet
│
└── NO → INFORMATIONAL Badge (solid, lighter colors)
    ├── Is this critical/missing information?
    │   └── YES → Error variant (burgundy)
    │
    ├── Does this need user action soon?
    │   └── YES → Warning variant (amber)
    │
    ├── Is this positive/success information?
    │   └── YES → Success variant (teal)
    │
    └── Is this neutral information?
        └── YES → Neutral variant (orange)
```

---

## 3. Section Layout Standards

### 3.1 Card Container
**Purpose:** Outer wrapper for entire card

```tsx
className="border-l-4 border-l-[#007E8C] bg-white shadow-sm transition-all duration-200 hover:shadow-lg"
```

**Breakdown:**
- Left Border: `border-l-4 border-l-[#007E8C]` (Brand Teal accent)
- Background: `bg-white`
- Shadow: `shadow-sm` (subtle elevation)
- Hover: `hover:shadow-lg` (interactive feedback)
- Transition: `transition-all duration-200` (smooth hover)

**Status-Specific Border Colors:**
- **New Requests:** `border-l-[#007E8C]` (Teal - default)
- **In Process (Normal):** `border-l-[#FBAD3F]` (Orange - active work)
- **In Process (Stale):** `border-l-[#A31C41]` (Burgundy - needs attention)
- **Scheduled:** `border-l-[#007E8C]` (Teal - ready to go)
- **Completed:** `border-l-emerald-600` (Green - success)
- **Declined:** `border-l-red-500` (Red - rejected)

### 3.2 Section Background Colors

**Purpose:** Visual grouping and hierarchy through color-coded sections

#### Contact Information Section
```tsx
className="bg-gray-50 rounded-lg p-3 space-y-2"
```

**Color Values:**
- Background: `gray-50` (#F9FAFB)
- Padding: `p-3` (0.75rem / 12px)
- Border Radius: `rounded-lg` (0.5rem / 8px)
- Internal Spacing: `space-y-2` (0.5rem / 8px vertical gap)

**Use Case:** Contact details (name, email, phone)

#### Event Details Section
```tsx
className="bg-[#007E8C]/5 border border-[#007E8C]/10 rounded-lg p-4 space-y-3"
```

**Color Values:**
- Background: `#007E8C` at 5% opacity (very light teal tint)
- Border: `#007E8C` at 10% opacity (subtle teal outline)
- Padding: `p-4` (1rem / 16px)
- Border Radius: `rounded-lg` (0.5rem / 8px)
- Internal Spacing: `space-y-3` (0.75rem / 12px vertical gap)

**Use Case:** Date, time, location, sandwich info

#### Team Assignments Section (Scheduled Cards)
```tsx
className="bg-[#236383]/5 border border-[#236383]/10 rounded-lg p-4 space-y-3"
```

**Color Values:**
- Background: `#236383` at 5% opacity (very light primary tint)
- Border: `#236383` at 10% opacity
- Padding: `p-4` (1rem / 16px)

**Use Case:** Driver, speaker, volunteer assignments

#### Event Organizer Section (Scheduled Cards)
```tsx
className="bg-[#47B3CB]/5 border border-[#47B3CB]/10 rounded-lg p-4 space-y-2"
```

**Color Values:**
- Background: `#47B3CB` at 5% opacity (very light teal)
- Border: `#47B3CB` at 10% opacity
- Padding: `p-4` (1rem / 16px)

**Use Case:** Contact person information

#### Delivery Logistics Section (Scheduled Cards)
```tsx
className="bg-[#FBAD3F]/5 border border-[#FBAD3F]/10 rounded-lg p-4 space-y-3"
```

**Color Values:**
- Background: `#FBAD3F` at 5% opacity (very light orange)
- Border: `#FBAD3F` at 10% opacity
- Padding: `p-4` (1rem / 16px)

**Use Case:** Recipients, pickup info, overnight holding

#### TSP Contact Assignment Section
```tsx
className="bg-gradient-to-r from-[#FBAD3F]/10 to-[#D68319]/10 border-2 border-[#FBAD3F]/30 rounded-lg p-4"
```

**Color Values:**
- Background Gradient From: `#FBAD3F` at 10% opacity
- Background Gradient To: `#D68319` at 10% opacity
- Border: `border-2` (thicker for emphasis) with `#FBAD3F` at 30% opacity
- Padding: `p-4` (1rem / 16px)

**Use Case:** TSP contact assignment (prominent display)

**Alternative Simpler TSP Contact (New/In Process):**
```tsx
className="bg-[#FFF4E6] border border-[#FBAD3F] rounded-lg p-3"
```

**Color Values:**
- Background: `#FFF4E6` (solid light orange/cream)
- Border: `#FBAD3F` (solid orange)

#### Submission/Meta Information Section
```tsx
className="bg-[#007E8C]/5 rounded-lg p-3 space-y-2"
```

**Color Values:**
- Background: `#007E8C` at 5% opacity (matches brand, lighter than event details)
- Padding: `p-3` (0.75rem / 12px)
- No border (lighter visual weight)

**Alternative Brand Primary Lighter (using Tailwind token):**
```tsx
className="bg-brand-primary-lighter rounded-lg p-3 space-y-2"
```

**Use Case:** Submission timestamp, contact attempts, scheduled call info

#### Sandwich Information Section
```tsx
className="bg-amber-50 rounded-lg p-3"
```

**Color Values:**
- Background: `amber-50` (Tailwind's light amber, #FFFBEB)
- Padding: `p-3` (0.75rem / 12px)

**Use Case:** Sandwich count, types, range information

#### Notes & Requirements Section
```tsx
className="bg-gray-50 rounded-lg p-4 space-y-3"
```

**Color Values:**
- Background: `gray-50` (#F9FAFB)
- Padding: `p-4` (1rem / 16px)
- Internal Spacing: `space-y-3` (0.75rem / 12px)

**Use Case:** Planning notes, scheduling notes, special requirements, messages

**Individual Note Backgrounds (when multiple note types):**
```tsx
// Generic note
className="bg-white p-3 rounded border-l-4 border-l-gray-300"

// Planning note
className="bg-white p-3 rounded border-l-4 border-l-[#007E8C]"

// Special requirements
className="bg-amber-50 p-2 rounded border-l-3 border-amber-200"

// Scheduling note
className="bg-green-50 p-2 rounded border-l-3 border-green-200"

// Follow-up note
className="bg-purple-50 p-2 rounded border-l-3 border-purple-200"
```

#### Prominent Date Display Box (In Process Cards)
```tsx
className="bg-[#236383] text-white rounded-lg p-4 shadow-md"
```

**Color Values:**
- Background: `#236383` (Brand Primary, solid)
- Text: `text-white`
- Padding: `p-4` (1rem / 16px)
- Shadow: `shadow-md` (elevated)

**Use Case:** Prominent event date display in In Process cards

#### Contact Attempts/Warning Section
```tsx
className="bg-amber-50 border border-amber-200 rounded-lg p-3"
```

**Color Values:**
- Background: `amber-50`
- Border: `amber-200`
- Padding: `p-3`

**Use Case:** Contact attempt tracking, needs follow-up

#### Stale Warning Badge/Section
```tsx
className="bg-red-500 text-white border-red-400 px-3 py-1 rounded"
```

**Use Case:** Over 1 week since toolkit sent, urgent follow-up needed

### 3.3 Border Styles

**Standard Section Border:**
```tsx
border border-{color}/10
```
Where `{color}` matches the section's theme color at 10% opacity

**Emphasized Section Border:**
```tsx
border-2 border-{color}/30
```
For TSP Contact and other important sections

**Left Accent Border (for notes/sub-items):**
```tsx
border-l-3 border-l-{color}
```
or
```tsx
border-l-4 border-l-{color}
```

**No Border:**
Many lighter sections use no border to reduce visual clutter

### 3.4 Padding Standards

**Card Container:**
```tsx
className="p-6"
```
- Padding: `p-6` (1.5rem / 24px all sides)

**Major Sections:**
```tsx
className="p-4"
```
- Padding: `p-4` (1rem / 16px all sides)

**Minor Sections:**
```tsx
className="p-3"
```
- Padding: `p-3` (0.75rem / 12px all sides)

**Compact Elements:**
```tsx
className="p-2"
```
- Padding: `p-2` (0.5rem / 8px all sides)

**Badge Padding:**
- PRIMARY badges: `px-3 py-1`
- INFORMATIONAL badges: `px-2.5 py-0.5`

### 3.5 Border Radius Standards

**Cards:**
```tsx
className="rounded-lg"
```
- Default card rounding: `rounded-lg` (0.5rem / 8px)

**Sections:**
```tsx
className="rounded-lg"
```
- All internal sections: `rounded-lg` (0.5rem / 8px)

**Badges:**
```tsx
className="rounded-full"
```
- Pill-shaped badges: `rounded-full` (9999px)

**Buttons:**
```tsx
className="rounded"
```
- Default button rounding: `rounded` (0.25rem / 4px)

---

## 4. Spacing Rules

### 4.1 Card-Level Spacing

**Card Container Padding:**
```tsx
className="p-6"
```
- All cards: `p-6` (1.5rem / 24px)

**Space Between Major Card Sections:**
```tsx
className="space-y-4"
```
- Vertical gap between sections: `space-y-4` (1rem / 16px)

**Alternative for denser layouts:**
```tsx
className="space-y-3"
```
- Vertical gap: `space-y-3` (0.75rem / 12px)

**Grid Layouts (two-column on desktop):**
```tsx
className="grid grid-cols-1 lg:grid-cols-2 gap-4"
```
- Mobile: Single column
- Desktop (lg breakpoint): Two columns
- Gap between columns: `gap-4` (1rem / 16px)

### 4.2 Section-Level Spacing

**Space Between Elements Within a Section:**
```tsx
className="space-y-2"
```
- For related items in a section: `space-y-2` (0.5rem / 8px)

**Alternative for more breathing room:**
```tsx
className="space-y-3"
```
- For sections with distinct sub-items: `space-y-3` (0.75rem / 12px)

**Horizontal Element Spacing (flex layouts):**
```tsx
className="gap-2"
```
- Small gaps: `gap-2` (0.5rem / 8px)

```tsx
className="gap-3"
```
- Medium gaps: `gap-3` (0.75rem / 12px)

```tsx
className="gap-4"
```
- Large gaps: `gap-4` (1rem / 16px)

### 4.3 Element-Level Spacing

**Margin Between Badges:**
```tsx
className="gap-2"
```
- When badges are in a flex container: `gap-2`

**Icon-to-Text Spacing:**
```tsx
className="gap-2"
```
- Standard icon + text: `gap-2` (0.5rem / 8px)

**Smaller icon-to-text:**
```tsx
className="gap-1"
```
- Compact layouts: `gap-1` (0.25rem / 4px)

**Button Group Spacing:**
```tsx
className="gap-2"
```
- Between action buttons: `gap-2` (0.5rem / 8px)

### 4.4 Margin Bottom (for sequential elements)

**After Headers:**
```tsx
className="mb-2"
```
- Space below section header: `mb-2` (0.5rem / 8px)

**After Major Sections:**
```tsx
className="mb-4"
```
- Space below major sections: `mb-4` (1rem / 16px)

**Before Action Buttons:**
```tsx
className="mt-4 pt-4 border-t"
```
- Top margin: `mt-4` (1rem / 16px)
- Top padding: `pt-4` (1rem / 16px)
- Top border: `border-t` (separator line)

### 4.5 Spacing Quick Reference Table

| Element Type | Spacing Class | Value | Use Case |
|-------------|---------------|-------|----------|
| Card padding | `p-6` | 24px | Outer card container |
| Major section gap | `space-y-4` | 16px | Between main sections |
| Minor section gap | `space-y-3` | 12px | Between sub-sections |
| Element gap | `space-y-2` | 8px | Between related items |
| Flex gap (standard) | `gap-2` | 8px | Icon-text, badges |
| Grid gap | `gap-4` | 16px | Two-column layouts |
| Section padding (major) | `p-4` | 16px | Large sections |
| Section padding (minor) | `p-3` | 12px | Small sections |
| Header margin | `mb-2` | 8px | Below section headers |
| Button row margin | `mt-4 pt-4` | 16px + 16px | Before action buttons |

---

## 5. Color Reference

### 5.1 Brand Colors (Primary Palette)

| Color Name | Hex Code | Tailwind Class | RGB | HSL | Usage |
|-----------|----------|----------------|-----|-----|-------|
| Brand Primary | `#236383` | `text-[#236383]` | rgb(35, 99, 131) | hsl(197, 58%, 33%) | Organization names, emphasized text, primary borders |
| Brand Teal | `#007E8C` | `text-[#007E8C]` | rgb(0, 126, 140) | hsl(186, 100%, 27%) | Section headers, card borders, links |
| Teal Light | `#47B3CB` | `text-[#47B3CB]` | rgb(71, 179, 203) | hsl(191, 56%, 54%) | Gradient accents, lighter elements |
| Brand Orange | `#FBAD3F` | `text-[#FBAD3F]` | rgb(251, 173, 63) | hsl(35, 96%, 62%) | Highlights, action buttons, attention |
| Orange Dark | `#D68319` | `text-[#D68319]` | rgb(214, 131, 25) | hsl(34, 79%, 47%) | Badge text (orange variant) |
| Brand Burgundy | `#A31C41` | `text-[#A31C41]` | rgb(163, 28, 65) | hsl(342, 71%, 37%) | Errors, missing info, urgent attention |
| Brand Navy | `#1A2332` | `text-[#1A2332]` | rgb(26, 35, 50) | hsl(218, 32%, 15%) | Dark text (rarely used) |

### 5.2 Neutral Colors

| Color Name | Tailwind Class | Hex Equivalent | Usage |
|-----------|----------------|----------------|-------|
| Gray 50 | `bg-gray-50` | #F9FAFB | Section backgrounds (light) |
| Gray 200 | `bg-gray-200` | #E5E7EB | Borders |
| Gray 300 | `border-gray-300` | #D1D5DB | Borders (darker) |
| Gray 400 | `text-gray-400` | #9CA3AF | Icons (muted) |
| Gray 500 | `text-gray-500` | #6B7280 | Meta text, icons |
| Gray 600 | `text-gray-600` | #4B5563 | Secondary text |
| Gray 700 | `text-gray-700` | #374151 | Body text, labels |
| Gray 900 | `text-gray-900` | #111827 | Primary content (high contrast) |

### 5.3 Semantic Colors

| Color Name | Tailwind Class | Hex Equivalent | Usage |
|-----------|----------------|----------------|-------|
| Amber 50 | `bg-amber-50` | #FFFBEB | Warning backgrounds |
| Amber 200 | `border-amber-200` | #FDE68A | Warning borders |
| Amber 300 | `border-amber-300` | #FCD34D | Warning borders (darker) |
| Amber 700 | `text-amber-700` | #B45309 | Warning text |
| Green 50 | `bg-green-50` | #F0FDF4 | Success backgrounds |
| Green 200 | `border-green-200` | #BBF7D0 | Success borders |
| Emerald 600 | `border-l-emerald-600` | #059669 | Success accents |
| Red 500 | `border-l-red-500` | #EF4444 | Error accents |
| Red 400 | `border-red-400` | #F87171 | Error borders |

### 5.4 Opacity Guidelines

**Backgrounds (semi-transparent):**
- 5% opacity: `/5` - Very subtle tint, minimal visual weight
- 10% opacity: `/10` - Light background, clear color association
- 20% opacity: `/20` - Noticeable background, still light

**Borders:**
- 10% opacity: `/10` - Subtle outline
- 25% opacity: `/25` - Standard border
- 30% opacity: `/30` - Emphasized border

**Example:**
```tsx
bg-[#007E8C]/5    // Background at 5% opacity
border-[#007E8C]/10  // Border at 10% opacity
```

---

## 6. Implementation Checklist

### 6.1 NewRequestCard.tsx Updates

- [ ] Replace `text-[20px]` with `text-xl` for organization name
- [ ] Update organization name color to `text-[#236383]`
- [ ] Standardize department text to `text-sm font-normal text-[#646464]`
- [ ] Update all section headers to `text-sm font-semibold text-[#007E8C] uppercase tracking-wide`
- [ ] Replace `text-[18px]` date labels with `text-sm font-medium text-gray-700`
- [ ] Replace `text-[18px]` date values with `text-lg font-bold text-[#236383]`
- [ ] Update contact names to `text-base font-medium text-gray-900`
- [ ] Replace `text-[16px]`/`text-[17px]` headers with standard section header classes
- [ ] Update message body to `text-sm text-gray-700 whitespace-pre-wrap`
- [ ] Update confirmation badge to use gradient (`bg-gradient-to-br from-[#007E8C] to-[#47B3CB]`)
- [ ] Update "Previously hosted" badge to INFORMATIONAL style (no gradient)
- [ ] Update "Needs follow-up" badge to use `bg-amber-50 text-amber-700 border-amber-300`
- [ ] Ensure TSP contact section uses `bg-[#FFF4E6] border border-[#FBAD3F]`
- [ ] Update section spacing to use `space-y-4` for major sections
- [ ] Verify icon sizes (w-4 h-4 for section icons, w-3 h-3 for badges)
- [ ] Update button text to inherit from button size prop (remove `text-[15px]`)
- [ ] Ensure card padding is `p-6`

### 6.2 InProcessCard.tsx Updates

- [ ] Replace responsive org name sizes with `text-xl font-bold text-[#236383]`
- [ ] Update department to `text-sm font-normal text-[#646464]`
- [ ] Standardize all section headers to uniform style
- [ ] Update confirmation badge to gradient style
- [ ] Update "Needs follow-up" badge to standard warning style
- [ ] Update missing info badges to `bg-[#A31C41]/10 text-[#A31C41] border-[#A31C41]`
- [ ] Update toolkit sent badge to success variant (`bg-[#007E8C]/10 text-[#007E8C] border-[#007E8C]/25`)
- [ ] Update stale warning to `bg-red-500 text-white border-red-400` (keep as-is, matches spec)
- [ ] Update TSP contact section to gradient style or simpler solid style (consistent with other cards)
- [ ] Verify prominent date box styling: `bg-[#236383] text-white rounded-lg p-4 shadow-md`
- [ ] Update note section backgrounds to use consistent left-border pattern
- [ ] Ensure all padding follows standards (p-6 for card, p-4 for major sections, p-3 for minor)
- [ ] Update grid spacing to `gap-4`
- [ ] Verify icon consistency

### 6.3 ScheduledCard.tsx (ScheduledCardEnhanced) Updates

- [ ] Update organization name to `text-xl font-bold text-[#236383]` (from `text-2xl`)
- [ ] Update department to `text-sm font-normal text-[#646464]`
- [ ] Verify section headers already use uppercase style (should be good)
- [ ] Update date value to `text-lg font-bold text-[#236383]`
- [ ] Keep PRIMARY badges with gradients (confirmation, official sheet) - already correct
- [ ] Update INFORMATIONAL badges to remove gradients:
  - [ ] Sandwich count: `bg-[#FBAD3F]/10 text-[#D68319] border-[#FBAD3F]/30`
  - [ ] Manual entry: `bg-[#FBAD3F]/10 text-[#D68319] border-[#FBAD3F]/30`
  - [ ] Fully staffed: `bg-[#007E8C]/10 text-[#007E8C] border-[#007E8C]/25`
  - [ ] Staffing needs: `bg-amber-50 text-amber-700 border-amber-300`
  - [ ] Van driver needed: `bg-[#FBAD3F]/10 text-[#D68319] border-[#FBAD3F]/30`
  - [ ] Missing info: Keep `bg-[#A31C41]/10 text-[#A31C41] border-[#A31C41] animate-pulse`
- [ ] Update recipient badges to INFORMATIONAL style (remove semi-transparent white)
- [ ] Verify all section backgrounds use 5% opacity tints with 10% borders
- [ ] Update time labels to `text-sm font-medium text-gray-700`
- [ ] Update time values to `text-base font-medium text-gray-900`
- [ ] Verify card padding is `p-5` or update to `p-6` for consistency
- [ ] Update staffing section to use consistent background/border pattern
- [ ] Ensure assignment rows use subtle background (`bg-[#47B3CB]/10`)
- [ ] Verify spacing consistency

### 6.4 Shared/Cross-Cutting Updates

- [ ] Create a shared `CardHeader` component with standardized styling
- [ ] Create a shared `CardContactInfo` component
- [ ] Create badge utility/helper to generate correct classes based on type
- [ ] Update any inline pixel sizes to Tailwind scale
- [ ] Ensure all cards use same border-left accent approach
- [ ] Verify all hover states use `hover:opacity-80` or `hover:shadow-lg`
- [ ] Test responsive behavior (should work with Tailwind scale)
- [ ] Audit all custom colors and ensure they're from the approved palette
- [ ] Remove any hardcoded pixel values
- [ ] Ensure consistent use of `rounded-lg` for sections, `rounded-full` for badges

### 6.5 Testing & Validation

- [ ] Visual regression test: Compare before/after screenshots
- [ ] Verify color contrast ratios meet WCAG AA standards (minimum 4.5:1)
- [ ] Test all interactive badges (click functionality preserved)
- [ ] Test on mobile devices (responsive typography)
- [ ] Verify all sections have proper spacing on different screen sizes
- [ ] Check that gradient badges only appear on interactive elements
- [ ] Verify all INFORMATIONAL badges use solid colors (no gradients)
- [ ] Ensure TSP contact section is visually prominent across all card types
- [ ] Test dark mode compatibility (if applicable in the future)
- [ ] Verify accessibility (screen reader compatibility, keyboard navigation)

---

## 7. Implementation Notes

### 7.1 Key Principles

1. **Consistency Over Perfection:** Apply the same pattern across all three cards, even if individual cards had unique features before.

2. **Gradients = Interactive:** Only use gradient backgrounds for badges that users can click to change a status.

3. **Color Semantics:** Use color to convey meaning:
   - Teal (#007E8C): Brand, navigation, standard info
   - Orange (#FBAD3F): Action needed, highlights
   - Burgundy (#A31C41): Errors, missing info, urgent
   - Amber: Warnings, follow-ups
   - Gray: Neutral information

4. **Typography Hierarchy:** Larger, bolder, darker = more important. Use the defined scale consistently.

5. **Spacing Rhythm:** Use multiples of 4px (Tailwind's spacing scale). Maintain consistent gaps.

### 7.2 Migration Strategy

**Phase 1: Typography** (Low Risk)
- Update all text sizes, weights, and colors
- This is the least disruptive change

**Phase 2: Badges** (Medium Risk)
- Update badge styling
- Separate PRIMARY (gradient) from INFORMATIONAL (solid)
- Test all interactive badges

**Phase 3: Sections** (Medium Risk)
- Update section backgrounds, borders, padding
- Ensure visual hierarchy is maintained

**Phase 4: Spacing** (Low Risk)
- Standardize all spacing values
- Fine-tune as needed

### 7.3 Common Pitfalls to Avoid

1. **Don't mix pixel sizes with Tailwind scale:** Use `text-lg`, not `text-[18px]`
2. **Don't use gradients on non-interactive elements:** Keep them for PRIMARY badges only
3. **Don't vary padding within the same card type:** Stick to p-6, p-4, p-3, p-2
4. **Don't create new colors:** Use only the approved palette
5. **Don't skip opacity values:** When using brand colors for backgrounds, use `/5` or `/10` opacity
6. **Don't forget icon sizing:** Match icon size to text size (w-4 h-4 for base text)

### 7.4 Future Considerations

- **Component Library:** Consider creating reusable components for sections (EventDetailsSection, ContactInfoSection, etc.)
- **Theme Tokens:** Move hardcoded colors to CSS variables for easier theming
- **Accessibility Enhancements:** Add ARIA labels, improved focus states, keyboard shortcuts
- **Dark Mode:** Plan for dark mode support with proper color adjustments
- **Animation:** Consider subtle animations for status changes (fade-in, slide, etc.)

---

## 8. Quick Reference: Before & After

### Organization Name
❌ **Before (NewRequestCard):**
```tsx
<h3 className="font-semibold text-[20px] bg-[#47B3CB] text-white px-2 py-1 rounded">
```

✅ **After:**
```tsx
<h3 className="text-xl font-bold text-[#236383]">
```

### Section Header
❌ **Before (varied):**
```tsx
<p className="text-[16px] font-bold text-gray-500">
<p className="text-[17px] font-bold text-gray-500">
<p className="text-sm sm:text-base md:text-lg font-semibold text-[#007E8C]">
```

✅ **After:**
```tsx
<div className="flex items-center gap-2 mb-2">
  <Calendar className="w-4 h-4 text-[#007E8C]" />
  <span className="text-sm font-semibold text-[#007E8C] uppercase tracking-wide">
    Event Details
  </span>
</div>
```

### PRIMARY Badge (Interactive)
❌ **Before (NewRequestCard):**
```tsx
<Badge className="px-3 py-1 text-sm font-medium bg-[#007E8C] text-white">
  ✓ Date Confirmed
</Badge>
```

✅ **After:**
```tsx
<Badge
  onClick={toggleConfirmation}
  className="bg-gradient-to-br from-[#007E8C] to-[#47B3CB] text-white border border-[#007E8C] px-3 py-1 text-sm font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-1.5 shadow-sm"
>
  ✓ Date Confirmed
</Badge>
```

### INFORMATIONAL Badge
❌ **Before (ScheduledCard - used gradient):**
```tsx
<Badge className="bg-gradient-to-br from-[#FBAD3F] to-[#FF8C00] text-white border border-[#FBAD3F] font-medium">
  <Package className="w-3 h-3 mr-1" />
  500 sandwiches
</Badge>
```

✅ **After:**
```tsx
<Badge className="bg-[#FBAD3F]/10 text-[#D68319] border-[#FBAD3F]/30 px-2.5 py-0.5 text-sm font-medium rounded-full inline-flex items-center gap-1">
  <Package className="w-3 h-3" />
  500 sandwiches
</Badge>
```

### Section Background
❌ **Before (varied approaches):**
```tsx
<div className="bg-gray-50 rounded-lg p-3">
<div className="bg-brand-primary-lighter rounded-lg p-3">
<div className="bg-[#007E8C]/5 border border-[#007E8C]/10 rounded-lg p-4">
```

✅ **After (standardized by section type):**
```tsx
// Contact Info
<div className="bg-gray-50 rounded-lg p-3 space-y-2">

// Event Details
<div className="bg-[#007E8C]/5 border border-[#007E8C]/10 rounded-lg p-4 space-y-3">

// Team Assignments
<div className="bg-[#236383]/5 border border-[#236383]/10 rounded-lg p-4 space-y-3">
```

---

## Appendix A: Complete Color Palette

### Brand Colors
```css
#236383  /* Brand Primary - Dark Teal-Blue */
#007E8C  /* Brand Teal */
#47B3CB  /* Teal Light */
#FBAD3F  /* Brand Orange */
#D68319  /* Orange Dark */
#E89A2F  /* Orange Darker */
#A31C41  /* Brand Burgundy */
#1A2332  /* Brand Navy */
#646464  /* Dark Gray (departments) */
#D1D3D4  /* Light Gray */
```

### Semantic Colors (Tailwind)
```css
gray-50   /* #F9FAFB - Light backgrounds */
gray-500  /* #6B7280 - Meta text */
gray-600  /* #4B5563 - Secondary text */
gray-700  /* #374151 - Body text */
gray-900  /* #111827 - Primary text */

amber-50  /* #FFFBEB - Warning backgrounds */
amber-200 /* #FDE68A - Warning borders */
amber-300 /* #FCD34D - Warning borders (darker) */
amber-700 /* #B45309 - Warning text */

green-50  /* #F0FDF4 - Success backgrounds */
green-200 /* #BBF7D0 - Success borders */
emerald-600 /* #059669 - Success accents */

red-400   /* #F87171 - Error borders */
red-500   /* #EF4444 - Error accents */
```

---

## Appendix B: Spacing Scale Reference

| Tailwind Class | Rem Value | Pixel Value | Common Usage |
|----------------|-----------|-------------|--------------|
| `gap-1`, `space-y-1` | 0.25rem | 4px | Tight spacing (icon-text) |
| `gap-2`, `space-y-2` | 0.5rem | 8px | Related elements |
| `gap-3`, `space-y-3` | 0.75rem | 12px | Section sub-items |
| `gap-4`, `space-y-4` | 1rem | 16px | Major sections |
| `p-2` | 0.5rem | 8px | Compact padding |
| `p-3` | 0.75rem | 12px | Minor sections |
| `p-4` | 1rem | 16px | Major sections |
| `p-6` | 1.5rem | 24px | Card container |

---

## Appendix C: Example Complete Card Structure

```tsx
<Card className="border-l-4 border-l-[#007E8C] bg-white shadow-sm transition-all duration-200 hover:shadow-lg">
  <CardContent className="p-6">
    {/* Header */}
    <div className="mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-xl font-bold text-[#236383]">
          Mountain West Church
          <span className="text-sm font-normal text-[#646464] ml-2">
            &bull; Youth Group
          </span>
        </h3>
        <Badge
          onClick={toggleConfirmation}
          className={`px-3 py-1 text-sm font-medium rounded-full cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-1.5 shadow-sm border ${
            isConfirmed
              ? 'bg-gradient-to-br from-[#007E8C] to-[#47B3CB] text-white border-[#007E8C]'
              : 'bg-gradient-to-br from-gray-500 to-gray-600 text-white border-gray-500'
          }`}
        >
          {isConfirmed ? '✓ Date Confirmed' : 'Date Pending'}
        </Badge>
      </div>
    </div>

    {/* Main Content Grid */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      {/* Left Column - Event Details */}
      <div className="space-y-4">
        {/* Event Details Section */}
        <div className="bg-[#007E8C]/5 border border-[#007E8C]/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-[#007E8C]" />
            <span className="text-sm font-semibold text-[#007E8C] uppercase tracking-wide">
              Event Details
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Date:</span>
            <span className="text-lg font-bold text-[#236383]">
              December 6, 2025
            </span>
          </div>
        </div>

        {/* Sandwich Info */}
        <div className="bg-amber-50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-gray-700">Sandwiches:</span>
            <Badge className="bg-[#FBAD3F]/10 text-[#D68319] border-[#FBAD3F]/30 px-2.5 py-0.5 text-sm font-medium rounded-full inline-flex items-center gap-1">
              <Package className="w-3 h-3" />
              500 total
            </Badge>
          </div>
        </div>
      </div>

      {/* Right Column - Contact Info */}
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-[#007E8C]" />
            <span className="text-sm font-semibold text-[#007E8C] uppercase tracking-wide">
              Contact Information
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-base font-medium text-gray-900">
              John Smith
            </span>
            <div className="text-sm text-gray-600">
              john.smith@example.com
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Action Buttons */}
    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
      <Button size="sm" variant="default">
        <Mail className="w-4 h-4 mr-1" />
        Contact
      </Button>
      <div className="flex-1" />
      <Button size="sm" variant="ghost">
        <Edit className="w-4 h-4" />
      </Button>
    </div>
  </CardContent>
</Card>
```

---

**END OF SPECIFICATION**
