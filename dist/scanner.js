"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTargets = resolveTargets;
exports.scanHosts = scanHosts;
const utils_1 = require("./utils");
const promises_1 = __importDefault(require("dns/promises"));
async function resolveTargets(target) {
    const targets = new Set();
    const maybeCidr = target.includes("/");
    if (maybeCidr) {
        for (const ip of (0, utils_1.expandCidr)(target))
            targets.add(ip);
    }
    else if ((0, utils_1.isValidIpV4)(target)) {
        targets.add(target);
    }
    else {
        try {
            const addresses = await promises_1.default.lookup(target, { all: true, family: 4 });
            for (const a of addresses)
                targets.add(a.address);
        }
        catch {
            // ignore DNS failure; will be handled later
        }
    }
    return Array.from(targets);
}
async function scanHosts(hosts, ports, options, onResult) {
    const queue = [];
    for (const host of hosts) {
        for (const port of ports) {
            queue.push({ host, port });
        }
    }
    let active = 0;
    let index = 0;
    const next = async () => {
        if (index >= queue.length)
            return;
        if (active >= options.concurrency)
            return;
        const item = queue[index++];
        active++;
        try {
            const res = await (0, utils_1.scanTcpPort)(item.host, item.port, options.timeoutMs);
            const status = {
                host: item.host,
                port: item.port,
                status: res.open ? "open" : res.error === "timeout" ? "filtered" : "closed",
                latencyMs: res.latencyMs,
                error: res.error,
            };
            onResult(status);
        }
        finally {
            active--;
            // schedule next
            await next();
        }
    };
    const starters = Math.min(options.concurrency, queue.length);
    const startersPromises = [];
    for (let i = 0; i < starters; i++)
        startersPromises.push(next());
    await Promise.all(startersPromises);
    // Drain remaining tasks
    while (index < queue.length || active > 0) {
        await next();
    }
}
