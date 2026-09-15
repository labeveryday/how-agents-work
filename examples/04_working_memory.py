import json
from openai import OpenAI

TOKEN_LIMIT = 150_000
client = OpenAI()

def estimate_tokens(messages):
    return sum(len(json.dumps(m)) for m in messages) // 4
def summarize_old_messages(messages):
    keep, old = messages[:2], messages[2:]
    prompt = "Summarize these agent messages:\n" + json.dumps(old)
    summary = client.chat.completions.create(
        model="gpt-4.1-mini", messages=[{"role":"user","content":prompt}]
    ).choices[0].message.content
    return keep + [{"role": "system", "content": summary}]
def summarize_if_needed(messages):
    if estimate_tokens(messages) > TOKEN_LIMIT:
        return summarize_old_messages(messages)
    return messages

messages = [
    {"role": "system", "content": "You are a coding agent."},
    {"role": "user", "content": "Refactor the parser."},
]
print(len(messages))
messages.append({"role": "tool", "content": "parser.py (812 lines)"})
messages.append({"role": "tool", "content": "pytest: 14 failed, 2 passed"})
messages.append({"role": "tool", "content": "Updated parser.py (840 lines)"})
messages.append({"role": "tool", "content": "Additional file contents"})
print(len(messages))
messages = summarize_if_needed(messages)
