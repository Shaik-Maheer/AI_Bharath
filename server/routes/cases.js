import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import pdf from 'pdf-parse';
import mongoose from 'mongoose';
import Case from '../models/Case.js';
import Directive from '../models/Directive.js';
import AuditLog from '../models/AuditLog.js';
import { protect, authorize } from '../middleware/auth.js';
import { processJudgmentText } from '../mock-ai/processor.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upload = multer({
  dest: 'server/uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF uploads are accepted.'));
    }
    cb(null, true);
  }
});

async function nextCaseId() {
  const year = new Date().getFullYear();
  const count = await Case.countDocuments({ caseId: new RegExp(`^CASE-${year}-`) });
  return `CASE-${year}-${String(count + 1).padStart(3, '0')}`;
}

async function findCase(identifier) {
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const byId = await Case.findById(identifier).populate('uploadedBy', 'name email role');
    if (byId) return byId;
  }

  return Case.findOne({ caseId: identifier }).populate('uploadedBy', 'name email role');
}

async function createAudit(caseId, directiveId, action, userId, details, ipAddress) {
  await AuditLog.create({ caseId, directiveId, action, performedBy: userId, details, ipAddress });
}

router.get('/sample-judgment', protect, async (_req, res, next) => {
  try {
    const samplePath = path.join(__dirname, '..', 'mock-ai', 'sample-judgment.txt');
    const text = await fs.readFile(samplePath, 'utf8');
    res.type('text/plain').send(text);
  } catch (error) {
    next(error);
  }
});

router.post('/upload', protect, authorize('admin', 'reviewer'), upload.single('pdf'), async (req, res, next) => {
  try {
    let extractedText = req.body.text || '';
    let pdfPath = '';

    if (req.file) {
      pdfPath = req.file.path;
      const buffer = await fs.readFile(req.file.path);
      const parsed = await pdf(buffer);
      extractedText = parsed.text;
    }

    if (!extractedText.trim()) {
      return res.status(400).json({ message: 'Upload a PDF or paste judgment text before processing.' });
    }

    const rawExtraction = await processJudgmentText(extractedText);
    const createdCase = await Case.create({
      caseId: await nextCaseId(),
      ...rawExtraction.caseDetails,
      uploadedBy: req.user._id,
      pdfPath,
      extractedText,
      status: 'pending_verification',
      rawExtraction
    });

    const directives = await Directive.insertMany(
      rawExtraction.directives.map((directive) => ({
        ...directive,
        caseId: createdCase._id,
        trackingHistory: [{ status: 'Pending', updatedBy: req.user._id, note: 'Directive created from AI extraction.' }]
      }))
    );

    await createAudit(createdCase._id, null, 'case_uploaded', req.user._id, { directives: directives.length }, req.ip);

    res.status(201).json({ case: createdCase, directives, extraction: rawExtraction });
  } catch (error) {
    next(error);
  }
});

router.get('/', protect, async (req, res, next) => {
  try {
    const { status, startDate, endDate, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (startDate || endDate) {
      query.dateOfOrder = {};
      if (startDate) query.dateOfOrder.$gte = new Date(startDate);
      if (endDate) query.dateOfOrder.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { caseTitle: new RegExp(search, 'i') },
        { caseNumber: new RegExp(search, 'i') },
        { caseId: new RegExp(search, 'i') }
      ];
    }

    const cases = await Case.find(query).populate('uploadedBy', 'name email role').sort({ uploadedAt: -1 });
    const counts = await Directive.aggregate([{ $group: { _id: '$caseId', count: { $sum: 1 } } }]);
    const countMap = new Map(counts.map((item) => [String(item._id), item.count]));

    res.json({ cases: cases.map((item) => ({ ...item.toObject(), actionsCount: countMap.get(String(item._id)) || 0 })) });
  } catch (error) {
    next(error);
  }
});

router.get('/:caseId', protect, async (req, res, next) => {
  try {
    const foundCase = await findCase(req.params.caseId);
    if (!foundCase) return res.status(404).json({ message: 'Case could not be found.' });

    const directives = await Directive.find({ caseId: foundCase._id })
      .populate('verifiedBy', 'name email role')
      .populate('dependsOn', 'directiveNumber trackingStatus')
      .sort({ directiveNumber: 1 });
    const audit = await AuditLog.find({ caseId: foundCase._id }).populate('performedBy', 'name email role').sort({ performedAt: -1 });

    res.json({ case: foundCase, directives, audit });
  } catch (error) {
    next(error);
  }
});

router.put('/:caseId/submit-verified', protect, authorize('admin', 'reviewer'), async (req, res, next) => {
  try {
    const foundCase = await findCase(req.params.caseId);
    if (!foundCase) return res.status(404).json({ message: 'Case could not be found.' });

    const pending = await Directive.countDocuments({ caseId: foundCase._id, verificationStatus: 'pending' });
    if (pending > 0) {
      return res.status(400).json({ message: 'All directives must be verified or rejected before submission.' });
    }

    const approvedCount = await Directive.countDocuments({ caseId: foundCase._id, verificationStatus: { $in: ['approved', 'edited'] } });
    if (approvedCount === 0) {
      return res.status(400).json({ message: 'At least one directive must be approved or edited to move this case forward.' });
    }

    foundCase.status = 'active';
    await foundCase.save();
    await createAudit(foundCase._id, null, 'case_verified', req.user._id, { approvedCount }, req.ip);
    res.json({ case: foundCase });
  } catch (error) {
    next(error);
  }
});

router.delete('/:caseId', protect, authorize('admin'), async (req, res, next) => {
  try {
    const foundCase = await findCase(req.params.caseId);
    if (!foundCase) return res.status(404).json({ message: 'Case could not be found.' });

    await Directive.deleteMany({ caseId: foundCase._id });
    await AuditLog.deleteMany({ caseId: foundCase._id });
    await foundCase.deleteOne();

    res.json({ message: 'Case and related enforcement records deleted.' });
  } catch (error) {
    next(error);
  }
});

export default router;
