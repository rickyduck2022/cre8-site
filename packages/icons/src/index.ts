import * as React from "react";
import { IconBase, type IconProps } from "./IconBase";

type IconComponent = React.FC<IconProps>;

function withIconColor(props: IconProps): IconProps {
  return {
    ...props,
    style: { color: props.color, ...props.style },
  };
}

export const AudioLines: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-89.00 -319.00)" },
    React.createElement("path", { ...{ "d": "M90.166 328.833V332.083M94.4997 324.5V336.417M98.8334 321.25V340.75M103.167 326.667V334.25M107.501 323.417V337.5M111.834 328.833V332.083", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Radio: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-69.50 -484.50)" },
    React.createElement("path", { ...{ "d": "M84.8623 493.143C85.7514 494.034 86.2508 495.241 86.2508 496.499C86.2508 497.757 85.7514 498.964 84.8623 499.855M87.1014 490.905C88.5842 492.389 89.4171 494.401 89.4171 496.499C89.4171 498.597 88.5842 500.609 87.1014 502.094M75.8982 502.094C74.4154 500.609 73.5825 498.597 73.5825 496.499C73.5825 494.401 74.4154 492.389 75.8982 490.905M78.1371 499.855C77.248 498.964 76.7487 497.757 76.7487 496.499C76.7487 495.241 77.248 494.034 78.1371 493.143M83.0833 496.499C83.0833 497.374 82.3743 498.083 81.4998 498.083C80.6253 498.083 79.9163 497.374 79.9163 496.499C79.9163 495.625 80.6253 494.916 81.4998 494.916C82.3743 494.916 83.0833 495.625 83.0833 496.499Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Users: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-85.50 -646.50)" },
    React.createElement("path", { ...{ "d": "M100.667 665.625V664.042C100.667 663.202 100.333 662.396 99.7392 661.802C99.1453 661.209 98.3397 660.875 97.4998 660.875H92.7494C91.9095 660.875 91.104 661.209 90.5101 661.802C89.9162 662.396 89.5825 663.202 89.5825 664.042V665.625M100.667 651.476C101.346 651.652 101.947 652.049 102.377 652.604C102.806 653.158 103.039 653.84 103.039 654.542C103.039 655.243 102.806 655.925 102.377 656.48C101.947 657.034 101.346 657.431 100.667 657.607M105.417 665.625V664.042C105.417 663.34 105.183 662.658 104.753 662.104C104.323 661.549 103.721 661.153 103.042 660.978M98.2915 654.542C98.2915 656.291 96.8737 657.708 95.1246 657.708C93.3756 657.708 91.9577 656.291 91.9577 654.542C91.9577 652.793 93.3756 651.375 95.1246 651.375C96.8737 651.375 98.2915 652.793 98.2915 654.542Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Disc3: IconComponent = (props) => {
  const clipId = React.useId();
  const clipDefinition = React.createElement(
    "defs",
    null,
    React.createElement(
      "clipPath",
      { id: clipId, clipPathUnits: "userSpaceOnUse" },
      React.createElement("rect", { "width": "19", "height": "19", "fill": "currentColor", "transform": "translate(88 829)", "stroke": "none" }),
    ),
  );
  const icon = React.createElement(
    "g",
    { transform: "translate(-85.50 -826.50)", clipPath: `url(#${clipId})` },
    React.createElement("path", { ...{ "d": "M92.7494 838.5C92.7494 837.154 93.3037 835.966 94.1746 835.175M102.25 838.5C102.25 839.846 101.696 841.034 100.825 841.825M105.417 838.5C105.417 842.873 101.872 846.417 97.4998 846.417C93.1272 846.417 89.5825 842.873 89.5825 838.5C89.5825 834.127 93.1272 830.583 97.4998 830.583C101.872 830.583 105.417 834.127 105.417 838.5ZM99.0833 838.5C99.0833 839.375 98.3743 840.083 97.4998 840.083C96.6253 840.083 95.9164 839.375 95.9164 838.5C95.9164 837.625 96.6253 836.917 97.4998 836.917C98.3743 836.917 99.0833 837.625 99.0833 838.5Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      clipDefinition,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Download: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-85.50 -1006.50)" },
    React.createElement("path", { ...{ "d": "M97.5 1020.88V1011.38M101.458 1016.92L97.5 1020.88L93.5417 1016.92M104.625 1020.88V1024.04C104.625 1024.46 104.458 1024.86 104.161 1025.16C103.864 1025.46 103.462 1025.62 103.042 1025.62H91.9583C91.5384 1025.62 91.1357 1025.46 90.8387 1025.16C90.5418 1024.86 90.375 1024.46 90.375 1024.04V1020.88", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Bookmark: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-85.50 -1186.50)" },
    React.createElement("path", { ...{ "d": "M101.459 1191.38C101.879 1191.38 102.281 1191.54 102.578 1191.84C102.875 1192.14 103.042 1192.54 103.042 1192.96V1204.83C103.042 1204.97 103.006 1205.11 102.936 1205.23C102.867 1205.35 102.768 1205.45 102.648 1205.52C102.528 1205.59 102.392 1205.62 102.253 1205.62C102.114 1205.63 101.978 1205.59 101.858 1205.52L98.2852 1203.48C98.046 1203.34 97.7753 1203.27 97.4998 1203.27C97.2243 1203.27 96.9536 1203.34 96.7144 1203.48L93.142 1205.52C93.0216 1205.59 92.8853 1205.63 92.7466 1205.62C92.608 1205.62 92.4719 1205.59 92.3519 1205.52C92.232 1205.45 92.1325 1205.35 92.0632 1205.23C91.994 1205.11 91.9576 1204.97 91.9575 1204.83V1192.96C91.9575 1192.54 92.1244 1192.14 92.4213 1191.84C92.7183 1191.54 93.1211 1191.38 93.541 1191.38H101.459Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Plus: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-83.00 -1364.00)" },
    React.createElement("path", { ...{ "d": "M90.916 1376H94.9998M94.9998 1376H99.0836M94.9998 1376V1371.92M94.9998 1376V1380.08", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Folder: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-83.50 -1541.19)" },
    React.createElement("path", { ...{ "d": "M100.5 1558.5C100.832 1558.5 101.15 1558.37 101.384 1558.13C101.619 1557.9 101.751 1557.58 101.751 1557.25V1551C101.751 1550.67 101.619 1550.35 101.384 1550.12C101.15 1549.88 100.832 1549.75 100.5 1549.75H95.5625C95.3534 1549.75 95.1472 1549.7 94.9627 1549.6C94.7781 1549.51 94.6212 1549.36 94.5062 1549.19L93.9999 1548.44C93.8861 1548.26 93.7311 1548.12 93.5489 1548.02C93.3667 1547.93 93.163 1547.88 92.9561 1547.88H90.4996C90.1681 1547.88 89.8501 1548.01 89.6157 1548.24C89.3812 1548.48 89.2495 1548.79 89.2495 1549.12V1557.25C89.2495 1557.58 89.3812 1557.9 89.6157 1558.13C89.8501 1558.37 90.1681 1558.5 90.4996 1558.5H100.5Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Headphones: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-71.00 -1709.00)" },
    React.createElement("path", { ...{ "d": "M74.75 1722.83H77.5C77.9862 1722.83 78.4525 1723.03 78.7964 1723.37C79.1402 1723.71 79.3333 1724.18 79.3333 1724.67V1727.42C79.3333 1727.9 79.1402 1728.37 78.7964 1728.71C78.4525 1729.06 77.9862 1729.25 77.5 1729.25H76.5833C76.0971 1729.25 75.6308 1729.06 75.287 1728.71C74.9432 1728.37 74.75 1727.9 74.75 1727.42V1722.83ZM74.75 1722.83V1721C74.75 1718.81 75.6192 1716.71 77.1664 1715.17C78.7135 1713.62 80.812 1712.75 83 1712.75C85.188 1712.75 87.2865 1713.62 88.8336 1715.17C90.3808 1716.71 91.25 1718.81 91.25 1721V1722.83M91.25 1722.83V1727.42C91.25 1727.9 91.0568 1728.37 90.713 1728.71C90.3692 1729.06 89.9029 1729.25 89.4167 1729.25H88.5C88.0138 1729.25 87.5475 1729.06 87.2036 1728.71C86.8598 1728.37 86.6667 1727.9 86.6667 1727.42V1724.67C86.6667 1724.18 86.8598 1723.71 87.2036 1723.37C87.5475 1723.03 88.0138 1722.83 88.5 1722.83H91.25Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Settings2: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-68.50 -1855.50)" },
    React.createElement("path", { ...{ "d": "M81.9166 1871.04H75.5422M81.9166 1871.04C81.9166 1872.21 82.8679 1873.17 84.0414 1873.17C85.2149 1873.17 86.1662 1872.21 86.1662 1871.04C86.1662 1869.87 85.2149 1868.92 84.0414 1868.92C82.8679 1868.92 81.9166 1869.87 81.9166 1871.04ZM85.4579 1863.96H79.0836M79.0836 1863.96C79.0836 1865.13 78.1323 1866.08 76.9588 1866.08C75.7853 1866.08 74.834 1865.13 74.834 1863.96C74.834 1862.79 75.7853 1861.83 76.9588 1861.83C78.1323 1861.83 79.0836 1862.79 79.0836 1863.96Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Search: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-68.50 -1999.50)" },
    React.createElement("path", { ...{ "d": "M86.8751 2017.88L83.8009 2014.8M85.4583 2010.79C85.4583 2013.92 82.9213 2016.46 79.7917 2016.46C76.6621 2016.46 74.125 2013.92 74.125 2010.79C74.125 2007.66 76.6621 2005.12 79.7917 2005.12C82.9213 2005.12 85.4583 2007.66 85.4583 2010.79Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const LockKeyhole: IconComponent = (props) => {
  const clipId = React.useId();
  const clipDefinition = React.createElement(
    "defs",
    null,
    React.createElement(
      "clipPath",
      { id: clipId, clipPathUnits: "userSpaceOnUse" },
      React.createElement("rect", { "width": "14", "height": "14", "fill": "currentColor", "transform": "translate(88 2163)", "stroke": "none" }),
    ),
  );
  const icon = React.createElement(
    "g",
    { transform: "translate(-83.00 -2158.00)", clipPath: `url(#${clipId})` },
    React.createElement("path", { ...{ "d": "M92.0833 2168.83V2167.08C92.0833 2166.31 92.3906 2165.57 92.9376 2165.02C93.4846 2164.47 94.2265 2164.17 95 2164.17C95.7735 2164.17 96.5154 2164.47 97.0624 2165.02C97.6094 2165.57 97.9167 2166.31 97.9167 2167.08V2168.83M92.0833 2168.83H90.9167C90.2723 2168.83 89.75 2169.36 89.75 2170V2174.67C89.75 2175.31 90.2723 2175.83 90.9167 2175.83H99.0833C99.7277 2175.83 100.25 2175.31 100.25 2174.67V2170C100.25 2169.36 99.7277 2168.83 99.0833 2168.83H97.9167M92.0833 2168.83H97.9167M95.5833 2172.33C95.5833 2172.66 95.3222 2172.92 95 2172.92C94.6778 2172.92 94.4167 2172.66 94.4167 2172.33C94.4167 2172.01 94.6778 2171.75 95 2171.75C95.3222 2171.75 95.5833 2172.01 95.5833 2172.33Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      clipDefinition,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Bell: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-86.50 -2334.50)" },
    React.createElement("path", { ...{ "d": "M96.9834 2354.38C97.137 2354.64 97.3579 2354.86 97.624 2355.02C97.89 2355.17 98.1918 2355.25 98.4989 2355.25C98.8061 2355.25 99.1079 2355.17 99.3739 2355.02C99.6399 2354.86 99.8609 2354.64 100.014 2354.38M90.8536 2349.41C90.7393 2349.54 90.6639 2349.69 90.6365 2349.86C90.6091 2350.03 90.6309 2350.2 90.6994 2350.35C90.7678 2350.51 90.8798 2350.64 91.0218 2350.73C91.1639 2350.83 91.3298 2350.88 91.4994 2350.88H105.5C105.669 2350.88 105.835 2350.83 105.977 2350.73C106.119 2350.64 106.232 2350.51 106.3 2350.35C106.369 2350.2 106.391 2350.03 106.364 2349.86C106.337 2349.69 106.261 2349.54 106.147 2349.41C104.983 2348.21 103.75 2346.94 103.75 2343C103.75 2341.61 103.196 2340.27 102.212 2339.29C101.227 2338.3 99.8919 2337.75 98.4995 2337.75C97.1071 2337.75 95.7717 2338.3 94.7871 2339.29C93.8026 2340.27 93.2494 2341.61 93.2494 2343C93.2494 2346.94 92.0148 2348.21 90.8536 2349.41Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Upload: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-67.50 -2495.50)" },
    React.createElement("path", { ...{ "d": "M79.5 2501.88V2509.38M76.375 2505L79.5 2501.88L82.625 2505M85.125 2509.38V2511.88C85.125 2512.21 84.9933 2512.52 84.7589 2512.76C84.5245 2512.99 84.2065 2513.12 83.875 2513.12H75.125C74.7935 2513.12 74.4755 2512.99 74.2411 2512.76C74.0067 2512.52 73.875 2512.21 73.875 2511.88V2509.38", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const ChevronDown: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-82.50 -2652.50)" },
    React.createElement("path", { ...{ "d": "M91.25 2662.88L94.5 2666.12L97.75 2662.88", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Ellipsis: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-69.00 -2811.00)" },
    React.createElement("path", { ...{ "d": "M81.7498 2823C81.7498 2823.41 81.4141 2823.75 80.9999 2823.75C80.5857 2823.75 80.25 2823.41 80.25 2823C80.25 2822.59 80.5857 2822.25 80.9999 2822.25C81.4141 2822.25 81.7498 2822.59 81.7498 2823ZM86.9993 2823C86.9993 2823.41 86.6635 2823.75 86.2494 2823.75C85.8352 2823.75 85.4994 2823.41 85.4994 2823C85.4994 2822.59 85.8352 2822.25 86.2494 2822.25C86.6635 2822.25 86.9993 2822.59 86.9993 2823ZM76.5003 2823C76.5003 2823.41 76.1646 2823.75 75.7504 2823.75C75.3362 2823.75 75.0005 2823.41 75.0005 2823C75.0005 2822.59 75.3362 2822.25 75.7504 2822.25C76.1646 2822.25 76.5003 2822.59 76.5003 2823Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Pause: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-85.50 -2972.50)" },
    React.createElement("path", { ...{ "d": "M99.8751 2977.38H102.25C102.688 2977.38 103.042 2977.73 103.042 2978.17V2990.83C103.042 2991.27 102.688 2991.62 102.25 2991.62H99.8751C99.4378 2991.62 99.0833 2991.27 99.0833 2990.83V2978.17C99.0833 2977.73 99.4378 2977.38 99.8751 2977.38ZM92.7493 2977.38H95.1245C95.5618 2977.38 95.9163 2977.73 95.9163 2978.17V2990.83C95.9163 2991.27 95.5618 2991.62 95.1245 2991.62H92.7493C92.312 2991.62 91.9575 2991.27 91.9575 2990.83V2978.17C91.9575 2977.73 92.312 2977.38 92.7493 2977.38Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Heart: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-84.00 -3150.33)" },
    React.createElement("path", { ...{ "d": "M89.333 3160.33C89.333 3159.59 89.5581 3158.87 89.9785 3158.26C90.3989 3157.64 90.9948 3157.18 91.6876 3156.91C92.3804 3156.64 93.1374 3156.6 93.8587 3156.77C94.58 3156.94 95.2316 3157.33 95.7275 3157.88C95.7624 3157.92 95.8047 3157.95 95.8516 3157.97C95.8985 3157.99 95.9491 3158 96.0002 3158C96.0513 3158 96.1019 3157.99 96.1488 3157.97C96.1957 3157.95 96.2379 3157.92 96.2729 3157.88C96.7672 3157.33 97.419 3156.94 98.1414 3156.76C98.8639 3156.58 99.6228 3156.63 100.317 3156.9C101.011 3157.16 101.608 3157.64 102.028 3158.25C102.448 3158.86 102.671 3159.59 102.667 3160.33C102.667 3161.86 101.667 3163 100.667 3164L97.0056 3167.54C96.8814 3167.68 96.7282 3167.8 96.5563 3167.88C96.3843 3167.96 96.1976 3168 96.0084 3168C95.8192 3168 95.6319 3167.96 95.459 3167.89C95.2861 3167.81 95.1315 3167.7 95.0054 3167.55L91.3332 3164C90.3331 3163 89.333 3161.87 89.333 3160.33Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const MessageCircle: IconComponent = (props) => {
  const clipId = React.useId();
  const clipDefinition = React.createElement(
    "defs",
    null,
    React.createElement(
      "clipPath",
      { id: clipId, clipPathUnits: "userSpaceOnUse" },
      React.createElement("rect", { "width": "16", "height": "16", "fill": "currentColor", "transform": "translate(72 3317)", "stroke": "none" }),
    ),
  );
  const icon = React.createElement(
    "g",
    { transform: "translate(-68.00 -3313.00)", clipPath: `url(#${clipId})` },
    React.createElement("path", { ...{ "d": "M73.9942 3327.89C74.0922 3328.14 74.114 3328.41 74.0569 3328.67L73.3468 3330.87C73.3239 3330.98 73.3298 3331.09 73.364 3331.2C73.3981 3331.31 73.4594 3331.41 73.5419 3331.49C73.6245 3331.56 73.7256 3331.62 73.8356 3331.65C73.9457 3331.67 74.0611 3331.67 74.1709 3331.64L76.4464 3330.98C76.6915 3330.93 76.9454 3330.95 77.1791 3331.04C78.6028 3331.71 80.2156 3331.85 81.7329 3331.44C83.2502 3331.03 84.5745 3330.1 85.4722 3328.81C86.3699 3327.52 86.7833 3325.95 86.6394 3324.39C86.4955 3322.82 85.8036 3321.36 84.6857 3320.26C83.5679 3319.15 82.096 3318.48 80.5296 3318.35C78.9633 3318.23 77.4032 3318.66 76.1247 3319.57C74.8461 3320.49 73.9312 3321.82 73.5414 3323.35C73.1516 3324.87 73.312 3326.48 73.9942 3327.89Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      clipDefinition,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Play: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-86.29 -3473.50)" },
    React.createElement("path", { ...{ "d": "M91.9575 3479.96C91.9574 3479.68 92.0309 3479.41 92.1704 3479.17C92.31 3478.92 92.5107 3478.72 92.7523 3478.59C92.9939 3478.45 93.2678 3478.37 93.5464 3478.38C93.825 3478.38 94.0985 3478.45 94.3391 3478.59L103.838 3484.13C104.078 3484.27 104.277 3484.47 104.415 3484.71C104.554 3484.95 104.626 3485.22 104.627 3485.5C104.627 3485.78 104.554 3486.05 104.416 3486.29C104.278 3486.53 104.08 3486.73 103.84 3486.87L94.3391 3492.41C94.0985 3492.55 93.825 3492.62 93.5464 3492.62C93.2678 3492.63 92.9939 3492.55 92.7523 3492.41C92.5107 3492.28 92.31 3492.08 92.1704 3491.83C92.0309 3491.59 91.9574 3491.32 91.9575 3491.04V3479.96Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const CheckCheck: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-67.00 -3632.86)" },
    React.createElement("path", { ...{ "d": "M82.5001 3641.5L76.0829 3647.92L73.166 3645M84.8336 3643.83L80.4583 3648.21L79.5832 3647.33", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Check: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-83.50 -3790.18)" },
    React.createElement("path", { ...{ "d": "M100.499 3798.75L93.6252 3805.62L90.5005 3802.5", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Shuffle: IconComponent = (props) => {
  const clipId = React.useId();
  const clipDefinition = React.createElement(
    "defs",
    null,
    React.createElement(
      "clipPath",
      { id: clipId, clipPathUnits: "userSpaceOnUse" },
      React.createElement("rect", { "width": "15", "height": "15", "fill": "currentColor", "transform": "translate(88 3970)", "stroke": "none" }),
    ),
  );
  const icon = React.createElement(
    "g",
    { transform: "translate(-83.50 -3965.50)", clipPath: `url(#${clipId})` },
    React.createElement("path", { ...{ "d": "M99.2503 3983.75L101.751 3981.25L99.2503 3978.75M101.751 3981.25H97.9745C97.5648 3981.25 97.1624 3981.14 96.8027 3980.95C96.4431 3980.75 96.1371 3980.47 95.9118 3980.13L95.6874 3979.84M99.2503 3976.25L101.751 3973.75L99.2503 3971.25M101.751 3973.75L98.0171 3973.75C97.613 3973.75 97.2143 3973.84 96.855 3974.03C96.4958 3974.21 96.1868 3974.48 95.9544 3974.81L92.5454 3980.19C92.3131 3980.52 92.004 3980.79 91.6448 3980.97C91.2856 3981.16 90.8868 3981.25 90.4827 3981.25H89.2495M89.2495 3973.75H90.4821C90.9481 3973.75 91.4056 3973.87 91.8032 3974.12C92.2008 3974.36 92.5226 3974.71 92.7323 3975.12", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      clipDefinition,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const UserPlus: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-83.50 -4140.50)" },
    React.createElement("path", { ...{ "d": "M98.0002 4158.12V4156.88C98.0002 4156.21 97.7368 4155.58 97.2679 4155.11C96.799 4154.64 96.1631 4154.38 95.5 4154.38H91.7497C91.0866 4154.38 90.4507 4154.64 89.9818 4155.11C89.5129 4155.58 89.2495 4156.21 89.2495 4156.88V4158.12M99.8754 4150V4151.88M99.8754 4151.88V4153.75M99.8754 4151.88H101.751M99.8754 4151.88H98.0002M96.1251 4149.38C96.1251 4150.76 95.0057 4151.88 93.6249 4151.88C92.244 4151.88 91.1247 4150.76 91.1247 4149.38C91.1247 4147.99 92.244 4146.88 93.6249 4146.88C95.0057 4146.88 96.1251 4147.99 96.1251 4149.38Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Ticket: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-88.00 -4321.00)" },
    React.createElement("path", { ...{ "d": "M101 4326V4328M101 4326H108C108.531 4326 109.04 4326.21 109.415 4326.58C109.79 4326.96 110.001 4327.47 110.001 4328V4330C109.205 4330 108.442 4330.32 107.879 4330.88C107.316 4331.44 107 4332.2 107 4333C107 4333.8 107.316 4334.56 107.879 4335.12C108.442 4335.68 109.205 4336 110.001 4336V4338C110.001 4338.53 109.79 4339.04 109.415 4339.41C109.04 4339.79 108.531 4340 108 4340H101M101 4326H91.9992C91.4687 4326 90.96 4326.21 90.5849 4326.58C90.2098 4326.96 89.999 4327.47 89.999 4328V4330C90.7947 4330 91.5579 4330.32 92.1205 4330.88C92.6832 4331.44 92.9993 4332.2 92.9993 4333C92.9993 4333.8 92.6832 4334.56 92.1205 4335.12C91.5579 4335.68 90.7947 4336 89.999 4336V4338C89.999 4338.53 90.2098 4339.04 90.5849 4339.41C90.96 4339.79 91.4687 4340 91.9992 4340H101M101 4338V4340M101 4332V4334", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Link: IconComponent = (props) => {
  const clipId = React.useId();
  const clipDefinition = React.createElement(
    "defs",
    null,
    React.createElement(
      "clipPath",
      { id: clipId, clipPathUnits: "userSpaceOnUse" },
      React.createElement("rect", { "width": "15", "height": "15", "fill": "currentColor", "transform": "translate(88 4504)", "stroke": "none" }),
    ),
  );
  const icon = React.createElement(
    "g",
    { transform: "translate(-83.51 -4499.50)", clipPath: `url(#${clipId})` },
    React.createElement("path", { ...{ "d": "M94.2502 4512.12C94.5187 4512.48 94.8611 4512.78 95.2543 4513C95.6476 4513.21 96.0824 4513.34 96.5294 4513.37C96.9764 4513.4 97.425 4513.34 97.8448 4513.18C98.2647 4513.02 98.6459 4512.78 98.9627 4512.46L100.838 4510.59C101.407 4510 101.722 4509.21 101.715 4508.39C101.708 4507.57 101.379 4506.79 100.8 4506.21C100.22 4505.63 99.4365 4505.3 98.6171 4505.29C97.7978 4505.28 97.0084 4505.6 96.419 4506.17L95.344 4507.24M96.7504 4510.88C96.482 4510.52 96.1395 4510.22 95.7463 4510C95.353 4509.79 94.9182 4509.66 94.4712 4509.63C94.0242 4509.6 93.5756 4509.66 93.1558 4509.82C92.7359 4509.98 92.3547 4510.22 92.0379 4510.54L90.1629 4512.41C89.5936 4513 89.2786 4513.79 89.2858 4514.61C89.2929 4515.43 89.6215 4516.21 90.2009 4516.79C90.7803 4517.37 91.5641 4517.7 92.3835 4517.71C93.2029 4517.72 93.9922 4517.4 94.5816 4516.83L95.6504 4515.76", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      clipDefinition,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const SkipBack: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-85.00 -4676.00)" },
    React.createElement("path", { ...{ "d": "M90.25 4694V4682M101.478 4682.21C101.706 4682.08 101.966 4682 102.231 4682C102.497 4682 102.758 4682.06 102.989 4682.2C103.22 4682.33 103.412 4682.52 103.546 4682.74C103.68 4682.97 103.75 4683.23 103.75 4683.5V4692.5C103.75 4692.76 103.68 4693.03 103.546 4693.25C103.412 4693.48 103.22 4693.67 102.989 4693.8C102.758 4693.94 102.497 4694 102.231 4694C101.966 4694 101.706 4693.92 101.478 4693.79L93.9806 4689.29C93.758 4689.15 93.5737 4688.97 93.4457 4688.74C93.3176 4688.52 93.2502 4688.26 93.25 4688C93.2497 4687.74 93.3167 4687.49 93.4444 4687.26C93.572 4687.04 93.756 4686.85 93.9784 4686.71L101.478 4682.21Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const SkipForward: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-85.00 -4855.00)" },
    React.createElement("path", { ...{ "d": "M103.75 4861V4873M92.5217 4861.21C92.2941 4861.08 92.0344 4861 91.7689 4861C91.5035 4861 91.2419 4861.06 91.0109 4861.2C90.78 4861.33 90.5878 4861.52 90.4541 4861.74C90.3204 4861.97 90.25 4862.23 90.25 4862.5V4871.5C90.25 4871.76 90.3204 4872.03 90.4541 4872.25C90.5878 4872.48 90.78 4872.67 91.0109 4872.8C91.2419 4872.94 91.5035 4873 91.7689 4873C92.0344 4873 92.2941 4872.92 92.5217 4872.79L100.019 4868.29C100.242 4868.15 100.426 4867.97 100.554 4867.74C100.682 4867.52 100.75 4867.26 100.75 4867C100.75 4866.74 100.683 4866.49 100.556 4866.26C100.428 4866.04 100.244 4865.85 100.022 4865.71L92.5217 4861.21Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Repeat: IconComponent = (props) => {
  const clipId = React.useId();
  const clipDefinition = React.createElement(
    "defs",
    null,
    React.createElement(
      "clipPath",
      { id: clipId, clipPathUnits: "userSpaceOnUse" },
      React.createElement("rect", { "width": "16", "height": "16", "fill": "currentColor", "transform": "translate(72 5021)", "stroke": "none" }),
    ),
  );
  const icon = React.createElement(
    "g",
    { transform: "translate(-68.00 -5017.00)", clipPath: `url(#${clipId})` },
    React.createElement("path", { ...{ "d": "M83.3333 5027.67L86 5025L83.3333 5022.33M86 5025H76.6667C75.9594 5025 75.2811 5025.28 74.781 5025.78C74.281 5026.28 74 5026.96 74 5027.67V5028.33M76.6667 5030.33L74 5033L76.6667 5035.67M74 5033H83.3333C84.0406 5033 84.7189 5032.72 85.219 5032.22C85.719 5031.72 86 5031.04 86 5030.33V5029.67", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      clipDefinition,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const ListMusic: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-69.00 -5161.00)" },
    React.createElement("path", { ...{ "d": "M84 5167.75H74.25M80.25 5173H74.25M80.25 5178.25H74.25M87.75 5176V5167.75M87.75 5176C87.75 5177.24 86.7426 5178.25 85.5 5178.25C84.2574 5178.25 83.25 5177.24 83.25 5176C83.25 5174.76 84.2574 5173.75 85.5 5173.75C86.7426 5173.75 87.75 5174.76 87.75 5176Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Volume2: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-69.00 -5306.00)" },
    React.createElement("path", { ...{ "d": "M84.0002 5315.75C84.487 5316.4 84.7502 5317.19 84.7502 5318C84.7502 5318.81 84.487 5319.6 84.0002 5320.25M86.5235 5322.77C87.1504 5322.15 87.6476 5321.4 87.9869 5320.58C88.3261 5319.76 88.5007 5318.89 88.5007 5318C88.5007 5317.11 88.3261 5316.24 87.9869 5315.42C87.6476 5314.6 87.1504 5313.85 86.5235 5313.23M80.2499 5312.53C80.2498 5312.42 80.2187 5312.32 80.1606 5312.23C80.1025 5312.15 80.0199 5312.08 79.9234 5312.04C79.8269 5312 79.7207 5311.99 79.6182 5312.01C79.5157 5312.03 79.4216 5312.08 79.3476 5312.15L76.8095 5314.69C76.7115 5314.79 76.595 5314.87 76.4666 5314.92C76.3383 5314.97 76.2006 5315 76.0617 5315H74.2496C74.0506 5315 73.8599 5315.08 73.7192 5315.22C73.5785 5315.36 73.4995 5315.55 73.4995 5315.75V5320.25C73.4995 5320.45 73.5785 5320.64 73.7192 5320.78C73.8599 5320.92 74.0506 5321 74.2496 5321H76.0617C76.2006 5321 76.3383 5321.03 76.4666 5321.08C76.595 5321.13 76.7115 5321.21 76.8095 5321.31L79.3469 5323.85C79.4208 5323.92 79.5151 5323.97 79.6178 5323.99C79.7205 5324.01 79.8269 5324 79.9236 5323.96C80.0203 5323.92 80.103 5323.85 80.1611 5323.77C80.2191 5323.68 80.2501 5323.58 80.2499 5323.47V5312.53Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Maximize2: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-69.00 -5451.00)" },
    React.createElement("path", { ...{ "d": "M87.75 5460.75V5456.25H83.25M87.75 5456.25L82.5 5461.5M74.25 5469.75L79.5 5464.5M74.25 5465.25V5469.75H78.75", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const IosWifiSignal: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-68.13 -5594.13)" },
    React.createElement("path", { ...{ "d": "M80.1357 5603.35C82.2497 5603.35 84.2829 5604.04 85.8151 5605.28C85.9305 5605.38 86.1149 5605.38 86.2285 5605.28L87.3314 5604.33C87.3889 5604.28 87.421 5604.22 87.4205 5604.15C87.42 5604.08 87.3871 5604.01 87.3288 5603.96C83.3075 5600.68 76.9633 5600.68 72.9419 5603.96C72.8837 5604.01 72.8506 5604.08 72.8501 5604.15C72.8496 5604.22 72.8816 5604.28 72.9391 5604.33L74.0423 5605.28C74.1558 5605.38 74.3404 5605.38 74.4557 5605.28C75.988 5604.04 78.0215 5603.35 80.1357 5603.35ZM80.1329 5606.52C81.2866 5606.52 82.3991 5606.9 83.2544 5607.59C83.37 5607.69 83.5522 5607.69 83.665 5607.59L84.7591 5606.6C84.8167 5606.55 84.8488 5606.48 84.8479 5606.4C84.8471 5606.33 84.8135 5606.26 84.7547 5606.21C82.1505 5604.04 78.1174 5604.04 75.5132 5606.21C75.4544 5606.26 75.4208 5606.33 75.42 5606.4C75.4193 5606.48 75.4513 5606.55 75.5091 5606.6L76.603 5607.59C76.7157 5607.69 76.8979 5607.69 77.0136 5607.59C77.8682 5606.9 78.9799 5606.52 80.1329 5606.52ZM82.2786 5608.61C82.2803 5608.69 82.2487 5608.77 82.1915 5608.82L80.3414 5610.66C80.2871 5610.72 80.2132 5610.75 80.136 5610.75C80.0589 5610.75 79.9849 5610.72 79.9307 5610.66L78.0802 5608.82C78.0231 5608.77 77.9916 5608.69 77.9933 5608.61C77.995 5608.53 78.0297 5608.46 78.0892 5608.41C79.2708 5607.42 81.0013 5607.42 82.1829 5608.41C82.2423 5608.46 82.2769 5608.53 82.2786 5608.61Z", "fillRule": "evenodd", "clipRule": "evenodd", "fill": "currentColor", "stroke": "none" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const IosBatteryFull: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-71.71 -5736.88)" },
    React.createElement("path", { ...{ "d": "M87.8571 5744C89.6147 5744 90.4935 5744 91.1844 5744.26C92.0625 5744.58 92.7615 5745.2 93.1347 5745.96C93.4283 5746.57 93.4286 5747.34 93.4286 5748.88C93.4286 5750.41 93.4283 5751.18 93.1347 5751.79L93.0611 5751.93C92.6736 5752.63 92.0077 5753.19 91.1844 5753.49L91.0521 5753.54C90.38 5753.75 89.5047 5753.75 87.8571 5753.75H77.5714L76.4071 5753.75C75.3862 5753.73 74.7623 5753.69 74.2441 5753.49C73.4209 5753.19 72.755 5752.63 72.3675 5751.93L72.2938 5751.79C72.0002 5751.18 72 5750.41 72 5748.88C72 5747.43 72.0001 5746.67 72.2419 5746.08L72.2938 5745.96C72.6437 5745.24 73.28 5744.66 74.0818 5744.32L74.2441 5744.26C74.7623 5744.06 75.3862 5744.02 76.4071 5744L77.5714 5744H87.8571ZM77.5714 5744.75C76.6807 5744.75 76.0565 5744.75 75.5675 5744.78C75.0867 5744.81 74.801 5744.86 74.5798 5744.95C73.9058 5745.2 73.3687 5745.67 73.0823 5746.26C72.9884 5746.45 72.925 5746.7 72.8915 5747.12C72.8573 5747.55 72.8571 5748.1 72.8571 5748.88C72.8571 5749.65 72.8573 5750.2 72.8915 5750.63C72.925 5751.05 72.9884 5751.3 73.0823 5751.49C73.3687 5752.08 73.9058 5752.55 74.5798 5752.8C74.801 5752.89 75.0867 5752.94 75.5675 5752.97C76.0565 5753 76.6807 5753 77.5714 5753H87.8571C88.7479 5753 89.3721 5753 89.8611 5752.97C90.3418 5752.94 90.6276 5752.89 90.8487 5752.8C91.5227 5752.55 92.0599 5752.08 92.3463 5751.49C92.4402 5751.3 92.5035 5751.05 92.5371 5750.63C92.5713 5750.2 92.5714 5749.65 92.5714 5748.88C92.5714 5748.1 92.5713 5747.55 92.5371 5747.12C92.5035 5746.7 92.4402 5746.45 92.3463 5746.26C92.0599 5745.67 91.5227 5745.2 90.8487 5744.95C90.6276 5744.86 90.3418 5744.81 89.8611 5744.78C89.3721 5744.75 88.7479 5744.75 87.8571 5744.75H77.5714ZM88.2857 5745.5C89.4857 5745.5 90.0857 5745.5 90.5441 5745.7C90.9473 5745.88 91.2753 5746.17 91.4807 5746.52C91.7142 5746.92 91.7143 5747.45 91.7143 5748.5V5749.25C91.7143 5750.3 91.7142 5750.82 91.4807 5751.23C91.2753 5751.58 90.9473 5751.87 90.5441 5752.05C90.0857 5752.25 89.4857 5752.25 88.2857 5752.25H77.1429C75.9429 5752.25 75.3428 5752.25 74.8845 5752.05C74.4813 5751.87 74.1533 5751.58 73.9478 5751.23C73.7143 5750.82 73.7143 5750.3 73.7143 5749.25V5748.5C73.7143 5747.45 73.7143 5746.92 73.9478 5746.52C74.1533 5746.17 74.4813 5745.88 74.8845 5745.7C75.3428 5745.5 75.9429 5745.5 77.1429 5745.5H88.2857ZM94.2857 5747.38C94.9755 5747.63 95.4241 5748.24 95.4241 5748.9C95.424 5749.57 94.9754 5750.17 94.2857 5750.43V5747.38Z", "fill": "currentColor", "stroke": "none" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const SearchAlt: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-68.50 -5879.50)" },
    React.createElement("path", { ...{ "d": "M86.875 5897.88L83.8009 5894.8M85.4582 5890.79C85.4582 5893.92 82.9212 5896.46 79.7916 5896.46C76.662 5896.46 74.125 5893.92 74.125 5890.79C74.125 5887.66 76.662 5885.12 79.7916 5885.12C82.9212 5885.12 85.4582 5887.66 85.4582 5890.79Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const FriendsFeed: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-86.50 -6041.50)" },
    React.createElement("path", { ...{ "d": "M102.217 6049.79C103.199 6050.77 103.751 6052.11 103.751 6053.5C103.751 6054.89 103.199 6056.22 102.217 6057.21M104.691 6047.32C106.33 6048.96 107.251 6051.18 107.251 6053.5C107.251 6055.82 106.33 6058.04 104.691 6059.68M92.309 6059.68C90.6701 6058.04 89.7495 6055.82 89.7495 6053.5C89.7495 6051.18 90.6701 6048.96 92.309 6047.32M94.7836 6057.21C93.8009 6056.22 93.2489 6054.89 93.2489 6053.5C93.2489 6052.11 93.8009 6050.77 94.7836 6049.79M100.25 6053.5C100.25 6054.47 99.4668 6055.25 98.5002 6055.25C97.5336 6055.25 96.7501 6054.47 96.7501 6053.5C96.7501 6052.53 97.5336 6051.75 98.5002 6051.75C99.4668 6051.75 100.25 6052.53 100.25 6053.5Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Friends: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-86.50 -6221.50)" },
    React.createElement("path", { ...{ "d": "M102 6241.38V6239.62C102 6238.7 101.632 6237.81 100.975 6237.15C100.319 6236.49 99.4285 6236.12 98.5002 6236.12H93.2498C92.3215 6236.12 91.4311 6236.49 90.7747 6237.15C90.1183 6237.81 89.7495 6238.7 89.7495 6239.62V6241.38M102 6225.74C102.751 6225.93 103.416 6226.37 103.89 6226.98C104.365 6227.6 104.622 6228.35 104.622 6229.12C104.622 6229.9 104.365 6230.65 103.89 6231.27C103.416 6231.88 102.751 6232.32 102 6232.51M107.251 6241.37V6239.62C107.25 6238.85 106.992 6238.1 106.517 6237.48C106.042 6236.87 105.377 6236.43 104.626 6236.24M99.3753 6229.12C99.3753 6231.06 97.8082 6232.62 95.875 6232.62C93.9419 6232.62 92.3747 6231.06 92.3747 6229.12C92.3747 6227.19 93.9419 6225.62 95.875 6225.62C97.8082 6225.62 99.3753 6227.19 99.3753 6229.12Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Settings: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-70.00 -6386.00)" },
    React.createElement("path", { ...{ "d": "M83.6665 6402.17H76.1672M83.6665 6402.17C83.6665 6403.55 84.7857 6404.67 86.1662 6404.67C87.5468 6404.67 88.666 6403.55 88.666 6402.17C88.666 6400.79 87.5468 6399.67 86.1662 6399.67C84.7857 6399.67 83.6665 6400.79 83.6665 6402.17ZM87.8327 6393.83H80.3335M80.3335 6393.83C80.3335 6395.21 79.2143 6396.33 77.8337 6396.33C76.4532 6396.33 75.334 6395.21 75.334 6393.83C75.334 6392.45 76.4532 6391.33 77.8337 6391.33C79.2143 6391.33 80.3335 6392.45 80.3335 6393.83Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const MoreActions: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-85.00 -6548.00)" },
    React.createElement("path", { ...{ "d": "M97.7498 6560C97.7498 6560.41 97.4141 6560.75 96.9999 6560.75C96.5857 6560.75 96.25 6560.41 96.25 6560C96.25 6559.59 96.5857 6559.25 96.9999 6559.25C97.4141 6559.25 97.7498 6559.59 97.7498 6560ZM102.999 6560C102.999 6560.41 102.664 6560.75 102.249 6560.75C101.835 6560.75 101.499 6560.41 101.499 6560C101.499 6559.59 101.835 6559.25 102.249 6559.25C102.664 6559.25 102.999 6559.59 102.999 6560ZM92.5003 6560C92.5003 6560.41 92.1646 6560.75 91.7504 6560.75C91.3362 6560.75 91.0005 6560.41 91.0005 6560C91.0005 6559.59 91.3362 6559.25 91.7504 6559.25C92.1646 6559.25 92.5003 6559.59 92.5003 6560Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const Queue: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-70.00 -6712.00)" },
    React.createElement("path", { ...{ "d": "M85.3333 6718.17H74.5M81.1667 6724H74.5M81.1667 6729.83H74.5M89.5 6727.33V6718.17M89.5 6727.33C89.5 6728.71 88.3807 6729.83 87 6729.83C85.6193 6729.83 84.5 6728.71 84.5 6727.33C84.5 6725.95 85.6193 6724.83 87 6724.83C88.3807 6724.83 89.5 6725.95 89.5 6727.33Z", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const IosSignal: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-68.16 -6856.88)" },
    React.createElement("path", { ...{ "d": "M88.32 6865.15C88.32 6864.67 87.914 6864.29 87.4133 6864.29H86.5067C86.006 6864.29 85.6 6864.67 85.6 6865.15V6872.6C85.6 6873.08 86.006 6873.46 86.5067 6873.46H87.4133C87.914 6873.46 88.32 6873.08 88.32 6872.6V6865.15ZM82.001 6866.12H82.9077C83.4084 6866.12 83.8143 6866.52 83.8143 6867V6872.58C83.8143 6873.07 83.4084 6873.46 82.9077 6873.46H82.001C81.5003 6873.46 81.0943 6873.07 81.0943 6872.58V6867C81.0943 6866.52 81.5003 6866.12 82.001 6866.12ZM78.319 6868.11H77.4123C76.9116 6868.11 76.5057 6868.51 76.5057 6869V6872.57C76.5057 6873.06 76.9116 6873.46 77.4123 6873.46H78.319C78.8197 6873.46 79.2257 6873.06 79.2257 6872.57V6869C79.2257 6868.51 78.8197 6868.11 78.319 6868.11ZM73.8133 6869.94H72.9067C72.4059 6869.94 72 6870.34 72 6870.82V6872.58C72 6873.07 72.4059 6873.46 72.9067 6873.46H73.8133C74.3141 6873.46 74.72 6873.07 74.72 6872.58V6870.82C74.72 6870.34 74.3141 6869.94 73.8133 6869.94Z", "fillRule": "evenodd", "clipRule": "evenodd", "fill": "currentColor", "stroke": "none" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};
export const ChevronRight: IconComponent = (props) => {
  const icon = React.createElement(
    "g",
    { transform: "translate(-68.00 -6999.00)" },
    React.createElement("path", { ...{ "d": "M78 7015L82 7011L78 7007", "strokeWidth": "1.7", "strokeLinecap": "round" }, key: 0 }),
  );
  const children = React.createElement(
    React.Fragment,
    null,
      icon,
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};

export const Undo: IconComponent = (props) => {
  const children = React.createElement(
    "path",
    { d: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-2", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round" },
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};

export const Pencil: IconComponent = (props) => {
  const children = React.createElement(
    "path",
    { d: "M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20zm10-12 3 3", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round" },
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};

export const Trash: IconComponent = (props) => {
  const children = React.createElement(
    "path",
    { d: "M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round" },
  );
  return React.createElement(IconBase, { ...withIconColor(props), children });
};

export { IconBase };
export type { IconProps };
