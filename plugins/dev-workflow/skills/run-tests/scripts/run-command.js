#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Parse --key value CLI args from argv
 * @param {string[]} argv - Process argv slice (after node + script)
 * @returns {object} - Parsed key/value pairs
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cmd' && argv[i + 1] !== undefined) {
      args.cmd = argv[++i];
    } else if (argv[i] === '--out' && argv[i + 1] !== undefined) {
      args.out = argv[++i];
    }
  }
  return args;
}

/* node:coverage disable */
function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.cmd) {
    process.stderr.write('Error: --cmd is required\n');
    process.exit(1);
  }

  if (!args.out) {
    process.stderr.write('Error: --out is required\n');
    process.exit(1);
  }

  // Create parent directories for output file if needed
  mkdirSync(dirname(args.out), { recursive: true });

  const result = spawnSync(args.cmd, {
    shell: true,
    // Capture as buffers to preserve binary content
    encoding: 'buffer',
    maxBuffer: 100 * 1024 * 1024 // 100MB
  });

  // Write stdout first (test output / TAP format), then stderr
  writeFileSync(args.out, result.stdout || Buffer.alloc(0));
  if (result.stderr && result.stderr.length > 0) {
    appendFileSync(args.out, result.stderr);
  }

  const exitCode = result.status ?? (result.error ? 1 : 0);

  process.stdout.write(JSON.stringify({ exitCode, outputFile: args.out }) + '\n');
  process.exit(0);
}

main();
/* node:coverage enable */
