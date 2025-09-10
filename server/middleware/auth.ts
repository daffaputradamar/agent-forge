import { clerkMiddleware as baseClerkMiddleware, requireAuth as clerkRequireAuth, getAuth } from '@clerk/express';
import type { RequestHandler } from 'express';

export const clerkMiddleware: RequestHandler = baseClerkMiddleware({
    publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
});

export function requireAuth(): RequestHandler {
  // Wrap the official requireAuth to return JSON on failure instead of redirect.
  return (req, res, next) => {
    try {
      clerkRequireAuth()(req, res, next);
    } catch (e) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  };
}

export function getUserId(req: any): string | null {
  const auth = getAuth(req);
  return auth?.userId;
}
