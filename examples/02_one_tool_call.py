import json
from openai import OpenAI


client = OpenAI()

def get_weather(city):
    return {"city": city, "temp_c": 18, "sky": "rain"}

TOOL = {"type": "function", "function": {
    "name": "get_weather",
    "description": "Get current weather",
    "parameters": {"type": "object", "properties": {
        "city": {"type": "string"}}, "required": ["city"]}}}

messages = [
    {"role": "system", "content": "Use the weather tool."},
    {"role": "user", "content": "Weather in Paris?"},
]

reply = client.chat.completions.create(
    model="gpt-4.1-mini", messages=messages, tools=[TOOL])

message = reply.choices[0].message

call = message.tool_calls[0]

args = json.loads(call.function.arguments)

result = get_weather(**args)

print(result)
