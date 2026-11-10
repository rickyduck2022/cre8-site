import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTemplate } from "./template.mjs";

const partial = process.argv.includes("--partial");
const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, "..", "..");
const catalogue = JSON.parse(readFileSync(join(directory, "catalogue.json"), "utf8"));
const escape = (text) => text.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
const missing = [];
const outputDirectory = resolve(root, loadTemplate(catalogue[0].journeys[0]).outputDirectory);
if (relative(root, outputDirectory).startsWith("..")) throw new Error("Guide output must stay inside the repository.");

function videoDuration(name) {
  const timestamps = [...readFileSync(join(outputDirectory, `${name}.srt`), "utf8")
    .matchAll(/--> (\d{2}):(\d{2}):(\d{2}),\d{3}/g)];
  if (!timestamps.length) return "";
  const [, hours, minutes, seconds] = timestamps[timestamps.length - 1];
  const total = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  return ` <span class="duration">${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}</span>`;
}

let published = 0;
const sections = catalogue.map((category, categoryIndex) => {
  const cards = category.journeys.map((id, journeyIndex) => {
    const guide = loadTemplate(id);
    if (resolve(root, guide.outputDirectory) !== outputDirectory) throw new Error("Catalogue guides must share an output directory.");
    const videos = ["desktop", "mobile"].map((profile) => {
      const name = profile === "desktop" ? id : `${id}-mobile`;
      const absent = ["mp4", "srt"].filter((extension) => !existsSync(join(outputDirectory, `${name}.${extension}`)));
      if (absent.length) {
        missing.push(...absent.map((extension) => `${name}.${extension}`));
        return `<div><h4>${profile === "desktop" ? "Desktop" : "Mobile"}</h4>
<p class="placeholder">This recording is not published yet. Check back soon.</p></div>`;
      }
      published += 1;
      return `<div><h4>${profile === "desktop" ? "Desktop" : "Mobile"}${videoDuration(name)}</h4>
<video controls preload="none" aria-label="${escape(guide.title)} (${profile})" src="${name}.mp4"></video>
<p><a href="${name}.mp4">Open MP4</a> &middot; <a href="${name}.srt" download>Download captions</a></p></div>`;
    }).join("\n");
    const steps = guide.steps.map((step) =>
      `<li>${escape(step.caption.replace(/^\d+\.\s*/, ""))}</li>`).join("\n");
    return `<article id="${id}" aria-labelledby="${id}-title">
<p class="guide-number">Guide ${categoryIndex + 1}.${journeyIndex + 1}</p>
<h3 id="${id}-title">${escape(guide.title)}</h3>
<p>${escape(guide.description)}</p>
<details><summary>What this guide covers (${guide.steps.length} steps)</summary><ol>
${steps}
</ol></details>
<div class="versions">${videos}</div>
<p class="top"><a href="#contents">Back to contents</a></p>
</article>`;
  }).join("\n");
  return `<section id="category-${categoryIndex}" aria-labelledby="category-${categoryIndex}-title">
<h2 id="category-${categoryIndex}-title">${escape(category.title)}</h2>${cards}</section>`;
}).join("\n");
if (missing.length && !partial) {
  throw new Error(`Catalogue is incomplete (run with --partial to publish anyway):\n${missing.join("\n")}`);
}

const contents = catalogue.map((category, index) => `<li><a href="#category-${index}">${escape(category.title)}</a><ul>
${category.journeys.map((id) => `<li><a href="#${id}">${escape(loadTemplate(id).title)}</a></li>`).join("\n")}
</ul></li>`).join("\n");

writeFileSync(join(outputDirectory, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>cre8 user journey guides</title>
<style>
:root{color-scheme:dark;font:16px/1.5 system-ui;background:#171a20;color:#f5f5f5;touch-action:pan-x pan-y}
body{max-width:1280px;margin:auto;padding:24px}a{color:#ffa43a}h1,h2,h3,h4{line-height:1.2}
header p{max-width:70ch}
nav{padding:16px 24px;background:#232a33;border:1px solid #46515f;border-radius:12px}
nav ul{margin:8px 0;padding-left:20px}nav>ul>li{margin-block:8px}
section{margin-block:48px}article{padding:24px;margin-block:24px;background:#232a33;border:1px solid #46515f;border-radius:12px}
.guide-number{margin:0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#9aa7b5}
.duration{font-weight:normal;font-size:14px;color:#9aa7b5}
details{margin-block:16px}summary{cursor:pointer;color:#ffa43a}details ol{margin-block:8px}
.versions{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:24px}
video{width:100%;max-height:640px;background:#080b10}
.placeholder{padding:24px;border:1px dashed #46515f;border-radius:8px;color:#9aa7b5}
.top{margin-bottom:0;font-size:14px}
footer{margin-block:48px;color:#9aa7b5}
</style></head><body>
<header>
<h1>cre8 user journey guides</h1>
<p>Short, silent video walkthroughs of cre8, one outcome per video, with burned-in step captions and
downloadable subtitles. Each guide is available as a desktop recording and a mobile (portrait, touch) recording.</p>
<p>New to cre8? Start with <a href="#category-0">Getting started</a> and work through the categories in order.
Looking for something specific? Jump straight to it from the contents below, or expand
<strong>What this guide covers</strong> under any guide to preview its steps before watching.</p>
</header>
<nav id="contents" aria-label="Guide contents">
<h2>Contents</h2>
<ul>
${contents}
</ul>
</nav>
${sections}
<footer>
<p>Mobile guides use browser touch emulation, not a physical phone recording. All recordings are made against
a fresh demo account on an isolated database, so names and dubs you see are examples only.</p>
</footer>
</body></html>`);
if (missing.length) console.warn(`Published with ${missing.length} missing files:\n${missing.join("\n")}`);
console.log(`Published ${published} of ${catalogue.reduce((count, category) => count + category.journeys.length * 2, 0)} videos: ${join(outputDirectory, "index.html")}`);
