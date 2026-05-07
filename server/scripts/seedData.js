import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Case from '../models/Case.js';
import Directive from '../models/Directive.js';
import AuditLog from '../models/AuditLog.js';
import { processJudgmentText } from '../mock-ai/processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function seedDatabase({ reset = true } = {}) {
  if (reset) {
    await Promise.all([User.deleteMany({}), Case.deleteMany({}), Directive.deleteMany({}), AuditLog.deleteMany({})]);
  }

  if (!reset && (await User.countDocuments({})) > 0) {
    return { skipped: true };
  }

  const passwordHash = await bcrypt.hash('Demo@1234', 12);
  const [admin, reviewer] = await User.insertMany([
    { name: 'Asha Menon', email: 'admin@adhikar.gov.in', passwordHash, role: 'admin', department: 'Ministry Secretariat' },
    { name: 'Vikram Rao', email: 'reviewer@adhikar.gov.in', passwordHash, role: 'reviewer', department: 'Legal' },
    { name: 'Meera Iyer', email: 'viewer@adhikar.gov.in', passwordHash, role: 'viewer', department: 'Revenue' }
  ]);

  const sampleText = await fs.readFile(path.join(__dirname, '..', 'mock-ai', 'sample-judgment.txt'), 'utf8');
  const extraction = await processJudgmentText(sampleText);

  const verifiedCase = await Case.create({
    caseId: 'CASE-2024-001',
    ...extraction.caseDetails,
    uploadedBy: admin._id,
    pdfPath: '',
    extractedText: sampleText,
    status: 'verified',
    rawExtraction: extraction
  });

  const verifiedDirectives = await Directive.insertMany(
    extraction.directives.slice(0, 5).map((directive, index) => ({
      ...directive,
      caseId: verifiedCase._id,
      verificationStatus: index === 2 ? 'edited' : 'approved',
      verifiedBy: reviewer._id,
      verifiedAt: new Date('2024-02-16T10:00:00.000Z'),
      trackingStatus: ['In Progress', 'Pending', 'Completed', 'Pending', 'Escalated'][index],
      trackingHistory: [
        { status: 'Pending', updatedBy: reviewer._id, updatedAt: new Date('2024-02-16T10:00:00.000Z'), note: 'Approved for monitoring.' }
      ],
      editHistory:
        index === 2
          ? [
              {
                field: 'assignedOfficer',
                oldValue: '"District Administration Nodal Officer"',
                newValue: '"Deputy Commissioner"',
                editedBy: reviewer._id,
                editedAt: new Date('2024-02-16T10:05:00.000Z'),
                reason: 'Operational ownership clarified.'
              }
            ]
          : []
    }))
  );

  verifiedDirectives[1].dependsOn = [verifiedDirectives[0]._id];
  verifiedDirectives[2].dependsOn = [verifiedDirectives[0]._id];
  await Promise.all([verifiedDirectives[1].save(), verifiedDirectives[2].save()]);

  const pendingCase = await Case.create({
    caseId: 'CASE-2024-002',
    caseTitle: 'Citizens Forum v. State Health Mission',
    courtName: 'High Court of Delhi',
    caseNumber: 'W.P.(C) No. 3881 of 2024',
    petitioner: 'Citizens Forum for Public Health',
    respondent: 'State Health Mission and Others',
    dateOfOrder: new Date('2024-03-05T00:00:00.000Z'),
    uploadedBy: reviewer._id,
    pdfPath: '',
    extractedText:
      'The Health Department shall complete audit of district medicine stocks within 21 days. The Finance Department shall review budget release for emergency procurement. The Legal Department may review appeal options without delaying compliance.',
    status: 'pending_verification',
    rawExtraction: {}
  });

  await Directive.insertMany([
    {
      caseId: pendingCase._id,
      directiveNumber: 1,
      directiveText: 'Complete audit of district medicine stocks within 21 days.',
      sourceText: 'The Health Department shall complete audit of district medicine stocks within 21 days.',
      sourceParagraph: 12,
      confidenceScore: 84,
      actionType: 'compliance',
      actionDescription: 'Complete district-wise stock audit and record medicine availability gaps.',
      responsibleDepartment: 'Health',
      assignedOfficer: 'Health Nodal Officer',
      deadline: new Date('2024-03-26T00:00:00.000Z'),
      priorityLevel: 'High',
      riskLevel: 'High',
      riskNote: 'Delay can affect essential medicine availability.',
      deadlineNote: 'Explicit 21 day deadline.',
      whatIfRisk: 'If delayed beyond the deadline: HIGH risk of adverse public health findings. Recommended: immediate escalation to Mission Director.'
    },
    {
      caseId: pendingCase._id,
      directiveNumber: 2,
      directiveText: 'Review budget release for emergency procurement.',
      sourceText: 'The Finance Department shall review budget release for emergency procurement.',
      sourceParagraph: 13,
      confidenceScore: 77,
      actionType: 'review',
      actionDescription: 'Review budget release status and communicate procurement funding decision.',
      responsibleDepartment: 'Finance',
      assignedOfficer: 'Finance Nodal Officer',
      deadline: new Date('2024-04-04T00:00:00.000Z'),
      deadlineInferred: true,
      priorityLevel: 'Medium',
      riskLevel: 'Medium',
      riskNote: 'Deadline inferred; reviewer should confirm.',
      deadlineNote: 'Thirty-day review window inferred.',
      whatIfRisk: 'If delayed beyond the deadline: procurement bottleneck may become court-reportable non-compliance.'
    },
    {
      caseId: pendingCase._id,
      directiveNumber: 3,
      directiveText: 'Review appeal options without delaying compliance.',
      sourceText: 'The Legal Department may review appeal options without delaying compliance.',
      sourceParagraph: 14,
      confidenceScore: 73,
      actionType: 'appeal',
      actionDescription: 'Assess appeal viability and record that compliance is not stayed.',
      responsibleDepartment: 'Legal',
      assignedOfficer: 'Legal Nodal Officer',
      deadline: new Date('2024-04-04T00:00:00.000Z'),
      deadlineInferred: true,
      priorityLevel: 'Medium',
      riskLevel: 'Medium',
      riskNote: 'Low confidence appeal extraction requires careful human review.',
      deadlineNote: 'Limitation review window inferred.',
      whatIfRisk: 'If delayed beyond the deadline: appeal rights may be prejudiced, while compliance obligations continue.'
    }
  ]);

  await AuditLog.insertMany([
    { caseId: verifiedCase._id, action: 'case_uploaded', performedBy: admin._id, performedAt: new Date('2024-02-15T09:30:00.000Z'), details: { directives: 5 } },
    { caseId: verifiedCase._id, directiveId: verifiedDirectives[0]._id, action: 'approved', performedBy: reviewer._id, performedAt: new Date('2024-02-16T10:00:00.000Z'), details: {} },
    { caseId: verifiedCase._id, directiveId: verifiedDirectives[2]._id, action: 'edited', performedBy: reviewer._id, performedAt: new Date('2024-02-16T10:05:00.000Z'), details: { field: 'assignedOfficer' } },
    { caseId: verifiedCase._id, directiveId: verifiedDirectives[4]._id, action: 'status_changed', performedBy: admin._id, performedAt: new Date('2024-02-18T11:15:00.000Z'), details: { oldValue: 'Pending', newValue: 'Escalated' } }
  ]);

  return { skipped: false };
}
