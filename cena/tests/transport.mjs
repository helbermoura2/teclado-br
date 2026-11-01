import { Readable, Writable } from 'node:stream';

// Exercise the actual HTTP handler without opening a TCP port. Some sandboxes
// prohibit listen() even on loopback. This leaves routing/auth/storage untouched.
export function request(server, route, options = {}) {
  return new Promise((resolve, reject) => {
    const req = Readable.from(options.body ? [Buffer.from(options.body)] : []);
    Object.assign(req, { url: route, method: options.method || 'GET', headers: Object.fromEntries(Object.entries(options.headers || {}).map(([k, v]) => [k.toLowerCase(), v])), socket: { localPort: 3000, remoteAddress: '127.0.0.1' } });
    const headers = new Map(); const chunks = [];
    const res = new Writable({ write(chunk, encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
    res.setHeader = (key, value) => headers.set(key.toLowerCase(), String(value));
    res.writeHead = (status, values = {}) => { res.statusCode = status; for (const [k, v] of Object.entries(values)) res.setHeader(k, v); res.headersSent = true; return res; };
    res.on('error', reject);
    res.on('finish', () => {
      const text = Buffer.concat(chunks).toString();
      let value;
      try { value = JSON.parse(text); } catch { value = text; }
      resolve({ status: res.statusCode, headers: { get: key => headers.get(key.toLowerCase()) ?? null }, body: value });
    });
    server.emit('request', req, res);
  });
}
