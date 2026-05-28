import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findRepoRoot } from "#repo-root";

const FIXTURE_DIR = join(findRepoRoot(import.meta.dirname), "apps/e2e/fixtures");

/**
 * Read a committed binary fixture from `apps/e2e/fixtures`.
 *
 * Resolves through the repo-root marker walk (no `../` traversal, no hardcoded
 * relative root) so it stays clean under `wp audit absolute-path-policy`.
 */
export const readFixture = (name: string): Buffer => readFileSync(join(FIXTURE_DIR, name));

/** The canonical sample upload: an asymmetric 8x8 PNG so a horizontal flip is observable. */
export const SAMPLE_PNG_NAME = "sample.png";

export const readSamplePng = (): Buffer => readFixture(SAMPLE_PNG_NAME);
