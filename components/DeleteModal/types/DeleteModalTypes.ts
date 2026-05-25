import { BookType, ThemeType } from "../../../types/global";

export interface DeleteModalProps {
  bookToDelete: BookType | null;
  theme: ThemeType;
  onCancel: () => void;
  onDelete: () => void;
}
