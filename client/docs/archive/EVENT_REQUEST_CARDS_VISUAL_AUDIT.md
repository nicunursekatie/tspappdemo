# Event Request Cards Visual Hierarchy Audit
**Date:** October 29, 2025  
**Purpose:** Comprehensive analysis of typography, badges, backgrounds, and interactive features across all three event request card components for standardization planning.

---

## 1. NewRequestCard.tsx

### Typography Analysis

#### Organization Name & Department
- **Organization Name:** 
  - Size: `text-[20px]` (fixed pixel size)
  - Weight: `font-semibold`
  - Color: `text-white` on `bg-[#47B3CB]`
  - Style: Inline badge/pill with `px-2 py-1 rounded`
  - Department: Shown inline with bullet separator, same white color

#### Date Information
- **Date Label:** `text-[19px]`, color `text-[#007E8C]`
- **Date Value:** `text-[18px]`, `font-bold`, color `text-[#007E8C]`
- **Relative Time:** Same `text-[#007E8C]` color, inline with date
- **When Editing:** Date label becomes `text-sm font-medium`

#### Contact Information
- **Contact Name:** `text-[18px]`, `font-medium`, icon `w-4 h-4 text-gray-500`
- **Email/Phone:** `text-[18px]`, uses `text-brand-primary-muted hover:text-brand-primary-dark`
- **Icons:** `w-4 h-4 text-gray-400`

#### Section Headers
- **"Submitted":** `text-[16px]`, `font-bold`, `text-gray-500`
- **"Previously hosted":** `text-[16px]`, `font-bold`, `text-gray-500`
- **"Message from submission":** `text-[17px]`, `font-bold`, `text-gray-500`
- **Inconsistency:** Headers vary between 16px and 17px

#### Body Content
- **Date/Time Display:** `text-[18px]`, `font-medium`
- **Message Body:** `text-[16px]`, `text-gray-600`
- **Sandwich Count:** `text-sm` (inherits from parent div)

#### Meta/Secondary Information
- **Time Badge (e.g., "3 days ago"):** `text-[14px]`, white on `bg-[#236383]`
- **Icons Throughout:** Mostly `w-4 h-4`, some `w-3 h-3` for buttons

#### Buttons
- **Call/Email Buttons:** `text-[15px]`, `size="sm"`, `variant="outline"`
- **Action Buttons (Send Toolkit, Schedule Call, etc.):** `text-[16px]`, `size="sm"`
- **Icon-only Buttons:** `w-4 h-4` icons

### Badges Analysis

#### Interactive Badges
1. **Confirmation Status Badge** (Line 177-186)
   - **Behavior:** Click to toggle `isConfirmed` state
   - **Styling:** `px-3 py-1 text-sm font-medium shadow-sm cursor-pointer hover:opacity-80 transition-opacity`
   - **Date Confirmed:** `bg-[#007E8C] text-white`
   - **Date Pending:** `bg-[#236383] text-white`
   - **Interactive:** ✅ Yes (onClick handler)

#### Display-Only Badges
2. **"Needs follow-up" Badge** (Line 188-192)
   - **Styling:** `bg-amber-50 text-amber-700 border-amber-300`
   - **Icon:** `AlertTriangle w-3 h-3 mr-1`
   - **Interactive:** ❌ No

3. **Time Since Submission Badge** (Line 409-412)
   - **Text:** `text-[14px]`
   - **Styling:** `bg-[#236383] text-white border-0 shadow-lg hover:bg-[#007E8C] transition-all duration-200`
   - **Interactive:** ❌ No (hover effect but not clickable)

4. **Previously Hosted Badge** (Line 455-463)
   - **Text:** `text-[14px]`
   - **"Yes":** `bg-[#007E8C] text-white border-0 shadow-lg hover:bg-[#47B3CB] transition-all duration-200`
   - **"No - First Time":** `bg-[#236383] text-white border-0 shadow-lg hover:bg-[#007E8C] transition-all duration-200`
   - **Interactive:** ❌ No (hover effect but not clickable)

### Section Backgrounds

