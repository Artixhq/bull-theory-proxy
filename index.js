const http  = require('http');
const https = require('https');
const PORT  = process.env.PORT || 8080;

// Token should be set as Railway env variable — decoded, not URL-encoded
const BEARER_TOKEN = process.env.BEARER_TOKEN;

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { reject(new Error('Parse error: ' + data.slice(0, 300))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function getTweets() {
  const token = BEARER_TOKEN;
  console.log('Token starts with:', token ? token.slice(0, 20) : 'MISSING');

  // Step 1: get user ID
  const userRes = await get(
    'https://api.twitter.com/2/users/by/username/BullTheoryio?user.fields=id',
    { 'Authorization': `Bearer ${token}` }
  );
  console.log('User response status:', userRes.status);

  const userId = userRes.body?.data?.id;
  if (!userId) throw new Error('Could not get user ID: ' + JSON.stringify(userRes.body));

  // Step 2: get tweets
  const tweetRes = await get(
    `https://api.twitter.com/2/users/${userId}/tweets?max_results=5&tweet.fields=created_at,text&exclude=retweets,replies`,
    { 'Authorization': `Bearer ${token}` }
  );
  console.log('Tweets response status:', tweetRes.status);

  return tweetRes.body?.data || [];
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.url === '/health') { res.writeHead(200); res.end(JSON.stringify({ status: 'ok' })); return; }

  if (req.url === '/tweets') {
    try {
      const tweets = await getTweets();
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, tweets }));
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
