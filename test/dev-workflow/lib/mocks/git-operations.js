import { readFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';

let stateDir = '.';
let failCommit = false;

export function setStateDir(dir) {
  stateDir = dir;
}

export function setCommitFail(shouldFail) {
  failCommit = shouldFail;
}

const commitsFile = () => join(stateDir, '.mock-git-commits');

export function execGit(args, options = {}) {
  const command = args[0];

  switch (command) {
    case 'init':
    case 'config':
    case 'add':
      return { stdout: '', stderr: '', exitCode: 0 };

    case 'commit': {
      if (failCommit) {
        return {
          stdout: '',
          stderr: 'On branch main\nnothing to commit, working tree clean',
          exitCode: 1
        };
      }

      const message = options.input || '';
      appendFileSync(commitsFile(), '---COMMIT---\n' + message + '\n');
      return { stdout: '', stderr: '', exitCode: 0 };
    }

    case 'rev-parse':
      if (args[1] === 'HEAD') {
        return {
          stdout: 'abc123def456ghi789jkl012mno345pqr\n',
          stderr: '',
          exitCode: 0
        };
      }
      return { stdout: '', stderr: 'Error: Unsupported rev-parse', exitCode: 1 };

    case 'diff':
      return { stdout: '', stderr: '', exitCode: 0 };

    case 'log': {
      if (existsSync(commitsFile())) {
        const content = readFileSync(commitsFile(), 'utf8');

        if (args.includes('-1') && args.some(arg => arg.includes('--format=%B'))) {
          const commits = content.split('---COMMIT---\n').filter(c => c.trim());
          if (commits.length > 0) {
            return {
              stdout: commits[commits.length - 1].trim() + '\n',
              stderr: '',
              exitCode: 0
            };
          }
        }
      }

      return {
        stdout: 'commit abc123def456ghi789jkl012mno345pqr\nAuthor: Test User <test@example.com>\nDate: Mon Dec 19 00:00:00 2025 +0000\n',
        stderr: '',
        exitCode: 0
      };
    }

    case 'status':
      return {
        stdout: 'On branch main\nYour branch is up to date with \'origin/main\'.\n\nnothing to commit, working tree clean\n',
        stderr: '',
        exitCode: 0
      };

    default:
      return {
        stdout: '',
        stderr: `Error: Unsupported git command: ${command}`,
        exitCode: 1
      };
  }
}

export function commit(message, options = {}) {
  return execGit(['commit', '-F', '-'], { ...options, input: message });
}

export function getHeadSha(options = {}) {
  const result = execGit(['rev-parse', 'HEAD'], options);
  return result.stdout.trim();
}

export function getStagedFiles(options = {}) {
  const result = execGit(['diff', '--cached', '--name-only'], options);
  return result.stdout.trim().split('\n').filter(f => f);
}
