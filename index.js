const http  = require('http');
const https = require('https');
const PORT  = process.env.PORT || 8080;

const BEARER_TOKEN = process.env.BEARER_TOKEN || 'AAAAAAAAAAAAAAAAAAAAACgy8gEAAAAA%2BJ%2FV%2BkUXmrYRL%2FtJoZUVmEZF0TY%3DGJMqXwLaJbWHgPWyogRLeXjsQsFQs8zXHqaBlR2pundHipsGMx';
const TWITTER_USER_ID = ''; // will be fetched dynamically

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location, headers).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Parse error: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

const AUTH = { 'Authorization': `Bearer ${decodeURIComponent(BEARER_TOKEN)}` };

async function getUserId(username) {
  const data = await get(`https://api.twitter.com/2/users/by/username/${username}`, AUTH);
  return data?.data?.id;
}

async function getTweets(userId) {
  const url = `https://api.twitter.com/2/users/${userId}/tweets?max_results=5&tweet.fields=created_at,text&exclude=retweets,replies`;
  const data = await get(url, AUTH);
  return data?.data || [];
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.url === '/health') { res.writeHead(200); res.end(JSON.stringify({ status: 'ok' })); return; }

  if (req.url === '/tweets') {
    try {
      const userId = await getUserId('BullTheoryio');
      console.log('User ID:', userId);
      const tweets = await getTweets(userId);
      console.log('Tweets fetched:', tweets.length);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, tweets }));
    } catch(e) {
      console.log('Error:', e.message);
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // Keep /prices endpoint for future use
  if (req.url === '/prices') {
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: {} }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => console.log(`Bull Theory proxy running on port ${PORT}`));
