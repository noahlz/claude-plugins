# Display Cost Metrics

## Parse and Display

→ `status` → DISPLAY_STATUS

→ If DISPLAY_STATUS = "success":
  - `data.session_id` → SESSION_ID
  - `data.current_cost` → CURRENT_COST (JSON array)
  - `data.method` → COST_METHOD ("incremental" or "cumulative")
  - `data.since` → COST_SINCE (ISO date string or null)

→ If DISPLAY_STATUS = "invalid_costs" or "not_found" or "error":
  - `message` → ERROR_MESSAGE
  - Display ERROR_MESSAGE to user and exit

## Format for Display

Display costs in this format:
```
📊 Session cost metrics:
   ID: {SESSION_ID}
   Method: {COST_METHOD} (since: {COST_SINCE if incremental, else "session start"})

   (for each model in CURRENT_COST array):
      - {model}: {inputTokens} in + {outputTokens} out = ${cost}
```
