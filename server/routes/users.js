import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { protect, authorize, ROLES } from '../middleware/auth.js';
import { departments } from '../mock-ai/processor.js';

const router = express.Router();
const allowedRoles = [ROLES.ADMIN, ROLES.REVIEWER, ROLES.VIEWER];
const allowedDepartments = [...new Set([...departments, 'Ministry Secretariat', 'Legal'])];

function normalizeRole(role = ROLES.VIEWER) {
  const normalized = String(role || '').toLowerCase();
  if (!allowedRoles.includes(normalized)) {
    throw new Error('Role must be admin, reviewer, or viewer.');
  }
  return normalized;
}

function normalizeDepartment(department = 'Legal') {
  const normalized = String(department || '').trim();
  if (!normalized) return 'Legal';
  if (!allowedDepartments.includes(normalized)) {
    throw new Error(`Department must be one of: ${allowedDepartments.join(', ')}`);
  }
  return normalized;
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

router.get('/meta', protect, authorize(ROLES.ADMIN), (_req, res) => {
  res.json({ roles: allowedRoles, departments: allowedDepartments });
});

router.get('/', protect, authorize(ROLES.ADMIN), async (_req, res, next) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json({ users: users.map(publicUser) });
  } catch (error) {
    next(error);
  }
});

router.post('/', protect, authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const { name, email, password, role = ROLES.VIEWER, department = 'Legal' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ message: 'A user with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const created = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      role: normalizeRole(role),
      department: normalizeDepartment(department)
    });

    res.status(201).json({ user: publicUser(created) });
  } catch (error) {
    if (error.message.includes('Role must be') || error.message.includes('Department must be')) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
});

router.put('/:id', protect, authorize(ROLES.ADMIN), async (req, res, next) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found.' });

    const updates = req.body || {};
    if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
      target.name = String(updates.name || '').trim() || target.name;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'department')) {
      target.department = normalizeDepartment(updates.department);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'role')) {
      const nextRole = normalizeRole(updates.role);
      if (target.role === ROLES.ADMIN && nextRole !== ROLES.ADMIN) {
        const adminCount = await User.countDocuments({ role: ROLES.ADMIN });
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'At least one admin account is required.' });
        }
      }
      target.role = nextRole;
    }
    if (updates.password) {
      target.passwordHash = await bcrypt.hash(String(updates.password), 12);
    }

    await target.save();
    res.json({ user: publicUser(target) });
  } catch (error) {
    if (error.message.includes('Role must be') || error.message.includes('Department must be')) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
});

export default router;
