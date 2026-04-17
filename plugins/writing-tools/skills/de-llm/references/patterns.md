# Pattern Catalog

## 1. Puffery Verbs

**Detection:** `stands as`, `serves as`, `is a testament to`, `underscores`, `marks a pivotal moment`, `reflects broader`, `exemplifies`.

**Action:** Rewrite plainly. Keep the underlying fact; strip the editorial verb.

| Before | After |
|--------|-------|
| "Redis stands as the de facto choice for distributed caching." | "Redis is widely used for distributed caching." (if sourced) or delete (if not) |
| "This function serves as the entry point for request handling." | "This function is the entry point for request handling." |
| "The migration underscores the team's commitment to type safety." | "The migration adds type annotations to all public APIs." |

---

## 2. Participle Bloat

**Detection:** Trailing `-ing` clauses asserting impact: `further enhancing X`, `contributing to Y`, `creating a robust Z`, `ensuring W`.

**Action:** Rewrite plainly. Convert the participle to a direct statement if it contains a real claim; delete if pure filler.

| Before | After |
|--------|-------|
| "The retry logic uses exponential backoff, further enhancing reliability." | "The retry logic uses exponential backoff." |
| "The cache layer stores serialized responses, contributing to lower latency." | "The cache layer stores serialized responses. Median latency drops from 180ms to 40ms." (if measured) |
| "We rewrote the parser in Rust, creating a robust foundation for future work." | "We rewrote the parser in Rust." |

---

## 3. "Not Just X, But Y" Contrastive Framing

**Detection:** "not just", "not only", "more than just" paired with "but also", "but", or a contrastive clause.

**Action:** Drop the defensive contrast; keep the substantive half as a direct claim.

| Before | After |
|--------|-------|
| "The CLI is not just a wrapper, but a full orchestration layer." | "The CLI is an orchestration layer." |
| "This isn't only a refactor — it's a rethink of the module boundaries." | "This change redraws the module boundaries." |

---

## 4. Promotional Adjectives

**Detection:** `robust`, `seamless`, `powerful`, `comprehensive`, `elegant`, `cutting-edge`, `rich`, `vibrant`, `flexible`, `intuitive`.

**Action:** Delete the adjective; keep the noun. If the sentence collapses without the adjective, delete the sentence.

| Before | After |
|--------|-------|
| "A robust authentication layer." | "An authentication layer." |
| "Seamless integration with GitHub Actions." | "Integrates with GitHub Actions." |
| "Built on a powerful, flexible plugin architecture." | "Built on a plugin architecture." |
| "Provides comprehensive error handling." | (delete — no concrete claim remains) |

---

## 5. Self-Referential Narration

**Detection:** `this section explores`, `it's worth noting`, `it's important to understand`, `as we'll see`, `in this guide`, `the following describes`.

**Action:** Delete the meta sentence. Keep the content that follows.

| Before | After |
|--------|-------|
| "It's worth noting that the config file must exist before startup." | "The config file must exist before startup." |
| "This section explores how the scheduler dispatches jobs." | (delete; the section heading already conveys this) |
| "As we'll see, the retry loop has three exit conditions." | "The retry loop has three exit conditions." |

---

## 6. Vague Authority

**Detection:** `experts agree`, `researchers argue`, `widely considered`, `many believe`, `industry standard`, `commonly regarded`.

**Action:**
- **Unsourced:** delete the claim.
- **Sourced (citation present — URL or source code reference):** rewrite with concrete attribution.

| Before | After |
|--------|-------|
| "Experts agree that Postgres is the best choice for relational workloads." | (delete — no source) |
| "Widely considered the standard approach ([RFC 7519](https://tools.ietf.org/html/rfc7519))." | "Defined in [RFC 7519](https://tools.ietf.org/html/rfc7519)." |
| "Most teams use feature flags." | (delete — no source) |

---

## 7. Over-Hedging on Verifiable Facts

**Detection:** `generally`, `typically`, `in most cases`, `usually`, `tends to` applied to claims that are exactly true or falsifiable.

**Action:** Strip the hedge; keep the direct fact.

| Before | After |
|--------|-------|
| "The daemon typically listens on port 8080." | "The daemon listens on port 8080." (if true by default) |
| "Tests generally run in under five seconds." | "Tests run in under five seconds." (if the suite enforces this) |
| "The API usually returns 200 on success." | "The API returns 200 on success." |

Hedging is appropriate when the claim is genuinely probabilistic ("typically 10-20ms under normal load"). Don't strip those.

---

## 8. Premature Evaluative Framing

**Detection:** Sentences leading with "X is an important/powerful/useful/critical tool/framework/library that...".

**Action:** Delete the framing clause. Lead with what X actually does.

| Before | After |
|--------|-------|
| "Redis is a powerful in-memory data store that supports pub/sub, streams, and sorted sets." | "Redis is an in-memory data store. It supports pub/sub, streams, and sorted sets." |
| "Prettier is a useful code formatter that enforces consistent style." | "Prettier formats code to a consistent style." |
| "This is a critical utility that handles request retries." | "This utility handles request retries." |
