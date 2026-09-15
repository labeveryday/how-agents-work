import json
from openai import OpenAI


def tool_definition(name, description, properties):
    return {"type": "function", "function": {
        "name": name, "description": description,
        "parameters": {"type": "object", "properties": properties,
                       "required": list(properties)}}}


def run_agent(system, prompt, tools, functions,
              client=None, model="gpt-4.1-mini"):
    client = client or OpenAI()
    messages = [{"role": "system", "content": system},
                {"role": "user", "content": prompt}]

    while True:
        request = {"model": model, "messages": messages}
        if tools:
            request["tools"] = tools
        reply = client.chat.completions.create(**request)
        message = reply.choices[0].message
        messages.append(message.model_dump(exclude_none=True))
        if not message.tool_calls:
            return message.content, messages

        for call in message.tool_calls:
            args = json.loads(call.function.arguments)
            result = functions[call.function.name](**args)
            messages.append({"role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(result, default=str)})
