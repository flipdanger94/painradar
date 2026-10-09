import { describe, it, expect, vi, beforeEach } from "vitest";
import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { gzipSync } from "node:zlib";
const state = vi.hoisted(() => ({
  lookup: vi.fn(),
  request: vi.fn(),
  responses: [] as {
    status?: number;
    headers?: Record<string, string>;
    body?: Buffer | string;
  }[],
}));
vi.mock("node:dns/promises", () => ({ lookup: state.lookup }));
vi.mock("node:https", () => ({ request: state.request }));
import { publicFetch } from "@/lib/sources/public-fetch";
beforeEach(() => {
  state.responses = [];
  state.lookup
    .mockReset()
    .mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);
  state.request.mockReset().mockImplementation((_url, options, callback) => {
    const req = new EventEmitter() as EventEmitter & {
      end: () => void;
      destroy: (error: Error) => void;
    };
    req.destroy = (error) => {
      req.emit("error", error);
      req.emit("close");
    };
    req.end = () =>
      queueMicrotask(() => {
        const response = state.responses.shift() || {};
        const res = new PassThrough() as PassThrough & {
          statusCode: number;
          headers: Record<string, string>;
        };
        res.statusCode = response.status || 200;
        res.headers = response.headers || {};
        res.once("end", () => req.emit("close"));
        callback(res);
        res.end(response.body || "{}");
      });
    return req;
  });
});
describe("bounded public source requests", () => {
  it("blocks private or mixed DNS results before connecting", async () => {
    state.lookup.mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(
      publicFetch("https://public.example.org/feed"),
    ).rejects.toThrow("public unicast");
    expect(state.request).not.toHaveBeenCalled();
  });
  it("pins the public DNS result for the TLS connection", async () => {
    state.responses.push({ body: "valid body" });
    expect((await publicFetch("https://public.example.org/feed")).text).toBe(
      "valid body",
    );
    const options = state.request.mock.calls[0][1];
    const cb = vi.fn();
    options.lookup("public.example.org", {}, cb);
    expect(cb).toHaveBeenCalledWith(null, "1.1.1.1", 4);
  });
  it("revalidates redirects and prevents redirecting to an internal address", async () => {
    state.responses.push({
      status: 302,
      headers: { location: "https://private.example.org/feed" },
    });
    state.lookup
      .mockResolvedValueOnce([{ address: "1.1.1.1", family: 4 }])
      .mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }]);
    await expect(
      publicFetch("https://public.example.org/feed"),
    ).rejects.toThrow("public unicast");
    expect(state.request).toHaveBeenCalledTimes(1);
  });
  it("decodes gzip and rejects oversized decompressed payloads", async () => {
    state.responses.push({
      headers: { "content-encoding": "gzip" },
      body: gzipSync("hello"),
    });
    expect((await publicFetch("https://public.example.org/feed")).text).toBe(
      "hello",
    );
    state.responses.push({
      headers: { "content-encoding": "gzip" },
      body: gzipSync("x".repeat(2_000_100)),
    });
    await expect(
      publicFetch("https://public.example.org/feed"),
    ).rejects.toThrow("too large");
  });
});
