import type { ComponentProps } from "react";
import { FloatingWindow, WindowLayer, packTypeLabel, type DubPack } from "@craft/ui";
import { PackView } from "./PackView";
import "./Packs.css";

export interface PackWindowState {
  pack: DubPack;
  openRequest: number;
}

interface Props extends Omit<ComponentProps<typeof PackView>, "pack" | "owner" | "onEdit" | "onDelete" | "onRefresh"> {
  windows: PackWindowState[];
  username: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onEdit: (pack: DubPack) => void;
  onCommunityChange: () => Promise<void>;
}

export function PackWindows({ windows, username, onActivate, onClose, onEdit, onCommunityChange, ...playback }: Props) {
  // Raising a window must not move its DOM node during a pointer gesture.
  const ranked = windows.map((entry, order) => ({ ...entry, order })).sort((a, b) => a.pack.id.localeCompare(b.pack.id));
  return <WindowLayer className="vault-theme">{ranked.map(({ pack, openRequest, order }) => <FloatingWindow key={pack.id} title={`${packTypeLabel(pack.kind)}: ${pack.title}`}
    active={order === windows.length - 1} order={order} openRequest={openRequest} onActivate={() => onActivate(pack.id)} onClose={() => onClose(pack.id)}
    className={`pack-window media-kind--${pack.kind}${pack.distribution === "alist" ? " pack-view--alist" : ""}`}>
    <PackView {...playback} pack={pack} owner={pack.ownerUsername === username}
      onEdit={() => { onClose(pack.id); onEdit(pack); }} onDelete={() => onClose(pack.id)}
      onRefresh={onCommunityChange} />
  </FloatingWindow>)}</WindowLayer>;
}
