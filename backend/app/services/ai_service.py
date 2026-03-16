"""
AI Service for Quality Control analysis using OpenAI API.
Handles text analysis, image analysis, roadmap suggestions, and web search.
Includes offline fallback when OpenAI API is unavailable.
"""
import asyncio
import base64
import json
import re
from datetime import datetime
from typing import List, Optional, Any

from app.core.config import settings
from app.db.collections import AI_MODEL_STATE_COLLECTION


# ---------------------------------------------------------------------------
# Learned Model Patterns — injected from Quality Manager training
# ---------------------------------------------------------------------------

async def get_learned_patterns(db=None) -> str:
    """
    Retrieve patterns learned from the Quality Manager's training datasets.
    Returns formatted text to be injected into the AI analysis prompt.
    """
    if db is None:
        return ""
    try:
        state = await db[AI_MODEL_STATE_COLLECTION].find_one({}, sort=[("created_at", -1)])
        if state and state.get("patterns"):
            patterns_text = "\n".join(f"- {p}" for p in state["patterns"])
            version = state.get("version", "?")
            return (
                f"\n\n=== TRAINED QUALITY MODEL (v{version}) — LEARNED PATTERNS ===\n"
                f"The Quality Manager has trained the model. Apply these learned quality patterns "  
                f"FIRST before the standards rules below:\n{patterns_text}\n"
                f"=================================================================="
            )
    except Exception as e:
        print(f"Could not load learned patterns: {e}")
    return ""


# ---------------------------------------------------------------------------
# OpenAI client
# ---------------------------------------------------------------------------

async def _get_openai_client():
    """Lazy-load the OpenAI async client."""
    try:
        from openai import AsyncOpenAI
        return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    except ImportError:
        raise RuntimeError("openai package not installed. Run: pip install openai")


def _is_openai_configured() -> bool:
    """Check if OpenAI API key is configured."""
    return bool(settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip())


# ---------------------------------------------------------------------------
# Web Search (DuckDuckGo - free, no API key needed)
# ---------------------------------------------------------------------------

async def web_search(query: str, max_results: int = 5) -> list:
    """Perform a web search using DuckDuckGo (free, no API key needed)."""
    try:
        import warnings
        warnings.filterwarnings("ignore", category=RuntimeWarning)
        from duckduckgo_search import DDGS

        def _search():
            with DDGS() as ddgs:
                return list(ddgs.text(query, max_results=max_results))

        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(None, _search)
        return [
            {"title": r.get("title", ""), "body": r.get("body", ""), "url": r.get("href", "")}
            for r in results
        ]
    except Exception as e:
        print(f"Web search error: {e}")
        return []


# ---------------------------------------------------------------------------
# Offline fallback analysis
# ---------------------------------------------------------------------------

def _offline_analyze_task(
    task_title: str,
    task_description: str,
    standards_rules: List[dict],
    file_texts: Optional[List[dict]] = None,
) -> dict:
    """Offline rule-based task analysis when OpenAI is unavailable."""
    passed = []
    failed = []
    suggestions = []
    desc_lower = (task_description or "").lower()
    title_lower = (task_title or "").lower()
    combined = f"{title_lower} {desc_lower}"

    for rule in standards_rules:
        if not rule.get("is_active", True):
            continue
        rule_text = rule.get("rule", "")
        rule_lower = rule_text.lower()
        category = rule.get("category", "general")

        # Simple keyword matching heuristic
        rule_passed = False

        if category == "text":
            # Check if description exists and has reasonable length
            if len(task_description or "") > 20:
                rule_passed = True
            else:
                suggestions.append(f"Add more detail to the task description for rule: {rule_text}")
        elif category == "image":
            # Can't verify images offline
            rule_passed = False
            suggestions.append(f"Image verification required for: {rule_text} (needs online AI)")
        elif category == "file":
            # Check if files were provided
            if file_texts and len(file_texts) > 0:
                rule_passed = True
            else:
                suggestions.append(f"Attach relevant files for: {rule_text}")
        else:
            # General rules - check if key terms from rule exist in description
            keywords = [w for w in rule_lower.split() if len(w) > 3]
            if keywords:
                matches = sum(1 for kw in keywords if kw in combined)
                rule_passed = matches >= len(keywords) * 0.3
            else:
                rule_passed = len(desc_lower) > 10

        if rule_passed:
            passed.append({"rule": rule_text, "result": "Passed (offline check)"})
        else:
            failed.append({"rule": rule_text, "reason": "Could not verify (offline mode)"})

    total = len(passed) + len(failed)
    score = (len(passed) / total * 100) if total > 0 else 50.0

    if not suggestions:
        suggestions.append("For more accurate analysis, ensure OpenAI API key is configured")
        suggestions.append("Review failed standards manually and update task accordingly")

    return {
        "compliance_score": round(score, 1),
        "passed_standards": passed,
        "failed_standards": failed,
        "suggestions": suggestions,
        "files_analyzed": [{"file_name": ft["file_name"], "file_type": ft.get("file_type", "text")} for ft in (file_texts or [])],
        "_raw": "offline_analysis",
        "_mode": "offline",
    }


