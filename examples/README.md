# Runnable examples

These files match the code shown on the site. Run them from this directory.
They read `OPENAI_API_KEY` from the environment.

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Put your key in `.env`, then:

```sh
set -a && source .env && set +a
python 01_one_call.py
python 02_one_tool_call.py
python 04_working_memory.py
python 05_saved_memory.py
python 06_multi_agent.py
python 07_choose.py
```

`03_agent_loop.py` is the loop from lesson 3. Lessons 5–7 load it
with `runpy` from the same folder, so keep that file next to them.
`05_saved_memory.py` writes `memory.db` next to the script, not the
working directory. `07_choose.py` reads `config.yaml` in this directory.
These files use `gpt-4.1-mini`.
