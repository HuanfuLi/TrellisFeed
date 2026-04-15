/**
 * Mock for podcast.service.ts — used in trellis-actions tests.
 * Tracks calls to addConceptToPodcast for spy assertions.
 */

export const _podcastCalls = [];

export const podcastService = {
  addConceptToPodcast(date, questionId) {
    _podcastCalls.push({ date, questionId });
    return true;
  },
};
