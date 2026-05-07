import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', index: true },
  directiveId: { type: mongoose.Schema.Types.ObjectId, ref: 'Directive', index: true },
  action: { type: String, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  performedAt: { type: Date, default: Date.now },
  details: { type: Object, default: {} },
  ipAddress: { type: String, default: '' }
});

export default mongoose.model('AuditLog', auditLogSchema);

