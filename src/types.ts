export interface ScanRequestBody {
  target: string; // IP, hostname, or CIDR
  ports?: string; // e.g., "80,443,1-1024"
  timeoutMs?: number; // per-connection timeout
  concurrency?: number; // max simultaneous sockets
}

export interface PortScanResultItem {
  host: string;
  port: number;
  status: "open" | "closed" | "filtered";
  latencyMs?: number;
  error?: string;
}

export interface ScanProgressEvent {
  type: "start" | "progress" | "host_start" | "host_done" | "done" | "error";
  total?: number;
  completed?: number;
  host?: string;
  result?: PortScanResultItem;
  message?: string;
}
