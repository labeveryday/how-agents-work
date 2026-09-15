import sqlite3, runpy
from pathlib import Path
m = runpy.run_path(str(Path(__file__).with_name("03_agent_loop.py")))
run_agent, tool_definition = m["run_agent"], m["tool_definition"]
db = sqlite3.connect(Path(__file__).with_name("memory.db"))
db.execute("CREATE TABLE IF NOT EXISTS memory (key TEXT, value TEXT)")

def remember(key, value):
    db.execute("DELETE FROM memory WHERE key = ?", (key,))
    db.execute("INSERT INTO memory VALUES (?, ?)", (key, value))
    db.commit()
    return f"Stored {key} = {value}"

def recall(key):
    row = db.execute("SELECT value FROM memory WHERE key=?", (key,)).fetchone()
    return row[0] if row else "no memory found for that key"

TOOLS = [
    tool_definition("remember", "Store one fact",
                {"key":{"type":"string"}, "value":{"type":"string"}}),
    tool_definition("recall", "Recall facts by key",
                {"key":{"type":"string"}}),
]
FUNCTIONS = {"remember": remember, "recall": recall}
SYSTEM = "Use short snake_case keys, like editor."

if __name__ == "__main__":
    print(run_agent(SYSTEM,
        "Remember that my editor is Helix.", TOOLS, FUNCTIONS)[0])
    print(run_agent(SYSTEM,
        "Which editor do I use?", TOOLS, FUNCTIONS)[0])
