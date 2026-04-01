import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import edge from "selenium-webdriver/edge.js";

const baseUrl = process.env.SELENIUM_BASE_URL ?? "http://127.0.0.1:3000";
const browserName = (
  process.env.SELENIUM_BROWSER ?? (process.platform === "win32" ? "MicrosoftEdge" : "chrome")
).toLowerCase();

async function buildDriver() {
  if (browserName === "edge" || browserName === "microsoftedge") {
    return new Builder()
      .forBrowser("MicrosoftEdge")
      .setEdgeOptions(new edge.Options().addArguments("--headless=new"))
      .build();
  }

  return new Builder()
    .forBrowser("chrome")
    .setChromeOptions(new chrome.Options().addArguments("--headless=new"))
    .build();
}

async function main() {
  const driver = await buildDriver();

  try {
    await driver.get(baseUrl);

    const heading = await driver.wait(until.elementLocated(By.css("h1")), 20_000);
    const headingText = await heading.getText();

    if (headingText !== "Collapse Game") {
      throw new Error(`Expected the home heading to be "Collapse Game", received "${headingText}".`);
    }

    await driver.wait(until.elementLocated(By.css('canvas[aria-label="Puzzle board"]')), 10_000);
    await driver.wait(
      until.elementLocated(By.xpath("//button[normalize-space()='New Game']")),
      10_000,
    );
  } finally {
    await driver.quit();
  }
}

void main().catch((error: unknown) => {
  console.error("Selenium smoke test failed.");
  console.error(error);
  process.exit(1);
});
