import mongoose from 'mongoose';

const editHistorySchema = new mongoose.Schema(
  {
    field: String,
    oldValue: String,
    newValue: String,
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    editedAt: { type: Date, default: Date.now },
    reason: String
  },
  { _id: false }
);

const trackingHistorySchema = new mongoose.Schema(
  {
    status: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now },
    note: String
  },
  { _id: false }
);

const directiveSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
  directiveNumber: { type: Number, required: true },
  directiveText: { type: String, required: true },
  sourceText: { type: String, required: true },
  sourceParagraph: { type: Number, required: true },
  confidenceScore: { type: Number, min: 0, max: 100, required: true },
  actionType: { type: String, enum: ['compliance', 'appeal', 'review'], default: 'compliance' },
  actionDescription: { type: String, required: true },
  responsibleDepartment: {
    type: String,
    enum: [
      'Revenue',
      'Finance',
      'Police',
      'Legal',
      'Health',
      'Education',
      'Public Works',
      'District Administration',
      'Other'
    ],
    default: 'Other'
  },
  assignedOfficer: { type: String, default: 'Nodal Officer' },
  deadline: { type: Date, required: true },
  deadlineInferred: { type: Boolean, default: false },
  deadlineNote: { type: String, default: '' },
  priorityLevel: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  riskLevel: { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium' },
  riskScore: { type: Number, min: 0, max: 100, default: 60 },
  riskNote: { type: String, default: '' },
  verificationStatus: { type: String, enum: ['pending', 'approved', 'edited', 'rejected'], default: 'pending' },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  editHistory: [editHistorySchema],
  trackingStatus: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Escalated'], default: 'Pending' },
  trackingHistory: [trackingHistorySchema],
  dependsOn: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Directive' }],
  whatIfRisk: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Directive', directiveSchema);
