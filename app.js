'use strict';

/* How agents work: a trace replayer. No model is ever called. */

const CHAPTER_GROUPS = [
  { name: 'Start', chapters: [
    { id: 'ch1', title: 'One model call', nav: 'Model call' },
    { id: 'ch2', title: 'One tool call', nav: 'Tool call' },
  ]},
  { name: 'Loop', chapters: [
    { id: 'loop', title: 'The agent loop', nav: 'The loop' },
  ]},
  { name: 'Memory', chapters: [
    { id: 'ch3', title: 'Working memory', nav: 'Memory' },
    { id: 'ch7', title: 'Memory between runs', nav: 'Saved memory' },
  ]},
  { name: 'Scale', chapters: [
    { id: 'ch8', title: 'Multi-agent', nav: 'Multi-agent' },
  ]},
  { name: 'Practice', chapters: [
    { id: 'ch6', title: 'Choose the next message', nav: 'You choose' },
  ]},
  { name: 'Close', chapters: [
    { id: 'closing', title: 'What you watched', nav: 'Recap' },
  ]},
];

const CHAPTERS = CHAPTER_GROUPS.flatMap((g) => g.chapters);
CHAPTERS.forEach((c, i) => { c.num = i + 1; });

const CHAPTER_LAWS = {
  ch1: 'The model returns one message',
  ch2: 'A tool call names a function. Your code runs it.',
  loop: 'Call, run tools, append results, call again',
  ch3: 'The model only sees the current messages',
  ch7: 'Save facts outside the message list',
  ch8: 'A second agent is a tool',
  ch6: 'You choose the next message. The program runs tools.',
  closing: 'An agent is this loop',
};

/* One machine. Each lesson turns parts on, ghosts what is not in play,
   and lights the box for the current step. */
const ARCHITECTURES = {
  ch1: {
    point: 'You send messages into chat.completions.create. One message comes out. The program does not call the model again.',
    layout: 'once',
    on: ['model', 'call', 'program', 'messages'],
    off: ['world', 'run', 'append'],
    hide: ['store', 'child'],
    cut: ['loop'],
    modelName: 'Model',
    modelSub: 'returns one message',
    progSub: 'chat.completions.create',
    msgSub: 'system and user',
    worldSub: 'no tools in this lesson',
  },
  ch2: {
    point: 'The model returns a tool call, which is data. Your code runs that function once. Then it stops.',
    layout: 'tool',
    on: ['model', 'call', 'program', 'messages', 'world', 'run'],
    off: [],
    hide: ['store', 'child'],
    cut: ['loop'],
    modelName: 'Model',
    modelSub: 'returns a tool call',
    progSub: 'run the function, then stop',
    msgSub: 'the list',
    worldSub: 'get_weather()',
  },
  loop: {
    point: 'After a tool result, append it and call the model again with the updated list. That repeat is the agent.',
    layout: 'flow',
    on: ['model', 'call', 'program', 'messages', 'append', 'world', 'run', 'loop'],
    off: [],
    hide: ['store', 'child'],
    cut: [],
    modelName: 'Model',
    modelSub: 'text or a tool call',
    progSub: 'run, append, call again',
    msgSub: 'grows each step',
    worldSub: 'files and tests',
  },
  ch3: {
    point: 'The next call only sees the current messages. That list is working memory, and it is the only memory the model has.',
    layout: 'work',
    on: ['model', 'call', 'messages', 'append'],
    off: [],
    hide: ['store', 'child'],
    cut: [],
    emph: ['messages'],
    modelName: 'Model',
    modelSub: 'reads the current list',
    progSub: 'grows the list, may summarize',
    msgSub: 'working memory',
    worldSub: 'file text stays in the list',
  },
  ch7: {
    point: 'Write the fact to a file or database. A new message list does not contain it unless a tool reads it back.',
    layout: 'saved',
    on: ['run1', 'run2', 'messages', 'fresh', 'remember', 'recall', 'store'],
    off: [],
    hide: ['child'],
    cut: [],
    emph: ['store'],
    modelName: 'Model',
    modelSub: 'asks remember or recall',
    progSub: 'reads and writes memory.db',
    msgSub: 'new list each run',
    worldSub: 'remember / recall',
  },
  ch8: {
    point: 'delegate starts another run_agent with its own messages. The parent list only gets the returned string.',
    layout: 'agents',
    on: ['parent', 'call', 'child', 'researcher', 'coder'],
    off: [],
    hide: ['store'],
    cut: [],
    emph: ['child'],
    modelName: 'Parent model',
    modelSub: 'asks delegate',
    progSub: 'a child agent is a tool',
    msgSub: 'parent list only',
    worldSub: 'delegate(name, task)',
  },
  ch6: {
    point: 'You pick the next assistant message. The program still runs tools and appends results.',
    layout: 'choose',
    on: ['program', 'call', 'tools', 'run', 'model'],
    off: [],
    hide: ['store', 'child'],
    cut: [],
    emph: ['model'],
    modelName: 'You',
    modelSub: 'pick the next message',
    progSub: 'still executes and observes',
    msgSub: 'the list you are filling',
    worldSub: 'files',
  },
};

/* Every sample is a real Python file mirrored in examples/.
   The verifier runs each file against fixed model responses. */
