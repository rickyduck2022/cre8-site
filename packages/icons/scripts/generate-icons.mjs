import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const directory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(directory, "../svgs/icons.svg");
const outputPath = resolve(directory, "../src/index.ts");

const icons = [
  ["AudioLines", 6, 90.17, 321.25, 21.67, 19.5],
  ["Radio", 14, 73.58, 490.9, 15.83, 11.19],
  ["Users", 17, 89.58, 651.38, 15.83, 14.25],
  ["Disc3", 21, 89.58, 830.58, 15.83, 15.83],
  ["Download", 28, 90.38, 1011.38, 14.25, 14.24],
  ["Bookmark", 39, 91.96, 1191.38, 11.08, 14.24],
  ["Plus", 47, 90.92, 1371.92, 8.17, 8.16],
  ["Folder", 52, 89.25, 1547.88, 12.5, 10.62],
  ["Headphones", 57, 74.75, 1712.75, 16.5, 16.5],
  ["Settings2", 60, 74.83, 1861.83, 11.33, 11.34],
  ["Search", 63, 74.13, 2005.12, 12.75, 12.76],
  ["LockKeyhole", 66, 89.75, 2164.17, 10.5, 11.66],
  ["Bell", 71, 90.63, 2337.75, 15.75, 17.5],
  ["Upload", 76, 73.88, 2501.88, 11.25, 11.24],
  ["ChevronDown", 79, 91.25, 2662.88, 6.5, 3.24],
  ["Ellipsis", 83, 75, 2822.25, 12, 1.5],
  ["Pause", 86, 91.96, 2977.38, 11.08, 14.24],
  ["Heart", 96, 89.33, 3156.65, 13.33, 11.35],
  ["MessageCircle", 107, 73.33, 3318.33, 13.33, 13.34],
  ["Play", 110, 91.96, 3478.38, 12.67, 14.24],
  ["CheckCheck", 115, 73.17, 3641.5, 11.67, 6.71],
  ["Check", 118, 90.5, 3798.75, 10, 6.87],
  ["Shuffle", 122, 89.25, 3971.25, 12.5, 12.5],
  ["UserPlus", 127, 89.25, 4146.88, 12.5, 11.24],
  ["Ticket", 131, 90, 4326, 20, 14],
  ["Link", 136, 89.29, 4505.29, 12.43, 12.42],
  ["SkipBack", 140, 90.25, 4682, 13.5, 12],
  ["SkipForward", 145, 90.25, 4861, 13.5, 12],
  ["Repeat", 150, 74, 5022.33, 12, 13.34],
  ["ListMusic", 153, 74.25, 5167.75, 13.5, 10.5],
  ["Volume2", 156, 73.5, 5312, 15, 12],
  ["Maximize2", 159, 74.25, 5456.25, 13.5, 13.5],
  ["IosWifiSignal", 162, 72.85, 5601.5, 14.57, 9.25],
  ["IosBatteryFull", 165, 72, 5744, 23.42, 9.75],
  ["SearchAlt", 168, 74.13, 5885.12, 12.75, 12.76],
  ["FriendsFeed", 171, 89.75, 6047.32, 17.5, 12.36],
  ["Friends", 175, 89.75, 6225.62, 17.5, 15.76],
  ["Settings", 180, 75.33, 6391.33, 13.33, 13.34],
  ["MoreActions", 183, 91, 6559.25, 12, 1.5],
  ["Queue", 187, 74.5, 6718.17, 15, 11.66],
  ["IosSignal", 190, 72, 6864.29, 16.32, 9.17],
  ["ChevronRight", 193, 78, 7007, 4, 8],
];

function getRootChildren(svg) {
  const contentStart = svg.indexOf(">") + 1;
  const contentEnd = svg.lastIndexOf("</svg>");
  if (contentStart === 0 || contentEnd < contentStart) {
    throw new Error("The SVG does not have a valid root element.");
  }

  const content = svg.slice(contentStart, contentEnd);
  const tags = /<\/?[A-Za-z_][\w:.-]*(?:\s[^<>]*?)?\s*\/?>/g;
  const children = [];
  let depth = 0;
  let start = -1;

  for (const match of content.matchAll(tags)) {
    const tag = match[0];
    if (tag.startsWith("</")) {
      depth -= 1;
      if (depth === 0) {
        children.push(content.slice(start, match.index + tag.length));
      }
      continue;
    }

    if (depth === 0) {
      start = match.index;
    }

    if (/\/\s*>$/.test(tag)) {
      if (depth === 0) {
        children.push(tag);
      }
    } else {
      depth += 1;
    }
  }

  return children;
}

