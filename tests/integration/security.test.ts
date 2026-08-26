import { describe, it, expect, vi } from "vitest";
import { originGuard, isAllowedOrigin } from "../../server/security/originGuard";
import { validateEnv } from "../../server/config/env";
import type { Request, Response, NextFunction } from "express";

describe("Security and Origin Guard Integration", () => {
  function createMockReqRes(options: {
    method: string;
    headers?: Record<string, string>;
  }) {
    const req = {
      method: options.method,
      headers: options.headers || {},
    } as unknown as Request;

    let statusCode = 200;
    let jsonBody: unknown = null;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        jsonBody = body;
        return this;
      },
    } as unknown as Response;

    const next = vi.fn() as unknown as NextFunction;

    return { req, res, getStatus: () => statusCode, getBody: () => jsonBody, next };
  }

  describe("Origin Matching (isAllowedOrigin)", () => {
    it("allows loopback origins with configured port", () => {
      expect(isAllowedOrigin("http://127.0.0.1:4173")).toBe(true);
      expect(isAllowedOrigin("http://localhost:4173")).toBe(true);
      expect(isAllowedOrigin("http://[::1]:4173")).toBe(true);
    });

    it("rejects non-loopback or wrong port origins", () => {
      expect(isAllowedOrigin("http://evil.com:4173")).toBe(false);
      expect(isAllowedOrigin("http://attacker.org")).toBe(false);
      expect(isAllowedOrigin("http://127.0.0.1:8080")).toBe(false);
    });
  });

  describe("originGuard middleware", () => {
    it("permits safe read-only methods (GET, HEAD) without origin checks", () => {
      const { req, res, next } = createMockReqRes({
        method: "GET",
        headers: { origin: "http://external-site.com" },
      });
      originGuard(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("permits state-changing requests with matching loopback origin", () => {
      const { req, res, next } = createMockReqRes({
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:4173",
          "sec-fetch-site": "same-origin",
        },
      });
      originGuard(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it("blocks state-changing requests when Sec-Fetch-Site is cross-site", () => {
      const { req, res, next, getStatus, getBody } = createMockReqRes({
        method: "POST",
        headers: {
          "sec-fetch-site": "cross-site",
          origin: "http://127.0.0.1:4173",
        },
      });
      originGuard(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(getStatus()).toBe(403);
      expect((getBody() as { error: string }).error).toContain("Sec-Fetch-Site");
    });

    it("blocks state-changing requests with malicious Origin header", () => {
      const { req, res, next, getStatus, getBody } = createMockReqRes({
        method: "POST",
        headers: {
          origin: "http://evil-website.com",
        },
      });
      originGuard(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(getStatus()).toBe(403);
      expect((getBody() as { error: string }).error).toContain("cross-origin request from 'http://evil-website.com' rejected");
    });

    it("blocks state-changing requests with cross-origin Referer", () => {
      const { req, res, next, getStatus, getBody } = createMockReqRes({
        method: "DELETE",
        headers: {
          referer: "http://evil-website.com/phishing-page",
        },
      });
      originGuard(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(getStatus()).toBe(403);
      expect((getBody() as { error: string }).error).toContain("cross-origin referer");
    });
  });

  describe("Startup Loopback Guard (validateEnv)", () => {
    it("allows loopback hosts in default profile", () => {
      expect(() => validateEnv({ VERSO_HOST: "127.0.0.1" })).not.toThrow();
      expect(() => validateEnv({ VERSO_HOST: "localhost" })).not.toThrow();
      expect(() => validateEnv({ VERSO_HOST: "::1" })).not.toThrow();
    });

    it("rejects non-loopback host when not running in container and remote access not enabled", () => {
      expect(() => validateEnv({ VERSO_HOST: "0.0.0.0" })).toThrow("Refusing to start on non-loopback host '0.0.0.0'");
      expect(() => validateEnv({ VERSO_HOST: "192.168.1.100" })).toThrow("Refusing to start on non-loopback host '192.168.1.100'");
    });

    it("allows non-loopback host when VERSO_CONTAINER=true", () => {
      expect(() => validateEnv({ VERSO_HOST: "0.0.0.0", VERSO_CONTAINER: "true" })).not.toThrow();
    });

    it("allows non-loopback host when VERSO_ALLOW_REMOTE=true", () => {
      expect(() => validateEnv({ VERSO_HOST: "192.168.1.100", VERSO_ALLOW_REMOTE: "true" })).not.toThrow();
    });
  });
});

