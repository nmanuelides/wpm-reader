import { Animated } from "react-native";
import { BookType, SafeAreaInsetsType, ThemeType } from "../../../types/global";

export interface LibraryViewProps {
  books: BookType[];
  theme: ThemeType;
  themeHue: number;
  activeMenuBookId: string | null;
  setActiveMenuBookId: (bookId: string | null, overlaps?: boolean) => void;
  menuOverlapsIsland: boolean;
  openBook: (book: BookType) => void;
  pickCustomCover: (bookId: string) => void;
  deleteBook: (bookId: string) => void;
  handleImport: () => void;
  setShowThemeModal: (show: boolean) => void;
  floatingIslandAnim: Animated.Value;
  insets: SafeAreaInsetsType;
}
