"""
Indian Job Boards Scraper – FastAPI Microservice
=================================================
Uses Scrapling's StealthyFetcher / Fetcher to scrape 5 Indian job boards:
  - Naukri.com
  - Internshala
  - LinkedIn India (guest search)
  - Foundit (ex-Monster India)
  - Shine.com

Endpoint contract (consumed by Node.js indianBoards.service.js):
  POST /api/v1/scrape
  Body: { "source": "naukri", "options": { "keywords": [...], "locations": [...], "limit": 50 } }
  Response: { "success": true, "jobs": [...], "jobs_found": N, "duration_ms": N }
  Jobs are returned in snake_case — Node.js converts to camelCase.
"""

from __future__ import annotations

import asyncio
import os
import secrets
import time
import hashlib
import logging
import traceback
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────
API_KEY = os.getenv("SCRAPER_API_KEY", "")
HEADLESS = os.getenv("HEADLESS", "true").lower() == "true"
PROXY = os.getenv("PROXY", None)
# LinkedIn scraping is disabled by default — set ENABLE_LINKEDIN_SCRAPING=true
# only after attaching documented proof of authorisation (see README compliance notice).
ENABLE_LINKEDIN_SCRAPING = os.getenv("ENABLE_LINKEDIN_SCRAPING", "false").lower() == "true"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("scraper-service")

app = FastAPI(title="Indian Job Boards Scraper", version="1.0.0")


# ── Pydantic models ──────────────────────────────────────────────────
class ScrapeOptions(BaseModel):
    keywords: Optional[list[str]] = None
    locations: Optional[list[str]] = None
    limit: int = Field(default=50, ge=1, le=500)
    include_internships: Optional[bool] = None
    include_jobs: Optional[bool] = None


class ScrapeRequest(BaseModel):
    source: str
    options: ScrapeOptions = ScrapeOptions()


# ── Middleware: API-key auth ──────────────────────────────────────────
@app.middleware("http")
async def check_api_key(request: Request, call_next):
    if request.url.path == "/api/v1/health":
        return await call_next(request)

    if API_KEY:
        provided = request.headers.get("X-API-Key", "")
        # Use constant-time comparison to prevent timing-attack key enumeration.
        if not provided or not secrets.compare_digest(API_KEY, provided):
            return JSONResponse(status_code=401, content={"success": False, "error": "Invalid API key"})

    return await call_next(request)


# ── Health endpoint ───────────────────────────────────────────────────
@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "service": "scraper-service", "version": "1.0.0"}


# ── Main scrape endpoint ─────────────────────────────────────────────
@app.post("/api/v1/scrape")
async def scrape(req: ScrapeRequest):
    source = req.source.lower().strip()
    options = req.options

    SCRAPERS = {
        "naukri": scrape_naukri,
        "internshala": scrape_internshala,
        "linkedin-india": scrape_linkedin_india,
        "foundit": scrape_foundit,
        "shine": scrape_shine,
    }

    if source not in SCRAPERS:
        raise HTTPException(status_code=400, detail=f"Unsupported source: {source}")

    # LinkedIn scraping requires explicit opt-in via ENABLE_LINKEDIN_SCRAPING=true.
    if source == "linkedin-india" and not ENABLE_LINKEDIN_SCRAPING:
        raise HTTPException(
            status_code=403,
            detail=(
                "LinkedIn scraping is disabled. Set ENABLE_LINKEDIN_SCRAPING=true only after "
                "attaching documented proof of authorisation (see README compliance notice)."
            ),
        )

    start = time.time()
    try:
        jobs = await SCRAPERS[source](options)
        duration_ms = int((time.time() - start) * 1000)
        logger.info(f"[{source}] Scraped {len(jobs)} jobs in {duration_ms}ms")
        return {
            "success": True,
            "jobs": jobs,
            "jobs_found": len(jobs),
            "duration_ms": duration_ms,
        }
    except Exception as e:
        duration_ms = int((time.time() - start) * 1000)
        logger.error(f"[{source}] Scrape failed: {e}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(e),
                "source": source,
                "duration_ms": duration_ms,
            },
        )