const CODE_SAMPLES = {
  one_call: {
    file: '01_one_call.py',
    lang: 'python',
    caption: 'Set OPENAI_API_KEY, then run python 01_one_call.py.',
    lines: [
      'from openai import OpenAI',
      '',
      'client = OpenAI()',
      'messages = [',
      '    {"role": "system", "content": "You are a helpful assistant."},',
      '    {"role": "user", "content": "What is 2 + 2?"},',
      ']',
      '',
      'response = client.chat.completions.create(',
      '    model="gpt-4.1-mini", messages=messages)',
      'print(response.choices[0].message.content)',
    ],
  },
  one_tool: {
    file: '02_one_tool_call.py',
    lang: 'python',
    caption: 'One model call. Then one function. Then stop.',
    lines: [
      'import json',
      'from openai import OpenAI',
      '',
      'def get_weather(city):',
      '    return {"city": city, "temp_c": 18, "sky": "rain"}',
      '',
      'TOOL = {"type": "function", "function": {',
      '    "name": "get_weather",',
      '    "description": "Get current weather",',
      '    "parameters": {"type": "object", "properties": {',
      '        "city": {"type": "string"}}, "required": ["city"]}}}',
      '',
      'client = OpenAI()',
      'messages = [',
      '    {"role": "system", "content": "Use the weather tool."},',
      '    {"role": "user", "content": "Weather in Paris?"},',
      ']',
      'reply = client.chat.completions.create(',
      '    model="gpt-4.1-mini", messages=messages, tools=[TOOL])',
      'message = reply.choices[0].message',
      'call = message.tool_calls[0]',
      'args = json.loads(call.function.arguments)',
      'result = get_weather(**args)',
      'print(result)',
    ],
  },
  agent_loop: {
    file: '03_agent_loop.py',
    lang: 'python',
    caption: 'Call the model. Run each tool. Add the result. Repeat.',
    lines: [
      'import json',
      'from openai import OpenAI',
      '',
      'def tool_definition(name, description, properties):',
      '    return {"type": "function", "function": {',
      '        "name": name, "description": description,',
      '        "parameters": {"type": "object", "properties": properties,',
      '                       "required": list(properties)}}}',
      '',
      'def run_agent(system, prompt, tools, functions,',
      '              client=None, model="gpt-4.1-mini"):',
      '    client = client or OpenAI()',
      '    messages = [{"role": "system", "content": system},',
      '                {"role": "user", "content": prompt}]',
      '',
      '    while True:',
      '        request = {"model": model, "messages": messages}',
      '        if tools:',
      '            request["tools"] = tools',
      '        reply = client.chat.completions.create(**request)',
      '        message = reply.choices[0].message',
      '        messages.append(message.model_dump(exclude_none=True))',
      '        if not message.tool_calls:',
      '            return message.content, messages',
      '',
      '        for call in message.tool_calls:',
      '            args = json.loads(call.function.arguments)',
      '            result = functions[call.function.name](**args)',
      '            messages.append({"role": "tool",',
      '                "tool_call_id": call.id,',
      '                "content": json.dumps(result, default=str)})',
    ],
  },
  context: {
    file: '04_working_memory.py',
    lang: 'python',
    caption: 'The list grows with every append. Over TOKEN_LIMIT, keep the original task and replace the rest with a summary.',
    lines: [
      'import json',
      'from openai import OpenAI',
      '',
      'TOKEN_LIMIT = 150_000',
      'client = OpenAI()',
      '',
      'def estimate_tokens(messages):',
      '    return sum(len(json.dumps(m)) for m in messages) // 4',
      'def summarize_old_messages(messages):',
      '    keep, old = messages[:2], messages[2:]',
      '    prompt = "Summarize these agent messages:\\n" + json.dumps(old)',
      '    summary = client.chat.completions.create(',
      '        model="gpt-4.1-mini", messages=[{"role":"user","content":prompt}]',
      '    ).choices[0].message.content',
      '    return keep + [{"role": "system", "content": summary}]',
      'def summarize_if_needed(messages):',
      '    if estimate_tokens(messages) > TOKEN_LIMIT:',
      '        return summarize_old_messages(messages)',
      '    return messages',
      '',
      'messages = [',
      '    {"role": "system", "content": "You are a coding agent."},',
      '    {"role": "user", "content": "Refactor the parser."},',
      ']',
      'print(len(messages))',
      'messages.append({"role": "tool", "content": "parser.py (812 lines)"})',
      'messages.append({"role": "tool", "content": "pytest: 14 failed, 2 passed"})',
      'messages.append({"role": "tool", "content": "Updated parser.py (840 lines)"})',
      'messages.append({"role": "tool", "content": "Additional file contents"})',
      'print(len(messages))',
      'messages = summarize_if_needed(messages)',
    ],
  },
  saved_memory: {
    file: '05_saved_memory.py',
    lang: 'python',
    caption: 'Two runs share memory.db next to this file. The system message names the key so recall can find it.',
    lines: [
      'import sqlite3, runpy',
      'from pathlib import Path',
      'm = runpy.run_path(str(Path(__file__).with_name("03_agent_loop.py")))',
      'run_agent, tool_definition = m["run_agent"], m["tool_definition"]',
      'db = sqlite3.connect(Path(__file__).with_name("memory.db"))',
      'db.execute("CREATE TABLE IF NOT EXISTS memory (key TEXT, value TEXT)")',
      '',
      'def remember(key, value):',
      '    db.execute("DELETE FROM memory WHERE key = ?", (key,))',
      '    db.execute("INSERT INTO memory VALUES (?, ?)", (key, value))',
      '    db.commit()',
      '    return f"Stored {key} = {value}"',
      '',
      'def recall(key):',
      '    row = db.execute("SELECT value FROM memory WHERE key=?", (key,)).fetchone()',
      '    return row[0] if row else "no memory found for that key"',
      '',
      'TOOLS = [',
      '    tool_definition("remember", "Store one fact",',
      '                {"key":{"type":"string"}, "value":{"type":"string"}}),',
      '    tool_definition("recall", "Recall facts by key",',
      '                {"key":{"type":"string"}}),',
      ']',
      'FUNCTIONS = {"remember": remember, "recall": recall}',
      'SYSTEM = "Use short snake_case keys, like editor."',
      '',
      'if __name__ == "__main__":',
      '    print(run_agent(SYSTEM,',
      '        "Remember that my editor is Helix.", TOOLS, FUNCTIONS)[0])',
      '    print(run_agent(SYSTEM,',
      '        "Which editor do I use?", TOOLS, FUNCTIONS)[0])',
    ],
  },
  multi_agent: {
    file: '06_multi_agent.py',
    lang: 'python',
    caption: 'delegate runs another agent. Only the returned text comes back.',
    lines: [
      'import runpy',
      'from pathlib import Path',
      '',
      'm = runpy.run_path(str(Path(__file__).with_name("03_agent_loop.py")))',
      'run_agent, tool_definition = m["run_agent"], m["tool_definition"]',
      '',
      'def researcher(task):',
      '    return run_agent("Find facts. Return one conclusion.", task, [], {})[0]',
      '',
      'def coder(task):',
      '    return run_agent("Return one concrete change.", task, [], {})[0]',
      '',
      'WORKERS = {"researcher": researcher, "coder": coder}',
      '',
      'def delegate(name, task):',
      '    return WORKERS[name](task)',
      '',
      'TOOLS = [tool_definition("delegate", "Run a specialist agent", {',
      '    "name": {"type": "string"}, "task": {"type": "string"}})]',
      '',
      'SYSTEM = "Delegate research and coding. Then answer."',
      '',
      'if __name__ == "__main__":',
      '    print(run_agent(SYSTEM,',
      '        "Compare Atlas and Beacon. Plan the switch.",',
      '        TOOLS, {"delegate": delegate})[0])',
    ],
  },
  choose: {
    file: '07_choose.py',
    lang: 'python',
    caption: 'You pick the next message. The program still runs these tools.',
    lines: [
      'import runpy',
      'from pathlib import Path',
      '',
      'm = runpy.run_path(str(Path(__file__).with_name("03_agent_loop.py")))',
      'run_agent, tool_definition = m["run_agent"], m["tool_definition"]',
      '',
      'def read_file(path):',
      '    return open(path).read()',
      '',
      'def edit_file(path, old, new):',
      '    return path + " updated"',
      '',
      'def run_command(command):',
      '    return "ok"',
      '',
      'TOOLS = [',
      '    tool_definition("read_file", "Read a file",',
      '                {"path": {"type": "string"}}),',
      '    tool_definition("edit_file", "Edit a file",',
      '                {"path": {"type": "string"}, "old": {"type": "string"},',
      '                 "new": {"type": "string"}}),',
      '    tool_definition("run_command", "Run a command",',
      '                {"command": {"type": "string"}}),',
      ']',
      'FUNCTIONS = {"read_file": read_file, "edit_file": edit_file,',
      '             "run_command": run_command}',
      'SYSTEM = "Read files before answering about their contents."',
      '',
      'if __name__ == "__main__":',
      '    print(run_agent(SYSTEM,',
      '        "What does config.yaml set?", TOOLS, FUNCTIONS)[0])',
    ],
  },
};

