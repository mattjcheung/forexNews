const { createClient } = require('redis');
const { Pool } = require('pg');
const OpenAI = require('openai');
const axios = require('axios');
const xml2js = require('xml2js');

// Configuration from .env
const redisClient = createClient({ url: process.env.REDIS_URL });
const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FEEDS = [
    { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/rss/topstories' },
    { name: 'CNBC Markets', url: 'https://www.cnbc.com/id/15839069/device/rss/rss.html' },
    { name: 'Investing.com', url: 'https://www.investing.com/rss/news_1.rss' } 
];

async function startWorker() {
    let connected = false;

    // 1. BOOTSTRAP: Connect and Setup Schema
    while (!connected) {
        try {
            if (!redisClient.isOpen) await redisClient.connect();
            const client = await pgPool.connect();
            
            console.log("🛠️ [Worker] Ensuring pgvector and 1536-dim table exist...");
            await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
            
            // We create the 'market_news' table for the RAG data
            await client.query(`
                CREATE TABLE IF NOT EXISTS market_news (
                    id serial PRIMARY KEY,
                    content text,
                    embedding vector(1536),
                    source text,
                    link text,
                    priority_score INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            client.release();
            connected = true;
            console.log("✅ [Worker] Infrastructure Ready.");
        } catch (err) {
            console.error(`❌ [Worker] Bootstrapping failed: ${err.message}. Retrying...`);
            await new Promise(res => setTimeout(res, 2000));
        }
    }

    // Initial scrape on startup
    console.log("🚀 [Worker] Running initial startup scrape...");
    processNewsIngestion();

    // 2. MAIN TASK LOOP
    console.log("📡 [Worker] Waiting for tasks in Redis...");
    while (true) {
        try {
            const task = await redisClient.brPop('tasks', 0);
            if (task.element === 'INGEST_NEWS') {
                console.log("🔍 [Worker] Triggering Live Scrape...");
                await processNewsIngestion();
            }
        } catch (err) {
            console.error("⚠️ [Worker] Loop Error:", err.message);
        }
    }
}

function calculatePriority(text) {
    const highImpact = ['fed', 'interest rate', 'fomc', 'cpi', 'nfp', 'inflation', 'powell', 'central bank'];
    const medImpact = ['gdp', 'unemployment', 'pmi', 'retail sales', 'trade balance', /\b[A-Z]{3}\/[A-Z]{3}\b/];

    let score = 0;
    const lowerText = text.toLowerCase();

    highImpact.forEach(word => {
        if (lowerText.includes(word)) score += 100;
    });

    medImpact.forEach(item => {
        if (typeof item === 'string') {
            if (lowerText.includes(item)) score += 50;
        } else {
            if (item.test(text)) score += 50;
        }
    });

    return score;
}

async function processNewsIngestion() {
    for (const feed of FEEDS) {
        try {
            const response = await axios.get(feed.url);
            const parser = new xml2js.Parser();
            const result = await parser.parseStringPromise(response.data);
            const items = result.rss.channel[0].item.slice(0, 5); // Take top 5

            for (const item of items) {
                const title = item.title ? item.title[0] : 'Market Update';
                const link = item.link ? item.link[0] : '#';
                const description = item.description ? item.description[0] : '';
                const fullContent = `${title}. ${description}`;
                
                const priority = calculatePriority(fullContent);

                const embeddingResponse = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: fullContent,
                });
                const vector = embeddingResponse.data[0].embedding;

                await pgPool.query(
                    `INSERT INTO market_news (content, embedding, source, link, priority_score) 
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT DO NOTHING`, 
                    [fullContent, JSON.stringify(vector), feed.name, link, priority]
                );
            }
        } catch (e) {
            console.error(`❌ Error scraping ${feed.name}:`, e.message);
        }
    }
}

startWorker();