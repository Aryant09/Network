import net from "net";

export function expandPorts(input?: string): number[] {
  if (!input || input.trim() === "") return [80, 443];
  const ports = new Set<number>();
  for (const part of input.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-", 2);
      const start = clampPort(Number(startStr));
      const end = clampPort(Number(endStr));
      if (Number.isFinite(start) && Number.isFinite(end)) {
        for (let p = Math.min(start, end); p <= Math.max(start, end); p++) {
          ports.add(p);
        }
      }
    } else {
      const p = clampPort(Number(trimmed));
      if (Number.isFinite(p)) ports.add(p);
    }
  }
  return Array.from(ports).sort((a, b) => a - b);
}

function clampPort(p: number): number {
  if (!Number.isFinite(p)) return NaN as unknown as number;
  if (p < 1) return 1;
  if (p > 65535) return 65535;
  return Math.floor(p);
}

export function isValidIpV4(address: string): boolean {
  const parts = address.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

export function expandCidr(cidr: string): string[] {
  // Only IPv4 CIDR support for simplicity
  const [base, maskStr] = cidr.split("/");
  const mask = Number(maskStr);
  if (!isValidIpV4(base) || !Number.isFinite(mask) || mask < 0 || mask > 32) {
    return [];
  }
  const baseInt = ipv4ToInt(base);
  const hostBits = 32 - mask;
  const count = hostBits === 0 ? 1 : 2 ** hostBits;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(intToIpv4(baseInt + i));
  }
  return out;
}

function ipv4ToInt(ip: string): number {
  return ip
    .split(".")
    .map((x) => Number(x))
    .reduce((acc, cur) => (acc << 8) + cur, 0) >>> 0;
}

function intToIpv4(n: number): string {
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ].join(".");
}

export async function scanTcpPort(
  host: string,
  port: number,
  timeoutMs: number
): Promise<{ open: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finalize = (result: {
      open: boolean;
      latencyMs?: number;
      error?: string;
    }) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch {}
      resolve(result);
    };

    socket.setTimeout(timeoutMs, () => finalize({ open: false, error: "timeout" }));

    socket.once("connect", () => {
      const latencyMs = Date.now() - start;
      finalize({ open: true, latencyMs });
    });

    socket.once("error", (err) => {
      finalize({ open: false, error: err.message });
    });

    try {
      socket.connect(port, host);
    } catch (err: any) {
      finalize({ open: false, error: err?.message || "connect_error" });
    }
  });
}