const $ = (id) => document.getElementById(id);

const els = {
  select: $('chapterSelect'),
  grid: $('mainGrid'),
  closing: $('closingPanel'),
  codeBody: $('codeBody'),
  codePre: $('codePre'),
  codeFile: $('codeFile'),
  codeCaption: $('codeCaption'),
  stack: $('cardStack'),
  tokens: $('tokenCount'),
  world: $('worldBody'),
  chTitle: $('chTitle'),
  chapterEyebrow: $('chapterEyebrow'),
  lessonLaw: $('lessonLaw'),
  lessonHint: $('lessonHint'),
  chPrev: $('chPrev'),
  chNext: $('chNext'),
  progressFill: $('progressFill'),
  toc: $('toc'),
  narrStack: $('narrStack'),
  liveText: $('liveText'),
  choiceBox: $('choiceBox'),
  back: $('backBtn'),
  next: $('nextBtn'),
  play: $('playBtn'),
  speed: $('speedSlider'),
  indicator: $('stepIndicator'),
  runtime: document.querySelector('.runtime'),
  archBtn: $('archBtn'),
  archSheet: $('archSheet'),
  archVeil: $('archVeil'),
  archClose: $('archClose'),
  archTitle: $('archTitle'),
  archPoint: $('archPoint'),
  archMap: $('archMap'),
  archMapOnce: $('archMapOnce'),
  archMapTool: $('archMapTool'),
  archMapLoop: $('archMapLoop'),
  archMapWork: $('archMapWork'),
  archMapSaved: $('archMapSaved'),
  archMapAgents: $('archMapAgents'),
  archMapChoose: $('archMapChoose'),
  archLegend: $('archLegend'),
  archModelName: $('archModelName'),
  archModelSub: $('archModelSub'),
  archProgSub: $('archProgSub'),
  archMsgSub: $('archMsgSub'),
  archWorldSub: $('archWorldSub'),
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* State. */
let chapter = null;      // loaded trace
let idx = 0;             // main flow steps applied so far
let trail = [];          // every applied card, in order: {kind: 'main'|'dead', step}
let choosing = null;     // choice step waiting for a pick
let pendingChoice = null; // choice step to return to after a dead end
let playing = false;
let timer = null;
let speed = 1;
let tokens = 0;
let instant = false;     // true while restoring from the URL hash
let deadEndText = null;  // dead-end message while a wrong pick is showing

const TRACE_CACHE = {};

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));
}

const PY_KEYWORDS = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from',
  'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not',
  'or', 'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield',
]);

const PY_BUILTINS = new Set([
  'dict', 'float', 'int', 'len', 'list', 'print', 'range', 'str', 'sum',
  'tuple', 'type',
]);

/* Line highlighter for the samples. Not a full Python parser.
   Strings in these files do not span lines. */
