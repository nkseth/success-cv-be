# Indian Job Boards Scraper Service

Python FastAPI microservice that scrapes 5 Indian job boards using [Scrapling](https://github.com/D4Vinci/Scrapling).

## Supported Sources

| Source | URL | Method | Schedule |
|--------|-----|--------|----------|
| **Naukri** | naukri.com | StealthyFetcher (headless) | Every 4 hours |
| **Internshala** | internshala.com | StealthyFetcher (headless) | Every 6 hours |
| **LinkedIn India** | linkedin.com (guest API) | Fetcher (HTTP) | Every 3 hours |
| **Foundit** | foundit.in | StealthyFetcher (headless) | Every 6 hours |
| **Shine** | shine.com | StealthyFetcher (headless) | Every 8 hours |

> **⚠️ Legal / Compliance — LinkedIn**
>
> Automated scraping of LinkedIn may violate their [User Agreement](https://www.linkedin.com/legal/user-agreement) and the *hiQ Labs v. LinkedIn* injunction history.  
> **LinkedIn scraping is DISABLED by default.** To enable it you must:
> 1. Set `ENABLE_LINKEDIN_SCRAPING=true` in your environment (the scraper will reject requests to the `linkedin-india` source if this flag is absent or `false`).
> 2. Attach documented proof of authorisation (e.g. a LinkedIn Partner Agreement) to this repository before deploying to production.
> 3. Review applicable law in your jurisdiction before enabling.

## Quick Start

### 1. Install dependencies

```bash
cd scraper-service
pip install -r requirements.txt
python -m scrapling install   # Install browser binaries (Playwright + Camoufox)
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set SCRAPER_API_KEY to match SCRAPER_SERVICE_SECRET in the Node.js .env
```

### 3. Run the service

```bash
# Development
python main.py

# Production
uvicorn main:app --host 0.0.0.0 --port 8001
```

### 4. Docker (recommended for production)

```bash
docker compose up -d
```

## API Contract

The Node.js backend (`indianBoards.service.js`) calls this service via HTTP.

### `GET /api/v1/health`
Health check — no auth required.

**Response:**
```json
{ "status": "ok", "service": "scraper-service", "version": "1.0.0" }
```

### `POST /api/v1/scrape`
Scrape a single Indian job board.

**Headers:**
```
X-API-Key: <SCRAPER_API_KEY>
Content-Type: application/json
```

**Request body:**
```json
{
  "source": "naukri",
  "options": {
    "keywords": ["software engineer", "react developer"],
    "locations": ["Bangalore", "Mumbai"],
    "limit": 50
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "jobs": [
    {
      "external_id": "a1b2c3d4e5f6",
      "source": "naukri",
      "title": "Senior React Developer",
      "company": "TCS",
      "location": "Bangalore",
      "remote_type": "onsite",
      "employment_type": "full-time",
      "experience_level": "senior",
      "salary_min": 1500000,
      "salary_max": 2500000,
      "currency": "INR",
      "salary_period": "yearly",
      "description": "...",
      "skills_required": {
        "required": ["react", "javascript"],
        "technical": ["react", "javascript"],
        "preferred": []
      },
      "url": "https://www.naukri.com/...",
      "posted_date": null
    }
  ],
  "jobs_found": 1,
  "duration_ms": 4523
}
```

**Note:** Jobs are returned in **snake_case**. The Node.js `indianBoards.service.js` normalises them to camelCase before upsert.

## Architecture

```
┌──────────────────────────┐     POST /api/v1/scrape     ┌────────────────────────┐
│  Node.js Backend         │ ──────────────────────────►  │  Python Scraper        │
│  (BullMQ Worker)         │                              │  (FastAPI + Scrapling) │
│                          │  ◄──────────────────────────  │                        │
│  indianBoards.service.js │     { jobs: [...] }          │  StealthyFetcher       │
│  → snake→camelCase       │                              │  Fetcher               │
│  → upsertJobs()          │                              │                        │
└──────────────────────────┘                              └────────────────────────┘
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPER_API_KEY` | *(empty = **open/unauthenticated**)* | Must match `SCRAPER_SERVICE_SECRET` in Node.js. **Leaving this empty disables authentication entirely — any caller can reach all scrape endpoints without a key. Never run in production with an empty value.** Set to a strong random secret (`openssl rand -hex 32`) and rotate regularly. |
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8001` | Bind port |
| `HEADLESS` | `true` | Run browsers in headless mode |
| `PROXY` | *(none)* | HTTP/SOCKS5 proxy for anti-bot bypass |
| `ENABLE_LINKEDIN_SCRAPING` | `false` | Set `true` only after attaching proof of LinkedIn authorisation (see compliance notice above) |

## Adapting Scrapers

Each scraper function lives in `main.py` (e.g., `scrape_naukri`, `scrape_internshala`). To fix selectors when a site redesigns:

1. Open the site in a browser, inspect the job card HTML
2. Update the CSS selectors in the corresponding `scrape_*` function
3. Test with: `curl -X POST http://localhost:8001/api/v1/scrape -H 'Content-Type: application/json' -d '{"source":"naukri","options":{"keywords":["python"],"locations":["Mumbai"],"limit":5}}'`
