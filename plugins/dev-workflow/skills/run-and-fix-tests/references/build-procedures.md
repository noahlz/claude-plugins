# Build and Test Failure Extraction 

**Contents:**
- Extracting build errors.
- Extracting test failures.

## EXTRACT_BUILD_ERRORS

→ Execute build error parsing script:
```bash
node "{{SKILL_BASE_DIR}}/scripts/parse-build-errors.js" <<< "{{CONFIG_JSON}}"
```

→ Check exit code:

→ If exit code = 0 (success):  
  - → Parse JSON output  
  - → Extract errors from `errors` array 
  - → Extract `totalErrors` count  
  - → If `truncated` is true, note that only first 30 errors shown  
  - → Store errors for Step 4 (delegation to build analyzer)  
  - → Resume skill workflow 

→ If exit code ≠ 0 (error):
  - → Display error message to user
  - → Analyze the error and either recover or halt the workflow
  - → Resume skill workflow with error context  

**IMPORTANT:** Script handles all parsing logic. Do NOT interpret regex patterns or count errors manually.

## EXTRACT_TEST_FAILURES

→ Execute test failure parsing script:
```bash
node "{{SKILL_BASE_DIR}}/scripts/parse-test-failures.js" <<< "{{CONFIG_JSON}}"
```

→ Check exit code:

→ If exit code = 0 (success):   
  - → Parse JSON output  
  - → Extract `totalFailures` count  
  - → Extract failures from `failures` array  
  - → If `truncated` is true, note that only first 30 failures shown   

  - → If `totalFailures` = 0:  
    - → Display to user: "All tests passed"  
    - → Return skill workflow with "no failures" indication   

  - → If `totalFailures` > 0:   
    - → Display count to user: Found [totalFailures] test failures"  
    - → Store failures for Step 6 (delegation to test analyzer) 
    - → Resume workflow with failure data

→ If exit code ≠ 0 (error):
  - → Display error message to user
  - → Detect the issue (missing results file, invalid regex, etc.) and recover or halt
  - → Resume skill workflow with error context

**IMPORTANT:** Script handles all parsing and counting logic. Do NOT interpret regex patterns or count failures manually.
