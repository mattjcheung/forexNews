# Event-Driven Agentic RAG Platform

## Overview

This project implements an **event-driven microservices architecture** designed around an **agentic Retrieval-Augmented Generation (RAG) pipeline**.
The core philosophy is to **explicitly separate “thinking” (reasoning & orchestration)** from **“data gathering” (scraping, retrieval, and embedding)**.

Rather than treating AI as a stateless chat interface, this system continuously builds and maintains a **persistent, proprietary financial knowledge base** that improves in value over time.

The architecture is designed for:

* **High concurrency**
* **Low latency**
* **Auditability and compliance**
* **Cost-efficient AI usage**

---

## High-Level Architecture

```
┌──────────────┐
│   Dashboard  │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Orchestrator API │  (Node.js / TypeScript)
└──────┬───────────┘
       │ Redis Streams (events)
       ▼
┌──────────────┐     ┌──────────────┐
│  Watchman    │ ... │  Watchman    │  (Horizontal scaling)
│ (Scraping)   │     │ (Scraping)   │
└──────┬───────┘     └──────┬───────┘
       ▼                    ▼
┌──────────────────────────────────┐
│ PostgreSQL + pgvector            │
│ (Structured + Vector Data Store) │
└──────────────────────────────────┘
       │
       ▼
┌──────────────────┐
│  Reasoning Agent │
│  (Agentic RAG)   │
└──────┬───────────┘
       ▼
┌──────────────────┐
│ Semantic Cache   │
│ (Redis Vector)   │
└──────────────────┘
```

---

## Core Design Principles

### 1. Separation of Concerns (Agentic RAG)

The system enforces a strict boundary between:

* **Data Gathering**

  * Scraping
  * Normalization
  * Embedding
  * Storage

* **Reasoning**

  * Retrieval
  * Context assembly
  * Decision-making
  * Output generation

This prevents:

* Hallucinations caused by stale data
* Hidden coupling between reasoning and retrieval
* Non-auditable AI behaviour

---

### 2. Event-Driven by Default

All inter-service communication occurs through **Redis Streams**, enabling:

* Asynchronous workflows
* Backpressure handling
* Natural horizontal scaling
* Replayable events for debugging and compliance

No service ever blocks another.

---

### 3. Horizontal Scalability

The architecture is explicitly designed to scale **without architectural changes**.

Example:

* Run **10 Watchman services**
* Scrape **100+ data sources concurrently**
* Zero impact on user-facing latency

This makes the system suitable for real-time financial monitoring workloads.

---

### 4. Persistent Vector Knowledge Base

This is **not** a stateless chatbot.

All retrieved and processed information is embedded and stored in **PostgreSQL with pgvector**, allowing:

* Historical semantic search
* Long-term trend analysis
* Knowledge accumulation over time
* Reduced dependence on external APIs

Your data moat grows with every query.

---

### 5. Cost-Efficient AI Usage (Semantic Cache)

A **Semantic Cache** backed by **Redis Vector Library (Redis VL)** stores previous AI outputs.

If a new query is semantically similar to a past one:

* The cached result is returned instantly
* No LLM call is made
* Latency and inference costs are drastically reduced

This is critical for production-scale AI systems.

---

### 6. Auditability & Compliance

Every stage of the pipeline is logged:

* Retrieval
* Context selection
* Reasoning steps
* Final output

This design supports:

* Regulatory compliance
* Internal audits
* Explainability requirements for financial institutions (e.g. APA-style governance)

No black-box decisions.

---

## Technology Stack

| Component        | Technology                | Reasoning                                                 |
| ---------------- | ------------------------- | --------------------------------------------------------- |
| Orchestration    | Docker Compose            | Manages all services as a single reproducible ecosystem   |
| Primary Database | PostgreSQL + pgvector     | Combines structured financial data with vector embeddings |
| Messaging        | Redis Streams             | Low-latency, event-driven communication                   |
| Logic Layer      | Node.js (TypeScript)      | Type safety is critical for financial calculations        |
| Semantic Cache   | Redis Vector Library (VL) | Fast semantic lookup for cached AI responses              |

---

## Why This Architecture?

### ✅ Asynchronous Scalability

Services scale independently without coordination overhead.

### ✅ Financial-Grade Safety

Type safety, deterministic data flow, and full traceability.

### ✅ Cost Control

Semantic caching dramatically reduces repeated inference costs.

### ✅ Long-Term Value Creation

The system builds a growing, proprietary intelligence layer instead of ephemeral chat outputs.

---

## Status

🚧 **Draft / Early Architecture**
This repository currently focuses on architectural correctness and system design.
Implementation details may evolve as performance and compliance requirements are refined.

---

## Future Improvements

* Kubernetes deployment
* Fine-grained access control
* Model-agnostic LLM abstraction
* Automated embedding lifecycle management
* Time-decay weighting for financial relevance
