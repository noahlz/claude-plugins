/**
 * Mock ccusage library data for testing
 */

export const mockSessionData = [
  {
    sessionId: '-Users-noahlz-projects-test',
    modelBreakdowns: [
      {
        modelName: 'claude-sonnet-4-5-20250929',
        inputTokens: 1000,
        outputTokens: 500,
        cost: 0.15
      }
    ]
  },
  {
    sessionId: '-Users-noahlz-projects-other',
    modelBreakdowns: [
      {
        modelName: 'claude-opus-4-5-20251101',
        inputTokens: 500,
        outputTokens: 250,
        cost: 0.10
      }
    ]
  },
  {
    sessionId: '-home-user-project1',
    modelBreakdowns: [
      {
        modelName: 'claude-haiku-4-5-20251001',
        inputTokens: 2000,
        outputTokens: 1000,
        cost: 0.05
      }
    ]
  },
  {
    sessionId: '-home-user-project2',
    modelBreakdowns: [
      {
        modelName: 'claude-sonnet-4-5-20250929',
        inputTokens: 1500,
        outputTokens: 750,
        cost: 0.20
      }
    ]
  },
  {
    sessionId: '-home-user-project3',
    modelBreakdowns: [
      {
        modelName: 'claude-opus-4-5-20251101',
        inputTokens: 800,
        outputTokens: 400,
        cost: 0.08
      }
    ]
  }
];

/**
 * Mock function for loading session data from ccusage
 * @returns {Promise<Array>} Array of session data
 */
export async function mockLoadSessionData() {
  return Promise.resolve(mockSessionData);
}

/**
 * Find a specific session by ID
 * @param {string} sessionId - The session ID to find
 * @returns {Object|null} Session data or null if not found
 */
export function mockFindSession(sessionId) {
  return mockSessionData.find(s => s.sessionId === sessionId) || null;
}

/**
 * Get all available session IDs
 * @returns {Array<string>} Array of session IDs
 */
export function mockGetSessionIds() {
  return mockSessionData.map(s => s.sessionId);
}

/**
 * Mock ccusage library module
 */
export const mockCcusageLibrary = {
  loadSessionData: mockLoadSessionData,
  findSession: mockFindSession,
  getSessionIds: mockGetSessionIds
};
