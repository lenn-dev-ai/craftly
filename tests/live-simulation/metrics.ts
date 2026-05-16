import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

export interface LiveSimulationMetrics {
  totalRuns: number
  successfulRuns: number
  failedRuns: number
  skippedRuns: number
  totalDurationMs: number
  errorsByScenario: Record<string, number>
  consoleErrors: string[]
  httpErrors: string[]
  deadEnds: string[]
  screenshots: string[]
  skippedScenarioIds: string[]
}

export interface LiveSimulationMeta {
  baseUrl: string
  users: number
  headless: boolean
  allowWrites: boolean
  allowProdSimulation: boolean
  runId: string
}

export function createMetrics(): LiveSimulationMetrics {
  return {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    skippedRuns: 0,
    totalDurationMs: 0,
    errorsByScenario: {},
    consoleErrors: [],
    httpErrors: [],
    deadEnds: [],
    screenshots: [],
    skippedScenarioIds: [],
  }
}

export function recordSuccess(metrics: LiveSimulationMetrics, scenarioId: string, durationMs: number): void {
  metrics.successfulRuns += 1
  metrics.totalDurationMs += durationMs
  metrics.errorsByScenario[scenarioId] = metrics.errorsByScenario[scenarioId] ?? 0
}

export function recordFailure(metrics: LiveSimulationMetrics, scenarioId: string, durationMs: number, errorMessage: string): void {
  metrics.failedRuns += 1
  metrics.totalDurationMs += durationMs
  metrics.errorsByScenario[scenarioId] = (metrics.errorsByScenario[scenarioId] ?? 0) + 1
  metrics.consoleErrors.push(errorMessage)
}

export function recordSkipped(metrics: LiveSimulationMetrics, scenarioId: string, reason: string): void {
  metrics.skippedRuns += 1
  metrics.skippedScenarioIds.push(`${scenarioId}: ${reason}`)
}

export async function writeReport(metrics: LiveSimulationMetrics, meta: LiveSimulationMeta): Promise<{ jsonPath: string; markdownPath: string }> {
  const outDir = resolve(process.cwd(), "test-results/live-simulation")
  await mkdir(outDir, { recursive: true })

  const summary = {
    totalRuns: metrics.totalRuns,
    successfulRuns: metrics.successfulRuns,
    failedRuns: metrics.failedRuns,
    skippedRuns: metrics.skippedRuns,
    avgDurationMs: metrics.totalRuns > 0 ? Math.round(metrics.totalDurationMs / metrics.totalRuns) : 0,
    errorsByScenario: metrics.errorsByScenario,
    consoleErrors: metrics.consoleErrors.length,
    httpErrors: metrics.httpErrors.length,
    deadEnds: metrics.deadEnds.length,
    screenshots: metrics.screenshots.length,
  }

  const payload = {
    meta,
    summary,
    metrics,
  }

  const jsonPath = resolve(outDir, "live-simulation-report.json")
  const markdownPath = resolve(outDir, "live-simulation-report.md")

  await writeFile(jsonPath, JSON.stringify(payload, null, 2) + "\n", "utf-8")
  await writeFile(markdownPath, renderMarkdown(meta, summary, metrics), "utf-8")

  return { jsonPath, markdownPath }
}

function renderMarkdown(
  meta: LiveSimulationMeta,
  summary: {
    totalRuns: number
    successfulRuns: number
    failedRuns: number
    skippedRuns: number
    avgDurationMs: number
    errorsByScenario: Record<string, number>
    consoleErrors: number
    httpErrors: number
    deadEnds: number
    screenshots: number
  },
  metrics: LiveSimulationMetrics,
): string {
  const lines: string[] = []
  lines.push("# Live Simulation Report", "")
  lines.push("## Run Config", "")
  lines.push(`- Base URL: \`${meta.baseUrl}\``)
  lines.push(`- Users: \`${meta.users}\``)
  lines.push(`- Headless: \`${meta.headless}\``)
  lines.push(`- Allow writes: \`${meta.allowWrites}\``)
  lines.push(`- Allow prod simulation: \`${meta.allowProdSimulation}\``)
  lines.push(`- Run ID: \`${meta.runId}\``, "")
  lines.push("## Summary", "")
  lines.push(`- Total runs: \`${summary.totalRuns}\``)
  lines.push(`- Successful runs: \`${summary.successfulRuns}\``)
  lines.push(`- Failed runs: \`${summary.failedRuns}\``)
  lines.push(`- Skipped runs: \`${summary.skippedRuns}\``)
  lines.push(`- Avg duration: \`${summary.avgDurationMs} ms\``)
  lines.push(`- Console errors: \`${summary.consoleErrors}\``)
  lines.push(`- HTTP errors: \`${summary.httpErrors}\``)
  lines.push(`- Dead ends: \`${summary.deadEnds}\``)
  lines.push(`- Screenshots: \`${summary.screenshots}\``, "")
  lines.push("## Errors by Scenario", "")
  const entries = Object.entries(summary.errorsByScenario).sort(([, a], [, b]) => b - a)
  if (entries.length === 0) {
    lines.push("- Keine Fehler registriert", "")
  } else {
    for (const [scenarioId, count] of entries) {
      lines.push(`- \`${scenarioId}\`: \`${count}\``)
    }
    lines.push("")
  }
  if (metrics.skippedScenarioIds.length > 0) {
    lines.push("## Skipped", "")
    for (const skipped of metrics.skippedScenarioIds) {
      lines.push(`- ${skipped}`)
    }
    lines.push("")
  }
  if (metrics.httpErrors.length > 0) {
    lines.push("## HTTP Errors", "")
    for (const error of metrics.httpErrors.slice(0, 20)) {
      lines.push(`- ${error}`)
    }
    lines.push("")
  }
  if (metrics.consoleErrors.length > 0) {
    lines.push("## Console Errors", "")
    for (const error of metrics.consoleErrors.slice(0, 20)) {
      lines.push(`- ${error}`)
    }
    lines.push("")
  }
  if (metrics.deadEnds.length > 0) {
    lines.push("## Dead Ends", "")
    for (const deadEnd of metrics.deadEnds.slice(0, 20)) {
      lines.push(`- ${deadEnd}`)
    }
    lines.push("")
  }
  if (metrics.screenshots.length > 0) {
    lines.push("## Screenshots", "")
    for (const screenshot of metrics.screenshots.slice(0, 20)) {
      lines.push(`- ${screenshot}`)
    }
    lines.push("")
  }
  return lines.join("\n")
}