# ── Helpers ───────────────────────────────────────────────────────────
def _generate_id(source: str, *parts: str) -> str:
    """Deterministic external_id from source + identifying parts."""
    raw = f"{source}:{'|'.join(str(p) for p in parts if p)}"
    return hashlib.md5(raw.encode()).hexdigest()[:16]


def _safe_text(element, default: str = "") -> str:
    """Safely extract text from a Scrapling element."""
    if element is None:
        return default
    try:
        text = element.text if hasattr(element, "text") else str(element)
        return text.strip() if text else default
    except Exception:
        return default


def _safe_get(page, selector: str, default: str = "") -> str:
    """CSS selector → first match text (safe)."""
    try:
        result = page.css(f"{selector}::text").get()
        return result.strip() if result else default
    except Exception:
        return default


def _safe_attr(element, attr: str, default: str = "") -> str:
    """Get attribute from element safely."""
    try:
        val = element.attrib.get(attr, default)
        return val.strip() if val else default
    except Exception:
        return default


def _parse_salary(text: str) -> tuple[int | None, int | None]:
    """Extract salary_min, salary_max from a salary string like '₹5,00,000 - ₹8,00,000'."""
    import re
    if not text:
        return None, None
    # Remove currency symbols, commas, whitespace
    cleaned = re.sub(r"[₹,\s]", "", text)
    # Handle lakh notation (e.g., "500000" or "5L" or "5 LPA")
    cleaned = re.sub(r"(?i)(lpa|l|lac|lakh|lakhs)", "00000", cleaned)
    numbers = re.findall(r"\d+", cleaned)
    if len(numbers) >= 2:
        return int(numbers[0]), int(numbers[1])
    elif len(numbers) == 1:
        return int(numbers[0]), None
    return None, None


def _detect_experience_level(title: str, exp_text: str = "") -> str:
    """Infer experience level from title/experience text."""
    combined = f"{title} {exp_text}".lower()
    if any(w in combined for w in ("intern", "trainee", "fresher", "0-1", "0-2", "entry")):
        return "entry"
    if any(w in combined for w in ("senior", "lead", "principal", "staff", "architect", "8+", "10+")):
        return "senior"
    if any(w in combined for w in ("manager", "director", "head", "vp")):
        return "senior"
    return "mid"


def _detect_employment_type(text: str) -> str:
    """Infer employment type from text."""
    lower = text.lower()
    if "intern" in lower:
        return "internship"
    if "contract" in lower or "freelance" in lower:
        return "contract"
    if "part" in lower and "time" in lower:
        return "part-time"
    return "full-time"


def _parse_experience_years(text: str) -> tuple[int | None, int | None]:
    """Parse '3-5 Yrs' → (3, 5)."""
    import re
    if not text:
        return None, None
    numbers = re.findall(r"\d+", text)
    if len(numbers) >= 2:
        return int(numbers[0]), int(numbers[1])
    elif len(numbers) == 1:
        return int(numbers[0]), None
    return None, None


def _extract_skills_from_text(text: str) -> dict:
    """Extract skills from a text blob using keyword matching."""
    if not text:
        return {"required": [], "technical": [], "preferred": []}

    # Common tech skills to look for
    TECH_KEYWORDS = [
        "python", "java", "javascript", "typescript", "react", "angular", "vue",
        "node.js", "nodejs", "express", "django", "flask", "fastapi", "spring",
        "sql", "mysql", "postgresql", "mongodb", "redis", "elasticsearch",
        "docker", "kubernetes", "aws", "azure", "gcp", "terraform",
        "git", "ci/cd", "jenkins", "github actions", "linux", "bash",
        "html", "css", "sass", "tailwind", "bootstrap",
        "rest", "graphql", "grpc", "microservices", "api",
        "machine learning", "deep learning", "ai", "nlp", "data science",
        "pandas", "numpy", "tensorflow", "pytorch", "scikit-learn",
        "c++", "c#", ".net", "go", "golang", "rust", "kotlin", "swift",
        "php", "laravel", "ruby", "rails", "scala",
        "power bi", "tableau", "excel", "jira", "confluence",
        "selenium", "cypress", "playwright", "testing", "qa",
        "figma", "sketch", "photoshop", "ui/ux",
        "agile", "scrum", "devops", "sre",
    ]
    lower = text.lower()
    found = [kw for kw in TECH_KEYWORDS if kw in lower]
    return {"required": found, "technical": found, "preferred": []}


