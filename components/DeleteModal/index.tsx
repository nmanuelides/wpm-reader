import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import { Image, TouchableOpacity, View } from "react-native";
import { BUTTON_GLOW_PNG } from "../../utils/glowImages";
import { t } from "../../utils/translations";
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
              <View style={styles.modalButtonWrapper}>
                <Image
                  source={{ uri: BUTTON_GLOW_PNG }}
                  style={[
                    styles.modalButtonGlow,
                    {
                      width: 150,
                      height: 64,
                      tintColor: `hsl(${theme.hue}, 100%, 65%)`,
                    },
                  ]}
                  resizeMode="stretch"
                />
                <TouchableOpacity
                  style={styles.modalCancelButtonGlass}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelButtonText}>{t("cancel")}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalButtonWrapper}>
                <Image
                  source={{ uri: BUTTON_GLOW_PNG }}
                  style={[
                    styles.modalButtonGlow,
                    {
                      width: 150,
                      height: 64,
                      tintColor: `hsl(${theme.hue}, 100%, 65%)`,
                    },
                  ]}
                  resizeMode="stretch"
                />
                <TouchableOpacity
                  style={styles.modalDeleteButtonGlass}
                  onPress={onDelete}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalDeleteButtonText}>
                    {t("delete")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </BlurView>
      </View>
    </TouchableOpacity>
  );
};

export default DeleteModal;
