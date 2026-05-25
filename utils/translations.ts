// --- Translations ---
export const isSpanish =
  (typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().locale
    : "en"
  )
    .toLowerCase()
    .startsWith("es");

const translations: Record<string, { en: any; es: any }> = {
  deleteBookTitle: {
    en: "Delete Book?",
    es: "¿Eliminar libro?",
  },
  deleteBookConfirm: {
    en: 'Are you sure you want to delete "',
    es: '¿Estás seguro de que deseas eliminar "',
  },
  deleteBookSubSuffix: {
    en: '"? This action cannot be undone.',
    es: '"? Esta acción no se puede deshacer.',
  },
  cancel: {
    en: "Cancel",
    es: "Cancelar",
  },
  delete: {
    en: "Delete",
    es: "Eliminar",
  },
  cover: {
    en: "Cover",
    es: "Portada",
  },
  longPressHint: {
    en: "Long press for options",
    es: "Mantén presionado para opciones",
  },
  book: {
    en: "book",
    es: "libro",
  },
  books: {
    en: "books",
    es: "libros",
  },
  newBadge: {
    en: "New",
    es: "Nuevo",
  },
  resuming: {
    en: "Resuming",
    es: "Resumiendo",
  },
  pdfCoverError: {
    en: "PDF Cover Error",
    es: "Error de Portada PDF",
  },
  pdfExtractionUnavailable: {
    en: [
      "PDF",
      "extraction",
      "not",
      "available",
      "in",
      "this",
      "environment.",
      "Use",
      "the",
      "installed",
      "APK.",
    ],
    es: [
      "PDF",
      "extraction",
      "no",
      "disponible",
      "en",
      "este",
      "entorno.",
      "Usa",
      "el",
      "APK",
      "instalado.",
    ],
  },
  pdfEmptyText: {
    en: ["The", "PDF", "does", "not", "contain", "extractable", "text."],
    es: ["El", "PDF", "no", "contiene", "texto", "extraíble."],
  },
  pdfReadError: {
    en: ["Error", "reading", "PDF:"],
    es: ["Error", "al", "leer", "el", "PDF:"],
  },
  loading: {
    en: "Loading...",
    es: "Cargando...",
  },
  unsupportedFormat: {
    en: ["Unsupported", "format"],
    es: ["Formato", "no", "soportado"],
  },
  errorLoadingBook: {
    en: ["Error", "loading", "book"],
    es: ["Error", "al", "cargar", "el", "libro"],
  },
  importError: {
    en: "Import Error",
    es: "Error de importación",
  },
  coverImportError: {
    en: "Cover Import Error",
    es: "Error al importar portada",
  },
  importBook: {
    en: "Import Book",
    es: "Importar libro",
  },
  tutorialSkipText: {
    en: "Skip",
    es: "Omitir",
  },
  tutorialCheckboxLabel: {
    en: "Don't show this tutorial again",
    es: "No volver a mostrar este tutorial",
  },
  tutorialStartReading: {
    en: "Start Reading",
    es: "Comenzar a leer",
  },
  tutorialNext: {
    en: "Next",
    es: "Siguiente",
  },
  tutorialSwipeTitle: {
    en: "Swipe to Navigate",
    es: "Deslizar para navegar",
  },
  tutorialSwipeDesc: {
    en: "Swipe left or right on the middle word to rewind or fast forward. Move your finger further to scrub faster.",
    es: "Desliza a la izquierda o derecha en la palabra central para retroceder o avanzar. Mueve el dedo más lejos para avanzar más rápido.",
  },
  tutorialZoomTitle: {
    en: "Zoom Out Context",
    es: "Ver contexto",
  },
  tutorialZoomDesc: {
    en: "Long press the middle word to zoom out and view the surrounding paragraph context.",
    es: "Mantén presionada la palabra central para alejar y ver el contexto del párrafo circundante.",
  },
  tutorialSpeedTitle: {
    en: "Set Favorite Speed",
    es: "Ajustar velocidad favorita",
  },
  tutorialSpeedDesc: {
    en: "Adjust speed easily:\n• Long press the WPM indicator to save your favorite speed.\n• Double tap the WPM indicator to restore your favorite speed.",
    es: "Ajusta la velocidad fácilmente:\n• Mantén presionado el indicador de WPM para guardar tu velocidad favorita.\n• Toca dos veces el indicador de WPM para restaurar tu velocidad favorita.",
  },
  tutorialControlsTitle: {
    en: "Interface Controls",
    es: "Controles de interfaz",
  },
  tutorialControlsDesc: {
    en: "A- / A+ adjusts font size. The bottom controls allow play/pause, manual WPM adjustments, and chapter skipping.",
    es: "A- / A+ ajustan el tamaño de fuente. Los controles inferiores permiten reproducir/pausar, ajustar WPM manualmente y saltar capítulos.",
  },
  tutorialReadyTitle: {
    en: "Ready to Read!",
    es: "¡Listo para leer!",
  },
  tutorialReadyDesc: {
    en: "You are all set to start reading! Enjoy your speed reading experience.",
    es: "¡Ya está todo listo para comenzar a leer! Disfruta tu experiencia de lectura rápida.",
  },
  emptyLibraryText: {
    en: "Your library is empty.",
    es: "Tu biblioteca está vacía.",
  },
  emptyLibrarySubText: {
    en: "Tap the import icon at the bottom dock to select EPUB, PDF or TXT files.",
    es: "Toca el ícono de importar en la barra inferior para seleccionar archivos EPUB, PDF o TXT.",
  },
  selectAccentColor: {
    en: "Select Accent Color",
    es: "Seleccionar color de acento",
  },
  customSpectrum: {
    en: "Custom Spectrum",
    es: "Espectro personalizado",
  },
};

export const t = (key: string): string => {
  const entry = translations[key];
  if (!entry) return key;
  return isSpanish ? entry.es : entry.en;
};

export const tArray = (key: string): string[] => {
  const entry = translations[key];
  if (!entry) return [key];
  return isSpanish ? entry.es : entry.en;
};
