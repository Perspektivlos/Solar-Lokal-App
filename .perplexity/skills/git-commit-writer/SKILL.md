---
name: git-commit-writer
description: "Writes conventional commit messages by analyzing staged git changes. Use when the user asks to commit, write a commit message, or after completing code changes that need to be committed. Supports Conventional Commits format with scope detection and breaking change identification."
---

# Git Commit Writer

Write precise, informative commit messages following the Conventional Commits specification by analyzing the actual staged changes.

## Workflow

1. **Check for staged changes**: Run `git diff --cached --stat` to see what files are staged. If nothing is staged, check `git diff --stat` for unstaged changes and ask the user if they want to stage them first.

2. **Analyze the diff**: Run `git diff --cached` to read the actual changes. For large diffs (>500 lines), use `git diff --cached --stat` combined with `git diff --cached -- <file>` for the most important files.

3. **Determine the commit type** based on what changed:
   - `feat`: New functionality visible to users
   - `fix`: Bug fix
   - `refactor`: Code change that neither fixes a bug nor adds a feature
   - `docs`: Documentation only
   - `style`: Formatting, semicolons, whitespace (no logic change)
   - `test`: Adding or updating tests
   - `chore`: Build process, dependencies, tooling
   - `perf`: Performance improvement
   - `ci`: CI/CD configuration changes

4. **Detect the scope** from the primary area of change. Use the module name, component name, or directory. Keep it to one word when possible. Omit the scope if changes span too many areas.

5. **Write the commit message**:
   - Subject line: `type(scope): imperative description` — max 72 characters
   - Body (if needed): Explain *what* changed and *why*, not *how*. Wrap at 72 characters.
   - Footer: Add `BREAKING CHANGE:` if the commit introduces incompatible changes.

6. **Present the message** to the user and ask for confirmation before committing.

## Rules

- Always use imperative mood in the subject ("add" not "added", "fix" not "fixes")
- Never capitalize the first letter after the colon
- Never end the subject with a period
- If multiple logical changes are staged, suggest splitting into separate commits
- If the diff reveals a breaking change (removed public API, changed function signatures, renamed exports), always flag it
- Keep the subject line genuinely descriptive. "update code" or "fix bug" are never acceptable
- For Solar-Lokal-App and German-language projects: Write commit bodies in German. Code, filenames, and technical terms remain unchanged.

## Examples

```
feat(mqtt): add Victron DC charging topic parser

Ergänzt den MQTT-Parser für Victron MPPT-Daten auf Topic
`N/<portal_id>/system/0/Dc/Battery/Power`. MPPT-Ladung wird nicht
als Hausverbrauch gezählt, sondern separat ausgewiesen.
```

```
fix(energy): prevent double-counting of MPPT charging in summary

Die Aggregation in `collect_live()` hat MPPT-Ladung fälschlich
zum Hausverbrauch addiert. Separierter DC-Pfad jetzt korrekt
ausgeschlossen. Test in `test_solar_dashboard.py` ergänzt.
```

```
chore(deps): upgrade React from 18.2 to 19.1

BREAKING CHANGE: React 19 removes legacy context API support.
Components using contextType must migrate to useContext hook.
```

```
refactor(mqtt): extract payload parser into standalone function
```

```
docs: add MQTT TLS configuration section to README
```
