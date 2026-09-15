import runpy
from pathlib import Path


m = runpy.run_path(str(Path(__file__).with_name("03_agent_loop.py")))
run_agent, tool_definition = m["run_agent"], m["tool_definition"]

def read_file(path):
    return open(path).read()


def edit_file(path, old, new):
    return path + " updated"


def run_command(command):
    return "ok"


TOOLS = [
    tool_definition("read_file", "Read a file",
                {"path": {"type": "string"}}),
    tool_definition("edit_file", "Edit a file",
                {"path": {"type": "string"}, "old": {"type": "string"},
                 "new": {"type": "string"}}),
    tool_definition("run_command", "Run a command",
                {"command": {"type": "string"}}),
]

FUNCTIONS = {"read_file": read_file, "edit_file": edit_file,
             "run_command": run_command}
SYSTEM = "Read files before answering about their contents."

if __name__ == "__main__":
    print(run_agent(SYSTEM,
        "What does config.yaml set?", TOOLS, FUNCTIONS)[0])
