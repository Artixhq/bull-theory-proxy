const express = require('express');
const fetch   = require('node-fetch');
const app     = express();
const PORT    = process.env.PORT || 3000;

// Allow requests from your Netlify site
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  next();
});

// GET /prices — returns all 9 assets
app.get('/prices', async (req, res) => {
  try {
    const symbols = ['^NDX', '^GSPC', 'GC=F', 'SI=F', 'CL=F', '^N225', '^KS11'].join(',');
    const url     = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=regularMarketPrice,regularMarketChangePercent`;

    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json',
      }
    });

    const data   = await r.json();
    const quotes = data?.quoteResponse?.result || [];

    const map = {
      '^NDX':  { sym: 'NASDAQ'  },
      '^GSPC': { sym: 'S&P 500' },
      'GC=F':  { sym: 'GOLD'    },
      'SI=F':  { sym: 'SILVER'  },
      'CL=F':  { sym: 'US OIL'  },
      '^N225': { sym: 'NIKKEI'  },
      '^KS11': { sym: 'KOSPI'   },
    };

    const result = {};
    quotes.forEach(q => {
      const m = map[q.symbol];
      if (m) {
        result[m.sym] = {
          price:  q.regularMarketPrice,
          change: q.regularMarketChangePercent || 0,
        };
      }
    });

    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Bull Theory proxy running on port ${PORT}`));
