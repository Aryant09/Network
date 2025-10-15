"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const utils_1 = require("./utils");
const scanner_1 = require("./scanner");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static("public"));
app.post("/api/scan", async (req, res) => {
    const body = (req.body || {});
    const ports = (0, utils_1.expandPorts)(body.ports);
    const timeoutMs = Math.min(Math.max(body.timeoutMs ?? 1000, 200), 30000);
    const concurrency = Math.min(Math.max(body.concurrency ?? 200, 1), 1000);
    if (!body.target || typeof body.target !== "string") {
        return res.status(400).json({ error: "target is required" });
    }
    const hosts = await (0, scanner_1.resolveTargets)(body.target);
    if (hosts.length === 0) {
        return res.status(400).json({ error: "No valid targets resolved" });
    }
    const results = [];
    await (0, scanner_1.scanHosts)(hosts, ports, { timeoutMs, concurrency }, (r) => results.push(r));
    res.json({ hosts, ports, results });
});
app.get("/api/scan/stream", async (req, res) => {
    // Server-Sent Events endpoint for progressive updates
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const target = String(req.query.target || "");
    const ports = (0, utils_1.expandPorts)(String(req.query.ports || ""));
    const timeoutMs = Math.min(Math.max(Number(req.query.timeoutMs || 1000), 200), 30000);
    const concurrency = Math.min(Math.max(Number(req.query.concurrency || 200), 1), 1000);
    if (!target) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: "target is required" })}\n\n`);
        return res.end();
    }
    const hosts = await (0, scanner_1.resolveTargets)(target);
    if (hosts.length === 0) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: "No valid targets resolved" })}\n\n`);
        return res.end();
    }
    const total = hosts.length * ports.length;
    let completed = 0;
    const send = (ev) => {
        res.write(`event: ${ev.type}\n`);
        res.write(`data: ${JSON.stringify(ev)}\n\n`);
    };
    send({ type: "start", total, completed: 0 });
    await (0, scanner_1.scanHosts)(hosts, ports, { timeoutMs, concurrency }, (result) => {
        completed++;
        send({ type: "progress", total, completed, result });
    });
    send({ type: "done", total, completed });
    res.end();
});
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
