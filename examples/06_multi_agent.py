import runpy
from pathlib import Path


m = runpy.run_path(str(Path(__file__).with_name("03_agent_loop.py")))
run_agent, tool_definition = m["run_agent"], m["tool_definition"]

def researcher(task):
    return run_agent("Find facts. Return one conclusion.", task, [], {})[0]


def coder(task):
    return run_agent("Return one concrete change.", task, [], {})[0]


WORKERS = {"researcher": researcher, "coder": coder}

def delegate(name, task):
    return WORKERS[name](task)


TOOLS = [tool_definition("delegate", "Run a specialist agent", {
    "name": {"type": "string"}, "task": {"type": "string"}})]

SYSTEM = "Delegate research and coding. Then answer."

if __name__ == "__main__":
    print(run_agent(SYSTEM,
        "Compare Atlas and Beacon. Plan the switch.",
        TOOLS, {"delegate": delegate})[0])
