// @ts-nocheck
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, Pressable,
  FlatList, Dimensions, StatusBar, Image, PanResponder, Animated, Easing, Alert,
  BackHandler
} from 'react-native';

const HUES = [0, 30, 140, 210, 280, 330];
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import JSZip from 'jszip';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// --- Helpers ---

// Calculate the middle letter index of a word
const getMiddleIndex = (word) => {
  return Math.floor(word.length / 2);
};

const extractEpubCover = async (uri) => {
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    let coverFile = null;
    for (const [filename, file] of Object.entries(zip.files)) {
      if (filename.match(/cover\.(jpe?g|png)$/i)) {
        coverFile = file;
        break;
      }
    }
    
    if (!coverFile) {
      for (const [filename, file] of Object.entries(zip.files)) {
        if (filename.match(/\.(jpe?g|png)$/i) && !filename.match(/icon/i)) {
          coverFile = file;
          break;
        }
      }
    }

    if (coverFile) {
      const base64 = await coverFile.async('base64');
      const ext = coverFile.name.split('.').pop().toLowerCase();
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${base64}`;
    }
  } catch (e) {
    console.log("Failed to extract cover", e);
  }
  return null;
};

const extractPdfCover = async (uri) => {
  try {
    const PdfThumbnail = require('react-native-pdf-thumbnail').default;
    const result = await PdfThumbnail.generate(uri, 0);
    if (result && result.uri) {
      const base64 = await FileSystem.readAsStringAsync(result.uri, {
        encoding: 'base64',
      });
      try {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
      } catch (e) {
        console.log("Failed to delete temp pdf thumbnail:", e);
      }
      return `data:image/jpeg;base64,${base64}`;
    }
  } catch (e) {
    console.error("Failed to extract PDF cover", e);
    Alert.alert("Error de Portada PDF", e.message || String(e));
  }
  return null;
};

const decodeHTMLEntities = (text) => {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&rsquo;/gi, '’')
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&#8212;/g, '—')
    .replace(/&#8211;/g, '–')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#171;/g, '«')
    .replace(/&#187;/g, '»')
    .replace(/&#x2014;/gi, '—')
    .replace(/&#x2013;/gi, '–');
};

const extractWordsAndDialogue = async (text) => {
  let inDialogue = false;
  const words = [];
  const flags = [];

  const tokens = text.split(/(\s+)/);
  const totalTokens = tokens.length;
  const chunkSize = 5000;

  for (let i = 0; i < totalTokens; i += chunkSize) {
    const end = Math.min(i + chunkSize, totalTokens);
    for (let j = i; j < end; j++) {
      const token = tokens[j];
      if (token.includes('\n')) {
        inDialogue = false;
      }
      
      const w = token.trim();
      if (w.length > 0) {
        if (/^["“«]/.test(w)) {
          inDialogue = true;
        } else if (/^[—–]/.test(w)) {
          inDialogue = !inDialogue;
        }

        words.push(w);
        flags.push(inDialogue);

        if (/[”»"][,.;:!?]?$/.test(w)) {
          inDialogue = false;
        } else if (/[—–][,.;:!?]?$/.test(w) && w.length > 1) {
          inDialogue = !inDialogue;
        }
      }
    }
    // Yield execution to keep the main thread responsive
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return { words, flags };
};

// Very basic EPUB parser using JSZip
const parseEpub = async (uri) => {
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    let words = [];
    let dialogueFlags = [];
    let chapterMarkers = [];
    
    // Simplistic extraction: just read all HTML/XHTML files and strip tags
    for (const [filename, file] of Object.entries(zip.files)) {
      if (!file.dir && (filename.endsWith('.html') || filename.endsWith('.xhtml') || filename.endsWith('.htm'))) {
        const content = await file.async('string');
        // Try to extract a chapter title
        let chapterTitle = `Chapter ${chapterMarkers.length + 1}`;
        const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
        const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        const h2Match = content.match(/<h2[^>]*>([^<]+)<\/h2>/i);
        
        if (titleMatch && titleMatch[1].trim()) {
          chapterTitle = titleMatch[1].trim();
        } else if (h1Match && h1Match[1].trim()) {
          chapterTitle = h1Match[1].trim();
        } else if (h2Match && h2Match[1].trim()) {
          chapterTitle = h2Match[1].trim();
        }

        // Preserve paragraph breaks as newlines for dialogue detection, then strip HTML
        const textWithNewlines = content.replace(/<\/p>|<br\s*\/?>|<\/div>/gi, '\n');
        const strippedHtml = textWithNewlines.replace(/<[^>]+>/g, ' ');
        const cleanText = decodeHTMLEntities(strippedHtml);
        
        const { words: chapterWords, flags: chapterFlags } = await extractWordsAndDialogue(cleanText);
        
        if (chapterWords.length > 0) {
          chapterMarkers.push({ index: words.length, title: chapterTitle }); // Index where this chapter starts
          words = words.concat(chapterWords);
          dialogueFlags = dialogueFlags.concat(chapterFlags);
        }
      }
    }
    return { words, dialogueFlags, chapterMarkers: chapterMarkers.length > 0 ? chapterMarkers : [{ index: 0, title: 'Book' }] };
  } catch (e) {
    console.error("Error parsing EPUB:", e);
    return { words: ["Error", "parsing", "EPUB", "file."], dialogueFlags: [false, false, false, false], chapterMarkers: [{ index: 0, title: 'Error' }] };
  }
};

const parseTxt = async (uri) => {
  try {
    const response = await fetch(uri);
    const text = await response.text();
    const cleanText = decodeHTMLEntities(text);
    const { words, flags } = await extractWordsAndDialogue(cleanText);
    return { words, dialogueFlags: flags, chapterMarkers: [{ index: 0, title: 'Full Text' }] };
  } catch (e) {
    console.error("Error parsing TXT:", e);
    return { words: ["Error", "parsing", "TXT", "file."], dialogueFlags: [false, false, false, false], chapterMarkers: [{ index: 0, title: 'Error' }] };
  }
};
const LIBRARY_FILE = FileSystem.documentDirectory + 'library.json';

const getBookCacheUri = (bookId) => {
  const parts = bookId.split('/');
  const filename = parts[parts.length - 1];
  return FileSystem.documentDirectory + 'cache_' + filename + '.json';
};

const parsePdf = async (uri) => {
  try {
    const { extractText, isAvailable } = require('expo-pdf-text-extract');
    if (!isAvailable()) {
      return {
        words: ["PDF", "extraction", "no", "disponible", "en", "este", "entorno.", "Usa", "el", "APK", "instalado."],
        dialogueFlags: [],
        chapterMarkers: [{ index: 0, title: 'PDF' }]
      };
    }
    const text = await extractText(uri);
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const { words, flags } = await extractWordsAndDialogue(cleanText);
    return {
      words: words.length > 0 ? words : ["El", "PDF", "no", "contiene", "texto", "extraíble."],
      dialogueFlags: flags,
      chapterMarkers: [{ index: 0, title: 'PDF' }]
    };
  } catch (e) {
    console.error('Error parsing PDF:', e);
    return {
      words: ["Error", "al", "leer", "el", "PDF:", e.message || String(e)],
      dialogueFlags: [],
      chapterMarkers: [{ index: 0, title: 'Error' }]
    };
  }
};

const BookCardItem = ({ item, theme, styles, openBook, pickCustomCover, deleteBook, activeMenuBookId, setActiveMenuBookId }) => {
  const isMenuOpen = activeMenuBookId === item.id;
  const menuAnim = useRef(new Animated.Value(0)).current;
  const [shouldRenderMenu, setShouldRenderMenu] = useState(isMenuOpen);

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
    setActiveMenuBookId(isMenuOpen ? null : item.id);
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
    <View style={[styles.bookCardContainer, shouldRenderMenu && { zIndex: 999 }]}>
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
              <Image source={{ uri: item.coverImage }} style={styles.coverImage} resizeMode="cover" />
              <View style={styles.coverTitleOverlay}>
                <Text style={styles.coverTitleOverlayText} numberOfLines={1}>{item.name.replace(/\.[^/.]+$/, "")}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="document-text" size={48} color={theme.textDark} />
              <Text style={styles.bookCardTitle} numberOfLines={3}>{item.name.replace(/\.[^/.]+$/, "")}</Text>
              <Text style={styles.uploadCoverHint}>Mantén presionado para opciones</Text>
            </View>
          )}
          <View style={styles.progressBadge}>
            <Text style={styles.progressBadgeText}>
              {item.totalWords > 0 
                ? `${Math.round((item.progress / item.totalWords) * 100)}%`
                : (item.progress > 0 ? 'Resumiendo' : 'Nuevo')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {shouldRenderMenu && (
        <Animated.View 
          style={[
            styles.bookCardMenu,
            {
              opacity: menuOpacity,
              transform: [
                { scale: menuScale },
                { translateY: menuTranslateY }
              ]
            }
          ]}
        >
          <TouchableOpacity 
            style={[styles.menuOption, { borderRightWidth: 1, borderRightColor: theme.surface }]} 
            onPress={() => {
              setActiveMenuBookId(null);
              pickCustomCover(item.id);
            }}
          >
            <Ionicons name="image-outline" size={18} color={theme.accent} />
            <Text style={styles.menuOptionText}>Portada</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuOption} 
            onPress={() => deleteBook(item.id)}
          >
            <Ionicons name="trash-outline" size={18} color="#ff4a4a" />
            <Text style={[styles.menuOptionText, { color: '#ff4a4a' }]}>Eliminar</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

export default function App() {
  const [books, setBooks] = useState([]);
  const [activeMenuBookId, setActiveMenuBookId] = useState(null);
  const [bookToDelete, setBookToDelete] = useState(null);
  const [currentBook, setCurrentBook] = useState(null);
  const [words, setWords] = useState([]);
  const [dialogueFlags, setDialogueFlags] = useState([]);
  const [chapters, setChapters] = useState([{ index: 0, title: '' }]);
  
  const [themeHue, setThemeHue] = useState(280); // 280 = Purple default
  const isMountedRef = useRef(false);

  const [tutorialSeen, setTutorialSeen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [dontShowAgainChecked, setDontShowAgainChecked] = useState(false);
  const currentBookIdRef = useRef(null);

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const content = await FileSystem.readAsStringAsync(LIBRARY_FILE);
        const data = JSON.parse(content);
        if (data.books) setBooks(data.books);
        if (data.themeHue !== undefined) setThemeHue(data.themeHue);
        
        // Backwards compatible loading:
        if (data.favoriteWpm !== undefined) {
          setFavoriteWpm(data.favoriteWpm);
        } else if (data.wpm !== undefined) {
          setFavoriteWpm(data.wpm);
        }
        if (data.wpm !== undefined) {
          setWpm(data.wpm);
        }
        
        if (data.tutorialSeen !== undefined) setTutorialSeen(data.tutorialSeen);
      } catch (e) {
        // Normal behavior on first launch when the file doesn't exist yet
        console.log("No library file found, starting fresh or error:", e.message);
      } finally {
        isMountedRef.current = true;
      }
    };
    loadLibrary();
  }, []);

  useEffect(() => {
    if (!isMountedRef.current) return;
    const saveLibrary = async () => {
      try {
        const data = { books, themeHue, wpm, favoriteWpm, tutorialSeen };
        await FileSystem.writeAsStringAsync(LIBRARY_FILE, JSON.stringify(data));
      } catch (e) {
        console.error("Error saving library", e);
      }
    };
    saveLibrary();
  }, [books, themeHue, wpm, favoriteWpm, tutorialSeen]);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const uiOpacityAnim = useRef(new Animated.Value(1)).current;
  
  const theme = useMemo(() => {
    let h = themeHue;
    let s = 1;
    let l = 0.63;
    let c = (1 - Math.abs(2 * l - 1)) * s;
    let x = c * (1 - Math.abs((h / 60) % 2 - 1));
    let m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    const textOnAccent = (yiq >= 128) ? '#000000' : '#ffffff';

    return {
      accent: `hsl(${themeHue}, 100%, 63%)`,
      bg: `hsl(${themeHue}, 18%, 10%)`,
      surface: `hsl(${themeHue}, 18%, 18%)`,
      textLight: `hsl(${themeHue}, 15%, 70%)`,
      textMuted: `hsl(${themeHue}, 15%, 50%)`,
      textDark: `hsl(${themeHue}, 15%, 35%)`,
      textOnAccent
    };
  }, [themeHue]);

  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(theme, insets), [theme, insets]);
  
  // RSVP State
  const [wordIndex, setWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [favoriteWpm, setFavoriteWpm] = useState(250);
  const [wpm, setWpm] = useState(250); // Start with a decent reading speed
  const [fontSize, setFontSize] = useState(48); // Start with a large font
  
  const playInterval = useRef(null);
  const lastTapRef = useRef(0);
  const wpmAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const restoreRingAnim = useRef(new Animated.Value(0)).current;
  const [showRing, setShowRing] = useState(false);
  const [showRestoreRing, setShowRestoreRing] = useState(false);
  const wordFadeAnim = useRef(new Animated.Value(0)).current;

  const tutorialAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showTutorial) {
      const anim = Animated.loop(
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
          })
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      tutorialAnim.setValue(0);
    }
  }, [showTutorial, tutorialStep]);

  // Chapter Transition State
  const [chapterPopup, setChapterPopup] = useState({ visible: false, title: '' });
  const chapterPopupAnim = useRef(new Animated.Value(0)).current;
  const prevChapterRef = useRef(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (chapters.length === 0 || words.length === 0) return;
    
    let currentCh = chapters[0];
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (wordIndex >= chapters[i].index) {
        currentCh = chapters[i];
        break;
      }
    }

    if (prevChapterRef.current && prevChapterRef.current.index !== currentCh.index && isPlaying && !isTransitioning) {
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
          setChapterPopup({ visible: false, title: '' });
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

  const isPlayingRef = useRef(isPlaying);
  const wakeUpTimeoutRef = useRef(null);

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

  const wordsLengthRef = useRef(0);
  useEffect(() => {
    wordsLengthRef.current = words.length;
  }, [words.length]);

  const scrubInterval = useRef(null);
  const currentScrubSpeed = useRef(0);
  const [scrubStatus, setScrubStatus] = useState({ active: false, direction: 0, level: 0 });
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Context View state
  const [showContext, setShowContext] = useState(false);
  const showContextRef = useRef(false);
  const contextAnim = useRef(new Animated.Value(0)).current;
  const wordWrapperAnim = useRef(new Animated.Value(1)).current;
  const contextTimeoutRef = useRef(null);

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
          })
        ])
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
      setWordIndex(prev => {
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
              Animated.spring(contextAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
              Animated.timing(wordWrapperAnim, { toValue: 0, duration: 150, useNativeDriver: true })
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
            Animated.timing(contextAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
            Animated.timing(wordWrapperAnim, { toValue: 1, duration: 150, useNativeDriver: true })
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
            Animated.timing(contextAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
            Animated.timing(wordWrapperAnim, { toValue: 1, duration: 150, useNativeDriver: true })
          ]).start(() => setShowContext(false));
        }
        currentScrubSpeed.current = 0;
        updateScrubInterval();
      }
    })
  ).current;

  // --- Actions ---

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/epub+zip', 'application/pdf'],
        multiple: true,
        copyToCacheDirectory: true
      });
      
      if (!result.canceled && result.assets) {
        const newBooks = await Promise.all(result.assets.map(async (asset) => {
          // Save file permanently to DocumentDirectory to avoid cache clear loss
          const safeName = (asset.name || 'book').replace(/[^a-zA-Z0-9.\-_]/g, '_');
          const permanentUri = FileSystem.documentDirectory + Date.now() + '_' + safeName;
          await FileSystem.copyAsync({ from: asset.uri, to: permanentUri });

          let coverImage = null;
          if (permanentUri.toLowerCase().endsWith('.epub')) {
            coverImage = await extractEpubCover(permanentUri);
          } else if (permanentUri.toLowerCase().endsWith('.pdf')) {
            coverImage = await extractPdfCover(permanentUri);
          }
          return {
            id: permanentUri,
            name: asset.name || 'Unknown Book',
            uri: permanentUri,
            progress: 0,
            totalWords: 0,
            coverImage
          };
        }));
        // Append to current library
        setBooks(prev => [...prev, ...newBooks]);
      }
    } catch (err) {
      console.log("Import error:", err);
      Alert.alert("Import Error", err.message || String(err));
    }
  };

  const pickCustomCover = async (bookId) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true
      });
      if (!result.canceled && result.assets) {
        const imageUri = result.assets[0].uri;
        // Save image permanently
        const safeName = (result.assets[0].name || 'cover').replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const permanentUri = FileSystem.documentDirectory + Date.now() + '_cover_' + safeName;
        await FileSystem.copyAsync({ from: imageUri, to: permanentUri });

        setBooks(prev => prev.map(b => b.id === bookId ? { ...b, coverImage: permanentUri } : b));
      }
    } catch (err) {
      console.log("Cover import error:", err);
      Alert.alert("Cover Import Error", err.message || String(err));
    }
  };

  const deleteBook = (bookId) => {
    const book = books.find(b => b.id === bookId);
    if (book) {
      setBookToDelete(book);
    }
  };

  const executeDeleteBook = async () => {
    if (!bookToDelete) return;
    try {
      // Delete book file
      await FileSystem.deleteAsync(bookToDelete.uri, { idempotent: true });
      // Delete cover file if it's local
      if (bookToDelete.coverImage && bookToDelete.coverImage.startsWith('file://')) {
        await FileSystem.deleteAsync(bookToDelete.coverImage, { idempotent: true });
      }
      // Delete cache file
      const cacheUri = getBookCacheUri(bookToDelete.id);
      await FileSystem.deleteAsync(cacheUri, { idempotent: true });
    } catch (e) {
      console.log("Error deleting book files:", e);
    }
    // Remove from state
    setBooks(prev => prev.filter(b => b.id !== bookToDelete.id));
    setBookToDelete(null);
    setActiveMenuBookId(null);
  };

  const openBook = (book) => {
    const openedBookId = book.id;
    currentBookIdRef.current = openedBookId;
    setCurrentBook(book);
    setWordIndex(0); // Safe initial state while loading
    setWords(["Loading..."]);
    setChapters([{ index: 0, title: 'Loading...' }]);
    
    if (!tutorialSeen) {
      setShowTutorial(true);
      setTutorialStep(0);
      setDontShowAgainChecked(false);
    }

    const extension = book.name.split('.').pop().toLowerCase();
    
    // Parse the book in the background
    (async () => {
      const cacheUri = getBookCacheUri(openedBookId);
      let result = null;
      try {
        const cacheContent = await FileSystem.readAsStringAsync(cacheUri);
        result = JSON.parse(cacheContent);
      } catch (cacheErr) {
        console.log("No valid cache found, parsing from scratch:", cacheErr.message);
      }

      if (!result) {
        result = { words: [], dialogueFlags: [], chapterMarkers: [{ index: 0, title: '' }] };
        try {
          if (extension === 'txt') {
            result = await parseTxt(book.uri);
          } else if (extension === 'epub') {
            result = await parseEpub(book.uri);
          } else if (extension === 'pdf') {
            result = await parsePdf(book.uri);
          } else {
            result.words = ["Unsupported", "format"];
          }

          // Cache the successfully parsed content asynchronously
          if (result && result.words && result.words.length > 0 && result.words[0] !== "Error") {
            try {
              await FileSystem.writeAsStringAsync(cacheUri, JSON.stringify({
                words: result.words,
                dialogueFlags: result.dialogueFlags,
                chapterMarkers: result.chapterMarkers
              }));
            } catch (writeErr) {
              console.log("Failed to write book cache:", writeErr);
            }
          }
        } catch (err) {
          console.error("Failed to parse book:", err);
          result.words = ["Error", "loading", "book"];
        }
      }

      if (currentBookIdRef.current === openedBookId) {
        setWords(result.words);
        setDialogueFlags(result.dialogueFlags || []);
        setChapters(result.chapterMarkers);
        setWordIndex(book.progress || 0); // Restore actual reading position
      }
    })();
  };

  const closeBook = () => {
    wakeUpUi();
    // Save progress only if the book was fully loaded to avoid erasing progress
    if (currentBook && words.length > 0 && words[0] !== "Loading...") {
      setBooks(prev => prev.map(b => b.id === currentBook.id ? { ...b, progress: wordIndex, totalWords: words.length } : b));
    }
    setIsPlaying(false);
    setCurrentBook(null);
    setWords([]);
    currentBookIdRef.current = null;
  };

  const closeBookRef = useRef(closeBook);
  useEffect(() => {
    closeBookRef.current = closeBook;
  });

  useEffect(() => {
    const handleBackButton = () => {
      if (currentBook) {
        closeBookRef.current();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackButton);
    return () => backHandler.remove();
  }, [currentBook]);

  // --- Playback Control ---

  useEffect(() => {
    if (isPlaying && words.length > 0) {
      const msPerWord = (60 / wpm) * 1000;
      playInterval.current = setInterval(() => {
        setWordIndex(prev => {
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

  const increaseWpm = () => { wakeUpUi(); setWpm(prev => prev + 10); };
  const decreaseWpm = () => { wakeUpUi(); setWpm(prev => (prev > 10 ? prev - 10 : prev)); };

  const increaseFontSize = () => { wakeUpUi(); setFontSize(prev => prev + 4); };
  const decreaseFontSize = () => { wakeUpUi(); setFontSize(prev => (prev > 16 ? prev - 4 : prev)); };

  const handleWpmPress = () => {
    wakeUpUi();
    const now = Date.now();
    if (lastTapRef.current && (now - lastTapRef.current) < 300) {
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
          Animated.timing(wpmAnim, { toValue: 0.85, duration: 100, useNativeDriver: true }),
          Animated.spring(wpmAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true })
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
      Animated.timing(wpmAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
      Animated.spring(wpmAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true })
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
    const nextMarker = chapters.find(marker => marker.index > wordIndex);
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

  // --- Rendering ---

  const renderTutorialOverlay = () => {
    let cardStyle = {};
    if (tutorialStep === 0 || tutorialStep === 1) {
      cardStyle = { bottom: 60 };
    } else if (tutorialStep === 2 || tutorialStep === 3) {
      cardStyle = { top: 120 };
    } else {
      cardStyle = { alignSelf: 'center' };
    }

    const stepsData = [
      {
        title: "Swipe to Navigate",
        desc: "Swipe left or right on the middle word to rewind or fast forward. Move your finger further to scrub faster.",
        icon: "swap-horizontal",
      },
      {
        title: "Zoom Out Context",
        desc: "Long press the middle word to zoom out and view the surrounding paragraph context.",
        icon: "scan",
      },
      {
        title: "Set Favorite Speed",
        desc: "Adjust speed easily:\n• Long press the WPM indicator to save your favorite speed.\n• Double tap the WPM indicator to restore your favorite speed.",
        icon: "speedometer",
      },
      {
        title: "Interface Controls",
        desc: "A- / A+ adjusts font size. The bottom controls allow play/pause, manual WPM adjustments, and chapter skipping.",
        icon: "cog",
      },
      {
        title: "Ready to Read!",
        desc: "You are all set to start reading! Enjoy your speed reading experience.",
        icon: "checkmark-circle",
      }
    ];

    const currentStepData = stepsData[tutorialStep];

    const handleNext = () => {
      if (tutorialStep < 4) {
        setTutorialStep(tutorialStep + 1);
      } else {
        if (dontShowAgainChecked) {
          setTutorialSeen(true);
        }
        setShowTutorial(false);
      }
    };

    const handleSkip = () => {
      setShowTutorial(false);
    };

    return (
      <View style={styles.tutorialOverlay}>
        {/* Render Highlights */}
        {tutorialStep === 0 && (
          <View style={styles.highlightRsvp}>
            <Animated.View style={[styles.tutorialHand, { transform: [{ translateX: tutorialAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-40, 40, -40] }) }] }]}>
              <Ionicons name="hand-left" size={36} color={theme.accent} />
            </Animated.View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 20, position: 'absolute', top: '40%' }}>
              <Animated.View style={{ transform: [{ translateX: tutorialAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -15] }) }] }}>
                <Ionicons name="chevron-back" size={24} color={theme.accent} />
              </Animated.View>
              <Animated.View style={{ transform: [{ translateX: tutorialAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 15] }) }] }}>
                <Ionicons name="chevron-forward" size={24} color={theme.accent} />
              </Animated.View>
            </View>
          </View>
        )}

        {tutorialStep === 1 && (
          <View style={styles.highlightRsvp}>
            <Animated.View style={[styles.tutorialHand, { 
              transform: [
                { scale: tutorialAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.8, 1.1] }) }
              ],
              opacity: tutorialAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 1, 0.6] })
            }]}>
              <Ionicons name="hand-left" size={36} color={theme.accent} />
            </Animated.View>
          </View>
        )}

        {tutorialStep === 2 && (
          <View style={[styles.highlightWpm, { left: width / 2 - 75 }]}>
            <Animated.View style={[styles.tutorialHand, { 
              top: 30,
              transform: [
                { scale: tutorialAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.9, 1.1] }) }
              ]
            }]}>
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
        <View style={[styles.tutorialCard, cardStyle]}>
          {tutorialStep < 4 && (
            <TouchableOpacity style={styles.tutorialSkipButton} onPress={handleSkip}>
              <Text style={styles.tutorialSkipText}>Skip</Text>
            </TouchableOpacity>
          )}

          <View style={styles.tutorialHeaderIcon}>
            <Ionicons name={currentStepData.icon} size={36} color={theme.accent} />
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
                  i === tutorialStep ? styles.tutorialDotActive : styles.tutorialDotInactive
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
              <View style={[styles.checkbox, dontShowAgainChecked && styles.checkboxChecked]}>
                {dontShowAgainChecked && <Ionicons name="checkmark" size={14} color={theme.textOnAccent} />}
              </View>
              <Text style={styles.checkboxLabel}>Don't show this tutorial again</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.tutorialButton} onPress={handleNext}>
            <Text style={styles.tutorialButtonText}>
              {tutorialStep === 4 ? "Start Reading" : "Next"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (currentBook) {
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
    const currentChapter = [...chapters].reverse().find(marker => marker.index <= wordIndex) || chapters[0];
    const chapterTitle = currentChapter ? currentChapter.title : '';

    return (
      <SafeAreaView style={styles.readerContainer}>
        <StatusBar hidden />
        
        {/* Top Bar */}
        <Animated.View style={[styles.topBar, { opacity: uiOpacityAnim }]}>
          <View style={styles.leftSideArea}>
            <TouchableOpacity onPress={closeBook} style={styles.backButton}>
              <Ionicons name="arrow-back" size={28} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.titleContainer}>
            <Text style={styles.bookTitle} numberOfLines={2}>{currentBook.name.replace(/\.[^/.]+$/, "")}</Text>
            {chapterTitle ? <Text style={styles.chapterTitle} numberOfLines={1}>{chapterTitle}</Text> : null}
          </View>

          <View style={styles.fontControls}>
            <TouchableOpacity onPress={decreaseFontSize} style={styles.fontButton}>
              <Text style={styles.fontButtonText}>A-</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={increaseFontSize} style={styles.fontButton}>
              <Text style={styles.fontButtonText}>A+</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* RSVP Display */}
        <View style={styles.rsvpContainer} {...panResponder.panHandlers} clipChildren={false}>
          {/* Guide lines for the eye */}
          <View style={[styles.guideLineTop, { transform: [{ translateY: -guideOffset }] }]} />
          <View style={[styles.guideLineBottom, { transform: [{ translateY: guideOffset }] }]} />

          {/* Scrub Indicators */}
          {scrubStatus.active && (
            <Animated.View style={[styles.scrubIndicatorContainer, { opacity: pulseAnim }]}>
              {scrubStatus.direction === -1 ? (
                <>
                  <Ionicons name="chevron-back" size={80} color={theme.accent} style={styles.scrubArrow} />
                  {scrubStatus.level >= 2 && <Ionicons name="chevron-back" size={80} color={theme.accent} style={styles.scrubArrow} />}
                  {scrubStatus.level >= 3 && <Ionicons name="chevron-back" size={80} color={theme.accent} style={styles.scrubArrow} />}
                </>
              ) : (
                <>
                  {scrubStatus.level >= 3 && <Ionicons name="chevron-forward" size={80} color={theme.accent} style={styles.scrubArrow} />}
                  {scrubStatus.level >= 2 && <Ionicons name="chevron-forward" size={80} color={theme.accent} style={styles.scrubArrow} />}
                  <Ionicons name="chevron-forward" size={80} color={theme.accent} style={styles.scrubArrow} />
                </>
              )}
            </Animated.View>
          )}

          {/* Chapter Popup Animation (outside of word fade) */}
          {chapterPopup.visible && (
            <Animated.View style={[
              StyleSheet.absoluteFillObject,
              {
                justifyContent: 'center',
                alignItems: 'center',
                pointerEvents: 'none',
                zIndex: 20,
                opacity: chapterPopupAnim.interpolate({
                  inputRange: [0, 0.2, 0.8, 1],
                  outputRange: [0, 1, 1, 0]
                }),
                transform: [{
                  translateY: chapterPopupAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -150]
                  })
                }]
              }
            ]}>
              <Text style={{
                color: theme.accent,
                fontSize: 24,
                fontWeight: 'bold',
                textAlign: 'center',
                textShadowColor: 'rgba(0,0,0,0.5)',
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 4,
              }}>
                {chapterPopup.title}
              </Text>
            </Animated.View>
          )}
          
          <Animated.View style={{ opacity: wordFadeAnim, flex: 1, justifyContent: 'center' }} clipChildren={false}>
            {showContext && (
              <Animated.View pointerEvents="none" style={[
                styles.contextContainer,
                {
                  opacity: contextAnim,
                  transform: [
                    { scale: contextAnim.interpolate({ inputRange: [0, 1], outputRange: [2.5, 1] }) }
                  ]
                }
              ]}>
                <Text style={[styles.contextText, { fontSize: Math.max(16, fontSize * 0.4) }]}>
                  {words.slice(Math.max(0, wordIndex - 30), wordIndex).join(' ')}{' '}
                  <Text style={{ color: theme.accent, fontWeight: 'bold' }}>{words[wordIndex]}</Text>{' '}
                  {words.slice(wordIndex + 1, Math.min(words.length, wordIndex + 30)).join(' ')}
                </Text>
              </Animated.View>
            )}

            <Animated.View style={[styles.wordWrapper, { opacity: wordWrapperAnim, transform: [{ scale: wordWrapperAnim.interpolate({ inputRange: [0, 1], outputRange: [1.5, 1] }) }] }]} clipChildren={false}>
              <View style={[styles.leftPartContainer, isDialogue && leftPart ? { transform: [{ translateX: spaceWidth }] } : null]} clipChildren={false}>
                <Text style={[styles.wordText, { fontSize }, isDialogue && { fontStyle: 'italic', color: theme.textLight }]}>
                  {isDialogue && !!leftPart && <Text style={{ fontSize: spaceFontSize }}> </Text>}
                  {leftPart}
                  {isDialogue && !!leftPart && <Text style={{ fontSize: spaceFontSize }}> </Text>}
                </Text>
              </View>
              <View style={styles.centerPartContainer} clipChildren={false}>
                <Text style={[styles.wordText, styles.redLetter, { fontSize }, isDialogue && { fontStyle: 'italic', color: theme.accent }]}>
                  {isDialogue && <Text style={{ fontSize: spaceFontSize }}> </Text>}
                  {centerLetter}
                  {isDialogue && <Text style={{ fontSize: spaceFontSize }}> </Text>}
                </Text>
              </View>
              <View style={[styles.rightPartContainer, isDialogue && rightPart ? { transform: [{ translateX: -spaceWidth }] } : null]} clipChildren={false}>
                <Text style={[styles.wordText, { fontSize }, isDialogue && { fontStyle: 'italic', color: theme.textLight }]}>
                  {isDialogue && !!rightPart && <Text style={{ fontSize: spaceFontSize }}> </Text>}
                  {rightPart}
                  {isDialogue && !!rightPart && <Text style={{ fontSize: spaceFontSize }}> </Text>}
                </Text>
              </View>
            </Animated.View>
          </Animated.View>
          
          <Animated.Text style={[styles.progressText, { opacity: uiOpacityAnim }]}>
            {wordIndex + 1} / {words.length} ({words.length > 0 ? Math.round(((wordIndex + 1) / words.length) * 100) : 0}%)
          </Animated.Text>
        </View>

        {/* Controls */}
        <Animated.View style={[styles.controlsContainer, { opacity: uiOpacityAnim }]}>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={handleWpmPress}
            onLongPress={handleWpmLongPress}
            delayLongPress={400}
          >
            <Animated.View style={[styles.speedControls, { transform: [{ scale: wpmAnim }] }]}>
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
                        outputRange: [1, 0]
                      }),
                      transform: [{
                        scale: ringAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.8]
                        })
                      }]
                    }
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
                        outputRange: [0, 1, 0]
                      }),
                      transform: [{
                        scale: restoreRingAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1.8, 1]
                        })
                      }]
                    }
                  ]} 
                />
              )}
              <Text style={styles.wpmText}>{wpm} WPM</Text>
            </Animated.View>
          </TouchableOpacity>
          
          <View style={styles.playbackControls}>
            <TouchableOpacity onPress={decreaseWpm} style={styles.iconButton}>
              <Ionicons name="remove" size={40} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity onPress={togglePlay} style={styles.playButton}>
              <Ionicons name={isPlaying ? "pause" : "play"} size={48} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity onPress={increaseWpm} style={styles.iconButton}>
              <Ionicons name="add" size={40} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.chapterControls}>
            <TouchableOpacity onPress={prevChapter} style={styles.chapterButton}>
              <Ionicons name="play-skip-back" size={24} color={theme.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={nextChapter} style={styles.chapterButton}>
              <Ionicons name="play-skip-forward" size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </Animated.View>
        {showTutorial && renderTutorialOverlay()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.homeContainer}>
      <StatusBar barStyle="light-content" />
      <Pressable style={{ flex: 1 }} onPress={() => setActiveMenuBookId(null)}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Centread</Text>
          <TouchableOpacity style={styles.importButton} onPress={handleImport}>
            <Ionicons name="add" size={24} color={theme.textOnAccent} />
            <Text style={styles.importButtonText}>Import Books</Text>
          </TouchableOpacity>
        </View>

        {books.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={64} color={theme.textMuted} />
            <Text style={styles.emptyText}>Your library is empty.</Text>
            <Text style={styles.emptySubText}>Tap the import button to select EPUB, PDF or TXT files.</Text>
          </View>
        ) : (
          <FlatList
            data={books}
            keyExtractor={item => item.id}
            numColumns={2}
            contentContainerStyle={styles.gridList}
            onScrollBeginDrag={() => setActiveMenuBookId(null)}
            renderItem={({ item }) => (
              <BookCardItem
                item={item}
                theme={theme}
                styles={styles}
                openBook={openBook}
                pickCustomCover={pickCustomCover}
                deleteBook={deleteBook}
                activeMenuBookId={activeMenuBookId}
                setActiveMenuBookId={setActiveMenuBookId}
              />
            )}
          />
        )}
      </Pressable>

      {/* Theme Picker Button */}
      {!currentBook && (
        <TouchableOpacity 
          style={styles.themeFab}
          onPress={() => setShowThemeModal(true)}
        >
          <Ionicons name="color-palette" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {showThemeModal && (
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowThemeModal(false)}>
          <View style={styles.themeModalContent}>
            <Text style={styles.themeModalTitle}>Select Accent Color</Text>
            <View style={styles.hueGrid}>
              {HUES.map(h => (
                <TouchableOpacity 
                  key={h}
                  style={[styles.hueCircle, { backgroundColor: `hsl(${h}, 100%, 63%)`, borderWidth: themeHue === h ? 3 : 0 }]}
                  onPress={() => setThemeHue(h)}
                />
              ))}
            </View>
            <Text style={[styles.themeModalTitle, { marginTop: 20, fontSize: 16 }]}>Custom Spectrum</Text>
            <View style={{ width: '100%', height: 60 }}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={Array.from({length: 36})}
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
                        borderColor: '#fff' 
                      }}
                      onPress={() => setThemeHue(h)}
                    />
                  );
                }}
              />
            </View>
          </View>
        </TouchableOpacity>
      )}

      {bookToDelete && (
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setBookToDelete(null)}>
          <View style={styles.deleteModalContent}>
            <Ionicons name="trash-bin-outline" size={48} color={theme.accent} style={{ marginBottom: 16 }} />
            <Text style={styles.deleteModalTitle}>¿Eliminar libro?</Text>
            <Text style={styles.deleteModalSub}>
              ¿Estás seguro de que deseas eliminar "{bookToDelete.name.replace(/\.[^/.]+$/, "")}"? Esta acción no se puede deshacer.
            </Text>
            
            <View style={styles.modalButtonGroup}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalCancelButton]} 
                onPress={() => setBookToDelete(null)}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalDeleteButton]} 
                onPress={executeDeleteBook}
              >
                <Text style={styles.modalDeleteButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme, insets = { top: 0, bottom: 0, left: 0, right: 0 }) => StyleSheet.create({
  // --- Global ---
  homeContainer: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  readerContainer: {
    flex: 1,
    backgroundColor: theme.bg, // Pitch black for reading
  },
  
  // --- Home Screen ---
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    marginTop: 20,
  },
  headerTitle: {
    color: theme.accent,
    fontSize: 32,
    fontWeight: 'bold',
  },
  importButton: {
    flexDirection: 'row',
    backgroundColor: theme.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  importButtonText: {
    color: theme.textOnAccent,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubText: {
    color: theme.textLight,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  gridList: {
    padding: 10,
  },
  bookCardContainer: {
    flex: 1,
    margin: 10,
    height: 220,
    position: 'relative',
    zIndex: 1,
  },
  bookCard: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.surface,
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  bookCardInner: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bookCardMenu: {
    position: 'absolute',
    bottom: -55,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: theme.surface,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 100,
  },
  menuOption: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  menuOptionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  bookCardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
  },
  uploadCoverHint: {
    color: theme.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  coverImageContainer: {
    flex: 1,
    width: '100%',
  },
  coverImage: {
    flex: 1,
    width: '100%',
  },
  coverTitleOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  coverTitleOverlayText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  progressBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: theme.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  progressBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // --- Reader Screen ---
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  leftSideArea: {
    width: 88,
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: 4, // Aligns text slightly lower to match icons
  },
  backButton: {
    padding: 4,
  },
  bookTitle: {
    color: theme.textLight,
    fontSize: 16,
    textAlign: 'center',
  },
  chapterTitle: {
    color: theme.textMuted,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 28,
  },
  fontControls: {
    width: 88,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  fontButton: {
    width: 40,
    height: 40,
    marginLeft: 8,
    backgroundColor: theme.bg,
    borderColor: theme.accent,
    borderWidth: 2,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontButtonText: {
    color: '#777',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rsvpContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  guideLineTop: {
    position: 'absolute',
    top: '50%',
    marginTop: -10,
    width: 2,
    height: 20,
    backgroundColor: theme.textDark,
  },
  guideLineBottom: {
    position: 'absolute',
    top: '50%',
    marginTop: -10,
    width: 2,
    height: 20,
    backgroundColor: theme.textDark,
  },
  scrubIndicatorContainer: {
    position: 'absolute',
    top: '20%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  scrubArrow: {
    marginHorizontal: -25,
  },
  wordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    overflow: 'visible',
  },
  leftPartContainer: {
    flex: 1,
    alignItems: 'flex-end',
    overflow: 'visible',
  },
  centerPartContainer: {
    alignItems: 'center',
    overflow: 'visible',
  },
  rightPartContainer: {
    flex: 1,
    alignItems: 'flex-start',
    overflow: 'visible',
  },
  wordText: {
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: 'monospace', // Monospace helps alignment significantly
  },
  redLetter: {
    color: theme.accent,
  },
  progressText: {
    position: 'absolute',
    bottom: 40,
    color: theme.textMuted,
    fontSize: 14,
  },
  controlsContainer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  speedControls: {
    marginBottom: 20,
    backgroundColor: '#1e1e1e',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  wpmText: {
    color: '#777',
    fontSize: 18,
    fontWeight: 'bold',
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconButton: {
    width: 64,
    height: 64,
    backgroundColor: theme.bg,
    borderColor: theme.accent,
    borderWidth: 2,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  playButton: {
    width: 80,
    height: 80,
    backgroundColor: theme.bg,
    borderColor: theme.accent,
    borderWidth: 2,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  chapterControls: {
    flexDirection: 'row',
    marginTop: 20,
    width: '60%',
    justifyContent: 'space-between',
  },
  chapterButton: {
    width: 56,
    height: 56,
    backgroundColor: theme.bg,
    borderColor: theme.accent,
    borderWidth: 2,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeFab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  themeModalContent: {
    backgroundColor: theme.surface,
    padding: 24,
    borderRadius: 20,
    width: '80%',
    alignItems: 'center',
  },
  themeModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  hueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  hueCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    margin: 8,
    borderColor: '#fff',
  },
  contextContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 10,
    backgroundColor: theme.bg,
  },
  contextText: {
    color: theme.textLight,
    textAlign: 'center',
    lineHeight: 32,
  },
  deleteModalContent: {
    backgroundColor: theme.surface,
    padding: 24,
    borderRadius: 20,
    width: '85%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  deleteModalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  deleteModalSub: {
    color: theme.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtonGroup: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalCancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalDeleteButton: {
    backgroundColor: theme.accent,
  },
  modalDeleteButtonText: {
    color: theme.textOnAccent,
    fontSize: 14,
    fontWeight: 'bold',
  },
  // --- Tutorial Overlay ---
  tutorialOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 1000,
    justifyContent: 'center',
  },
  highlightRsvp: {
    position: 'absolute',
    top: '38%',
    height: '24%',
    left: '5%',
    right: '5%',
    borderWidth: 2,
    borderColor: theme.accent,
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  highlightWpm: {
    position: 'absolute',
    bottom: (insets.bottom || 0) + 214,
    height: 40,
    width: 130,
    borderWidth: 2,
    borderColor: theme.accent,
    borderStyle: 'dashed',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  highlightTopBar: {
    position: 'absolute',
    top: (insets.top || 0) + 8,
    left: '4%',
    right: '4%',
    height: 64,
    borderWidth: 2,
    borderColor: theme.accent,
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  highlightControls: {
    position: 'absolute',
    bottom: (insets.bottom || 0) + 16,
    left: '10%',
    right: '10%',
    height: 195,
    borderWidth: 2,
    borderColor: theme.accent,
    borderStyle: 'dashed',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  tutorialHand: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    zIndex: 15,
  },
  tutorialCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 24,
    width: '85%',
    alignSelf: 'center',
    position: 'absolute',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tutorialSkipButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    padding: 4,
  },
  tutorialSkipText: {
    color: theme.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  tutorialHeaderIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  tutorialTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  tutorialText: {
    color: theme.textLight,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  tutorialDotsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorialDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  tutorialDotActive: {
    backgroundColor: theme.accent,
    width: 18,
  },
  tutorialDotInactive: {
    backgroundColor: theme.textDark,
  },
  tutorialButton: {
    backgroundColor: theme.accent,
    width: '100%',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorialButtonText: {
    color: theme.textOnAccent,
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: theme.accent,
  },
  checkboxLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  }
});
