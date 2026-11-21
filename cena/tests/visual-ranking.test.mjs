import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankWithVision } from '../web/visual-ranking.js';

test('local image similarity can refine a close textual match', () => {
  const items = [{ id: 'tt0000001', matchScore: .55 }, { id: 'tt0000002', matchScore: .54 }];
  const ranked = rankWithVision(items, [{ id: 'tt0000001', score: .3 }, { id: 'tt0000002', score: .9 }]);
  assert.equal(ranked[0].id, 'tt0000002');
  assert.equal(items[0].combinedScore, undefined);
});

test('visual evidence does not overrule a strong title-and-cast match', () => {
  const ranked = rankWithVision([{ id: 'tt0120873', matchScore: .95 }, { id: 'tt0000001', matchScore: .4 }], [{ id: 'tt0120873', score: .4 }, { id: 'tt0000001', score: .9 }]);
  assert.equal(ranked[0].id, 'tt0120873');
});

test('invalid and unrelated model outputs do not create catalog titles', () => {
  const ranked = rankWithVision([{ id: 'tt0120873', matchScore: .8 }], [{ id: 'ttOTHER', score: 1 }, { id: 'tt0120873', score: NaN }]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].visualSimilarity, undefined);
});