def _offline_analyze_roadmap(
    project_title: str,
    project_description: str,
    tasks_list: List[str],
) -> dict:
    """Offline roadmap analysis with basic heuristics."""
    issues = []
    suggested_tasks = []
    improvements = []
    best_practices = []

    tasks_lower = [t.lower() for t in tasks_list]
    all_tasks_text = " ".join(tasks_lower)

    # Check for common missing phases
    if not any("test" in t for t in tasks_lower):
        issues.append("No testing tasks detected in the project workflow")
        suggested_tasks.append("Add unit testing and integration testing tasks")
    if not any("doc" in t for t in tasks_lower) and not any("readme" in t for t in tasks_lower):
        issues.append("No documentation tasks found")
        suggested_tasks.append("Add documentation and README creation tasks")
    if not any("deploy" in t for t in tasks_lower) and not any("release" in t for t in tasks_lower):
        suggested_tasks.append("Add deployment and release management tasks")
    if not any("review" in t for t in tasks_lower) and not any("code review" in t for t in tasks_lower):
        improvements.append("Implement code review process for all pull requests")
    if not any("security" in t or "auth" in t for t in tasks_lower):
        improvements.append("Consider adding security audit and vulnerability testing")
    if len(tasks_list) < 5:
        issues.append("Project has very few tasks - consider breaking down into smaller, manageable items")
    if not any("design" in t or "ui" in t or "ux" in t for t in tasks_lower):
        suggested_tasks.append("Add UI/UX design review tasks")

    best_practices = [
        "Follow agile methodology with regular sprint reviews",
        "Implement CI/CD pipeline for automated testing and deployment",
        "Use version control best practices (feature branches, pull requests)",
        "Document API endpoints and architecture decisions",
        "Perform regular code reviews and quality checks",
        "Set up monitoring and error tracking for production",
        "Create backup and disaster recovery procedures",
        "Follow security best practices (OWASP guidelines)",
    ]

    task_count = len(tasks_list)
    assessment = (
        f"Project '{project_title}' has {task_count} tasks. "
        f"{'The workflow appears well-structured.' if task_count >= 10 else 'Consider adding more granular tasks for better tracking.'} "
        f"(Offline analysis - connect to OpenAI for detailed AI-powered insights)"
    )

    return {
        "issues_detected": issues,
        "suggested_tasks": suggested_tasks,
        "workflow_improvements": improvements,
        "best_practices": best_practices,
        "overall_assessment": assessment,
    }


def _offline_best_practices(project_type: str) -> List[str]:
    """Return generic best practices when offline."""
    base = [
        f"Define clear requirements and acceptance criteria for {project_type}",
        "Implement automated testing (unit, integration, e2e)",
        "Use version control with branching strategy (Git Flow or Trunk-based)",
        "Set up CI/CD pipeline for automated builds and deployments",
        "Conduct regular code reviews and pair programming sessions",
        "Document architecture decisions and API specifications",
        "Implement monitoring, logging, and alerting for production",
        "Follow security best practices and perform regular audits",
    ]
    return base


# ---------------------------------------------------------------------------
# Core task analysis
# ---------------------------------------------------------------------------

async def analyze_task_against_standards(
    task_title: str,
    task_description: str,
    standards_rules: List[dict],
    image_bytes_list: Optional[List[bytes]] = None,
    file_texts: Optional[List[dict]] = None,
    db=None,
) -> dict:
    """
    Send task content + quality standards to GPT-4o and return structured results.
    Injects learned model patterns when a trained model state exists.
    Falls back to offline analysis if OpenAI is unavailable.
    """
    # Get learned patterns from trained model
    learned_context = await get_learned_patterns(db)

    # Try online analysis first
    if _is_openai_configured():
        try:
            return await _online_analyze_task(
                task_title, task_description, standards_rules,
                image_bytes_list, file_texts, learned_context,
            )
        except Exception as e:
            print(f"OpenAI analysis failed, using offline fallback: {e}")

    # Offline fallback
    return _offline_analyze_task(task_title, task_description, standards_rules, file_texts)


