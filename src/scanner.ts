import { expandPorts, expandCidr, scanTcpPort, isValidIpV4 } from "./utils";
import { PortScanResultItem } from "./types";
import dns from "dns/promises";

export interface ScannerOptions {
  timeoutMs: number;
  concurrency: number;
}

export async function resolveTargets(target: string): Promise<string[]> {
  const targets = new Set<string>();

  const maybeCidr = target.includes("/");
  if (maybeCidr) {
    for (const ip of expandCidr(target)) targets.add(ip);
  } else if (isValidIpV4(target)) {
    targets.add(target);
  } else {
    try {
      const addresses = await dns.lookup(target, { all: true, family: 4 });
      for (const a of addresses) targets.add(a.address);
    } catch {
      // ignore DNS failure; will be handled later
    }
  }

  return Array.from(targets);
}

export async function scanHosts(
  hosts: string[],
  ports: number[],
  options: ScannerOptions,
  onResult: (result: PortScanResultItem) => void
): Promise<void> {
  const queue: Array<{ host: string; port: number }> = [];
  for (const host of hosts) {
    for (const port of ports) {
      queue.push({ host, port });
    }
  }

  let active = 0;
  let index = 0;
  const next = async (): Promise<void> => {
    if (index >= queue.length) return;
    if (active >= options.concurrency) return;
    const item = queue[index++];
    active++;
    try {
      const res = await scanTcpPort(item.host, item.port, options.timeoutMs);
      const status: PortScanResultItem = {
        host: item.host,
        port: item.port,
        status: res.open ? "open" : res.error === "timeout" ? "filtered" : "closed",
        latencyMs: res.latencyMs,
        error: res.error,
      };
      onResult(status);
    } finally {
      active--;
      // schedule next
      await next();
    }
  };

  const starters = Math.min(options.concurrency, queue.length);
  const startersPromises: Promise<void>[] = [];
  for (let i = 0; i < starters; i++) startersPromises.push(next());
  await Promise.all(startersPromises);

  // Drain remaining tasks
  while (index < queue.length || active > 0) {
    await next();
  }
}
