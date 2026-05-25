import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Image, TouchableOpacity, View } from "react-native";
import { t } from "../../utils/translations";
import { GlowButton } from "../GlowButton";
import { Text } from "../Text";
import { getStyles } from "./styles";
import { BookCardItemProps } from "./types/BookCardItemTypes";

export const BookCardItem: React.FC<BookCardItemProps> = ({
  item,
  theme,
  openBook,
  pickCustomCover,
  deleteBook,
  activeMenuBookId,
  setActiveMenuBookId,
  insets,
}) => {
  const styles = getStyles(theme);
  const isMenuOpen = activeMenuBookId === item.id;
  const menuAnim = useRef(new Animated.Value(0)).current;
  const [shouldRenderMenu, setShouldRenderMenu] = useState(isMenuOpen);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    if (isMenuOpen) {
      setShouldRenderMenu(true);
      Animated.spring(menuAnim, {
        toValue: 1,
        friction: 6, // clean bounce
        tension: 75, // faster spring response
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(menuAnim, {
        toValue: 0,
        friction: 6,
        tension: 75,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShouldRenderMenu(false);
        }
      });
    }
  }, [isMenuOpen]);

  const handleLongPress = () => {
    if (isMenuOpen) {
      setActiveMenuBookId(null);
    } else {
      if (cardRef.current) {
        cardRef.current.measureInWindow((x, pageY, cardWidth, cardHeight) => {
          if (pageY === undefined || cardHeight === undefined) {
            setActiveMenuBookId(item.id, true);
            return;
          }
          const screenHeight = Dimensions.get("window").height;
          const cardBottom = pageY + cardHeight;
          const menuBottom = cardBottom + 62; // Menu extends 62px below card
          const threshold = screenHeight - (insets?.bottom || 0) - 110;
          const overlaps = menuBottom > threshold;
          setActiveMenuBookId(item.id, overlaps);
        });
      } else {
        setActiveMenuBookId(item.id, false);
      }
    }
  };

  const menuScale = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  const menuTranslateY = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  const menuOpacity = menuAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  return (
    <View
      ref={cardRef}
      style={[styles.bookCardContainer, shouldRenderMenu && { zIndex: 999 }]}
    >
      <TouchableOpacity
        style={styles.bookCard}
        onPress={() => {
          if (activeMenuBookId) {
            setActiveMenuBookId(null);
          } else {
            openBook(item);
          }
        }}
        onLongPress={handleLongPress}
        activeOpacity={0.9}
      >
        <View style={styles.bookCardInner}>
          {item.coverImage ? (
            <View style={styles.coverImageContainer}>
              <Image
                source={{ uri: item.coverImage }}
                style={styles.coverImage}
                resizeMode="cover"
              />
              <View style={styles.coverTitleOverlay}>
                <Text style={styles.coverTitleOverlayText} numberOfLines={1}>
                  {item.name.replace(/\.[^/.]+$/, "")}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="document-text" size={48} color={theme.textDark} />
              <Text style={styles.bookCardTitle} numberOfLines={3}>
                {item.name.replace(/\.[^/.]+$/, "")}
              </Text>
              <Text style={styles.uploadCoverHint}>
                {t("longPressHint")}
              </Text>
            </View>
          )}
          <View style={styles.progressBadge}>
            <Text style={styles.progressBadgeText}>
              {item.totalWords > 0
                ? `${Math.round((item.progress / item.totalWords) * 100)}%`
                : item.progress > 0
                  ? t("resuming")
                  : t("newBadge")}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {shouldRenderMenu && (
        <Animated.View
          style={[
            styles.bookCardMenuContainer,
            {
              opacity: menuOpacity,
              transform: [{ scale: menuScale }, { translateY: menuTranslateY }],
            },
          ]}
        >
          <BlurView
            intensity={10}
            tint="default"
            experimentalBlurMethod="dimezisBlurView"
            style={styles.bookCardMenuBlur}
          >
            <View style={styles.bookCardMenuInner}>
              <GlowButton
                theme={theme}
                variant="circle"
                size={38}
                glowType="mini"
                bgType="transparent"
                buttonStyle={styles.menuOptionButtonTransparent}
                onPress={() => {
                  setActiveMenuBookId(null);
                  pickCustomCover(item.id);
                }}
              >
                <Ionicons name="image-outline" size={20} color="#ffffff" />
              </GlowButton>

              <GlowButton
                theme={theme}
                variant="circle"
                size={38}
                glowType="mini"
                bgType="glass"
                buttonStyle={styles.menuOptionButtonGlass}
                onPress={() => {
                  setActiveMenuBookId(null);
                  deleteBook(item.id);
                }}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color={theme.buttonText}
                />
              </GlowButton>
            </View>
          </BlurView>
        </Animated.View>
      )}
    </View>
  );
};

export default BookCardItem;