# ═══════════════════════════════════════════════════════════════════════
# SCRAPERS — one async function per source
# ═══════════════════════════════════════════════════════════════════════

async def scrape_naukri(options: ScrapeOptions) -> list[dict]:
    """
    Scrape Naukri.com job listings.
    Uses Naukri's search page which renders job cards with structured data.
    """
    from scrapling.fetchers import StealthyFetcher

    keywords = options.keywords or ["software engineer", "developer"]
    locations = options.locations or ["Bangalore", "Mumbai", "Delhi", "Hyderabad"]
    limit = options.limit or 50
    all_jobs = []

    for keyword in keywords[:3]:  # Limit keyword iterations to avoid rate limiting
        for location in locations[:4]:
            if len(all_jobs) >= limit:
                break

            search_keyword = keyword.replace(" ", "-")
            search_location = location.replace(" ", "-").lower()
            url = f"https://www.naukri.com/{search_keyword}-jobs-in-{search_location}"

            logger.info(f"[naukri] Fetching {url}")
            try:
                page = await StealthyFetcher.async_fetch(
                    url,
                    headless=HEADLESS,
                    network_idle=True,
                    disable_resources=True,
                    google_search=True,
                    proxy=PROXY,
                )

                if page.status != 200:
                    logger.warning(f"[naukri] Got status {page.status} for {url}")
                    continue

                # Naukri job cards
                job_cards = page.css("article.jobTuple, div.srp-jobtuple, div.cust-job-tuple")
                if not job_cards:
                    # Try alternative selector
                    job_cards = page.css('[class*="jobTuple"], [data-job-id]')

                logger.info(f"[naukri] Found {len(job_cards)} job cards for '{keyword}' in '{location}'")

                for card in job_cards:
                    if len(all_jobs) >= limit:
                        break
                    try:
                        title_el = card.css("a.title, a[class*='title'], .row1 a")
                        title = _safe_text(title_el[0]) if title_el else ""
                        job_url = _safe_attr(title_el[0], "href") if title_el else ""

                        company_el = card.css("a.subTitle, a[class*='comp-name'], .row2 .comp-name")
                        company = _safe_text(company_el[0]) if company_el else ""

                        exp_el = card.css(".expwdth, span[class*='exp'], .row3 .exp")
                        exp_text = _safe_text(exp_el[0]) if exp_el else ""

                        sal_el = card.css(".sal, span[class*='sal'], .row3 .sal")
                        salary_text = _safe_text(sal_el[0]) if sal_el else ""

                        loc_el = card.css(".loc, span[class*='loc'], .row3 .loc")
                        job_location = _safe_text(loc_el[0]) if loc_el else location

                        desc_el = card.css(".job-description, .row4, .job-desc")
                        description = _safe_text(desc_el[0]) if desc_el else ""

                        skills_el = card.css(".tags li, .tag-li, .dot-gt span, ul.tags-gt li")
                        skills_list = [_safe_text(s) for s in skills_el if _safe_text(s)]

                        if not title or not company:
                            continue

                        salary_min, salary_max = _parse_salary(salary_text)
                        exp_min, exp_max = _parse_experience_years(exp_text)

                        all_jobs.append({
                            "external_id": _generate_id("naukri", title, company, job_url),
                            "source": "naukri",
                            "title": title,
                            "company": company,
                            "company_logo": None,
                            "location": job_location,
                            "remote_type": "onsite",
                            "employment_type": _detect_employment_type(title),
                            "experience_level": _detect_experience_level(title, exp_text),
                            "salary_min": salary_min,
                            "salary_max": salary_max,
                            "currency": "INR",
                            "salary_period": "yearly",
                            "description": description,
                            "requirements": None,
                            "responsibilities": None,
                            "benefits": None,
                            "skills_required": {"required": skills_list, "technical": skills_list, "preferred": []},
                            "education_level": None,
                            "years_experience_min": exp_min,
                            "years_experience_max": exp_max,
                            "url": (job_url if job_url.startswith("http") else f"https://www.naukri.com{job_url}") if job_url else None,
                            "apply_url": (job_url if job_url.startswith("http") else f"https://www.naukri.com{job_url}") if job_url else None,
                            "posted_date": None,
                            "expires_at": None,
                            "raw_data": None,
                            "meta": {"search_keyword": keyword, "search_location": location},
                        })
                    except Exception as e:
                        logger.warning(f"[naukri] Failed to parse job card: {e}")
                        continue

            except Exception as e:
                logger.error(f"[naukri] Failed to fetch {url}: {e}")
                continue

    return all_jobs[:limit]


