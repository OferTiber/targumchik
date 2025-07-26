// Background script for Targumchik extension
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu item
  chrome.contextMenus.create({
    id: "targumchik-translate",
    title: "Targumchik",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('Context menu clicked:', info.menuItemId, 'Selected text:', info.selectionText);
  
  if (info.menuItemId === "targumchik-translate" && info.selectionText) {
    console.log('Injecting script to translate:', info.selectionText);
    
    try {
      // Wait a bit to ensure content script is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Inject script to dispatch custom event with selected text
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: dispatchTranslationEvent,
        args: [info.selectionText]
      });
      
      console.log('Script injected successfully');
    } catch (error) {
      console.error('Failed to inject script:', error);
    }
  }
});

// Function to inject into the page that dispatches the custom event
function dispatchTranslationEvent(selectedText) {
  console.log('Injected script running. Dispatching translation event with text:', selectedText);
  
  // Check if document is ready
  if (document.readyState !== 'complete') {
    console.log('Document not ready, waiting...');
    document.addEventListener('DOMContentLoaded', () => {
      dispatchEvent();
    });
  } else {
    dispatchEvent();
  }
  
  function dispatchEvent() {
    try {
      const event = new CustomEvent('morfixTranslateFromContext', {
        detail: { selectedText: selectedText },
        bubbles: true
      });
      document.dispatchEvent(event);
      console.log('Translation event dispatched successfully');
      
      // Also try dispatching on window
      window.dispatchEvent(event);
      console.log('Translation event also dispatched on window');
    } catch (error) {
      console.error('Error dispatching event:', error);
    }
  }
} 