import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Authentication is required.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'adhikarloop-dev-secret');
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({ message: 'Your session could not be verified.' });
    }

    req.user = user;
    next();
  } catch (_error) {
    res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }

    next();
  };
}

