import { interpolate } from "./template.mjs";
import { statSync } from "node:fs";

async function activate(locator, guide) {
  if (guide.hasTouch) await locator.tap();
  else await locator.click();
}

export async function runGuideActions(page, actions, guide, variables, assets, { paced = true } = {}) {
  for (const action of actions) {
    if (action.type === "navigate") {
      if (guide.hasTouch) {
        const main = page.getByRole("navigation", { name: "Main sections", exact: true });
        if (["dubs", "library", "profile", "messenger"].includes(action.destination)) {
          await activate(main.locator(`a[href="#${action.destination}"]`), guide);
        } else {
          await activate(main.getByRole("button", { name: "More", exact: true }), guide);
          await activate(page.getByRole("dialog", { name: "Navigation", exact: true }).locator(`a[href="#${action.destination}"]`), guide);
        }
      } else {
        await page.locator(`.navigation__item[href="#${action.destination}"]:visible`).click();
      }
      if (paced) await page.waitForTimeout(guide.actionDelayMs);
      continue;
    }
    if (action.type === "visit") {
      const current = new URL(page.url());
      const url = new URL(interpolate(action.value, variables), current);
      if (url.origin !== current.origin || !["http:", "https:"].includes(url.protocol)) throw new Error("Guide navigation must stay on the isolated app origin.");
      await page.goto(url.href, { waitUntil: "networkidle" });
      continue;
    }
    const target = action.target;
    const scope = target.within
      ? page.getByRole(target.within.role, { name: interpolate(target.within.name, variables), exact: true })
      : page;
    const locator = target.text
      ? scope.getByText(interpolate(target.text, variables), { exact: true })
      : target.label
        ? scope.getByLabel(interpolate(target.label, variables), { exact: true })
        : scope.getByRole(target.role, { name: interpolate(target.name, variables), exact: true });
    if (action.type === "waitFor") {
      try {
        await locator.waitFor({ state: action.state ?? "visible" });
        if (action.reveal) await locator.scrollIntoViewIfNeeded();
      } catch (error) {
        const labels = await page.locator("label").allTextContents();
        throw new Error(`Guide target did not become ${action.state ?? "visible"}: ${JSON.stringify(target)}. Available labels: ${labels.map((label) => label.trim()).join("; ")}`, { cause: error });
      }
      continue;
    }
    await locator.scrollIntoViewIfNeeded();
    if (action.type !== "upload" && !guide.hasTouch) await locator.hover();
    if (paced) await page.waitForTimeout(guide.actionDelayMs);
    switch (action.type) {
      case "click":
        await activate(locator, guide);
        break;
      case "fill":
        await locator.fill("");
        if (paced) await locator.pressSequentially(interpolate(action.value, variables), { delay: guide.typingDelayMs });
        else await locator.fill(interpolate(action.value, variables));
        break;
      case "upload":
        await locator.setInputFiles(assets[action.asset]);
        break;
      case "select":
        await locator.selectOption(interpolate(action.value, variables));
        break;
      case "press":
        await locator.press(interpolate(action.value, variables));
        break;
      case "captureLink": {
        const url = new URL(await locator.inputValue());
        if (url.origin !== new URL(page.url()).origin || url.hash.split("?")[0] !== "#share") {
          throw new Error("Expected an external dub link on the isolated app origin.");
        }
        variables[action.variable] = url.href;
        break;
      }
      case "download": {
        const pending = page.waitForEvent("download");
        await activate(locator, guide);
        const download = await pending;
        const error = await download.failure();
        if (error) throw new Error(`Guide download failed: ${error}`);
        const path = await download.path();
        if (!path || statSync(path).size === 0) throw new Error("Guide download was empty.");
        break;
      }
      default:
        throw new Error(`Unknown guide action: ${action.type}`);
    }
  }
}
