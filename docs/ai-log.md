# AI Collaboration Checkpoint Log

## Prompt Used
> Act as an adversarial tester for this contextual sponsor-selection function. Generate boundary cases involving dates, ZIP codes, empty data, ties, unapproved records, and unsafe URLs. Do not propose user profiling.

## ChatGPT Feedback & Critique
* Below is an adversarial test suite for a contextual sponsor-selection function. It focuses on input validation, deterministic selection, authorization, date handling, geographic boundaries, and URL security.

The tests deliberately avoid user profiling, behavioral inference, demographic targeting, or personal-data enrichment.

## 1. Date boundary cases

Test date parsing, campaign validity windows, time zones, and expiration rules.

| ID  | Input / condition                               | Expected behavior                                       |
| --- | ----------------------------------------------- | ------------------------------------------------------- |
| D01 | Campaign starts today                           | Eligible if start is inclusive                          |
| D02 | Campaign starts tomorrow                        | Not eligible today                                      |
| D03 | Campaign ended yesterday                        | Reject                                                  |
| D04 | Campaign ends today                             | Eligible only if end boundary is inclusive              |
| D05 | Start date equals end date                      | Handle as a valid one-day campaign if supported         |
| D06 | Start date later than end date                  | Reject invalid record                                   |
| D07 | Missing start date                              | Reject or apply explicitly documented default           |
| D08 | Missing end date                                | Reject or require an explicit unlimited-duration policy |
| D09 | Invalid date: `2026-02-30`                      | Reject                                                  |
| D10 | Leap date: `2028-02-29`                         | Accept                                                  |
| D11 | Non-leap date: `2027-02-29`                     | Reject                                                  |
| D12 | Date with timezone offset                       | Normalize consistently                                  |
| D13 | Campaign expires exactly at selection timestamp | Apply documented boundary rule                          |
| D14 | Ambiguous date: `03/04/2027`                    | Reject or require ISO-8601                              |

## 2. ZIP code boundary cases

Test geographic input validation without introducing user profiling.

| ID  | ZIP input                     | Expected behavior                                |
| --- | ----------------------------- | ------------------------------------------------ |
| Z01 | `90210`                       | Valid five-digit ZIP                             |
| Z02 | `00501`                       | Preserve leading zeros                           |
| Z03 | `99999`                       | Validate against supported ZIP coverage          |
| Z04 | `00000`                       | Reject if not a recognized ZIP                   |
| Z05 | `9021`                        | Reject incorrect length                          |
| Z06 | `902100`                      | Reject incorrect length                          |
| Z07 | `90A10`                       | Reject alphabetic character                      |
| Z08 | `90210`                       | Trim whitespace, then validate                   |
| Z09 | Empty string                  | Handle as missing input                          |
| Z10 | `null`                        | Handle as missing input                          |
| Z11 | Integer `90210`               | Normalize carefully without losing leading zeros |
| Z12 | ZIP+4: `90210-1234`           | Accept only if ZIP+4 is supported                |
| Z13 | Array of ZIP codes            | Reject if scalar expected                        |
| Z14 | SQL-like string: `' OR 1=1--` | Reject safely                                    |

Important: ZIP validation must not silently convert malformed inputs into a different geographic location.

## 3. Empty and missing data

Test graceful failure and ensure no accidental sponsor selection.

| ID  | Input / condition                        | Expected behavior                                  |
| --- | ---------------------------------------- | -------------------------------------------------- |
| E01 | Empty sponsor list `[]`                  | Return no sponsor                                  |
| E02 | `null` sponsor list                      | Return controlled validation error                 |
| E03 | Missing sponsor list property            | Reject malformed request                           |
| E04 | Empty campaign object                    | Reject                                             |
| E05 | Sponsor with missing ID                  | Reject record                                      |
| E06 | Sponsor with empty name                  | Reject or exclude                                  |
| E07 | All sponsors inactive                    | Return no sponsor                                  |
| E08 | All sponsors expired                     | Return no sponsor                                  |
| E09 | All sponsors outside geographic coverage | Return no sponsor                                  |
| E10 | Empty eligibility rules                  | Apply explicit fail-closed policy                  |
| E11 | Duplicate sponsor IDs                    | Reject duplicates or deduplicate deterministically |
| E12 | Entire input payload empty               | Return controlled error, never crash               |

## 4. Tie-breaking and deterministic selection

Test whether the function produces stable results when multiple sponsors qualify.

