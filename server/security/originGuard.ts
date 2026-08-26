import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isAllowedOrigin(originHeader: string): boolean {
  try {
    const originUrl = new URL(originHeader);
    const originHost = originUrl.hostname.toLowerCase();
    const originPort = originUrl.port || (originUrl.protocol === "https:" ? "443" : "80");
    const configuredPort = String(env.VERSO_PORT);

    // Loopback origin matches
    const isLoopbackHost =
      originHost === "127.0.0.1" ||
      originHost === "localhost" ||
      originHost === "::1" ||
      originHost === "[::1]" ||
      originHost === env.VERSO_HOST.toLowerCase();

    if (isLoopbackHost && originPort === configuredPort) {
      return true;
    }

    // Explicitly allowed origins
    if (env.VERSO_ALLOWED_ORIGINS.includes(originHeader)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function originGuard(req: Request, res: Response, next: NextFunction): void {
  // Safe read-only HTTP methods are permitted
  if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  // 1. Fetch Metadata check (Sec-Fetch-Site)
  const secFetchSite = req.headers["sec-fetch-site"];
  if (typeof secFetchSite === "string" && secFetchSite.toLowerCase() === "cross-site") {
    res.status(403).json({
      error: "Forbidden: cross-site state mutation blocked by Sec-Fetch-Site guard",
    });
    return;
  }

  // 2. Exact Origin header check
  const origin = req.headers["origin"];
  if (typeof origin === "string" && origin.length > 0) {
    if (!isAllowedOrigin(origin)) {
      res.status(403).json({
        error: `Forbidden: cross-origin request from '${origin}' rejected`,
      });
      return;
    }
  } else {
    // 3. If Origin is missing, inspect Referer header when present
    const referer = req.headers["referer"];
    if (typeof referer === "string" && referer.length > 0) {
      try {
        const refererOrigin = new URL(referer).origin;
        if (!isAllowedOrigin(refererOrigin)) {
          res.status(403).json({
            error: `Forbidden: cross-origin referer '${refererOrigin}' rejected`,
          });
          return;
        }
      } catch {
        res.status(403).json({
          error: "Forbidden: malformed referer header",
        });
        return;
      }
    }
  }

  next();
}

