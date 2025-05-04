import { Request, Response, NextFunction } from 'express';
import authService from '../lib/auth';
import db from '../lib/postgres';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * Authentication middleware
 * Verifies the JWT token in the Authorization header
 * and attaches the user to the request object
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // Extract the token (Bearer token)
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    // Verify the token
    const user = authService.verifyToken(token);
    
    // Attach the user to the request object
    req.user = user;
    
    // Continue to the next middleware or route handler
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Role-based authorization middleware
 * Checks if the user has the required position
 * @param positions - Array of allowed position names
 */
export const authorize = (positions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // Get the user's position
      const positionResult = await db.query(
        'SELECT p.name FROM positions p JOIN users u ON p.id = u.position_id WHERE u.id = $1',
        [req.user.id]
      );
      
      if (positionResult.rows.length === 0) {
        return res.status(403).json({ error: 'Position not found' });
      }
      
      const userPosition = positionResult.rows[0].name;
      
      // Check if the user's position is in the allowed positions
      if (!positions.includes(userPosition)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      // Continue to the next middleware or route handler
      next();
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  };
};

/**
 * Owner authorization middleware
 * Checks if the user is an owner or admin
 */
export const authorizeOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Get the user's position
    const positionResult = await db.query(
      'SELECT p.name, p.level FROM positions p JOIN users u ON p.id = u.position_id WHERE u.id = $1',
      [req.user.id]
    );
    
    if (positionResult.rows.length === 0) {
      return res.status(403).json({ error: 'Position not found' });
    }
    
    const userPosition = positionResult.rows[0].name.toLowerCase();
    const positionLevel = positionResult.rows[0].level;
    
    // Check if the user is an owner or has a high position level
    if (userPosition === 'owner' || userPosition === 'admin' || positionLevel >= 4) {
      // Continue to the next middleware or route handler
      next();
    } else {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Self or owner authorization middleware
 * Checks if the user is accessing their own data or is an owner/admin
 * @param paramName - Name of the parameter containing the user ID
 */
export const authorizeSelfOrOwner = (paramName: string = 'id') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // Get the requested user ID from the parameters
      const requestedUserId = req.params[paramName];
      
      // If the user is accessing their own data, allow it
      if (req.user.id === requestedUserId) {
        return next();
      }
      
      // Otherwise, check if the user is an owner or admin
      const positionResult = await db.query(
        'SELECT p.name, p.level FROM positions p JOIN users u ON p.id = u.position_id WHERE u.id = $1',
        [req.user.id]
      );
      
      if (positionResult.rows.length === 0) {
        return res.status(403).json({ error: 'Position not found' });
      }
      
      const userPosition = positionResult.rows[0].name.toLowerCase();
      const positionLevel = positionResult.rows[0].level;
      
      // Check if the user is an owner or has a high position level
      if (userPosition === 'owner' || userPosition === 'admin' || positionLevel >= 4) {
        // Continue to the next middleware or route handler
        next();
      } else {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  };
};