// Store shortcuts in memory
let shortcuts = [];
let defaultKeyword = "";

// Load shortcuts from the configuration file
fetch(chrome.runtime.getURL('shortcuts.json'))
  .then(response => response.json())
  .then(data => {
    shortcuts = data.shortcuts;
    defaultKeyword = shortcuts.length > 0 ? shortcuts[0].shortcut.slice(1) : "vvc"; // Remove @ symbol
    setupListeners();
  })
  .catch(error => {
    console.error('Failed to load shortcuts:', error);
  });

function setupListeners() {
  // Handle omnibox input
  chrome.omnibox.onInputEntered.addListener(function(text) {
    let targetUrl = null;
    
    // Check if the input text matches any of our shortcuts
    for (const shortcut of shortcuts) {
      // Remove @ from the shortcut for comparison
      const shortcutText = shortcut.shortcut.slice(1);
      
      if (text === shortcutText || `@${text}` === shortcut.shortcut) {
        targetUrl = shortcut.url;
        break;
      }
    }
    
    // If no direct match found, check if text starts with any shortcut
    if (!targetUrl) {
      for (const shortcut of shortcuts) {
        const shortcutText = shortcut.shortcut.slice(1);
        if (text.startsWith(shortcutText)) {
          targetUrl = shortcut.url;
          break;
        }
      }
    }
    
    // If we found a matching shortcut, navigate to its URL
    if (targetUrl) {
      chrome.tabs.update({ url: targetUrl });
    } else {
      // Default to the first shortcut's URL if no match
      const defaultShortcut = shortcuts.find(s => s.shortcut.slice(1) === defaultKeyword);
      if (defaultShortcut) {
        chrome.tabs.update({ url: defaultShortcut.url });
      }
    }
  });

  // Handle suggestions in the omnibox
  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    const suggestions = shortcuts.map(shortcut => {
      const shortcutWithoutAt = shortcut.shortcut.slice(1); // Remove @ symbol
      return {
        content: shortcutWithoutAt,
        description: `Go to: ${shortcut.url} (${shortcut.shortcut})`
      };
    });
    
    // Filter suggestions based on input
    const filteredSuggestions = text 
      ? suggestions.filter(s => s.content.includes(text))
      : suggestions;
      
    suggest(filteredSuggestions);
  });

  // This listener handles all shortcuts typed directly in the address bar
  chrome.webNavigation.onBeforeNavigate.addListener(function(details) {
    const url = decodeURIComponent(details.url.toLowerCase());
    
    // Check if the URL contains any of our shortcuts
    for (const shortcut of shortcuts) {
      if (url.includes(shortcut.shortcut)) {
        chrome.tabs.update(details.tabId, { url: shortcut.url });
        break;
      }
    }
  });
}
