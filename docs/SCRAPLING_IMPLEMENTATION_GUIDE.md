# Scrapling — Implementation Guide for Agents

> **Source**: https://scrapling.readthedocs.io/en/latest/  
> **Version**: latest (≥ v0.3.14)  
> **Python**: 3.10+

Scrapling is an adaptive web scraping framework that handles everything from a single HTTP request to a full concurrent multi-session crawl. It auto-relocates elements when page structure changes, bypasses anti-bot systems (including Cloudflare), and supports pause/resume, proxy rotation, and streaming — all in pure Python.

---

## Table of Contents

1. [Installation](#1-installation)
2. [Fetchers — Choosing the Right One](#2-fetchers--choosing-the-right-one)
3. [Fetcher: HTTP Requests (Fetcher)](#3-fetcher-http-requests)
4. [Fetcher: Dynamic Browser (DynamicFetcher)](#4-fetcher-dynamic-browser)
5. [Fetcher: Stealthy Browser (StealthyFetcher)](#5-fetcher-stealthy-browser)
6. [Session Management](#6-session-management)
7. [Parsing & Element Selection](#7-parsing--element-selection)
8. [Spider Framework — Architecture](#8-spider-framework--architecture)
9. [Spider: Getting Started](#9-spider-getting-started)
10. [Spider: Sessions (Multi-Fetcher)](#10-spider-sessions-multi-fetcher)
11. [Spider: Proxy Rotation & Block Handling](#11-spider-proxy-rotation--block-handling)
12. [Spider: Advanced Features](#12-spider-advanced-features)
13. [Response Object Reference](#13-response-object-reference)
14. [Quick-Reference Cheat Sheet](#14-quick-reference-cheat-sheet)

---

## 1. Installation

```bash
# Parser engine only (no fetchers)
pip install scrapling

# With all fetchers + browser dependencies
pip install "scrapling[fetchers]"
scrapling install          # downloads Chromium + fingerprint deps

# All extras (MCP server, shell, fetchers)
pip install "scrapling[all]"
scrapling install

# Docker (includes all browsers)
docker pull pyd4vinci/scrapling
```

> **Rule**: Always run `scrapling install` after installing fetcher extras. It downloads the browser binaries.

---

## 2. Fetchers — Choosing the Right One

| Feature | `Fetcher` | `DynamicFetcher` | `StealthyFetcher` |
|---|---|---|---|
| Speed | 🐇🐇🐇🐇🐇 Fastest | 🐇🐇🐇 | 🐇🐇🐇 |
| JavaScript execution | ❌ | ✅ | ✅ |
| Anti-bot bypass | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Cloudflare Turnstile | ❌ | ⭐⭐⭐ | ✅ Full bypass |
| Memory usage | Minimal | High | High |
| Browser | None | Chromium / Chrome | Chromium / Chrome |
| Best for | Static HTML, APIs | JS sites, light protections | Heavily protected sites |

**Decision logic for implementation agents:**
- Site returns all data in HTML source → use `Fetcher`
- Site loads data via JavaScript → use `DynamicFetcher`
- Site has Cloudflare, bot detection, or returns empty with DynamicFetcher → use `StealthyFetcher`

---

## 3. Fetcher: HTTP Requests

```python
from scrapling.fetchers import Fetcher, AsyncFetcher

# --- Sync ---
page = Fetcher.get('https://example.com')
page = Fetcher.post('https://example.com/api', json={'key': 'value'})
page = Fetcher.put('https://example.com/update', data={'status': 'ok'})
page = Fetcher.delete('https://example.com/resource/123')

# --- Async ---
page = await AsyncFetcher.get('https://example.com')
page = await AsyncFetcher.post('https://example.com/api', json={'key': 'value'})
```

### Shared Arguments (all HTTP methods)

| Argument | Default | Description |
|---|---|---|
| `url` | required | Target URL |
| `stealthy_headers` | `True` | Generate real browser headers + Google referer |
| `follow_redirects` | `True` | Follow HTTP redirects |
| `timeout` | `30` | Seconds per request |
| `retries` | `3` | Auto-retries on failure |
| `retry_delay` | `1` | Seconds between retries |
| `impersonate` | latest Chrome | Browser TLS fingerprint to mimic. Values: `"chrome"`, `"firefox"`, `"safari"`, `"edge"`, `"tor"`, or specific versions like `"chrome110"` |
| `http3` | `False` | Use HTTP/3 |
| `cookies` | `None` | Dict or list of dicts |
| `proxy` | `None` | `"http://user:pass@host:port"` |
| `proxies` | `None` | `{"http": url, "https": url}` |
| `proxy_rotator` | `None` | `ProxyRotator` instance |
| `headers` | `None` | Additional/override headers |
| `verify` | `True` | Verify HTTPS certificates |
| `selector_config` | `None` | Per-request parser config dict |

### Practical Examples

```python
from scrapling.fetchers import Fetcher

# Check status and extract
page = Fetcher.get('https://example.com')
if page.status == 200:
    title = page.css('title::text').get()
    links = page.css('a::attr(href)').getall()

# JSON API
page = Fetcher.get('https://api.github.com/events')
data = page.json()

# Download binary file
page = Fetcher.get('https://example.com/image.png')
with open('image.png', 'wb') as f:
    f.write(page.body)

# Impersonate a specific browser
page = Fetcher.get('https://example.com', impersonate='firefox')

# With authentication
page = Fetcher.get('https://example.com/secure', auth=('user', 'pass'))

# With custom params
page = Fetcher.get('https://example.com/search', params={'q': 'scrapling'})

# Form login
page = Fetcher.post('https://example.com/login', data={
    'username': 'user@example.com',
    'password': 'secret123'
})
```

---

## 4. Fetcher: Dynamic Browser

```python
from scrapling.fetchers import DynamicFetcher

# Basic — Chromium
page = DynamicFetcher.fetch('https://example.com')

# Wait for network to be idle (all XHR/fetch done)
page = DynamicFetcher.fetch('https://example.com', network_idle=True)

# Wait for a CSS selector to appear before returning
page = DynamicFetcher.fetch('https://example.com', wait_selector='div.loaded')

# Headless mode (default True)
page = DynamicFetcher.fetch('https://example.com', headless=True)
```

**Use `DynamicFetcher` when:** the page loads content via JavaScript (React, Vue, Angular SPAs) and `Fetcher` returns empty containers.

---

## 5. Fetcher: Stealthy Browser

```python
from scrapling.fetchers import StealthyFetcher

# Basic stealth fetch
page = StealthyFetcher.fetch('https://example.com', headless=True, network_idle=True)

# Enable adaptive scraping (elements survive page redesigns)
StealthyFetcher.adaptive = True
page = StealthyFetcher.fetch('https://example.com', headless=True)

# Auto-solve Cloudflare Turnstile/Interstitial
page = StealthyFetcher.fetch('https://cloudflare-protected-site.com',
    headless=True,
    solve_cloudflare=True,
    block_webrtc=True,
    hide_canvas=True,
    google_search=True,
)
```

**Use `StealthyFetcher` when:** `DynamicFetcher` gets blocked, the site uses Cloudflare, or bot detection is sophisticated.

---

## 6. Session Management

Use sessions when making multiple requests to avoid re-initializing connections or browsers on each call.

### FetcherSession (HTTP)

```python
from scrapling.fetchers import FetcherSession, ProxyRotator

# Basic session — sync and async work without changing import
with FetcherSession(impersonate='chrome', timeout=30, retries=3) as session:
    page1 = session.get('https://example.com/page1')
    page2 = session.post('https://example.com/submit', data={'key': 'value'})
    page3 = session.get('https://api.example.com/data')
    # Cookies are shared automatically across all requests

# With proxy rotation
rotator = ProxyRotator([
    'http://proxy1:8080',
    'http://proxy2:8080',
    'http://user:pass@proxy3:8080',
])
with FetcherSession(proxy_rotator=rotator, impersonate='chrome') as session:
    page = session.get('https://example.com')
    print(page.meta['proxy'])  # Which proxy was used

# Async session
async with FetcherSession(impersonate='firefox') as session:
    tasks = [session.get(url) for url in urls]
    pages = await asyncio.gather(*tasks)
```

**Session benefits:**
- 10x faster than creating a new session per request
- Cookie persistence across requests
- Connection pooling
- Centralized configuration

### ProxyRotator

```python
from scrapling.fetchers import ProxyRotator
import random

# Default: cyclic rotation
rotator = ProxyRotator(['http://p1:8080', 'http://p2:8080', 'http://p3:8080'])

# Custom random rotation
def random_strategy(proxies, current_index):
    idx = random.randint(0, len(proxies) - 1)
    return proxies[idx], idx

rotator = ProxyRotator(['http://p1:8080', 'http://p2:8080'], strategy=random_strategy)

# For browser sessions (Playwright format)
rotator = ProxyRotator([
    {"server": "http://p1:8080", "username": "user", "password": "pass"},
    {"server": "http://p2:8080"},
])
```

---

## 7. Parsing & Element Selection

Every `Fetcher.fetch()` / `Fetcher.get()` call returns a `Response` object, which is also a `Selector`. All parsing methods work on both.

### CSS Selectors

```python
page = Fetcher.get('https://example.com')

# Select all elements with class 'product'
products = page.css('.product')

# Get first element
product = page.css('.product')[0]

# Get text of first h1
title = page.css('h1::text').get()           # Returns string or None
title = page.css('h1::text').get('')         # Returns '' if not found

# Get all texts
all_titles = page.css('h1::text').getall()  # Returns list

# Get attribute
href = page.css('a::attr(href)').get()

# Nested selectors
price = page.css('.product')[0].css('.price::text').get()

# CSS contains pseudo-class
heading = page.css('h1:contains("Welcome")::text').get()
```

### XPath Selectors

```python
products = page.xpath('//*[@class="product"]')
title = page.xpath('//h1//text()').get()
href = page.xpath('//a/@href').get()
```

### Text Search

```python
# Exact match
el = page.find_by_text('Add to Cart')

# Partial match (contains)
els = page.find_by_text('Cart', partial=True, first_match=False)

# Case-sensitive
els = page.find_by_text('the', partial=True, case_sensitive=True, first_match=False)
```

### Regex Search

```python
import re

# Find element whose text matches regex
el = page.find_by_regex(r'£[\d\.]+')
print(el.text)  # '£51.77'

# All matches
prices = page.find_by_regex(r'£[\d\.]+', first_match=False)
print([e.text for e in prices])

# Compiled regex also works
pattern = re.compile(r'£[\d\.]+')
el = page.find_by_regex(pattern)
```

### Filter-Based Search (`find` / `find_all`)

Inspired by BeautifulSoup. Any argument type maps to a filter:
- `str` → tag name
- `list/tuple/set` → multiple tag names
- `dict` → attribute filters (supports CSS attribute operators: `$`, `*`, `^`)
- `re.Pattern` → regex on content
- `callable` → function filter

```python
page = Fetcher.get('https://quotes.toscrape.com/')

# All div elements
page.find_all('div')

# div with class='quote'
page.find_all('div', class_='quote')

# Same using dict
page.find_all('div', {'class': 'quote'})

# With function filter
page.find_all('div', {'class': 'quote'}, lambda e: 'world' in e.css('.text::text').get(''))

# Tag name + attribute + regex
page.find_all('span', re.compile(r'world'))

# Multiple tag names
page.find_all(['div', 'span'], {'class': 'quote'})

# Attribute ending with value (CSS $= operator)
page.find_all({'href$': 'Einstein'})

# Attribute containing value (CSS *= operator)
page.find_all({'href*': '/author/'})

# Elements with children
page.find_all(lambda el: len(el.children) > 0)

# Single result (returns first match)
el = page.find('div', class_='quote')
```

### Finding Similar Elements

Use this to extract all items in a repeating pattern (product cards, table rows, etc.) by example:

```python
# Find one item, then find all similar ones
first_product = page.find_by_text('Add to Cart').find_ancestor(
    lambda e: e.has_class('product-card')
)
all_products = first_product.find_similar()

# Ignore volatile attributes like href/src during matching
similar = element.find_similar(ignore_attributes=['title', 'href'])

# Navigate to parent and find siblings
sibling_containers = element.parent.parent.find_similar()

# Extract data from all similar elements
for product in all_products:
    print({
        'name': product.css('h3::text').get(),
        'price': product.css('.price::text').re_first(r'[\d\.]+'),
    })
```

### Regex on Results

```python
# Extract regex from selected text
price = page.css('.price')[0].re_first(r'[\d\.]+')  # '51.77'
all_prices = page.css('.price').re(r'[\d\.]+')       # ['51.77', '53.74', ...]

# Regex on attribute string
slugs = page.css('.product a::attr(href)').re(r'catalogue/(.*)/index.html')
```

### Selector Generation

```python
el = page.find({'href*': '/author/'})

el.generate_css_selector        # Short CSS (unique ID if found)
el.generate_full_css_selector   # Full CSS from body
el.generate_xpath_selector      # Short XPath
el.generate_full_xpath_selector # Full XPath from body
```

---

## 8. Spider Framework — Architecture

The spider system is a Scrapy-inspired async crawling framework built on top of Scrapling's fetchers.

### Data Flow

```
start_urls / start_requests()
        ↓
   [Scheduler] — priority queue + deduplication
        ↓
 [Crawler Engine] — concurrency control, delay, stats
        ↓
 [Session Manager] — routes request to correct session (HTTP / Browser / Stealth)
        ↓
   [Session] — fetches page → Response
        ↓
 [Crawler Engine] — checks for block, retries if needed
        ↓
   callback(response) — yields dicts (items) or Request objects
        ↓
 Items → ItemList   |   Requests → Scheduler (loop)
```

### Scrapy vs Scrapling Spider Comparison

| Concept | Scrapy | Scrapling |
|---|---|---|
| Spider base class | `scrapy.Spider` | `scrapling.spiders.Spider` |
| Initial requests | `start_requests()` | `async start_requests()` |
| Callbacks | `def parse(self, response)` | `async def parse(self, response)` |
| Following links | `response.follow(url)` | `response.follow(url)` |
| Item output | `yield dict` or `yield Item` | `yield dict` |
| Concurrency | `CONCURRENT_REQUESTS` | `concurrent_requests` class attr |
| Domain filter | `allowed_domains` | `allowed_domains` |
| Pause/Resume | `JOBDIR` | `crawldir` constructor arg |
| Export | Feed exports | `result.items.to_json()` |
| Streaming | N/A | `async for item in spider.stream()` |
| Multi-session | N/A | Multiple typed sessions per spider |
| Item pipeline | Item Pipelines | `on_scraped_item()` hook |
| Block detection | Custom middlewares | Built-in `is_blocked()` hook |

---

## 9. Spider: Getting Started

### Minimal Spider

```python
from scrapling.spiders import Spider, Response

class QuotesSpider(Spider):
    name = "quotes"
    start_urls = ["https://quotes.toscrape.com"]

    async def parse(self, response: Response):
        for quote in response.css("div.quote"):
            yield {
                "text": quote.css("span.text::text").get(""),
                "author": quote.css("small.author::text").get(""),
            }

# Run it
result = QuotesSpider().start()
```

**Three required things:** `name`, `start_urls`, `async def parse()`.

### Running & Accessing Results

```python
result = QuotesSpider().start()

# Access items
for item in result.items:
    print(item["text"], "-", item["author"])

# Export
result.items.to_json("quotes.json", indent=True)
result.items.to_jsonl("quotes.jsonl")

# Stats
print(f"Items: {result.stats.items_scraped}")
print(f"Requests: {result.stats.requests_count}")
print(f"Duration: {result.stats.elapsed_seconds:.1f}s")
print(f"Completed: {result.completed}")
```

### Following Links (Pagination)

```python
async def parse(self, response: Response):
    # Extract items on current page
    for quote in response.css("div.quote"):
        yield {
            "text": quote.css("span.text::text").get(""),
            "author": quote.css("small.author::text").get(""),
        }

    # Follow next page
    next_page = response.css("li.next a::attr(href)").get()
    if next_page:
        yield response.follow(next_page, callback=self.parse)
```

### Multiple Callbacks

```python
async def parse(self, response: Response):
    # Route product links to a different callback
    for link in response.css("a.product-link::attr(href)").getall():
        yield response.follow(link, callback=self.parse_product)

async def parse_product(self, response: Response):
    yield {
        "name": response.css("h1::text").get(""),
        "price": response.css(".price::text").get(""),
    }
```

> **Rule**: All callback methods MUST be `async def` and MUST use `yield`.

### Domain Filtering

```python
class MySpider(Spider):
    name = "my_spider"
    start_urls = ["https://example.com"]
    allowed_domains = {"example.com"}  # Also matches sub.example.com

    async def parse(self, response: Response):
        for link in response.css("a::attr(href)").getall():
            yield response.follow(link, callback=self.parse)
        # Links to external domains are silently dropped (counted in stats.offsite_requests_count)
```

### Custom Start Requests (POST, auth, etc.)

```python
from scrapling.spiders import Spider, Response, Request

class AuthSpider(Spider):
    name = "auth_spider"

    async def start_requests(self):
        yield Request(
            "https://example.com/login",
            method="POST",
            data={"user": "admin", "pass": "secret"},
            callback=self.after_login,
        )

    async def after_login(self, response: Response):
        yield response.follow("/dashboard", callback=self.parse)

    async def parse(self, response: Response):
        yield {"title": response.css("h1::text").get("")}
```

---

## 10. Spider: Sessions (Multi-Fetcher)

By default, every spider uses a single `FetcherSession`. Override `configure_sessions()` to add more.

### Available Session Types (Spider Context)

| Session Class | Use Case |
|---|---|
| `FetcherSession` | Fast HTTP, no JavaScript |
| `AsyncDynamicSession` | Browser, JS rendering |
| `AsyncStealthySession` | Anti-bot, Cloudflare bypass |

### Mixed Session Spider

```python
from scrapling.spiders import Spider, Response
from scrapling.fetchers import FetcherSession, AsyncStealthySession

class ProductSpider(Spider):
    name = "products"
    start_urls = ["https://shop.example.com/products"]

    def configure_sessions(self, manager):
        # Default: fast HTTP for listing pages
        manager.add("http", FetcherSession())

        # Stealth: for protected product detail pages (lazy = starts only when first used)
        manager.add("stealth", AsyncStealthySession(headless=True, network_idle=True), lazy=True)

    async def parse(self, response: Response):
        for link in response.css("a.product::attr(href)").getall():
            # Route to stealth session via sid=
            yield response.follow(link, sid="stealth", callback=self.parse_product)

        next_page = response.css("a.next::attr(href)").get()
        if next_page:
            yield response.follow(next_page)  # Inherits current session (http)

    async def parse_product(self, response: Response):
        yield {
            "name": response.css("h1::text").get(""),
            "price": response.css(".price::text").get(""),
        }
```

### `manager.add()` Arguments

| Argument | Type | Default | Description |
|---|---|---|---|
| `session_id` | `str` | required | Name to reference this session |
| `session` | Session instance | required | The session object |
| `default` | `bool` | `False` | Make this the default (first added is default) |
| `lazy` | `bool` | `False` | Start session only on first use |

### Per-Request Session Arguments

```python
async def parse(self, response: Response):
    # Override browser arguments per request
    yield response.follow(
        "/dynamic-page",
        sid="browser",
        callback=self.parse_dynamic,
        wait_selector="div.loaded",
        network_idle=True,
    )

    # Cloudflare bypass on specific request
    yield Request(
        "https://protected.example.com/data",
        sid="stealth",
        callback=self.parse_result,
        solve_cloudflare=True,
        block_webrtc=True,
    )

    # POST via FetcherSession in spider
    yield Request(
        "https://api.example.com/data",
        method="POST",
        data={"field": "value"},
        headers={"Authorization": "Bearer token123"},
        callback=self.parse_api,
    )
```

> **Important**: In spiders, HTTP method is set via `method=` on `Request`, not via `.get()` / `.post()` methods.

---

## 11. Spider: Proxy Rotation & Block Handling

### ProxyRotator in Spider Sessions

```python
from scrapling.spiders import Spider, Response
from scrapling.fetchers import FetcherSession, ProxyRotator

class MySpider(Spider):
    name = "proxied"
    start_urls = ["https://example.com"]

    def configure_sessions(self, manager):
        rotator = ProxyRotator([
            "http://proxy1:8080",
            "http://proxy2:8080",
            "http://user:pass@proxy3:8080",
        ])
        manager.add("default", FetcherSession(proxy_rotator=rotator))

    async def parse(self, response: Response):
        print(f"Proxy used: {response.meta.get('proxy')}")
        yield {"title": response.css("title::text").get("")}
```

### Per-Request Proxy Override

```python
async def parse(self, response: Response):
    # Uses rotator's next proxy
    yield response.follow("/page1", callback=self.parse_page)

    # Override with specific proxy
    yield response.follow(
        "/geo-restricted",
        callback=self.parse_page,
        proxy="http://us-proxy:8080",
    )
```

### Custom Block Detection

Default blocked status codes: `401, 403, 407, 429, 444, 500, 502, 503, 504`

```python
async def is_blocked(self, response: Response) -> bool:
    if response.status in {403, 429, 503}:
        return True

    body = response.body.decode("utf-8", errors="ignore")
    if "access denied" in body.lower() or "rate limit" in body.lower():
        return True

    return False
```

### Escalating Retry Strategy (Cheap → Expensive Proxies)

```python
from scrapling.spiders import Spider, SessionManager, Request, Response
from scrapling.fetchers import FetcherSession, AsyncStealthySession, ProxyRotator

cheap_proxies = ProxyRotator(["http://dc1:8080", "http://dc2:8080"])
expensive_proxies = ProxyRotator([
    {"server": "http://res1:8080", "username": "u", "password": "p"},
    {"server": "http://mobile1:8080", "username": "u", "password": "p"},
])

class MySpider(Spider):
    name = "smart_proxy"
    start_urls = ["https://example.com"]
    max_blocked_retries = 5

    def configure_sessions(self, manager: SessionManager):
        manager.add('requests', FetcherSession(
            impersonate=['chrome', 'firefox', 'safari'],
            proxy_rotator=cheap_proxies
        ))
        manager.add('stealth', AsyncStealthySession(
            block_webrtc=True,
            proxy_rotator=expensive_proxies
        ), lazy=True)

    async def retry_blocked_request(self, request: Request, response: Response) -> Request:
        # Escalate to stealth + expensive proxies when blocked
        request.sid = "stealth"
        self.logger.info(f"Escalating to stealth: {request.url}")
        return request

    async def parse(self, response: Response):
        yield {"title": response.css("title::text").get("")}
```

---

## 12. Spider: Advanced Features

### Concurrency Control

```python
class PoliteSpider(Spider):
    name = "polite"
    start_urls = ["https://example.com"]

    concurrent_requests = 4             # Global max (default: 4)
    concurrent_requests_per_domain = 2  # Per-domain max (default: 0 = unlimited)
    download_delay = 1.0                # Seconds between requests
```

### Pause & Resume

```python
# Enable checkpointing — saves state to disk
spider = MySpider(crawldir="crawl_data/my_spider")
result = spider.start()

if result.paused:
    print("Paused. Run again to resume.")
else:
    print("Done!")

# Change checkpoint interval (default: 5 minutes)
spider = MySpider(crawldir="crawl_data/my_spider", interval=120.0)  # every 2 min
```

**How it works:**
1. Press `Ctrl+C` → graceful shutdown, saves checkpoint
2. Press `Ctrl+C` again → immediate stop
3. Run again with same `crawldir` → resumes from checkpoint
4. Completes normally → checkpoint files auto-deleted

### Streaming Mode (Real-Time)

```python
import anyio

async def main():
    spider = MySpider(crawldir="crawl_data/my_spider")  # optional pause/resume
    async for item in spider.stream():
        print(f"Got: {item}")
        # Real-time stats
        print(f"Items so far: {spider.stats.items_scraped}")
        print(f"Requests: {spider.stats.requests_count}")

anyio.run(main)
```

### Lifecycle Hooks

```python
class MySpider(Spider):
    name = "hooked"
    start_urls = ["https://example.com"]

    async def on_start(self, resuming: bool = False):
        """Called before crawl begins."""
        if resuming:
            self.logger.info("Resuming from checkpoint")
        # Initialize DB connections, load data, etc.

    async def on_close(self):
        """Called after crawl finishes (completed or paused)."""
        # Close DB connections, flush buffers, etc.

    async def on_error(self, request: Request, error: Exception):
        """Called when a request fails."""
        self.logger.error(f"Failed: {request.url} — {error}")

    async def on_scraped_item(self, item: dict) -> dict | None:
        """Called for every yielded item. Return None to drop it."""
        if not item.get("title"):
            return None  # Drop items without title
        item["scraped_at"] = "2026-01-01"
        return item

    async def parse(self, response: Response):
        yield {"title": response.css("h1::text").get("")}
```

### Statistics

```python
result = MySpider().start()
stats = result.stats

# Core counts
stats.requests_count
stats.failed_requests_count
stats.blocked_requests_count
stats.offsite_requests_count
stats.items_scraped
stats.items_dropped
stats.response_bytes
stats.elapsed_seconds
stats.requests_per_second

# Breakdowns
stats.response_status_count     # {'status_200': 150, 'status_404': 3}
stats.domains_response_bytes    # {'example.com': 1234567}
stats.sessions_requests_count   # {'http': 120, 'stealth': 34}
stats.proxies                   # ['http://proxy1:8080', ...]
stats.log_levels_counter        # {'debug': 200, 'info': 50, 'error': 1}

# Timing
stats.start_time
stats.end_time
stats.download_delay

# Custom stats (set in your spider code via self.stats.custom_stats)
stats.custom_stats              # {'login_attempts': 3}

# Export all as dict
stats.to_dict()
```

### Logging

```python
import logging

class MySpider(Spider):
    name = "my_spider"
    start_urls = ["https://example.com"]
    logging_level = logging.INFO          # Default: DEBUG
    log_file = "logs/my_spider.log"       # Optional file output

    async def parse(self, response: Response):
        self.logger.info(f"Processing {response.url}")
        yield {"title": response.css("title::text").get("")}
```

### Using uvloop for better performance

```python
result = MySpider().start(use_uvloop=True)
# Requires: pip install uvloop (Linux/macOS) or winloop (Windows)
```

---

## 13. Response Object Reference

Every fetcher and spider callback receives a `Response` object, which extends `Selector`.

```python
page.status           # int: HTTP status code (200, 404, etc.)
page.reason           # str: Status message ('OK', 'Not Found')
page.cookies          # dict: Response cookies
page.headers          # dict: Response headers
page.request_headers  # dict: Request headers sent
page.history          # list: Redirect history
page.body             # bytes: Raw response body
page.encoding         # str: Response encoding
page.meta             # dict: Metadata (e.g., {'proxy': 'http://...'})
page.url              # str: Final URL (after redirects)

# JSON helper
page.json()           # Parse body as JSON

# URL helpers
page.urljoin('/relative/path')  # Joins relative URL with base URL

# All Selector methods available:
page.css(selector)
page.xpath(selector)
page.find(...)
page.find_all(...)
page.find_by_text(text)
page.find_by_regex(pattern)
```

---

## 14. Quick-Reference Cheat Sheet

### Fetcher Selection

```python
# Static HTML / API
from scrapling.fetchers import Fetcher
page = Fetcher.get(url)

# JavaScript-rendered content
from scrapling.fetchers import DynamicFetcher
page = DynamicFetcher.fetch(url, network_idle=True)

# Cloudflare / heavy anti-bot
from scrapling.fetchers import StealthyFetcher
page = StealthyFetcher.fetch(url, headless=True, solve_cloudflare=True)
```

### Element Extraction

```python
page.css('h1::text').get()                    # First text, or None
page.css('h1::text').get('')                  # First text, or ''
page.css('h1::text').getall()                 # All texts as list
page.css('a::attr(href)').get()               # First attribute
page.css('.price').re_first(r'[\d\.]+')       # Regex on first element
page.css('.price').re(r'[\d\.]+')             # Regex on all elements
page.find_by_text('Buy Now')                  # Exact text match
page.find_by_text('Buy', partial=True)        # Partial text match
page.find({'href*': '/product/'})             # Attribute contains
page.find_all('div', class_='card')           # By tag + attribute
element.find_similar()                        # All similar sibling elements
```

### Spider Skeleton

```python
from scrapling.spiders import Spider, Response, Request
from scrapling.fetchers import FetcherSession, AsyncStealthySession, ProxyRotator

class MySpider(Spider):
    name = "my_spider"
    start_urls = ["https://example.com"]
    allowed_domains = {"example.com"}

    concurrent_requests = 8
    concurrent_requests_per_domain = 2
    download_delay = 0.5
    max_blocked_retries = 3

    def configure_sessions(self, manager):
        manager.add("http", FetcherSession(impersonate="chrome"))
        manager.add("stealth", AsyncStealthySession(headless=True), lazy=True)

    async def on_start(self, resuming=False):
        self.logger.info(f"Starting (resuming={resuming})")

    async def on_scraped_item(self, item):
        return item if item.get("title") else None

    async def is_blocked(self, response):
        return response.status in {403, 429, 503}

    async def retry_blocked_request(self, request, response):
        request.sid = "stealth"
        return request

    async def parse(self, response: Response):
        for link in response.css("a.item::attr(href)").getall():
            yield response.follow(link, callback=self.parse_item)

        next_page = response.css("a.next::attr(href)").get()
        if next_page:
            yield response.follow(next_page, callback=self.parse)

    async def parse_item(self, response: Response):
        yield {
            "title": response.css("h1::text").get(""),
            "price": response.css(".price::text").re_first(r"[\d\.]+"),
            "url": response.url,
        }

# Run
result = MySpider(crawldir="crawl_data/my_spider").start()
result.items.to_json("output.json", indent=True)
print(result.stats.to_dict())
```

---

## Implementation Notes for Agents

1. **Import path**: Always use `from scrapling.fetchers import ...` for fetchers and `from scrapling.spiders import Spider, Response, Request` for spiders.
2. **All spider callbacks are async generators** — they must use `async def` and `yield`, not `return`.
3. **`response.follow()`** inherits the session ID and kwargs from the parent request unless overridden.
4. **In spider sessions**, HTTP method defaults to GET — use `method="POST"` on `Request()` explicitly.
5. **`lazy=True`** on a session means the browser starts only when the first request with that `sid` arrives. Use it for expensive sessions (browser/stealth) that may not always be needed.
6. **`proxy_rotator` clears previous proxy kwargs** automatically on blocked retries, so the rotator assigns a fresh one.
7. **`on_scraped_item()`** returning `None` drops the item from results — use it as your item pipeline.
8. **`crawldir`** enables both pause/resume AND periodic checkpoints. Set it any time you run a spider that might be long-running.
9. **Adaptive scraping**: Set `StealthyFetcher.adaptive = True` before fetching to enable element auto-relocation after page design changes.
10. **`result.items`** is an `ItemList` (list subclass) with `.to_json()` and `.to_jsonl()` methods — both create parent directories automatically.
