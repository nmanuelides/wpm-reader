import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import { Image, TouchableOpacity, View } from "react-native";
import { t } from "../../utils/translations";
import { GlowButton } from "../GlowButton/GlowButton";
import { Text } from "../Text";
import { getStyles } from "./styles";
import { DeleteModalProps } from "./types/DeleteModalTypes";

export const DeleteModal: React.FC<DeleteModalProps> = ({
  bookToDelete,
  theme,
  onCancel,
  onDelete,
}) => {
  const styles = getStyles(theme);

  if (!bookToDelete) return null;

  return (
    <TouchableOpacity
      style={styles.modalOverlay}
      activeOpacity={1}
      onPress={onCancel}
    >
      <View style={styles.deleteModalContainer}>
        <BlurView
          intensity={10}
          tint="default"
          experimentalBlurMethod="dimezisBlurView"
          style={styles.deleteModalBlur}
        >
          <View style={styles.deleteModalInner}>
            <Ionicons
              name="trash-bin-outline"
              size={48}
              color={theme.accent}
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.deleteModalTitle}>{t("deleteBookTitle")}</Text>
            <Text style={styles.deleteModalSub}>
              {t("deleteBookConfirm")}
              {bookToDelete.name.replace(/\.[^/.]+$/, "")}
              {t("deleteBookSubSuffix")}
            </Text>

            <View style={styles.modalButtonGroup}>
              <GlowButton
                theme={theme}
                variant="pill"
                size={48}
                width="100%"
                glowType="button"
                bgType="transparent"
                containerStyle={{ flex: 1 }}
                buttonStyle={styles.modalCancelButtonGlass}
                onPress={onCancel}
              >
                <Text style={styles.modalCancelButtonText}>{t("cancel")}</Text>
              </GlowButton>

              <GlowButton
                theme={theme}
                variant="pill"
                size={48}
                width="100%"
                glowType="button"
                bgType="delete"
                containerStyle={{ flex: 1 }}
                buttonStyle={styles.modalDeleteButtonGlass}
                onPress={onDelete}
              >
                <Text style={styles.modalDeleteButtonText}>
                  {t("delete")}
                </Text>
              </GlowButton>
            </View>
          </View>
        </BlurView>
      </View>
    </TouchableOpacity>
  );
};

export default DeleteModal;
