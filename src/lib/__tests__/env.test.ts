import { parseEnv } from "@/lib/env"

describe("parseEnv", () => {
  const baseEnv = {
    VITE_LOG_ENDPOINT: "https://example.com",
    VITE_LOG_SAMPLE_RATE: "0.5",
  }

  it("allows missing supabase vars when both absent", () => {
    const result = parseEnv(baseEnv)
    expect(result.hasSupabase).toBe(false)
  })

  it("throws when only supabase url is provided", () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        VITE_SUPABASE_URL: "https://example.supabase.co",
      })
    ).toThrow("VITE_SUPABASE_KEY")
  })

  it("throws when only supabase key is provided", () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        VITE_SUPABASE_KEY: "key",
      })
    ).toThrow("VITE_SUPABASE_URL")
  })

  it("accepts when both supabase vars are provided", () => {
    const result = parseEnv({
      ...baseEnv,
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_KEY: "key",
    })

    expect(result.hasSupabase).toBe(true)
    expect(result.env.VITE_SUPABASE_URL).toBe("https://example.supabase.co")
  })
})
