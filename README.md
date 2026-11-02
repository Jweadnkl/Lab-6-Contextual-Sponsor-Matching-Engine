# Deterministic Sponsor Selector & Matching Engine

A lightweight, transparent, and deterministic sponsor selection module built for local community placements. This project enforces strict geographic and temporal rules without relying on hidden user profiling or probabilistic tracking.

## Predictable Properties

1. **Idempotency (Purity):** 
   Given an identical context (ZIP code, current date, and placement type) paired with a fixed candidate pool, the `selectSponsor()` function evaluates input purely and returns the exact same sponsor ID every single time.

2. **Explicitness:** 
   Selection rules rely entirely on visible criteria—specifically active campaign status, approval flags, geographic ZIP code matching, and date range validity. It completely excludes hidden user profiling, behavior tracking, or machine learning inference.

3. **Stable Rotation & Tie-Breaking:** 
   When multiple candidate sponsors possess identical priority levels and geographic parameters, the selector avoids random jitter by enforcing a strict string-based tie-breaker on candidate IDs using `a.id.localeCompare(b.id)`.

---

## Sponsor Eligibility & Selection Engine Audit

### 1. SQL / Database Query Definition
```sql
SELECT id, title, destination_url, priority, target_zips
FROM sponsors
WHERE status = 'APPROVED'                                  -- Administrative status enforcement
  AND active = TRUE                                        -- Active state filter
  AND placement = $1                                       -- Target UI placement slot
  AND CURRENT_DATE BETWEEN start_date AND end_date         -- Temporal validity window
  AND $2 = ANY(target_zips)                                -- Spatial / ZIP code scoping match
ORDER BY priority DESC, id ASC;                            -- Deterministic tie-breaking sort
