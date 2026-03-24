const http  = require('http');
const https = require('https');
const PORT  = process.env.PORT || 8080;

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location, headers).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Parse: ' + data.slice(0, 300))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function getPrices() {
  const result = {};

  // Yahoo Finance with proper headers (works server-side)
  const symbols = ['^NDX', '^GSPC', 'GC=F', 'SI=F', 'CL=F', '^N225', '^KS11'];
  const map = {
    '^NDX':  { sym: 'NASDAQ'  },
    '^GSPC': { sym: 'S&P 500' },
    'GC=F':  { sym: 'GOLD'    },
    'SI=F':  { sym: 'SILVER'  },
    'CL=F':  { sym: 'US OIL'  },
    '^N225': { sym: 'NIKKEI'  },
    '^KS11': { sym: 'KOSPI'   },
  };

  // Try Yahoo Finance v8 endpoint
  try {
    const symStr = symbols.map(s => encodeURIComponent(s)).join('%2C');
    const url = `https://query2.finance.yahoo.com/v8/finance/spark?symbols=${symStr}&range=1d&interval=1d`;
    const data = await get(url, {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://finance.yahoo.com',
      'Referer': 'https://finance.yahoo.com',
    });

    // v8 spark returns different structure
    if (data.spark && data.spark.result) {
      data.spark.result.forEach(r => {
        const m = map[r.symbol];
        if (m && r.response && r.response[0]) {
          const resp   = r.response[0];
          const prices = resp.indicators?.quote?.[0]?.close || [];
          const meta   = resp.meta || {};
          const price  = meta.regularMarketPrice || prices[prices.length - 1];
          const prev   = meta.chartPreviousClose || prices[0];
          const change = prev ? ((price - prev) / prev) * 100 : 0;
          if (price) result[m.sym] = { price, change };
        }
      });
    }
  } catch(e) {
    console.log('Spark failed:', e.message);
  }

  // Fallback: try v7 quote endpoint
  if (Object.keys(result).length === 0) {
    try {
      const symStr = symbols.join(',');
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symStr)}`;
      const data = await get(url, {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'application/json',
        'Cookie': 'B=abc; YFC=1',
      });
      const quotes = data?.quoteResponse?.result || [];
      quotes.forEach(q => {
        const m = map[q.symbol];
        if (m && q.regularMarketPrice) {
          result[m.sym] = { price: q.regularMarketPrice, change: q.regularMarketChangePercent || 0 };
        }
      });
    } catch(e) {
      console.log('v7 failed:', e.message);
    }
  }

  return result;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.url === '/health') { res.writeHead(200); res.end(JSON.stringify({ status: 'ok' })); return; }

  if (req.url === '/prices') {
    try {
      const data = await getPrices();
      console.log('Prices fetched:', JSON.stringify(data));
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data }));
    } catch(e) {
      console.log('Error:', e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
