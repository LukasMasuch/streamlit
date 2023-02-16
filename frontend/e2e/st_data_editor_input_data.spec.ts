import { test, expect } from "@playwright/test"
const { describe, beforeEach } = test

describe("st.data_editor supports a variety of input data", () => {
  beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3001/")
    await expect(page.locator(".stDataFrame")).toHaveCount(64)
  })

  test("match all screenshots", async ({ page }) => {
    // Select all elements with stDataFrame class
    const dataFrame = await page.$$(".stDataFrame")

    await expect(dataFrame.length).toBe(64)

    /** Since glide-data-grid uses HTML canvas for rendering the table we
      cannot run any tests based on the HTML DOM. Therefore, we only use snapshot
      matching to test that our table examples render correctly. In addition, glide-data-grid
      itself also has more advanced canvas based tests for some of the interactive features. */

    for (let i = 0; i < dataFrame.length; i++) {
      expect(await dataFrame[i].screenshot()).toMatchSnapshot(
        `data_editor-input-data-${i}.png`
      )
    }
  })
})
