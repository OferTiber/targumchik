// Content script for Targumchik extension
(function() {
  'use strict';

  let currentPopup = null;
  let autoCloseTimer = null;
  let isTranslating = false;
  let isHoveringOverPopup = false;
  let dragCleanupFns = [];

  // Listen for keyboard shortcut: Cmd+Option+Ctrl
  document.addEventListener('keydown', function(event) {
    if (event.metaKey && event.altKey && event.ctrlKey) {
      event.preventDefault();
      const selectedText = getSelectedText();
      if (selectedText) {
        translateText(selectedText);
      }
    }
  });

  // Listen for custom event from context menu (try both document and window)
  function handleContextTranslation(event) {
    console.log('Received morfixTranslateFromContext event:', event.detail);
    const selectedText = event.detail.selectedText;
    if (selectedText) {
      console.log('Translating text from context menu:', selectedText);
      translateText(selectedText);
    }
  }
  
  document.addEventListener('morfixTranslateFromContext', handleContextTranslation);
  window.addEventListener('morfixTranslateFromContext', handleContextTranslation);

  // Add a message to confirm content script is loaded
  console.log('Targumchik content script loaded on:', window.location.href);
  
  // Test if keyboard shortcut works
  console.log('Testing keyboard shortcut detection...');
  
  // Text-to-speech function
  function speakText(text, button) {
    console.log('Speaking text:', text);
    
    if (!window.speechSynthesis) {
      console.error('Speech synthesis not supported');
      alert('Text-to-speech is not supported in this browser');
      return;
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Create speech utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure speech settings
    utterance.lang = 'en-US';
    utterance.rate = 0.8;  // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Visual feedback - highlight the speaker button
    const originalText = button.textContent;
    
    // Change to playing icon
    button.textContent = '🔈';
    button.style.background = 'rgba(74, 144, 226, 0.2)';
    
    // Reset when speech ends
    utterance.onend = () => {
      button.textContent = originalText;
      button.style.background = '';
      console.log('Speech ended');
    };
    
    utterance.onerror = (event) => {
      button.textContent = originalText;
      button.style.background = '';
      console.error('Speech error:', event.error);
    };
    
    // Start speaking
    window.speechSynthesis.speak(utterance);
    console.log('Speech started');
  }

  // Get selected text from the page
  function getSelectedText() {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    return text;
  }

  // Main translation function
  async function translateText(text) {
    console.log('translateText called with:', text);
    
    if (!text) {
      console.log('No text provided, returning');
      return;
    }

    // Prevent duplicate translations
    if (isTranslating) {
      console.log('Already translating, ignoring duplicate request');
      return;
    }
    
    isTranslating = true;
    console.log('Setting isTranslating to true');

    console.log('Removing current popup if exists');
    // Prevent duplicate popups
    if (currentPopup) {
      removeCurrentPopup();
    }

    console.log('Showing loading popup');
    // Show loading popup
    showLoadingPopup(text);

    try {
      console.log('Fetching translations from Morfix...');
      const translations = await fetchMorfixTranslations(text);
      console.log('Translations received:', translations);
      showTranslationPopup(text, translations);
    } catch (error) {
      console.error('Translation error:', error);
      showErrorPopup(text);
    } finally {
      isTranslating = false;
      console.log('Setting isTranslating to false');
    }
  }

  // Fetch translations from Morfix
  async function fetchMorfixTranslations(text) {
    const encodedText = encodeURIComponent(text);
    const url = `https://www.morfix.co.il/${encodedText}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    return parseTranslations(html);
  }

  // Parse translations from Morfix HTML
  function parseTranslations(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const translations = [];
    const translationBlocks = doc.querySelectorAll('.Translation_content_enTohe');
    
    translationBlocks.forEach(block => {
      const englishWord = block.querySelector('.Translation_spTop_enTohe');
      const partOfSpeech = block.querySelector('.Translation_sp2Top_enTohe');
      const hebrewMeanings = block.querySelectorAll('.normal_translation_div');
      const sampleSentences = block.querySelectorAll('.SampleSentences_text');
      
      if (englishWord && hebrewMeanings.length > 0) {
        const meanings = Array.from(hebrewMeanings).map(div => div.innerText.trim()).filter(text => text);
        const sentences = Array.from(sampleSentences).map(div => div.innerHTML.trim()).filter(text => text);
        
        translations.push({
          english: englishWord.innerText.trim(),
          partOfSpeech: partOfSpeech ? partOfSpeech.innerText.trim() : '',
          hebrew: meanings,
          sampleSentences: sentences
        });
      }
    });
    
    return translations;
  }

  // Show loading popup
  function showLoadingPopup(text) {
    console.log('showLoadingPopup called with:', text);
    try {
      const popup = createPopupElement();
      console.log('Popup element created:', popup);
      
      popup.innerHTML = `
        <div class="targumchik-header">
          <strong>Targumchik</strong>
          <button class="targumchik-close">&times;</button>
        </div>
        <div class="targumchik-content">
          <div class="targumchik-loading">
            <div class="targumchik-spinner"></div>
            <p>Translating "${text}"...</p>
          </div>
        </div>
      `;
      
      console.log('Popup innerHTML set, adding to page');
      addPopupToPage(popup);
      console.log('Loading popup should now be visible');
    } catch (error) {
      console.error('Error in showLoadingPopup:', error);
    }
  }

  // Show translation results popup
  function showTranslationPopup(originalText, translations) {
    if (currentPopup) {
      removeCurrentPopup();
    }

    const popup = createPopupElement();
    
    let content = `
      <div class="targumchik-header">
        <strong>Targumchik</strong>
        <button class="targumchik-close">&times;</button>
      </div>
      <div class="targumchik-content">
    `;

    if (translations.length === 0) {
      content += `
        <div class="targumchik-no-results">
          <p>No translations found for "${originalText}"</p>
        </div>
      `;
    } else {
              translations.forEach((translation, index) => {
          content += `
            <div class="targumchik-translation">
              <div class="targumchik-english">
                ${translation.english}
                <button class="targumchik-speaker" data-text="${translation.english.replace(/"/g, '&quot;')}" data-index="${index}" title="Listen to pronunciation">
                  🔊
                </button>
                ${translation.partOfSpeech ? `<span class="targumchik-pos">(${translation.partOfSpeech})</span>` : ''}
              </div>
              <div class="targumchik-hebrew">
                ${translation.hebrew.join(', ')}
              </div>
              ${translation.sampleSentences && translation.sampleSentences.length > 0 ? `
                <div class="targumchik-sample-sentences">
                  <div class="targumchik-sample-title">Sample sentences:</div>
                  ${translation.sampleSentences.map(sentence => `
                    <div class="targumchik-sample-sentence">${sentence}</div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `;
        });
    }

    const encodedText = encodeURIComponent(originalText);
    const morfixLogoUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('morfix_logo.svg')
      : 'morfix_logo.svg';
    content += `
      </div>
      <div class="targumchik-footer">
        <a href="https://www.morfix.co.il/${encodedText}" target="_blank" class="targumchik-morfix-link" rel="noopener noreferrer">
          <span>תרגום מלא ב-</span>
          <img src="${morfixLogoUrl}" alt="Morfix" class="targumchik-morfix-logo" />
        </a>
      </div>
    `;

    popup.innerHTML = content;
    addPopupToPage(popup);
    startAutoCloseTimer();
  }

  // Show error popup
  function showErrorPopup(text) {
    if (currentPopup) {
      removeCurrentPopup();
    }

    const popup = createPopupElement();
    popup.innerHTML = `
      <div class="targumchik-header">
        <strong>Targumchik</strong>
        <button class="targumchik-close">&times;</button>
      </div>
      <div class="targumchik-content">
        <div class="targumchik-error">
          <p>Sorry, couldn't translate "${text}". Please try again.</p>
        </div>
      </div>
    `;
    
    addPopupToPage(popup);
    startAutoCloseTimer();
  }

  // Create popup element with styling
  function createPopupElement() {
    console.log('createPopupElement called');
    try {
      // Remove any existing popup styles
      const existingStyle = document.getElementById('targumchik-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
      
      // Create and inject styles into head
      const styleElement = document.createElement('style');
      styleElement.id = 'targumchik-styles';
      styleElement.textContent = `
        #targumchik-popup {
          position: fixed !important;
          top: 20px !important;
          right: 20px !important;
          width: 350px !important;
          max-width: 350px !important;
          max-height: 400px !important;
          background: white !important;
          border: 1px solid #ddd !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
          z-index: 2147483647 !important;
          font-family: Arial, sans-serif !important;
          font-size: 14px !important;
          overflow: hidden !important;
          display: flex !important;
          flex-direction: column !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        .targumchik-header {
          background: #4a90e2 !important;
          color: white !important;
          padding: 12px 15px !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          font-weight: bold !important;
          margin: 0 !important;
          cursor: move !important;
          -webkit-user-select: none !important;
          user-select: none !important;
          flex-shrink: 0 !important;
        }
        
        .targumchik-close {
          background: none !important;
          border: none !important;
          color: white !important;
          font-size: 18px !important;
          cursor: pointer !important;
          padding: 0 !important;
          width: 20px !important;
          height: 20px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        
        .targumchik-close:hover {
          background: rgba(255, 255, 255, 0.2) !important;
          border-radius: 3px !important;
        }
        
        .targumchik-content {
          padding: 15px !important;
          flex: 1 1 auto !important;
          min-height: 0 !important;
          overflow-y: auto !important;
        }
        
        .targumchik-loading {
          text-align: center !important;
          padding: 20px !important;
        }
        
        .targumchik-spinner {
          border: 3px solid #f3f3f3 !important;
          border-top: 3px solid #4a90e2 !important;
          border-radius: 50% !important;
          width: 30px !important;
          height: 30px !important;
          animation: spin 1s linear infinite !important;
          margin: 0 auto 15px !important;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .targumchik-translation {
          margin-bottom: 15px !important;
          padding-bottom: 15px !important;
          border-bottom: 1px solid #eee !important;
        }
        
        .targumchik-translation:last-child {
          border-bottom: none !important;
          margin-bottom: 0 !important;
        }
        
        .targumchik-english {
          font-weight: bold !important;
          margin-bottom: 5px !important;
          color: #333 !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }
        
        .targumchik-speaker {
          background: none !important;
          border: none !important;
          font-size: 16px !important;
          cursor: pointer !important;
          padding: 2px 4px !important;
          border-radius: 3px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: background-color 0.2s ease !important;
        }
        
        .targumchik-speaker:hover {
          background: rgba(74, 144, 226, 0.1) !important;
        }
        
        .targumchik-speaker:active {
          background: rgba(74, 144, 226, 0.2) !important;
          transform: scale(0.95) !important;
        }
        
        .targumchik-pos {
          font-weight: normal !important;
          color: #666 !important;
          font-style: italic !important;
        }
        
        .targumchik-hebrew {
          color: #2c5aa0 !important;
          line-height: 1.4 !important;
          direction: rtl !important;
          text-align: right !important;
        }
        
        .targumchik-sample-sentences {
          margin-top: 10px !important;
          padding-top: 10px !important;
          border-top: 1px solid #f0f0f0 !important;
        }
        
        .targumchik-sample-title {
          font-size: 12px !important;
          color: #666 !important;
          font-weight: bold !important;
          margin-bottom: 6px !important;
        }
        
        .targumchik-sample-sentence {
          font-size: 12px !important;
          color: #555 !important;
          line-height: 1.3 !important;
          margin-bottom: 4px !important;
          padding: 4px 8px !important;
          background: #f8f9fa !important;
          border-radius: 4px !important;
          font-style: italic !important;
        }
        
        .targumchik-sample-sentence b {
          color: #2c5aa0 !important;
          font-weight: bold !important;
          background: rgba(44, 90, 160, 0.1) !important;
          padding: 1px 2px !important;
          border-radius: 2px !important;
          font-style: normal !important;
        }
        
        .targumchik-sample-sentence:last-child {
          margin-bottom: 0 !important;
        }
        
        .targumchik-footer {
          background: #fff !important;
          padding: 10px 15px !important;
          border-top: 1px solid #eee !important;
          text-align: center !important;
          flex-shrink: 0 !important;
        }
        
        .targumchik-footer a {
          direction: rtl !important;
          color: #4a90e2 !important;
          text-decoration: none !important;
          font-size: 13px !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 10px !important;
          transition: background-color 0.2s ease !important;
        }
        
        .targumchik-footer a:hover {
          text-decoration: underline !important;
          background-color:rgb(223, 235, 250) !important;
        }

        .targumchik-morfix-logo {
        position:relative;
        top:2px;
          width: auto !important;
          height: 16px !important;
          display: inline-block !important;
          vertical-align: middle !important;
        }
        
        .targumchik-no-results,
        .targumchik-error {
          text-align: center !important;
          color: #666 !important;
          padding: 20px !important;
        }
      `;
      
      document.head.appendChild(styleElement);
      console.log('Styles injected into head');
      
            // Now create the popup element
      const popup = document.createElement('div');
      popup.id = 'targumchik-popup';
      console.log('Created div element with ID:', popup.id);
      
      // The content will be added by the specific show functions (showLoadingPopup, showTranslationPopup, etc.)
      console.log('Popup element created successfully with styles');
      return popup;
    } catch (error) {
      console.error('Error in createPopupElement:', error);
      // Return a basic popup without styles as fallback
      const fallbackPopup = document.createElement('div');
      fallbackPopup.id = 'targumchik-popup';
      fallbackPopup.style.cssText = 'position:fixed;top:20px;right:20px;width:300px;background:white;border:1px solid #ccc;padding:10px;z-index:10000;';
      return fallbackPopup;
    }
  }

  // Add popup to page and set up event listeners
  function addPopupToPage(popup) {
    console.log('addPopupToPage called');
    try {
      currentPopup = popup;
      
      // Try creating an isolated container
      let container = document.getElementById('targumchik-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'targumchik-container';
        container.style.cssText = `
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          pointer-events: none !important;
          z-index: 2147483647 !important;
        `;
        document.body.appendChild(container);
        console.log('Created isolated container');
      }
      
      // Set inline styles as additional safeguard
      popup.style.cssText = `
        position: absolute !important;
        top: 20px !important;
        right: 20px !important;
        z-index: 2147483647 !important;
        width: 350px !important;
        max-height: 80vh !important;
        background: white !important;
        border: 1px solid #ddd !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
        display: flex !important;
        flex-direction: column !important;
        visibility: visible !important;
        pointer-events: auto !important;
        overflow: hidden !important;
      `;
      
      console.log('About to append popup to container');
      container.appendChild(popup);
      console.log('Popup appended to container');
      
      // Check if popup is actually in the DOM and debug positioning
      const existingPopup = document.getElementById('targumchik-popup');
      console.log('Popup exists in DOM:', !!existingPopup);
      if (existingPopup) {
        console.log('Popup element:', existingPopup);
        const rect = existingPopup.getBoundingClientRect();
        console.log('Popup getBoundingClientRect:', rect);
        console.log('Popup position - top:', rect.top, 'right:', window.innerWidth - rect.right);
        
        // Check computed styles
        const computedStyle = window.getComputedStyle(existingPopup);
        console.log('Computed position:', computedStyle.position);
        console.log('Computed display:', computedStyle.display);
        console.log('Computed z-index:', computedStyle.zIndex);
        console.log('Computed top:', computedStyle.top);
        console.log('Computed right:', computedStyle.right);
        
        // Force position with direct manipulation
        console.log('Forcing position with direct style manipulation...');
        existingPopup.style.setProperty('position', 'fixed', 'important');
        existingPopup.style.setProperty('top', '20px', 'important');
        existingPopup.style.setProperty('right', '20px', 'important');
        existingPopup.style.setProperty('z-index', '2147483647', 'important');
        existingPopup.style.setProperty('width', '350px', 'important');
        
        // Check position after forcing
        const newRect = existingPopup.getBoundingClientRect();
        console.log('After forcing - getBoundingClientRect:', newRect);
        console.log('After forcing - position top:', newRect.top, 'right:', window.innerWidth - newRect.right);
      }
      
      // Add close button functionality
      const closeButton = popup.querySelector('.targumchik-close');
      if (closeButton) {
        closeButton.addEventListener('click', removeCurrentPopup);
        console.log('Close button event listener added');
      } else {
        console.log('Close button not found');
      }
      
      // Pause auto-close while hovering the popup
      const handleMouseEnter = () => {
        isHoveringOverPopup = true;
        if (autoCloseTimer) {
          clearTimeout(autoCloseTimer);
          autoCloseTimer = null;
        }
      };
      const handleMouseLeave = () => {
        isHoveringOverPopup = false;
        startAutoCloseTimer();
      };
      popup.addEventListener('mouseenter', handleMouseEnter);
      popup.addEventListener('mouseleave', handleMouseLeave);

      // Add speaker button functionality
      const speakerButtons = popup.querySelectorAll('.targumchik-speaker');
      speakerButtons.forEach((button) => {
        button.addEventListener('click', function() {
          const text = this.getAttribute('data-text');
          const index = this.getAttribute('data-index');
          console.log('Speaker button clicked for text:', text, 'index:', index);
          speakText(text, this);
        });
      });
      console.log('Added event listeners to', speakerButtons.length, 'speaker buttons');
      
      // Close on escape key
      document.addEventListener('keydown', handleEscapeKey);
      document.addEventListener('mousedown', handleOutsidePointerEvent, true);
      document.addEventListener('touchstart', handleOutsidePointerEvent, true);
      console.log('Popup should now be visible on page');

      // Enable dragging by header
      try {
        const header = popup.querySelector('.targumchik-header');
        if (header) {
          let isDragging = false;
          let dragStartX = 0;
          let dragStartY = 0;
          let startTop = 0;
          let startLeft = 0;

          const getNumber = (value) => parseFloat(String(value).replace('px', '')) || 0;

          const beginDrag = (pageX, pageY) => {
            const rect = popup.getBoundingClientRect();
            // Ensure popup uses left instead of right while dragging for consistent math
            const computed = window.getComputedStyle(popup);
            const topVal = computed.top;
            const leftVal = computed.left;
            const rightVal = computed.right;
            let left = getNumber(leftVal);
            if (!left && rightVal && rightVal !== 'auto') {
              // Convert right to left
              left = Math.max(0, window.innerWidth - rect.width - getNumber(rightVal));
            }
            popup.style.setProperty('left', left + 'px', 'important');
            popup.style.setProperty('right', 'auto', 'important');
            popup.style.setProperty('top', getNumber(topVal || rect.top) + 'px', 'important');

            isDragging = true;
            dragStartX = pageX;
            dragStartY = pageY;
            startTop = getNumber(popup.style.top);
            startLeft = getNumber(popup.style.left);
            // Prevent text selection while dragging
            document.body.style.userSelect = 'none';
          };

          const onPointerMove = (pageX, pageY) => {
            if (!isDragging) return;
            const deltaX = pageX - dragStartX;
            const deltaY = pageY - dragStartY;
            let nextLeft = startLeft + deltaX;
            let nextTop = startTop + deltaY;
            // Clamp to viewport
            const rect = popup.getBoundingClientRect();
            const maxLeft = Math.max(0, window.innerWidth - rect.width);
            const maxTop = Math.max(0, window.innerHeight - rect.height);
            nextLeft = Math.min(Math.max(0, nextLeft), maxLeft);
            nextTop = Math.min(Math.max(0, nextTop), maxTop);
            popup.style.setProperty('left', nextLeft + 'px', 'important');
            popup.style.setProperty('top', nextTop + 'px', 'important');
          };

          const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            document.body.style.userSelect = '';
          };

          // Mouse events
          const onMouseDown = (e) => {
            if (e.button !== 0) return; // left button only
            e.preventDefault();
            beginDrag(e.pageX, e.pageY);
          };
          const onMouseMove = (e) => onPointerMove(e.pageX, e.pageY);
          const onMouseUp = endDrag;
          header.addEventListener('mousedown', onMouseDown);
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
          dragCleanupFns.push(() => header.removeEventListener('mousedown', onMouseDown));
          dragCleanupFns.push(() => window.removeEventListener('mousemove', onMouseMove));
          dragCleanupFns.push(() => window.removeEventListener('mouseup', onMouseUp));

          // Touch events
          const onTouchStart = (e) => {
            const t = e.touches[0];
            if (!t) return;
            e.preventDefault();
            beginDrag(t.pageX, t.pageY);
          };
          const onTouchMove = (e) => {
            const t = e.touches[0];
            if (!t) return;
            onPointerMove(t.pageX, t.pageY);
          };
          const onTouchEnd = endDrag;
          const onTouchCancel = endDrag;
          header.addEventListener('touchstart', onTouchStart, { passive: false });
          window.addEventListener('touchmove', onTouchMove, { passive: false });
          window.addEventListener('touchend', onTouchEnd);
          window.addEventListener('touchcancel', onTouchCancel);
          dragCleanupFns.push(() => header.removeEventListener('touchstart', onTouchStart));
          dragCleanupFns.push(() => window.removeEventListener('touchmove', onTouchMove));
          dragCleanupFns.push(() => window.removeEventListener('touchend', onTouchEnd));
          dragCleanupFns.push(() => window.removeEventListener('touchcancel', onTouchCancel));
        }
      } catch (dragErr) {
        console.error('Error enabling drag:', dragErr);
      }
    } catch (error) {
      console.error('Error in addPopupToPage:', error);
    }
  }

  // Handle escape key to close popup
  function handleEscapeKey(event) {
    if (event.key === 'Escape' && currentPopup) {
      removeCurrentPopup();
    }
  }

  // Close when clicking/touching outside the popup
  function handleOutsidePointerEvent(event) {
    if (!currentPopup) {
      return;
    }
    const target = event.target;
    if (currentPopup.contains(target)) {
      return; // Click inside popup - ignore
    }
    removeCurrentPopup();
  }

  // Remove current popup
  function removeCurrentPopup() {
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }
    
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
    
    document.removeEventListener('keydown', handleEscapeKey);
    document.removeEventListener('mousedown', handleOutsidePointerEvent, true);
    document.removeEventListener('touchstart', handleOutsidePointerEvent, true);
    isHoveringOverPopup = false;
    // Cleanup drag listeners
    if (dragCleanupFns && dragCleanupFns.length) {
      try {
        dragCleanupFns.forEach((fn) => {
          try { fn(); } catch (_) {}
        });
      } finally {
        dragCleanupFns = [];
      }
    }
  }

  // Start auto-close timer
  function startAutoCloseTimer() {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
    }
    // Do not schedule auto-close while hovered
    if (isHoveringOverPopup || !currentPopup) {
      return;
    }
    autoCloseTimer = setTimeout(() => {
      if (!isHoveringOverPopup) {
        removeCurrentPopup();
      }
      // If hovered at the moment of firing, do nothing.
    }, 15000); // 15 seconds
  }

})(); 