| Section | Background | Border | Padding | Border Radius |
|---------|-----------|--------|---------|---------------|
| **Card Container** | `bg-white` | `border-l-4 border-l-[#007E8C]` | `p-6` | Default card radius |
| **Submitted Info** | `bg-brand-primary-lighter` | None | `p-3` | `rounded-lg` |
| **Sandwich Info** | `bg-amber-50` | None | `p-3` | `rounded-lg` |
| **Previously Hosted** | `bg-gray-50` | None | `p-3` | `rounded-lg` |
| **Message Section** | `bg-gray-50` | None | `p-3` | `rounded-lg` |
| **Contact Info** | `bg-gray-50` | None | `p-3` | `rounded-lg` |
| **TSP Contact** | `bg-[#FFF4E6]` | `border border-[#FBAD3F]` | `p-3` | `rounded-lg` |

### Interactive Features

1. **Inline Date Editing**
   - Trigger: Click edit button next to date (opacity-based reveal on hover)
   - Components: Date input, Save button, Cancel button
   - Editing state controlled by: `isEditingThisCard && editingField === dateFieldToEdit`

2. **Confirmation Badge Toggle**
   - Trigger: Click on badge
   - Behavior: Calls `startEditing('isConfirmed', (!request.isConfirmed).toString())`

3. **Contact Actions**
   - Call Button: Triggers `onCall()`
   - Email Button: Triggers `onContact()`

4. **TSP Contact Management**
   - Assign TSP Contact Button: Shows when no TSP contact assigned
   - Edit TSP Contact Button: Icon button visible when contact exists and user has permission

5. **Action Button Row**
   - Send Toolkit
   - Schedule Call
   - Log Contact
   - Edit (ghost button with Edit icon)
   - Delete (ghost button with Trash icon, wrapped in ConfirmationDialog)

6. **Audit Log Toggle**
   - Collapsible section with ChevronDown/ChevronUp icon
   - Shows EventRequestAuditLog component when expanded

---

## 2. InProcessCard.tsx

### Typography Analysis

#### Organization Name & Department
- **Organization Name:** 
  - **Responsive Sizing:** `text-base sm:text-lg md:text-xl lg:text-2xl`
  - Weight: `font-bold`
  - Color: `text-[#007E8C]`
  - Department: `text-sm sm:text-base md:text-lg font-normal text-[#646464]`
  - **Key Difference:** Uses responsive breakpoints instead of fixed pixel sizes

#### Date Information (Prominent Box)
- **Section Background:** `bg-[#236383] text-white rounded-lg p-4 shadow-md`
- **Header Label:** `font-semibold text-sm uppercase tracking-wide` "EVENT DATE"
- **Date Value:** `text-sm sm:text-base md:text-lg font-bold break-words`
- **Relative Time:** `text-sm opacity-80`
- **Key Difference:** Date displayed in a prominent colored box, not inline

#### Contact Information
- **Contact Name:** `text-sm sm:text-base md:text-lg break-words font-medium`
- **Email/Phone:** `text-sm sm:text-base md:text-lg break-words`
- **Icons:** `w-4 h-4 text-gray-500` for name, `w-4 h-4 text-gray-400` for email/phone

#### Section Headers
- **"Preferred Time":** `text-sm sm:text-base md:text-lg font-semibold text-[#007E8C]`
- **"Notes & Requirements":** `font-medium text-gray-700` with `MessageSquare` icon
- **Note Sub-headers:** `text-sm font-medium text-gray-600`
- **Key Difference:** Uses responsive sizing and different color scheme

#### Body Content
- **Time Display:** Inherits font styling, no explicit size
- **Note Content:** `text-sm text-gray-700` with various colored backgrounds
- **Sandwich Count:** `text-sm`

#### Meta/Secondary Information
- **Toolkit Sent:** `text-sm font-medium` in colored badge-like div
- **TSP Contact Assignment Date:** `text-sm text-gray-600`

#### Buttons
- **Call/Email Buttons:** `text-[15px]`, `size="sm"`, `variant="outline"`
- **Schedule Button:** `size="sm"`, `variant="outline"`

