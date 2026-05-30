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
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

exports.handler = async (event) => {
  // CORS headers
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
    const newBank = JSON.parse(event.body);
    if (!newBank.name || !newBank.questions || newBank.questions.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid bank data' }) };
    }

    // Get current banks.json
    const filePath = `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const getResult = await githubRequest('GET', `${filePath}?ref=${BRANCH}`);

    if (getResult.status !== 200) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to read banks.json', detail: getResult.data }) };
    }

    const currentContent = Buffer.from(getResult.data.content, 'base64').toString('utf-8');
    const banks = JSON.parse(currentContent);

    // Add new bank (with unique ID)
    newBank.id = 'b_' + Date.now();
    newBank.createdAt = new Date().toISOString();
    banks.unshift(newBank);

    // Update banks.json on GitHub
    const updatedContent = Buffer.from(JSON.stringify(banks, null, 2)).toString('base64');
    const updateResult = await githubRequest('PUT', filePath, {
      message: `Add bank: ${newBank.name}`,
      content: updatedContent,
      sha: getResult.data.sha,
      branch: BRANCH
    });

    if (updateResult.status === 200 || updateResult.status === 201) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, bank: newBank })
      };
    } else {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update banks.json', detail: updateResult.data })
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal error', message: err.message })
    };
  }
};
