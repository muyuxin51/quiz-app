const https = require('https');

function githubRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'quiz-app-netlify-function',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve([]); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

let cachedBanks = null;
let cacheTime = 0;
const CACHE_TTL = 10000; // 10 seconds server-side cache

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };

  try {
    // Use short-lived cache to avoid hitting GitHub API limits
    if (cachedBanks && Date.now() - cacheTime < CACHE_TTL) {
      return { statusCode: 200, headers, body: JSON.stringify(cachedBanks) };
    }

    const result = await githubRequest('/repos/muyuxin51/quiz-app/contents/banks.json?ref=master');
    if (result.content) {
      const banks = JSON.parse(Buffer.from(result.content, 'base64').toString('utf-8'));
      cachedBanks = banks;
      cacheTime = Date.now();
      return { statusCode: 200, headers, body: JSON.stringify(banks) };
    }
    return { statusCode: 200, headers, body: '[]' };
  } catch (err) {
    return { statusCode: 200, headers, body: cachedBanks ? JSON.stringify(cachedBanks) : '[]' };
  }
};
