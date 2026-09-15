# How agents work

An agent is a loop: call the model, run whatever tool it asks for, append the result, call
again. The model chooses. Your program acts.

This repo is an interactive walkthrough of that loop, plus the Python it is built from.

**→ [howagentswork.dev](https://howagentswork.dev)**

Eight lessons, about ten minutes. Each one replays a saved run step by step, so you can watch
the whole thing without an API key. The site also runs offline — clone the repo and open
`index.html` in a browser.

## The lessons

| # | Lesson | Code |
|---|---|---|
| 1 | One model call | `examples/01_one_call.py` |
| 2 | One tool call | `examples/02_one_tool_call.py` |
| 3 | The agent loop | `examples/03_agent_loop.py` |
| 4 | Working memory | `examples/04_working_memory.py` |
| 5 | Memory between runs | `examples/05_saved_memory.py` |
| 6 | Multi-agent | `examples/06_multi_agent.py` |
| 7 | Choose the next message | `examples/07_choose.py` |
| 8 | Recap | — |

## Run the examples

Watching the site costs nothing. Running the Python needs:

- **Python 3**
- **An OpenAI account and an API key.** The key is paid — every run is billed to it. Create one
  at [platform.openai.com/api-keys](https://platform.openai.com/api-keys). The examples use
  `gpt-4.1-mini`, so a full pass through all seven is a few cents.

```sh
git clone https://github.com/labeveryday/how-agents-work.git
cd how-agents-work/examples

python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env               # then put your key in .env
set -a && source .env && set +a    # Windows: $env:OPENAI_API_KEY="sk-..."
```

Then run any lesson:

```sh
python3 01_one_call.py
python3 02_one_tool_call.py
python3 04_working_memory.py
python3 05_saved_memory.py
python3 06_multi_agent.py
python3 07_choose.py
```

Notes:

- `03_agent_loop.py` defines `run_agent` and has no `__main__`, so running it directly prints
  nothing. Lessons 5–7 import it with `runpy` from the same folder — keep it next to them.
- `05_saved_memory.py` writes `memory.db` next to the script, not the working directory.
- `07_choose.py` reads `config.yaml` from the examples folder.

## What's in here

```
index.html  styles.css  app.js   the site
traces/                          the saved runs each lesson replays
examples/                        the runnable Python
```

## More

[YouTube @labeveryday](https://www.youtube.com/@labeveryday) ·
[Chat Completions API docs](https://platform.openai.com/docs/api-reference/chat/create)
