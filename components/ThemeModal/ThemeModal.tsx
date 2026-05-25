import React from "react";
import { FlatList, TouchableOpacity, View } from "react-native";
import { t } from "../../utils/translations";
import { Text } from "../Text";
import { getStyles } from "./styles";
import { ThemeModalProps } from "./types/ThemeModalTypes";

const HUES = [0, 30, 140, 210, 280, 330];

export const ThemeModal: React.FC<ThemeModalProps> = ({
  showThemeModal,
  theme,
  themeHue,
  setThemeHue,
  onClose,
}) => {
  const styles = getStyles(theme);

  if (!showThemeModal) return null;

  return (
    <TouchableOpacity
      style={styles.modalOverlay}
      activeOpacity={1}
      onPress={onClose}
    >
      <View style={styles.themeModalContent}>
        <Text style={styles.themeModalTitle}>{t("selectAccentColor")}</Text>
        <View style={styles.hueGrid}>
          {HUES.map((h) => (
            <TouchableOpacity
              key={h}
              style={[
                styles.hueCircle,
                {
                  backgroundColor: `hsl(${h}, 100%, 63%)`,
                  borderWidth: themeHue === h ? 3 : 0,
                },
              ]}
              onPress={() => setThemeHue(h)}
            />
          ))}
        </View>
        <Text
          style={[styles.themeModalTitle, { marginTop: 20, fontSize: 16 }]}
        >
          {t("customSpectrum")}
        </Text>
        <View style={{ width: "100%", height: 60 }}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={Array.from({ length: 36 })}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ index }) => {
              const h = index * 10;
              return (
                <TouchableOpacity
                  style={{
                    width: 25,
                    height: 50,
                    backgroundColor: `hsl(${h}, 100%, 63%)`,
                    borderRadius: 6,
                    marginHorizontal: 4,
                    borderWidth: Math.abs(themeHue - h) <= 5 ? 2 : 0,
                    borderColor: "#fff",
                  }}
                  onPress={() => setThemeHue(h)}
                />
              );
            }}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ThemeModal;
