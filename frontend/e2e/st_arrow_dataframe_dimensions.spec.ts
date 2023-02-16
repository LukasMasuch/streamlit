import { test, expect } from "@playwright/test"
const { describe, beforeEach } = test

describe("st.dataframe", () => {
  beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3001/")
    await expect(page.locator(".stDataFrame")).toHaveCount(11)
  })

  test("should use the configured dimensions", async ({ page }) => {
    const dataFrames = await page.$$(".stDataFrame")
    expect(dataFrames.length).toBe(11)

    const expected = [
      { width: "704px", height: "400px" },
      { width: "250px", height: "150px" },
      { width: "250px", height: "400px" },
      { width: "704px", height: "150px" },
      { width: "704px", height: "5000px" },
      { width: "704px", height: "400px" },
      { width: "500px", height: "400px" },
      { width: "704px", height: "400px" },
      { width: "704px", height: "400px" },
      { width: "200px", height: "400px" },
      { width: "704px", height: "400px" },
      { width: "704px", height: "400px" },
    ]

    for (let i = 0; i < dataFrames.length; i++) {
      const dataFrame = dataFrames[i]
      const width = await dataFrame.evaluate(
        el => window.getComputedStyle(el).width
      )
      const height = await dataFrame.evaluate(
        el => window.getComputedStyle(el).height
      )
      expect(width).toBe(expected[i].width)
      expect(height).toBe(expected[i].height)
    }
  })
})
