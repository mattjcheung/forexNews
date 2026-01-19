// --- WATCHLIST & CHART LOGIC ---
let watchlist = [
    { label: "ASX: BANKS", symbol: "ASX:XJO" },
    { label: "AUD/USD", symbol: "FX:AUDUSD" },
    { label: "BITCOIN", symbol: "BINANCE:BTCUSDT" }
];

function renderWatchlist() {
    const container = document.getElementById('watchlistContainer');
    if (!container) return;
    
    container.innerHTML = watchlist.map((item, index) => `
        <div class="nav-item" onclick="selectWatchlistItem(this, '${item.symbol}')">
            ${item.label} <span class="pulse green"></span>
        </div>
    `).join('');
}

function loadChart(symbol) {
    const container = document.getElementById('tradingview_widget');
    if (!container) return;
    
    container.innerHTML = '';

    if (typeof TradingView === 'undefined') {
        const script = document.createElement('script');
        script.id = 'tradingview-sdk';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.onload = () => createWidget(symbol);
        document.head.appendChild(script);
    } else {
        createWidget(symbol);
    }
}

function createWidget(symbol) {
    setTimeout(() => {
        if (document.getElementById('tradingview_widget')) {
            new TradingView.widget({
                "autosize": true,
                "symbol": symbol,
                "interval": "D",
                "timezone": "Etc/UTC",
                "theme": "dark",
                "style": "1",
                "locale": "en",
                "toolbar_bg": "#f1f3f6",
                "enable_publishing": false,
                "hide_top_toolbar": true,
                "save_image": false,
                "container_id": "tradingview_widget"
            });
        }
    }, 100);
}

function selectWatchlistItem(el, symbol) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    el.classList.add('active');
    loadChart(symbol);
}

document.getElementById('addSymbolBtn').addEventListener('click', () => {
    const input = document.getElementById('newSymbol');
    const symbol = input.value.toUpperCase().trim();
    if (!symbol) return;

    const existingIndex = watchlist.findIndex(i => i.symbol === symbol);
    if (existingIndex > -1) {
        watchlist.splice(existingIndex, 1);
    } else if (watchlist.length >= 5) {
        watchlist.pop();
    }

    watchlist.unshift({ label: symbol, symbol: symbol });
    input.value = '';
    renderWatchlist();
    loadChart(symbol);
});

// --- UI TOGGLES ---
const mainLayout = document.getElementById('mainLayout');
const toggleBtn = document.getElementById('toggleRHS');

toggleBtn.addEventListener('click', () => {
    const isCollapsed = mainLayout.classList.toggle('rhs-collapsed');
    if (isCollapsed) {
        toggleBtn.textContent = 'Open AI Assistant';
        toggleBtn.classList.remove('active');
    } else {
        toggleBtn.textContent = 'Close Assistant';
        toggleBtn.classList.add('active');
    }
});

// --- CHATBOT LOGIC (INTEGRATED) ---
const chatHistory = document.getElementById('chatHistory');
const ragInput = document.getElementById('ragInput');
const sendBtn = document.getElementById('sendBtn');

async function handleChat() {
    const text = ragInput.value.trim();
    if (!text) return;

    // 1. Add User Message
    appendMessage('user', text);
    ragInput.value = '';

    // 2. Add Temporary Loading Message
    const loadingId = 'loading-' + Date.now();
    appendMessage('ai', "Analysing market data...", loadingId);

    try {
        // 3. Send to Backend
        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ message: text })
        });
        const data = await resp.json();

        // 4. Update Loading Message with Reply
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) {
            loadingEl.innerText = data.reply;
        } else {
            // Fallback if element was removed for some reason
            appendMessage('ai', data.reply);
        }
    } catch (err) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.innerText = "Error: Could not reach intelligence server.";
    }
}

function appendMessage(sender, text, id = null) {
    const div = document.createElement('div');
    div.className = `msg ${sender}-msg`;
    if (id) div.id = id;
    div.innerText = text;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Attach Event Listeners
sendBtn.onclick = handleChat;
ragInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleChat();
});

// --- REFRESH AI & SCRAPE BUTTON LOGIC ---
document.getElementById('refreshAllBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshAllBtn');
    const originalText = btn.innerText;
    
    // UI Feedback
    btn.innerText = "Processing Scrape & AI...";
    btn.disabled = true;

    try {
        // This calls the endpoint that triggers Redis AND generates a new AI Report
        const resp = await fetch('/api/refresh-all', { method: 'POST' });
        const data = await resp.json();

        // Update the UI with the new report immediately
        if (data.report) {
            document.getElementById('summaryText').innerText = data.report;
            document.getElementById('lastUpdated').innerText = `Last Updated: ${new Date(data.timestamp).toLocaleTimeString()}`;
        }

        // Refresh the news feed cards as well
        refreshFeed();

        btn.innerText = "System Updated";
        setTimeout(() => { 
            btn.innerText = originalText; 
            btn.disabled = false; 
        }, 3000);

    } catch (err) {
        console.error("Refresh All Error:", err);
        btn.innerText = "Error: Try Again";
        btn.disabled = false;
    }
});

// --- NEWS FEED LOGIC ---
async function refreshFeed() {
    try {
        const response = await fetch('/api/intel-feed');
        const cards = await response.json();
        const container = document.getElementById('intelCards');
        
        if (cards.length === 0) {
            container.innerHTML = `<div class="card"><p>No intelligence yet. Scrape running on startup...</p></div>`;
            return;
        }

        container.innerHTML = cards.map(card => `
            <div class="card" style="border-left: 4px solid ${card.priority_score > 50 ? 'var(--red)' : 'var(--accent)'}">
                <div class="meta">
                    ${card.source.toUpperCase()} • ${new Date(card.created_at).toLocaleTimeString()}
                    ${card.priority_score > 50 ? ' • <span style="color:var(--red)">HIGH IMPACT</span>' : ''}
                </div>
                <h4>${card.summary.split('.')[0]}</h4>
                <p>${card.summary.split('.').slice(1).join('.')}</p>
                <a href="${card.link}" target="_blank" class="action-btn">Read Original →</a>
            </div>
        `).join('');
    } catch (err) {
        console.error("Feed error:", err);
    }
}

// --- REPORT LOGIC ---
async function loadMarketReport() {
    const reportText = document.getElementById('summaryText');
    const timeLabel = document.getElementById('lastUpdated');
    
    if (!reportText || !timeLabel) return;

    const resp = await fetch('/api/market-report');
    const data = await resp.json();
    
    reportText.innerText = data.report;
    timeLabel.innerText = `Last Updated: ${new Date(data.timestamp).toLocaleTimeString()}`;
}

document.getElementById('refreshBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshBtn');
    const originalText = btn.innerText;
    btn.innerText = "Scraping...";
    btn.disabled = true;

    try {
        await fetch('/api/trigger-scrape', { method: 'POST' });
        setTimeout(() => {
            refreshFeed();
            btn.innerText = "Complete";
            setTimeout(() => { btn.innerText = originalText; btn.disabled = false; }, 2000);
        }, 5000);
    } catch (err) {
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

// Initial Load
renderWatchlist();
loadChart(watchlist[0].symbol);
refreshFeed();
loadMarketReport();
setInterval(refreshFeed, 30000);