### Badges Analysis

#### Interactive Badges
1. **Confirmation Status Badge** (Line 185-194)
   - **Behavior:** Click to toggle `isConfirmed` state
   - **Styling:** `px-3 py-1 text-sm font-medium shadow-sm cursor-pointer hover:opacity-80 transition-opacity`
   - **Date Confirmed:** `bg-[#007E8C] text-white`
   - **Date Pending:** `bg-[#236383] text-white`
   - **Interactive:** ✅ Yes (onClick handler)
   - **Identical to NewRequestCard**

#### Display-Only Badges
2. **"Needs follow-up" Badge** (Line 196-203)
   - **Styling:** `bg-amber-50 text-amber-700 border-amber-300`
   - **Interactive:** ❌ No

3. **Missing Info Badges** (Line 212-221)
   - **Styling:** `bg-[#A31C41]/10 text-[#A31C41] border-[#A31C41] px-2.5 py-0.5 text-sm font-medium shadow-sm`
   - **Icon:** `AlertTriangle w-3 h-3 mr-1`
   - **Text:** "Missing: {item}"
   - **Multiple:** One badge per missing item
   - **Interactive:** ❌ No
   - **Key Feature:** Unique to InProcessCard

4. **Toolkit Sent Badge** (Line 417-419)
   - **Styling:** `border-[#007E8C]/25 bg-[#00CED1]/10 text-[#007E8C] px-3 py-2 text-sm font-medium`
   - **Icon:** `Package w-4 h-4`
   - **Interactive:** ❌ No

5. **Stale Warning Badge** (Line 427-431)
   - **Styling:** `bg-red-500 text-white border-red-400 px-3 py-1`
   - **Icon:** `AlertTriangle w-4 h-4 mr-1`
   - **Text:** "Follow-up needed - Over 1 week since toolkit sent"
   - **Interactive:** ❌ No
   - **Key Feature:** Only shows when `isStale` prop is true

### Section Backgrounds

| Section | Background | Border | Padding | Border Radius |
|---------|-----------|--------|---------|---------------|
| **Card Container** | `bg-white` | `border-l-4` (Stale: `border-l-[#A31C41]`, Normal: `border-l-[#FBAD3F]`) | `p-6` | Default |
| **Event Date Box** | `bg-[#236383] text-white` | None | `p-4` | `rounded-lg` with `shadow-md` |
| **Contact Attempts** | `bg-amber-50` | `border border-amber-200` | `p-3` | `rounded-lg` |
| **Scheduled Call** | `bg-brand-primary-lighter` | None | `p-3` | `rounded-lg` |
| **Preferred Time** | `bg-gray-50` | None | `p-3` | `rounded-lg` |
| **Sandwich Info** | `bg-amber-50` | None | `p-3` | `rounded-lg` |
| **Contact Info** | `bg-gray-50` | None | `p-3` | `rounded-lg` |
| **TSP Contact** | `bg-gradient-to-r from-[#FBAD3F]/10 to-[#D68319]/10` | `border-2 border-[#FBAD3F]/30` | `p-4` | `rounded-lg` |
| **Notes Section** | `bg-gray-50` | None | `p-4` | `rounded-lg` |
| **Individual Notes** | Various (white, brand-primary-lighter, amber-50, green-50, purple-50, orange-50, red-50, etc.) | `border-l-3` with matching colors | `p-2` | `rounded` |

**Key Differences:**
- Card border color changes based on stale status
- Event date has unique prominent colored box treatment
- TSP Contact uses gradient background (unique styling)
- Notes have individual colored backgrounds with left borders

### Interactive Features

1. **Inline Date Editing**
   - Location: Within the Event Date box (blue background section)
   - Trigger: Click edit button (opacity-based reveal on hover) or click on date
   - Components: Date input (white background on blue), Save button (`bg-[#FBAD3F]`), Cancel button
   - Editing state: `isEditingThisCard && editingField === dateFieldToEdit`

2. **Confirmation Badge Toggle**
   - Identical to NewRequestCard

