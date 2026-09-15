from openai import OpenAI

client = OpenAI()

messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is 2 + 2?"},
]

response = client.chat.completions.create(
    model="gpt-4.1-mini", messages=messages)

print(response.choices[0].message.content)