function highlightPython(line) {
  let i = 0;
  const n = line.length;
  let html = '';
  let prev = '';

  const emit = (cls, text) => {
    if (!text) return;
    html += cls
      ? '<span class="' + cls + '">' + escapeHtml(text) + '</span>'
      : escapeHtml(text);
  };

  const stringAt = (from) => {
    const m = /^(?:[rRuUbB]|[fF][rR]?|[rR][fF]|[bB][rR]|[rR][bB])?("""|'''|"|')/.exec(line.slice(from));
    return m ? { raw: m[0], quote: m[1], prefix: m[0].slice(0, m[0].length - m[1].length) } : null;
  };

  const skipString = (from, start) => {
    let pos = from + start.raw.length;
    while (pos < n) {
      if (line.startsWith(start.quote, pos)) return pos + start.quote.length;
      if (line[pos] === '\\' && pos + 1 < n) { pos += 2; continue; }
      pos += 1;
    }
    return n;
  };

  const readFExpr = (from) => {
    let pos = from + 1;
    let depth = 1;
    while (pos < n && depth) {
      const start = stringAt(pos);
      if (start) { pos = skipString(pos, start); continue; }
      if (line[pos] === '{') depth += 1;
      else if (line[pos] === '}') depth -= 1;
      if (depth) pos += 1;
    }
    return pos;
  };

  const readString = () => {
    const start = stringAt(i);
    const isF = /f/i.test(start.prefix);
    let pos = i + start.prefix.length + start.quote.length;
    let out = '';
    if (start.prefix) out += '<span class="tok-str">' + escapeHtml(start.prefix) + '</span>';
    out += '<span class="tok-str">' + escapeHtml(start.quote);
    while (pos < n) {
      if (line.startsWith(start.quote, pos)) {
        out += escapeHtml(start.quote) + '</span>';
        pos += start.quote.length;
        break;
      }
      if (line[pos] === '\\' && pos + 1 < n) {
        out += escapeHtml(line.slice(pos, pos + 2));
        pos += 2;
        continue;
      }
      if (isF && line[pos] === '{') {
        if (line[pos + 1] === '{') { out += '{{'; pos += 2; continue; }
        const end = readFExpr(pos);
        const inner = line.slice(pos + 1, end < n && line[end] === '}' ? end : n);
        out += '</span><span class="tok-brace">{</span>';
        out += highlightPython(inner);
        if (end < n && line[end] === '}') {
          out += '<span class="tok-brace">}</span>';
          pos = end + 1;
        } else {
          pos = n;
        }
        out += '<span class="tok-str">';
        continue;
      }
      if (isF && line[pos] === '}' && line[pos + 1] === '}') {
        out += '}}';
        pos += 2;
        continue;
      }
      out += escapeHtml(line[pos]);
      pos += 1;
    }
    if (!out.endsWith('</span>')) out += '</span>';
    i = pos;
    return out;
  };

  while (i < n) {
    const c = line[i];
    if (c === ' ' || c === '\t') {
      let j = i + 1;
      while (j < n && (line[j] === ' ' || line[j] === '\t')) j += 1;
      emit('', line.slice(i, j));
      i = j;
      continue;
    }
    if (c === '#') {
      emit('tok-cm', line.slice(i));
      break;
    }
    if (stringAt(i)) {
      html += readString();
      prev = '';
      continue;
    }
    if (c >= '0' && c <= '9') {
      const m = /^[0-9][0-9_]*(?:\.[0-9][0-9_]*)?/.exec(line.slice(i));
      emit('tok-num', m[0]);
      i += m[0].length;
      prev = '';
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(i));
      const name = m[0];
      let cls = '';
      if (PY_KEYWORDS.has(name)) cls = 'tok-kw';
      else if (PY_BUILTINS.has(name)) cls = 'tok-bi';
      else if (prev === 'def') cls = 'tok-fn';
      else if (/^[A-Z][A-Z0-9_]+$/.test(name)) cls = 'tok-const';
      emit(cls, name);
      i += name.length;
      prev = name;
      continue;
    }
    emit('', c);
    i += 1;
    prev = '';
  }
  return html;
}

/* Traces load over fetch when served. From disk, fetch fails and the
   inlined copy in traces/embedded.js is used instead. */
async function loadTrace(id) {
  if (TRACE_CACHE[id]) return TRACE_CACHE[id];
  /* Opened from disk, fetch cannot run: go straight to the inlined copy. */
  if (window.location.protocol !== 'file:') {
    try {
      const res = await fetch('traces/' + id + '.json', { cache: 'no-store' });
      if (res.ok) {
        TRACE_CACHE[id] = await res.json();
        return TRACE_CACHE[id];
      }
    } catch (err) { /* fall through to the inlined copy */ }
  }
  if (window.EMBEDDED_TRACES && window.EMBEDDED_TRACES[id]) {
    TRACE_CACHE[id] = window.EMBEDDED_TRACES[id];
    return TRACE_CACHE[id];
  }
  throw new Error('Missing trace: ' + id);
}

/* Left pane: the code, one line lit. */
function renderCode(activeLine) {
  const sample = CODE_SAMPLES[chapter ? chapter.code : 'one_call'] || CODE_SAMPLES.one_call;
  els.codeFile.textContent = sample.file;
  els.codeCaption.textContent = sample.caption;
  if (!sample._hi) sample._hi = sample.lines.map(highlightPython);
  els.codeBody.innerHTML = sample.lines.map((ln, i) => {
    const n = i + 1;
    const cls = n === activeLine ? 'ln active' : 'ln';
    return '<span class="' + cls + '"><span class="gut">' + n + '</span>' + sample._hi[i] + '</span>';
  }).join('');
  els.codePre.setAttribute('aria-label', activeLine
    ? 'Python example. Line ' + activeLine + ' is highlighted.'
    : 'Python example.');
  fitCode();
}

let fitFrame = 0;

/* On desktop, reduce the code size until every line fits. */
function fitCode() {
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(() => {
    const pre = els.codePre;
    pre.style.fontSize = '';
    if (window.innerWidth <= 920 || pre.clientHeight < 80) return;

    let size = 12;
    pre.style.fontSize = size + 'px';
    while (size > 7.5 &&
      (pre.scrollHeight > pre.clientHeight + 1 ||
       pre.scrollWidth > pre.clientWidth + 1)) {
      size -= 0.25;
      pre.style.fontSize = size + 'px';
    }
  });
}

function lightNode(node, author) {
  const phase = node === 'think' && author && author !== 'model'
    ? 'read'
    : node;
  document.querySelectorAll('[data-phase]').forEach((el) => {
    el.classList.toggle('active', el.dataset.phase === phase);
  });
  document.body.dataset.phase = phase || 'idle';
}

function tokensFor(s) {
  return s.tokens != null ? s.tokens : 4 + Math.ceil((s.text || '').length / 4);
}

function updateTokenReadout() {
  els.tokens.textContent = tokens.toLocaleString('en-US') + ' tokens';
}

/* Center pane: one card per step. */
function addCard(s) {
  const el = document.createElement('article');
  el.className = 'card ' + s.author;
  const head = document.createElement('div');
  head.className = 'cardHead';
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = s.label;
  head.appendChild(chip);
  const body = document.createElement('div');
  body.className = 'cardBody';
  let html = escapeHtml(s.text || '');
  if (s.highlight) {
    const h = escapeHtml(s.highlight);
    html = html.replace(h, '<mark class="false">' + h + '</mark>');
  }
  body.innerHTML = html;
  el.appendChild(head);
  el.appendChild(body);
  el._step = s;
  if (instant || reducedMotion) el.style.animation = 'none';
  els.stack.appendChild(el);
  tokens += tokensFor(s);
  updateTokenReadout();
  els.stack.scrollTop = els.stack.scrollHeight;
}

/* Rebuild the message list from the recorded steps.
   A summary step clears the older messages first. */
function rebuildCards() {
  const wasInstant = instant;
  instant = true;
  els.stack.innerHTML = '';
  tokens = 0;
  for (const h of trail) {
    if (h.step.collapse) {
      els.stack.innerHTML = '';
      tokens = 0;
    }
    addCard(h.step);
  }
  instant = wasInstant;
  updateTokenReadout();
}

/* Right pane: the world is recomputed from the applied steps,
   so Back always restores the correct picture. */
function replayWorld() {
  if (!chapter) return;
  const w = JSON.parse(JSON.stringify(chapter.world || { scene: 'none' }));
  for (const h of trail) {
    const s = h.step;
    if (s.set) Object.assign(w, JSON.parse(JSON.stringify(s.set)));
    if (s.add) {
      for (const k of Object.keys(s.add)) {
        w[k] = (w[k] || []).concat(s.add[k]);
      }
    }
  }
  renderScene(w);
}

function renderScene(w) {
  if (w.scene === 'single_tool') return renderSingleTool(w);
  if (w.scene === 'files') return renderFiles(w);
  if (w.scene === 'meter') return renderMeter(w);
  if (w.scene === 'memory') return renderMemory(w);
  if (w.scene === 'multiagent') return renderMultiAgent(w);
  els.world.innerHTML =
    '<p class="worldCap">Result</p>' +
    '<div class="idleWorld">No tools have run. The next lessons change files and saved data.</div>';
}

/* One tool call, executed once. */
function renderSingleTool(w) {
  const state = w.status || 'ready';
  const stateText = state === 'done' ? 'Complete' : state === 'requested' ? 'Requested' : 'Ready';
  const input = w.input
    ? '<div class="toolDatum"><span>arguments</span><code>' +
        escapeHtml(JSON.stringify(w.input)) + '</code></div>'
    : '';
  const result = w.result
    ? '<div class="toolDatum result"><span>return value</span><code>' +
        escapeHtml(JSON.stringify(w.result)) + '</code></div>'
    : '';
  els.world.innerHTML =
    '<p class="worldCap">Python function</p>' +
    '<div class="singleTool">' +
      '<div class="toolFunction"><span>function</span><code>get_weather(city)</code></div>' +
      '<div class="toolRunState ' + escapeHtml(state) + '">' +
        '<span>program status</span><strong>' + stateText + '</strong>' +
      '</div>' +
      input + result +
    '</div>' +
    '<div class="noLoopCount"><b>1</b> model call <b>1</b> function <b>no</b> loop</div>';
}

/* A file tree and terminal for coding tasks. */
function renderFiles(w) {
  const files = (w.files || []).map((f) =>
    '<div class="fileRow">' +
      '<span class="fileDot ' + (f.status || '') + '"></span>' +
      '<span class="fileName">' + escapeHtml(f.name) + '</span>' +
      (f.status ? '<span class="fileStatus">' + escapeHtml(f.status) + '</span>' : '') +
    '</div>'
  ).join('');
  const lines = (w.term || []).map((l) => {
    const line = typeof l === 'string' ? { t: l, cls: '' } : l;
    return '<div class="tline ' + (line.cls || '') + '">' + escapeHtml(line.t) + '</div>';
  }).join('');
  els.world.innerHTML =
    '<p class="worldCap">Your project</p>' +
    '<div class="fileTree" aria-label="Files on disk">' + files + '</div>' +
    '<div class="term" aria-label="Terminal">' +
      (lines || '<div class="tline dim">$ waiting</div>') +
    '</div>';
}

/* Message size before and after a summary. */
function renderMeter(w) {
  const max = w.max || 200000;
  const used = w.used || 0;
  const pct = Math.min(100, (used / max) * 100);
  const danger = pct > 60 ? ' danger' : '';
  els.world.innerHTML =
    '<p class="worldCap">Message size</p>' +
    '<div class="meterNum">' + used.toLocaleString('en-US') +
      '<span> of ' + max.toLocaleString('en-US') + ' tokens</span></div>' +
    '<div class="meterBar" role="img" aria-label="Message size is ' + Math.round(pct) + ' percent of the limit">' +
      '<div class="meterFill' + danger + '" style="width: ' + pct.toFixed(1) + '%"></div>' +
    '</div>' +
    '<div class="meterNote">Summarize after 150,000 tokens</div>';
}

/* A database keeps facts after the message list is gone. */
function renderMemory(w) {
  const records = (w.records || []).map((record) =>
    '<div class="memoryRecord">' +
      '<span>' + escapeHtml(record.key) + '</span>' +
      '<strong>' + escapeHtml(record.value) + '</strong>' +
    '</div>'
  ).join('');
  els.world.innerHTML =
    '<p class="worldCap">Saved memory</p>' +
    '<div class="memoryStore">' +
      '<div class="memoryStoreHead">' +
        '<strong>memory.db</strong><span>kept between runs</span>' +
      '</div>' +
      (records || '<div class="memoryEmpty">No saved records</div>') +
    '</div>' +
    '<div class="memorySession">' +
      '<span>run ' + escapeHtml(w.session || 1) + '</span>' +
      '<code>' + (w.query ? 'recall("' + escapeHtml(w.query) + '")' : 'no key yet') + '</code>' +
    '</div>';
}

/* Each child is a full run_agent call. The parent list only gets the return value. */
function renderMultiAgent(w) {
  const agents = (w.agents || []).map((agent) => {
    const initial = escapeHtml((agent.name || '?').slice(0, 1).toUpperCase());
    return '<div class="agentUnit ' + escapeHtml(agent.status || 'idle') + '">' +
      '<span class="agentAvatar">' + initial + '</span>' +
      '<span class="agentIdentity"><strong>' + escapeHtml(agent.name) + '</strong>' +
        '<small>' + escapeHtml(agent.role || '') + '</small></span>' +
      '<span class="agentState">' + escapeHtml(agent.status || 'idle') + '</span>' +
    '</div>';
  }).join('');
  const events = (w.events || []).map((event) =>
    '<div class="delegateEvent">' + escapeHtml(event) + '</div>'
  ).join('');
  els.world.innerHTML =
    '<p class="worldCap">Separate loops</p>' +
    '<div class="agentRoster">' + agents + '</div>' +
    '<div class="delegateLog">' +
      (events || '<div class="memoryEmpty">No child has run yet</div>') +
    '</div>';
}

function renderLessonNote(note) {
  if (!note || !note.text) return '';
  const href = String(note.href || '');
  if (!/^https:\/\//.test(href)) {
    return '<p class="lessonNote">' + escapeHtml(note.text) + '</p>';
  }
  const label = note.link || 'Learn more';
  return '<p class="lessonNote">' + escapeHtml(note.text) +
    ' <a href="' + escapeHtml(href) + '" target="_blank" rel="noreferrer">' +
    escapeHtml(label) + '</a>.</p>';
}

/* Keep the chapter premise small and emphasize the current step. */
function rebuildNarration() {
  if (!chapter || chapter.id === 'closing') return;
  const previousStep = els.narrStack.dataset.step || '';
  const current = trail.length ? trail[trail.length - 1].step : null;
  let text = current && current.narration ? current.narration : chapter.intro;
  if (choosing) text = choosing.prompt || 'Pick the next message.';
  if (deadEndText) text = deadEndText;

  const stepKey = String(idx) + ':' + (choosing ? 'choice' : deadEndText ? 'dead' : 'step');
  const meta = choosing
    ? 'Pick a message'
    : deadEndText
      ? 'That choice does not work'
      : current
        ? 'Step ' + idx + ' of ' + chapter.steps.length + ': ' + current.label
        : 'Overview';
  const leadClass = current || choosing || deadEndText ? 'lessonLead compact' : 'lessonLead';

  els.narrStack.innerHTML =
    '<p class="' + leadClass + '">' + escapeHtml(chapter.intro) + '</p>' +
    (current || choosing || deadEndText
      ? '<div class="lessonStep">' +
          '<div class="lessonStepMeta">' + escapeHtml(meta) + '</div>' +
          '<p class="narr cur">' + escapeHtml(text) + '</p>' +
          renderLessonNote(current && current.note) +
        '</div>'
      : '');

  const now = els.narrStack.querySelector('.narr.cur') || els.narrStack.querySelector('.lessonLead');
  if (now) {
    if (stepKey !== previousStep && !instant && !reducedMotion) now.classList.add('fresh');
    els.liveText.textContent = now.textContent;
  }
  els.narrStack.dataset.step = stepKey;
  els.narrStack.scrollTop = els.narrStack.scrollHeight;
}

function lastMain() {
  for (let i = trail.length - 1; i >= 0; i--) {
    if (trail[i].kind === 'main') return trail[i];
  }
  return null;
}

function tailIsDead() {
  return trail.length > 0 && trail[trail.length - 1].kind === 'dead';
}

function canNext() {
  return !!chapter && !choosing && !tailIsDead() && idx < chapter.steps.length;
}

function chapterIndex() {
  return chapter ? CHAPTERS.findIndex((c) => c.id === chapter.id) : -1;
}

function nextChapterId() {
  const i = chapterIndex();
  return i >= 0 && i + 1 < CHAPTERS.length ? CHAPTERS[i + 1].id : null;
}

function prevChapterId() {
  const i = chapterIndex();
  return i > 0 ? CHAPTERS[i - 1].id : null;
}

function architectureOpen() {
  return !!(els.runtime && els.runtime.classList.contains('archOpen'));
}

function setArchitectureOpen(open) {
  if (!els.runtime || !els.archBtn || !els.archSheet) return;
  const next = !!open && chapter && chapter.id !== 'closing';
  els.runtime.classList.toggle('archOpen', next);
  els.archBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
  els.archBtn.setAttribute('aria-label', next ? 'Hide architecture' : 'Show architecture');
  els.archSheet.setAttribute('aria-hidden', next ? 'false' : 'true');
  if (els.archVeil) els.archVeil.setAttribute('aria-hidden', next ? 'false' : 'true');
}

function architectureHot() {
  if (choosing) return ['model'];
  const last = trail[trail.length - 1];
  const spec = chapter ? ARCHITECTURES[chapter.id] : null;
  if (!last) {
    if (spec && spec.layout === 'saved') return ['run1', 'messages'];
    if (spec && spec.layout === 'agents') return ['parent'];
    if (spec && spec.layout === 'choose') return ['program'];
    if (spec && spec.layout === 'flow') return ['messages'];
    return ['messages'];
  }
  const step = last.step;
  if (spec && spec.layout === 'tool') {
    if (step.node === 'act') return ['model'];
    if (step.node === 'none') return ['world'];
    return ['messages', 'call', 'program'];
  }
  if (spec && spec.layout === 'flow') {
    if (step.node === 'act') return ['model', 'run'];
    if (step.node === 'observe') return ['run', 'loop', 'program'];
    if (step.node === 'think' && step.author === 'model') return ['model', 'stop'];
    return ['messages', 'call', 'program'];
  }
  if (spec && spec.layout === 'work') {
    if (step.node === 'observe') return ['messages', 'append'];
    return ['messages', 'call', 'model'];
  }
  if (spec && spec.layout === 'saved') {
    const second = trail.some((h) => h.step.collapse);
    if (step.node === 'act') return second ? ['recall', 'store'] : ['remember', 'store'];
    if (step.node === 'observe') {
      return second ? ['store', 'run2', 'fresh'] : ['store', 'run1', 'messages'];
    }
    if (second) return ['run2', 'fresh'];
    return ['run1', 'messages'];
  }
  if (spec && spec.layout === 'agents') {
    const text = step.text || '';
    const acts = trail.filter((h) => h.step.node === 'act');
    const lastAct = acts.length ? acts[acts.length - 1].step.text || '' : '';
    const coder = text.includes('coder') || lastAct.includes('coder');
    if (step.node === 'act') return coder ? ['child', 'coder'] : ['child', 'researcher'];
    if (step.node === 'observe') {
      return coder ? ['coder', 'parent'] : ['researcher', 'parent'];
    }
    return ['parent'];
  }
  if (spec && spec.layout === 'choose') {
    if (step.node === 'act') return ['model', 'tools'];
    if (step.node === 'observe') return ['tools'];
    if (step.author === 'model') return ['model'];
    return ['program', 'call'];
  }
  if (step.node === 'none') return ['program', 'world'];
  if (step.node === 'act') {
    const hot = ['program', 'world', 'run'];
    if (chapter && chapter.id === 'ch8') hot.push('child');
    return hot;
  }
  if (step.node === 'observe') {
    if (chapter && chapter.id === 'ch8') return ['messages', 'child', 'append'];
    return ['messages', 'world', 'append'];
  }
  if (step.node === 'think' && step.author === 'model') {
    const hot = ['model'];
    if (chapter && (chapter.id === 'loop' || chapter.id === 'ch6' || chapter.id === 'ch8') &&
        trail.length === chapter.steps.length) {
      hot.push('loop');
    }
    return hot;
  }
  return ['messages', 'call'];
}

function syncArchitecture() {
  if (!els.archMap || !els.archBtn) return;
  const id = chapter ? chapter.id : '';
  const spec = ARCHITECTURES[id];
  if (!spec || id === 'closing') {
    els.archBtn.hidden = true;
    setArchitectureOpen(false);
    return;
  }
  els.archBtn.hidden = false;
  if (els.archTitle) {
    const meta = CHAPTERS.find((c) => c.id === id);
    els.archTitle.textContent = meta ? meta.title : '';
  }
  if (els.archPoint) els.archPoint.textContent = spec.point;
  if (els.archModelName) els.archModelName.textContent = spec.modelName;
  if (els.archModelSub) els.archModelSub.textContent = spec.modelSub;
  if (els.archProgSub) els.archProgSub.textContent = spec.progSub;
  if (els.archMsgSub) els.archMsgSub.textContent = spec.msgSub;
  if (els.archWorldSub) els.archWorldSub.textContent = spec.worldSub;

  const layout = spec.layout || 'machine';
  if (els.archSheet) {
    els.archSheet.classList.toggle('onceLayout', layout === 'once' || layout === 'tool' || layout === 'choose');
    els.archSheet.classList.toggle('toolLayout', layout === 'tool');
    els.archSheet.classList.toggle('loopLayout', layout === 'flow');
    els.archSheet.classList.toggle('workLayout', layout === 'work');
    els.archSheet.classList.toggle('savedLayout', layout === 'saved');
    els.archSheet.classList.toggle('agentsLayout', layout === 'agents');
  }
  if (els.archMap) els.archMap.hidden = layout !== 'machine';
  if (els.archMapOnce) els.archMapOnce.hidden = layout !== 'once';
  if (els.archMapTool) els.archMapTool.hidden = layout !== 'tool';
  if (els.archMapLoop) els.archMapLoop.hidden = layout !== 'flow';
  if (els.archMapWork) els.archMapWork.hidden = layout !== 'work';
  if (els.archMapSaved) els.archMapSaved.hidden = layout !== 'saved';
  if (els.archMapAgents) els.archMapAgents.hidden = layout !== 'agents';
  if (els.archMapChoose) els.archMapChoose.hidden = layout !== 'choose';
  if (els.archLegend) els.archLegend.hidden = layout !== 'machine';

  const on = new Set(spec.on || []);
  const off = new Set(spec.off || []);
  const hide = new Set(spec.hide || []);
  const cut = new Set(spec.cut || []);
  const emph = new Set(spec.emph || []);
  const hot = new Set(architectureHot());
  if ((layout === 'once' || layout === 'tool') && hot.has('call')) hot.add('program');

  const map = layout === 'once' ? els.archMapOnce
    : layout === 'tool' ? els.archMapTool
      : layout === 'flow' ? els.archMapLoop
        : layout === 'work' ? els.archMapWork
          : layout === 'saved' ? els.archMapSaved
            : layout === 'agents' ? els.archMapAgents
              : layout === 'choose' ? els.archMapChoose
                : els.archMap;
  if (!map) return;
  map.querySelectorAll('[data-arch]').forEach((el) => {
    const key = el.dataset.arch;
    el.classList.toggle('hide', hide.has(key));
    el.classList.toggle('off', off.has(key) || (cut.has(key) && key !== 'loop'));
    el.classList.toggle('cut', cut.has(key));
    el.classList.toggle('emph', emph.has(key));
    el.classList.toggle('hot', hot.has(key) && !hide.has(key) && !off.has(key) && !cut.has(key));
  });
}

function updateChrome() {
  const canGoBack = trail.length > 0 || !!choosing || !!prevChapterId();
  const canGoNext = canNext() || (!choosing && !tailIsDead() && !!nextChapterId());
  els.back.disabled = !canGoBack;
  els.next.disabled = !canGoNext;
  els.play.disabled = !canGoNext;
  els.chPrev.disabled = !prevChapterId();
  els.chNext.disabled = !nextChapterId();
  els.indicator.textContent = chapter && chapter.steps && chapter.steps.length
    ? 'Step ' + idx + ' of ' + chapter.steps.length
    : '';
  if (els.lessonHint) {
    els.lessonHint.textContent = choosing
      ? 'Pick the next message. The program will run any tool you request.'
      : tailIsDead()
        ? 'Press Rewind, then pick another message.'
        : idx === 0
          ? 'Press Next to take one step.'
          : 'Press Next for the next step.';
  }
  updateProgress();
  syncArchitecture();
  if (chapter) {
    /* Keep the bare URL bare until the reader actually moves. */
    const atStart = chapter.id === 'ch1' && idx === 0;
    window.history.replaceState(null, '', atStart
      ? window.location.pathname
      : '#ch=' + chapter.id + '&step=' + idx);
  }
}

/* Progress across the whole walkthrough. */
function updateProgress() {
  if (!chapter) return;
  let total = 0;
  let done = 0;
  for (const c of CHAPTERS) {
    const len = c.id === 'closing' ? 0 : (TRACE_CACHE[c.id] ? TRACE_CACHE[c.id].steps.length : 0);
    if (chapter && c.id === chapter.id) done = total + idx;
    total += len;
  }
  const frac = !total ? 1 : (chapter.id === 'closing' ? 1 : done / total);
  els.progressFill.style.width = (frac * 100).toFixed(1) + '%';
}

function applyStep(s, kind) {
  trail.push({ kind: kind || 'main', step: s });
  if (!kind || kind === 'main') idx++;
  lightNode(s.node === 'none' ? null : s.node, s.author);
  renderCode(s.codeLine);
  if (s.collapse) {
    /* Replace the older messages with a summary. */
    els.stack.innerHTML = '';
    tokens = 0;
  }
  addCard(s);
  replayWorld();
  rebuildNarration();
  updateChrome();
}

let busy = false;

/* Forward flows straight into the next chapter, like a scroll. */
async function stepForward() {
  if (busy) return;
  if (canNext()) {
    const s = chapter.steps[idx];
    if (s.choices) {
      enterChoice(s);
      return;
    }
    applyStep(s, 'main');
    return;
  }
  if (!choosing && !tailIsDead() && nextChapterId()) {
    busy = true;
    await loadChapter(nextChapterId(), 0, playing);
    busy = false;
  }
}

function restoreAfterBack() {
  const lm = lastMain();
  if (lm) {
    lightNode(lm.step.node === 'none' ? null : lm.step.node, lm.step.author);
    renderCode(lm.step.codeLine);
  } else {
    lightNode(null);
    renderCode(0);
  }
  rebuildNarration();
  replayWorld();
}

/* Back at the start of a chapter returns to the end of the previous one. */
async function back() {
  if (busy) return;
  stopPlay();
  if (choosing) {
    choosing = null;
    pendingChoice = null;
    els.choiceBox.hidden = true;
    els.choiceBox.innerHTML = '';
  }
  if (trail.length === 0) {
    const p = prevChapterId();
    if (p) {
      busy = true;
      await loadChapter(p, Infinity);
      busy = false;
    } else {
      updateChrome();
    }
    return;
  }
  const last = trail.pop();
  if (last.kind === 'main') idx--;
  if (!tailIsDead()) deadEndText = null;
  rebuildCards();
  restoreAfterBack();
  updateChrome();
}

/* Chapter 7: the reader picks the next move from a menu. */
function enterChoice(s) {
  choosing = s;
  pendingChoice = s;
  lightNode('think', 'model');
  rebuildNarration();
  els.choiceBox.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'choices';
  s.choices.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.innerHTML = '<span class="num" aria-hidden="true">' + (i + 1) + '</span>' + escapeHtml(c.text);
    b.addEventListener('click', () => pickChoice(i));
    list.appendChild(b);
  });
  els.choiceBox.appendChild(list);
  els.choiceBox.hidden = false;
  updateChrome();
}

function pickChoice(i) {
  const s = choosing;
  if (!s) return;
  const c = s.choices[i];
  if (!c) return;
  if (c.correct) {
    choosing = null;
    pendingChoice = null;
    els.choiceBox.hidden = true;
    els.choiceBox.innerHTML = '';
    applyStep(s, 'main');
    return;
  }
  /* Add the selected message. Rewind returns to the choice. */
  choosing = null;
  els.choiceBox.innerHTML = '';
  const act = { node: 'act', author: 'model', label: s.label, text: c.text, dead: true };
  applyStep(act, 'dead');
  deadEndText = c.deadend;
  rebuildNarration();
  const rw = document.createElement('button');
  rw.className = 'rewind';
  rw.textContent = 'Rewind';
  rw.addEventListener('click', rewind);
  els.choiceBox.appendChild(rw);
  els.choiceBox.hidden = false;
  rw.focus();
  updateChrome();
}

function rewind() {
  while (trail.length && trail[trail.length - 1].kind === 'dead') {
    trail.pop();
  }
  deadEndText = null;
  els.choiceBox.hidden = true;
  els.choiceBox.innerHTML = '';
  rebuildCards();
  restoreAfterBack();
  if (pendingChoice) enterChoice(pendingChoice);
  updateChrome();
}

/* Play advances through the course and pauses at choices.
   Start the first step when the user selects Play. */
async function tick() {
  if (choosing || tailIsDead()) {
    stopPlay();
    return;
  }
  if (canNext()) {
    await stepForward();
    return;
  }
  if (!nextChapterId()) {
    stopPlay();
    return;
  }
  await loadChapter(nextChapterId(), 0, true);
}

async function play() {
  if (playing) {
    stopPlay();
    return;
  }
  if (els.next.disabled) return;
  playing = true;
  els.play.textContent = 'Pause';
  await tick();
  if (playing) {
    timer = setInterval(tick, Math.round(2000 / speed));
  }
}

function stopPlay() {
  playing = false;
  clearInterval(timer);
  els.play.textContent = 'Play';
}

async function loadChapter(id, targetStep, keepPlaying) {
  if (!keepPlaying) stopPlay();
  trail = [];
  idx = 0;
  tokens = 0;
  choosing = null;
  pendingChoice = null;
  deadEndText = null;
  els.stack.innerHTML = '';
  updateTokenReadout();
  els.choiceBox.hidden = true;
  els.choiceBox.innerHTML = '';
  els.select.value = id;
  document.body.classList.toggle('isClosing', id === 'closing');

  if (id === 'closing') {
    chapter = { id: 'closing', steps: [] };
    els.grid.hidden = true;
    els.closing.hidden = false;
  } else {
    els.grid.hidden = false;
    els.closing.hidden = true;
    chapter = await loadTrace(id);
  }

  const meta = CHAPTERS.find((c) => c.id === id);
  if (meta) {
    els.chTitle.textContent = meta.title;
    els.chapterEyebrow.textContent = 'Lesson ' + meta.num + ' of ' + CHAPTERS.length;
    els.lessonLaw.textContent = CHAPTER_LAWS[id] || CHAPTER_LAWS.ch1;
  }
  updateToc();

  if (id === 'closing') {
    updateChrome();
    return;
  }

  rebuildNarration();
  lightNode(null);
  renderCode(0);
  replayWorld();
  updateChrome();

  if (targetStep > 0) {
    instant = true;
    while (idx < Math.min(targetStep, chapter.steps.length)) {
      /* A correct choice applies the selected step. */
      applyStep(chapter.steps[idx], 'main');
    }
    instant = false;
    els.stack.scrollTop = els.stack.scrollHeight;
    updateChrome();
  }
}

/* The table of contents: every chapter, grouped, clickable. */
function buildToc() {
  els.toc.innerHTML = '';
  for (const g of CHAPTER_GROUPS) {
    const group = document.createElement('div');
    group.className = 'tocGroup';
    const gt = document.createElement('div');
    gt.className = 'tocGroupTitle';
    gt.textContent = g.name;
    group.appendChild(gt);
    for (const c of g.chapters) {
      const b = document.createElement('button');
      b.className = 'tocEntry';
      b.dataset.id = c.id;
      b.innerHTML = '<span class="tocNum" aria-hidden="true">' + c.num + '</span><span class="tocTitle">' + escapeHtml(c.nav || c.title) + '</span>';
      b.addEventListener('click', () => loadChapter(c.id, 0));
      group.appendChild(b);
    }
    els.toc.appendChild(group);
  }
}

function updateToc() {
  els.toc.querySelectorAll('.tocEntry').forEach((el) => {
    const active = chapter && el.dataset.id === chapter.id;
    el.classList.toggle('active', !!active);
    if (active) el.setAttribute('aria-current', 'true');
    else el.removeAttribute('aria-current');
  });
}

async function init() {
  for (const c of CHAPTERS) {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.num + '. ' + c.title;
    els.select.appendChild(o);
  }
  buildToc();
  document.querySelector('.brand').addEventListener('click', (e) => {
    e.preventDefault();
    loadChapter('ch1', 0);
  });
  els.select.addEventListener('change', () => loadChapter(els.select.value, 0));
  els.chPrev.addEventListener('click', () => { const p = prevChapterId(); if (p) loadChapter(p, 0); });
  els.chNext.addEventListener('click', () => { const n = nextChapterId(); if (n) loadChapter(n, 0); });
  els.next.addEventListener('click', () => { stopPlay(); stepForward(); });
  els.back.addEventListener('click', back);
  els.play.addEventListener('click', play);
  els.speed.addEventListener('input', () => {
    speed = parseFloat(els.speed.value);
    if (playing) {
      stopPlay();
      play();
    }
  });
  els.archBtn.addEventListener('click', () => setArchitectureOpen(!architectureOpen()));
  els.archClose.addEventListener('click', () => {
    setArchitectureOpen(false);
    els.archBtn.focus();
  });
  els.archVeil.addEventListener('click', () => setArchitectureOpen(false));

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (e.key === 'Escape' && architectureOpen()) {
      e.preventDefault();
      setArchitectureOpen(false);
      els.archBtn.focus();
      return;
    }
    if (choosing && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      pickChoice(parseInt(e.key, 10) - 1);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === ' ') {
      if (tag === 'button' && e.key === ' ') return;
      e.preventDefault();
      stepForward();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      back();
    }
  });

  /* The hash is user input. An unknown chapter would throw out of init. */
  const cm = window.location.hash.match(/ch=([a-z0-9]+)/i);
  const sm = window.location.hash.match(/step=(\d+)/);
  const wanted = cm && CHAPTERS.some((c) => c.id === cm[1]) ? cm[1] : 'ch1';
  window.addEventListener('resize', fitCode);

  /* Preload every trace so chapter jumps and the progress bar are instant. */
  await Promise.all(CHAPTERS.filter((c) => c.id !== 'closing').map((c) => loadTrace(c.id)));
  await loadChapter(wanted, sm ? parseInt(sm[1], 10) : 0);
}

init();
