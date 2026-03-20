FROM python:3.12-slim

# Install system dependencies needed by Scrapling (Playwright, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

# Create a dedicated non-root user for the scraper
RUN groupadd --system scraper && useradd --system --gid scraper --no-create-home scraper

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Scrapling's browser dependencies (Playwright browsers & Camoufox)
# Must run as root before switching user
RUN scrapling install

COPY . .

# Hand ownership of the app directory to the non-root user
RUN chown -R scraper:scraper /app

# Switch to non-root user before starting the server
USER scraper

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
