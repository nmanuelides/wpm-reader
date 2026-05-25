import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  PanResponder,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { GlowButton } from "../GlowButton/GlowButton";
import { getMiddleIndex } from "../../utils/parsers";
import { t } from "../../utils/translations";
import { Text } from "../Text";
import { TutorialOverlay } from "../TutorialOverlay/TutorialOverlay";
import { getStyles } from "./styles";
import { ReaderViewProps } from "./types/ReaderViewTypes";

const { width } = Dimensions.get("window");

export const ReaderView: React.FC<ReaderViewProps> = ({
  currentBook,
  theme,
  words,
  dialogueFlags,
  chapters,
  wordIndex,
  setWordIndex,
  favoriteWpm,
  setFavoriteWpm,
  wpm,
  setWpm,
  closeBook,
  insets,
  showTutorial,
  setShowTutorial,
  tutorialSeen,
  setTutorialSeen,
}) => {
  const styles = getStyles(theme, insets);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fontSize, setFontSize] = useState(48); // Start with a large font

  const playInterval = useRef<any>(null);
  const lastTapRef = useRef(0);
  const wpmAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const restoreRingAnim = useRef(new Animated.Value(0)).current;
  const [showRing, setShowRing] = useState(false);
  const [showRestoreRing, setShowRestoreRing] = useState(false);
  const wordFadeAnim = useRef(new Animated.Value(0)).current;
  const uiOpacityAnim = useRef(new Animated.Value(1)).current;

  // Chapter Transition State
  const [chapterPopup, setChapterPopup] = useState({
    visible: false,
    title: "",
  });
  const chapterPopupAnim = useRef(new Animated.Value(0)).current;
  const prevChapterRef = useRef<any>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Keep awake and UI Dimming
  const isPlayingRef = useRef(isPlaying);
  const wakeUpTimeoutRef = useRef<any>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (wakeUpTimeoutRef.current) clearTimeout(wakeUpTimeoutRef.current);

    Animated.timing(uiOpacityAnim, {
      toValue: isPlaying ? 0.15 : 1,
      duration: isPlaying ? 1000 : 150, // Dim slowly, brighten fast
      useNativeDriver: true,
    }).start();

    if (isPlaying) {
      activateKeepAwakeAsync().catch(() => {});
    } else {
      deactivateKeepAwake();
    }
  }, [isPlaying]);

  const wakeUpUi = () => {
    if (!isPlayingRef.current) return;

    if (wakeUpTimeoutRef.current) clearTimeout(wakeUpTimeoutRef.current);

    Animated.timing(uiOpacityAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();

    wakeUpTimeoutRef.current = setTimeout(() => {
      if (isPlayingRef.current) {
        Animated.timing(uiOpacityAnim, {
          toValue: 0.15,
          duration: 1000,
          useNativeDriver: true,
        }).start();
      }
    }, 3000);
  };

  // Chapter Transitions
  useEffect(() => {
    if (chapters.length === 0 || words.length === 0) return;

    let currentCh = chapters[0];
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (wordIndex >= chapters[i].index) {
        currentCh = chapters[i];
        break;
      }
    }

    if (
      prevChapterRef.current &&
      prevChapterRef.current.index !== currentCh.index &&
      isPlaying &&
      !isTransitioning
    ) {
      // Pause playback and start transition
      setIsPlaying(false);
      setIsTransitioning(true);

      // Step back to the last word of the previous chapter to fade it out
      const lastWordOfPrev = Math.max(0, currentCh.index - 1);
      setWordIndex(lastWordOfPrev);

      // Keep ref updated to the new chapter so it doesn't trigger again
      prevChapterRef.current = currentCh;

      Animated.timing(wordFadeAnim, {
        toValue: 0,
        duration: 1600, // Make fade out last twice as long
        useNativeDriver: true,
      }).start(() => {
        // Move to the first word of the new chapter (it will be invisible)
        setWordIndex(currentCh.index);

        setChapterPopup({ visible: true, title: currentCh.title });
        chapterPopupAnim.setValue(0);

        Animated.timing(chapterPopupAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          setChapterPopup({ visible: false, title: "" });
        });

        // 1.5s total delay before the new word starts appearing
        // This overlaps perfectly with the chapter title fading out
        setTimeout(() => {
          Animated.timing(wordFadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }).start(() => {
            setIsTransitioning(false);
            setIsPlaying(true);
          });
        }, 1500);
      });
      return;
    }

    if (!isTransitioning) {
      prevChapterRef.current = currentCh;
    }
  }, [wordIndex, chapters, words.length, isPlaying, isTransitioning]);

  useEffect(() => {
    if (currentBook) {
      wordFadeAnim.setValue(0);
      Animated.timing(wordFadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }
  }, [currentBook]);

  // RSVP Interval
  useEffect(() => {
    if (isPlaying && words.length > 0) {
      const msPerWord = (60 / wpm) * 1000;
      playInterval.current = setInterval(() => {
        setWordIndex((prev) => {
          if (prev >= words.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, msPerWord);
    } else {
      if (playInterval.current) clearInterval(playInterval.current);
    }

    return () => {
      if (playInterval.current) clearInterval(playInterval.current);
    };
  }, [isPlaying, wpm, words.length]);

  const wordsLengthRef = useRef(0);
  useEffect(() => {
    wordsLengthRef.current = words.length;
  }, [words.length]);

  const scrubInterval = useRef<any>(null);
  const currentScrubSpeed = useRef(0);
  const [scrubStatus, setScrubStatus] = useState({
    active: false,
    direction: 0,
    level: 0,
  });
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Context View state
  const [showContext, setShowContext] = useState(false);
  const showContextRef = useRef(false);
  const contextAnim = useRef(new Animated.Value(0)).current;
  const wordWrapperAnim = useRef(new Animated.Value(1)).current;
  const contextTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (scrubStatus.active) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.2,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [scrubStatus.active]);

  const updateScrubInterval = () => {
    if (scrubInterval.current) {
      clearInterval(scrubInterval.current);
      scrubInterval.current = null;
    }

    const speed = currentScrubSpeed.current;
    const absSpeed = Math.abs(speed);

    if (absSpeed < 30) {
      setScrubStatus({ active: false, direction: 0, level: 0 });
      return; // Deadzone
    }

    let level = 1;
    if (absSpeed > 120) level = 3;
    else if (absSpeed > 60) level = 2;

    setScrubStatus({
      active: true,
      direction: speed > 0 ? 1 : -1,
      level,
    });

    // max speed 20ms, starting from ~250ms
    const speedMs = Math.max(20, 300 - absSpeed * 1.5);

    scrubInterval.current = setInterval(() => {
      setWordIndex((prev) => {
        if (speed > 0) {
          return prev >= wordsLengthRef.current - 1 ? prev : prev + 1;
        } else {
          return prev <= 0 ? 0 : prev - 1;
        }
      });
    }, speedMs);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsPlaying(false);
        currentScrubSpeed.current = 0;
        setScrubStatus({ active: false, direction: 0, level: 0 });

        contextTimeoutRef.current = setTimeout(() => {
          if (currentScrubSpeed.current === 0) {
            showContextRef.current = true;
            setShowContext(true);
            Animated.parallel([
              Animated.spring(contextAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
              }),
              Animated.timing(wordWrapperAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
              }),
            ]).start();
          }
        }, 350); // 350ms long press
      },
      onPanResponderMove: (evt, gestureState) => {
        const { dx } = gestureState;

        // If context is already showing, ignore movement so they can read
        if (showContextRef.current) return;

        // If they move significantly before context shows up, cancel the long press
        if (Math.abs(dx) > 10) {
          if (contextTimeoutRef.current) {
            clearTimeout(contextTimeoutRef.current);
            contextTimeoutRef.current = null;
          }
        }

        const stepDx = Math.round(dx / 20) * 20;
        if (stepDx !== currentScrubSpeed.current) {
          currentScrubSpeed.current = stepDx;
          updateScrubInterval();
        }
      },
      onPanResponderRelease: () => {
        if (contextTimeoutRef.current) clearTimeout(contextTimeoutRef.current);
        if (showContextRef.current) {
          showContextRef.current = false;
          Animated.parallel([
            Animated.timing(contextAnim, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(wordWrapperAnim, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start(() => setShowContext(false));
        }
        currentScrubSpeed.current = 0;
        updateScrubInterval();
      },
      onPanResponderTerminate: () => {
        if (contextTimeoutRef.current) clearTimeout(contextTimeoutRef.current);
        if (showContextRef.current) {
          showContextRef.current = false;
          Animated.parallel([
            Animated.timing(contextAnim, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(wordWrapperAnim, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start(() => setShowContext(false));
        }
        currentScrubSpeed.current = 0;
        updateScrubInterval();
      },
    }),
  ).current;

  const increaseWpm = () => {
    wakeUpUi();
    setWpm((prev) => prev + 10);
  };
  const decreaseWpm = () => {
    wakeUpUi();
    setWpm((prev) => (prev > 10 ? prev - 10 : prev));
  };

  const increaseFontSize = () => {
    wakeUpUi();
    setFontSize((prev) => prev + 4);
  };
  const decreaseFontSize = () => {
    wakeUpUi();
    setFontSize((prev) => (prev > 16 ? prev - 4 : prev));
  };

  const handleWpmPress = () => {
    wakeUpUi();
    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current < 300) {
      // Double tap
      setWpm(favoriteWpm);
      lastTapRef.current = 0;

      // Animate restore (implosion)
      setShowRestoreRing(true);
      restoreRingAnim.setValue(0);
      Animated.timing(restoreRingAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setShowRestoreRing(false));

      // Button absorbs the ring
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(wpmAnim, {
            toValue: 0.85,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.spring(wpmAnim, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
          }),
        ]).start();
      }, 250);
    } else {
      lastTapRef.current = now;
    }
  };

  const handleWpmLongPress = () => {
    wakeUpUi();
    setFavoriteWpm(wpm);

    // Animate
    Animated.sequence([
      Animated.timing(wpmAnim, {
        toValue: 1.15,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(wpmAnim, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    setShowRing(true);
    ringAnim.setValue(0);
    Animated.timing(ringAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start(() => setShowRing(false));
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const nextChapter = () => {
    wakeUpUi();
    const nextMarker = chapters.find((marker) => marker.index > wordIndex);
    if (nextMarker !== undefined) {
      setWordIndex(nextMarker.index);
    }
  };

  const prevChapter = () => {
    wakeUpUi();
    let target = 0;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (chapters[i].index <= wordIndex) {
        if (wordIndex - chapters[i].index < 10 && i > 0) {
          target = chapters[i - 1].index; // go to previous if we are exactly at or very close to start
        } else {
          target = chapters[i].index; // go to start of current chapter
        }
        break;
      }
    }
    setWordIndex(target);
  };

  const handleCloseTutorial = (seen: boolean) => {
    setShowTutorial(false);
    if (seen) {
      setTutorialSeen(true);
    }
  };

  const currentWord = words[wordIndex] || "";
  const midIdx = getMiddleIndex(currentWord);
  const leftPart = currentWord.slice(0, midIdx);
  const centerLetter = currentWord.charAt(midIdx);
  const rightPart = currentWord.slice(midIdx + 1);

  const isDialogue = !!dialogueFlags[wordIndex];
  const spaceFontSize = fontSize * 0.15;
  const spaceWidth = isDialogue ? spaceFontSize * 0.6 : 0;
  const guideOffset = fontSize * 0.55 + 16;

  // Find current chapter
  const currentChapter =
    [...chapters].reverse().find((marker) => marker.index <= wordIndex) ||
    chapters[0];
  const chapterTitle = currentChapter ? currentChapter.title : "";

  return (
    <SafeAreaView style={styles.readerContainer}>
      <StatusBar hidden />

      {/* Top Bar */}
      <Animated.View style={[styles.topBar, { opacity: uiOpacityAnim }]}>
        <View style={styles.leftSideArea}>
          <BlurView
            intensity={10}
            tint="default"
            experimentalBlurMethod="dimezisBlurView"
            style={styles.miniIslandBlur}
          >
            <View style={styles.miniIslandInner}>
              <GlowButton
                theme={theme}
                variant="circle"
                size={36}
                glowType="mini"
                buttonStyle={styles.miniIslandButton}
                onPress={closeBook}
              >
                <Ionicons name="arrow-back" size={20} color={theme.buttonText} />
              </GlowButton>
            </View>
          </BlurView>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {currentBook.name.replace(/\.[^/.]+$/, "")}
          </Text>
          {chapterTitle ? (
            <Text style={styles.chapterTitle} numberOfLines={1}>
              {chapterTitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.fontControls}>
          <BlurView
            intensity={10}
            tint="default"
            experimentalBlurMethod="dimezisBlurView"
            style={styles.miniIslandBlur}
          >
            <View style={styles.miniIslandInner}>
              <GlowButton
                theme={theme}
                variant="circle"
                size={36}
                glowType="mini"
                buttonStyle={styles.miniIslandButton}
                onPress={decreaseFontSize}
              >
                <Text style={styles.miniIslandButtonText}>A-</Text>
              </GlowButton>
              <GlowButton
                theme={theme}
                variant="circle"
                size={36}
                glowType="mini"
                containerStyle={{ marginLeft: 8 }}
                buttonStyle={styles.miniIslandButton}
                onPress={increaseFontSize}
              >
                <Text style={styles.miniIslandButtonText}>A+</Text>
              </GlowButton>
            </View>
          </BlurView>
        </View>
      </Animated.View>

      {/* RSVP Display */}
      <View
        style={styles.rsvpContainer}
        {...panResponder.panHandlers}
        clipChildren={false}
      >
        {/* Guide lines for the eye */}
        <View
          style={[
            styles.guideLineTop,
            { transform: [{ translateY: -guideOffset }] },
          ]}
        />
        <View
          style={[
            styles.guideLineBottom,
            { transform: [{ translateY: guideOffset }] },
          ]}
        />

        {/* Scrub Indicators */}
        {scrubStatus.active && (
          <Animated.View
            style={[styles.scrubIndicatorContainer, { opacity: pulseAnim }]}
          >
            {scrubStatus.direction === -1 ? (
              <>
                <Ionicons
                  name="chevron-back"
                  size={80}
                  color={theme.accent}
                  style={styles.scrubArrow}
                />
                {scrubStatus.level >= 2 && (
                  <Ionicons
                    name="chevron-back"
                    size={80}
                    color={theme.accent}
                    style={styles.scrubArrow}
                  />
                )}
                {scrubStatus.level >= 3 && (
                  <Ionicons
                    name="chevron-back"
                    size={80}
                    color={theme.accent}
                    style={styles.scrubArrow}
                  />
                )}
              </>
            ) : (
              <>
                {scrubStatus.level >= 3 && (
                  <Ionicons
                    name="chevron-forward"
                    size={80}
                    color={theme.accent}
                    style={styles.scrubArrow}
                  />
                )}
                {scrubStatus.level >= 2 && (
                  <Ionicons
                    name="chevron-forward"
                    size={80}
                    color={theme.accent}
                    style={styles.scrubArrow}
                  />
                )}
                <Ionicons
                  name="chevron-forward"
                  size={80}
                  color={theme.accent}
                  style={styles.scrubArrow}
                />
              </>
            )}
          </Animated.View>
        )}

        {/* Chapter Popup Animation (outside of word fade) */}
        {chapterPopup.visible && (
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                justifyContent: "center",
                alignItems: "center",
                pointerEvents: "none",
                zIndex: 20,
                opacity: chapterPopupAnim.interpolate({
                  inputRange: [0, 0.2, 0.8, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateY: chapterPopupAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -150],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text
              style={{
                color: theme.textLight,
                fontSize: 24,
                fontWeight: "bold",
                textAlign: "center",
                textShadowColor: "rgba(0,0,0,0.35)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }}
            >
              {chapterPopup.title}
            </Text>
          </Animated.View>
        )}

        <Animated.View
          style={{ opacity: wordFadeAnim, flex: 1, justifyContent: "center" }}
          clipChildren={false}
        >
          {showContext && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.contextContainer,
                {
                  opacity: contextAnim,
                  transform: [
                    {
                      scale: contextAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [2.5, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text
                style={[
                  styles.contextText,
                  { fontSize: Math.max(16, fontSize * 0.4) },
                ]}
              >
                {words
                  .slice(Math.max(0, wordIndex - 30), wordIndex)
                  .join(" ")}{" "}
                <Text style={{ color: theme.accent, fontWeight: "bold" }}>
                  {words[wordIndex]}
                </Text>{" "}
                {words
                  .slice(
                    wordIndex + 1,
                    Math.min(words.length, wordIndex + 30),
                  )
                  .join(" ")}
              </Text>
            </Animated.View>
          )}

          <Animated.View
            style={[
              styles.wordWrapper,
              {
                opacity: wordWrapperAnim,
                transform: [
                  {
                    scale: wordWrapperAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1.5, 1],
                    }),
                  },
                ],
              },
            ]}
            clipChildren={false}
          >
            <View
              style={[
                styles.leftPartContainer,
                isDialogue && leftPart
                  ? { transform: [{ translateX: spaceWidth }] }
                  : null,
              ]}
              clipChildren={false}
            >
              <Text
                style={[
                  styles.wordText,
                  { fontSize },
                  isDialogue && {
                    fontStyle: "italic",
                    color: theme.textLight,
                  },
                ]}
              >
                {isDialogue && !!leftPart && (
                  <Text style={{ fontSize: spaceFontSize }}> </Text>
                )}
                {leftPart}
                {isDialogue && !!leftPart && (
                  <Text style={{ fontSize: spaceFontSize }}> </Text>
                )}
              </Text>
            </View>
            <View style={styles.centerPartContainer} clipChildren={false}>
              <Text
                style={[
                  styles.wordText,
                  styles.redLetter,
                  { fontSize },
                  isDialogue && { fontStyle: "italic", color: theme.accent },
                ]}
              >
                {isDialogue && (
                  <Text style={{ fontSize: spaceFontSize }}> </Text>
                )}
                {centerLetter}
                {isDialogue && (
                  <Text style={{ fontSize: spaceFontSize }}> </Text>
                )}
              </Text>
            </View>
            <View
              style={[
                styles.rightPartContainer,
                isDialogue && rightPart
                  ? { transform: [{ translateX: -spaceWidth }] }
                  : null,
              ]}
              clipChildren={false}
            >
              <Text
                style={[
                  styles.wordText,
                  { fontSize },
                  isDialogue && {
                    fontStyle: "italic",
                    color: theme.textLight,
                  },
                ]}
              >
                {isDialogue && !!rightPart && (
                  <Text style={{ fontSize: spaceFontSize }}> </Text>
                )}
                {rightPart}
                {isDialogue && !!rightPart && (
                  <Text style={{ fontSize: spaceFontSize }}> </Text>
                )}
              </Text>
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.Text
          style={[styles.progressText, { opacity: uiOpacityAnim }]}
        >
          {wordIndex + 1} / {words.length} (
          {words.length > 0
            ? Math.round(((wordIndex + 1) / words.length) * 100)
            : 0}
          %)
        </Animated.Text>
      </View>

      {/* Controls */}
      <Animated.View
        style={[styles.controlsContainer, { opacity: uiOpacityAnim }]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleWpmPress}
          onLongPress={handleWpmLongPress}
          delayLongPress={400}
          style={{ marginBottom: 12 }}
        >
          <Animated.View
            style={[
              styles.wpmIslandContainer,
              { transform: [{ scale: wpmAnim }] },
            ]}
          >
            {showRing && (
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: 20,
                    borderWidth: 2,
                    borderColor: theme.accent,
                    opacity: ringAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0],
                    }),
                    transform: [
                      {
                        scale: ringAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.8],
                        }),
                      },
                    ],
                  },
                ]}
              />
            )}
            {showRestoreRing && (
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: 20,
                    borderWidth: 2,
                    borderColor: theme.accent,
                    opacity: restoreRingAnim.interpolate({
                      inputRange: [0, 0.8, 1],
                      outputRange: [0, 1, 0],
                    }),
                    transform: [
                      {
                        scale: restoreRingAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1.8, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
            )}
            <BlurView
              intensity={10}
              tint="default"
              experimentalBlurMethod="dimezisBlurView"
              style={styles.wpmIslandBlur}
            >
              <View style={styles.wpmIslandInner}>
                <Text style={styles.wpmText}>{wpm} WPM</Text>
              </View>
            </BlurView>
          </Animated.View>
        </TouchableOpacity>

        {/* Controls Island */}
        <View style={styles.readerIslandContainer}>
          <BlurView
            intensity={10}
            tint="default"
            experimentalBlurMethod="dimezisBlurView"
            style={styles.readerIslandBlur}
          >
            <View style={styles.readerIslandInner}>
              {/* Prev Chapter */}
              <GlowButton
                theme={theme}
                variant="circle"
                size={42}
                glowType="button"
                buttonStyle={styles.readerIslandButton}
                onPress={prevChapter}
              >
                <Ionicons
                  name="play-skip-back"
                  size={20}
                  color={theme.buttonText}
                />
              </GlowButton>

              {/* Decrease WPM */}
              <GlowButton
                theme={theme}
                variant="circle"
                size={42}
                glowType="button"
                containerStyle={{ marginLeft: 12 }}
                buttonStyle={styles.readerIslandButton}
                onPress={decreaseWpm}
              >
                <Ionicons name="remove" size={22} color={theme.buttonText} />
              </GlowButton>

              {/* Play/Pause Button with Halo Glow */}
              <GlowButton
                theme={theme}
                variant="circle"
                size={64}
                glowType="play"
                containerStyle={{ marginLeft: 12 }}
                buttonStyle={styles.readerPlayButton}
                onPress={togglePlay}
              >
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={32}
                  color={theme.buttonText}
                />
              </GlowButton>

              {/* Increase WPM */}
              <GlowButton
                theme={theme}
                variant="circle"
                size={42}
                glowType="button"
                containerStyle={{ marginLeft: 12 }}
                buttonStyle={styles.readerIslandButton}
                onPress={increaseWpm}
              >
                <Ionicons name="add" size={22} color={theme.buttonText} />
              </GlowButton>

              {/* Next Chapter */}
              <GlowButton
                theme={theme}
                variant="circle"
                size={42}
                glowType="button"
                containerStyle={{ marginLeft: 12 }}
                buttonStyle={styles.readerIslandButton}
                onPress={nextChapter}
              >
                <Ionicons
                  name="play-skip-forward"
                  size={20}
                  color={theme.buttonText}
                />
              </GlowButton>
            </View>
          </BlurView>
        </View>
      </Animated.View>
      <TutorialOverlay
        showTutorial={showTutorial}
        theme={theme}
        insets={insets}
        onClose={handleCloseTutorial}
      />
    </SafeAreaView>
  );
};

export default ReaderView;