3. **Contact Actions**
   - Call Button
   - Email Button
   - Schedule Call Button
   - Resend Toolkit Button (conditional)

4. **TSP Contact Management**
   - Similar to NewRequestCard but with different visual styling

5. **Audit Log Toggle**
   - Same as NewRequestCard

6. **Edit/Delete Actions**
   - Edit button (ghost)
   - Delete button (ghost, wrapped in ConfirmationDialog)

---

## 3. ScheduledCardEnhanced.tsx

### Typography Analysis

#### Organization Name & Department
- **Organization Name:** 
  - Size: `text-2xl` (Tailwind scale, not fixed pixels)
  - Weight: `font-bold`
  - Color: `text-[#236383]`
  - Department: `text-sm text-[#236383]/70 font-medium`
  - **Key Difference:** Uses Tailwind's scale system, darker color scheme

#### Date Information
- **Date Value:** `font-bold text-lg text-[#236383]`
- **Icon:** `Calendar w-5 h-5 shrink-0 text-[#007E8C]`
- **Key Difference:** Larger icon, darker text color

#### Section Headers (Uppercase with Icons)
- **"EVENT DETAILS":** `font-bold text-sm text-[#236383] uppercase tracking-wide`, icon `Calendar w-4 h-4 text-[#007E8C]`
- **"Event Organizer":** Same styling, icon `Users w-4 h-4 text-[#47B3CB]`
- **"Delivery Logistics":** Same styling, icon `Package w-4 h-4 text-[#FBAD3F]`
- **"Notes & Requirements":** `font-bold text-[#236383] uppercase tracking-wide`, icon `FileText w-4 h-4`
- **Consistency:** All section headers use the same pattern

#### Time Information
- **Time Labels (Start/End/Pickup):** `text-gray-700 text-sm uppercase font-semibold`
- **Time Values:** `text-lg font-bold text-gray-900`
- **Key Difference:** Uses gray-900 for time values (neutral, not brand colors)

#### Staffing Section
- **Header (e.g., "Drivers (1/2)"):** `text-base font-bold text-gray-900`, icon `Car w-5 h-5`
- **Assignment Names:** `text-base` on colored background rows
- **"None assigned" Text:** `text-base text-gray-600 italic`
- **"No X needed" Text:** `text-base text-gray-600 italic`

#### Contact Information
- **Contact Name:** `font-semibold` (inherits `text-sm` from parent)
- **Email/Phone:** Inherits `text-sm`, links with `hover:underline`
- **TSP Contact Label:** `font-semibold` "TSP: {name}"

#### Notes Section
- **Note Type Headers:** `text-sm font-medium text-gray-900`
- **Note Content:** `text-sm text-gray-700 bg-white whitespace-pre-wrap`

#### Meta/Secondary Information
- **Field Labels (Recipients, Overnight Holding):** `text-gray-600 text-xs uppercase font-medium`
- **Recipient Badge Text:** Inherits from Badge component

### Badges Analysis

#### Interactive Badges (Gradient Backgrounds)
1. **Confirmation Status Badge** (Line 318-327)
   - **Behavior:** Click to toggle via `quickToggleBoolean('isConfirmed', !request.isConfirmed)`
   - **Styling:** `cursor-pointer hover:opacity-80 font-medium`
   - **Date Confirmed:** `bg-gradient-to-br from-[#007E8C] to-[#47B3CB] text-white border border-[#007E8C]`
   - **Date Pending:** `bg-gradient-to-br from-gray-500 to-gray-600 text-white border border-gray-500`
   - **Interactive:** ✅ Yes
   - **Key Difference:** Uses gradient instead of solid color

2. **Official Sheet Badge** (Line 329-338)
   - **Behavior:** Click to toggle via `quickToggleBoolean('addedToOfficialSheet', !request.addedToOfficialSheet)`
   - **Styling:** `cursor-pointer hover:opacity-80 font-medium`
   - **On Sheet:** `bg-gradient-to-br from-[#236383] to-[#007E8C] text-white border border-[#236383]`
   - **Not on Sheet:** `bg-gradient-to-br from-gray-500 to-gray-600 text-white border border-gray-500`
   - **Interactive:** ✅ Yes
   - **Key Feature:** Unique to ScheduledCardEnhanced

