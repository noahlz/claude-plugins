# release-it Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure release-it to bump version in all three locations (`package.json`, `.claude-plugin/marketplace.json` ×2) and create a local git tag.

**Architecture:** release-it handles `package.json` natively; `@release-it/bumper` handles `.claude-plugin/marketplace.json` via JSON path expressions. Config lives in `.release-it.json`. No push, no GitHub release, no npm publish.

**Tech Stack:** release-it, @release-it/bumper, npm scripts

---

## File Map

| Action | File |
|--------|------|
| Modify | `package.json` — add devDependencies + `release` / `release:dry-run` scripts |
| Create | `.release-it.json` — full release-it config |
| Auto-updated | `package-lock.json` — updated by npm install |

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json` (devDependencies)
- Auto-updated: `package-lock.json`

- [ ] **Step 1: Install release-it and @release-it/bumper as dev deps**

```bash
npm install --save-dev release-it @release-it/bumper
```

Expected output: `added N packages` with no errors.

- [ ] **Step 2: Verify they appear in package.json devDependencies**

```bash
node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log(p.devDependencies['release-it'], p.devDependencies['@release-it/bumper'])"
```

Expected: two version strings printed (e.g. `^17.x.x ^6.x.x`).

---

### Task 2: Create .release-it.json config

**Files:**
- Create: `.release-it.json`

- [ ] **Step 1: Create .release-it.json**

```json
{
  "git": {
    "push": false,
    "tagName": "v${version}",
    "commitMessage": "Version ${version}"
  },
  "github": {
    "release": false
  },
  "npm": {
    "publish": false
  },
  "plugins": {
    "@release-it/bumper": {
      "out": [
        {
          "file": ".claude-plugin/marketplace.json",
          "path": "metadata.version"
        },
        {
          "file": ".claude-plugin/marketplace.json",
          "path": "plugins.0.version"
        }
      ]
    }
  }
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('.release-it.json','utf8')); console.log('valid')"
```

Expected: `valid`

---

### Task 3: Add release scripts to package.json

**Files:**
- Modify: `package.json` — scripts section

- [ ] **Step 1: Add scripts**

In `package.json`, add to the `"scripts"` object:

```json
"release": "release-it",
"release:dry-run": "release-it --dry-run"
```

Result — full scripts section should look like:

```json
"scripts": {
  "clean": "rm -rf dist/",
  "test": "node test/run-tests.js",
  "coverage": "node --experimental-test-coverage --test test/**/*.test.js",
  "release": "release-it",
  "release:dry-run": "release-it --dry-run"
}
```

- [ ] **Step 2: Verify package.json is valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('valid')"
```

Expected: `valid`

---

### Task 4: Verify with dry run

**Files:** none (read-only verification)

- [ ] **Step 1: Run dry-run and confirm all three version bumps appear**

```bash
npm run release:dry-run -- --increment=patch 2>&1 | head -60
```

Expected output should include lines referencing:
- `package.json` version bump
- `.claude-plugin/marketplace.json` bumps (two paths)
- Local tag creation (`v0.7.2`)
- No push, no GitHub release

- [ ] **Step 2: Confirm version files are unchanged after dry-run**

```bash
node -e "
const pkg = JSON.parse(require('fs').readFileSync('package.json','utf8'));
const mkt = JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8'));
console.log('package.json:', pkg.version);
console.log('metadata.version:', mkt.metadata.version);
console.log('plugins[0].version:', mkt.plugins[0].version);
"
```

Expected: all three still show `0.7.1` (dry-run made no changes).
