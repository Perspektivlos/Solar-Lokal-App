---
name: changelog-generator
description: Generates a user-facing changelog from git history. Use when the user asks to write a changelog, prepare release notes, document what changed between versions, or summarize recent commits for users. Transforms developer commit messages into clear, user-friendly release notes.
_agensi: "e061ea18-3d39-408a-81dd-d942afca2aeb"
---

# Changelog Generator

Generate a clear, user-facing changelog from git history. Transform technical commit messages into release notes that users and stakeholders can understand.

## Workflow

1. **Determine the range**:
   - If the user specifies a version range: use it (e.g., `v1.2.0..v1.3.0`)
   - If the user says "since last release": run `git tag --sort=-v:refname | head -5` to find the latest tag, then use `<latest-tag>..HEAD`
   - If no tags exist: define `<range>` as the last 50 commits, or use the root commit..HEAD when fewer than 50 commits exist

2. **Read the commit history**:
   - Run `git log <range> --pretty=format:"%H %s" --no-merges` for commit subjects
   - For important commits, read the full message with `git log <hash> -1 --pretty=format:"%B"`
   - Run `git diff <range> --stat` to see what files changed (helps categorize)

3. **Categorize the changes**:

   Group commits into user-facing categories. Skip anything that is purely internal and has no user impact.

   - **New Features**: New functionality, new commands, new UI elements, new API endpoints
   - **Improvements**: Enhancements to existing features, performance improvements, UX improvements
   - **Bug Fixes**: Fixed behavior that was broken
   - **Breaking Changes**: Anything that requires user action (API changes, removed features, changed defaults, migration needed)
   - **Deprecations**: Features marked for future removal

   **Do NOT include** (unless the user asks):
   - Dependency updates with no user-facing impact
   - Internal refactors
   - CI/CD changes
   - Code style or formatting changes
   - Merge commits

4. **Rewrite each entry for humans**:

   Transform commit messages from developer language to user language:

   | Commit message (developer) | Changelog entry (user) |
   |---|---|
   | `fix(auth): handle null token in refresh flow` | Fixed an issue where users were unexpectedly logged out when their session expired |
   | `feat(export): add CSV export to dashboard` | You can now export your dashboard data as a CSV file |
   | `perf(search): add index on created_at column` | Search results now load significantly faster for large datasets |
   | `fix: prevent race condition in checkout` | Fixed a rare issue where duplicate orders could be created during checkout |

5. **Format the changelog**:

```markdown
# Changelog

## [1.3.0] - 2026-03-03

### New Features

- You can now export your dashboard data as a CSV file from the
  top-right menu
- Added keyboard shortcuts for navigation: press `?` to see all
  available shortcuts
- Webhook deliveries now include a retry mechanism with exponential
  backoff

### Improvements

- Search results load significantly faster for large datasets
- The onboarding flow now remembers your progress if you leave and
  come back
- Error messages throughout the app are now more specific and
  actionable

### Bug Fixes

- Fixed an issue where users were unexpectedly logged out when their
  session expired during active use
- Fixed a rare case where duplicate orders could be created if the
  checkout button was clicked rapidly
- The password reset email now works correctly for accounts created
  with SSO

### Breaking Changes

- The `/api/v1/users` endpoint now requires authentication. Previously
  it was public. Update your API clients to include the Authorization
  header.
- The `--legacy` flag has been removed. Use `--format=v1` instead.
```

6. **Present the changelog** for review. Ask if the user wants to adjust tone, add more detail, or change categorization.

## Rules

- Write from the user's perspective. "You can now..." or "Fixed an issue where..." not "Implemented handler for..." or "Added null check in..."
- Never include commit hashes in the changelog unless the user asks for them
- Always include the date. Use ISO 8601 format (YYYY-MM-DD).
- If there are breaking changes, always put them in their own section with clear migration instructions
- Group related changes together instead of listing them as separate entries. If three commits all improve search performance, that is one changelog entry.
- Keep each entry to 1-2 lines. If an entry needs more explanation, it should have a brief description followed by a details note.
- If the user has an existing CHANGELOG.md, match its format and prepend the new version at the top
- For projects using semver, suggest the appropriate version bump based on the changes (patch for fixes, minor for features, major for breaking changes)
- If the commit history is messy (lots of "WIP", "fix typo", "oops"), do your best to reconstruct the actual changes by reading the diffs rather than trusting the commit messages

## Tone options

If the user specifies a tone, adapt:

- **Professional** (default): Clear, neutral, and user-focused. Follow the perspective defined above.
- **Friendly**: Second-person ("you"), conversational. Good for consumer products.
- **Technical**: Include implementation details, link to PRs. Good for developer tools and open source projects.
