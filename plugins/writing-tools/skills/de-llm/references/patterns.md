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

**Detection:** `not just`, `not only`, `more than just` paired with `but also`, `but`, an em-dash, or a comma splice. Includes the verbed variants `they don't just X, they Y`, `we don't just X, we Y`, `it doesn't just X, it Y`.

**Action:** Drop the defensive contrast. Assert Y directly. Denying X first adds no information when Y is well-supported.

| Before | After |
|--------|-------|
| "The CLI is not just a wrapper, but a full orchestration layer." | "The CLI is an orchestration layer." |
| "This isn't only a refactor — it's a rethink of the module boundaries." | "This change redraws the module boundaries." |
| "It's not a config file, it's a contract between services." | "The file is a contract between services." |
| "This isn't a workaround, it's the supported path." | "This is the supported path." |
| "They don't just write tests, they design for testability." | "They design for testability." |
| "We don't just ship features, we ship migrations alongside them." | "Every feature ships with its migration." |
| "The compiler doesn't just check types, it rewrites the AST." | "The compiler rewrites the AST during type-checking." |

---

## 4. Evaluative Descriptors

**Detection:**
- **Word-level:** `robust`, `seamless`, `powerful`, `comprehensive`, `elegant`, `cutting-edge`, `rich`, `vibrant`, `flexible`, `intuitive` applied to a noun.
- **Clause-level:** "X is an important/powerful/useful/critical tool/framework/library that..."

**Action:**
- **Word-level:** Delete the adjective; keep the noun. If the sentence collapses, delete it.
- **Clause-level:** Delete the framing clause. Lead with what X does.

| Before | After |
|--------|-------|
| "A robust authentication layer." | "An authentication layer." |
| "Seamless integration with GitHub Actions." | "Integrates with GitHub Actions." |
| "Built on a powerful, flexible plugin architecture." | "Built on a plugin architecture." |
| "Provides comprehensive error handling." | (delete — no concrete claim remains) |
| "Redis is a powerful in-memory data store that supports pub/sub, streams, and sorted sets." | "Redis is an in-memory data store. It supports pub/sub, streams, and sorted sets." |
| "Prettier is a useful code formatter that enforces consistent style." | "Prettier formats code to a consistent style." |
| "This is a critical utility that handles request retries." | "This utility handles request retries." |

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

## 8. Conclusion Signposts

**Detection:** `bottom line`, `TL;DR`, `the takeaway`, `the upshot`, `long story short`, `in short`, `to sum up`, `at the end of the day`, `the punchline`, `net-net`.

**Action:** Delete the signpost. A supported conclusion needs no announcement. If the surrounding prose does not back the conclusion, delete the conclusion as well — the signpost is masking an unearned verdict.

| Before | After |
|--------|-------|
| "Bottom line: Redis is faster for this workload." | "Redis handled 12k req/s vs. Memcached's 8k on the same hardware ([benchmark](url))." |
| "TL;DR — don't use this API in new code." | "This API is deprecated as of v3.2 ([changelog](url)). New code should use `client.send()`." |
| "At the end of the day, the migration is necessary." | (delete — restate the concrete reason instead, or remove if already stated) |
| "The takeaway is that mocks drift from reality." | "Mocked tests passed for six months while production was broken (incident #482)." |

---

## 9. False-Intimacy Markers

**Detection:** `honestly`, `the honest truth`, `to be honest`, `frankly`, `truth be told`, `if I'm being real`, `let me be real`, `the reality is`, `look,` (as a sentence opener), `I'll level with you`.

**Action:** Delete. These imply prior statements were not honest and add no information. Evidence carries sincerity. Adverbs do not.

| Before | After |
|--------|-------|
| "Honestly, the codebase needs a rewrite." | "The codebase needs a rewrite. [Specific reasons follow.]" |
| "The honest truth is that this approach won't scale." | "This approach plateaus at ~10k req/s ([load test](url))." |
| "Frankly, I'd avoid this library." | "Avoid this library — it has unpatched CVE-2024-XXXX ([advisory](url))." |
| "Look, the test suite is broken." | "The test suite is broken: 14 failures on `main` as of HEAD." |

---

## 10. Mini-Conclusion Headers

**Detection:** Bolded inline phrases or sub-headings that introduce a bulleted or listed conclusion: `**The result:**`, `**What this means:**`, `**The upshot:**`, `**The takeaway:**`, `**In practice:**`, `**Net effect:**`, `**Why this matters:**`.

