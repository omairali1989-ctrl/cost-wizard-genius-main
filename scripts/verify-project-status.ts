import assert from "node:assert/strict";
import {
  isRevenueStatus,
  normalizeProjectStatus,
  summarizeProjectRevenue,
} from "../src/lib/project-status";

assert.equal(normalizeProjectStatus("In Progress"), "in_progress");
assert.equal(normalizeProjectStatus("unknown"), "draft");
assert.equal(isRevenueStatus("sent"), false);
assert.equal(isRevenueStatus("approved"), true);

const summary = summarizeProjectRevenue([
  { status: "draft", price: 100 },
  { status: "sent", price: 200 },
  { status: "approved", price: 300 },
  { status: "in_progress", price: 400 },
  { status: "completed", price: 500 },
]);

assert.equal(summary.estimatedValue, 1_500);
assert.equal(summary.draftValue, 100);
assert.equal(summary.sentPipeline, 200);
assert.equal(summary.bookedRevenue, 1_200);
assert.equal(summary.approvedRevenue, 300);
assert.equal(summary.inProgressRevenue, 400);
assert.equal(summary.completedRevenue, 500);
assert.deepEqual(summary.counts, {
  draft: 1,
  sent: 1,
  approved: 1,
  in_progress: 1,
  completed: 1,
});

console.log("Project status and revenue rules verified.");
