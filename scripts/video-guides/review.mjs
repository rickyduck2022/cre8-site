import ffmpegPath from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTemplate } from "./template.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..", "..");
const catalogue = JSON.parse(readFileSync(join(directory, "catalogue.json"), "utf8"));
const selected = process.argv.slice(2);
const ids = selected.length ? selected : catalogue.flatMap((category) => category.journeys);
for (const id of ids) {
  const guide = loadTemplate(id);
  const output = resolve(root, guide.outputDirectory);
  if (relative(root, output).startsWith("..")) throw new Error("Guide output must stay inside the repository.");
  const review = join(output, "review");
  mkdirSync(review, { recursive: true });
  for (const profile of ["desktop", "mobile"]) {
    const name = profile === "desktop" ? id : `${id}-mobile`;
    const metadata = JSON.parse(readFileSync(join(output, `${name}.json`), "utf8"));
    const sampleSteps = [0.25, 0.5, 0.75, 1].map((fraction) =>
      metadata.steps[Math.ceil(metadata.steps.length * fraction) - 1]);
    const inputs = sampleSteps.flatMap((step) => [
      "-ss", String(Math.max(step.start, step.end - 0.75)), "-i", join(output, `${name}.mp4`),
    ]);
    const filters = sampleSteps.map((_, index) => `[${index}:v]scale=480:-1[v${index}]`);
    filters.push("[v0][v1][v2][v3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[out]");
    execFileSync(process.env.FFMPEG_PATH || ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-y", ...inputs,
      "-filter_complex", filters.join(";"), "-map", "[out]", "-frames:v", "1",
      join(review, `${name}.png`),
    ], { timeout: 60000, stdio: "inherit" });
    console.log(`Review frames: ${join(review, `${name}.png`)}`);
  }
}