#### Display-Only Badges (All with Gradients)
3. **Sandwich Count Badge** (Line 341-344)
   - **Styling:** `bg-gradient-to-br from-[#FBAD3F] to-[#FF8C00] text-white border border-[#FBAD3F] font-medium`
   - **Icon:** `Package w-3 h-3 mr-1`
   - **Interactive:** ❌ No

4. **Manual Entry Badge** (Line 346-350)
   - **Styling:** `bg-gradient-to-br from-[#FBAD3F] to-[#FF8C00] text-white border border-[#FBAD3F] font-medium`
   - **Icon:** `FileText w-3 h-3 mr-1`
   - **Interactive:** ❌ No

5. **Fully Staffed Badge** (Line 353-356)
   - **Styling:** `bg-gradient-to-br from-[#47B3CB] to-[#007E8C] text-white border border-[#007E8C] font-medium`
   - **Interactive:** ❌ No

6. **Staffing Needs Badges** (Lines 359-374)
   - **Styling:** `bg-gradient-to-br from-[#FBAD3F] to-[#FF8C00] text-white border border-[#FBAD3F] font-medium`
   - **Text Examples:** "1 driver needed", "2 speakers needed"
   - **Interactive:** ❌ No

7. **Van Driver Needed Badge** (Line 377-382)
   - **Styling:** `bg-gradient-to-br from-[#236383] to-[#007E8C] text-white border border-[#236383] font-medium`
   - **Icon:** `Car w-3 h-3 mr-1`
   - **Interactive:** ❌ No

8. **Missing Info Badge** (Line 384-389)
   - **Styling:** `bg-gradient-to-br from-[#A31C41] to-[#8B1538] text-white border border-[#A31C41] font-medium animate-pulse`
   - **Icon:** `AlertTriangle w-3 h-3 mr-1`
   - **Text:** "{count} Missing"
   - **Animation:** Pulse effect
   - **Interactive:** ❌ No

9. **Recipient Badges** (In Delivery Logistics section)
   - **Styling:** `bg-white/20 text-white border-white/40`
   - **Icon:** 🏠 emoji
   - **Interactive:** ❌ No

**Key Differences:**
- ALL badges use gradient backgrounds (unique to this component)
- More varied badge types (8+ different badges vs 3-5 in other components)
- Uses animation (animate-pulse) for missing info
- Semi-transparent badges for recipients

### Section Backgrounds

| Section | Background | Border | Padding | Border Radius |
|---------|-----------|--------|---------|---------------|
| **Card Container** | `bg-white` | `border-l-4 border-l-[#007E8C]` | `p-5` | Default |
| **Header Area** | None | `border-b-2 border-[#007E8C]/10` | `pb-4` | None |
| **Event Details** | `bg-[#007E8C]/5` | `border border-[#007E8C]/10` | `p-4` | `rounded-lg` |
| **Team Assignments** | `bg-[#236383]/5` | `border border-[#236383]/10` | `p-4` | `rounded-lg` |
| **Event Organizer** | `bg-[#47B3CB]/5` | `border border-[#47B3CB]/10` | `p-4` | `rounded-lg` |
| **Delivery Logistics** | `bg-[#FBAD3F]/5` | `border border-[#FBAD3F]/10` | `p-4` | `rounded-lg` |
| **Assignment Rows** | `bg-[#47B3CB]/10` | None | `px-3 py-1.5` | `rounded` |
| **Notes Section** | `bg-amber-50` | None | `p-4` | `rounded-lg` |
| **Individual Notes** | `bg-white` | Various colored `border-l-4` | `p-3` | `rounded` |

**Key Differences:**
- Uses semi-transparent backgrounds (`/5` opacity) with matching borders
- Each major section has a distinct color-coded background
- More visual separation between sections
- Assignment rows use `bg-[#47B3CB]/10` consistently

### Interactive Features

This component has the MOST interactive features:

