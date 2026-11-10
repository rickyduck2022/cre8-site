import { chromium } from "playwright";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTemplate, resolveAssets, subtitleTime, wrapCaption } from "./template.mjs";
import { runGuideActions } from "./actions.mjs";
import { prepareGuideFixture } from "./fixtures.mjs";
import { createApiServer } from "../../apps/api/src/server.mjs";

const execute = promisify(execFile);
const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..", "..");
const id = process.argv[2];
const checkOnly = process.argv.includes("--check");
if (id === "--list") {
  console.log(readdirSync(join(directory, "templates")).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5)).join("\n"));
} else {
  if (!id) throw new Error("Usage: pnpm guides:record <template-id> [desktop|mobile] (or --list)");
  const argumentsAfterId = process.argv.slice(3).filter((argument) => argument !== "--check");
  if (argumentsAfterId.length > 1) throw new Error("Choose one template and one recording profile.");
  const guide = loadTemplate(id, argumentsAfterId[0] ?? "desktop");
  const assets = resolveAssets(guide, root);
  const webDirectory = join(root, "apps", "web", "dist");
  if (!existsSync(join(webDirectory, "index.html"))) throw new Error("Build the app first: pnpm build");
  if (guide.fixture === "admin" && !existsSync(join(root, "apps", "admin", "dist", "index.html"))) {
    throw new Error("Build administration first: pnpm --filter @craft/admin build");
  }
  const outputDirectory = resolve(root, guide.outputDirectory);
  if (relative(root, outputDirectory).startsWith("..")) throw new Error("Guide output must stay inside the repository.");
  mkdirSync(outputDirectory, { recursive: true });
  const outputName = guide.profile === "desktop" ? id : `${id}-${guide.profile}`;
  const outputPath = join(outputDirectory, `${outputName}.mp4`);
  const subtitlePath = join(outputDirectory, `${outputName}.srt`);
  const temporary = mkdtempSync(join(tmpdir(), "cre8-guide-"));
  const variables = { ...guide.variables, demoPassword: randomBytes(18).toString("base64url") };
  if (guide.fixture) process.env.ADMIN_USERNAMES = "guideadmin";
  const server = createApiServer({
    dataPath: join(temporary, "data", "community.json"),
    mediaDirectory: join(temporary, "media"), webDirectory,
    adminDirectory: join(root, "apps", "admin", "dist"),
    adminSeed: {}, pushService: null,
  });
  let browser;
  let context;
  let activePage;
  const failures = [];
  try {
    await new Promise((ready, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", ready);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const health = await fetch(`${origin}/api/health`);
    if (!health.ok) throw new Error("The isolated guide server is not ready.");
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: guide.viewport, deviceScaleFactor: 1,
      recordVideo: { dir: join(temporary, "recordings"), size: guide.viewport },
      colorScheme: "dark", reducedMotion: "reduce",
      isMobile: guide.isMobile, hasTouch: guide.hasTouch,
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
    await prepareGuideFixture(context, origin, guide, variables, assets);
    await context.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent = ".app-login__card > small { visibility: hidden !important; } .demo-notice { display: none !important; }";
        document.head.append(style);
      }, { once: true });
    });
    if (guide.setup) {
      const setupPage = await context.newPage();
      activePage = setupPage;
      setupPage.setDefaultTimeout(guide.timeoutMs);
      setupPage.on("pageerror", (error) => failures.push(error.stack ?? error.message));
      await setupPage.goto(origin, { waitUntil: "networkidle" });
      await runGuideActions(setupPage, guide.setup, guide, variables, assets, { paced: false });
      await setupPage.close();
    }
    const page = await context.newPage();
    activePage = page;
    const started = performance.now();
    page.setDefaultTimeout(guide.timeoutMs);
    page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
    await page.goto(`${origin}${guide.entryPath ?? "/"}`, { waitUntil: "networkidle" });
    const timeline = [];
    for (const [index, step] of guide.steps.entries()) {
      const start = index === 0 ? 0 : (performance.now() - started) / 1000;
      console.log(`${checkOnly ? "Checking" : "Recording"} ${guide.profile} ${index + 1}/${guide.steps.length}: ${step.caption}`);
      await runGuideActions(page, step.actions, guide, variables, assets, { paced: !checkOnly });
      if (failures.length) throw new Error(`App errors during recording: ${failures.join("; ")}`);
      if (!checkOnly) await page.waitForTimeout(step.holdMs ?? guide.holdMs);
      timeline.push({ caption: step.caption, start, end: (performance.now() - started) / 1000 });
    }
    if (failures.length) throw new Error(`App errors during recording: ${failures.join("; ")}`);
    const rawVideo = page.video();
    await context.close();
    context = undefined;
    const rawPath = await rawVideo.path();
    await browser.close();
    browser = undefined;
    if (checkOnly) {
      console.log(`Verified journey actions: ${id} (${guide.profile})`);
    } else {
      const style = guide.captionStyle;
      writeFileSync(join(temporary, "title.txt"), wrapCaption(guide.title, style.wrapAt));
      const filters = [
        `pad=iw:ih+${guide.captionBandHeight}:0:0:color=0x171a20`,
        `drawbox=x=0:y=${guide.viewport.height}:w=iw:h=3:color=0xff8800:t=fill`,
        `drawtext=fontfile=guide-font.ttf:textfile=title.txt:fontsize=${style.titleSize}:fontcolor=0xffa43a:x=${style.margin}:y=${guide.viewport.height + style.titleY}`,
      ];
      const font = process.platform === "win32" ? "C:\\Windows\\Fonts\\segoeui.ttf" : process.env.GUIDE_FONT_PATH;
      if (!font || !existsSync(font)) throw new Error("Set GUIDE_FONT_PATH to a local TrueType font.");
      copyFileSync(font, join(temporary, "guide-font.ttf"));
      timeline.forEach((step, index) => {
        const captionFile = `caption-${index}.txt`;
        writeFileSync(join(temporary, captionFile), wrapCaption(step.caption, style.wrapAt));
        filters.push(`drawtext=fontfile=guide-font.ttf:textfile=${captionFile}:fontsize=${style.fontSize}:fontcolor=white:line_spacing=${style.lineSpacing}:x=${style.margin}:y=${guide.viewport.height + style.captionY}:enable='gte(t,${step.start.toFixed(3)})*lt(t,${step.end.toFixed(3)})'`);
      });
      writeFileSync(join(temporary, "filter.txt"), filters.join(","));
      const srt = timeline.map((step, index) => `${index + 1}\n${subtitleTime(step.start)} --> ${subtitleTime(step.end)}\n${wrapCaption(step.caption, style.wrapAt)}\n`).join("\n");
      const stagedVideo = join(temporary, `${id}.mp4`);
      await execute(process.env.FFMPEG_PATH || ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-y", "-i", rawPath,
        "-filter_script:v", "filter.txt", "-an", "-r", "30",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-metadata", `title=${guide.title}`, "-metadata", `comment=${guide.description}`,
        stagedVideo,
      ], { cwd: temporary, timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
      await execute(process.env.FFMPEG_PATH || ffmpegPath, [
        "-hide_banner", "-loglevel", "error", "-i", stagedVideo, "-f", "null", "-",
      ], { timeout: 120000 });
      copyFileSync(stagedVideo, outputPath);
      writeFileSync(subtitlePath, srt);
      writeFileSync(join(outputDirectory, `${outputName}.json`), JSON.stringify({
        id, title: guide.title, profile: guide.profile, recordedAt: new Date().toISOString(),
        width: guide.viewport.width, height: guide.viewport.height + guide.captionBandHeight,
        durationSeconds: timeline.at(-1).end, steps: timeline,
      }, null, 2));
      console.log(`Verified MP4: ${outputPath}\nCaptions: ${subtitlePath}`);
    }
  } catch (error) {
    if (failures.length) console.error(`App exceptions:\n${failures.join("\n")}`);
    if (activePage && !activePage.isClosed() && process.env.GUIDE_DIAGNOSTICS_DIRECTORY) {
      const diagnostics = resolve(process.env.GUIDE_DIAGNOSTICS_DIRECTORY);
      mkdirSync(diagnostics, { recursive: true });
      await activePage.screenshot({ path: join(diagnostics, `${outputName}-failure.png`) });
      writeFileSync(join(diagnostics, `${outputName}-failure.txt`), await activePage.locator("body").ariaSnapshot());
    }
    throw error;
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    if (server.listening) await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
    rmSync(temporary, { recursive: true, force: true });
  }
}
