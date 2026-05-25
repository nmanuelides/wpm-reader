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
    themeModalContainer: {
      width: "80%",
      alignSelf: "center",
      elevation: 10,
      shadowColor: "#000",
      shadowOpacity: 0.5,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
    },
    themeModalBlur: {
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: `hsla(${theme.hue}, 95%, 85%, 0.24)`,
      borderBottomColor: `hsla(${theme.hue}, 90%, 80%, 0.14)`,
      backgroundColor: `hsla(${theme.hue}, 54%, 9%, 0.75)`,
    },
    themeModalInner: {
      padding: 24,
      alignItems: "center",
      width: "100%",
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
