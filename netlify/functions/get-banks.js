let cachedBanks = null;
let cacheTime = 0;
const CACHE_TTL = 3000;

exports.handler = async (event) => {
  const responseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache'
  };

  try {
    if (cachedBanks && Date.now() - cacheTime < CACHE_TTL) {
      return { statusCode: 200, headers: responseHeaders, body: JSON.stringify(cachedBanks) };
    }

    const token = process.env.GITHUB_TOKEN;
    const fetchHeaders = { 'User-Agent': 'quiz-app', 'Accept': 'application/vnd.github.v3+json' };
    if (token) fetchHeaders['Authorization'] = `token ${token}`;

    const resp = await fetch(
      'https://api.github.com/repos/muyuxin51/quiz-app/contents/banks.json?ref=master',
      { headers: fetchHeaders }
    );

    if (!resp.ok) throw new Error(`GitHub API returned ${resp.status}`);

    const json = await resp.json();
    if (json.content) {
      const banks = JSON.parse(Buffer.from(json.content, 'base64').toString('utf-8'));
      cachedBanks = banks;
      cacheTime = Date.now();
      return { statusCode: 200, headers: responseHeaders, body: JSON.stringify(banks) };
    }

    return { statusCode: 200, headers: responseHeaders, body: '[]' };
  } catch (err) {
    // Return cached data if available, otherwise empty
    const body = cachedBanks ? JSON.stringify(cachedBanks) : '[]';
    return { statusCode: 200, headers: responseHeaders, body };
  }
};
