import { describe, it, expect, beforeAll } from "vitest"

// CRON_SECRET vor dem Import setzen — das Modul liest env zur Laufzeit.
beforeAll(() => { process.env.CRON_SECRET = "test-geheimnis" })

describe("status-token (Zero-Login-Statuslink)", () => {
  it("signiert und verifiziert eine Ticket-ID", async () => {
    const { statusToken, verifyStatusToken } = await import("@/lib/status-token")
    const token = statusToken("ticket-123")
    expect(token).toBeTruthy()
    expect(verifyStatusToken("ticket-123", token)).toBe(true)
  })

  it("lehnt manipulierte Ticket-ID oder Token ab", async () => {
    const { statusToken, verifyStatusToken } = await import("@/lib/status-token")
    const token = statusToken("ticket-123")!
    expect(verifyStatusToken("ticket-999", token)).toBe(false)
    expect(verifyStatusToken("ticket-123", token.replace(/.$/, "0"))).toBe(false)
    expect(verifyStatusToken("ticket-123", null)).toBe(false)
  })

  it("statusUrl baut den kompletten Link", async () => {
    const { statusUrl } = await import("@/lib/status-token")
    const url = statusUrl("ticket-123")
    expect(url).toContain("/status/ticket-123?t=")
  })
})
