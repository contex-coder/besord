// Besord — Neo-Brutalist theme constants
import { Platform } from "react-native";

export const colors = {
  bg: "#FFFFFF",
  bgSubtle: "#F4F4F5",
  text: "#000000",
  textSecondary: "#3F3F46",
  textInverse: "#FFFFFF",
  border: "#000000",
  aprovo: "#10B981",
  desaprovo: "#F43F5E",
  neutral: "#FACC15",
  shadow: "#000000",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// A reusable "brutalist" shadow offset — no deprecated props
export const brutalShadow = Platform.select({
  web: {
    boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
  },
  default: {
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0.5, // iOS requires > 0 to render; 0.5 keeps the hard-edge look
    elevation: 6,
  },
});
