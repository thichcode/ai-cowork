const pendingApprovals = new Map();

let onApprovalCreated = null;
let onApprovalApproved = null;
let onApprovalRejected = null;

function setCallbacks({ onCreated, onApproved, onRejected } = {}) {
  if (onCreated) onApprovalCreated = onCreated;
  if (onApproved) onApprovalApproved = onApproved;
  if (onRejected) onApprovalRejected = onRejected;
}

function createApprovalRequest(jobId, proposals, metadata = {}) {
  const approvalRequest = {
    id: `approval_${jobId}`,
    jobId,
    proposals,
    metadata,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    respondedAt: null,
    selectedProposal: null,
    response: null,
  };
  pendingApprovals.set(jobId, approvalRequest);
  
  if (onApprovalCreated) {
    onApprovalCreated(jobId, proposals, metadata);
  }
  
  return approvalRequest;
}

function getApprovalRequest(jobId) {
  return pendingApprovals.get(jobId);
}

function approveProposal(jobId, proposalId, userResponse = '') {
  const approval = pendingApprovals.get(jobId);
  if (!approval) {
    return { success: false, error: 'Approval request not found' };
  }
  if (approval.status !== 'PENDING') {
    return { success: false, error: 'Approval already processed' };
  }
  
  const selectedProposal = approval.proposals.find(p => p.id === proposalId);
  if (!selectedProposal) {
    return { success: false, error: 'Proposal not found' };
  }
  
  approval.status = 'APPROVED';
  approval.respondedAt = new Date().toISOString();
  approval.selectedProposal = selectedProposal;
  approval.response = userResponse;
  
  if (onApprovalApproved) {
    onApprovalApproved(jobId, proposalId, selectedProposal);
  }
  
  return { success: true, approval };
}

function rejectProposal(jobId, userResponse = '') {
  const approval = pendingApprovals.get(jobId);
  if (!approval) {
    return { success: false, error: 'Approval request not found' };
  }
  if (approval.status !== 'PENDING') {
    return { success: false, error: 'Approval already processed' };
  }
  
  approval.status = 'REJECTED';
  approval.respondedAt = new Date().toISOString();
  approval.response = userResponse;
  
  if (onApprovalRejected) {
    onApprovalRejected(jobId, userResponse);
  }
  
  return { success: true, approval };
}

function isAwaitingApproval(jobId) {
  const approval = pendingApprovals.get(jobId);
  return approval && approval.status === 'PENDING';
}

function cancelApproval(jobId) {
  return pendingApprovals.delete(jobId);
}

module.exports = {
  createApprovalRequest,
  getApprovalRequest,
  approveProposal,
  rejectProposal,
  isAwaitingApproval,
  cancelApproval,
  setCallbacks,
  pendingApprovals,
};