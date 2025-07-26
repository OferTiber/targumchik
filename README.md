# Targumchik - Hebrew Translation Chrome Extension

**Targumchik** is a Chrome extension that translates selected English words or phrases into Hebrew using the Morfix dictionary (https://www.morfix.co.il).

## Features

- 🔤 **Instant Translation**: Select any English text and get Hebrew translations
- ⌨️ **Keyboard Shortcut**: Use `Cmd+Option+Ctrl` (Mac) to translate selected text
- 🖱️ **Context Menu**: Right-click selected text and choose "Targumchik"
- 📖 **Multiple Meanings**: Shows all parts of speech and their Hebrew translations
- 📝 **Sample Sentences**: Displays example sentences using the translated word
- 🔗 **Full Dictionary**: Link to complete Morfix page for detailed translations
- ⏱️ **Auto-close**: Popup automatically closes after 15 seconds
- 🎨 **Clean Design**: Modern, unobtrusive popup interface

## Installation

### Development Installation

1. **Download the Extension**
   - Clone or download the source code
   - Ensure you have all files: `manifest.json`, `content.js`, `background.js`, and icon files

2. **Enable Developer Mode**
   - Open Chrome and go to `chrome://extensions/`
   - Toggle "Developer mode" in the top-right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

4. **Optional: Create Icons**
   - Add `icon16.png`, `icon48.png`, and `icon128.png` to the extension folder
   - Or remove the icons section from `manifest.json` if you don't want custom icons

## Usage

### Method 1: Keyboard Shortcut
1. Select any English text on any webpage
2. Press `Cmd+Option+Ctrl` (Mac) or `Ctrl+Alt+Shift` (Windows/Linux)
3. A popup will appear with Hebrew translations

### Method 2: Context Menu
1. Select any English text on any webpage
2. Right-click the selected text
3. Choose "Targumchik" from the context menu
4. A popup will appear with Hebrew translations

### Translation Display
- **English word/phrase** with part of speech (noun, verb, etc.)
- **Hebrew translations** displayed right-to-left
- **Sample sentences** showing the word in context with the translated term highlighted (when available)
- **Link to full Morfix page** for complete dictionary entry
- **Loading indicator** while fetching translations
- **Error handling** for failed translations

## How It Works

1. **Text Selection**: The extension detects when you select text and trigger translation
2. **Morfix Query**: Constructs a URL like `https://www.morfix.co.il/{selected_text}`
3. **HTML Parsing**: Extracts translations from specific CSS classes:
   - `.Translation_content_enTohe` - translation container
   - `.Translation_spTop_enTohe` - English word/phrase
   - `.Translation_sp2Top_enTohe` - part of speech
   - `.normal_translation_div` - Hebrew meanings
   - `.SampleSentences_text` - sample sentences with highlighted terms (preserves `<b>` formatting)
4. **Popup Display**: Shows results in a floating popup with clean formatting

## Technical Details

### Permissions
- `scripting` - To inject scripts for context menu functionality
- `activeTab` - To access the current tab for text selection
- `contextMenus` - To add the right-click context menu option
- `https://www.morfix.co.il/*` - To fetch translation data from Morfix

### Files Structure
```
targumchik/
├── manifest.json       # Extension configuration
├── content.js         # Main functionality (text selection, popup, translations)
├── background.js      # Context menu registration and handling
├── README.md          # This file
└── icons/             # Optional icon files
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Troubleshooting

### No Translations Appearing
- Ensure you have selected text before using the shortcut or context menu
- Check that the selected text is in English
- Verify that Morfix.co.il is accessible from your network

### Context Menu Not Showing
- Make sure text is selected before right-clicking
- The "Targumchik" option only appears when text is selected

### Keyboard Shortcut Not Working
- Ensure you're pressing the correct combination: `Cmd+Option+Ctrl` on Mac
- Make sure text is selected before pressing the shortcut
- Check if other extensions are using the same keyboard combination

### Extension Not Loading
- Verify all files are present in the extension directory
- Check the Chrome extensions page (`chrome://extensions/`) for error messages
- Try reloading the extension

## Privacy

- The extension only sends selected text to Morfix.co.il for translation
- No personal data is collected or stored
- Translations are fetched directly from Morfix's public website

## License

This extension is provided as-is for educational and personal use. Morfix is a trademark of its respective owners.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve the extension.

---

**Note**: This extension relies on Morfix.co.il's website structure. If Morfix changes their HTML structure, the extension may need updates to continue working properly. 