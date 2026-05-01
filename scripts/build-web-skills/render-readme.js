/**
 * Render the attribution README.md bundled into every web-skill ZIP, so a
 * forwarded archive carries provenance back to the source repo and author.
 */

const REPO_URL = 'https://github.com/noahlz/claude-plugins';
const AUTHOR_HANDLE = '@noahlz';
const AUTHOR_URL = 'https://github.com/noahlz';

// Drop the source README's H1 so it doesn't collide with our own top-level title.
function stripLeadingH1(md) {
  return md.replace(/^# [^\n]*\n+/, '');
}

export function renderReadme({
  name,
  description,
  sourcePath,
  version,
  buildDate,
  gitSha,
  sourceReadmeContent,
}) {
  const lines = [];
  lines.push(`# ${name}`);
  lines.push('');
  lines.push(description);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`**Author:** [${AUTHOR_HANDLE}](${AUTHOR_URL})`);
  lines.push(`**Source:** [\`noahlz/claude-plugins\`](${REPO_URL}) — \`${sourcePath}\` at \`v${version}\``);
  lines.push('**License:** MIT — see `LICENSE` in this archive.');
  lines.push(`**Built:** ${buildDate} from commit \`${gitSha}\`.`);
  lines.push('');
  lines.push('This skill is packaged for upload to **claude.ai** (Settings → Capabilities). It also exists as part of a Claude Code plugin marketplace — see the source repo for the Claude Code version.');
  lines.push('');

  if (sourceReadmeContent) {
    lines.push('---');
    lines.push('');
    lines.push('## About this skill');
    lines.push('');
    lines.push(stripLeadingH1(sourceReadmeContent).trimEnd());
    lines.push('');
  }

  return lines.join('\n');
}
