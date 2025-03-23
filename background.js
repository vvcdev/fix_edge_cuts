// Store shortcuts in memory with fast lookup structures
let shortcuts = [];
let shortcutsMap = new Map(); // For fast exact lookups
let shortcutsWithoutAtMap = new Map(); // For lookups without @ symbol
let defaultKeyword = "";
let defaultUrl = "";

// Load shortcuts from the configuration file
fetch(chrome.runtime.getURL('shortcuts.json'))
  .then(response => response.json())
  .then(data => {
    shortcuts = data.shortcuts;
    
    // Create optimized lookup maps
    shortcuts.forEach(shortcut => {
      shortcutsMap.set(shortcut.shortcut, shortcut.url);
      shortcutsWithoutAtMap.set(shortcut.shortcut.slice(1), shortcut.url);
    });
    
    // Cache default values
    defaultKeyword = shortcuts.length > 0 ? shortcuts[0].shortcut.slice(1) : "vvc";
    defaultUrl = shortcuts.length > 0 ? shortcuts[0].url : "";
    
    setupListeners();
  })
  .catch(error => {
    console.error('Failed to load shortcuts:', error);
  });

function setupListeners() {
  // Handle omnibox input - this is the address bar with the @ keyword
  chrome.omnibox.onInputEntered.addListener(function(text) {
    handleShortcut(text);
  });

  // Handle suggestions in the omnibox with pre-computed data
  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    const suggestions = [];
    
    // Only prepare filtered suggestions
    shortcuts.forEach(shortcut => {
      const shortcutWithoutAt = shortcut.shortcut.slice(1);
      if (!text || shortcutWithoutAt.includes(text)) {
        suggestions.push({
          content: shortcutWithoutAt,
          description: `Go to: ${shortcut.url} (${shortcut.shortcut})`
        });
      }
    });
    
    suggest(suggestions);
  });

  // Monitor address bar navigation attempts
  chrome.webNavigation.onBeforeNavigate.addListener(function(details) {
    if (details.frameId === 0) {
      checkAndRedirect(details.url, details.tabId);
    }
  });
  
  // Monitor URL changes in the address bar
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.url) {
      checkAddressBarShortcut(changeInfo.url, tabId);
    }
  });
}

// Fast shortcut handling using Map lookups
function handleShortcut(text) {
  // Check for exact match (without @)
  if (shortcutsWithoutAtMap.has(text)) {
    chrome.tabs.update({ url: shortcutsWithoutAtMap.get(text) });
    return true;
  }
  
  // Check for exact match (with @)
  const withAt = `@${text}`;
  if (shortcutsMap.has(withAt)) {
    chrome.tabs.update({ url: shortcutsMap.get(withAt) });
    return true;
  }
  
  // Default case
  if (defaultUrl) {
    chrome.tabs.update({ url: defaultUrl });
    return true;
  }
  
  return false;
}

// Check if the URL was entered in the address bar with a shortcut
function checkAddressBarShortcut(url, tabId) {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Fast path: Check for search engine queries first
    if ((hostname.includes('google.com') && urlObj.pathname.includes('/search')) ||
        (hostname.includes('bing.com') && urlObj.pathname.includes('/search')) ||
        hostname.includes('duckduckgo.com')) {
      
      const query = urlObj.searchParams.get('q');
      if (query) {
        const trimmedQuery = query.trim();
        
        // Direct map lookup is faster than looping
        if (shortcutsMap.has(trimmedQuery)) {
          chrome.tabs.update(tabId, { url: shortcutsMap.get(trimmedQuery) });
          return true;
        }
      }
    }
    
    // Check for @ alone (default case)
    if (url === '@' || url === 'http://@/' || url === 'https://@/') {
      chrome.tabs.update(tabId, { url: defaultUrl });
      return true;
    }
    
    // Handle direct entry with efficient pattern matching
    const decodedUrl = decodeURIComponent(url.toLowerCase().trim());
    
    // Check direct matches with the shortcut map
    if (shortcutsMap.has(decodedUrl)) {
      chrome.tabs.update(tabId, { url: shortcutsMap.get(decodedUrl) });
      return true;
    }
    
    // Extract potential shortcut from URL path
    // Optimized pattern matching for common URL formats
    for (const [shortcut, targetUrl] of shortcutsMap.entries()) {
      // Common URL patterns for shortcuts
      if (decodedUrl === shortcut || 
          decodedUrl === `http://${shortcut}/` ||
          decodedUrl === `https://${shortcut}/` ||
          decodedUrl.endsWith(`/${shortcut}`) ||
          decodedUrl.endsWith(`/${shortcut}/`)) {
        chrome.tabs.update(tabId, { url: targetUrl });
        return true;
      }
    }
  } catch (e) {
    console.error("URL parsing error:", e);
  }
  
  return false;
}

// Check URL for shortcuts and redirect if found
function checkAndRedirect(url, tabId) {
  return checkAddressBarShortcut(url, tabId);
}
