#!/usr/bin/env node
/**
 * Fail the mutation job if it tested nothing.
 *
 * Stryker scores an empty run `NaN` (`totalValid > 0 ? … : DEFAULT_SCORE` in
 * mutation-testing-metrics), and the break check is `mutationScore < break`.
 * `NaN < 82` is `false`, so a run that mutated zero files exits 0 and reports
 * success. The only warning is a WARN-level "Glob pattern did not result in any
 * files", which nobody reads in a green build.
 *
 * That is one rename away from real: move a guarded file out of
 * `src/lib/operator/`, or mistype a glob in `stryker.config.json`, and the gate
 * keeps passing while guarding nothing. A gate whose failure mode is silent
 * success is the exact thing this whole job exists to argue against.
 *
 * Deliberately a floor of one rather than a fixed expected count: narrowing the
 * scope on purpose is legitimate and should not need this file edited in the
 * same commit. The count is printed so a large unintended drop is visible in
 * the log even though it does not fail here.
 */

import { readFileSync } from "node:fs";

const REPORT = "reports/mutation/mutation.json";

let report;
try {
  report = JSON.parse(readFileSync(REPORT, "utf8"));
} catch (err) {
  console.error(`Could not read ${REPORT}: ${err.message}`);
  console.error("Stryker should have written it — is the `json` reporter still enabled?");
  process.exit(1);
}

const files = Object.entries(report.files ?? {});
const total = files.reduce((sum, [, file]) => sum + (file.mutants?.length ?? 0), 0);

if (total === 0) {
  console.error("Stryker tested 0 mutants, and scored that NaN rather than failing.");
  console.error("Nothing was verified. Check the `mutate` globs in stryker.config.json");
  console.error("still match real files — a moved or renamed file looks exactly like this.");
  process.exit(1);
}

console.log(`Mutants tested: ${total} across ${files.length} file(s).`);
for (const [path, file] of files.sort((a, b) => b[1].mutants.length - a[1].mutants.length)) {
  console.log(`  ${String(file.mutants.length).padStart(5)}  ${path}`);
}