async def scrape_internshala(options: ScrapeOptions) -> list[dict]:
    """
    Scrape Internshala for internships and fresher jobs.
    Internshala has a cleaner DOM, less anti-bot protection.
    """
    from scrapling.fetchers import StealthyFetcher

    keywords = options.keywords or ["software", "web development", "data science"]
    limit = options.limit or 50
    include_internships = options.include_internships if options.include_internships is not None else True
    include_jobs = options.include_jobs if options.include_jobs is not None else True
    all_jobs = []

    sections = []
    if include_internships:
        sections.append(("internships", "internship"))
    if include_jobs:
        sections.append(("fresher-jobs", "full-time"))

    for section_path, default_type in sections:
        for keyword in keywords[:3]:
            if len(all_jobs) >= limit:
                break

            search_keyword = keyword.replace(" ", "-").lower()
            url = f"https://internshala.com/{section_path}/{search_keyword}"

            logger.info(f"[internshala] Fetching {url}")
            try:
                page = await StealthyFetcher.async_fetch(
                    url,
                    headless=HEADLESS,
                    network_idle=True,
                    disable_resources=True,
                    proxy=PROXY,
                )

                if page.status != 200:
                    logger.warning(f"[internshala] Got status {page.status} for {url}")
                    continue

                # Internshala listings
                cards = page.css(".individual_internship, .internship_meta, .individual_job, div[class*='internship-container']")
                if not cards:
                    cards = page.css("[class*='internship_'], [class*='individual_']")

                logger.info(f"[internshala] Found {len(cards)} listings for '{keyword}'")

                for card in cards:
                    if len(all_jobs) >= limit:
                        break
                    try:
                        title_el = card.css("h3 a, .heading_4_5 a, a.view_detail_button")
                        title = _safe_text(title_el[0]) if title_el else ""
                        detail_url = _safe_attr(title_el[0], "href") if title_el else ""

                        company_el = card.css("h4 a, .heading_6, a.link_display_like_text, p.company_name")
                        company = _safe_text(company_el[0]) if company_el else ""

                        loc_el = card.css(".location_link a, a[class*='location'], #location_names span, span.location_link")
                        job_location = _safe_text(loc_el[0]) if loc_el else "India"

                        stipend_el = card.css(".stipend, span.desktop-text, span[class*='stipend']")
                        stipend_text = _safe_text(stipend_el[0]) if stipend_el else ""

                        duration_el = card.css(".other_detail_item:first-child, span[class*='duration']")
                        duration_text = _safe_text(duration_el[0]) if duration_el else ""

                        if not title or not company:
                            continue

                        salary_min, salary_max = _parse_salary(stipend_text)

                        all_jobs.append({
                            "external_id": _generate_id("internshala", title, company, detail_url),
                            "source": "internshala",
                            "title": title,
                            "company": company,
                            "company_logo": None,
                            "location": job_location,
                            "remote_type": "onsite" if "work from home" not in title.lower() else "remote",
                            "employment_type": default_type,
                            "experience_level": "entry",
                            "salary_min": salary_min,
                            "salary_max": salary_max,
                            "currency": "INR",
                            "salary_period": "monthly" if section_path == "internships" else "yearly",
                            "description": None,
                            "requirements": None,
                            "responsibilities": None,
                            "benefits": None,
                            "skills_required": {"required": [], "technical": [], "preferred": []},
                            "education_level": None,
                            "years_experience_min": 0,
                            "years_experience_max": 2,
                            "url": f"https://internshala.com{detail_url}" if detail_url and not detail_url.startswith("http") else (detail_url or url),
                            "apply_url": None,
                            "posted_date": None,
                            "expires_at": None,
                            "raw_data": None,
                            "meta": {"duration": duration_text, "section": section_path, "search_keyword": keyword},
                        })
                    except Exception as e:
                        logger.warning(f"[internshala] Failed to parse card: {e}")
                        continue

            except Exception as e:
                logger.error(f"[internshala] Failed to fetch {url}: {e}")
                continue

    return all_jobs[:limit]