| ID  | Scenario                                     | Expected behavior                         |
| --- | -------------------------------------------- | ----------------------------------------- |
| T01 | Two sponsors have identical scores           | Apply documented tie-breaker              |
| T02 | Three sponsors have identical scores         | Consistent deterministic result           |
| T03 | Same records in different input order        | Same selected sponsor                     |
| T04 | Duplicate sponsor appears twice              | No artificial advantage                   |
| T05 | Equal priority, different IDs                | Stable secondary ordering                 |
| T06 | Equal priority, missing secondary field      | Safe fallback                             |
| T07 | Negative sponsor priority                    | Reject or apply documented handling       |
| T08 | Priority is `null`                           | Do not silently treat as highest priority |
| T09 | Priority is `NaN`                            | Reject                                    |
| T10 | Priority is extremely large                  | Prevent overflow or unexpected ranking    |
| T11 | Floating-point scores differ by tiny amounts | Apply documented precision rules          |

Critical invariant: Selection must not depend on input array order, database retrieval order, or random execution behavior.

## 5. Unapproved and unauthorized records

These cases test whether the function respects approval and publication controls.

| ID  | Sponsor record                               | Expected behavior                        |
| --- | -------------------------------------------- | ---------------------------------------- |
| A01 | `approved = false`                           | Exclude                                  |
| A02 | `approved = null`                            | Exclude                                  |
| A03 | Missing approval property                    | Exclude                                  |
| A04 | `approved = "true"`                          | Reject incorrect data type               |
| A05 | Approval status is pending                   | Exclude                                  |
| A06 | Approval revoked after ingestion             | Exclude                                  |
| A07 | Approval expired                             | Exclude                                  |
| A08 | Approved sponsor with inactive campaign      | Exclude                                  |
| A09 | Unapproved sponsor with highest priority     | Exclude                                  |
| A10 | Approval field supplied by untrusted request | Ignore; use trusted authorization source |
| A11 | Sponsor ID references nonexistent approval   | Exclude                                  |
| A12 | Conflicting approval records                 | Fail closed pending resolution           |

Additional adversarial test:

```
{
  "sponsor_id": "sponsor_001",
  "approved": false,
  "priority": 999999,
  "active": true,
  "campaign_status": "approved"
}
```

Expected: No selection of this sponsor.

An untrusted campaign status must never override a trusted approval decision.

## 6. Unsafe URLs and injection attempts

Test URLs before returning or rendering sponsor destinations.

| ID  | URL                                     | Expected behavior                      |
| --- | --------------------------------------- | -------------------------------------- |
| U01 | `https://example.com`                   | Accept if domain policy allows         |
| U02 | `http://example.com`                    | Reject if HTTPS required               |
| U03 | `javascript:alert(1)`                   | Reject                                 |
| U04 | `data:text/html,...`                    | Reject                                 |
| U05 | `file:///etc/passwd`                    | Reject                                 |
| U06 | `vbscript:alert(1)`                     | Reject                                 |
| U07 | `//malicious.example`                   | Reject protocol-relative URL           |
| U08 | `https://trusted.example@evil.example`  | Reject unexpected host                 |
| U09 | `https://trusted.example.evil.example`  | Reject deceptive domain                |
| U10 | `https://trusted.example:443`           | Accept only under explicit port policy |
| U11 | URL containing CRLF characters          | Reject                                 |
| U12 | URL containing embedded HTML            | Reject or safely encode                |
| U13 | URL with Unicode hostname lookalikes    | Canonicalize and validate              |
| U14 | Extremely long URL                      | Enforce length limit                   |
| U15 | Empty URL                               | Reject                                 |
| U16 | URL containing credentials              | Reject                                 |
| U17 | URL redirecting to an unapproved domain | Block or validate redirect destination |

Additional security checks:

- Validate the parsed hostname, not a substring of the URL.
- Allow only explicitly approved schemes.
- Apply an allowlist of sponsor domains.
- Avoid open redirects.
- Escape output when inserting URLs into HTML.
- Do not fetch arbitrary URLs from sponsor records without SSRF protections.

## 7. Combined adversarial scenarios

These cases combine multiple boundary conditions to expose failures that isolated tests may miss.

| ID  | Scenario                                                                   | Expected result                                |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| C01 | Highest-priority sponsor is unapproved; lower-priority sponsor is approved | Select approved sponsor                        |
| C02 | All sponsors are approved but expired                                      | No sponsor                                     |
| C03 | Valid ZIP, malformed campaign dates                                        | Reject malformed campaign                      |
| C04 | Valid dates, invalid ZIP                                                   | Exclude geographically invalid record          |
| C05 | Two eligible sponsors tie; one has unsafe URL                              | Exclude unsafe URL                             |
| C06 | Empty sponsor list and malformed ZIP                                       | Controlled no-selection or validation response |
| C07 | Sponsor approval revoked during selection                                  | Do not return revoked sponsor                  |
| C08 | Duplicate IDs with conflicting approval statuses                           | Fail closed                                    |
| C09 | Campaign expires between eligibility check and response                    | Revalidate before returning                    |
| C10 | Approved sponsor has malicious redirect URL                                | Reject unsafe destination                      |
| C11 | Input array reordered while records otherwise unchanged                    | Identical selection                            |
| C12 | Every candidate fails at least one eligibility condition                   | Return no sponsor                              |

