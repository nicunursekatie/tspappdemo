# Canonical Field Contracts (Epic 1)

This document establishes **canonical field names and types** for the system and
identifies which legacy aliases should be deprecated. It is the source of truth
for aligning the database schema, API payloads, and client models.

> Scope: Initial focus on the known mismatches surfaced in the AI inconsistency
> report (schema/type mismatches, frontend/backend name drift, and attachment
> shape inconsistencies).

---

## 1. Canonical Field Decisions

### 1.1 Messaging / Read Status
| Domain | Canonical Field | Legacy / Alias | Notes |
|--------|-----------------|----------------|-------|
| Email-style messages | `isRead` (boolean) | `read` | Normalize on `isRead` for new code. Legacy fields remain for migration. |
| Simple chat messages | `read` (boolean) | `isRead` | Existing `messages.read` stays, but all new UI/service code should map to `isRead` at boundaries to avoid conflict. |

**Decision:** Use **`isRead`** as the canonical naming convention in APIs/clients.
The schema keeps `messages.read` for the chat table for now, but adapters should
map to `isRead` in DTOs until schema migration is complete.

---

### 1.2 Speaking / Volunteer Capability
| Domain | Canonical Field | Legacy / Alias | Notes |
|--------|-----------------|----------------|-------|
| Volunteers | `isSpeaker` (boolean) | `willingToSpeak` | Align on `isSpeaker` in DTOs and UI. |

**Decision:** **`isSpeaker`** is the canonical name. `willingToSpeak` remains
legacy in `drivers` until the migration plan is executed.

---

### 1.3 Focus Areas
| Domain | Canonical Field | Legacy / Alias | Notes |
|--------|-----------------|----------------|-------|
| Recipients | `focusAreas` (string[]) | `focusArea` (string) | Canonical is array in JSONB. |

**Decision:** **`focusAreas`** is canonical. `focusArea` is legacy single-value
and should be deprecated once migration is done.

---

### 1.4 Event Requests
| Domain | Canonical Field | Legacy / Alias | Notes |
|--------|-----------------|----------------|-------|
| Event request date | `desiredEventDate` (timestamp) | `eventDate` | Align on server naming for clarity. |
| Sandwich estimate | `estimatedSandwichCount` (integer) | `totalSandwichCount` | Use canonical estimate fields. |

**Decision:** **`desiredEventDate`** and **`estimatedSandwichCount`** are canonical.
Clients should only send these fields going forward.

---

### 1.5 Attachments
| Domain | Canonical Field | Current Variants | Notes |
|--------|-----------------|------------------|-------|
| Messages / email | `attachments` (JSON array of objects) | `text()`, `text().array()` | Canonical type is JSON array of objects: `{ name, url, type, size }`. |

**Decision:** Canonical format is **JSON array of attachment objects** (stringified
JSON in text columns until schema migration is completed).

---

## 2. Migration Plan (High-Level)

1. **Shared Types & Validation**
   - Update `shared/types.ts` to surface canonical DTOs.
   - Align Zod schemas in `shared/validation-schemas.ts` to canonical fields.

2. **Server DTO Mapping Layer**
   - Add adapters that map legacy names to canonical names (temporary).
   - Remove adapters once DB migrations complete and clients are updated.

3. **Schema Migration**
   - Rename DB columns where appropriate (or drop deprecated columns once data
     is migrated).
   - Normalize attachments storage as JSONB where possible.

4. **Client Updates**
   - Update API clients and components to use canonical names exclusively.

---

## 3. Deprecation Tracking

| Legacy Field | Canonical Replacement | Target Removal | Notes |
|-------------|-----------------------|----------------|-------|
| `focusArea` | `focusAreas` | After migration | Requires data backfill. |
| `willingToSpeak` | `isSpeaker` | After migration | Backfill from `willingToSpeak` to `isSpeaker`. |
| `read` (email DTO) | `isRead` | After migration | Map for chat/email separately. |
| `eventDate` | `desiredEventDate` | After migration | Update event request forms. |
| `totalSandwichCount` | `estimatedSandwichCount` | After migration | Update frontend requests. |

---

## 4. Rollout Guidance

- **Phase 1 (Now):** Introduce canonical docs + DTO mapping (non-breaking).
- **Phase 2:** Apply DB migrations and update shared schema/types.
- **Phase 3:** Remove deprecated aliases and mapping.

---

## 5. Owners / Next Steps

- **Owner:** Platform Engineering
- **Next action:** Apply updates to shared schema/types and add DTO mapping
  layer for legacy compatibility.
