const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function githubRequest(path) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'quiz-app-netlify-function',
      'Accept': 'application/vnd.github.v3+json'
    };
    if (GITHUB_TOKEN) {
      headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: 'GET',
      headers: headers
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: null }); }
      });
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

let cachedBanks = null;
let cacheTime = 0;
const CACHE_TTL = 3000; // 3 seconds cache to reduce API calls while staying fresh

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache'
  };

  try {
    if (cachedBanks && Date.now() - cacheTime < CACHE_TTL) {
      return { statusCode: 200, headers, body: JSON.stringify(cachedBanks) };
    }

    const result = await githubRequest('/repos/muyuxin51/quiz-app/contents/banks.json?ref=master');
    if (result.data && result.data.content) {
      const banks = JSON.parse(Buffer.from(result.data.content, 'base64').toString('utf-8'));
      cachedBanks = banks;
      cacheTime = Date.now();
      return { statusCode: 200, headers, body: JSON.stringify(banks) };
    }
    return { statusCode: 200, headers, body: cachedBanks ? JSON.stringify(cachedBanks) : '[]' };
  } catch (err) {
    return { statusCode: 200, headers, body: cachedBanks ? JSON.stringify(cachedBanks) : '[]' };
  }
};
