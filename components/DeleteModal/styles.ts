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
    deleteModalContainer: {
      width: "85%",
      alignSelf: "center",
      elevation: 10,
      shadowColor: "#000",
      shadowOpacity: 0.5,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
    },
    deleteModalBlur: {
      borderRadius: 20,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: `hsla(${theme.hue}, 95%, 85%, 0.24)`,
      borderBottomColor: `hsla(${theme.hue}, 90%, 80%, 0.14)`,
      backgroundColor: `hsla(${theme.hue}, 54%, 9%, 0.75)`,
    },
    deleteModalInner: {
      padding: 24,
      alignItems: "center",
      width: "100%",
    },
    deleteModalTitle: {
      color: "#fff",
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 10,
      textAlign: "center",
    },
    deleteModalSub: {
      color: theme.textLight,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 20,
    },
    modalButtonGroup: {
      flexDirection: "row",
      width: "100%",
      gap: 12,
    },
    modalCancelButtonGlass: {
      width: "100%",
      height: 48,
      borderRadius: 24,
      backgroundColor: "transparent",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: `hsla(${theme.hue}, 100%, 80%, 0.12)`,
      borderTopColor: `hsla(${theme.hue}, 100%, 85%, 0.25)`,
    },
    modalCancelButtonText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "600",
    },
    modalDeleteButtonGlass: {
      width: "100%",
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.buttonBg,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: `hsla(${theme.hue}, 100%, 80%, 0.12)`,
      borderTopColor: `hsla(${theme.hue}, 100%, 85%, 0.25)`,
    },
    modalDeleteButtonText: {
      color: theme.buttonText,
      fontSize: 14,
      fontWeight: "bold",
    },
  });
