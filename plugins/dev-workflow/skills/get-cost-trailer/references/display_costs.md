# Display Cost Metrics

## Parse and Display

→ `status` → DISPLAY_STATUS

→ If DISPLAY_STATUS = "success":
  - `data.session_id` → SESSION_ID
  - `data.current_cost` → CURRENT_COST (JSON array)
  - `data.method` → COST_METHOD ("incremental" or "cumulative")
  - `data.since` → COST_SINCE (ISO date string or null)
  - `data.cleanup_period_days` → CLEANUP_PERIOD_DAYS

→ If DISPLAY_STATUS = "invalid_costs" or "not_found" or "error":
  - `message` → ERROR_MESSAGE
  - Display ERROR_MESSAGE to user and exit

## Format for Display

Display costs in this format:
```
📊 Project cost metrics:
   Project: {SESSION_ID}
   (if COST_METHOD = "incremental"):
      Cost since previous commit (since {COST_SINCE}):
   (if COST_METHOD = "cumulative"):
      Cost total, last {CLEANUP_PERIOD_DAYS} days:
   Total: ${sum of all cost values}

   (for each model in CURRENT_COST array):
      - {model}: {inputTokens} in + {outputTokens} out = ${cost}
```
