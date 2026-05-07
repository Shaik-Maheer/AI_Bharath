import mongoose from 'mongoose';

const caseSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true, index: true },
  caseTitle: { type: String, required: true },
  courtName: { type: String, required: true },
  caseNumber: { type: String, required: true },
  petitioner: { type: String, required: true },
  respondent: { type: String, required: true },
  dateOfOrder: { type: Date, required: true },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pdfPath: { type: String, default: '' },
  extractedText: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending_extraction', 'extracted', 'pending_verification', 'verified', 'active'],
    default: 'pending_extraction'
  },
  rawExtraction: { type: Object, default: {} }
});

export default mongoose.model('Case', caseSchema);

