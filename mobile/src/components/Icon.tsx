import React from "react";
import { type ColorValue, type StyleProp, type TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * App icon set mapped to Ionicons (crisp vector glyphs, consistent weight) so
 * the UI looks professional across devices. Call sites only depend on these
 * semantic names, so the underlying glyph can change without touching screens.
 */
export type IconName =
  | "home"
  | "chat"
  | "sos"
  | "report"
  | "shield"
  | "person"
  | "time"
  | "search"
  | "check";

const MAP: Record<IconName, keyof typeof Ionicons.glyphMap> = {
  home: "home",
  chat: "chatbubbles",
  sos: "alert-circle",
  report: "document-text",
  shield: "shield-checkmark",
  person: "person",
  time: "time",
  search: "search",
  check: "checkmark-circle",
};

export function Icon({
  name,
  size = 20,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<TextStyle>;
}) {
  return <Ionicons name={MAP[name]} size={size} color={color as string} style={style} />;
}
