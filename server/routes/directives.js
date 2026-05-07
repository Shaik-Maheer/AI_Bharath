import express from 'express';
import mongoose from 'mongoose';
import Directive from '../models/Directive.js';
import AuditLog from '../models/AuditLog.js';
import { protect, authorize, ROLES } from '../middleware/auth.js';
import { syncActionPlanFromDirective } from '../services/actionPlanSync.js';

const router = express.Router();

const editableFields = [
  'actionType',
  'actionDescription',
  'responsibleDepartment',
  'assignedOfficer',
  'deadline',
  'priorityLevel',
  'riskLevel',
  'riskScore',
  'riskNote',
  'dependsOn'
];

async function normalizeDependencies(dependsOn, directive) {
  if (!Array.isArray(dependsOn)) {
    throw new Error('Dependencies must be provided as an array.');
  }

  const normalizedIds = [...new Set(dependsOn.map((id) => String(id).trim()).filter(Boolean))];
  if (normalizedIds.some((id) => id === String(directive._id))) {
    throw new Error('A directive cannot depend on itself.');
  }
  if (normalizedIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw new Error('Dependencies include an invalid directive identifier.');
  }

  if (!normalizedIds.length) return [];

  const existing = await Directive.countDocuments({ _id: { $in: normalizedIds }, caseId: directive.caseId });
  if (existing !== normalizedIds.length) {
    throw new Error('Dependencies must reference directives from the same case.');
  }

  return normalizedIds;
}

router.get('/case/:caseId', protect, async (req, res, next) => {
  try {
    const directives = await Directive.find({ caseId: req.params.caseId })
      .populate('verifiedBy', 'name email role')
      .populate('dependsOn', 'directiveNumber trackingStatus')
      .sort({ directiveNumber: 1 });
    res.json({ directives });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/verify', protect, authorize(ROLES.REVIEWER), async (req, res, next) => {
  try {
    const directive = await Directive.findById(req.params.id);
    if (!directive) return res.status(404).json({ message: 'Directive could not be found.' });

    const { decision, reason = '', updates = {} } = req.body;
    if (!['approved', 'edited', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'Choose approve, edit, or reject for verification.' });
    }

    const normalizedUpdates = { ...updates };
    const changes = [];
    if (decision === 'edited') {
      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'dependsOn')) {
        try {
          normalizedUpdates.dependsOn = await normalizeDependencies(normalizedUpdates.dependsOn, directive);
        } catch (validationError) {
          return res.status(400).json({ message: validationError.message });
        }
      }
      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'riskScore')) {
        const riskScore = Number(normalizedUpdates.riskScore);
        if (!Number.isFinite(riskScore) || riskScore < 0 || riskScore > 100) {
          return res.status(400).json({ message: 'Risk score must be between 0 and 100.' });
        }
        normalizedUpdates.riskScore = Math.round(riskScore);
      }

      editableFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(normalizedUpdates, field)) {
          const oldValue = JSON.stringify(directive[field] ?? '');
          const newValue = JSON.stringify(normalizedUpdates[field] ?? '');
          if (oldValue !== newValue) {
            changes.push({ field, oldValue, newValue, editedBy: req.user._id, reason });
            directive[field] = normalizedUpdates[field];
          }
        }
      });
      directive.editHistory.push(...changes);
    }

    directive.verificationStatus = decision;
    directive.verifiedBy = req.user._id;
    directive.verifiedAt = new Date();
    await directive.save();
    await syncActionPlanFromDirective(directive);

    await AuditLog.create({
      caseId: directive.caseId,
      directiveId: directive._id,
      action: decision,
      performedBy: req.user._id,
      details: { reason, changes },
      ipAddress: req.ip
    });

    res.json({ directive });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/status', protect, authorize(ROLES.ADMIN, ROLES.REVIEWER), async (req, res, next) => {
  try {
    const { status, note = '' } = req.body;
    if (!['Pending', 'In Progress', 'Completed', 'Escalated'].includes(status)) {
      return res.status(400).json({ message: 'Choose a valid tracking status.' });
    }
    if (status === 'Escalated' && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ message: 'Only admin can escalate overdue actions.' });
    }

    const directive = await Directive.findById(req.params.id);
    if (!directive) return res.status(404).json({ message: 'Directive could not be found.' });
    if (!['approved', 'edited'].includes(directive.verificationStatus)) {
      return res.status(400).json({ message: 'Only approved directives can move through action tracking.' });
    }

    const oldStatus = directive.trackingStatus;
    directive.trackingStatus = status;
    directive.trackingHistory.push({ status, updatedBy: req.user._id, note });
    await directive.save();
    await syncActionPlanFromDirective(directive);

    await AuditLog.create({
      caseId: directive.caseId,
      directiveId: directive._id,
      action: 'status_changed',
      performedBy: req.user._id,
      details: { field: 'trackingStatus', oldValue: oldStatus, newValue: status, note },
      ipAddress: req.ip
    });

    res.json({ directive });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/whatif', protect, async (req, res, next) => {
  try {
    const directive = await Directive.findById(req.params.id);
    if (!directive) return res.status(404).json({ message: 'Directive could not be found.' });
    res.json({ whatIfRisk: directive.whatIfRisk });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/audit', protect, async (req, res, next) => {
  try {
    const audit = await AuditLog.find({ directiveId: req.params.id }).populate('performedBy', 'name email role').sort({ performedAt: -1 });
    res.json({ audit });
  } catch (error) {
    next(error);
  }
});

export default router;
