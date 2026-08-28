import type { ImageSourcePropType } from "react-native";
import { AVATAR_COUNT } from "@testx/shared";

/**
 * Bundled avatar presets. require() calls must be static so Metro can resolve
 * them at build time, hence the explicit list rather than a loop.
 *
 * These are placeholder art meant to be replaced by designed avatars; only the
 * files change, not the avatarId contract.
 */
export const AVATARS: ImageSourcePropType[] = [
  require("../../assets/avatars/avatar-0.png"),
  require("../../assets/avatars/avatar-1.png"),
  require("../../assets/avatars/avatar-2.png"),
  require("../../assets/avatars/avatar-3.png"),
  require("../../assets/avatars/avatar-4.png"),
  require("../../assets/avatars/avatar-5.png"),
  require("../../assets/avatars/avatar-6.png"),
  require("../../assets/avatars/avatar-7.png"),
  require("../../assets/avatars/avatar-8.png"),
  require("../../assets/avatars/avatar-9.png"),
];

if (AVATARS.length !== AVATAR_COUNT) {
  throw new Error(
    `Bundled avatars (${AVATARS.length}) do not match AVATAR_COUNT (${AVATAR_COUNT})`
  );
}

export function avatarSource(avatarId: number | null | undefined): ImageSourcePropType | null {
  if (avatarId == null) return null;
  return AVATARS[avatarId] ?? null;
}
