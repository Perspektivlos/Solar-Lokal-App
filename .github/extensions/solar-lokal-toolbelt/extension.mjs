import { joinSession } from "@github/copilot-sdk/extension";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const memoryPath = () =>
    path.resolve(process.cwd(), ".github", "agent-memory", "MEMORY.md");

const session = await joinSession({
    tools: [
        {
            name: "solar_lokal_memory_read",
            description:
                "Liest die dauerhaften Solar-Lokal-Agentennotizen aus .github/agent-memory/MEMORY.md.",
            parameters: { type: "object", properties: {} },
            skipPermission: true,
            handler: async () => {
                try {
                    return await readFile(memoryPath(), "utf8");
                } catch (error) {
                    if (error.code === "ENOENT") {
                        return "Noch keine Solar-Lokal-Agentennotizen vorhanden.";
                    }
                    throw error;
                }
            },
        },
        {
            name: "solar_lokal_memory_append",
            description:
                "Schreibt eine kurze, verifizierte Lernnotiz in die dauerhaften Solar-Lokal-Agentennotizen.",
            parameters: {
                type: "object",
                properties: {
                    category: {
                        type: "string",
                        description:
                            "Kategorie, zum Beispiel workflow, domain, validation oder failure.",
                    },
                    note: {
                        type: "string",
                        description:
                            "Eine konkrete, überprüfbare Lernnotiz ohne Secrets.",
                    },
                },
                required: ["category", "note"],
            },
            handler: async ({ category, note }) => {
                const filePath = memoryPath();
                await mkdir(path.dirname(filePath), { recursive: true });
                const timestamp = new Date().toISOString();
                await appendFile(
                    filePath,
                    `\n## ${timestamp} - ${category}\n${note.trim()}\n`,
                    "utf8",
                );
                return `Agentennotiz gespeichert: ${category}`;
            },
        },
    ],
});

await session.log("Solar-Lokal-Werkzeuggürtel geladen: Memory-Lesen und -Schreiben aktiv.");
