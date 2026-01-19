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
    
    // Clear the container
    container.innerHTML = '';

    // If script isn't loaded, load it. If it is, just create the widget.
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
    // Small timeout ensures the DOM element is ready for the library
    setTimeout(() => {
        if (document.getElementById('tradingview_widget')) {
            new TradingView.widget({
                "autosize": true, // This is better than "100%" for grid layouts
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

// Logic: Max 5, FIFO, and Jump duplicates to top
document.getElementById('addSymbolBtn').addEventListener('click', () => {
    const input = document.getElementById('newSymbol');
    const symbol = input.value.toUpperCase().trim();
    if (!symbol) return;

    const existingIndex = watchlist.findIndex(i => i.symbol === symbol);
    if (existingIndex > -1) {
        watchlist.splice(existingIndex, 1); // Remove duplicate
    } else if (watchlist.length >= 5) {
        watchlist.pop(); // FIFO: Remove oldest
    }

    watchlist.unshift({ label: symbol, symbol: symbol }); // Add to top
    input.value = '';
    renderWatchlist();
    loadChart(symbol);
});

// RHS Chatbot Toggle Logic
const mainLayout = document.getElementById('mainLayout');
const toggleBtn = document.getElementById('toggleRHS');

toggleBtn.addEventListener('click', () => {
    // 1. Toggle the class on the layout
    const isCollapsed = mainLayout.classList.toggle('rhs-collapsed');
    
    // 2. Update the button text based on the new state
    if (isCollapsed) {
        toggleBtn.textContent = 'Open AI Assistant';
        toggleBtn.classList.remove('active'); // Optional: for styling
    } else {
        toggleBtn.textContent = 'Close Assistant';
        toggleBtn.classList.add('active');    // Optional: for styling
    }
});

// Simple Chatbot Display Logic
document.getElementById('sendBtn').addEventListener('click', () => {
    const input = document.getElementById('ragInput');
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    input.value = '';

    // Placeholder for AI response
    setTimeout(() => {
        appendMessage('ai', "Servers are down. Please try again later.");
    }, 800);
});

function appendMessage(sender, text) {
    const history = document.getElementById('chatHistory');
    const div = document.createElement('div');
    div.className = `msg ${sender}-msg`;
    div.innerText = text;
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;
}

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

// --- PERIODIC REPORT LOGIC ---
async function loadMarketReport() {
    const reportText = document.getElementById('summaryText'); // Ensure this ID exists in HTML
    const timeLabel = document.getElementById('lastUpdated');  // Ensure this ID exists in HTML
    
    const resp = await fetch('/api/market-report');
    const data = await resp.json();
    
    reportText.innerText = data.report;
    timeLabel.innerText = `Last Updated: ${new Date(data.timestamp).toLocaleTimeString()}`;
}

async function sendChat() {
    const input = document.getElementById('ragInput');
    const history = document.getElementById('chatHistory');
    const msg = input.value;
    if(!msg) return;

    history.innerHTML += `<div class="msg user-msg">${msg}</div>`;
    input.value = "";

    const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ message: msg })
    });
    const data = await resp.json();
    history.innerHTML += `<div class="msg ai-msg">${data.reply}</div>`;
    history.scrollTop = history.scrollHeight;
}

document.getElementById('sendBtn').onclick = sendChat;

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