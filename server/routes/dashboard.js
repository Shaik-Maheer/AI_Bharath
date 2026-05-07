import express from 'express';
import Directive from '../models/Directive.js';
import Case from '../models/Case.js';
import AuditLog from '../models/AuditLog.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const approvedFilter = { verificationStatus: { $in: ['approved', 'edited'] } };

router.get('/summary', protect, async (_req, res, next) => {
  try {
    const now = new Date();
    const [activeCases, totalActions, pending, inProgress, completed, overdue] = await Promise.all([
      Case.countDocuments({ status: { $in: ['verified', 'active'] } }),
      Directive.countDocuments(approvedFilter),
      Directive.countDocuments({ ...approvedFilter, trackingStatus: 'Pending' }),
      Directive.countDocuments({ ...approvedFilter, trackingStatus: 'In Progress' }),
      Directive.countDocuments({ ...approvedFilter, trackingStatus: 'Completed' }),
      Directive.countDocuments({ ...approvedFilter, deadline: { $lt: now }, trackingStatus: { $ne: 'Completed' } })
    ]);

    res.json({ activeCases, totalActions, pending, inProgress, completed, overdue });
  } catch (error) {
    next(error);
  }
});

router.get('/department', protect, async (_req, res, next) => {
  try {
    const breakdown = await Directive.aggregate([
      { $match: approvedFilter },
      { $group: { _id: '$responsibleDepartment', count: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ['$trackingStatus', 'Pending'] }, 1, 0] } } } },
      { $sort: { count: -1 } }
    ]);
    res.json({ breakdown: breakdown.map((item) => ({ department: item._id, count: item.count, pending: item.pending })) });
  } catch (error) {
    next(error);
  }
});

router.get('/high-risk', protect, async (_req, res, next) => {
  try {
    const now = new Date();
    const actions = await Directive.find({
      ...approvedFilter,
      $or: [{ priorityLevel: 'High' }, { riskLevel: { $in: ['Critical', 'High'] } }, { deadline: { $lt: now } }],
      trackingStatus: { $ne: 'Completed' }
    })
      .populate('caseId', 'caseId caseTitle courtName')
      .sort({ deadline: 1 })
      .limit(5);
    res.json({ actions });
  } catch (error) {
    next(error);
  }
});

router.get('/recent', protect, async (_req, res, next) => {
  try {
    const audit = await AuditLog.find({})
      .populate('performedBy', 'name email role')
      .populate('caseId', 'caseId caseTitle')
      .populate('directiveId', 'directiveNumber')
      .sort({ performedAt: -1 })
      .limit(10);
    res.json({ audit });
  } catch (error) {
    next(error);
  }
});

export default router;

