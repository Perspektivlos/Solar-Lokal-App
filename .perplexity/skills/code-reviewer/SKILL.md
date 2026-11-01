---
name: code-reviewer
description: "Performs thorough code review on changed files or specified code. Use when the user asks for a code review, review of a PR, review of a diff, or wants feedback on code quality, security, or best practices. Checks for bugs, security issues, IoT/MQTT security, energy model consistency, performance problems, and style."
---

# Code Reviewer

Eine gründliche, umsetzbare Code-Review wie sie ein Senior Engineer geben würde. Fokus auf das, was wirklich wichtig ist. Bei Solar-Lokal-App zusätzlich: IoT/MQTT-Security und Energie-Modell-Konsistenz.

## Workflow

1. **Was zu reviewen ist**:
   - Wenn der User auf spezifische Dateien zeigt: diese reviewen
   - Wenn in einem git repo mit uncommitted changes: `git diff` reviewen
   - Wenn auf einem Feature-Branch: `git diff main...HEAD`
   - Wenn der User Code pasted: direkt reviewen
   - Bei großen Diffs: neue Dateien > modifizierte Logik > Config-Änderungen > Formatierung

2. **Code analysieren** über sieben Dimensionen:

   ### Bugs & Correctness
   - Off-by-one errors, null/undefined access, race conditions
   - Unhandled error cases, missing return statements
   - Incorrect logic (wrong operator, inverted condition, missing edge case)
   - Type mismatches or unsafe type coercions

   ### Security
   - SQL injection, XSS, command injection, path traversal
   - Hardcoded secrets, API keys, or credentials
   - Missing input validation or sanitization
   - Insecure defaults (permissive CORS, disabled CSRF, weak hashing)
   - Sensitive data in logs or error messages

   ### IoT & MQTT Security
   - Solar-Lokal-App: Port 1883 ohne TLS ist vorerst der vom User akzeptierte LAN-Standard. Nicht als Critical melden und keine TLS-Umstellung fordern; höchstens als Nitpick, wenn der Broker über das LAN hinaus erreichbar wäre.
   - Wo TLS konfiguriert ist: Port 8883, gültige Zertifikate, CA-Verify, TLS-Version gesetzt?
   - ACL-Regeln restriktiv? (Wildcard-Topics `#` nur wo nötig, kein anonymer Zugriff)
   - Credentials in Code oder Logs exponiert? (MQTT-User/Pass, API-Tokens)
   - Input-Validierung für MQTT-Payloads? (JSON, numerische Strings, Text robust parsen)

   ### Energy Model Consistency (Solar-Lokal-App)
   - MPPT-Ladung nicht fälschlich als Hausverbrauch gezählt?
   - Source-Marker (`_via_mqtt`, `_fallback`, `online`) korrekt gesetzt und weitergegeben?
   - API-Contract stabil? (4 Hoymiles-Kanäle, 3 Shelly-Phasen, Felder und Einheiten)
   - Vorzeichen und Aggregationsintervalle korrekt?
   - `data-testid`-Werte stabil, sofern nicht explizit geändert?
   - Trucki-Entladung nutzt `ACDISPLAY` mit `ACSETPOINT` als Fallback?
   - `METER` als separates Signal erhalten?

   ### Performance
   - N+1 queries, missing database indexes
   - Unnecessary re-renders in React components
   - Unbounded loops or recursive calls
   - Large synchronous operations that should be async
   - Missing pagination on list endpoints

   ### Maintainability
   - Functions doing too many things (>30 lines is a smell, not a rule)
   - Duplicated logic that should be extracted
   - Unclear naming that requires reading the implementation to understand
   - Missing error context (catching and swallowing errors)
   - Dead code or unused imports

   ### Architecture
   - Violations of the patterns already established in the codebase
   - Tight coupling between modules that should be independent
   - Business logic in the wrong layer (controller, view, utility)
   - Missing abstractions or premature abstractions

3. **Review formatieren**:

## Review Summary

Start with a 2-3 sentence overall assessment. Be direct. State whether this looks good, needs minor fixes, or has serious issues.

### Critical (must fix before merge)
Only issues that would cause bugs, security vulnerabilities, or data loss in production. If there are none, omit this section entirely.

### Suggestions (should fix)
Issues that affect maintainability, performance, or developer experience but would not cause production incidents.

### Nitpicks (optional)
Style preferences, minor naming improvements, or small refactors. Keep to 3 max. If you have more, pick the most impactful.

### What looks good
Briefly call out 1-2 things done well. Specific, not generic. "Good use of early returns to reduce nesting in validateUser" not "Nice code!"

## Rules

- Never suggest changes purely for style if the codebase already has an established pattern. Follow the existing style.
- Never suggest adding comments to self-explanatory code. Only suggest comments for non-obvious business logic or workarounds.
- Always provide the specific file and line context for each issue. Do not make the user hunt for what you are referring to.
- For every issue, briefly explain *why* it matters, not just *what* to change.
- If you suggest a fix, show the corrected code in a fenced code block.
- Do not pad the review with filler. A review with 2 real issues is better than one with 15 trivial ones.
- If the code looks solid, say so. A short "This looks good, ship it" review is valid.
- Calibrate severity honestly. Not every issue is critical. Most are suggestions.
- For Solar-Lokal-App: Always check energy model invariants — DC-coupled model, MPPT exclusion, source markers.
- For MQTT code: Always check credentials, ACL, and defensive parsing. Treat plain port 1883 in Solar-Lokal-App as accepted, not as a finding.

## Example

```
## Review Summary

Solid implementation of the MQTT handler. One security issue to fix
before merging, and two suggestions for resilience.

### Critical

**mqtt_client.py:42** — The broker password is hardcoded in the source and
also written to the log on connect failure.

```python
# Before
client.username_pw_set("<MQTT_APP_USER>", "geheim123")
log.error("connect failed for <MQTT_APP_USER>/geheim123")

# After
client.username_pw_set(os.environ["MQTT_USER"], os.environ["MQTT_PASSWORD"])
log.error("connect failed for user %s", os.environ["MQTT_USER"])
```

### Suggestions

**mqtt_client.py:67** — The payload parser does not handle wrapped `{"value": ...}`
objects. Add a fallback for this common Victron format.

**server.py:89** — MPPT charging power is added to house consumption in the
summary aggregation. This violates the DC-coupled model invariant.

### What looks good

The defensive `_parse_mqtt_payload` function at line 35 correctly handles
JSON, numeric strings, and empty payloads with safe defaults.
```
