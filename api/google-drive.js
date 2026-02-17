// Серверная функция для работы с Google Drive API
// Адаптирована для Vercel (папка api/)
// Используем встроенный fetch (Node.js 18+)

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

// Vercel: экспортируем default function вместо exports.handler
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, token, fileId, data } = req.body;

    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const API_KEY   = process.env.GOOGLE_API_KEY;

    switch (action) {

      case 'get_client_id':
        return res.status(200).json({ clientId: CLIENT_ID });

      case 'search': {
        const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='consolefliip_data.json'&fields=files(id,name)&key=${API_KEY}`;
        const resp = await fetchWithTimeout(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resp.status === 401) return res.status(401).json({ error: 'token_expired' });
        return res.status(200).json(await resp.json());
      }

      case 'get': {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`;
        const resp = await fetchWithTimeout(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resp.status === 401) return res.status(401).json({ error: 'token_expired' });
        return res.status(200).json(await resp.json());
      }

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
        if (resp.status === 401) return res.status(401).json({ error: 'token_expired' });
        return res.status(200).json(await resp.json());
      }

      case 'create': {
        const url = `https://www.googleapis.com/drive/v3/files?key=${API_KEY}`;
        const resp = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'consolefliip_data.json', parents: ['appDataFolder'] })
        });
        if (resp.status === 401) return res.status(401).json({ error: 'token_expired' });
        return res.status(200).json(await resp.json());
      }

      case 'update': {
        const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&key=${API_KEY}`;
        const resp = await fetchWithTimeout(url, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (resp.status === 401) return res.status(401).json({ error: 'token_expired' });
        return res.status(200).json(await resp.json());
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Google API timeout');
      return res.status(504).json({ error: 'Google API timeout', code: 'TIMEOUT' });
    }
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