1. **Inline Date Editing**
   - Click edit button (opacity-based reveal) or date value
   - Save/Cancel buttons with brand colors

2. **Inline Time Editing** (3 separate fields)
   - Start Time
   - End Time
   - Pickup Time (uses DateTimePicker component)
   - Each field independently editable

3. **"Add All Times" Dialog**
   - Button to set all three times at once
   - Temporary state for batch editing
   - Mutation-based save

4. **Sandwich Count Inline Editing** (Complex)
   - Three modes: Total count, By types, Range
   - Mode selector
   - Dynamic fields based on mode
   - Add/remove sandwich type rows

5. **Staffing Needs Inline Editing**
   - Click to edit drivers needed count
   - Click to edit speakers needed count
   - Click to edit volunteers needed count
   - Shows "Set Need" button when count is 0

6. **Assignment Management**
   - Add driver button → opens AssignmentDialog
   - Add speaker button → opens AssignmentDialog
   - Add volunteer button → opens AssignmentDialog
   - Remove assignment buttons (X icons)
   - **Send Kudos buttons** for each assigned person (unique feature)

7. **Recipients Inline Editing**
   - Uses MultiRecipientSelector component
   - Displays badges for assigned recipients
   - Edit button to trigger editing mode

8. **Overnight Holding Inline Editing**
   - Text input field
   - Save/Cancel buttons

9. **Notes Inline Editing**
   - Planning Notes textarea
   - Scheduling Notes textarea
   - Each with Edit button trigger
   - Save/Cancel buttons

10. **Badge Toggles** (2 interactive badges)
    - Confirmation status badge
    - Official Sheet badge
    - Both use `quickToggleBoolean` function

11. **Contact Actions**
    - Contact button
    - Assign TSP Contact button
    - Edit TSP Contact button
    - Log Contact button

12. **Other Actions**
    - Follow Up button
    - Reschedule button
    - Edit button (icon only)
    - Delete button (icon only, with ConfirmationDialog)

13. **Audit Log Toggle**
    - Same as other components

---

## Cross-Component Comparison & Inconsistencies

### Typography Inconsistencies

| Element | NewRequestCard | InProcessCard | ScheduledCardEnhanced |
|---------|----------------|---------------|----------------------|
| **Organization Name** | `text-[20px]` white on cyan pill | `text-base sm:text-lg md:text-xl lg:text-2xl` teal | `text-2xl` dark blue |
| **Department** | White on same pill | `text-sm sm:text-base md:text-lg` gray | `text-sm` dark blue/70 |
| **Date Value** | `text-[18px]` teal | `text-sm sm:text-base md:text-lg` white on blue box | `text-lg` dark blue |
| **Contact Name** | `text-[18px]` | `text-sm sm:text-base md:text-lg` | Inherits `text-sm` |
| **Section Headers** | Mixed `text-[16px]`/`text-[17px]` | `text-sm sm:text-base md:text-lg` | `text-sm uppercase` |
| **Body Text** | Mixed `text-[14px]`-`text-[18px]` | `text-sm` | `text-sm` |
| **Buttons** | `text-[15px]`-`text-[16px]` | `text-[15px]` | Inherits from size prop |

**Key Issues:**
- NewRequestCard uses fixed pixel sizes (`text-[20px]`, `text-[18px]`, etc.)
- InProcessCard uses responsive breakpoints
- ScheduledCardEnhanced uses Tailwind's scale (`text-lg`, `text-2xl`)
- No consistency in organization name styling (pill vs plain text, different sizes)
- Section header casing varies (sentence case vs uppercase)

### Badge Inconsistencies

| Badge Type | NewRequestCard | InProcessCard | ScheduledCardEnhanced |
|------------|----------------|---------------|----------------------|
| **Confirmation Status** | Solid colors | Solid colors | **Gradient** |
| **Other Status** | Solid colors with hover | Solid colors | **All gradients** |
| **Icon Size** | `w-3 h-3` | `w-3 h-3` or `w-4 h-4` | `w-3 h-3` |
| **Padding** | `px-3 py-1` | `px-2.5 py-0.5` or `px-3 py-1` | Default from Badge |
| **Missing Info** | Not present | Individual badges per item | Single count badge |