function parseAttributes(source) {
  const attributes = {};
  const expression = /([:\w.-]+)\s*=\s*"([^"]*)"/g;
  for (const match of source.matchAll(expression)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

function getPathAttributes(element) {
  return [...element.matchAll(/<path\b([^>]*)\/\s*>/g)].map((match) =>
    parseAttributes(match[1]),
  );
}

function getClipRect(svg, clipId) {
  const clip = [...svg.matchAll(/<clipPath\b([^>]*)>([\s\S]*?)<\/clipPath>/g)]
    .map((match) => ({
      attributes: parseAttributes(match[1]),
      body: match[2],
    }))
    .find(({ attributes }) => attributes.id === clipId);

  if (!clip) {
    throw new Error(`Missing clip path "${clipId}" in the SVG.`);
  }

  const rect = clip.body.match(/<rect\b([^>]*)\/?\s*>/);
  if (!rect) {
    throw new Error(`Clip path "${clipId}" does not contain a rectangle.`);
  }
  return parseAttributes(rect[1]);
}

function reactAttributes(attributes) {
  const entries = Object.entries(attributes)
    .filter(([name]) => name !== "stroke" && name !== "id")
    .map(([name, value]) => {
      const reactName = name.replace(/-([a-z])/g, (_, letter) =>
        letter.toUpperCase(),
      );
      if (name === "fill" && value !== "none") {
        value = "currentColor";
      }
      return `${JSON.stringify(reactName)}: ${JSON.stringify(value)}`;
    });

  if (!attributes.stroke) {
    entries.push('"stroke": "none"');
  }

  return `{ ${entries.join(", ")} }`;
}

function renderIcon(svg, rootChildren, icon) {
  const [name, index, x, y, width, height] = icon;
  const element = rootChildren[index];
  if (!element) {
    throw new Error(`SVG child ${index} for ${name} does not exist.`);
  }

  const paths = getPathAttributes(element);
  if (paths.length === 0) {
    throw new Error(`SVG child ${index} for ${name} has no paths.`);
  }

  const translateX = (12 - (x + width / 2)).toFixed(2);
  const translateY = (12 - (y + height / 2)).toFixed(2);
  const pathElements = paths
    .map(
      (attributes, pathIndex) =>
        `React.createElement("path", { ...${reactAttributes(attributes)}, key: ${pathIndex} })`,
    )
    .join(",\n      ");
  const clipReference = element.match(/clip-path="url\(#([^"]+)\)"/);
  const clip = clipReference
    ? getClipRect(svg, clipReference[1])
    : undefined;
  const clipContents = clip
    ? `  const clipId = React.useId();
  const clipDefinition = React.createElement(
    "defs",
    null,
    React.createElement(
      "clipPath",
      { id: clipId, clipPathUnits: "userSpaceOnUse" },
      React.createElement("rect", ${reactAttributes(clip)}),
    ),
  );
`
    : "";
  const clipProp = clip ? `, clipPath: \`url(#\${clipId})\`` : "";
  const clipChild = clip ? "      clipDefinition,\n" : "";

  return `export const ${name}: IconComponent = (props) => {
${clipContents}  const icon = React.createElement(
    "g",
    { transform: "translate(${translateX} ${translateY})"${clipProp} },
    ${pathElements},
  );
  const children = React.createElement(
    React.Fragment,
    null,
${clipChild}      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};`;
}

const svg = await readFile(sourcePath, "utf8");
const rootChildren = getRootChildren(svg);
const generated = [
  'import * as React from "react";',
  'import { IconBase, type IconProps } from "./IconBase";',
  "",
  "type IconComponent = React.FC<IconProps>;",
  "",
  "function withIconColor(props: IconProps): IconProps {",
  "  return {",
  "    ...props,",
  "    style: { color: props.color, ...props.style },",
  "  };",
  "}",
  "",
  ...icons.map((icon) => renderIcon(svg, rootChildren, icon)),
  "",
  "export { IconBase };",
  "export type { IconProps };",
  "",
].join("\n");

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, generated);
console.log(`Generated ${icons.length} icons in ${outputPath}`);
