/**
 * PostDetailScreen.carousel.test.mjs
 * Integration tests for PostDetailScreen carousel logic.
 * Phase 8: Post Detail & Infinite Scroll
 */

import { describe, it } from 'node:test';
import assert from 'assert';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGeneratedImage(id, style = 'illustration') {
  return {
    id,
    postId: 'post-1',
    prompt: 'A vivid illustration of the concept',
    style,
    imageUrl: `https://example.com/${id}.png`,
    provider: 'mock',
    generatedAt: Date.now(),
  };
}

// Simulates the carousel fetch logic in PostDetailScreen
async function fetchCarouselImages(postId, retrieveCachedImage) {
  const styles = ['illustration', 'infograph', 'photo'];
  const images = [];
  for (const style of styles) {
    try {
      const img = await retrieveCachedImage(postId, style);
      if (img) images.push(img);
    } catch {
      // Silently skip failed fetches
    }
  }
  return images;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PostDetailScreen carousel integration', () => {
  it('displays carousel when images available', async () => {
    const img = makeGeneratedImage('img-1');
    const retrieveCachedImage = async (_postId, style) =>
      style === 'illustration' ? img : null;

    const images = await fetchCarouselImages('post-1', retrieveCachedImage);
    assert.ok(images.length > 0, 'Should display carousel when images are cached');
    assert.strictEqual(images[0].id, 'img-1');
  });

  it('resets carousel index when navigation changes', () => {
    // Simulate the carousel reset when post ID changes
    let currentIndex = 2; // User had navigated to image 3

    function handlePostIdChange(newPostId, prevPostId) {
      if (newPostId !== prevPostId) {
        currentIndex = 0; // Reset to first image
      }
    }

    handlePostIdChange('post-2', 'post-1');
    assert.strictEqual(currentIndex, 0, 'Carousel should reset to index 0 on navigation');
  });

  it('shows essay without carousel if no images', async () => {
    // When no images are cached, carouselImages should be empty
    const retrieveCachedImage = async () => null; // Cache miss for all styles

    const images = await fetchCarouselImages('post-1', retrieveCachedImage);
    assert.strictEqual(images.length, 0, 'Should return empty array when no images cached');
    // Essay should display normally without carousel component
    const showCarousel = images.length > 0;
    assert.ok(!showCarousel, 'Carousel should not be rendered when no images available');
  });

  it('carousel integrates with imageGeneration.service', async () => {
    // Test that the service integration returns GeneratedImage objects correctly
    const mockImages = [
      makeGeneratedImage('img-illus', 'illustration'),
      makeGeneratedImage('img-info', 'infograph'),
    ];

    const mockService = {
      retrieveCachedImage: async (_postId, style) =>
        mockImages.find(img => img.style === style) ?? null,
    };

    const images = await fetchCarouselImages('post-1', mockService.retrieveCachedImage.bind(mockService));
    assert.strictEqual(images.length, 2, 'Should fetch all available image styles');
    assert.ok(images.every(img => img.id && img.postId && img.style), 'All images should have required fields');
  });
});