async def scrape_linkedin_india(options: ScrapeOptions) -> list[dict]:
    """
    Scrape LinkedIn India jobs using the guest search API.
    LinkedIn guest search does not require authentication but has limited results.
    """
    from scrapling.fetchers import Fetcher

    keywords = options.keywords or ["software engineer", "developer"]
    locations = options.locations or ["India"]
    limit = options.limit or 50
    all_jobs = []

    for keyword in keywords[:3]:
        for location in locations[:2]:
            if len(all_jobs) >= limit:
                break

            # LinkedIn guest jobs search — no auth needed
            import urllib.parse
            params = urllib.parse.urlencode({
                "keywords": keyword,
                "location": location,
                "f_TPR": "r604800",  # Past week
                "f_WT": "2",  # Remote & On-site
                "start": 0,
                "count": 25,
            })
            url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?{params}"

            logger.info(f"[linkedin-india] Fetching {url}")
            try:
                page = await asyncio.to_thread(
                    Fetcher.get,
                    url,
                    impersonate="chrome",
                    stealthy_headers=True,
                    follow_redirects=True,
                )

                if page.status != 200:
                    logger.warning(f"[linkedin-india] Got status {page.status}")
                    continue

                # LinkedIn returns HTML fragments with job cards
                cards = page.css("li, div.base-card, div[class*='job-search-card']")
                if not cards:
                    cards = page.css("[class*='base-card']")

                logger.info(f"[linkedin-india] Found {len(cards)} job cards")

                for card in cards:
                    if len(all_jobs) >= limit:
                        break
                    try:
                        title_el = card.css("h3.base-search-card__title, h3[class*='title']")
                        title = _safe_text(title_el[0]) if title_el else ""

                        company_el = card.css("h4.base-search-card__subtitle a, a[class*='company']")
                        company = _safe_text(company_el[0]) if company_el else ""

                        loc_el = card.css("span.job-search-card__location, span[class*='location']")
                        job_location = _safe_text(loc_el[0]) if loc_el else location

                        link_el = card.css("a.base-card__full-link, a[class*='base-card']")
                        job_url = _safe_attr(link_el[0], "href") if link_el else ""

                        date_el = card.css("time, time[class*='date']")
                        posted_date = _safe_attr(date_el[0], "datetime") if date_el else None

                        if not title or not company:
                            continue

                        all_jobs.append({
                            "external_id": _generate_id("linkedin-india", title, company, job_url),
                            "source": "linkedin-india",
                            "title": title,
                            "company": company,
                            "company_logo": None,
                            "location": job_location,
                            "remote_type": None,
                            "employment_type": "full-time",
                            "experience_level": _detect_experience_level(title),
                            "salary_min": None,
                            "salary_max": None,
                            "currency": "INR",
                            "salary_period": None,
                            "description": None,
                            "requirements": None,
                            "responsibilities": None,
                            "benefits": None,
                            "skills_required": {"required": [], "technical": [], "preferred": []},
                            "education_level": None,
                            "years_experience_min": None,
                            "years_experience_max": None,
                            "url": job_url or url,
                            "apply_url": None,
                            "posted_date": posted_date,
                            "expires_at": None,
                            "raw_data": None,
                            "meta": {"search_keyword": keyword, "search_location": location},
                        })
                    except Exception as e:
                        logger.warning(f"[linkedin-india] Failed to parse card: {e}")
                        continue

            except Exception as e:
                logger.error(f"[linkedin-india] Failed to fetch: {e}")
                continue

    return all_jobs[:limit]


