/**
 * Render the attribution README.md that is bundled into every web-skill ZIP.
 *
 * The README ensures that a forwarded archive carries provenance back to the
 * original author and source repo, plus build metadata for traceability.
 */

const REPO_URL = 'https://github.com/noahlz/claude-plugins';
const AUTHOR_HANDLE = '@noahlz';
const AUTHOR_URL = 'https://github.com/noahlz';

/**
 * Strip a single leading H1 heading from a markdown blob so that, when folded
 * under our "## About this skill" section, the source README's own title does
 * not become a confusing second top-level heading inside the file.
 */
function stripLeadingH1(md) {
  return md.replace(/^# [^\n]*\n+/, '');
}

/**
 * @param {object} opts
 * @param {string} opts.name              Cleaned skill name (claude.ai-valid).
 * @param {string} opts.description       Cleaned skill description.
 * @param {string} opts.sourcePath        Repo-relative source dir (no leading slash).
 * @param {string} opts.version           Release version, e.g. "0.11.1".
 * @param {string} opts.buildDate         ISO date string YYYY-MM-DD.
 * @param {string} opts.gitSha            Short (~7 char) commit sha.
 * @param {string} [opts.sourceReadmeContent]  Optional source README to fold in.
 * @returns {string} Markdown for README.md.
 */
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
