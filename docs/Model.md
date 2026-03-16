# AI Model Documentation — Hericle Quality Control System

> **Location:** `backend/app/services/ai_service.py`
> **Last validated:** 2026-03-17

---

## Table of Contents

1. [Model Overview](#1-model-overview)
2. [Model Type & Version](#2-model-type--version)
3. [Model Capabilities](#3-model-capabilities)
4. [How the Model is Used in the System](#4-how-the-model-is-used-in-the-system)
5. [API Call Specifications](#5-api-call-specifications)
6. [Prompt Engineering](#6-prompt-engineering)
7. [Supporting Components](#7-supporting-components)
8. [Offline Fallback Mode](#8-offline-fallback-mode)
9. [Configuration & Setup](#9-configuration--setup)
10. [Cost & Token Analysis](#10-cost--token-analysis)
11. [Known Limitations & Weaknesses](#11-known-limitations--weaknesses)
12. [Improvement Recommendations](#12-improvement-recommendations)

---

## 1. Model Overview

The Hericle system integrates a **Large Language Model (LLM)** provided by **OpenAI** to power its Quality Control (QC) analysis engine. The model evaluates software development tasks against user-defined quality standards, analyzes project roadmaps, generates best practices, and supports interactive QC chat sessions.

The AI layer is entirely contained inside `backend/app/services/ai_service.py` and is consumed by two route modules:

| Route Module | Path prefix | Via |
|---|---|---|
| `qc.py` (primary) | `/api/v1/qc` | `QualityAnalysisService` → `ai_service` |
| `quality.py` (legacy) | `/api/v1/quality` | `ai_service` directly |

---

## 2. Model Type & Version

### Model Name
```
gpt-4o
```

### Model Family
**GPT-4o** ("omni") — OpenAI's flagship multimodal model. The "o" stands for **omni**, meaning the model natively processes both **text and images** in a single unified architecture (no separate vision model).

### Release Information

| Attribute | Value |
|---|---|
| Provider | OpenAI |
| Model ID | `gpt-4o` |
| Family | GPT-4 |
| Variant | Omni (multimodal) |
| Context window | **128,000 tokens** |
| Max output tokens | **4,096 tokens** (default cap; configurable) |
| Training data cutoff | April 2024 |
| API type | Chat Completions (`/v1/chat/completions`) |
| Vision support | YES — inline base64 images |
| Function/tool calling | Supported (not used in this system) |
| JSON mode | Not explicitly enabled; prompts instruct JSON-only output |

### Client Library

```python
from openai import AsyncOpenAI          # async HTTP client
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
```

The system uses **`openai` Python SDK** with the async client (`AsyncOpenAI`), compatible with `openai >= 1.0.0`. The package is **lazy-loaded** at call time — not listed in `requirements.txt`, so it must be installed separately:

```bash
pip install openai
```

---

## 3. Model Capabilities

### 3.1 Text Understanding
GPT-4o reads task titles, descriptions, and attached document content, then reasons over them against natural-language quality rules. It understands context, intent, and technical domain language (software development, UI/UX, API documentation, etc.).

### 3.2 Vision (Image Analysis)
When screenshots, wireframes, or mockups are uploaded to a task, the system encodes them as **base64 JPEG** and sends them directly inside the prompt as `image_url` content blocks with `"detail": "high"`. GPT-4o then identifies:
- UI layout elements (headers, navbars, forms, cards, footers)
- Navigation structures
- Accessibility indicators (contrast, labels)
- Missing visual components noted in quality rules

Up to **3 images per analysis** are sent (hard limit in the code).

### 3.3 Structured JSON Output
The model is instructed via the system prompt to **respond exclusively in a specific JSON schema**. The system then parses this output through a three-stage `_parse_json_safe()` pipeline:
1. Direct `json.loads()`
2. Regex extraction from markdown code blocks (` ```json ... ``` `)
3. Brute-force first `{...}` block match

### 3.4 Web-Augmented Reasoning
Two functions augment their prompts with live web search results from **DuckDuckGo** (no API key required) before calling GPT-4o:
- `analyze_project_roadmap()` — searches for project quality checklists and best practices
- `get_best_practices_for_project()` — searches for current industry best practices by project type

### 3.5 Conversational Memory
`chat_with_analysis()` maintains a short-term conversation history. The last **10 messages** from the conversation log are included in every API call, allowing the model to answer follow-up questions about a specific analysis result.

### 3.6 Trained Pattern Injection
The system supports a "training" workflow where a Quality Manager uploads datasets and triggers a training run (`POST /quality/train`). The extracted patterns are stored in the `quality_model_state` MongoDB collection and injected into every subsequent GPT-4o prompt via `get_learned_patterns(db)`. This effectively gives the model organization-specific quality memory.

---

## 4. How the Model is Used in the System

```
User uploads task + files + screenshots
           │
           ▼
POST /api/v1/qc/tasks/{task_id}/analyze
           │
           ▼
   QualityAnalysisService.run_analysis()
           │
           ├── Fetch quality standards from MongoDB
           │   (quality_standards collection)
           │
           ├── Convert standards → flat rules list
           │   [{ rule: "...", category: "text"|"image"|"file", is_active, weight }]
           │
           ├── Load learned patterns from quality_model_state (if any)
           │
           └── Call ai_service.analyze_task_against_standards()
                         │
                         ├── [API key set?] YES → GPT-4o (gpt-4o)
                         │       ├── Build system prompt (JSON contract)
                         │       ├── Build user prompt (rules + task + files)
                         │       ├── Attach base64 images (if any)
                         │       └── Parse JSON response
                         │
                         └── [API key not set] NO → offline heuristic
                                 └── keyword/length checks (unreliable)
           │
           ▼
   Analysis result stored in MongoDB
   (quality_analyses collection)
           │
           ▼
   REST API / Dashboard reads result
   GET /qc/tasks/{id}/analysis/latest
   GET /qc/analyses
   GET /qc/reports/overview
```

---

## 5. API Call Specifications

All four GPT-4o calls in the system use `client.chat.completions.create()`. Parameters:

### 5.1 Task Quality Analysis — `_online_analyze_task()`

| Parameter | Value |
|---|---|
| `model` | `gpt-4o` |
| `max_tokens` | `2000` |
| `temperature` | `0.3` |
| Vision | YES — up to 3 images, `detail: "high"` |
| File text included | YES — up to 3,000 chars per attached file |
| Response format | JSON object (enforced via prompt) |

**Purpose:** Core quality evaluation. Checks task content against each quality rule and returns a compliance score with pass/fail breakdown.

**Low temperature (0.3)** is intentional — keeps the scoring deterministic and reproducible across re-analyses of the same task.

---

### 5.2 Project Roadmap Analysis — `_online_analyze_roadmap()`

| Parameter | Value |
|---|---|
| `model` | `gpt-4o` |
| `max_tokens` | `1500` |
| `temperature` | `0.4` |
| Vision | NO |
| Web search | YES — DuckDuckGo, 3 results injected into prompt |
| Response format | JSON object |

**Purpose:** Reviews all tasks in a project and identifies missing phases (testing, documentation, deployment), workflow gaps, and improvement opportunities.

---

### 5.3 QC Chat Assistant — `_online_chat_with_analysis()`

| Parameter | Value |
|---|---|
| `model` | `gpt-4o` |
| `max_tokens` | `600` |
| `temperature` | `0.5` |
| Vision | NO |
| Conversation history | Last 10 messages included |
| Response format | Plain text |

**Purpose:** Allows QC engineers and developers to ask follow-up questions about a completed analysis (e.g., "Why did rule X fail?", "How do I fix the accessibility issue?").

**Slightly higher temperature (0.5)** to allow more natural, conversational language.

---

### 5.4 Best Practices Generator — `_online_best_practices()`

| Parameter | Value |
|---|---|
| `model` | `gpt-4o` |
| `max_tokens` | `600` |
| `temperature` | `0.3` |
| Vision | NO |
| Web search | YES — DuckDuckGo, 5 results injected into prompt |
| Response format | JSON array of strings |

**Purpose:** Returns 8 industry best practices tailored to a given project type (e.g., "mobile app", "REST API", "data pipeline"). Web search results are injected to keep recommendations current.

---

### 5.5 Parameter Comparison Table

| Function | model | max_tokens | temperature | Vision | Web Search |
|---|---|---|---|---|---|
| Task Analysis | `gpt-4o` | 2000 | 0.3 | YES (3 imgs) | No |
| Roadmap Analysis | `gpt-4o` | 1500 | 0.4 | No | YES (3 results) |
| QC Chat | `gpt-4o` | 600 | 0.5 | No | No |
| Best Practices | `gpt-4o` | 600 | 0.3 | No | YES (5 results) |

---

## 6. Prompt Engineering

### 6.1 Task Analysis System Prompt

```
You are a Quality Control AI assistant for a project management system.
Your job is to evaluate whether tasks meet defined quality standards.
You must respond ONLY with a valid JSON object. No markdown, no explanation outside JSON.

JSON format:
{
  "compliance_score": <number 0-100>,
  "passed_standards": [
    {"rule": "<rule text>", "result": "<why it passed>"}
  ],
  "failed_standards": [
    {"rule": "<rule text>", "reason": "<why it failed>"}
  ],
  "suggestions": [
    "<actionable improvement tip>"
  ],
  "files_analyzed": [
    {"file_name": "<name>", "analysis_result": "<one sentence result>"}
  ]
}
```

**Design choices:**
- Strict JSON-only contract eliminates prose that breaks downstream parsing
- Inline schema definition reduces ambiguity
- `compliance_score` is 0–100 (not 0–1) for human readability in the dashboard

### 6.2 User Prompt Structure (Task Analysis)

```
{learned_patterns_block}          ← injected from quality_model_state if trained

Quality Standards to check against:
- [TEXT] Rule label and instructions...
- [IMAGE] Rule label and instructions...
- [FILE] Rule label and instructions...

Task Title: {task_title}

Task Description:
{task_description}

File: {file_name}
Content:
{file_content[:3000]}             ← truncated at 3000 chars per file

[base64 image blocks attached separately as image_url content parts]

Evaluate this task against EACH quality standard listed above.
Also apply any learned quality patterns from the trained model above.
Be specific about which rules passed and which failed.
Provide 2-5 actionable improvement suggestions.
```

### 6.3 Quality Rules Format Sent to Model

Rules are converted from the `RuleDefinition` schema to a flat format:

```python
rules_text = "\n".join(
    f"- [{r.get('category', 'general').upper()}] {r.get('rule', '')}"
    for r in standards_rules
    if r.get("is_active", True)
)
```

Each rule is prefixed with its category in brackets (`[TEXT]`, `[IMAGE]`, `[FILE]`, `[GENERAL]`) so the model knows what evidence to look for.

### 6.4 Learned Patterns Injection

When a Quality Manager has run a training session, patterns are prepended:

```
=== TRAINED QUALITY MODEL (v{version}) — LEARNED PATTERNS ===
The Quality Manager has trained the model. Apply these learned quality patterns
FIRST before the standards rules below:
- Pattern 1 extracted from training data
- Pattern 2 extracted from training data
==================================================================
```

---

## 7. Supporting Components

### 7.1 DuckDuckGo Web Search

```python
from duckduckgo_search import DDGS

async def web_search(query: str, max_results: int = 5) -> list:
    def _search():
        with DDGS() as ddgs:
            return list(ddgs.text(query, max_results=max_results))
    loop = asyncio.get_running_loop()
    results = await loop.run_in_executor(None, _search)
```

- **Purpose:** Augments roadmap analysis and best practices with live web context
- **Library:** `duckduckgo_search` (no API key required, free)
- **Execution:** Runs in a thread pool executor (blocking I/O wrapped in async)
- **Error handling:** Silently returns empty list on failure — does not block the AI call

### 7.2 JSON Safety Parser — `_parse_json_safe()`

Because LLMs occasionally wrap JSON in markdown fences or add preamble text, the system uses a three-stage parser:

```python
def _parse_json_safe(text: str) -> dict:
    # Stage 1: Direct parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # Stage 2: Extract from ```json ... ``` markdown block
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass

    # Stage 3: Find first { ... } in the raw string
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    return {}    # empty dict if all stages fail
```

### 7.3 Async OpenAI Client (Lazy Load)

```python
async def _get_openai_client():
    from openai import AsyncOpenAI
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
```

The client is **instantiated on every call** (no singleton). This means no persistent HTTP connection pool, which adds slight overhead but avoids stale connection issues in a long-running FastAPI process.

---

## 8. Offline Fallback Mode

When `OPENAI_API_KEY` is empty or when an API call fails, the system falls back to rule-based heuristics. These are **not AI**; they are deterministic Python functions.

### 8.1 Task Analysis Fallback — `_offline_analyze_task()`

| Rule Category | Logic Applied |
|---|---|
| `text` | Passes if `len(description) > 20` |
| `image` | Always fails — cannot verify images offline |
| `file` | Passes if any `file_texts` were provided |
| `general` | Keyword overlap: ≥30% of rule words found in title+description |

**Scoring:**
```python
score = (len(passed) / total * 100) if total > 0 else 50.0
```

**Known limitation:** The `text` category check (`len > 20`) is too lenient. A 5-word description passes all text rules, giving meaningless 100% scores to low-quality tasks. This is a documented weakness requiring a fix.

### 8.2 Roadmap Analysis Fallback — `_offline_analyze_roadmap()`

Checks for common missing phases by looking for keywords in task titles:
- No "test" → flags missing testing phase
- No "doc" or "readme" → flags missing documentation
- No "deploy" or "release" → suggests adding deployment tasks
- No "review" → suggests code review process
- No "security" or "auth" → suggests security audit
- < 5 tasks → flags project as under-scoped

### 8.3 Best Practices Fallback — `_offline_best_practices()`

Returns a hardcoded list of 8 generic software development best practices. Not project-type-specific beyond string interpolation.

### 8.4 Chat Fallback

Returns a plain string message informing the user the API key is not configured. No AI reasoning is performed.

---

## 9. Configuration & Setup

### 9.1 Required Environment Variable

Add to `backend/.env`:

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 9.2 Required Python Package

```bash
pip install openai
# or add to requirements.txt:
openai>=1.0.0
```

> **Note:** The `openai` package is currently **not in `requirements.txt`**. This is a gap — developers cloning the repo will not have it installed by default.

### 9.3 Settings Class (backend/app/core/config.py)

```python
class Settings(BaseSettings):
    OPENAI_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )
```

### 9.4 API Key Validation

```python
def _is_openai_configured() -> bool:
    return bool(settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip())
```

This check gates every AI call. If the key is an empty string or whitespace-only, the system silently uses the offline fallback without raising an error to the API caller.

---

## 10. Cost & Token Analysis

### 10.1 GPT-4o Pricing (as of 2026)

| Token type | Rate |
|---|---|
| Input tokens | $2.50 per 1M tokens |
| Output tokens | $10.00 per 1M tokens |
| Image tokens (detail: high) | ~$0.001275 per 512×512 tile |

### 10.2 Estimated Tokens Per Operation

| Operation | Est. Input Tokens | Est. Output Tokens | Est. Cost |
|---|---|---|---|
| Task analysis (text only) | ~800 | ~500 | ~$0.007 |
| Task analysis (+ 3 images, detail: high) | ~2,500 + image tiles | ~500 | ~$0.015–$0.025 |
| Roadmap analysis | ~1,200 | ~600 | ~$0.009 |
| QC Chat (1 message) | ~600 | ~200 | ~$0.004 |
| Best practices | ~400 | ~200 | ~$0.003 |

> Estimates based on typical content lengths. Actual costs vary with rule count, description length, and image resolution.

### 10.3 Token Logging Gap

The system does **not currently log token usage** from API responses. Adding this would enable per-project cost tracking:

```python
# response.usage is available after every chat.completions.create() call
analysis_doc["token_usage"] = {
    "prompt_tokens":     response.usage.prompt_tokens,
    "completion_tokens": response.usage.completion_tokens,
    "total_tokens":      response.usage.total_tokens,
}
```

---

## 11. Known Limitations & Weaknesses

| # | Issue | Severity | Location |
|---|---|---|---|
| 1 | `openai` not in `requirements.txt` | High | `requirements.txt` |
| 2 | Offline heuristic gives 100% to all tasks (len > 20 check) | High | `ai_service.py:117` |
| 3 | `weight` field on rules is stored but **never used** in scoring | High | `ai_service.py` |
| 4 | OpenAI client re-instantiated on every call (no singleton pool) | Medium | `_get_openai_client()` |
| 5 | No retry logic on OpenAI API errors (429, 500, timeout) | Medium | `_online_analyze_task()` |
| 6 | Raw GPT response (`_raw`) is dropped before MongoDB storage | Medium | `quality_analysis_service.py` |
| 7 | Analysis runs synchronously inside the request — no background task | Medium | `qc.py` route |
| 8 | Images capped at 3 per analysis (no user-facing error if more sent) | Low | `_online_analyze_task()` |
| 9 | File content truncated at 3,000 chars/file (silently) | Low | `_online_analyze_task()` |
| 10 | Two parallel QC systems split data across two collections | Low | `quality.py` vs `qc.py` |

---

## 12. Improvement Recommendations

### Priority 1 — Fix the offline heuristic (offline scoring accuracy)

Replace the `len() > 20` check with keyword-based rule matching:

```python
STOP_WORDS = {"the", "and", "for", "with", "that", "this", "from", "have", "must", "each"}

rule_keywords = [
    w for w in rule_lower.split()
    if len(w) > 4 and w not in STOP_WORDS
]
matches = sum(1 for kw in rule_keywords if kw in combined)
threshold = max(1, len(rule_keywords) * 0.4)
rule_passed = matches >= threshold
```

---

### Priority 2 — Use rule weights in scoring

The `weight` field already exists in `RuleDefinition`. Use it:

```python
# Weighted compliance score
total_weight = sum(r.get("weight", 1.0) for r in rules)
passed_weight = sum(r.get("weight", 1.0) for r in passed_rules)
score = (passed_weight / total_weight * 100) if total_weight > 0 else 0.0
```

---

### Priority 3 — Add `openai` to requirements.txt

```
# backend/requirements.txt
openai>=1.35.0
duckduckgo-search>=6.0.0
```

---

### Priority 4 — Add retry logic

```python
import asyncio

async def _call_with_retry(coro_fn, max_attempts=3):
    for attempt in range(max_attempts):
        try:
            return await coro_fn()
        except Exception as e:
            if attempt == max_attempts - 1:
                raise
            wait = 2 ** attempt
            await asyncio.sleep(wait)
```

---

### Priority 5 — Chain-of-thought prompting for better scores

Add to the system prompt:

```
Before outputting JSON, reason step-by-step about each rule:
1. State what evidence you found (or did not find) for the rule.
2. Decide pass or fail based on the evidence.
3. Assign a score from 0-100.
Then output the JSON.
```

The reasoning is discarded in the output but improves consistency in the final JSON.

---

### Priority 6 — Introduce rule `check_type` for hybrid analysis

```python
class RuleDefinition(BaseModel):
    label: str
    instructions: Optional[str] = None
    weight: float = 1.0
    # NEW:
    check_type: Literal["presence", "length", "keyword", "regex", "ai"] = "ai"
    min_word_count: Optional[int] = None   # for "length"
    keywords: List[str] = []               # for "keyword"
    pattern: Optional[str] = None          # for "regex"
```

`presence / length / keyword / regex` checks run offline in microseconds. Only `ai` rules consume GPT-4o tokens, reducing cost significantly for simple rules.

---

*Document generated from source analysis of `backend/app/services/ai_service.py`, `backend/app/routes/qc.py`, `backend/app/routes/quality.py`, `backend/app/core/config.py`, `backend/requirements.txt`.*
