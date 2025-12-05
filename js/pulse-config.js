// Portfolio Pulse Configuration
// Separate from main CONFIG to keep features isolated

const PULSE_CONFIG = {
  // Vertesia API (uses same credentials as main app)
  VERTESIA_API_KEY: 'sk-7681b09add1b0095a8a84b673953b856',
  VERTESIA_BASE_URL: 'https://api.vertesia.io/api/v1',
  ENVIRONMENT_ID: '681915c6a01fb262a410c161',
  MODEL: 'publishers/anthropic/models/claude-sonnet-4',
  
  // Pulse-specific interaction name
  INTERACTION_NAME: 'Pulse',
  
  // Scheduling
  DAILY_GENERATION_TIME: '09:30', // 9:30 AM daily auto-generation
  
  // Generation timing
  GENERATION_WAIT_MS: 5 * 60 * 1000, // 5 minutes wait for async completion
  
  // Object filtering
  DIGEST_KEYWORDS: ['digest', 'pulse', 'portfolio pulse']
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PULSE_CONFIG;
}
