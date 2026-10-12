/* Простой статический сервер для локального предпросмотра дашборда.
 * Запуск:  node server.js   →   http://127.0.0.1:8090
 */
'use strict';

// === ЛОГИРОВАНИЕ ОШИБКОВ В КОНСОЛЬ ===
const path = require('path');
console.error = console.log; // Унифицированный вывод ошибок в консоль
const http = require('http');
const fs = require('fs');

const ROOT = __dirname;
const PORT = process.env.PORT ? Number(process.env.PORT) : 8090;
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

/**
 * Обработка ошибок в сервере — вывод в консоль с подробной информацией
 */
function logError(error, context = '') {
  const timestamp = new Date().toISOString();
  const errorInfo = error && error.message ? error.message : String(error);
  console.error(`[SERVER ERROR] [${timestamp}] ${context || 'Неизвестная ошибка'}:`, errorInfo);
  if (error && error.stack) {
    console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
  }
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    logError(e, 'Невозможно декодировать URL');
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('400 Bad Request:Ошибка декодирования URL');
    return;
  }
  
  if (urlPath === '/') urlPath = '/index.html';
  
  const file = path.join(ROOT, path.normalize(urlPath));
  
  // Валидация пути — логирование потенциально небезопасных попыток
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    console.error(`[SERVER ERROR] [${new Date().toISOString()}] Запрещён доступ к: ${urlPath}`);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }
  
  fs.readFile(file, (err, data) => {
    if (err) {
      // Логирование ошибок чтения файлов с полной информацией об ошибке
      logError(err, 'Файл не найден или недоступен: ' + urlPath);
      res.writeHead(404, { 
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Error-Details': err.message // Детали ошибки в заголовке для отладки
      });
      res.end(`404 Not Found: ${urlPath}${err.code === 'ENOENT' ? ' (файл отсутствует)' : ''}`);
      return;
    }
    
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.error(`[SERVER STARTED] [${new Date().toISOString()}] Oncology US Analytics: http://${HOST}:${PORT}`);
  console.error('[SERVER INFO] Логи ошибок выводятся в консоль разработчика');
});

// Обработка неожиданных остановок сервера
process.on('uncaughtException', (error) => {
  logError(error, 'Необожиданное исключение: процесс завершится');
});

process.on('unhandledRejection', (reason, promise) => {
  logError(reason, 'Unhandled rejection в Promise: процесс завершится');
});
