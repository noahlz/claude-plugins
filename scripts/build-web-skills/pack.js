/**
 * Zip a staged skill directory into a release artifact.
 *
 * Uses the system `zip` binary (universally available on ubuntu-latest GitHub
 * runners and macOS), which gives us a deterministic top-level folder inside
 * the archive when we cd into the parent and pass the skill folder name.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

/**
 * @param {object} opts
 * @param {string} opts.stagingDir   Absolute path to the staging dir whose
 *                                   *contents* should be zipped under a
 *                                   top-level folder named after the dir.
 * @param {string} opts.outputZip    Absolute path to write the .zip to.
 * @returns {void}
 * @throws {Error} on non-zero zip exit.
 */
export function pack({ stagingDir, outputZip }) {
  const parentDir = path.dirname(stagingDir);
  const folderName = path.basename(stagingDir);
  fs.mkdirSync(path.dirname(outputZip), { recursive: true });
  // -X strips extra extended attributes (mac resource forks, uids) for reproducibility.
  // -r recurses; -q is quiet; trailing folderName is the only entry to include.
  const result = spawnSync('zip', ['-rqX', outputZip, folderName], {
    cwd: parentDir,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `pack: zip failed (exit ${result.status}): ${result.stderr || result.stdout}`
    );
  }
}