async def scrape_foundit(options: ScrapeOptions) -> list[dict]:
    """
    Scrape Foundit.in (formerly Monster India) for mid-level jobs.
    """
    from scrapling.fetchers import StealthyFetcher

    keywords = options.keywords or ["software engineer", "developer"]
    locations = options.locations or ["Bangalore", "Mumbai", "Delhi"]
    limit = options.limit or 50
    all_jobs = []

    for keyword in keywords[:3]:
        for location in locations[:3]:
            if len(all_jobs) >= limit:
                break

            search_keyword = keyword.replace(" ", "-")
            search_location = location.replace(" ", "-").lower()
            url = f"https://www.foundit.in/srp/results?searchId=&query={keyword.replace(' ', '+')}&locations={location}"

            logger.info(f"[foundit] Fetching {url}")
            try:
                page = await StealthyFetcher.async_fetch(
                    url,
                    headless=HEADLESS,
                    network_idle=True,
                    disable_resources=True,
                    proxy=PROXY,
                )

                if page.status != 200:
                    logger.warning(f"[foundit] Got status {page.status}")
                    continue

                # Foundit job cards
                cards = page.css("div.card-apply-content, div[class*='jobTuple'], div[class*='card-job']")
                if not cards:
                    cards = page.css("[class*='srpResult'], [class*='job-card']")

                logger.info(f"[foundit] Found {len(cards)} job cards")

                for card in cards:
                    if len(all_jobs) >= limit:
                        break
                    try:
                        title_el = card.css("a[class*='title'], .card-job-title a, h3 a")
                        title = _safe_text(title_el[0]) if title_el else ""
                        job_url = _safe_attr(title_el[0], "href") if title_el else ""

                        company_el = card.css("span[class*='comp-name'], .card-job-cmpny a, .company-name")
                        company = _safe_text(company_el[0]) if company_el else ""

                        loc_el = card.css("span[class*='loc'], .card-job-location, .location-text")
                        job_location = _safe_text(loc_el[0]) if loc_el else location

                        exp_el = card.css("span[class*='exp'], .card-job-exp")
                        exp_text = _safe_text(exp_el[0]) if exp_el else ""

                        sal_el = card.css("span[class*='sal'], .card-job-sal")
                        salary_text = _safe_text(sal_el[0]) if sal_el else ""

                        desc_el = card.css(".card-job-desc, .job-desc, p[class*='desc']")
                        description = _safe_text(desc_el[0]) if desc_el else ""

                        skills_el = card.css("span[class*='skill'], .tags span, .key-skills span")
                        skills_list = [_safe_text(s) for s in skills_el if _safe_text(s)]

                        if not title or not company:
                            continue

                        salary_min, salary_max = _parse_salary(salary_text)
                        exp_min, exp_max = _parse_experience_years(exp_text)

                        all_jobs.append({
                            "external_id": _generate_id("foundit", title, company, job_url),
                            "source": "foundit",
                            "title": title,
                            "company": company,
                            "company_logo": None,
                            "location": job_location,
                            "remote_type": "onsite",
                            "employment_type": _detect_employment_type(title),
                            "experience_level": _detect_experience_level(title, exp_text),
                            "salary_min": salary_min,
                            "salary_max": salary_max,
                            "currency": "INR",
                            "salary_period": "yearly",
                            "description": description,
                            "requirements": None,
                            "responsibilities": None,
                            "benefits": None,
                            "skills_required": {"required": skills_list, "technical": skills_list, "preferred": []} if skills_list else _extract_skills_from_text(description),
                            "education_level": None,
                            "years_experience_min": exp_min,
                            "years_experience_max": exp_max,
                            "url": job_url if job_url.startswith("http") else f"https://www.foundit.in{job_url}",
                            "apply_url": None,
                            "posted_date": None,
                            "expires_at": None,
                            "raw_data": None,
                            "meta": {"search_keyword": keyword, "search_location": location},
                        })
                    except Exception as e:
                        logger.warning(f"[foundit] Failed to parse card: {e}")
                        continue

            except Exception as e:
                logger.error(f"[foundit] Failed to fetch {url}: {e}")
                continue

    return all_jobs[:limit]