**Key Issues:**
- Only ScheduledCardEnhanced uses gradient backgrounds
- Padding varies between components
- Missing info display completely different (none vs individual vs count)
- Hover effects inconsistent

### Background Color Inconsistencies

| Section | NewRequestCard | InProcessCard | ScheduledCardEnhanced |
|---------|----------------|---------------|----------------------|
| **Left Border** | `border-l-[#007E8C]` | Conditional (red if stale, orange if normal) | `border-l-[#007E8C]` |
| **Card Padding** | `p-6` | `p-6` | `p-5` |
| **Contact Info** | `bg-gray-50` | `bg-gray-50` | `bg-[#47B3CB]/5` with border |
| **Date Display** | Inline with icon | `bg-[#236383]` prominent box | Inline with icon |
| **TSP Contact** | `bg-[#FFF4E6]` solid | Gradient `from-[#FBAD3F]/10 to-[#D68319]/10` | Part of organizer section |
| **Section Backgrounds** | All `bg-gray-50` or `bg-amber-50` | Mixed solid colors | All semi-transparent with borders |

**Key Issues:**
- NewRequestCard: Mostly gray-50 and amber-50 (minimal color coding)
- InProcessCard: More varied, includes gradients for TSP, prominent date box
- ScheduledCardEnhanced: Extensive color-coding with semi-transparent backgrounds
- No consistent approach to visual hierarchy through backgrounds

### Interactive Features Comparison

| Feature | NewRequestCard | InProcessCard | ScheduledCardEnhanced |
|---------|----------------|---------------|----------------------|
| **Inline Date Edit** | ✅ Yes | ✅ Yes (in blue box) | ✅ Yes |
| **Inline Time Edit** | ❌ No | ❌ No | ✅ Yes (3 fields) |
| **Batch Time Entry** | ❌ No | ❌ No | ✅ Yes ("Add All Times") |
| **Sandwich Edit** | ❌ No | ❌ No | ✅ Yes (complex, 3 modes) |
| **Staffing Edit** | ❌ No | ❌ No | ✅ Yes (inline counts) |
| **Assignment Dialogs** | ❌ No | ❌ No | ✅ Yes (drivers, speakers, volunteers) |
| **Recipients Edit** | ❌ No | ❌ No | ✅ Yes |
| **Notes Edit** | ❌ No | ❌ No | ✅ Yes (multiple fields) |
| **Confirmation Toggle** | ✅ Badge click | ✅ Badge click | ✅ Badge click |
| **Official Sheet Toggle** | ❌ No | ❌ No | ✅ Badge click |
| **Send Kudos** | ❌ No | ❌ No | ✅ Yes (per person) |
| **TSP Contact Edit** | ✅ Edit button | ✅ Edit button | ✅ Edit button |
| **Audit Log** | ✅ Toggle | ✅ Toggle | ✅ Toggle |
| **Edit Button** | ✅ Ghost | ✅ Ghost | ✅ Ghost |
| **Delete Button** | ✅ + Confirmation | ✅ + Confirmation | ✅ + Confirmation |

**Key Issues:**
- ScheduledCardEnhanced has significantly more inline editing features
- NewRequestCard and InProcessCard are more "view-focused"
- Inconsistent approach to editing: some use dialogs, some use inline
- No standard pattern for save/cancel controls

---

## Critical Interactive Features to Preserve

### Universal Features (All 3 Components)
1. **Confirmation Badge Toggle:** Click to toggle date confirmed status
2. **Date Inline Editing:** Edit icon appears on hover, opens inline editor with save/cancel
3. **Edit Button:** Opens edit dialog for full form
4. **Delete Button:** Opens confirmation dialog before deletion
5. **TSP Contact Edit:** Edit button when contact assigned, Assign button when not
6. **Audit Log Toggle:** Expandable section for history

### NewRequestCard-Specific
1. **Send Toolkit Button:** Prominent orange button
2. **Schedule Call Button:** Opens dialog to schedule call
3. **Log Contact Button:** Opens dialog to log contact attempt
4. **Call/Email Buttons:** Direct mailto/tel links

