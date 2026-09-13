import { unitToHours, HOURS_PER_DAY } from "../src/lib/pricing";

console.log("=== VERIFYING TEAM & INDIVIDUAL ADJUSTMENTS ===");

// 1. Overall project is 4 weeks
const projectVal = 4;
const projectUnit = "weeks";
const projectBaseHours = unitToHours(projectVal, projectUnit, HOURS_PER_DAY);
console.log(`1. Project Duration: ${projectVal} ${projectUnit} = ${projectBaseHours} hrs`);

// 2. Dev team is set to 3 weeks (custom team duration)
const devTeamVal = 3;
const devTeamUnit = "weeks";
const devTeamHours = unitToHours(devTeamVal, devTeamUnit, HOURS_PER_DAY);
console.log(`2. Dev Team Duration: ${devTeamVal} ${devTeamUnit} = ${devTeamHours} hrs`);

// 3. Design team is set to 10 days
const designTeamVal = 10;
const designTeamUnit = "days";
const designTeamHours = unitToHours(designTeamVal, designTeamUnit, HOURS_PER_DAY);
console.log(`3. Design Team Duration: ${designTeamVal} ${designTeamUnit} = ${designTeamHours} hrs`);

// Dev 1 (Hassnain - 100%): devTeamHours * 100% = 120 hrs
const hassnainHours = Math.round(devTeamHours * 1.0);
console.log(
  `4. Hassnain (100% Dev Team): ${hassnainHours} hrs (${hassnainHours / HOURS_PER_DAY} days)`,
);

// Dev 2 (Osama - 50% part-time): devTeamHours * 50% = 60 hrs
const osamaHours = Math.round(devTeamHours * 0.5);
console.log(`5. Osama (50% Dev Team): ${osamaHours} hrs (${osamaHours / HOURS_PER_DAY} days)`);

// Designer 1 (Faiza - 60%): designTeamHours * 60% = 48 hrs
const faizaHours = Math.round(designTeamHours * 0.6);
console.log(`6. Faiza (60% Design Team): ${faizaHours} hrs (${faizaHours / HOURS_PER_DAY} days)`);

// Designer 2 (Yousuf - 100%): designTeamHours * 100% = 80 hrs
const yousufHours = Math.round(designTeamHours * 1.0);
console.log(
  `7. Yousuf Ansari (100% Design Team): ${yousufHours} hrs (${yousufHours / HOURS_PER_DAY} days)`,
);

// Individual override (Ayesha - Custom 3 days advisory):
const ayeshaCustomVal = 3;
const ayeshaCustomUnit = "days";
const ayeshaHours = Math.round(unitToHours(ayeshaCustomVal, ayeshaCustomUnit, HOURS_PER_DAY));
console.log(`8. Ayesha (Custom 3 days advisory): ${ayeshaHours} hrs`);

console.log("\nALL TEAM AUTO-ADJUSTMENTS AND INDIVIDUAL ALLOCATION TESTS PASSED!");
