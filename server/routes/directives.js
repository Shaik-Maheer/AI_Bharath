import express from 'express';
import Directive from '../models/Directive.js';
import AuditLog from '../models/AuditLog.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

const editableFields = [
  'actionType',
  'actionDescription',
  'responsibleDepartment',
  'assignedOfficer',
  'deadline',
  'priorityLevel',
  'riskLevel',
  'riskNote',
  'dependsOn'
];

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

router.put('/:id/verify', protect, authorize('admin', 'reviewer'), async (req, res, next) => {
  try {
    const directive = await Directive.findById(req.params.id);
    if (!directive) return res.status(404).json({ message: 'Directive could not be found.' });

    const { decision, reason = '', updates = {} } = req.body;
    if (!['approved', 'edited', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'Choose approve, edit, or reject for verification.' });
    }

    const changes = [];
    if (decision === 'edited') {
      editableFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(updates, field)) {
          const oldValue = JSON.stringify(directive[field] ?? '');
          const newValue = JSON.stringify(updates[field] ?? '');
          if (oldValue !== newValue) {
            changes.push({ field, oldValue, newValue, editedBy: req.user._id, reason });
            directive[field] = updates[field];
          }
        }
      });
      directive.editHistory.push(...changes);
    }

    directive.verificationStatus = decision;
    directive.verifiedBy = req.user._id;
    directive.verifiedAt = new Date();
    await directive.save();

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

router.put('/:id/status', protect, authorize('admin', 'reviewer'), async (req, res, next) => {
  try {
    const { status, note = '' } = req.body;
    if (!['Pending', 'In Progress', 'Completed', 'Escalated'].includes(status)) {
      return res.status(400).json({ message: 'Choose a valid tracking status.' });
    }

    const directive = await Directive.findById(req.params.id);
    if (!directive) return res.status(404).json({ message: 'Directive could not be found.' });

    const oldStatus = directive.trackingStatus;
    directive.trackingStatus = status;
    directive.trackingHistory.push({ status, updatedBy: req.user._id, note });
    await directive.save();

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