### InProcessCard-Specific
1. **Date in Prominent Box:** Visual emphasis on event date
2. **Missing Info Badges:** Individual badges for each missing field
3. **Stale Warning:** Red badge and border when follow-up needed
4. **Schedule Button:** Action button for scheduling
5. **Resend Toolkit Button:** Conditional display

### ScheduledCardEnhanced-Specific
1. **Inline Time Editing:** Start, End, Pickup times all inline editable
2. **"Add All Times" Batch Dialog:** Set all times at once
3. **Inline Sandwich Editing:** Complex 3-mode editor (total/types/range)
4. **Inline Staffing Counts:** Edit driver/speaker/volunteer needs inline
5. **Assignment Dialogs:** Separate dialogs for drivers, speakers, volunteers
6. **Remove Assignment Buttons:** X buttons on each assigned person
7. **Send Kudos Buttons:** Per-person kudos button for assigned staff
8. **Official Sheet Toggle:** Badge click to toggle
9. **Recipients Inline Edit:** MultiRecipientSelector component
10. **Overnight Holding Edit:** Inline text field
11. **Notes Inline Edit:** Multiple note fields with textareas
12. **Follow Up Button:** Dedicated action button
13. **Reschedule Button:** Dedicated action button
14. **Log Contact Button:** Action button

---

## Recommendations for Standardization

### Phase 1: Typography Unification
1. **Decide on sizing system:** Tailwind scale vs fixed pixels vs responsive breakpoints
2. **Standardize organization name:** Same size, weight, color across all cards
3. **Unify section headers:** Same casing (uppercase recommended), size, weight, color
4. **Normalize body text:** Consistent `text-sm` for all body content
5. **Fix contact info:** Same sizing for names, email, phone across cards

### Phase 2: Badge Standardization
1. **Choose gradient vs solid:** Apply consistently (gradients are more visually appealing)
2. **Standardize padding:** Use `px-3 py-1` for all badges
3. **Unify icon sizes:** `w-3 h-3` for all badge icons
4. **Missing info display:** Decide on individual badges vs count vs hybrid

### Phase 3: Background Colors
1. **Establish color-coding system:** Semi-transparent with borders (ScheduledCard approach) is clearest
2. **Consistent contact section:** Use same background across all cards
3. **TSP Contact styling:** Unify to one approach (gradient is distinctive)
4. **Border patterns:** Consistent use of left border for emphasis

### Phase 4: Interactive Patterns
1. **Edit triggers:** Standardize opacity-based hover reveal for all edit buttons
2. **Save/Cancel buttons:** Consistent styling and positioning
3. **Inline vs Dialog:** Document clear rules for when to use each
4. **Action button placement:** Consistent row/grid patterns

### Phase 5: Component-Specific Considerations
- **NewRequestCard:** Add missing info indicators, consider date prominence
- **InProcessCard:** Evaluate if prominent date box should apply to all
- **ScheduledCardEnhanced:** Consider which inline editing features should propagate

---

## Notes on Visual Hierarchy

### Current Hierarchy Strengths
- **NewRequestCard:** Clean, simple, good for quick scanning
- **InProcessCard:** Excellent date prominence, good color warnings
- **ScheduledCardEnhanced:** Best information density, clear section divisions

### Current Hierarchy Weaknesses
- **NewRequestCard:** Organization name in pill badge feels cramped
- **InProcessCard:** TSP Contact gradient might be too prominent
- **ScheduledCardEnhanced:** Badge overload in header (8+ badges possible)

### Suggested Hierarchy Pattern
1. **Card Border:** Status indicator (color-coded left border)
2. **Organization/Department:** Primary heading, consistent sizing
3. **Status Badges Row:** 2-3 key status badges maximum
4. **Critical Info (Date):** Either inline or in subtle colored section
5. **Content Sections:** Color-coded transparent backgrounds
6. **Actions:** Consistent button row at bottom or logical grouping

---

**End of Audit Report**
