import http from 'http';

function request(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: 3000, path, method: 'GET' },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const health = await request('/api/health');
  const ok = health.status === 200 && health.body.includes('"ok"');
  if (!ok) {
    console.error('Smoke test failed:', health);
    process.exit(1);
  }
  console.log('Smoke test OK');
})();

