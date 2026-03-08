#!/usr/bin/env node
// git-commit-advisor.js — PostToolUse hook for Bash tool
// Fires after every Bash tool call. If the command was a git commit or push
// and the garden linter found blocking errors, outputs instructions to Claude
// to present an AskUserQuestion prompt (or auto-run fixes if preferred).
'use strict';

const fs = require('fs');
const path = require('path');

function findRepoRoot(startDir) {
  let dir = startDir;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return startDir;
}

function loadLocalConfig(repoRoot) {
  const localConfigPath = path.join(repoRoot, '.garden', 'config.local.json');
  if (!fs.existsSync(localConfigPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
  } catch {
    return {};
  }
}

function extractBashOutput(payload) {
  // tool_response structure varies; try common shapes
  const resp = payload.tool_response;
  if (!resp) return '';
  if (typeof resp.output === 'string') return resp.output;
  if (typeof resp.content === 'string') return resp.content;
  // content may be an array of {type, text} blocks
  if (Array.isArray(resp.content)) {
    return resp.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');
  }
  return '';
}

function main() {
  let payload;
  try {
    const raw = fs.readFileSync('/dev/stdin', 'utf8');
    payload = JSON.parse(raw);
  } catch {
    // No stdin or malformed JSON — not our concern, exit silently
    process.exit(0);
  }

  // Only care about Bash tool calls
  if (payload.tool_name !== 'Bash') process.exit(0);

  // Only care about git commit / git push commands
  const command = (payload.tool_input && payload.tool_input.command) || '';
  const isCommitOrPush = /^git\s+commit(\s|$)/.test(command) || /^git\s+push(\s|$)/.test(command);
  if (!isCommitOrPush) process.exit(0);

  // Look for the garden sentinel in the bash output
  const output = extractBashOutput(payload);
  const sentinelMatch = output.match(/\[GARDEN:ASK\]\s+(\{.+\})/);
  if (!sentinelMatch) process.exit(0);

  let sentinelData;
  try {
    sentinelData = JSON.parse(sentinelMatch[1]);
  } catch {
    process.exit(0);
  }

  const { suggestions = [], errorCount = 0, warnCount = 0 } = sentinelData;
  if (!suggestions.length) process.exit(0);

  const repoRoot = findRepoRoot(process.cwd());
  const localConfig = loadLocalConfig(repoRoot);

  const skillMap = {
    harmonize: { cmd: '/garden:harmonize', desc: 'move misplaced plan/spec files into docs/' },
    tend:      { cmd: '/garden:tend',      desc: 'repair orphaned plans, fix structure, sync PLANS.md' },
    weed:      { cmd: '/garden:weed',      desc: 'remove or link docs not reachable from CLAUDE.md' },
  };

  const applicable = suggestions.filter(k => skillMap[k]).map(k => skillMap[k]);

  if (localConfig.auto_accept_fixes === true) {
    // Auto-accept mode — instruct Claude to run all fixes without asking
    const cmds = applicable.map(s => s.cmd).join(', ');
    process.stdout.write(
      `[garden] auto_accept_fixes is enabled. ` +
      `Garden linter found ${errorCount} error(s). ` +
      `Please run the following fix skills now, then offer to re-commit: ${cmds}\n`
    );
    process.exit(0);
  }

  // Interactive mode — instruct Claude to call AskUserQuestion
  const optionLines = applicable
    .map(s => `    - "${s.cmd}  (${s.desc})"`)
    .join('\n');

  const allCmds = applicable.map(s => s.cmd).join(', ');

  process.stdout.write(
`[garden] The git commit was blocked by ${errorCount} linter error(s). Please call AskUserQuestion now with the following:

  question: "Garden linter found ${errorCount} error(s)${warnCount ? ` and ${warnCount} warning(s)` : ''}. What would you like to do?"
  options:
${optionLines}
    - "Run all applicable fixes  (${allCmds})"
    - "Skip for now  (commit stays blocked — fix manually or use git commit --no-verify)"
    - "Auto-accept fixes on future commits/PRs — run all fixes now and save preference"

After the user selects:
  - Individual skill: run that skill, then offer to re-commit.
  - "Run all": run all fix skills in order (harmonize → tend → weed, skipping any not in the list), then offer to re-commit.
  - "Skip": acknowledge the commit is blocked, no further action.
  - "Auto-accept": write {"auto_accept_fixes": true} to .garden/config.local.json (create if missing, preserve other keys), run all fix skills now, then offer to re-commit.
`
  );

  process.exit(0);
}

main();