async def _online_analyze_task(
    task_title: str,
    task_description: str,
    standards_rules: List[dict],
    image_bytes_list: Optional[List[bytes]] = None,
    file_texts: Optional[List[dict]] = None,
    learned_context: str = "",
) -> dict:
    """Online GPT-4o task analysis."""
    client = await _get_openai_client()

    # Build rules text
    rules_text = "\n".join(
        f"- [{r.get('category', 'general').upper()}] {r.get('rule', '')}"
        for r in standards_rules
        if r.get("is_active", True)
    )
    if not rules_text:
        rules_text = "No specific rules defined. Evaluate general quality."

    # Build file context
    file_context = ""
    files_analyzed = []
    if file_texts:
        for ft in file_texts:
            file_context += f"\n\nFile: {ft['file_name']}\nContent:\n{ft['content'][:3000]}"
            files_analyzed.append({"file_name": ft["file_name"], "file_type": ft.get("file_type", "text")})

    system_prompt = """You are a Quality Control AI assistant for a project management system.
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
}"""

    user_content: List[Any] = [
        {
            "type": "text",
            "text": f"""{learned_context}

Quality Standards to check against:
{rules_text}

Task Title: {task_title}

Task Description:
{task_description or "(No description provided)"}
{file_context}

Evaluate this task against EACH quality standard listed above.
Also apply any learned quality patterns from the trained model above.
Be specific about which rules passed and which failed.
Provide 2-5 actionable improvement suggestions."""
        }
    ]

    # Attach images for vision analysis
    if image_bytes_list:
        for img_bytes in image_bytes_list[:3]:
            b64 = base64.b64encode(img_bytes).decode("utf-8")
            user_content.append({
                "type": "image_url",
                "image_url": {  # type: ignore
                    "url": f"data:image/jpeg;base64,{b64}",
                    "detail": "high"
                }
            })

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[  # type: ignore
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_content},
        ],
        max_tokens=2000,
        temperature=0.3,
    )

    raw = response.choices[0].message.content or ""
    result = _parse_json_safe(raw)

    result.setdefault("compliance_score", 0.0)
    result.setdefault("passed_standards", [])
    result.setdefault("failed_standards", [])
    result.setdefault("suggestions", [])
    result.setdefault("files_analyzed", files_analyzed)

    result["compliance_score"] = max(0.0, min(100.0, float(result["compliance_score"])))
    result["_raw"] = raw
    result["_mode"] = "online"
    return result


# ---------------------------------------------------------------------------
# Roadmap / Workflow assistant
# ---------------------------------------------------------------------------

async def analyze_project_roadmap(
    project_title: str,
    project_description: str,
    tasks_list: List[str],
    standards_context: str = "",
    extra_context: str = "",
) -> dict:
    """
    Analyze the project workflow using AI and return improvement recommendations.
    Falls back to offline analysis if OpenAI is unavailable.
    """
    if _is_openai_configured():
        try:
            return await _online_analyze_roadmap(
                project_title, project_description, tasks_list,
                standards_context, extra_context,
            )
        except Exception as e:
            print(f"OpenAI roadmap analysis failed, using offline fallback: {e}")

    return _offline_analyze_roadmap(project_title, project_description, tasks_list)


async def _online_analyze_roadmap(
    project_title: str,
    project_description: str,
    tasks_list: List[str],
    standards_context: str = "",
    extra_context: str = "",
) -> dict:
    """Online GPT-4o roadmap analysis with web search augmentation."""
    client = await _get_openai_client()

    tasks_text = "\n".join(f"- {t}" for t in tasks_list) if tasks_list else "(No tasks listed)"

    # Web search for additional context
    search_context = ""
    try:
        search_results = await web_search(
            f"{project_title} {extra_context} project quality checklist best practices",
            max_results=3,
        )
        if search_results:
            search_context = "\n\nRelevant web search results:\n" + "\n".join(
                f"- [{r['title']}]({r['url']}): {r['body'][:200]}"
                for r in search_results
            )
    except Exception:
        pass

    system_prompt = """You are a senior software project management consultant and QA expert.
You analyze project workflows and suggest improvements based on industry best practices.
You must respond ONLY with a valid JSON object. No markdown, no explanation outside JSON.

JSON format:
{
  "issues_detected": ["<issue description>"],
  "suggested_tasks": ["<task that should be added>"],
  "workflow_improvements": ["<workflow change recommendation>"],
  "best_practices": ["<relevant best practice from industry standards>"],
  "overall_assessment": "<2-3 sentence summary of project quality>"
}"""

    user_message = f"""Project Title: {project_title}
Project Description: {project_description or "(No description)"}

Current Tasks:
{tasks_text}

Quality Standards Context:
{standards_context or "(No specific QC standards defined)"}

Additional Context:
{extra_context or "(None)"}
{search_context}

Please analyze this project workflow:
1. Identify any missing critical tasks or phases
2. Detect workflow issues (e.g., no testing phase, no documentation tasks)
3. Suggest improvements based on modern development standards (Agile, DevOps, etc.)
4. Reference industry best practices
5. Provide a concise overall assessment"""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[  # type: ignore
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message},
        ],
        max_tokens=1500,
        temperature=0.4,
    )

    raw = response.choices[0].message.content or ""
    result = _parse_json_safe(raw)

    result.setdefault("issues_detected", [])
    result.setdefault("suggested_tasks", [])
    result.setdefault("workflow_improvements", [])
    result.setdefault("best_practices", [])
    result.setdefault("overall_assessment", "Analysis could not be completed.")
    return result


