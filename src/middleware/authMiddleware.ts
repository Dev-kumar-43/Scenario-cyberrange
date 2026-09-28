import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/jwt.js';

// Extend Express Request interface to include authenticated user payload
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Authentication middleware for protecting Express API routes.
 * Inspects the 'Authorization: Bearer <token>' header.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please provide a valid Bearer token.' });
  }

  const token = authHeader.substring(7).trim();
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }

  req.user = payload;
  next();
};

/**
 * Role-Based Access Control (RBAC) guard middleware.
 * Ensures the authenticated user has one of the required roles (e.g. 'ADMIN', 'INSTRUCTOR').
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Forbidden. Required role: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}.` 
      });
    }

    next();
  };
};
