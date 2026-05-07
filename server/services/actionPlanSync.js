import ActionPlan from '../models/ActionPlan.js';
import Directive from '../models/Directive.js';

function mapDirectiveToActionPlan(directive) {
  return {
    caseId: directive.caseId,
    directiveId: directive._id,
    directiveNumber: directive.directiveNumber,
    directiveText: directive.directiveText,
    sourceText: directive.sourceText,
    sourceParagraph: directive.sourceParagraph,
    confidenceScore: directive.confidenceScore,
    actionType: directive.actionType,
    actionDescription: directive.actionDescription,
    responsibleDepartment: directive.responsibleDepartment,
    assignedOfficer: directive.assignedOfficer,
    deadline: directive.deadline,
    deadlineInferred: directive.deadlineInferred,
    deadlineNote: directive.deadlineNote,
    priorityLevel: directive.priorityLevel,
    riskLevel: directive.riskLevel,
    riskScore: directive.riskScore,
    riskNote: directive.riskNote,
    verificationStatus: directive.verificationStatus,
    verifiedBy: directive.verifiedBy,
    verifiedAt: directive.verifiedAt,
    trackingStatus: directive.trackingStatus,
    trackingHistory: directive.trackingHistory,
    dependsOn: directive.dependsOn,
    whatIfRisk: directive.whatIfRisk,
    createdAt: directive.createdAt
  };
}

export async function syncActionPlansFromDirectives(directives = []) {
  if (!Array.isArray(directives) || directives.length === 0) return;

  const operations = directives.map((directive) => ({
    updateOne: {
      filter: { directiveId: directive._id },
      update: { $set: mapDirectiveToActionPlan(directive) },
      upsert: true
    }
  }));

  await ActionPlan.bulkWrite(operations, { ordered: false });
}

export async function syncActionPlanFromDirective(directive) {
  if (!directive) return null;
  return ActionPlan.findOneAndUpdate(
    { directiveId: directive._id },
    { $set: mapDirectiveToActionPlan(directive) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function deleteActionPlansByCase(caseId) {
  if (!caseId) return;
  await ActionPlan.deleteMany({ caseId });
}

export async function syncAllActionPlansFromDirectives() {
  const directives = await Directive.find({});
  await syncActionPlansFromDirectives(directives);
}
