#!/usr/bin/env node
// run-all.js — orchestrates all linter checks, called by git hooks
'use strict';

const fs = require('fs');
const path = require('path');

const { checkClaudeMd } = require('./check-claude-md');
const { checkModuleAgents } = require('./check-module-agents');
const { checkCoverage } = require('./check-coverage');
const { checkFreshness } = require('./check-freshness');
const { checkCrossLinks } = require('./check-cross-links');
const { checkPlans } = require('./check-plans');

// Resolve repo root by walking up from cwd until we find .git
function findRepoRoot(startDir) {
  let dir = startDir;
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return startDir;
}

function loadConfig(repoRoot) {
  const configPath = path.join(repoRoot, '.garden', 'config.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

function formatResult(result) {
  const icons = { ok: 'OK  ', warn: 'WARN', error: 'ERR ' };
  const icon = icons[result.status] || '    ';
  const line = `  ${icon} ${result.check.padEnd(30)} ${result.message}`;
  if (result.detail) return line + '\n' + result.detail.split('\n').map(l => '       ' + l).join('\n');
  return line;
}

function main() {
  const args = process.argv.slice(2);
  const mode = args.find(a => a.startsWith('--'))?.replace('--', '') || 'pre-commit';
  const jsonOutput = args.includes('--json');
  const isClaudeCode = process.env.CLAUDECODE === '1';

  const repoRoot = findRepoRoot(process.cwd());
  const config = loadConfig(repoRoot);

  let allResults = [];

  // Pre-commit checks (fast, local)
  allResults.push(...checkClaudeMd(repoRoot, config));
  allResults.push(...checkModuleAgents(repoRoot, config));
  allResults.push(...checkCoverage(repoRoot, config, mode === 'pre-push' ? 'pr' : 'pre-commit'));
  allResults.push(...checkFreshness(repoRoot, config));
  allResults.push(...checkPlans(repoRoot, config, 'pre-commit'));

  // Pre-push / CI checks (slower, more thorough)
  if (mode === 'pre-push' || mode === 'ci' || mode === 'status') {
    allResults.push(...checkCrossLinks(repoRoot, config));
    allResults.push(...checkPlans(repoRoot, config, mode));
  }

  if (jsonOutput || mode === 'status') {
    process.stdout.write(JSON.stringify(allResults, null, 2) + '\n');
    process.exit(0);
  }

  // Human-readable output
  const errors = allResults.filter(r => r.status === 'error');
  const warnings = allResults.filter(r => r.status === 'warn');

  console.log(`\ngarden lint (${mode})`);
  for (const result of allResults) {
    console.log(formatResult(result));
  }
  console.log('');

  if (errors.length > 0 || warnings.length > 0) {
    console.log(`${errors.length} error(s), ${warnings.length} warning(s).${errors.length === 0 ? ' Warnings are non-blocking.' : ''}`);

    // Suggest relevant garden commands based on which checks failed
    const failedChecks = new Set([...errors, ...warnings].map(r => r.check));
    const suggestionKeys = [];
    const suggestionLines = [];
    if (failedChecks.has('plans-misplaced') || failedChecks.has('plans-stray')) {
      suggestionKeys.push('harmonize');
      suggestionLines.push(['/garden:harmonize', 'move misplaced plan/spec files into docs/']);
    }
    if (failedChecks.has('plans-orphan') || failedChecks.has('plans-active-structure') || failedChecks.has('cross-links')) {
      suggestionKeys.push('tend');
      suggestionLines.push(['/garden:tend', 'repair orphaned plans, fix structure, sync PLANS.md']);
    }
    if (failedChecks.has('claude-md-toc-sync')) {
      suggestionKeys.push('weed');
      suggestionLines.push(['/garden:weed', 'remove or link docs not reachable from CLAUDE.md']);
    }

    if (suggestionLines.length > 0) {
      // Only emit the sentinel and skip human-readable suggestions when Claude Code
      // is running AND there are blocking errors (not just warnings)
      if (isClaudeCode && errors.length > 0) {
        const sentinel = JSON.stringify({
          suggestions: suggestionKeys,
          errorCount: errors.length,
          warnCount: warnings.length,
        });
        console.log(`\n[GARDEN:ASK] ${sentinel}`);
      } else if (isClaudeCode) {
        // Warnings only in Claude Code — print normally, no sentinel
        console.log('\nTo fix, run:\n' + suggestionLines.map(([cmd, desc]) => `  ${cmd}  — ${desc}`).join('\n'));
      } else if (process.env.CI) {
        // CI environment — commands aren't runnable, give guidance
        console.log('\nTo fix these issues, open a Claude Code session locally and run:');
        console.log(suggestionLines.map(([cmd, desc]) => `  ${cmd}  — ${desc}`).join('\n'));
        console.log('\n  (Slash commands require an active Claude Code session)');
      } else {
        // Human at a terminal — provide copy-pasteable claude -p commands
        console.log('\nTo fix, open a Claude session or run in your terminal:');
        console.log(suggestionLines.map(([cmd, desc]) => `  claude -p "${cmd}"   — ${desc}`).join('\n'));
      }
    }
  } else {
    console.log('All checks passed.');
  }
  console.log('');

  // Only errors block commits
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
