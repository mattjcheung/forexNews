const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const { createClient } = require("redis");
const OpenAI = require('openai');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// 1. Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 2. Redis Connection (The "Messenger")
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis Client Error', err));

// Connect to Redis immediately + bootstrap DB
(async () => {
    try {
        await redisClient.connect();
        console.log("✅ Gateway connected to Redis");

        // --- NEW RETRY LOGIC ---
        let client;
        let retries = 5;
        while (retries) {
            try {
                client = await pool.connect();
                console.log("✅ Gateway connected to Postgres");
                break; // Success!
            } catch (err) {
                retries -= 1;
                console.log(`🟡 DB not ready, retrying... (${retries} attempts left)`);
                if (retries === 0) throw err;
                await new Promise(res => setTimeout(res, 3000)); // Wait 3 seconds
            }
        }
        // -----------------------

        await client.query(`
            CREATE TABLE IF NOT EXISTS global_reports (
                id serial PRIMARY KEY,
                report_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        client.release();

    } catch (err) {
        console.error("❌ Fatal Gateway Error:", err);
        process.exit(1);
    }
})();

// --- API ENDPOINTS ---

// GET: Live Feed
app.get("/api/intel-feed", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT content as summary, created_at, source, link, priority_score 
      FROM market_news 
      WHERE created_at > NOW() - INTERVAL '24 hours'
      ORDER BY priority_score DESC, created_at DESC 
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ error: "System error" });
  }
});


// POST: Trigger the Scraper (Connects UI to Worker)
app.post("/api/trigger-scrape", async (req, res) => {
    try {
        console.log("⚡ Triggering manual scrape...");
        // Push the command to the 'tasks' queue where Worker is listening
        await redisClient.lPush('tasks', 'INGEST_NEWS');
        res.json({ status: "Scrape triggered", message: "Worker is processing..." });
    } catch (err) {
        console.error("Redis Error:", err);
        res.status(500).json({ error: "Failed to trigger scrape" });
    }
});

// GET: Fetch/Generate Cached Market Report (Budget Saver)
app.get("/api/market-report", async (req, res) => {
    try {
        const cached = await pool.query(`
            SELECT report_text, created_at FROM global_reports 
            WHERE created_at > NOW() - INTERVAL '3 hours' 
            ORDER BY created_at DESC LIMIT 1
        `);

        if (cached.rows.length > 0) {
            return res.json({ 
                report: cached.rows[0].report_text, 
                timestamp: cached.rows[0].created_at,
                isCached: true 
            });
        }
        
        const reportData = await generateAndStoreReport();
        res.json(reportData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Full Refresh (Scrape + Summarize)
app.post("/api/refresh-all", async (req, res) => {
    try {
        await redisClient.lPush('tasks', 'INGEST_NEWS');

        // Wait for worker to finish scrape
        setTimeout(async () => {
            const reportData = await generateAndStoreReport();
            res.json(reportData);
        }, 5000);

    } catch (err) {
        res.status(500).json({ error: "Refresh failed" });
    }
});

// POST: Thematic Chatbot
app.post("/api/chat", async (req, res) => {
    const { message } = req.body;
    try {
        // 1. Fetch the 10 most recent news items for context
        const newsResult = await pool.query(`
            SELECT content, source, created_at 
            FROM market_news 
            ORDER BY created_at DESC 
            LIMIT 10
        `);

        // 2. Format that news into a string
        const contextString = newsResult.rows
            .map(n => `[${n.source} - ${n.created_at}]: ${n.content}`)
            .join("\n");

        // 3. Send to OpenAI with the context included in the system prompt
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system", 
                    content: `You are APA INTEL, a Australian financial expert. 
                    Use the following recent news to answer the user's query. 
                    If the information isn't in the context, say you don't have data on that yet.
                    
                    CONTEXT:
                    ${contextString}` 
                },
                { role: "user", content: message }
            ]
        });

        res.json({ reply: completion.choices[0].message.content });
    } catch (err) {
        console.error("Chat error:", err);
        res.status(500).json({ error: "Chat error" });
    }
});

// Helper for Summarization
async function generateAndStoreReport() {
    const result = await pool.query(`
        SELECT content 
        FROM market_news 
        ORDER BY created_at DESC 
        LIMIT 15
    `);

    const context = result.rows.map(r => r.content).join("\n---\n");

    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
            { 
                role: "system", 
                content: "You are a senior analyst based in Australia. Summarize these headlines in 4 professional bullet points. Use ONLY the provided data." 
            },
            { role: "user", content: context }
        ]
    });

    const reportText = completion.choices[0].message.content;

    const saved = await pool.query(
        "INSERT INTO global_reports (report_text) VALUES ($1) RETURNING created_at", 
        [reportText]
    );

    return { 
        report: reportText, 
        timestamp: saved.rows[0].created_at, 
        isCached: false 
    };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Gateway Live on port ${PORT}`));