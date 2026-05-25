import * as FileSystem from "expo-file-system/legacy";
import { extractText, isAvailable } from "expo-pdf-text-extract";
import JSZip from "jszip";
import { Alert } from "react-native";
import PdfThumbnail from "react-native-pdf-thumbnail";
import { t, tArray } from "./translations";

export const getBookCacheUri = (bookId: string) => {
  const parts = bookId.split("/");
  const filename = parts[parts.length - 1];
  return FileSystem.documentDirectory + "cache_" + filename + ".json";
};

// Calculate the middle letter index of a word
export const getMiddleIndex = (word: string) => {
  return Math.floor(word.length / 2);
};

export const extractEpubCover = async (uri: string) => {
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    let coverFile: any = null;
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
      const base64 = await coverFile.async("base64");
      const ext = coverFile.name.split(".").pop().toLowerCase();
      const mime = ext === "png" ? "image/png" : "image/jpeg";
      return `data:${mime};base64,${base64}`;
    }
  } catch (e) {
    console.log("Failed to extract cover", e);
  }
  return null;
};

export const extractPdfCover = async (uri: string) => {
  try {
    const result = await PdfThumbnail.generate(uri, 0);
    if (result && result.uri) {
      const base64 = await FileSystem.readAsStringAsync(result.uri, {
        encoding: "base64",
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
    Alert.alert(t("pdfCoverError"), (e as any).message || String(e));
  }
  return null;
};

export const decodeHTMLEntities = (text: string) => {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&ldquo;/gi, "“")
    .replace(/&rdquo;/gi, "”")
    .replace(/&lsquo;/gi, "‘")
    .replace(/&rsquo;/gi, "’")
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/&#8212;/g, "—")
    .replace(/&#8211;/g, "–")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8217;/g, "’")
    .replace(/&#171;/g, "«")
    .replace(/&#187;/g, "»")
    .replace(/&#x2014;/gi, "—")
    .replace(/&#x2013;/gi, "–");
};

export const extractWordsAndDialogue = async (text: string) => {
  let inDialogue = false;
  const words: string[] = [];
  const flags: boolean[] = [];

  const tokens = text.split(/(\s+)/);
  const totalTokens = tokens.length;
  const chunkSize = 5000;

  for (let i = 0; i < totalTokens; i += chunkSize) {
    const end = Math.min(i + chunkSize, totalTokens);
    for (let j = i; j < end; j++) {
      const token = tokens[j];
      if (token.includes("\n")) {
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
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return { words, flags };
};

// Very basic EPUB parser using JSZip
export const parseEpub = async (uri: string) => {
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    let words: string[] = [];
    let dialogueFlags: boolean[] = [];
    let chapterMarkers: { index: number; title: string }[] = [];

    // Simplistic extraction: just read all HTML/XHTML files and strip tags
    for (const [filename, file] of Object.entries(zip.files)) {
      if (
        !file.dir &&
        (filename.endsWith(".html") ||
          filename.endsWith(".xhtml") ||
          filename.endsWith(".htm"))
      ) {
        const content = await file.async("string");
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
        const textWithNewlines = content.replace(
          /<\/p>|<br\s*\/?>|<\/div>/gi,
          "\n",
        );
        const strippedHtml = textWithNewlines.replace(/<[^>]+>/g, " ");
        const cleanText = decodeHTMLEntities(strippedHtml);

        const { words: chapterWords, flags: chapterFlags } =
          await extractWordsAndDialogue(cleanText);

        if (chapterWords.length > 0) {
          chapterMarkers.push({ index: words.length, title: chapterTitle }); // Index where this chapter starts
          words = words.concat(chapterWords);
          dialogueFlags = dialogueFlags.concat(chapterFlags);
        }
      }
    }
    return {
      words,
      dialogueFlags,
      chapterMarkers:
        chapterMarkers.length > 0
          ? chapterMarkers
          : [{ index: 0, title: "Book" }],
    };
  } catch (e) {
    console.error("Error parsing EPUB:", e);
    return {
      words: ["Error", "parsing", "EPUB", "file."],
      dialogueFlags: [false, false, false, false],
      chapterMarkers: [{ index: 0, title: "Error" }],
    };
  }
};

export const parseTxt = async (uri: string) => {
  try {
    const response = await fetch(uri);
    const text = await response.text();
    const cleanText = decodeHTMLEntities(text);
    const { words, flags } = await extractWordsAndDialogue(cleanText);
    return {
      words,
      dialogueFlags: flags,
      chapterMarkers: [{ index: 0, title: "Full Text" }],
    };
  } catch (e) {
    console.error("Error parsing TXT:", e);
    return {
      words: ["Error", "parsing", "TXT", "file."],
      dialogueFlags: [false, false, false, false],
      chapterMarkers: [{ index: 0, title: "Error" }],
    };
  }
};

export const parsePdf = async (uri: string) => {
  try {
    if (!isAvailable()) {
      return {
        words: tArray("pdfExtractionUnavailable"),
        dialogueFlags: [],
        chapterMarkers: [{ index: 0, title: "PDF" }],
      };
    }
    const text = await extractText(uri);
    const cleanText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const { words, flags } = await extractWordsAndDialogue(cleanText);
    return {
      words:
        words.length > 0
          ? words
          : tArray("pdfEmptyText"),
      dialogueFlags: flags,
      chapterMarkers: [{ index: 0, title: "PDF" }],
    };
  } catch (e) {
    console.error("Error parsing PDF:", e);
    const errorPrefix = tArray("pdfReadError");
    return {
      words: [...errorPrefix, (e as any).message || String(e)],
      dialogueFlags: [],
      chapterMarkers: [{ index: 0, title: "Error" }],
    };
  }
};
