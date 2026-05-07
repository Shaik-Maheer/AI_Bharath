import express from 'express';
import ActionPlan from '../models/ActionPlan.js';
import AuditLog from '../models/AuditLog.js';
import { protect } from '../middleware/auth.js';
import Case from '../models/Case.js';

const router = express.Router();

const approvedStatuses = ['approved', 'edited'];
const trustedCaseStatuses = ['active', 'verified'];

async function trustedCaseIds() {
  return Case.distinct('_id', { status: { $in: trustedCaseStatuses } });
}

router.get('/summary', protect, async (_req, res, next) => {
  try {
    const now = new Date();
    const caseIds = await trustedCaseIds();
    const approvedFilter = { verificationStatus: { $in: approvedStatuses }, caseId: { $in: caseIds } };
    const [activeCaseIds, totalActions, pending, inProgress, completed, overdue] = await Promise.all([
      ActionPlan.distinct('caseId', approvedFilter),
      ActionPlan.countDocuments(approvedFilter),
      ActionPlan.countDocuments({ ...approvedFilter, trackingStatus: 'Pending' }),
      ActionPlan.countDocuments({ ...approvedFilter, trackingStatus: 'In Progress' }),
      ActionPlan.countDocuments({ ...approvedFilter, trackingStatus: 'Completed' }),
      ActionPlan.countDocuments({ ...approvedFilter, deadline: { $lt: now }, trackingStatus: { $ne: 'Completed' } })
    ]);
    const activeCases = activeCaseIds.length;

    res.json({ activeCases, totalActions, pending, inProgress, completed, overdue });
  } catch (error) {
    next(error);
  }
});

router.get('/department', protect, async (_req, res, next) => {
  try {
    const caseIds = await trustedCaseIds();
    const breakdown = await ActionPlan.aggregate([
      { $match: { verificationStatus: { $in: approvedStatuses }, caseId: { $in: caseIds } } },
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
    const caseIds = await trustedCaseIds();
    const actions = await ActionPlan.find({
      verificationStatus: { $in: approvedStatuses },
      caseId: { $in: caseIds },
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
    const caseIds = await trustedCaseIds();
    const query = { verificationStatus: { $in: approvedStatuses }, caseId: { $in: caseIds } };
    const { department, trackingStatus, priority } = req.query;

    if (department) query.responsibleDepartment = department;
    if (trackingStatus) query.trackingStatus = trackingStatus;
    if (priority) query.priorityLevel = priority;

    const actions = await ActionPlan.find(query)
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

    const counts = await ActionPlan.aggregate([
      { $match: { caseId: { $in: pendingCases.map((item) => item._id) } } },
      {
        $group: {
          _id: '$caseId',
          pendingDirectives: { $sum: { $cond: [{ $eq: ['$verificationStatus', 'pending'] }, 1, 0] } },
          approvedDirectives: { $sum: { $cond: [{ $in: ['$verificationStatus', approvedStatuses] }, 1, 0] } }
        }
      }
    ]);
    const countsByCase = new Map(counts.map((item) => [String(item._id), item]));

    const queue = pendingCases.map((caseItem) => {
      const count = countsByCase.get(String(caseItem._id));
      return {
        ...caseItem.toObject(),
        pendingDirectives: count?.pendingDirectives || 0,
        approvedDirectives: count?.approvedDirectives || 0
      };
    });

    res.json({ queue });
  } catch (error) {
    next(error);
  }
});

router.get('/recent', protect, async (_req, res, next) => {
  try {
    const caseIds = await trustedCaseIds();
    const approvedPlans = await ActionPlan.find({ verificationStatus: { $in: approvedStatuses }, caseId: { $in: caseIds } })
      .select('directiveId caseId')
      .lean();
    const approvedDirectiveIds = approvedPlans.map((item) => item.directiveId).filter(Boolean);
    const approvedCaseIds = [...new Map(approvedPlans.map((item) => [String(item.caseId), item.caseId])).values()];

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
