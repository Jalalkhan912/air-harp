import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dist, midpoint, segmentsIntersect, pointToSegmentDistance } from '../src/geometry.js';

const P = (x, y) => ({ x, y });

test('dist is Euclidean distance', () => {
  assert.equal(dist(P(0, 0), P(3, 4)), 5);
});

test('midpoint', () => {
  assert.deepEqual(midpoint(P(0, 0), P(10, 4)), { x: 5, y: 2 });
});

test('segmentsIntersect: crossing diagonals intersect', () => {
  assert.equal(segmentsIntersect(P(0, 0), P(10, 10), P(0, 10), P(10, 0)), true);
});

test('segmentsIntersect: parallel segments do not', () => {
  assert.equal(segmentsIntersect(P(0, 0), P(10, 0), P(0, 5), P(10, 5)), false);
});

test('segmentsIntersect: non-overlapping segments do not', () => {
  assert.equal(segmentsIntersect(P(0, 0), P(4, 4), P(6, 0), P(10, -4)), false);
});

test('pointToSegmentDistance: perpendicular distance', () => {
  assert.equal(pointToSegmentDistance(P(5, 5), P(0, 0), P(10, 0)), 5);
});

test('pointToSegmentDistance: beyond an endpoint measures to the endpoint', () => {
  assert.equal(pointToSegmentDistance(P(13, 4), P(0, 0), P(10, 0)), 5);
});
