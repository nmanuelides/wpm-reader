import { StyleSheet } from "react-native";

export const getStyles = () =>
  StyleSheet.create({
    splashContainer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 9999,
      backgroundColor: "#120F16",
    },
    splashInner: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
  });