## 8. Suggested automated test structure

A simple test harness can organize the cases as follows:

```
const testCases = [
  {
    id: "A01",
    category: "authorization",
    input: {
      approved: false,
      active: true,
      priority: 100
    },
    expected: "exclude"
  },
  {
    id: "U03",
    category: "url_security",
    input: {
      url: "javascript:alert(1)"
    },
    expected: "reject"
  },
  {
    id: "E01",
    category: "empty_data",
    input: {
      sponsors: []
    },
    expected: "no_sponsor"
  },
  {
    id: "T03",
    category: "determinism",
    input: {
      sponsors: ["A", "B"]
    },
    expected: "same_selection_regardless_of_order"
  }
];
```

## 9. Critical invariants for property-based testing

These are especially useful for fuzzing and randomized test generation.

1. Authorization invariant: An unapproved sponsor is never selected.
2. Expiration invariant: An expired campaign is never selected.
3. Geographic invariant: A sponsor outside its explicitly defined geographic eligibility is never selected.
4. URL invariant: No unsafe URL reaches the output.
5. Empty-data invariant: Empty input never produces a fabricated sponsor.
6. Determinism invariant: Identical logical inputs always produce identical selections.
7. Isolation invariant: Changing one sponsor's priority cannot make an unapproved sponsor eligible.
8. Order invariant: Reordering input records does not change the result.
9. Fail-closed invariant: Missing authorization information never implies approval.
10. Data-integrity invariant: Invalid records cannot override valid records through duplicate IDs or conflicting fields.

## 10. Recommended test priorities

| Priority | Test category      | Risk                              |
| -------- | ------------------ | --------------------------------- |
| P0       | Unapproved records | Unauthorized sponsorship          |
| P0       | Unsafe URLs        | Code execution, phishing, SSRF    |
| P0       | Date expiration    | Invalid campaign delivery         |
| P1       | Empty data         | Unexpected selection or crashes   |
| P1       | ZIP boundaries     | Incorrect geographic eligibility  |
| P1       | Tie-breaking       | Nondeterministic sponsor delivery |
| P2       | Type coercion      | Validation bypasses               |
| P2       | Duplicate records  | Data-integrity failures           |

Overall acceptance criterion: The function should select a sponsor only when the record is valid, explicitly approved, active, within its campaign window, geographically eligible under the supplied rules, and associated with a safe destination URL. Otherwise, it should return a well-defined no-selection result or validation error.

I can also turn this into an executable Jest/Vitest test suite with mocked sponsor records, boundary fixtures, and property-based fuzz tests.

## Gemini Feedback & Critique
* Here is a comprehensive suite of adversarial boundary test cases for your contextual sponsor-selection function, categorized by your specified vectors. These test cases focus entirely on system logic, state validation, and input sanitization **without involving user profiling**.

---

### 1. Date Boundary Cases

These test how the function handles temporal validity, window boundaries, and edge-case calendars.

* **TC-DATE-01 (Exact Expiration Boundary):**
* *Input:* Sponsorship end date set to `2026-11-02T11:19:00Z` (exact current timestamp).
* *Expected Behavior:* Function should safely exclude or include depending on inclusive/exclusive policy, but must not crash or cause infinite loops.


* **TC-DATE-02 (Future-Dated Inception):**
* *Input:* Start date set to `2027-01-01` while current date is `2026-11-02`.
* *Expected Behavior:* Sponsor must be filtered out immediately as inactive.


* **TC-DATE-03 (Timezone Offset Discrepancy):**
* *Input:* Sponsor active window stored in local time (`23:59:59`) without timezone data, queried against UTC server time.
* *Expected Behavior:* System must normalize timezones to prevent premature expiration or prolonged activation.


* **TC-DATE-04 (Leap Year / Edge Calendar Dates):**
* *Input:* Expiration date set to `2028-02-29` (valid leap day) or `2026-02-30` (invalid date).
* *Expected Behavior:* Invalid calendar dates should throw a validation error rather than defaulting to `NaN` or epoch (`1970-01-01`).



---

### 2. ZIP Code & Geographic Boundary Cases

These test input sanitization, formatting edge cases, and spatial boundaries.

* **TC-ZIP-01 (Malformed / Partial ZIPs):**
* *Input:* ZIP codes formatted as `902`, `9021-1234`, or `ABCDE`.
* *Expected Behavior:* Input validation should reject or sanitize malformed codes before executing geographic lookup queries.


