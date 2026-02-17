// Серверная функция для работы с Google Drive API
// API ключи читаются из переменных окружения Netlify

const fetch = require('node-fetch');

// Fetch с таймаутом — не даём функции зависнуть на 30 секунд
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { action, token, fileId, data } = JSON.parse(event.body);

    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const API_KEY   = process.env.GOOGLE_API_KEY;

    switch (action) {

      case 'get_client_id':
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ clientId: CLIENT_ID })
        };

      case 'search': {
        const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='consolefliip_data.json'&fields=files(id,name)&key=${API_KEY}`;
        const resp = await fetchWithTimeout(url, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Токен протух — сообщаем клиенту явно
        if (resp.status === 401) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'token_expired' }) };
        }

        const result = await resp.json();
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }

      case 'get': {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`;
        const resp = await fetchWithTimeout(url, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (resp.status === 401) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'token_expired' }) };
        }

        const result = await resp.json();
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }

      // create + update объединены в один multipart запрос
      case 'create_with_data': {
        const boundary = '-------ConsoleFlipBoundary';
        const meta = JSON.stringify({ name: 'consolefliip_data.json', parents: ['appDataFolder'] });
        const body = [
          `--${boundary}`,
          'Content-Type: application/json; charset=UTF-8',
          '',
          meta,
          `--${boundary}`,
          'Content-Type: application/json',
          '',
          JSON.stringify(data),
          `--${boundary}--`
        ].join('\r\n');

        const url = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&key=${API_KEY}`;
        const resp = await fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body
        });

        if (resp.status === 401) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'token_expired' }) };
        }

        const result = await resp.json();
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }

      // Оставляем для обратной совместимости
      case 'create': {
        const url = `https://www.googleapis.com/drive/v3/files?key=${API_KEY}`;
        const resp = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'consolefliip_data.json', parents: ['appDataFolder'] })
        });

        if (resp.status === 401) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'token_expired' }) };
        }

        const result = await resp.json();
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }

      case 'update': {
        const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&key=${API_KEY}`;
        const resp = await fetchWithTimeout(url, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (resp.status === 401) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'token_expired' }) };
        }

        const result = await resp.json();
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      }

      default:
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
    }

  } catch (error) {
    // AbortError = таймаут запроса к Google
    if (error.name === 'AbortError') {
      console.error('Google API timeout');
      return {
        statusCode: 504,
        headers,
        body: JSON.stringify({ error: 'Google API timeout', code: 'TIMEOUT' })
      };
    }

    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
