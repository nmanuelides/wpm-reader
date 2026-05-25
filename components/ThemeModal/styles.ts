import { StyleSheet } from "react-native";
import { ThemeType } from "../../types/global";

export const getStyles = (theme: ThemeType) =>
  StyleSheet.create({
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 100,
    },
    themeModalContent: {
      backgroundColor: theme.surface,
      padding: 24,
      borderRadius: 20,
      width: "80%",
      alignItems: "center",
    },
    themeModalTitle: {
      color: "#fff",
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 20,
    },
    hueGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
    },
    hueCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      margin: 8,
      borderColor: "#fff",
    },
  });
