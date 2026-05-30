const fs = require('fs');
const path = require('path');

exports.handler = async () => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache'
  };

  try {
    const filePath = path.join(__dirname, '..', '..', 'banks.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    return { statusCode: 200, headers, body: data };
  } catch (err) {
    return { statusCode: 200, headers, body: '[]' };
  }
};
