/**
 * Contentstack Custom Field Extension
 * Main Branch Content Selector
 * 
 * This extension allows authors to select content from the Main branch
 * while working in a child site branch.
 * 
 * Based on official Contentstack extension patterns
 */

(function() {
  'use strict';
  
  // Extension variables
  var extensionField;
  var container;
  
  // Initialize the extension using Contentstack UI Extension SDK
  function initializeExtension() {
    var config = extensionField.config || {};
    var field = extensionField.field;
    
    // Configuration with defaults
    var targetBranch = config.targetBranch || 'main';
    var contentType = config.contentType || '';
    var multiple = config.multiple || false;
    // showBothBranches: explicitly check if it's set, default to true if not specified
    var showBothBranches = config.hasOwnProperty('showBothBranches') 
      ? config.showBothBranches === true 
      : true; // Default to true if not specified
    var apiKey = config.apiKey || extensionField.stack.apiKey;
    var deliveryToken = config.deliveryToken || '';
    var environment = config.environment || extensionField.stack.environment || 'production';
    var region = config.region || 'NA';
    
    // Get current branch (midwest, site-a, etc.)
    // Contentstack SDK doesn't expose branch directly, so we rely on manual config
    // Priority: 1) Manual config (currentBranch), 2) Try to get from stack, 3) Default to 'main'
    var currentBranch = config.currentBranch;
    
    // Try to get from stack if not manually specified
    if (!currentBranch) {
      // Try various ways to get branch info (SDK may not expose it)
      if (extensionField.stack && extensionField.stack.branch) {
        currentBranch = extensionField.stack.branch;
      } else if (extensionField.stack && extensionField.stack.branchName) {
        currentBranch = extensionField.stack.branchName;
      } else if (window.location && window.location.search) {
        // Try to get from URL parameters if available
        var urlParams = new URLSearchParams(window.location.search);
        currentBranch = urlParams.get('branch') || urlParams.get('branchName');
      }
    }
    
    // Default to 'main' if still not found
    if (!currentBranch) {
      currentBranch = 'main';
      console.warn('Current branch not detected. Defaulting to "main". Please set "currentBranch" in config.');
    }
    
    // Debug logging
    console.log('Extension Config:', {
      showBothBranches: showBothBranches,
      targetBranch: targetBranch,
      currentBranch: currentBranch,
      contentType: contentType,
      stackInfo: extensionField.stack,
      config: config
    });
    
    // Get current field data
    var currentData = field.getData() || (multiple ? [] : null);
    
    // Get container
    container = document.getElementById('main-branch-selector-container');
    if (!container) {
      console.error('Container element not found');
      return;
    }
    
    // Enable auto-resizing (official SDK method)
    if (extensionField.window && typeof extensionField.window.enableAutoResizing === 'function') {
      extensionField.window.enableAutoResizing();
    }
    
    // Show loading state
    var loadingText = showBothBranches 
      ? 'Loading content from Main and ' + currentBranch + ' branches...'
      : 'Loading content from Main branch...';
    container.innerHTML = '<div class="cs-extension-loading">' + loadingText + '</div>';
    
    // Fetch content from branches
    var fetchPromises = [];
    
    // Always fetch from Main branch
    fetchPromises.push(
      fetchContentFromBranch(targetBranch, contentType, apiKey, deliveryToken, environment, region)
        .then(function(entries) {
          return entries.map(function(entry) {
            var newEntry = {};
            for (var key in entry) {
              if (entry.hasOwnProperty(key)) {
                newEntry[key] = entry[key];
              }
            }
            newEntry._branch = targetBranch;
            newEntry._branch_label = 'Main Branch';
            return newEntry;
          });
        })
    );
    
    // Also fetch from current branch if showBothBranches is true
    if (showBothBranches && currentBranch !== targetBranch) {
      console.log('Fetching from current branch:', currentBranch);
      fetchPromises.push(
        fetchContentFromBranch(currentBranch, contentType, apiKey, deliveryToken, environment, region)
          .then(function(entries) {
            console.log('Fetched ' + entries.length + ' entries from ' + currentBranch + ' branch');
            return entries.map(function(entry) {
              var newEntry = {};
              for (var key in entry) {
                if (entry.hasOwnProperty(key)) {
                  newEntry[key] = entry[key];
                }
              }
              newEntry._branch = currentBranch;
              newEntry._branch_label = currentBranch.charAt(0).toUpperCase() + currentBranch.slice(1) + ' Branch';
              return newEntry;
            });
          })
          .catch(function(error) {
            console.error('Error fetching from current branch (' + currentBranch + '):', error);
            // Return empty array so Main branch content still shows
            return [];
          })
      );
    } else {
      console.log('Skipping current branch fetch:', {
        showBothBranches: showBothBranches,
        currentBranch: currentBranch,
        targetBranch: targetBranch,
        reason: !showBothBranches ? 'showBothBranches is false' : 'currentBranch === targetBranch'
      });
    }
    
    // Fetch from both branches in parallel
    Promise.all(fetchPromises)
      .then(function(results) {
        // Combine all entries
        var allEntries = [];
        results.forEach(function(branchEntries, index) {
          console.log('Branch result ' + index + ':', branchEntries.length + ' entries');
          allEntries = allEntries.concat(branchEntries);
        });
        console.log('Total entries to display:', allEntries.length);
        renderContentSelector(container, allEntries, currentData, multiple, field);
      })
      .catch(function(error) {
        console.error('Error fetching content:', error);
        container.innerHTML = '<div class="cs-extension-error">Error loading content: ' + error.message + '</div>';
      });
    
    /**
     * Fetch content from a specific branch using Contentstack Delivery API
     */
    function fetchContentFromBranch(branch, contentType, apiKey, deliveryToken, environment, region) {
      if (!contentType) {
        return Promise.reject(new Error('Content type not specified'));
      }
      
      // Determine API endpoint based on region
      var apiBaseUrl = getApiBaseUrl(region);
      
      // Build the API URL
      var url = apiBaseUrl + '/v3/content_types/' + contentType + '/entries';
      var params = new URLSearchParams({
        environment: environment,
        branch: branch
      });
      
      url += '?' + params.toString();
      
      // Make API request
      return fetch(url, {
        method: 'GET',
        headers: {
          'api_key': apiKey,
          'access_token': deliveryToken,
          'Content-Type': 'application/json'
        }
      })
      .then(function(response) {
        if (!response.ok) {
          throw new Error('API request failed: ' + response.status + ' ' + response.statusText);
        }
        return response.json();
      })
      .then(function(data) {
        return data.entries || [];
      });
    }
    
    /**
     * Get API base URL based on region
     */
    function getApiBaseUrl(region) {
      var regionMap = {
        'NA': 'https://api.contentstack.io',
        'EU': 'https://eu-api.contentstack.com',
        'AZURE_NA': 'https://azure-na-api.contentstack.com',
        'AZURE_EU': 'https://azure-eu-api.contentstack.com'
      };
      return regionMap[region] || regionMap['NA'];
    }
    
    /**
     * Render the content selector UI
     */
    function renderContentSelector(container, entries, currentData, multiple, field) {
      if (entries.length === 0) {
        container.innerHTML = '<div class="cs-extension-empty">No content found.</div>';
        return;
      }
      
      // Group entries by branch
      var groupedByBranch = {};
      entries.forEach(function(entry) {
        var branch = entry._branch_label || 'Unknown';
        if (!groupedByBranch[branch]) {
          groupedByBranch[branch] = [];
        }
        groupedByBranch[branch].push(entry);
      });
      
      // Create search input
      var searchHtml = '<div class="cs-extension-search">' +
        '<input type="text" id="main-branch-search" placeholder="Search content..." class="cs-extension-search-input">' +
        '</div>';
      
      // Create content list grouped by branch
      var listHtml = '<div class="cs-extension-list" id="main-branch-list">';
      
      // Render each branch group
      Object.keys(groupedByBranch).forEach(function(branchName) {
        var branchEntries = groupedByBranch[branchName];
        var branchClass = branchName.toLowerCase().replace(/\s+/g, '-');
        
        // Branch header
        listHtml += '<div class="cs-extension-branch-group">' +
          '<div class="cs-extension-branch-header">' + escapeHtml(branchName) + ' (' + branchEntries.length + ')</div>';
        
        // Branch entries
        branchEntries.forEach(function(entry) {
          var isSelected = isEntrySelected(entry, currentData, multiple);
          var title = entry.title || entry.uid || 'Untitled';
          var entryClass = 'cs-extension-item ' + (isSelected ? 'cs-extension-item-selected' : '');
          var badgeClass = branchName === 'Main Branch' ? 'cs-extension-item-badge-main' : 'cs-extension-item-badge-current';
          
          listHtml += '<div class="' + entryClass + '" data-entry-uid="' + entry.uid + '" data-entry-branch="' + entry._branch + '">' +
            '<div class="cs-extension-item-content">' +
            '<div class="cs-extension-item-title">' + escapeHtml(title) + '</div>';
          
          if (entry.description) {
            listHtml += '<div class="cs-extension-item-description">' + escapeHtml(entry.description) + '</div>';
          }
          
          if (entry.updated_at) {
            var date = new Date(entry.updated_at);
            listHtml += '<div class="cs-extension-item-meta">Updated: ' + date.toLocaleDateString() + '</div>';
          }
          
          listHtml += '</div>' +
            '<div class="cs-extension-item-badge ' + badgeClass + '">' + escapeHtml(branchName) + '</div>' +
            '</div>';
        });
        
        listHtml += '</div>'; // Close branch group
      });
      
      listHtml += '</div>';
      
      // Create selected items display (for multiple selection)
      var selectedHtml = '';
      if (multiple && currentData && currentData.length > 0) {
        selectedHtml = '<div class="cs-extension-selected">' +
          '<div class="cs-extension-selected-title">Selected Items (' + currentData.length + ')</div>' +
          '<div class="cs-extension-selected-list" id="main-branch-selected-list"></div>' +
          '</div>';
      }
      
      container.innerHTML = searchHtml + selectedHtml + listHtml;
      
      // Attach event listeners
      attachEventListeners(container, entries, currentData, multiple, field);
      
      // Render selected items if multiple
      if (multiple && currentData && currentData.length > 0) {
        renderSelectedItems(container, entries, currentData);
      }
      
      // Update window height after rendering
      if (extensionField && extensionField.window) {
        extensionField.window.updateHeight();
      }
    }
  
    /**
     * Check if an entry is selected
     */
    function isEntrySelected(entry, currentData, multiple) {
      if (!currentData) return false;
      
      if (multiple) {
        if (!Array.isArray(currentData)) return false;
        return currentData.some(function(item) {
          var itemUid = typeof item === 'string' ? item : item.uid;
          var itemBranch = item._branch || 'main';
          return itemUid === entry.uid && itemBranch === (entry._branch || 'main');
        });
      } else {
        var currentUid = typeof currentData === 'string' ? currentData : currentData.uid;
        var currentBranch = currentData._branch || 'main';
        return currentUid === entry.uid && currentBranch === (entry._branch || 'main');
      }
    }
    
    /**
     * Attach event listeners
     */
    function attachEventListeners(container, entries, currentData, multiple, field) {
      // Search functionality
      var searchInput = container.querySelector('#main-branch-search');
      if (searchInput) {
        searchInput.addEventListener('input', function(e) {
          var searchTerm = e.target.value.toLowerCase();
          var list = container.querySelector('#main-branch-list');
          var items = list.querySelectorAll('.cs-extension-item');
          
          items.forEach(function(item) {
            var title = item.querySelector('.cs-extension-item-title').textContent.toLowerCase();
            var description = item.querySelector('.cs-extension-item-description');
            var descriptionText = description ? description.textContent.toLowerCase() : '';
            
            if (title.includes(searchTerm) || descriptionText.includes(searchTerm)) {
              item.style.display = '';
            } else {
              item.style.display = 'none';
            }
          });
        });
      }
      
      // Item selection
      var items = container.querySelectorAll('.cs-extension-item');
      items.forEach(function(item) {
        item.addEventListener('click', function() {
          var entryUid = item.getAttribute('data-entry-uid');
          var entryBranch = item.getAttribute('data-entry-branch');
          var entry = entries.find(function(e) { 
            return e.uid === entryUid && (e._branch || 'main') === entryBranch; 
          });
          
          if (!entry) return;
          
          if (multiple) {
            toggleMultipleSelection(entry, currentData, field, container, entries);
          } else {
            selectSingleEntry(entry, field);
          }
        });
      });
    }
    
    /**
     * Select a single entry
     */
    function selectSingleEntry(entry, field) {
      var data = {
        uid: entry.uid,
        _content_type_uid: entry._content_type_uid,
        _branch: entry._branch || 'main'  // Store branch info
      };
      
      field.setData(data);
      
      // Update UI
      var items = document.querySelectorAll('.cs-extension-item');
      items.forEach(function(item) {
        item.classList.remove('cs-extension-item-selected');
        if (item.getAttribute('data-entry-uid') === entry.uid && 
            item.getAttribute('data-entry-branch') === entry._branch) {
          item.classList.add('cs-extension-item-selected');
        }
      });
      
      // Resize window after selection
      extensionField.window.updateHeight();
    }
    
    /**
     * Toggle multiple selection
     */
    function toggleMultipleSelection(entry, currentData, field, container, entries) {
      var selected = currentData || [];
      if (!Array.isArray(selected)) {
        selected = [];
      }
      
      var index = selected.findIndex(function(item) {
        var itemUid = typeof item === 'string' ? item : item.uid;
        var itemBranch = item._branch || 'main';
        return itemUid === entry.uid && itemBranch === (entry._branch || 'main');
      });
      
      if (index >= 0) {
        // Deselect
        selected.splice(index, 1);
      } else {
        // Select
        selected.push({
          uid: entry.uid,
          _content_type_uid: entry._content_type_uid,
          _branch: entry._branch || 'main'  // Store branch info
        });
      }
      
      field.setData(selected);
      
      // Update UI
      var item = container.querySelector('[data-entry-uid="' + entry.uid + '"][data-entry-branch="' + (entry._branch || 'main') + '"]');
      if (item) {
        if (index >= 0) {
          item.classList.remove('cs-extension-item-selected');
        } else {
          item.classList.add('cs-extension-item-selected');
        }
      }
      
      // Update selected items display
      renderSelectedItems(container, entries, selected);
      
      // Resize window after selection
      extensionField.window.updateHeight();
    }
    
    /**
     * Render selected items display
     */
    function renderSelectedItems(container, entries, selected) {
      var selectedList = container.querySelector('#main-branch-selected-list');
      if (!selectedList) return;
      
      if (!selected || selected.length === 0) {
        selectedList.innerHTML = '<div class="cs-extension-empty-selection">No items selected</div>';
        return;
      }
      
      var html = '';
      selected.forEach(function(item) {
        var uid = typeof item === 'string' ? item : item.uid;
        var entry = entries.find(function(e) { return e.uid === uid; });
        
        if (entry) {
          var title = entry.title || entry.uid || 'Untitled';
          html += '<div class="cs-extension-selected-item">' +
            '<span class="cs-extension-selected-item-title">' + escapeHtml(title) + '</span>' +
            '<button class="cs-extension-remove-btn" data-entry-uid="' + uid + '">×</button>' +
            '</div>';
        }
      });
      
      selectedList.innerHTML = html;
      
      // Attach remove button listeners
      var removeButtons = selectedList.querySelectorAll('.cs-extension-remove-btn');
      removeButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var uid = btn.getAttribute('data-entry-uid');
          var entry = entries.find(function(e) { return e.uid === uid; });
          if (entry) {
            toggleMultipleSelection(entry, selected, extensionField.field, container, entries);
          }
        });
      });
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }
  
  // Initialize using Contentstack UI Extension SDK (official pattern)
  if (typeof ContentstackUIExtension !== 'undefined') {
    // SDK is available, initialize immediately
    ContentstackUIExtension.init().then(function(extension) {
      extensionField = extension;
      initializeExtension();
    }).catch(function(error) {
      console.error('Error initializing extension:', error);
      var container = document.getElementById('main-branch-selector-container');
      if (container) {
        container.innerHTML = '<div class="cs-extension-error">Error initializing extension. Please refresh the page.</div>';
      }
    });
  } else {
    // Wait for SDK to load
    function waitForSDK() {
      if (typeof ContentstackUIExtension !== 'undefined') {
        ContentstackUIExtension.init().then(function(extension) {
          extensionField = extension;
          initializeExtension();
        }).catch(function(error) {
          console.error('Error initializing extension:', error);
        });
      } else {
        setTimeout(waitForSDK, 100);
      }
    }
    
    // Start waiting when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', waitForSDK);
    } else {
      waitForSDK();
    }
  }
})();

