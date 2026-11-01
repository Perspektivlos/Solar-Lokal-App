---
name: readme-generator
description: "Generates a complete, polished README.md for any project by scanning the codebase. Use when the user asks for a README, project documentation, or when a repository has no README or a sparse one. Detects language, framework, dependencies, and project structure automatically."
---

# README Generator

Generate a professional, comprehensive README.md by scanning the actual project structure and code.

## Workflow

1. **Scan the project**:
   - Run `ls -la` to see the root structure
   - Read `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Gemfile`, `pom.xml`, or equivalent to identify the language, framework, and dependencies
   - Run `find . -type f -name "*.md" | head -20` to check for existing docs
   - Read the existing README if one exists (to preserve any content the user wants to keep)
   - Check for `.env.example` or config files to identify required environment variables
   - Check for `Dockerfile`, `docker-compose.yml`, `Makefile`, or CI config

2. **Detect project characteristics**:
   - Language and framework
   - Build tool and package manager
   - Test framework
   - Deployment method
   - License file

3. **Generate the README** with these sections (skip any that do not apply):

### Required sections:
- **Project title**: The project name as an H1, with a one-line description below it
- **About**: 2-4 sentences explaining what this project does, who it is for, and what problem it solves. Do not be generic. Reference specific functionality found in the codebase.
- **Getting Started**: Prerequisites, installation steps, and how to run the project locally. Use the actual commands found in package.json scripts, Makefile targets, or equivalent. Include environment variable setup if `.env.example` exists.
- **Usage**: How to use the project after installation. Include at least one concrete example (CLI command, API call, import statement, or screenshot placeholder).

### Optional sections (include only when relevant):
- **Tech Stack**: Only if the project uses multiple technologies worth calling out
- **Project Structure**: Only for projects with 10+ directories or non-obvious organization. Use a tree view, keep it to the top 2 levels.
- **API Reference**: Only if the project exposes an API. Summarize key endpoints or methods.
- **Configuration**: Only if there are meaningful configuration options beyond basic env vars
- **Testing**: Only if there is a test suite. Show how to run tests and what frameworks are used.
- **Deployment**: Only if deployment config exists (Dockerfile, CI/CD, cloud config)
- **Contributing**: Only if the project is open source or has multiple contributors
- **License**: Only if a LICENSE file exists. State the license type and link to the file.

4. **Present the README** for review. Ask if the user wants to adjust any section before writing the file.

## Rules

- Never include badges unless the user asks for them. Unused badges look worse than no badges.
- Never include placeholder text like "Add your description here" or "TODO". Every line must be real content derived from the actual project.
- Write in the second person ("you") for instructions. Write in the third person for descriptions ("This tool does X").
- Keep the entire README under 300 lines. A README that nobody reads is worse than a short one.
- Use fenced code blocks with the correct language identifier for all commands and code samples.
- If the project has no tests, no CI, and no deployment config, do not add those sections with made-up content.
- Prefer showing real commands from the project over generic examples.
- For Solar-Lokal-App and German-language projects: Write the README in German. Code, API names, filenames, and commands remain unchanged.

## Example output structure

```markdown
# Solar-Lokal-App

Lokale, cloudfreie Webanwendung zur Visualisierung und Steuerung von Energieanlagen.

## Über das Projekt

Solar-Lokal-App ist eine modulare Webanwendung für das eigene Heimnetzwerk.
Sie aggregiert Daten von Photovoltaik, Batteriespeichern, Wechselrichtern und
Stromzählern über MQTT und HTTP. Das Backend läuft auf FastAPI, das Frontend
auf React 19. Optimiert für ressourcenschonenden Betrieb auf Proxmox LXC.

## Voraussetzungen

- Python 3.11+
- Node.js 18+
- MongoDB
- Mosquitto MQTT Broker (mit TLS empfohlen)
- InfluxDB (optional, für Telemetrie-Historie)

## Installation

\`\`\`bash
# Backend
cd backend
pip install -r requirements.txt
MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest -q

# Frontend
cd frontend
yarn install
yarn start
\`\`\`

## Tests

\`\`\`bash
# Backend
cd backend && MONGO_URL=mongodb://localhost DB_NAME=test PYTHONPATH=. pytest -q

# Frontend
cd frontend && ./node_modules/.bin/craco build
cd frontend && ./node_modules/.bin/craco test --watchAll=false
\`\`\`

## Lizenz

MIT — siehe [LICENSE](LICENSE) für Details.
```
