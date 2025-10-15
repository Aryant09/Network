## How to Run and Use the Web Network Scanner

This document walks you through installing, running, and using the web-based TCP port scanner. It includes UI steps, API examples, and tuning tips.

### Prerequisites
- Node.js 18+ and npm
- Network access to the targets you intend to scan
- Legal authorization to scan those targets

### 1) Install dependencies
```bash
npm install
```

### 2) Run in development (TypeScript, auto-transpile)
```bash
npm run dev
```
- The server listens on `http://localhost:3000` by default.
- If your environment sets a `PORT` variable, the server will use that instead. Check the console log for the actual URL.

### 3) Build and run in production mode
```bash
npm run build
npm start
```
- Serves the compiled app (from `dist/`) and static files from `public/`.

### 4) Use the Web UI
1. Open the app in your browser: `http://localhost:3000`
2. In the "Target" field, enter one of:
   - A hostname (e.g., `scanme.nmap.org`)
   - An IPv4 address (e.g., `192.168.1.10`)
   - An IPv4 CIDR (e.g., `192.168.1.0/24`)
3. In "Ports", enter a list and/or ranges (e.g., `80,443,1-1024`).
4. Adjust "Timeout (ms)" (per-connection timeout) and "Concurrency" (simultaneous connections) as needed.
5. Click:
   - "Scan" to run a request that returns all results when finished.
   - "Stream" to see results progressively via Server-Sent Events (SSE).
6. Results appear in the log panel. Open ports show as `open`, unreachable as `closed`, and timeouts as `filtered`.

Tips:
- Start with a small port range (e.g., `1-1024`) and moderate concurrency (e.g., `200`).
- Large CIDRs expand to many hosts. Consider narrowing the range or lowering concurrency.

### 5) Use the JSON API directly

#### POST /api/scan (returns full results)
- URL: `http://localhost:3000/api/scan`
- Body (JSON):
  - `target` (string, required): hostname, IPv4, or IPv4 CIDR
  - `ports` (string, optional): list/ranges like `80,443,1-1024` (default `80,443`)
  - `timeoutMs` (number, optional): per-connection timeout, default `1000` (min `200`, max `30000`)
  - `concurrency` (number, optional): parallel sockets, default `200` (min `1`, max `1000`)

Example:
```bash
curl -sS -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "target": "scanme.nmap.org",
    "ports": "22,80,443,8080-8090",
    "timeoutMs": 1500,
    "concurrency": 200
  }' \
  http://localhost:3000/api/scan | jq .
```

Response (shape):
```json
{
  "hosts": ["45.33.32.156"],
  "ports": [22, 80, 443, 8080, 8081, ...],
  "results": [
    { "host": "45.33.32.156", "port": 80, "status": "open", "latencyMs": 18 },
    { "host": "45.33.32.156", "port": 22, "status": "closed", "error": "ECONNREFUSED" },
    { "host": "45.33.32.156", "port": 443, "status": "filtered", "error": "timeout" }
  ]
}
```

#### GET /api/scan/stream (progressive results via SSE)
- URL: `http://localhost:3000/api/scan/stream`
- Query params: `target`, `ports`, `timeoutMs`, `concurrency`

Example (stream to terminal):
```bash
curl -N "http://localhost:3000/api/scan/stream?target=scanme.nmap.org&ports=22,80,443&timeoutMs=1500&concurrency=200"
```
- Events:
  - `start`: `{ type, total, completed }`
  - `progress`: `{ type, total, completed, result }` (emitted for each host:port)
  - `done`: `{ type, total, completed }`
  - `error`: `{ type, message }`

### Examples
- Hostname: `target=scanme.nmap.org`, `ports=22,80,443`
- Single IP: `target=192.168.1.10`, `ports=1-1024`
- CIDR: `target=192.168.1.0/30`, `ports=80,443`

### Tuning & Notes
- Concurrency: Higher values speed up scans but can overwhelm networks or hit OS limits. Start around 100–300.
- Timeout: Lower values make scans faster but risk marking slow services as `filtered`. Typical values: 800–2000 ms.
- Large CIDRs: `192.168.1.0/24` = 256 hosts. With many ports, total tasks = hosts × ports and can take time.
- DNS: Hostnames are resolved to IPv4 addresses. If DNS fails, no scan runs.
- Security: Firewalls may drop packets (seen as `filtered`). Some networks rate-limit or block scanning.

### Troubleshooting
- "No valid targets resolved": Check hostname/IP/CIDR and your DNS.
- Everything `closed`: The host may actively refuse connections or a firewall is resetting them.
- Many `filtered`: Increase `timeoutMs`, or a firewall is silently dropping.
- Server port: If you do not see the app on `3000`, check the console for the actual port (an environment may set `PORT`).

### Legal Notice
Only scan systems you own or have explicit permission to test. Unauthorized scanning may violate laws or terms of service.
