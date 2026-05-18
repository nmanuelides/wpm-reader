const fs = require('fs');
let code = fs.readFileSync('app/index.tsx', 'utf8');

// Add imports
code = code.replace(/import React, \{ useState, useEffect, useRef \} from 'react';/, "import React, { useState, useEffect, useRef, useMemo } from 'react';");

// Replacements in JSX
code = code.replace(/color="#777"/g, 'color={theme.textMuted}');
code = code.replace(/color="#444"/g, 'color={theme.textDark}');
code = code.replace(/color="#666"/g, 'color={theme.textMuted}');
code = code.replace(/color="#ff4444"/g, 'color={theme.accent}');
code = code.replace(/color="#000"/g, 'color={theme.bg}');
code = code.replace(/borderColor: '#ff4444'/g, 'borderColor: theme.accent');

// Convert StyleSheet.create to getStyles function
code = code.replace(/const styles = StyleSheet.create\(\{/, 'const getStyles = (theme) => StyleSheet.create({');

// Replace hardcoded colors in styles
code = code.replace(/backgroundColor: '#121212'/g, 'backgroundColor: theme.bg');
code = code.replace(/backgroundColor: '#000000'/g, 'backgroundColor: theme.bg');
code = code.replace(/backgroundColor: '#000'/g, 'backgroundColor: theme.bg');
code = code.replace(/backgroundColor: '#1e1e1e'/g, 'backgroundColor: theme.surface');
code = code.replace(/borderColor: '#ff4444'/g, 'borderColor: theme.accent');
code = code.replace(/color: '#ff4444'/g, 'color: theme.accent');
code = code.replace(/color: '#aaa'/g, 'color: theme.textLight');
code = code.replace(/color: '#777'/g, 'color: theme.textMuted');
code = code.replace(/color: '#555'/g, 'color: theme.textMuted');
code = code.replace(/color: '#666'/g, 'color: theme.textMuted');
code = code.replace(/backgroundColor: '#333'/g, 'backgroundColor: theme.textDark');
code = code.replace(/backgroundColor: 'rgba\\(255, 0, 0, 0.8\\)'/g, 'backgroundColor: theme.accent');

// Add the modal component at the end of homeContainer
const modalJSX = `
      {/* Theme Picker Button */}
      <TouchableOpacity 
        style={styles.themeFab}
        onPress={() => setShowThemeModal(true)}
      >
        <Ionicons name="color-palette" size={28} color="#fff" />
      </TouchableOpacity>

      {showThemeModal && (
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowThemeModal(false)}>
          <View style={styles.themeModalContent}>
            <Text style={styles.themeModalTitle}>Select Accent Color</Text>
            <View style={styles.hueGrid}>
              {HUES.map(h => (
                <TouchableOpacity 
                  key={h}
                  style={[styles.hueCircle, { backgroundColor: \`hsl(\${h}, 100%, 63%)\`, borderWidth: themeHue === h ? 3 : 0 }]}
                  onPress={() => { setThemeHue(h); setShowThemeModal(false); }}
                />
              ))}
            </View>
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}
`;

code = code.replace(/<\/SafeAreaView>\n  \);\n}/g, modalJSX);

// Add styles for the new elements
const extraStyles = `
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
  }
});
`;

code = code.replace(/}\);\n*$/g, extraStyles);

// Add App setup
const appSetup = `
const HUES = [0, 30, 140, 210, 280, 330]; // Red, Orange, Green, Blue, Purple, Pink

export default function App() {
  const [books, setBooks] = useState([]);
  const [currentBook, setCurrentBook] = useState(null);
  const [words, setWords] = useState([]);
  const [chapters, setChapters] = useState([{ index: 0, title: '' }]);
  
  const [themeHue, setThemeHue] = useState(0); // 0 = Red
  const [showThemeModal, setShowThemeModal] = useState(false);
  
  const theme = useMemo(() => ({
    accent: \`hsl(\${themeHue}, 100%, 63%)\`,
    bg: \`hsl(\${themeHue}, 20%, 6%)\`,
    surface: \`hsl(\${themeHue}, 20%, 12%)\`,
    textLight: \`hsl(\${themeHue}, 15%, 70%)\`,
    textMuted: \`hsl(\${themeHue}, 15%, 50%)\`,
    textDark: \`hsl(\${themeHue}, 15%, 35%)\`,
  }), [themeHue]);

  const styles = useMemo(() => getStyles(theme), [theme]);
`;

code = code.replace(/export default function App\(\) \{\n  const \[books, setBooks\] = useState\(\[\]\);\n  const \[currentBook, setCurrentBook\] = useState\(null\);\n  const \[words, setWords\] = useState\(\[\]\);\n  const \[chapters, setChapters\] = useState\(\[\{ index: 0, title: '' \}\]\);/g, appSetup);

fs.writeFileSync('app/index.tsx', code);
console.log("Successfully replaced theme logic!");
