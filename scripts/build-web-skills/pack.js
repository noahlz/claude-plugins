/**
 * Zip a staged skill directory into a release artifact. Uses the system `zip`
 * binary so we get a deterministic top-level folder by cd-ing into the parent
 * and passing the folder name as the only entry.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export function pack({ stagingDir, outputZip }) {
  const parentDir = path.dirname(stagingDir);
  const folderName = path.basename(stagingDir);
  fs.mkdirSync(path.dirname(outputZip), { recursive: true });
  // -X strips extra extended attributes (mac resource forks, uids) for reproducibility.
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
