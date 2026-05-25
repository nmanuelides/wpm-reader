import { BookType, SafeAreaInsetsType, ThemeType } from "../../../types/global";

export interface BookCardItemProps {
  item: BookType;
  theme: ThemeType;
  openBook: (book: BookType) => void;
  pickCustomCover: (bookId: string) => void;
  deleteBook: (bookId: string) => void;
  activeMenuBookId: string | null;
  setActiveMenuBookId: (bookId: string | null, overlaps?: boolean) => void;
  insets: SafeAreaInsetsType;
}
