/**
 * Contentstack Custom Field Extension
 * Main Branch Content Selector
 * 
 * This extension allows authors to select content from the Main branch
 * while working in a child site branch.
 */

(function() {
  'use strict';
  
  var extensionId = 'main-branch-selector';
  
  // Initialize the extension
  window.extension.init(extensionId, function() {
    var config = window.extension.config || {};
    var field = window.extension.field;
    
    // Configuration with defaults
    var targetBranch = config.targetBranch || 'main';
    var contentType = config.contentType || '';
    var multiple = config.multiple || false;
    var apiKey = config.apiKey || window.extension.stack.apiKey;
    var deliveryToken = config.deliveryToken || '';
    var environment = config.environment || window.extension.stack.environment || 'production';
    var region = config.region || 'NA';
    
    // Get current field data
    var currentData = field.getData() || (multiple ? [] : null);
    
    // Create container
    var container = document.getElementById('main-branch-selector-container');
    if (!container) {
      console.error('Container element not found');
      return;
    }
    
    // Show loading state
    container.innerHTML = '<div class="cs-extension-loading">Loading content from Main branch...</div>';
    
    // Fetch content from Main branch
    fetchContentFromMainBranch(targetBranch, contentType, apiKey, deliveryToken, environment, region)
      .then(function(entries) {
        renderContentSelector(container, entries, currentData, multiple, field);
      })
      .catch(function(error) {
        console.error('Error fetching content:', error);
        container.innerHTML = '<div class="cs-extension-error">Error loading content: ' + error.message + '</div>';
      });
  });
  
  /**
   * Fetch content from Main branch using Contentstack Delivery API
   */
  function fetchContentFromMainBranch(branch, contentType, apiKey, deliveryToken, environment, region) {
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
      container.innerHTML = '<div class="cs-extension-empty">No content found in Main branch.</div>';
      return;
    }
    
    // Create search input
    var searchHtml = '<div class="cs-extension-search">' +
      '<input type="text" id="main-branch-search" placeholder="Search content..." class="cs-extension-search-input">' +
      '</div>';
    
    // Create content list
    var listHtml = '<div class="cs-extension-list" id="main-branch-list">';
    
    entries.forEach(function(entry) {
      var isSelected = isEntrySelected(entry, currentData, multiple);
      var title = entry.title || entry.uid || 'Untitled';
      var entryClass = 'cs-extension-item' + (isSelected ? ' cs-extension-item-selected' : '');
      
      listHtml += '<div class="' + entryClass + '" data-entry-uid="' + entry.uid + '">' +
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
        '<div class="cs-extension-item-badge">Main Branch</div>' +
        '</div>';
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
  }
  
  /**
   * Check if an entry is selected
   */
  function isEntrySelected(entry, currentData, multiple) {
    if (!currentData) return false;
    
    if (multiple) {
      if (!Array.isArray(currentData)) return false;
      return currentData.some(function(item) {
        return (typeof item === 'string' ? item : item.uid) === entry.uid;
      });
    } else {
      return (typeof currentData === 'string' ? currentData : currentData.uid) === entry.uid;
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
        var entry = entries.find(function(e) { return e.uid === entryUid; });
        
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
      _content_type_uid: entry._content_type_uid
    };
    
    field.setData(data);
    
    // Update UI
    var items = document.querySelectorAll('.cs-extension-item');
    items.forEach(function(item) {
      item.classList.remove('cs-extension-item-selected');
      if (item.getAttribute('data-entry-uid') === entry.uid) {
        item.classList.add('cs-extension-item-selected');
      }
    });
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
      return (typeof item === 'string' ? item : item.uid) === entry.uid;
    });
    
    if (index >= 0) {
      // Deselect
      selected.splice(index, 1);
    } else {
      // Select
      selected.push({
        uid: entry.uid,
        _content_type_uid: entry._content_type_uid
      });
    }
    
    field.setData(selected);
    
    // Update UI
    var item = container.querySelector('[data-entry-uid="' + entry.uid + '"]');
    if (item) {
      if (index >= 0) {
        item.classList.remove('cs-extension-item-selected');
      } else {
        item.classList.add('cs-extension-item-selected');
      }
    }
    
    // Update selected items display
    renderSelectedItems(container, entries, selected);
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
          toggleMultipleSelection(entry, selected, window.extension.field, container, entries);
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
})();