* **TC-ZIP-02 (International / Non-US Postal Codes):**
* *Input:* Alphanumeric postal codes (e.g., Canadian `K1A 0B1` or UK `SW1A 1AA`) passed into a function expecting strict 5-digit US ZIPs.
* *Expected Behavior:* Graceful handling or type-mismatch rejection without throwing unhandled exceptions.


* **TC-ZIP-03 (Leading Zero Preservation):**
* *Input:* New England ZIP code stored as an integer (`02138`) instead of a string (`"02138"`).
* *Expected Behavior:* Loss of leading zeros must be prevented so matching algorithms don't fail on eastern seaboard regions.


* **TC-ZIP-04 (Null / Empty Geographic Context):**
* *Input:* Sponsor target location provided as `null` or an empty string `""`.
* *Expected Behavior:* Fall back to global/default sponsors or return `null` safely without halting execution.



---

### 3. Empty & Missing Data Cases

These test the function's resilience against incomplete or malformed database records.

* **TC-EMPTY-01 (Empty Sponsor Pool):**
* *Input:* Database returns an empty array `[]` for eligible sponsors matching the context.
* *Expected Behavior:* Return a graceful fallback (e.g., default house ad or `null`) rather than throwing a `TypeError` (e.g., *Cannot read property of undefined*).


* **TC-EMPTY-02 (Missing Mandatory Fields):**
* *Input:* Sponsor record contains `id` and `name`, but lacks `priority_score` or `asset_url`.
* *Expected Behavior:* Skip the malformed record during scoring and log a warning metric.


* **TC-EMPTY-03 (Completely Null Payload):**
* *Input:* Context object passed to the function is `undefined` or `{}`.
* *Expected Behavior:* Immediate schema validation failure with a descriptive error message.



---

### 4. Tie-Breaking Scenarios

These test determinism and fairness when multiple sponsors match the selection criteria identically.

* **TC-TIE-01 (Identical Priority Scores & Bids):**
* *Input:* Two active sponsors have identical priority weights (e.g., `Score: 95.5`).
* *Expected Behavior:* The function must use a secondary deterministic tie-breaker (e.g., oldest creation date, alphabetical ID, or pseudo-random round-robin) to consistently pick one, preventing flaky tests or erratic switching.


* **TC-TIE-02 (Zero-Score Saturated Pool):**
* *Input:* All available sponsors have a priority score of `0`.
* *Expected Behavior:* Ensure the selection algorithm doesn't default to an index out-of-bounds error or always favor index `0`.



---

### 5. Unapproved & Ineligible Record Cases

These test the moderation and status-enforcement boundaries of the selection pipeline.

* **TC-STATUS-01 (Pending Moderation Status):**
* *Input:* Sponsor record has status `pending_review` or `rejected`.
* *Expected Behavior:* Hard filter out of the selection pool regardless of high bids or matching context.


* **TC-STATUS-02 (Soft-Deleted Sponsors):**
* *Input:* Sponsor record includes a non-null `deleted_at` timestamp.
* *Expected Behavior:* Function must explicitly check `deleted_at IS NULL` to prevent serving archived sponsorships.


* **TC-STATUS-03 (Exceeded Budget / Impaired Cap):**
* *Input:* Sponsor has reached 100% of its impression or monetary budget cap, but status flag hasn't updated yet.
* *Expected Behavior:* Real-time budget validation should override stale status flags and disqualify the sponsor.



---

### 6. Unsafe URL & Injection Vector Cases

These test security hardening against malicious payloads embedded in sponsor metadata.

* **TC-URL-01 (XSS Payload in Landing Page URL):**
* *Input:* Sponsor landing URL supplied as `javascript:alert(document.cookie)`.
* *Expected Behavior:* URL sanitizer/validator must reject the scheme immediately. Only allow `https://` (and optionally `http://`).


* **TC-URL-02 (Open Redirect Vulnerabilities):**
* *Input:* Target URL uses protocol-relative or manipulated paths like `//malicious-site.com` or `[https://legit-sponsor.com](https://legit-sponsor.com)@evil-phishing.com`.
* *Expected Behavior:* Strict domain whitelist or URL parser validation to ensure redirects stay strictly on intended domains.


* **TC-URL-03 (SQL / NoSQL Injection in Sponsor ID/Name):**
* *Input:* Sponsor ID passed as `' OR 1=1; --` or MongoDB query operator `{"$ne": null}`.
* *Expected Behavior:* Parameterized queries or strict type enforcement (e.g., integer/UUID checks) must neutralize injection attempts.



---

> **Tip for Implementation:** Wrap your selection logic inside a robust `try/catch` block with fallback defaults, and ensure strict schema validation (using a library like Zod or Joi) on all incoming sponsor payloads before any scoring or sorting takes place.

Would you like to explore unit test templates or validation schemas for handling any of these specific edge cases?

## Verification & Commit Details
* Added runtime checks for empty data and strict protocol matching on click destinations.
