// @ts-nocheck
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useFonts } from "expo-font";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, BackHandler, Easing, StyleSheet } from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// Imports from modular codebase
import { DeleteModal } from "../components/DeleteModal";
import { LibraryView } from "../components/LibraryView";
import { ReaderView } from "../components/ReaderView";
import { SplashOverlay } from "../components/SplashOverlay";
import { ThemeModal } from "../components/ThemeModal";
import { BookType, ChapterType, ThemeType } from "../types/global";
import {
  extractEpubCover,
  extractPdfCover,
  getBookCacheUri,
  parseEpub,
  parsePdf,
  parseTxt,
} from "../utils/parsers";
import { t } from "../utils/translations";

const LIBRARY_FILE = FileSystem.documentDirectory + "library.json";

export default function App() {
  const [fontsLoaded] = useFonts({
    "TitilliumWeb-Black": require("../assets/TitilliumWeb-Black.ttf"),
    "TitilliumWeb-Regular": require("../assets/TitilliumWeb-Regular.ttf"),
  });

  const [books, setBooks] = useState<BookType[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [activeMenuBookId, rawSetActiveMenuBookId] = useState<string | null>(null);
  const [menuOverlapsIsland, setMenuOverlapsIsland] = useState(false);

  const setActiveMenuBookId = (bookId: string | null, overlaps = false) => {
    rawSetActiveMenuBookId(bookId);
    setMenuOverlapsIsland(overlaps);
  };

  const [bookToDelete, setBookToDelete] = useState<BookType | null>(null);
  const [currentBook, setCurrentBook] = useState<BookType | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [dialogueFlags, setDialogueFlags] = useState<boolean[]>([]);
  const [chapters, setChapters] = useState<ChapterType[]>([{ index: 0, title: "" }]);

  const [themeHue, setThemeHue] = useState(280); // 280 = Purple default
  const isMountedRef = useRef(false);

  const [tutorialSeen, setTutorialSeen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const currentBookIdRef = useRef<string | null>(null);

  // Splash Screen Animations
  const [showSplash, setShowSplash] = useState(true);
  const splashAnim = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;

  // RSVP Core persisted state
  const [favoriteWpm, setFavoriteWpm] = useState(250);
  const [wpm, setWpm] = useState(250);
  const [wordIndex, setWordIndex] = useState(0);

  const floatingIslandAnim = useRef(new Animated.Value(1)).current;

  // Floating Island Slide Out transition
  useEffect(() => {
    if (activeMenuBookId && menuOverlapsIsland) {
      Animated.timing(floatingIslandAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(floatingIslandAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [activeMenuBookId, menuOverlapsIsland]);

  // Handle Android physical/gesture back button
  useEffect(() => {
    const onBackPress = () => {
      if (currentBookIdRef.current) {
        closeBook();
        return true; // prevent default behavior (exit app)
      }
      return false; // let default behavior happen (exit app)
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );

    return () => subscription.remove();
  }, []);

  // Load Library Data
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const content = await FileSystem.readAsStringAsync(LIBRARY_FILE);
        const data = JSON.parse(content);
        if (data.books) setBooks(data.books);
        if (data.themeHue !== undefined) setThemeHue(data.themeHue);

        if (data.favoriteWpm !== undefined) {
          setFavoriteWpm(data.favoriteWpm);
        } else if (data.wpm !== undefined) {
          setFavoriteWpm(data.wpm);
        }
        if (data.wpm !== undefined) {
          setWpm(data.wpm);
        }

        if (data.tutorialSeen !== undefined) setTutorialSeen(data.tutorialSeen);
      } catch (e: any) {
        console.log("No library file found, starting fresh or error:", e.message);
      } finally {
        isMountedRef.current = true;
        setLibraryLoaded(true);
      }
    };
    loadLibrary();
  }, []);

  // Trigger splash screen animation once fonts and library are loaded
  useEffect(() => {
    if (fontsLoaded && libraryLoaded) {
      Animated.sequence([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.delay(100),
        Animated.timing(splashAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowSplash(false);
      });
    }
  }, [fontsLoaded, libraryLoaded]);

  // Save Library Data
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

  // Theme builder
  const theme = useMemo<ThemeType>(() => {
    let h = themeHue;
    let s = 1;
    let l = 0.63;
    let c = (1 - Math.abs(2 * l - 1)) * s;
    let x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    let m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (0 <= h && h < 60) {
      r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
      r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
      r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
      r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
      r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
      r = c; g = 0; b = x;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    let yiq = (r * 299 + g * 587 + b * 114) / 1000;
    const textOnAccent = yiq >= 128 ? `hsl(${themeHue}, 100%, 8%)` : "#ffffff";
    const isLight = yiq >= 128;
    const buttonBg = isLight ? `hsla(${themeHue}, 100%, 45%, 0.15)` : `hsla(${themeHue}, 100%, 60%, 0.15)`;
    const buttonText = "#ffffff";
    const deleteButtonBg = isLight ? "hsla(0, 100%, 45%, 0.25)" : "hsla(0, 100%, 60%, 0.15)";
    const deleteButtonText = "#ffffff";

    return {
      hue: themeHue,
      accent: `hsl(${themeHue}, 100%, 63%)`,
      bg: `hsl(${themeHue}, 18%, 10%)`,
      surface: `hsl(${themeHue}, 18%, 18%)`,
      textLight: `hsl(${themeHue}, 15%, 70%)`,
      textMuted: `hsl(${themeHue}, 15%, 50%)`,
      textDark: `hsl(${themeHue}, 15%, 35%)`,
      textOnAccent,
      buttonBg,
      buttonText,
      deleteButtonBg,
      deleteButtonText,
    };
  }, [themeHue]);

  const insets = useSafeAreaInsets();

  // Core Actions
  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/plain", "application/epub+zip", "application/pdf"],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        const newBooks = await Promise.all(
          result.assets.map(async (asset) => {
            const safeName = (asset.name || "book").replace(/[^a-zA-Z0-9.\-_]/g, "_");
            const permanentUri = FileSystem.documentDirectory + Date.now() + "_" + safeName;
            await FileSystem.copyAsync({ from: asset.uri, to: permanentUri });

            let coverImage = null;
            if (permanentUri.toLowerCase().endsWith(".epub")) {
              coverImage = await extractEpubCover(permanentUri);
            } else if (permanentUri.toLowerCase().endsWith(".pdf")) {
              coverImage = await extractPdfCover(permanentUri);
            }
            return {
              id: permanentUri,
              name: asset.name || "Unknown Book",
              uri: permanentUri,
              progress: 0,
              totalWords: 0,
              coverImage,
            };
          })
        );
        setBooks((prev) => [...prev, ...newBooks]);
      }
    } catch (err: any) {
      console.log("Import error:", err);
      Alert.alert(t("importError"), err.message || String(err));
    }
  };

  const pickCustomCover = async (bookId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets) {
        const imageUri = result.assets[0].uri;
        const safeName = (result.assets[0].name || "cover").replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const permanentUri = FileSystem.documentDirectory + Date.now() + "_cover_" + safeName;
        await FileSystem.copyAsync({ from: imageUri, to: permanentUri });

        setBooks((prev) =>
          prev.map((b) =>
            b.id === bookId ? { ...b, coverImage: permanentUri } : b
          )
        );
      }
    } catch (err: any) {
      console.log("Cover import error:", err);
      Alert.alert(t("coverImportError"), err.message || String(err));
    }
  };

  const deleteBook = (bookId: string) => {
    const book = books.find((b) => b.id === bookId);
    if (book) {
      setBookToDelete(book);
    }
  };

  const executeDeleteBook = async () => {
    if (!bookToDelete) return;
    try {
      await FileSystem.deleteAsync(bookToDelete.uri, { idempotent: true });
      if (bookToDelete.coverImage && bookToDelete.coverImage.startsWith("file://")) {
        await FileSystem.deleteAsync(bookToDelete.coverImage, { idempotent: true });
      }
      const cacheUri = getBookCacheUri(bookToDelete.id);
      await FileSystem.deleteAsync(cacheUri, { idempotent: true });
    } catch (e) {
      console.log("Error deleting book files:", e);
    }
    setBooks((prev) => prev.filter((b) => b.id !== bookToDelete.id));
    setBookToDelete(null);
    setActiveMenuBookId(null);
  };

  const openBook = (book: BookType) => {
    const openedBookId = book.id;
    currentBookIdRef.current = openedBookId;
    setCurrentBook(book);
    setWordIndex(0);
    setWords([t("loading")]);
    setChapters([{ index: 0, title: t("loading") }]);

    if (!tutorialSeen) {
      setShowTutorial(true);
    }

    const extension = book.name.split(".").pop().toLowerCase();

    // Parse the book in the background
    (async () => {
      const cacheUri = getBookCacheUri(openedBookId);
      let result = null;
      try {
        const cacheContent = await FileSystem.readAsStringAsync(cacheUri);
        result = JSON.parse(cacheContent);
      } catch (cacheErr: any) {
        console.log("No valid cache found, parsing from scratch:", cacheErr.message);
      }

      if (!result) {
        result = {
          words: [],
          dialogueFlags: [],
          chapterMarkers: [{ index: 0, title: "" }],
        };
        try {
          if (extension === "txt") {
            result = await parseTxt(book.uri);
          } else if (extension === "epub") {
            result = await parseEpub(book.uri);
          } else if (extension === "pdf") {
            result = await parsePdf(book.uri);
          } else {
            result.words = [t("unsupportedFormat")];
          }

          if (result && result.words && result.words.length > 0 && result.words[0] !== "Error") {
            try {
              await FileSystem.writeAsStringAsync(
                cacheUri,
                JSON.stringify({
                  words: result.words,
                  dialogueFlags: result.dialogueFlags,
                  chapterMarkers: result.chapterMarkers,
                })
              );
            } catch (writeErr) {
              console.log("Failed to write book cache:", writeErr);
            }
          }
        } catch (err) {
          console.error("Failed to parse book:", err);
          result.words = [t("errorLoadingBook")];
        }
      }

      if (currentBookIdRef.current === openedBookId) {
        setWords(result.words);
        setDialogueFlags(result.dialogueFlags || []);
        setChapters(result.chapterMarkers);
        setWordIndex(book.progress || 0);
      }
    })();
  };

  const closeBook = () => {
    if (currentBook && words.length > 0 && words[0] !== t("loading")) {
      setBooks((prev) =>
        prev.map((b) =>
          b.id === currentBook.id
            ? { ...b, progress: wordIndex, totalWords: words.length }
            : b
        )
      );
    }
    setCurrentBook(null);
    setWords([]);
    currentBookIdRef.current = null;
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      {currentBook ? (
        <ReaderView
          currentBook={currentBook}
          theme={theme}
          words={words}
          dialogueFlags={dialogueFlags}
          chapters={chapters}
          wordIndex={wordIndex}
          setWordIndex={setWordIndex}
          favoriteWpm={favoriteWpm}
          setFavoriteWpm={setFavoriteWpm}
          wpm={wpm}
          setWpm={setWpm}
          closeBook={closeBook}
          insets={insets}
          showTutorial={showTutorial}
          setShowTutorial={setShowTutorial}
          tutorialSeen={tutorialSeen}
          setTutorialSeen={setTutorialSeen}
        />
      ) : (
        <LibraryView
          books={books}
          theme={theme}
          themeHue={themeHue}
          activeMenuBookId={activeMenuBookId}
          setActiveMenuBookId={setActiveMenuBookId}
          menuOverlapsIsland={menuOverlapsIsland}
          openBook={openBook}
          pickCustomCover={pickCustomCover}
          deleteBook={deleteBook}
          handleImport={handleImport}
          setShowThemeModal={setShowThemeModal}
          floatingIslandAnim={floatingIslandAnim}
          insets={insets}
        />
      )}

      <ThemeModal
        showThemeModal={showThemeModal}
        theme={theme}
        themeHue={themeHue}
        setThemeHue={setThemeHue}
        onClose={() => setShowThemeModal(false)}
      />

      <DeleteModal
        bookToDelete={bookToDelete}
        theme={theme}
        onCancel={() => setBookToDelete(null)}
        onDelete={executeDeleteBook}
      />

      <SplashOverlay
        showSplash={showSplash}
        splashAnim={splashAnim}
        logoScale={logoScale}
        themeHue={themeHue}
      />
    </SafeAreaProvider>
  );
}
