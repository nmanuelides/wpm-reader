import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Animated,
  FlatList,
  Image,
  Pressable,
  StatusBar,
  TouchableOpacity,
  View,
} from "react-native";
import { BUTTON_GLOW_PNG } from "../../utils/glowImages";
import { t } from "../../utils/translations";
import { BookCardItem } from "../BookCardItem";
import { LibraryBackground } from "../LibraryBackground";
import { Text } from "../Text";
import { getStyles } from "./styles";
import { LibraryViewProps } from "./types/LibraryViewTypes";

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  theme,
  themeHue,
  activeMenuBookId,
  setActiveMenuBookId,
  menuOverlapsIsland,
  openBook,
  pickCustomCover,
  deleteBook,
  handleImport,
  setShowThemeModal,
  floatingIslandAnim,
  insets,
}) => {
  const styles = getStyles(theme, insets);

  return (
    <SafeAreaView style={styles.homeContainer}>
      <StatusBar barStyle="light-content" />
      <LibraryBackground themeHue={themeHue} />
      <Pressable style={{ flex: 1 }} onPress={() => setActiveMenuBookId(null)}>
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={[styles.headerLogo, { tintColor: theme.accent }]}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>Centread</Text>
          </View>
        </View>

        {books.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={64} color={theme.textMuted} />
            <Text style={styles.emptyText}>{t("emptyLibraryText")}</Text>
            <Text style={styles.emptySubText}>{t("emptyLibrarySubText")}</Text>
          </View>
        ) : (
          <FlatList
            data={books}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={[styles.gridList, { paddingBottom: 100 }]}
            onScrollBeginDrag={() => setActiveMenuBookId(null)}
            renderItem={({ item }) => (
              <BookCardItem
                item={item}
                theme={theme}
                openBook={openBook}
                pickCustomCover={pickCustomCover}
                deleteBook={deleteBook}
                activeMenuBookId={activeMenuBookId}
                setActiveMenuBookId={setActiveMenuBookId}
                insets={insets}
              />
            )}
          />
        )}
      </Pressable>

      {/* Bottom Floating Island Dock */}
      <Animated.View
        style={[
          styles.floatingIslandContainer,
          {
            opacity: floatingIslandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 1],
            }),
            transform: [
              {
                translateY: floatingIslandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [75 + (insets?.bottom || 0), 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents={activeMenuBookId && menuOverlapsIsland ? "none" : "auto"}
      >
        <BlurView
          intensity={10}
          tint="default"
          experimentalBlurMethod="dimezisBlurView"
          style={styles.floatingIslandBlur}
        >
          <View style={styles.floatingIslandInner}>
            <View style={styles.islandLeft}>
              <View style={styles.islandDot} />
              <Text style={styles.islandCount}>
                {books.length} {books.length === 1 ? t("book") : t("books")}
              </Text>
            </View>

            <View style={styles.islandRight}>
              {/* Theme Button with Halo Glow */}
              <View style={styles.buttonWrapper}>
                <Image
                  source={{ uri: BUTTON_GLOW_PNG }}
                  style={[
                    styles.buttonGlow,
                    {
                      width: 76,
                      height: 76,
                      tintColor: `hsl(${theme.hue}, 100%, 65%)`,
                    },
                  ]}
                  resizeMode="stretch"
                />
                <TouchableOpacity
                  style={styles.islandButton}
                  onPress={() => setShowThemeModal(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="color-palette-outline"
                    size={22}
                    color={theme.buttonText}
                  />
                </TouchableOpacity>
              </View>

              {/* Import Button with Stretched Halo Glow */}
              <View style={[styles.buttonWrapper, { marginLeft: 16 }]}>
                <Image
                  source={{ uri: BUTTON_GLOW_PNG }}
                  style={[
                    styles.buttonGlow,
                    {
                      width: 150,
                      height: 76,
                      tintColor: `hsl(${theme.hue}, 100%, 65%)`,
                    },
                  ]}
                  resizeMode="stretch"
                />
                <TouchableOpacity
                  style={styles.islandImportButton}
                  onPress={handleImport}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-outline" size={20} color={theme.buttonText} />
                  <Text style={styles.islandImportButtonText}>{t("importBook")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </BlurView>
      </Animated.View>
    </SafeAreaView>
  );
};

export default LibraryView;
