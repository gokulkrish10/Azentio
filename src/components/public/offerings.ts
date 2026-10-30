// Editorial content for the synthetic hackathon, not deployed product claims.
export const offerings = [
  {
    id: 'financial-analysis-intelligence',
    number: '01',
    title: 'Financial Analysis Intelligence',
    short: 'Make room for the full financial picture.',
    description:
      'Explore how seasonal context can inform the interpretation of SME cash flow through an illustrative, synthetic comparison.',
    category: 'Financial insight',
    inputs: 'Synthetic quarterly cash-flow values',
    output: 'A simulated explanation of equivalent-period comparisons',
    available: true,
  },
  {
    id: 'document-intelligence',
    number: '02',
    title: 'Document Intelligence',
    short: 'Explore the context within documents.',
    description:
      'Discuss document review challenges and contribute observations about evidence, interpretation and operational workflows.',
    category: 'Document workflows',
    inputs: 'Proposed document-review scenarios',
    output: 'A conversation about workflow needs; no document-processing demo is available',
    available: false,
  },
  {
    id: 'regulatory-intelligence',
    number: '03',
    title: 'Regulatory Intelligence',
    short: 'Bring clarity to complex requirements.',
    description:
      'Explore opportunities for clearer reporting workflows and share observations about regulatory interpretation and evidence.',
    category: 'Reporting workflows',
    inputs: 'Proposed reporting scenarios',
    output: 'A conversation about workflow needs; no regulatory decision engine is available',
    available: false,
  },
] as const;
