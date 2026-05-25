import { StyleSheet } from "react-native";

export const getStyles = () =>
  StyleSheet.create({
    backgroundContainer: {
      ...StyleSheet.absoluteFillObject,
      overflow: "hidden",
      zIndex: -1,
    },
  });
