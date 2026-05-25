import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  PanResponder,
  TouchableOpacity,
  View,
} from "react-native";
import { t } from "../../utils/translations";
import { GlowButton } from "../GlowButton";
import { Text } from "../Text";
import { getStyles } from "./styles";
import { TutorialOverlayProps } from "./types/TutorialOverlayTypes";

const { width } = Dimensions.get("window");

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  showTutorial,
  theme,
  insets,
  onClose,
}) => {
  const styles = getStyles(theme, insets);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [dontShowAgainChecked, setDontShowAgainChecked] = useState(false);

  const tutorialOverlayOpacity = useRef(new Animated.Value(0)).current;
  const tutorialTranslateY = useRef(new Animated.Value(300)).current;
  const tutorialContentAnim = useRef(new Animated.Value(0)).current;
  const tutorialAnim = useRef(new Animated.Value(0)).current;

  // Pulse/float hand animations
  useEffect(() => {
    if (showTutorial) {
      // Entrance animation
      Animated.parallel([
        Animated.timing(tutorialOverlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(tutorialTranslateY, {
          toValue: 180,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(tutorialContentAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      const loopAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(tutorialAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(tutorialAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      );
      loopAnim.start();
      return () => loopAnim.stop();
    } else {
      tutorialAnim.setValue(0);
    }
  }, [showTutorial]);

  const animateCardPosition = (step: number) => {
    let target = 0;
    if (step === 0 || step === 1) {
      target = 180;
    } else if (step === 2 || step === 3) {
      target = -150;
    }

    Animated.timing(tutorialTranslateY, {
      toValue: target,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleNext = () => {
    if (tutorialStep < 4) {
      Animated.timing(tutorialContentAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        const nextStep = tutorialStep + 1;
        setTutorialStep(nextStep);
        animateCardPosition(nextStep);
        Animated.spring(tutorialContentAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      });
    } else {
      Animated.parallel([
        Animated.timing(tutorialOverlayOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(tutorialTranslateY, {
          toValue: 400,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose(dontShowAgainChecked);
      });
    }
  };

  const handlePrev = () => {
    if (tutorialStep > 0) {
      Animated.timing(tutorialContentAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        const prevStep = tutorialStep - 1;
        setTutorialStep(prevStep);
        animateCardPosition(prevStep);
        Animated.spring(tutorialContentAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const handleSkip = () => {
    Animated.parallel([
      Animated.timing(tutorialOverlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(tutorialTranslateY, {
        toValue: 400,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose(false);
    });
  };

  const handleNextRef = useRef(handleNext);
  const handlePrevRef = useRef(handlePrev);
  useEffect(() => {
    handleNextRef.current = handleNext;
    handlePrevRef.current = handlePrev;
  });

  const tutorialPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 30;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx } = gestureState;
        if (dx < -50) {
          if (handleNextRef.current) handleNextRef.current();
        } else if (dx > 50) {
          if (handlePrevRef.current) handlePrevRef.current();
        }
      },
    }),
  ).current;

  if (!showTutorial) return null;

  const stepsData = [
    {
      title: t("tutorialSwipeTitle"),
      desc: t("tutorialSwipeDesc"),
      icon: "swap-horizontal",
    },
    {
      title: t("tutorialZoomTitle"),
      desc: t("tutorialZoomDesc"),
      icon: "scan",
    },
    {
      title: t("tutorialSpeedTitle"),
      desc: t("tutorialSpeedDesc"),
      icon: "speedometer",
    },
    {
      title: t("tutorialControlsTitle"),
      desc: t("tutorialControlsDesc"),
      icon: "cog",
    },
    {
      title: t("tutorialReadyTitle"),
      desc: t("tutorialReadyDesc"),
      icon: "checkmark-circle",
    },
  ];

  const currentStepData = stepsData[tutorialStep];

  return (
    <Animated.View
      style={[
        styles.tutorialOverlay,
        { opacity: tutorialOverlayOpacity },
      ]}
    >
      {/* Render Highlights */}
      {tutorialStep === 0 && (
        <View style={styles.highlightRsvp}>
          <Animated.View
            style={[
              styles.tutorialHand,
              {
                transform: [
                  {
                    translateX: tutorialAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [-40, 40, -40],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name="hand-left" size={36} color={theme.accent} />
          </Animated.View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              width: "100%",
              paddingHorizontal: 20,
              position: "absolute",
              top: "40%",
            }}
          >
            <Animated.View
              style={{
                transform: [
                  {
                    translateX: tutorialAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -15],
                    }),
                  },
                ],
              }}
            >
              <Ionicons name="chevron-back" size={24} color={theme.accent} />
            </Animated.View>
            <Animated.View
              style={{
                transform: [
                  {
                    translateX: tutorialAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 15],
                    }),
                  },
                ],
              }}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={theme.accent}
              />
            </Animated.View>
          </View>
        </View>
      )}

      {tutorialStep === 1 && (
        <View style={styles.highlightRsvp}>
          <Animated.View
            style={[
              styles.tutorialHand,
              {
                transform: [
                  {
                    scale: tutorialAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1, 0.8, 1.1],
                    }),
                  },
                ],
                opacity: tutorialAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.6, 1, 0.6],
                }),
              },
            ]}
          >
            <Ionicons name="hand-left" size={36} color={theme.accent} />
          </Animated.View>
        </View>
      )}

      {tutorialStep === 2 && (
        <View style={[styles.highlightWpm, { left: width / 2 - 70 }]}>
          <Animated.View
            style={[
              styles.tutorialHand,
              {
                top: 30,
                transform: [
                  {
                    scale: tutorialAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1, 0.9, 1.1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name="hand-left" size={28} color={theme.accent} />
          </Animated.View>
        </View>
      )}

      {tutorialStep === 3 && (
        <>
          <View style={styles.highlightTopBar} />
          <View style={styles.highlightControls} />
        </>
      )}

      {/* Tutorial Instruction Card */}
      <Animated.View
        style={[
          styles.tutorialCardContainer,
          {
            transform: [{ translateY: tutorialTranslateY }],
          },
        ]}
        {...tutorialPanResponder.panHandlers}
      >
        <BlurView
          intensity={10}
          tint="default"
          experimentalBlurMethod="dimezisBlurView"
          style={styles.tutorialCardBlur}
        >
          <Animated.View
            style={[
              styles.tutorialCardInner,
              {
                opacity: tutorialContentAnim,
                transform: [
                  {
                    scale: tutorialContentAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {tutorialStep < 4 && (
              <TouchableOpacity
                style={styles.tutorialSkipButton}
                onPress={handleSkip}
              >
                <Text style={styles.tutorialSkipText}>
                  {t("tutorialSkipText")}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.tutorialHeaderIcon}>
              <Ionicons
                name={currentStepData.icon as any}
                size={36}
                color={theme.accent}
              />
            </View>

            <Text style={styles.tutorialTitle}>{currentStepData.title}</Text>
            <Text style={styles.tutorialText}>{currentStepData.desc}</Text>

            {/* Progress Dots */}
            <View style={styles.tutorialDotsContainer}>
              {stepsData.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.tutorialDot,
                    i === tutorialStep
                      ? styles.tutorialDotActive
                      : styles.tutorialDotInactive,
                  ]}
                />
              ))}
            </View>

            {/* Don't Show Again Checkbox */}
            {tutorialStep === 4 && (
              <TouchableOpacity
                style={styles.checkboxContainer}
                activeOpacity={0.8}
                onPress={() => setDontShowAgainChecked(!dontShowAgainChecked)}
              >
                <View
                  style={[
                    styles.checkbox,
                    dontShowAgainChecked && styles.checkboxChecked,
                  ]}
                >
                  {dontShowAgainChecked && (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={theme.textOnAccent}
                    />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  {t("tutorialCheckboxLabel")}
                </Text>
              </TouchableOpacity>
            )}

            <GlowButton
              theme={theme}
              variant="pill"
              size={48}
              width="100%"
              glowType="button"
              glowWidth="110%"
              glowHeight={82}
              containerStyle={{ width: "100%", marginTop: 10 }}
              buttonStyle={styles.tutorialButton}
              onPress={handleNext}
            >
              <Text style={styles.tutorialButtonText}>
                {tutorialStep === 4
                  ? t("tutorialStartReading")
                  : t("tutorialNext")}
              </Text>
            </GlowButton>
          </Animated.View>
        </BlurView>
      </Animated.View>
    </Animated.View>
  );
};

export default TutorialOverlay;