async def scrape_shine(options: ScrapeOptions) -> list[dict]:
    """
    Scrape Shine.com for verified-company jobs.
    """
    from scrapling.fetchers import StealthyFetcher

    keywords = options.keywords or ["software engineer", "developer"]
    locations = options.locations or ["Bangalore", "Mumbai"]
    limit = options.limit or 50
    all_jobs = []

    for keyword in keywords[:3]:
        for location in locations[:3]:
            if len(all_jobs) >= limit:
                break

            url = f"https://www.shine.com/job-search/{keyword.replace(' ', '-')}-jobs-in-{location.lower()}"

            logger.info(f"[shine] Fetching {url}")
            try:
                page = await StealthyFetcher.async_fetch(
                    url,
                    headless=HEADLESS,
                    network_idle=True,
                    disable_resources=True,
                    proxy=PROXY,
                )

                if page.status != 200:
                    logger.warning(f"[shine] Got status {page.status}")
                    continue

                # Shine job cards
                cards = page.css("div[id*='jobCard'], div[class*='jobCard'], div.search_listing")
                if not cards:
                    cards = page.css("[class*='job_container'], [class*='listing']")

                logger.info(f"[shine] Found {len(cards)} job cards")

                for card in cards:
                    if len(all_jobs) >= limit:
                        break
                    try:
                        title_el = card.css("a[class*='title'], h3 a, .job_title a, .listingTitle a")
                        title = _safe_text(title_el[0]) if title_el else ""
                        job_url = _safe_attr(title_el[0], "href") if title_el else ""

                        company_el = card.css("span[class*='comp'], .company_name, .companyName, a[class*='comp']")
                        company = _safe_text(company_el[0]) if company_el else ""

                        loc_el = card.css("span[class*='loc'], .loc, .location")
                        job_location = _safe_text(loc_el[0]) if loc_el else location

                        exp_el = card.css("span[class*='exp'], .exp, .experience")
                        exp_text = _safe_text(exp_el[0]) if exp_el else ""

                        sal_el = card.css("span[class*='sal'], .sal, .salary")
                        salary_text = _safe_text(sal_el[0]) if sal_el else ""

                        skills_el = card.css("span[class*='skill'], .skillTags span, .key_skills span")
                        skills_list = [_safe_text(s) for s in skills_el if _safe_text(s)]

                        if not title or not company:
                            continue

                        salary_min, salary_max = _parse_salary(salary_text)
                        exp_min, exp_max = _parse_experience_years(exp_text)

                        all_jobs.append({
                            "external_id": _generate_id("shine", title, company, job_url),
                            "source": "shine",
                            "title": title,
                            "company": company,
                            "company_logo": None,
                            "location": job_location,
                            "remote_type": "onsite",
                            "employment_type": _detect_employment_type(title),
                            "experience_level": _detect_experience_level(title, exp_text),
                            "salary_min": salary_min,
                            "salary_max": salary_max,
                            "currency": "INR",
                            "salary_period": "yearly",
                            "description": None,
                            "requirements": None,
                            "responsibilities": None,
                            "benefits": None,
                            "skills_required": {"required": skills_list, "technical": skills_list, "preferred": []},
                            "education_level": None,
                            "years_experience_min": exp_min,
                            "years_experience_max": exp_max,
                            "url": job_url if job_url.startswith("http") else f"https://www.shine.com{job_url}",
                            "apply_url": None,
                            "posted_date": None,
                            "expires_at": None,
                            "raw_data": None,
                            "meta": {"search_keyword": keyword, "search_location": location},
                        })
                    except Exception as e:
                        logger.warning(f"[shine] Failed to parse card: {e}")
                        continue

            except Exception as e:
                logger.error(f"[shine] Failed to fetch {url}: {e}")
                continue

    return all_jobs[:limit]


# ── Startup event ─────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    logger.info("🚀 Scraper service started")
    logger.info(f"   Headless: {HEADLESS}")
    logger.info(f"   Proxy: {'configured' if PROXY else 'none'}")
    logger.info(f"   API key: {'required' if API_KEY else 'DISABLED (open access)'}")


# ── Entrypoint ────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
