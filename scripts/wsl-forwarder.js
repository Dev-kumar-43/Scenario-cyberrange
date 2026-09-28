import net from 'net';
import { execSync } from 'child_process';

let cachedWslIp = null;
let lastIpCheck = 0;

function getWslIp(force = false) {
  const now = Date.now();
  if (!force && cachedWslIp && now - lastIpCheck < 30000) {
    return cachedWslIp;
  }
  try {
    const stdout = execSync('wsl -d kali-linux -e hostname -I', { encoding: 'utf-8', timeout: 5000 });
    const ip = stdout.trim().split(/\s+/)[0];
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
      cachedWslIp = ip;
      lastIpCheck = now;
      return ip;
    }
  } catch (err) {
    // ignore
  }
  return cachedWslIp || '192.168.19.134';
}

const PORT = 3001;
const initialIp = getWslIp(true);

console.log(`[forwarder] Bridging Windows localhost:${PORT} -> WSL ${initialIp}:${PORT}`);

const server = net.createServer((clientSocket) => {
  const targetIp = getWslIp();
  const targetSocket = net.connect({ host: targetIp, port: PORT });

  clientSocket.pipe(targetSocket);
  targetSocket.pipe(clientSocket);

  clientSocket.on('error', (err) => {
    targetSocket.destroy();
  });

  targetSocket.on('error', (err) => {
    cachedWslIp = null;
    clientSocket.destroy();
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[forwarder] Port ${PORT} already bound on Windows (native backend running). Forwarder standing by.`);
  } else {
    console.error('[forwarder] Server error:', err.message);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[forwarder] Ready: listening on 0.0.0.0:${PORT}`);
});

// Keep process alive
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
