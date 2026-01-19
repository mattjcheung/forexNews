# APA INTEL: Event-Driven Agentic RAG Platform

## Overview

APA INTEL is an **event-driven microservices platform** designed for real-time financial intelligence. Unlike standard "stateless" chat interfaces, this system maintains a **persistent, proprietary knowledge base** by separating high-frequency data ingestion from AI-driven reasoning.

The core objective is to provide a unified "Single Pane of Glass" for market news, combining raw live feeds with a "Senior Analyst" AI layer that summarizes the state of the market on demand.

---

## System Architecture

The platform is split into three distinct layers:

1. **The Intelligence Dashboard (Frontend):** A dark-themed, Bloomberg-style UI featuring dynamic HTML5 Canvas market visualizations, a real-time news feed, and an integrated TradingView technical analysis suite.
2. **The Orchestrator (Backend Gateway):** A Node.js API that manages the PostgreSQL connection, handles the OpenAI RAG pipeline, and dispatches scraper tasks via Redis.
3. **The Watchman (Worker Service):** An asynchronous worker that listens to the Redis task queue to perform high-frequency scraping and data normalization without blocking the user interface.

---

## Core Features

### 1. Hybrid Intelligence Feed

The system ingests raw market data into **PostgreSQL**. The UI provides a confidence-weighted feed where "High Impact" news is visually flagged based on priority scores generated during the ingestion phase.

### 2. Agentic Market Summarization

Instead of summarizing on every page load (which is slow and expensive), the system uses a **Budget-Saving Cache Strategy**:

* **Automatic Cache:** The system fetches a pre-generated report if it's less than 3 hours old.
* **Manual Override:** Users can trigger a "Full Refresh," which pushes an `INGEST_NEWS` command to Redis, waits for the worker, and then forces the OpenAI model to generate a fresh 4-point professional summary.

### 3. Integrated Technical Analysis

A dynamic Watchlist allows users to switch between various asset classes (Forex, Crypto, Indices). The system injects **TradingView SDK** widgets on the fly, allowing for immediate technical validation of the AI's textual insights.

### 4. Thematic AI Chat

An integrated "Senior Analyst" chatbot is restricted via system-level prompting to only discuss finance and markets. This ensures the platform remains a professional tool and prevents "hallucination drift" into non-financial topics.

---

## Technology Stack

| Component | Technology | Role |
| --- | --- | --- |
| **Frontend** | HTML5, CSS3, Vanilla JS | High-performance UI with Canvas animations |
| **API Gateway** | Node.js (Express) | Orchestration and OpenAI integration |
| **Messaging** | Redis | Event-driven task queue for scraping |
| **Database** | PostgreSQL | Persistent storage for news and AI reports |
| **LLM** | OpenAI GPT-3.5 Turbo | RAG-driven reasoning and summarization |
| **Charts** | TradingView SDK | Professional-grade technical analysis |

---

## Current Workflow Logic

1. **Ingestion:** The user or a cron job pushes a task to Redis.
2. **Scraping:** The "Watchman" worker pulls the task, scrapes financial sources, and populates the `market_news` table.
3. **Reasoning:** When a report is requested, the Gateway queries the latest 15 headlines, sends them to OpenAI with a "Senior Analyst" persona, and stores the result in `global_reports`.
4. **Delivery:** The UI pulls the latest report and live feed, updating the "Single Pane of Glass."

---

## How to Run

1. **Environment Variables:**
```env
DATABASE_URL=your_postgres_url
REDIS_URL=your_redis_url
OPENAI_API_KEY=your_key
PORT=3000

```


2. **Install & Start:**
```bash
npm install
npm start

```


3. **Initialize:** Click "Refresh AI & Scrape" on the dashboard to trigger the first data ingestion and report generation.

---

## Future Roadmap

* **Vector Search:** Implementing `pgvector` for historical semantic search across years of financial data.
* **WebSockets:** Replacing the 30-second polling with real-time "pushes" from the worker to the UI.
* **Multi-Model Support:** Adding Claude 3.5 Sonnet for deeper reasoning in the Market Summary phase.