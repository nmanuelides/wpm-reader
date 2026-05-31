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

    // Find the OPF file path using META-INF/container.xml
    let opfPath = "";
    const containerFile = zip.file("META-INF/container.xml");
    if (containerFile) {
      try {
        const containerContent = await containerFile.async("string");
        const match = containerContent.match(/full-path="([^"]+)"/i);
        if (match) {
          opfPath = match[1];
        }
      } catch (e) {
        console.log("Error reading container.xml:", e);
      }
    }

    // Fallback: search zip for any .opf file
    if (!opfPath) {
      for (const filename of Object.keys(zip.files)) {
        if (filename.endsWith(".opf")) {
          opfPath = filename;
          break;
        }
      }
    }

    const htmlFiles: { filename: string; file: any }[] = [];

    if (opfPath) {
      const opfFile = zip.file(opfPath);
      if (opfFile) {
        try {
          const opfContent = await opfFile.async("string");

          // Extract manifest items: <item id="id" href="href" .../>
          const manifestMap: Record<string, string> = {};
          const itemMatches = opfContent.match(/<item\s+[^>]*>/gi) || [];
          for (const itemTag of itemMatches) {
            const idMatch = itemTag.match(/id="([^"]+)"/i);
            const hrefMatch = itemTag.match(/href="([^"]+)"/i);
            if (idMatch && hrefMatch) {
              manifestMap[idMatch[1]] = hrefMatch[1];
            }
          }

          // Extract spine items: <itemref idref="id"/>
          const spineIdrefs: string[] = [];
          const itemrefMatches = opfContent.match(/<itemref\s+[^>]*>/gi) || [];
          for (const itemrefTag of itemrefMatches) {
            const idrefMatch = itemrefTag.match(/idref="([^"]+)"/i);
            if (idrefMatch) {
              spineIdrefs.push(idrefMatch[1]);
            }
          }

          const opfDir = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";

          // Load files in spine order
          for (const idref of spineIdrefs) {
            const href = manifestMap[idref];
            if (href) {
              let relativePath = decodeURIComponent(href);
              let fullPath = opfDir + relativePath;

              if (relativePath.startsWith("../")) {
                const opfDirParts = opfPath.split("/");
                opfDirParts.pop(); // remove filename
                const relParts = relativePath.split("/");
                while (relParts[0] === "..") {
                  relParts.shift();
                  opfDirParts.pop();
                }
                fullPath = (opfDirParts.length > 0 ? opfDirParts.join("/") + "/" : "") + relParts.join("/");
              }

              const file = zip.file(fullPath);
              if (file) {
                htmlFiles.push({ filename: fullPath, file });
              } else {
                // Try case-insensitive search if exact match fails
                const lowerFullPath = fullPath.toLowerCase();
                let foundFile = null;
                for (const [name, zipFile] of Object.entries(zip.files)) {
                  if (name.toLowerCase() === lowerFullPath) {
                    foundFile = { filename: name, file: zipFile };
                    break;
                  }
                }
                if (foundFile) {
                  htmlFiles.push(foundFile);
                }
              }
            }
          }
        } catch (e) {
          console.log("Error parsing content.opf spine:", e);
        }
      }
    }

    // Fallback: if spine parsing yielded no HTML files, default to scanning the whole zip
    if (htmlFiles.length === 0) {
      for (const [filename, file] of Object.entries(zip.files)) {
        if (
          !file.dir &&
          (filename.endsWith(".html") ||
            filename.endsWith(".xhtml") ||
            filename.endsWith(".htm"))
        ) {
          htmlFiles.push({ filename, file });
        }
      }
    }

    const isTOCorMetadataTitle = (title: string) => {
      const lower = title.toLowerCase().trim();
      if (!lower) return false;
      
      const exactMatches = [
        "guide", "guía", "guia", "chapter guide", "reading guide", "guía de lectura", "guia de lectura", "guía de capítulos", "guia de capitulos",
        "table of contents", "table of content", "tabla de contenido", "tabla de contenidos", "tabla de materias",
        "toc", "nav", "index", "indice", "índice", "contents", "contenido", "navigation", "indice general", "índice general",
        "cover", "portada", "copyright", "about", "landmark", "landmarks", "sommaire", "resumen", "sinopsis", "synopsis",
        "title page", "página de título", "copyright notice", "introduction", "introducción", "introduccion",
        "créditos", "creditos", "página de créditos", "pagina de creditos"
      ];
      if (exactMatches.includes(lower)) {
        return true;
      }

      const startsWithKeywords = [
        "table of ", "tabla de ", "index of ", "indice de ", "índice de ", 
        "copyright ", "notice of "
      ];
      if (startsWithKeywords.some(kw => lower.startsWith(kw))) {
        return true;
      }

      return false;
    };

    const parseFiles = async (filesList: typeof htmlFiles, skipMetadata: boolean) => {
      let words: string[] = [];
      let dialogueFlags: boolean[] = [];
      let chapterMarkers: { index: number; title: string }[] = [];

      for (const { filename, file } of filesList) {
        const basename = filename.split("/").pop()?.split(".")[0]?.toLowerCase() || "";
        if (skipMetadata) {
          // Skip files with metadata/TOC/guide names
          const exacts = [
            "toc", "nav", "cover", "titlepage", "copyright", "notice", "guide", "landmark", "landmarks", "about", "index", "contents",
            "indice", "contenido", "guia", "portada", "prologo", "introduccion"
          ];
          
          const safeSubstrings = [
            "chapterguide", "guidebook", "tableofcontents", "contentspage", "titlepage", "copyright", "notice", "landmark", "metadata",
            "guiadelectura"
          ];

          const parts = basename.split(/[-_\d]/);
          const isTOCorMetadataFile = exacts.includes(basename) ||
            safeSubstrings.some(sub => basename.replace(/[-_]/g, "").includes(sub)) ||
            parts.some(part => exacts.includes(part));

          if (isTOCorMetadataFile) {
            continue;
          }
        }

        const content = await file.async("string");
        // Extract headings
        const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
        const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        const h2Match = content.match(/<h2[^>]*>([^<]+)<\/h2>/i);

        const tTitle = titleMatch ? titleMatch[1].trim() : "";
        const h1Title = h1Match ? h1Match[1].trim() : "";
        const h2Title = h2Match ? h2Match[1].trim() : "";

        if (skipMetadata) {
          // Skip if any heading indicates TOC or metadata
          if (
            isTOCorMetadataTitle(tTitle) ||
            isTOCorMetadataTitle(h1Title) ||
            isTOCorMetadataTitle(h2Title)
          ) {
            continue;
          }
        }

        // Determine displayed chapter title
        let chapterTitle = `Chapter ${chapterMarkers.length + 1}`;
        if (h1Title) {
          chapterTitle = h1Title;
        } else if (h2Title) {
          chapterTitle = h2Title;
        } else if (tTitle) {
          chapterTitle = tTitle;
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

        if (skipMetadata) {
          const linkCount = (content.match(/<a\s+[^>]*href=/gi) || []).length;
          // Skip links-heavy Table of Contents pages
          if (linkCount > 6 && chapterWords.length > 0) {
            const wordsPerLink = chapterWords.length / linkCount;
            if (wordsPerLink < 35) {
              continue;
            }
          }
        }

        if (chapterWords.length > 0) {
          chapterMarkers.push({ index: words.length, title: chapterTitle }); // Index where this chapter starts
          words = words.concat(chapterWords);
          dialogueFlags = dialogueFlags.concat(chapterFlags);
        }
      }

      return { words, dialogueFlags, chapterMarkers };
    };

    // First try: parse while skipping TOC and metadata files
    let result = await parseFiles(htmlFiles, true);
    if (result.words.length === 0) {
      // Fallback: parse everything if filtering left us with an empty book
      result = await parseFiles(htmlFiles, false);
    }

    return {
      words: result.words,
      dialogueFlags: result.dialogueFlags,
      chapterMarkers:
        result.chapterMarkers.length > 0
          ? result.chapterMarkers
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
