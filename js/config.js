// Deep Research Agent Configuration
const CONFIG = {
  // Vertesia API Configuration
  VERTESIA_API_BASE: 'https://api.vertesia.io/api/v1',
  VERTESIA_API_KEY: 'sk-7681b09add1b0095a8a84b673953b856',
  ENVIRONMENT_ID: '681915c6a01fb262a410c161',
  MODEL: 'publishers/anthropic/models/claude-sonnet-4',
  
  // Research Agent Configuration
  INTERACTION_NAME: 'ResearchV2',
  
  // Research Capabilities
  RESEARCH_CAPABILITIES: {
    "Traditional Analysis": [
      "General Analysis",
      "Margin & Return Metrics",
      "Debt & Liquidity Assessment",
      "Porter's Five Forces",
      "SWOT Analysis",
      "DCF Valuation"
    ],
    
    "Ecosystem Focused": [
      "Ecosystem Mapping",
      "Supply Chain Contagion Modeling"
    ],
    
    "Narrative Centric": [
      "Narrative Momentum Analysis",
      "Competitive Response Patterns",
      "Leadership and Management Quality Assessment"
    ],
    
    "Comparative": [
      "Multi-asset Time Series Analysis",
      "Multi-asset Head to Head evaluation",
      "Industry Trends",
      "Exposures and Business Models"
    ],
    
    "Scenario Modeling": [
      "Risk Correlation Study",
      "Industry Consolidation: M&A",
      "Monetary Policy & Interest Rate"
    ],
    
    "Company Insights": [
      "Management Team",
      "Alliance & Partnerships: Past, Current, Future",
      "Industry Trend Analysis"
    ],
    
    "Custom Research": [
      "Custom"
    ]
  },
  
  // Context Hints for Each Framework
  CONTEXT_HINTS: {
    // Traditional Analysis
    "General Analysis": "Enter company or topic for comprehensive analysis (e.g., NVIDIA, semiconductor industry)",
    "Margin & Return Metrics": "Enter company for profitability analysis (e.g., NVIDIA margins, Microsoft ROIC, Apple ROE)",
    "Debt & Liquidity Assessment": "Enter company for balance sheet health (e.g., AT&T debt load, Tesla liquidity, Boeing solvency)",
    "Porter's Five Forces": "Enter company/industry (e.g., Tesla in EV market, Netflix in streaming)",
    "SWOT Analysis": "Enter company for strengths, weaknesses, opportunities, threats (e.g., Apple, Microsoft)",
    "DCF Valuation": "Enter company for discounted cash flow valuation (e.g., NVDA, GOOGL, TSLA)",
    
    // Ecosystem Focused
    "Ecosystem Mapping": "Enter company to map suppliers, partners, competitors, dependencies (e.g., Apple, Tesla)",
    "Supply Chain Contagion Modeling": "Describe disruption scenario (e.g., Taiwan semiconductor shutdown, China rare earth embargo)",
    
    // Narrative Centric
    "Narrative Momentum Analysis": "Enter narrative theme and companies (e.g., AI leader narrative: NVDA, GOOGL, MSFT, META)",
    "Competitive Response Patterns": "Enter companies for historical competitive behavior (e.g., Amazon vs Walmart over 10 years)",
    "Leadership and Management Quality Assessment": "Enter company to evaluate leadership effectiveness (e.g., Microsoft under Nadella, Apple post-Jobs)",
    
    // Comparative
    "Multi-asset Time Series Analysis": "Enter 2-3 assets with timeframe (e.g., NVDA, AMD, INTC from 2020-2025)",
    "Multi-asset Head to Head evaluation": "Enter 2+ companies for direct comparison (e.g., Tesla vs Rivian vs Lucid: product, financials, market position)",
    "Industry Trends": "Enter a sector to compare industry trends. (e.g., AI adoption: healthcare vs finance vs manufacturing)",
    "Exposures and Business Models": "Enter companies to analyze revenue streams, market dependencies, and business model resilience (e.g., Apple, Amazon)",
    
    // Scenario Modeling
    "Risk Correlation Study": "Enter companies to map interconnected risks (e.g., oil prices impact on airlines, shipping, retail)",
    "Industry Consolidation: M&A": "Enter industry or companies for M&A analysis (e.g., semiconductor consolidation, potential Adobe-Figma scenarios)",
    "Monetary Policy & Interest Rate": "Enter companies/sectors to analyze interest rate sensitivity (e.g., REITs, utilities, tech growth stocks)",
    
    // Company Insights
    "Management Teams": "Enter industry or company for workforce analysis (e.g., semiconductor engineers, AI researchers at Google)",
    "Alliance & Partnerships: Past, Current, Future": "Enter company to map partnerships and predict future alliances (e.g., Microsoft, Starbucks)",
    "Industry Trend Analysis": "Enter industry and timeframe (e.g., renewable energy 2020-2030, semiconductor cycles)",
    
    // Custom Research
    "Custom Framework": "Describe your research question or analytical approach in detail. Be as specific as possible."
  },
  
  // Framework Auto-Defaults for Modifiers
  FRAMEWORK_DEFAULTS: {
    "DCF Valuation": { 
      scope: "Assets", 
      depth: "Comprehensive", 
      rigor: "Exhaustive Research", 
      perspective: "Investment" 
    },
    "General Analysis": { 
      scope: "Assets", 
      depth: "Comprehensive", 
      rigor: "Detailed Analysis", 
      perspective: "Investment" 
    },
    "Supply Chain Contagion Modeling": { 
      scope: "Market", 
      depth: "Comprehensive", 
      rigor: "Exhaustive Research", 
      perspective: "Technical" 
    },
    "Multi-asset Time Series Analysis": { 
      scope: "Assets", 
      depth: "Comprehensive", 
      rigor: "Detailed Analysis", 
      perspective: "Investment" 
    }
  },
  
  // Framework Tooltips
  FRAMEWORK_TOOLTIPS: {
    // Traditional Analysis
    "General Analysis": "Comprehensive overview of business model, competitive position, financial health, growth trajectory, and key risks",
    "Margin & Return Metrics": "Deep dive into profitability: margins, ROIC, ROE, ROA, trends over time, and peer comparison",
    "Debt & Liquidity Assessment": "Balance sheet health: debt levels, maturity schedule, interest coverage, liquidity ratios, credit risk",
    "Porter's Five Forces": "Competitive dynamics: supplier power, buyer power, rivalry, substitutes, and barriers to entry",
    "SWOT Analysis": "Structured assessment of Strengths, Weaknesses, Opportunities, and Threats",
    "DCF Valuation": "Intrinsic value estimation using discounted cash flow: projections, WACC, terminal value, sensitivity analysis",
    
    // Ecosystem Focused
    "Ecosystem Mapping": "Map suppliers, partners, customers, competitors, and dependencies defining the operating environment",
    "Supply Chain Contagion Modeling": "Scenario analysis of how disruptions ripple through supply chains impacting multiple companies",
    
    // Narrative Centric
    "Narrative Momentum Analysis": "Analyze how market narratives drive valuations and assess sustainability vs fundamentals",
    "Competitive Response Patterns": "Historical analysis of how companies respond to competitive threats over time",
    "Leadership and Management Quality Assessment": "Evaluate leadership through capital allocation, execution, communication, and track record",
    
    // Comparative
    "Multi-asset Time Series Analysis": "Historical performance comparison across multiple assets with context on divergence drivers",
    "Multi-asset Head to Head evaluation": "Direct comparison of companies across financials, products, strategy, and valuation",
    "Industry Trends": "Sector-wide trend analysis: adoption rates, tech shifts, regulatory changes across industries",
    "Exposures and Business Models": "Revenue breakdown, concentration risks, cyclicality, pricing power, business resilience",
    
    // Scenario Modeling
    "Risk Correlation Study": "Map how risk factors simultaneously impact multiple holdings - portfolio-level correlation",
    "Industry Consolidation: M&A": "Analyze consolidation trends, M&A targets, deal economics, and regulatory environment",
    "Monetary Policy & Interest Rate": "Analyze sensitivity to rate changes: duration exposure, refinancing risk, valuation impact",
    
    // Company Insights
    "Management Team": "Understand the teams behind the company, their goals, directives, and overarching strategy",
    "Alliance & Partnerships: Past, Current, Future": "Partnership history, alliance value, strategic gaps, and likely future moves",
    "Industry Trend Analysis": "Long-term industry trajectory: growth, tech shifts, regulation, competitive landscape evolution",
    
    // Custom
    "Custom": "Open-ended research based on your specific question - not constrained by preset frameworks"
  },
  
  // Research Generation Settings
  GENERATION: {
    ESTIMATED_TIME_MINUTES: 5,
    POLLING_INTERVAL_MS: 15000,
    POLLING_START_DELAY_MS: 5 * 60 * 1000,
    MAX_POLLING_ATTEMPTS: 20
  },
  
  // Document Settings
  DOCUMENTS: {
    PREFIX: 'DeepResearch_',
    BATCH_SIZE: 100
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
