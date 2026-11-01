---
name: pr-description-writer
description: "Writes clear, well-structured pull request descriptions by analyzing the git diff against the base branch. Use when the user asks to write a PR description, prepare a pull request, or document changes for a merge request. Works with GitHub, GitLab, and Bitbucket PR formats."
---

# PR Description Writer

Write pull request descriptions that help reviewers understand the change quickly and review it efficiently.

## Workflow

1. **Determine the base branch**:
   - Run `git branch --show-current` to get the current branch name
   - Run `git log --oneline main..HEAD` (try `main`, then `master`, then `develop`) to see the commit history
   - If the user specifies a base branch, use that instead

2. **Analyze the changes**:
   - Run `git diff main...HEAD --stat` for a file-level summary
   - Run `git diff main...HEAD` for the full diff (for large diffs, focus on the most impactful files)
   - Run `git log --oneline main..HEAD` to read the commit messages for context
   - Check for any linked issues in commit messages (references to #123, JIRA-456, etc.)

3. **Understand the intent**: From the diff and commit messages, determine:
   - Is this a feature, bugfix, refactor, chore, or hotfix?
   - What problem does it solve?
   - What was the approach taken?
   - Are there any trade-offs or decisions worth explaining?

4. **Generate the PR description**:

```markdown
## What

One paragraph (2-4 sentences) describing what this PR does. Be specific.
State the problem it solves or the feature it adds. A reviewer should
understand the purpose without reading any code.

## Why

1-3 sentences explaining the motivation. Link to the issue, bug report,
or discussion that prompted this work. If there is no issue, explain the
context that makes this change necessary.

## How

Describe the technical approach. Walk through the key changes in logical
order, not file-by-file. Focus on decisions that are not obvious from
the code itself:
- Why this approach over alternatives
- Any trade-offs made
- Dependencies added and why

## Changes

Concise list of the significant changes, grouped logically:

- **Auth module**: Added Google OAuth2 flow with session persistence
- **User model**: Added `google_id` and `avatar_url` fields
- **Middleware**: Updated auth middleware to support both session and JWT
- **Config**: Added OAuth environment variables to `.env.example`

## Testing

How was this tested? Be specific:
- [ ] Unit tests added/updated (describe what is covered)
- [ ] Manual testing (describe the steps you took)
- [ ] Edge cases considered (list them)

## Screenshots

(Include if there are UI changes. Add placeholder text if the user
should add screenshots.)

## Notes for reviewers

Any context that helps the review: areas that need extra scrutiny,
files that can be skimmed, known issues being deferred, or related
PRs that should be reviewed first.
```

5. **Present the description** for review. Ask if the user wants to adjust anything before copying or creating the PR.

## Rules

- Never write a PR description that just restates the file list. "Updated auth.ts, user.ts, middleware.ts" is not a description.
- Always explain the *why*, not just the *what*. The diff shows what changed. The description should explain why it changed.
- If the diff is small (< 20 lines), keep the description proportionally short. A one-line bug fix does not need a five-section PR description.
- If there are UI changes, always include a Screenshots section (even if just as a placeholder reminder).
- If commits reference issues, always link them in the description.
- Keep the Changes section to real changes. Do not list auto-generated files, lockfile updates, or formatting changes unless they are the point of the PR.
- If the PR is a draft or work-in-progress, note what is still incomplete.
- Use checkboxes for the Testing section so reviewers can see what was and was not tested.
- Detect the branch name and use it to infer context (e.g., `fix/duplicate-webhooks` tells you the intent).
- For Solar-Lokal-App and German-language projects: Write PR descriptions in German. Code, API names, filenames, and technical terms remain unchanged.

## Adapting to platform

- **GitHub**: Use the format above. It renders well in GitHub's PR description field.
- **GitLab**: Replace "PR" with "MR" in any text. The format is otherwise identical.
- **Bitbucket**: Same format works. Bitbucket renders markdown in PR descriptions.
- **Linear/Jira**: If commit messages reference ticket IDs, always include them as links.
