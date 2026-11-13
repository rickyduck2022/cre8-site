import React, { type FC } from "react";
import { IconBase, type IconProps } from "./IconBase";

function solidIcon(path: string): FC<IconProps> {
  return function SolidIcon(props) {
    return <IconBase {...props} fill="currentColor" stroke="none"><path d={path} fillRule="evenodd" /></IconBase>;
  };
}

export const PauseSolid = solidIcon("M6 4h4v16H6zM14 4h4v16h-4z");
export const SkipBackSolid = solidIcon("M4 4h3v16H4zM20 4v16L8 12z");
export const SkipForwardSolid = solidIcon("M17 4h3v16h-3zM4 4l12 8-12 8z");
export const ShuffleSolid = solidIcon("M16 2l6 4-6 4V7h-1c-2 0-3 2-4.2 4.5C9.4 14.5 7.7 18 4 18H2v-3h2c2 0 3-2 4.2-4.5C9.6 7.5 11.3 4 15 4h1zM2 4h2c2.3 0 3.8 1.3 5 3.1L7.3 10C6.3 8.2 5.4 7 4 7H2zM12.7 14c1 1.3 1.6 1 3.3 1v-3l6 4-6 4v-2h-1c-2.2 0-3.5-1-4.4-2.1z");
export const RepeatSolid = solidIcon("M16 1l6 5-6 5V8H6a2 2 0 0 0-2 2v3H1v-3a5 5 0 0 1 5-5h10zM8 23l-6-5 6-5v3h10a2 2 0 0 0 2-2v-3h3v3a5 5 0 0 1-5 5H8z");
export const VolumeSolid = solidIcon("M3 9h4l5-5v16l-5-5H3zM15 7a7 7 0 0 1 0 10l-2-2a4 4 0 0 0 0-6zM18 3a13 13 0 0 1 0 18l-2-2a10 10 0 0 0 0-14z");
export const MuteSolid = solidIcon("M3 9h4l5-5v16l-5-5H3zM16 7l3 3 3-3 2 2-3 3 3 3-2 2-3-3-3 3-2-2 3-3-3-3z");
export const DownloadSolid = solidIcon("M10 2h4v10h5l-7 7-7-7h5zM2 18h4v3h12v-3h4v6H2z");
export const MessageSolid = solidIcon("M12 2C5.9 2 1 6 1 11c0 2.7 1.4 5.1 3.6 6.7L3 23l6.5-3.2c.8.1 1.6.2 2.5.2 6.1 0 11-4 11-9S18.1 2 12 2z");
export const CloseSolid = solidIcon("M6 3l6 6 6-6 3 3-6 6 6 6-3 3-6-6-6 6-3-3 6-6-6-6z");
export const ChevronDownSolid = solidIcon("M3 7l9 9 9-9z");
export const ChevronRightSolid = solidIcon("M7 3l9 9-9 9z");
export const EllipsisSolid = solidIcon("M6 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0M22 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0");
export const MaximizeSolid = solidIcon("M2 2h8v3H7l4 4-2 2-4-4v3H2zM22 22h-8v-3h3l-4-4 2-2 4 4v-3h3z");
export const MinimizeSolid = solidIcon("M2 4l2-2 5 5V4h3v8H4V9h3zM22 20l-2 2-5-5v3h-3v-8h8v3h-3z");
export const MoveSolid = solidIcon("M12 0l5 5h-3v5h5V7l5 5-5 5v-3h-5v5h3l-5 5-5-5h3v-5H5v3l-5-5 5-5v3h5V5H7z");