# ---------------------------------------------------------------------------
# QC Chat assistant
# ---------------------------------------------------------------------------

async def chat_with_analysis(
    task_title: str,
    task_description: str,
    analysis_summary: str,
    conversation: List[dict],
    user_message: str,
) -> str:
    """
    Answer follow-up questions about a QC analysis in a friendly chat format.
    Falls back to a simple offline reply if OpenAI is unavailable.
    """
    if not _is_openai_configured():
        return (
            "OpenAI API key is not configured. "
            "I can see your task is about: " + task_title + ". "
            "Please configure an API key for full AI chat support."
        )
    try:
        return await _online_chat_with_analysis(
            task_title, task_description, analysis_summary, conversation, user_message
        )
    except Exception as e:
        return f"I encountered an error while processing your question: {e}"


async def _online_chat_with_analysis(
    task_title: str,
    task_description: str,
    analysis_summary: str,
    conversation: List[dict],
    user_message: str,
) -> str:
    client = await _get_openai_client()

    system_prompt = f"""You are an expert Quality Control AI assistant helping a software team.
You analyzed the task "{task_title}" and produced a quality compliance report.

Task description: {task_description or "(not provided)"}

Previous analysis result:
{analysis_summary or "(no previous analysis yet)"}

Answer the user's questions about the analysis in a clear, concise, and helpful way.
Keep responses focused and practical. Use plain text without heavy markdown.
If the user asks to re-analyze or improve something, provide actionable guidance."""

    messages: List[Any] = [{"role": "system", "content": system_prompt}]
    for msg in conversation[-10:]:  # keep last 10 messages for context
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=messages,  # type: ignore
        max_tokens=600,
        temperature=0.5,
    )

    return response.choices[0].message.content or "I could not generate a response."


# ---------------------------------------------------------------------------
# Best practices (with web search augmentation)
# ---------------------------------------------------------------------------

async def get_best_practices_for_project(
    project_type: str,
    context: str = "",
) -> List[str]:
    """
    Ask GPT to provide relevant industry best practices, augmented with web search.
    Falls back to offline practices if OpenAI is unavailable.
    """
    if _is_openai_configured():
        try:
            return await _online_best_practices(project_type, context)
        except Exception as e:
            print(f"OpenAI best practices failed, using offline fallback: {e}")

    return _offline_best_practices(project_type)


async def _online_best_practices(
    project_type: str,
    context: str = "",
) -> List[str]:
    """Online best practices with web search."""
    client = await _get_openai_client()

    # Search the web for current best practices
    search_context = ""
    try:
        search_results = await web_search(
            f"best practices {project_type} project quality standards {datetime.now().year}",
            max_results=5,
        )
        if search_results:
            search_context = "\n\nRelevant web search results:\n" + "\n".join(
                f"- [{r['title']}]({r['url']}): {r['body'][:200]}"
                for r in search_results
            )
    except Exception:
        pass

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[  # type: ignore
            {
                "role": "system",
                "content": "You are a software engineering best practices expert. "
                           "Use the provided web search results as references when available. "
                           "Respond with a JSON array of strings only.",
            },
            {
                "role": "user",
                "content": f"List 8 industry best practices for a {project_type} project. "
                           f"Context: {context}. {search_context}\n\n"
                           f"Respond as JSON array: [\"practice 1\", \"practice 2\", ...]",
            },
        ],
        max_tokens=600,
        temperature=0.3,
    )

    raw = response.choices[0].message.content or "[]"
    try:
        result = json.loads(raw)
        if isinstance(result, list):
            return result
    except Exception:
        pass
    return [raw]


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _parse_json_safe(text: str) -> dict:
    """Extract and parse JSON from a string that may contain extra text."""
    text = text.strip()

    # Try direct parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # Try extracting JSON block from markdown
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass

    # Try finding first { ... } block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    return {}
