// Серверная функция для работы с Google Drive API
// API ключи читаются из переменных окружения Netlify

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Разрешаем CORS для всех запросов
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Обработка preflight запроса
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { action, token, fileId, data } = JSON.parse(event.body);

    // API ключи берутся из переменных окружения (не видны в коде!)
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const API_KEY = process.env.GOOGLE_API_KEY;

    // Разные действия с Google Drive
    switch (action) {
      case 'search':
        // Поиск файла в appDataFolder
        const searchUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='consolefliip_data.json'&fields=files(id,name)&key=${API_KEY}`;
        const searchResp = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const searchData = await searchResp.json();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(searchData)
        };

      case 'get':
        // Загрузка содержимого файла
        const getUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`;
        const getResp = await fetch(getUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const getData = await getResp.json();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(getData)
        };

      case 'create':
        // Создание нового файла
        const createMetaUrl = `https://www.googleapis.com/drive/v3/files?key=${API_KEY}`;
        const createResp = await fetch(createMetaUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'consolefliip_data.json',
            parents: ['appDataFolder']
          })
        });
        const createData = await createResp.json();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(createData)
        };

      case 'update':
        // Обновление содержимого файла
        const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&key=${API_KEY}`;
        const updateResp = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        const updateData = await updateResp.json();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updateData)
        };

      case 'get_client_id':
        // Возвращаем CLIENT_ID для OAuth (безопасно, он нужен для авторизации)
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ clientId: CLIENT_ID })
        };

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Unknown action' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
