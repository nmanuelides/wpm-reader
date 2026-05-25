import React from "react";
import { BookType, ChapterType, SafeAreaInsetsType, ThemeType } from "../../../types/global";

export interface ReaderViewProps {
  currentBook: BookType;
  theme: ThemeType;
  words: string[];
  dialogueFlags: boolean[];
  chapters: ChapterType[];
  wordIndex: number;
  setWordIndex: React.Dispatch<React.SetStateAction<number>>;
  favoriteWpm: number;
  setFavoriteWpm: (wpm: number) => void;
  wpm: number;
  setWpm: React.Dispatch<React.SetStateAction<number>>;
  closeBook: () => void;
  insets: SafeAreaInsetsType;
  showTutorial: boolean;
  setShowTutorial: (show: boolean) => void;
  tutorialSeen: boolean;
  setTutorialSeen: (seen: boolean) => void;
}
