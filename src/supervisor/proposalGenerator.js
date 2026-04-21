function generateProposals(request, plan, skills, knowledge) {
  const proposals = [];
  const requestLower = request.toLowerCase();
  
  const hasExistingTools = skills.length > 0;
  const hasKnowledge = knowledge.length > 0;
  const isComplex = requestLower.includes(' and ') || requestLower.includes(' then ') || requestLower.includes('sau đó');
  
  proposals.push({
    id: 'proposal_1',
    name: 'Tận dụng tối đa hiện có',
    description: 'Sử dụng các tool và KB đang có, thêm logic xử lý đơn giản',
    approach: hasExistingTools ? 'reuse_existing' : 'minimal_extension',
    tools: skills.map(s => s.name),
    knowledge: knowledge.map(k => k.title),
    pros: [
      'Nhanh nhất - tận dụng code có sẵn',
      'Rủi ro thấp',
      'Dễ bảo trì'
    ],
    cons: [
      'Có thể không tối ưu cho edge cases',
      'Cần thêm validation logic'
    ],
    estimatedTime: '1-2 ngày',
    confidence: hasExistingTools ? 0.85 : 0.6,
    complexity: 'low'
  });

  proposals.push({
    id: 'proposal_2',
    name: 'Mở rộng có chọn lọc',
    description: 'Bổ sung module mới cho các phần thiếu, giữ nguyên kiến trúc hiện tại',
    approach: 'selective_extension',
    tools: [...skills.map(s => s.name), 'ProposalGenerator', 'ApprovalHandler'],
    knowledge: [...knowledge.map(k => k.title), 'approval_workflow'],
    pros: [
      'Cân bằng giữa tốc độ và chức năng',
      'Mở rộng có kiểm soát',
      'Dễ scale sau này'
    ],
    cons: [
      'Cần thêm 2 module mới',
      'Integration testing cần thiết'
    ],
    estimatedTime: '2-3 ngày',
    confidence: 0.8,
    complexity: 'medium'
  });

  proposals.push({
    id: 'proposal_3',
    name: 'Build mới hoàn toàn',
    description: 'Viết lại phần xử lý proposal từ đầu, tích hợp RAG cho research',
    approach: isComplex ? 'full_rebuild_with_rag' : 'full_rebuild',
    tools: [...skills.map(s => s.name), 'RequirementAnalyzer', 'CapabilityMapper', 'GapDetector', 'ResearchPlanner', 'SolutionArchitect'],
    knowledge: [...knowledge.map(k => k.title), 'rag_patterns', 'best_practices'],
    pros: [
      'Fit 100% với yêu cầu',
      'Clean architecture',
      'Dễ mở rộng về sau'
    ],
    cons: [
      'Tốn thời gian nhất',
      'Mất công xây lại',
      'Có thể over-engineer'
    ],
    estimatedTime: '3-5 ngày',
    confidence: 0.95,
    complexity: 'high'
  });

  return proposals;
}

function selectBestProposal(proposals, preference = 'balanced') {
  if (preference === 'speed') {
    return proposals.sort((a, b) => a.complexity.localeCompare(b.complexity))[0];
  }
  if (preference === 'quality') {
    return proposals.sort((a, b) => b.confidence - a.confidence)[0];
  }
  return proposals[1];
}

module.exports = {
  generateProposals,
  selectBestProposal,
};