**Action:** Delete the header. Convert the bullets to prose when they describe consequence or narrative. Keep them as bullets only when they enumerate parallel items.

| Before | After |
|--------|-------|
| `**The result:**`<br>`- 40% lower latency`<br>`- Half the memory footprint` | "Latency drops 40%. Memory footprint halves." |
| `**What this means:**`<br>`- Migrations are safer`<br>`- Rollbacks are reversible` | "Migrations become reversible: every change has a corresponding rollback step." |
| `**Why this matters:** the cache is now write-through.` | "The cache is now write-through, so reads after writes return current data." |

Bullets fit parallel items (files, flags, steps). They misfire when they encode a single narrative consequence.

---

## 11. Bold-as-Emphasis

**Detection:** Bold formatting applied to sentence openers or mid-prose phrases for stress rather than to mark a defined term: `**Importantly,** ...`, `**Note that** ...`, `**Critically,** ...`, `**The key insight is** ...`, `**Remember:** ...`, `**Crucially,** ...`.

**Action:** Strip the bold. If the sentence depends on typographic weight to feel important, the underlying claim is weak — rewrite it with concrete detail. Reserve bold for terms of art on first introduction (e.g., **idempotency** as a defined concept), table headers, or form labels.

| Before | After |
|--------|-------|
| "**Importantly,** the cache invalidates on every write." | "The cache invalidates on every write." |
| "**Note that** the function is async." | "The function is async." |
| "**The key insight:** memoization moves cost from runtime to startup." | "Memoization moves cost from runtime to startup." |
| "**Crucially,** the lock must be released before the callback runs." | "Release the lock before the callback runs; otherwise the callback deadlocks on re-entry." |

Fix the prose, not the formatting.

---

## 12. Compressed Abstract or Metaphorical Phrasing

**Detection:** Noun phrases that compress abstraction or metaphor in place of concrete description.

- **Process nominalizations:** `the drift`, `the divergence`, `the convergence`, `the cascade`, `the unraveling`, `the regression`, `the slippage`, `the entanglement`, `the misalignment`.
- **Anatomical/structural metaphors:** `load-bearing`, `the spine`, `the functional spine`, `the connective tissue`, `the scaffolding`, `the skeleton`, `the backbone`, `the seam`, `the contract` (when not a literal interface).
- **Abstractions used as concrete nouns:** `the shape`, `the texture`, `the gravity`, `the pressure` (applied to code or systems, not physical objects).

**Action:**
- **Recoverable referent:** rewrite the phrase concretely using the surrounding prose.
- **Unrecoverable referent:** leave it. Log `(line, pattern 12, skipped — context insufficient)` in the post-run summary. No inline markers.

| Before | After |
|--------|-------|
| "After six months, we noticed the drift between staging and prod configs." | "After six months, staging and prod configs no longer matched." |
| "The migration touches load-bearing changes in the auth module." | "The migration changes the session-token format — every consumer must update." |
| "The functional spine of the parser is the recursive descent loop." | "The parser is built around a recursive descent loop." |
| "The divergence has become unsustainable." | (skip — no antecedent; log) |

Skip concrete technical artifacts: `the migration`, `the schema`, `the cache`, `the worker pool`, `surface area`. Target only abstract processes or imported physical metaphors that stand in for missing detail.

---

## 13. Numeric Lead-In to Visible Bullets

**Detection:** A sentence spelling out a count immediately before a bullet list: "There are three factors supporting X:", "Five things to consider:", "The problems break down into four categories:".

**Action:** Replace the spelled-out count with "several," "a number of," or drop to a plain noun phrase.

**Keep the number when:**
- No list follows (the count is the information: "Three breaking changes shipped in v3.0")
- The count is contrastive or surprising ("There are only two exit conditions" / "Eighteen failure modes were identified")
- The number is fused into a metaphor or idiom ("a three-headed monster", "a two-edged sword", "the triple constraint")

| Before | After |
|--------|-------|
| "There are three factors supporting this approach:" | "Several factors support this approach:" |
| "Five things to consider before migrating:" | "Things to consider before migrating:" |
| "The problems with JEE are a three-headed monster:" | (keep — number is fused into the metaphor) |
| "There are only two exit conditions." | (keep — no list follows; count is contrastive) |
| "Three breaking changes shipped in v3.0." | (keep — count is the news, no list follows) |
