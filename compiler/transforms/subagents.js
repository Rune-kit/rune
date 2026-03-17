/**
 * Subagent Transform
 *
 * Converts parallel agent/subagent execution instructions to sequential workflow.
 * On non-Claude platforms, there is no multi-agent support.
 */

const PARALLEL_PATTERNS = [
  { pattern: /Launch (\d+) parallel agents?/gi, replace: 'Execute the following $1 steps sequentially' },
  { pattern: /as independent Task agents?/gi, replace: 'one at a time' },
  { pattern: /PARALLEL EXECUTION:/gi, replace: 'SEQUENTIAL EXECUTION:' },
  { pattern: /Run these? (?:as )?parallel (?:sub)?agents?/gi, replace: 'Run these steps in order' },
  { pattern: /spawn (?:a )?(?:sub)?agent/gi, replace: 'execute the workflow' },
  { pattern: /in a separate (?:sub)?agent/gi, replace: 'as the next step' },
  { pattern: /Launch (?:a )?background agent/gi, replace: 'Execute in the background' },
];

/**
 * Transform subagent/parallel execution instructions to sequential
 *
 * @param {string} body - skill markdown body
 * @param {object} adapter - platform adapter
 * @returns {string} transformed body
 */
export function transformSubagents(body, adapter) {
  if (adapter.name === 'claude') return body;

  let result = body;
  for (const { pattern, replace } of PARALLEL_PATTERNS) {
    result = result.replace(pattern, replace);
  }

  return adapter.transformSubagentInstruction ? adapter.transformSubagentInstruction(result) : result;
}
