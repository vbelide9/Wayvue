import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const reportDir = join(root, 'test-report');
mkdirSync(reportDir, { recursive: true });

const summaryPath = join(reportDir, 'test-summary.txt');
const badgePath = join(reportDir, 'badge.md');

try {
  const output = execSync('npx vitest run --reporter=verbose --coverage --coverage.reporter=text-summary', {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
  });

  const summary = output.trim();
  writeFileSync(summaryPath, `${summary}\n`, 'utf8');

  const passedMatch = summary.match(/Tests\s+(\d+) passed/);
  const failedMatch = summary.match(/Tests\s+\d+ passed,\s*(\d+) failed/);
  const filesMatch = summary.match(/Test Files\s+(\d+) passed/);
  const passed = passedMatch ? passedMatch[1] : '0';
  const failed = failedMatch ? failedMatch[1] : '0';
  const files = filesMatch ? filesMatch[1] : '0';
  const status = failed === '0' ? 'passing' : 'failing';
  const badge = `![Tests](https://img.shields.io/badge/tests-${passed}%20passed%2C%20${failed}%20failed-${status}?style=for-the-badge&logo=vitest)\n\n`;
  const markdown = `${badge}\n- Test files: ${files}\n- Tests: ${passed} passed, ${failed} failed\n- Report: [test-summary.txt](test-summary.txt)\n`;
  writeFileSync(badgePath, markdown, 'utf8');

  console.log(`\nTest summary written to ${summaryPath}`);
  console.log(`Badge report written to ${badgePath}`);
} catch (error) {
  const output = error.stdout?.toString?.() || '';
  const summary = output.trim() || String(error);
  writeFileSync(summaryPath, `${summary}\n`, 'utf8');
  writeFileSync(badgePath, `![Tests](https://img.shields.io/badge/tests-failing-red?style=for-the-badge&logo=vitest)\n\nTest run failed. See [test-summary.txt](test-summary.txt).\n`, 'utf8');
  console.error(summary);
  process.exit(1);
}
