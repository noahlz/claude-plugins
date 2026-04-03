# Design: release-it Setup

**Date:** 2026-04-03  
**Branch:** `chore/release-it`

## Goal

Automate version bumping across all version-bearing files in the project using `release-it` and `@release-it/bumper`. CHANGELOG remains hand-written. No remote push. No GitHub release.

## Version Locations

Three fields must be bumped on every release:

| File | Field |
|------|-------|
| `package.json` | `version` |
| `.claude-plugin/marketplace.json` | `metadata.version` |
| `.claude-plugin/marketplace.json` | `plugins[0].version` |

## Dependencies

Added as `devDependencies`:

- `release-it` — orchestrates versioning, git commit, and local tag
- `@release-it/bumper` — bumps arbitrary JSON fields not managed by release-it natively

## Configuration: `.release-it.json`

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

## `package.json` Scripts

```json
"release": "release-it",
"release:dry-run": "release-it --dry-run"
```

## Release Workflow

```
npm run release
# → interactive prompt: patch / minor / major
# → bumps package.json, marketplace.json (2 fields)
# → commits: "Version 0.x.x"
# → creates local tag: v0.x.x
# → does NOT push or publish
```

## Out of Scope

- CHANGELOG generation (remains manual)
- Remote push (remains manual, user pushes after reviewing)
- GitHub releases
- npm publish
