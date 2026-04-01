Run the full delivery pipeline for the following feature or task:

$ARGUMENTS

## Pipeline (run in order, fix issues at each step before moving on)

### 1. Plan

Use the `planner` agent to design the implementation. Present the plan and wait for approval before continuing.

### 2. Implement

Use the `developer` agent to implement the approved plan.

### 3. Write tests

Use the `test-writer` agent to write unit tests for all new code.

### 4. Fix unit tests

Use the `test-runner` agent — run `pnpm test:unit`, fix every failure. Do not skip or delete tests.

### 5. Review

Use the `reviewer` agent to review all changes for correctness, security, and conventions.

### 6. Browser QA

Use the `qa-runner` agent to smoke-test the live app. Fix any crashes or broken flows.

### 7. Done

Report: what was built, test results (X/Y passing), QA results (X/Y flows), files changed.

**Do not declare done until all 6 steps pass cleanly.**
