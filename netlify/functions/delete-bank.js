const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'muyuxin51';
const REPO_NAME = 'quiz-app';
const FILE_PATH = 'banks.json';
const BRANCH = 'master';

function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'quiz-app-netlify-function',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!GITHUB_TOKEN) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GITHUB_TOKEN not configured' }) };
  }

  try {
    const { bankId } = JSON.parse(event.body);
    if (!bankId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'bankId required' }) };
    }

    const filePath = `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const getResult = await githubRequest('GET', `${filePath}?ref=${BRANCH}`);

    if (getResult.status !== 200) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to read banks.json' }) };
    }

    const currentContent = Buffer.from(getResult.data.content, 'base64').toString('utf-8');
    const banks = JSON.parse(currentContent);
    const filtered = banks.filter(b => b.id !== bankId);

    if (filtered.length === banks.length) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Bank not found' }) };
    }

    const updatedContent = Buffer.from(JSON.stringify(filtered, null, 2)).toString('base64');
    const updateResult = await githubRequest('PUT', filePath, {
      message: `Delete bank: ${bankId}`,
      content: updatedContent,
      sha: getResult.data.sha,
      branch: BRANCH
    });

    if (updateResult.status === 200 || updateResult.status === 201) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    } else {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to update banks.json' }) };
    }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
