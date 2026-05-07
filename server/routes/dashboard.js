import express from 'express';
import Directive from '../models/Directive.js';
import AuditLog from '../models/AuditLog.js';
import { protect } from '../middleware/auth.js';
import Case from '../models/Case.js';

const router = express.Router();

const approvedFilter = { verificationStatus: { $in: ['approved', 'edited'] } };

router.get('/summary', protect, async (_req, res, next) => {
  try {
    const now = new Date();
    const [activeCaseIds, totalActions, pending, inProgress, completed, overdue] = await Promise.all([
      Directive.distinct('caseId', approvedFilter),
      Directive.countDocuments(approvedFilter),
      Directive.countDocuments({ ...approvedFilter, trackingStatus: 'Pending' }),
      Directive.countDocuments({ ...approvedFilter, trackingStatus: 'In Progress' }),
      Directive.countDocuments({ ...approvedFilter, trackingStatus: 'Completed' }),
      Directive.countDocuments({ ...approvedFilter, deadline: { $lt: now }, trackingStatus: { $ne: 'Completed' } })
    ]);
    const activeCases = activeCaseIds.length;

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
      $or: [{ priorityLevel: 'High' }, { riskLevel: { $in: ['Critical', 'High'] } }, { riskScore: { $gte: 75 } }, { deadline: { $lt: now } }],
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

router.get('/actions', protect, async (req, res, next) => {
  try {
    const query = { ...approvedFilter };
    const { department, trackingStatus, priority } = req.query;

    if (department) query.responsibleDepartment = department;
    if (trackingStatus) query.trackingStatus = trackingStatus;
    if (priority) query.priorityLevel = priority;

    const actions = await Directive.find(query)
      .populate('caseId', 'caseId caseTitle courtName dateOfOrder petitioner respondent')
      .sort({ deadline: 1, createdAt: -1 });

    res.json({ actions });
  } catch (error) {
    next(error);
  }
});

router.get('/verification-queue', protect, async (_req, res, next) => {
  try {
    const pendingCases = await Case.find({ status: 'pending_verification' })
      .select('caseId caseTitle courtName dateOfOrder uploadedAt')
      .sort({ uploadedAt: -1 });

    const queue = await Promise.all(
      pendingCases.map(async (caseItem) => {
        const pending = await Directive.countDocuments({ caseId: caseItem._id, verificationStatus: 'pending' });
        const approved = await Directive.countDocuments({ caseId: caseItem._id, verificationStatus: { $in: ['approved', 'edited'] } });
        return {
          ...caseItem.toObject(),
          pendingDirectives: pending,
          approvedDirectives: approved
        };
      })
    );

    res.json({ queue });
  } catch (error) {
    next(error);
  }
});

router.get('/recent', protect, async (_req, res, next) => {
  try {
    const approvedDirectives = await Directive.find(approvedFilter).select('_id caseId').lean();
    const approvedDirectiveIds = approvedDirectives.map((item) => item._id);
    const approvedCaseIds = [...new Map(approvedDirectives.map((item) => [String(item.caseId), item.caseId])).values()];

    const audit = await AuditLog.find({
      $or: [
        { directiveId: { $in: approvedDirectiveIds } },
        { action: 'case_verified', caseId: { $in: approvedCaseIds } }
      ]
    })
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
