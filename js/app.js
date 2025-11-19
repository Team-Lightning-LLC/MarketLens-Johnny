// Main Application Logic
class DeepResearchApp {
  constructor() {
    this.documents = [];
    this.filteredDocuments = [];
    this.currentFilter = 'All';
    this.searchQuery = '';
    this.panelMode = 'research'; // 'research' or 'whitelabel'
    this.selectedDocuments = []; // For white label document selection
    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupCustomSelects();
    await this.loadDocuments();
    
    // Initialize collections system
    this.collectionsManager = new CollectionsManager(this);
    
    // Initialize white label search
    this.whiteLabelSearch = new WhiteLabelDocumentSearch(this);
    
    this.filterAndRenderDocuments();
    this.populateDocumentSelector(); // For white label form
    console.log('Deep Research Agent initialized');
  }

  setupCustomSelects() {
    // Initialize custom selects
    const capabilityEl = document.getElementById('capabilitySelect');
    const frameworkEl = document.getElementById('frameworkSelect');
    
    if (capabilityEl) {
      window.capabilitySelect = new CustomSelect(capabilityEl);
      
      // Listen for capability changes
      capabilityEl.addEventListener('change', (e) => {
        this.updateFrameworkOptions(e.detail.value);
        this.updateCreateButton();
      });
    }
    
    if (frameworkEl) {
      window.frameworkSelect = new CustomSelect(frameworkEl);
      
      // Listen for framework changes
      frameworkEl.addEventListener('change', (e) => {
        this.updateContextPlaceholder(e.detail.value);
        this.applyFrameworkDefaults(e.detail.value);
        this.updateCreateButton();
      });
    }
  }

  setupEventListeners() {
    const contextInput = document.getElementById('contextInput');
    const createBtn = document.getElementById('createBtn');

    contextInput?.addEventListener('input', (e) => {
      this.updateCharacterCount();
      this.updateCreateButton();
    });

    createBtn?.addEventListener('click', () => {
      this.startResearch();
    });

    // Main library search functionality
    const mainSearchInput = document.getElementById('docSearch');
    mainSearchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.filterAndRenderDocuments();
    });

    // Create mode dropdown (keeping for backwards compatibility, but may not be used with new toggles)
    const dropdownBtn = document.getElementById('createDropdownBtn');
    const dropdownMenu = document.getElementById('createDropdownMenu');
    
    if (dropdownBtn && dropdownMenu) {
      dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownBtn.classList.toggle('open');
        dropdownMenu.classList.toggle('open');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.panel-title-dropdown')) {
          dropdownBtn.classList.remove('open');
          dropdownMenu.classList.remove('open');
        }
      });

      // Dropdown menu items
      const dropdownItems = document.querySelectorAll('.dropdown-item');
      dropdownItems.forEach(item => {
        item.addEventListener('click', () => {
          const mode = item.dataset.mode;
          this.switchPanelMode(mode);
          dropdownBtn.classList.remove('open');
          dropdownMenu.classList.remove('open');
        });
      });
    }

    // White label form interactions
    const whiteLabelJustification = document.getElementById('whiteLabelJustification');
    const createWhiteLabelBtn = document.getElementById('createWhiteLabelBtn');

    whiteLabelJustification?.addEventListener('input', () => {
      this.updateWhiteLabelCharCount();
      this.updateWhiteLabelButton();
    });

    createWhiteLabelBtn?.addEventListener('click', () => {
      this.startWhiteLabelGeneration();
    });

    // Document selector (event delegation)
    const documentSelector = document.getElementById('documentSelector');
    documentSelector?.addEventListener('click', (e) => {
      const docElement = e.target.closest('.selectable-doc');
      if (docElement) {
        this.toggleDocumentSelection(docElement.dataset.docId);
      }
    });

    // Filter chips
    const filterChips = document.querySelectorAll('.chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.currentFilter = chip.dataset.filter;
        this.filterAndRenderDocuments();
      });
    });

    // Segmented controls
    this.setupSegmentedControls();

    // Document actions
    this.setupDocumentActions();
  }

  // Update framework dropdown based on selected capability
  updateFrameworkOptions(selectedCapability) {
    if (!window.frameworkSelect) return;
    
    const frameworks = CONFIG.RESEARCH_CAPABILITIES[selectedCapability] || [];
    
    if (frameworks.length === 0) {
      window.frameworkSelect.disable();
      window.frameworkSelect.reset();
      return;
    }
    
    // Build framework options with tooltips
    const frameworkOptions = frameworks.map(framework => ({
      value: framework,
      text: framework,
      tooltip: CONFIG.FRAMEWORK_TOOLTIPS?.[framework] || ''
    }));
    
    window.frameworkSelect.setOptions(frameworkOptions);
    window.frameworkSelect.enable();
    window.frameworkSelect.reset();
  }

  // Update context placeholder based on selected framework
  updateContextPlaceholder(selectedFramework) {
    const contextInput = document.getElementById('contextInput');
    
    if (!contextInput) return;
    
    const hint = CONFIG.CONTEXT_HINTS[selectedFramework];
    
    contextInput.placeholder = hint || "Describe your research needs in detail...";
    
    // Expand textarea for Custom Framework
    if (selectedFramework === "Custom Framework") {
      contextInput.rows = 5;
    } else {
      contextInput.rows = 3;
    }
  }

  // Apply framework defaults to modifiers
  applyFrameworkDefaults(selectedFramework) {
    const defaults = CONFIG.FRAMEWORK_DEFAULTS[selectedFramework];
    
    if (!defaults) return;
    
    // Apply each default
    Object.keys(defaults).forEach(group => {
      const value = defaults[group];
      const seg = document.querySelector(`[data-group="${group}"]`)?.closest('.seg');
      
      if (seg) {
        // Deactivate all options in this group
        seg.querySelectorAll('.seg-option').forEach(option => {
          option.classList.remove('is-active');
          option.setAttribute('aria-checked', 'false');
        });
        
        // Activate the default option
        const defaultOption = seg.querySelector(`[data-value="${value}"]`);
        if (defaultOption) {
          defaultOption.classList.add('is-active');
          defaultOption.setAttribute('aria-checked', 'true');
        }
      }
    });
  }

  // Update character count
  updateCharacterCount() {
    const contextInput = document.getElementById('contextInput');
    const charCount = document.getElementById('charCount');
    
    if (!contextInput || !charCount) return;
    
    charCount.textContent = contextInput.value.length;
  }

  // Update create button state
  updateCreateButton() {
    const contextInput = document.getElementById('contextInput');
    const createBtn = document.getElementById('createBtn');
    
    if (!contextInput || !createBtn) return;
    
    const hasCapability = window.capabilitySelect?.value !== "" && window.capabilitySelect?.value !== undefined;
    const hasFramework = window.frameworkSelect?.value !== "" && window.frameworkSelect?.value !== undefined;
    const hasContext = contextInput.value.trim().length >= 1;
    
    createBtn.disabled = !(hasCapability && hasFramework && hasContext);
  }

  // Setup segmented control interactions
  setupSegmentedControls() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.seg-option');
      if (!btn) return;
      
      const seg = btn.closest('.seg');
      if (!seg) return;
      
      // Update active state
      seg.querySelectorAll('.seg-option').forEach(option => {
        option.classList.remove('is-active');
        option.setAttribute('aria-checked', 'false');
      });
      
      btn.classList.add('is-active');
      btn.setAttribute('aria-checked', 'true');
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      
      const seg = e.target.closest('.seg');
      if (!seg) return;
      
      const options = [...seg.querySelectorAll('.seg-option')];
      const currentIndex = options.findIndex(o => o.classList.contains('is-active'));
      const nextIndex = e.key === 'ArrowRight' 
        ? (currentIndex + 1) % options.length
        : (currentIndex - 1 + options.length) % options.length;
      
      // Update active state
      options[currentIndex].classList.remove('is-active');
      options[nextIndex].classList.add('is-active');
      options[nextIndex].focus();
      
      e.preventDefault();
    });
  }

  // Setup document action handlers
  setupDocumentActions() {
    const docsPane = document.getElementById('docsPane');
    
    docsPane?.addEventListener('click', async (e) => {
      const action = e.target.closest('.doc-action');
      if (!action) return;
      
      const docElement = action.closest('.doc');
      const docId = docElement?.dataset.docId;
      
      if (!docId) return;
      
      if (action.classList.contains('view-action')) {
        await this.viewDocument(docId);
      } else if (action.classList.contains('download-action')) {
        await this.downloadDocument(docId);
      } else if (action.classList.contains('collections-action')) {
        this.collectionsManager.showAddToCollectionModal(docId);
      } else if (action.classList.contains('delete-action')) {
        await this.deleteDocument(docId);
      }
    });
  }

  // Get current research parameters
  getResearchParameters() {
    const params = {};
    
    // Only query segmented controls within the research form
    const researchForm = document.getElementById('researchForm');
    if (!researchForm) return params;
    
    researchForm.querySelectorAll('.seg').forEach(seg => {
      const activeOption = seg.querySelector('.seg-option.is-active');
      if (activeOption) {
        const group = activeOption.dataset.group;
        const value = activeOption.dataset.value;
        if (group && value) {
          params[group] = value;
        }
      }
    });
    
    return params;
  }

  // Start research generation
  async startResearch() {
    const contextInput = document.getElementById('contextInput');
    
    const capability = window.capabilitySelect?.value;
    const framework = window.frameworkSelect?.value;
    
    if (!capability || !framework || !contextInput?.value) return;
    
    const researchData = {
      capability: capability,
      framework: framework,
      context: contextInput.value.trim(),
      modifiers: this.getResearchParameters()
    };
    
    await researchEngine.startResearch(researchData);
    
    // Reset form after successful submit
    window.capabilitySelect.reset();
    window.frameworkSelect.reset();
    window.frameworkSelect.disable();
    contextInput.value = '';
    document.getElementById('charCount').textContent = '0';
    document.getElementById('createBtn').disabled = true;
  }

  // Load all documents from API
  async loadDocuments() {
    try {
      console.log('Loading all documents...');
      
      const response = await fetch(`${CONFIG.VERTESIA_API_BASE}/objects?limit=1000&offset=0`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${CONFIG.VERTESIA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      
      const allObjects = await response.json();
      console.log('Loaded all objects:', allObjects.length);
      
      this.documents = [];
      for (const obj of allObjects) {
        try {
          const transformed = this.transformDocument(obj);
          this.documents.push(transformed);
        } catch (error) {
          console.error('Failed to transform:', obj.name, error);
        }
      }
      
      this.documents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      console.log('Final documents array:', this.documents.length);
      
    } catch (error) {
      console.error('Failed to load documents:', error);
      this.documents = [];
    }
  }

  // Transform API object to document format
  transformDocument(obj) {
    let title = obj.name || 'Untitled';
    
    const prefixes = ['DeepResearch_', 'Deep Research_', 'deep research_', 'DEEP RESEARCH_', 'DEEP RESEARCH:'];
    prefixes.forEach(prefix => {
      if (title.startsWith(prefix)) {
        title = title.substring(prefix.length);
      }
    });
    
    title = title.replace(/[_-]/g, ' ').trim();
    
    return {
      id: obj.id,
      title: title,
      area: obj.properties?.capability || 'Research',
      topic: obj.properties?.framework || 'General',
      created_at: obj.created_at || obj.properties?.generated_at || new Date().toISOString(),
      content_source: obj.content?.source,
      when: this.formatDate(obj.created_at || obj.properties?.generated_at)
    };
  }

  // Format date for display
  formatDate(dateString) {
    if (!dateString) return 'Recent';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return 'Recent';
    }
  }

  // Filter and render documents
// Filter and render documents
filterAndRenderDocuments() {
  this.filteredDocuments = this.documents.filter(doc => {
    const matchesSearch = !this.searchQuery || 
      [doc.title, doc.area, doc.topic].some(field => 
        field && field.toLowerCase().includes(this.searchQuery)
      );
    
    // Use collections manager to check if document should be shown
    const matchesCollection = this.collectionsManager ? 
      this.collectionsManager.shouldShowDocument(doc.id) : true;
    
    // Exclude Pulse documents (Digests and Watchlists)
    const isDigest = doc.title && doc.title.toLowerCase().startsWith('digest:');
    const isWatchlist = doc.title && doc.title.toLowerCase().startsWith('my watchlist:');
    const isPulseDocument = isDigest || isWatchlist;
    
    return matchesSearch && matchesCollection && !isPulseDocument;
  });
  
  this.renderDocuments();
}

  // Render document list
  renderDocuments() {
    const docsPane = document.getElementById('docsPane');
    const docsHeader = document.getElementById('docsHeader');
    
    if (!docsPane) {
      console.error('docsPane element not found');
      return;
    }
    
    // Update header separately
    if (docsHeader) {
      const headerText = this.collectionsManager ? 
        this.collectionsManager.getSelectedNames() : 'All Documents';
      docsHeader.textContent = headerText;
    }
    
    if (this.filteredDocuments.length === 0) {
      docsPane.innerHTML = '<div class="empty">No documents found.</div>';
      return;
    }
    
    // Sort: uncollected documents first, collected documents last
    const sortedDocs = [...this.filteredDocuments].sort((a, b) => {
      const aInCollections = this.getDocumentCollections(a.id).length > 0;
      const bInCollections = this.getDocumentCollections(b.id).length > 0;
      
      if (aInCollections === bInCollections) return 0;
      return aInCollections ? 1 : -1;
    });
    
    const html = sortedDocs.map(doc => {
      const collections = this.getDocumentCollections(doc.id);
      const collectionLabel = collections.length > 0 
        ? collections.map(c => c.name).join(', ')
        : 'Not Assigned to Collection';
      
      return `
        <div class="doc" data-doc-id="${doc.id}">
          <div class="doc-info">
            <div class="tt">${doc.title}</div>
            <div class="meta">${doc.when} • ${collectionLabel}</div>
          </div>
          <div class="actions">
            <button class="doc-action view view-action" data-tooltip="View document">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            
            <button class="doc-action download download-action" data-tooltip="Download PDF">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            
            <button class="doc-action collections collections-action" data-tooltip="Add to collection">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                <line x1="12" y1="11" x2="12" y2="17"/>
                <line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
            </button>
            
            <button class="doc-action delete delete-action" data-tooltip="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    docsPane.innerHTML = html;
  }

  // Helper: Get collections a document belongs to
  getDocumentCollections(docId) {
    if (!this.collectionsManager) return [];
    return this.collectionsManager.collections.filter(c => 
      c.document_ids.includes(docId)
    );
  }

  // View document
  async viewDocument(docId) {
    try {
      const doc = this.documents.find(d => d.id === docId);
      if (!doc) return;
      
      const downloadResponse = await fetch(`${CONFIG.VERTESIA_API_BASE}/objects/download-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.VERTESIA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          file: doc.content_source,
          format: 'original'
        })
      });
      
      if (!downloadResponse.ok) {
        throw new Error(`Failed to get download URL: ${downloadResponse.statusText}`);
      }
      
      const downloadData = await downloadResponse.json();
      
      const contentResponse = await fetch(downloadData.url);
      if (!contentResponse.ok) {
        throw new Error(`Failed to download content: ${contentResponse.statusText}`);
      }
      
      const content = await contentResponse.text();
      
      // Pass docId to viewer
      markdownViewer.openViewer(content, doc.title, docId);
      
    } catch (error) {
      console.error('Failed to view document:', error);
      alert('Failed to load document. Please try again.');
    }
  }

  // Download document as PDF
  async downloadDocument(docId) {
    try {
      const doc = this.documents.find(d => d.id === docId);
      if (!doc) return;
      
      console.log('Downloading document:', doc.title);
      
      const downloadResponse = await fetch(`${CONFIG.VERTESIA_API_BASE}/objects/download-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.VERTESIA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          file: doc.content_source,
          format: 'original'
        })
      });
      
      if (!downloadResponse.ok) {
        throw new Error(`Failed to get download URL: ${downloadResponse.statusText}`);
      }
      
      const downloadData = await downloadResponse.json();
      
      const contentResponse = await fetch(downloadData.url);
      if (!contentResponse.ok) {
        throw new Error(`Failed to download content: ${contentResponse.statusText}`);
      }
      
      const content = await contentResponse.text();
      
      await markdownViewer.generatePDFFromContent(content, doc.title);
      
    } catch (error) {
      console.error('Failed to download document:', error);
      alert('Failed to download document. Please try again.');
    }
  }

  // Delete document
  async deleteDocument(docId) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const response = await fetch(`${CONFIG.VERTESIA_API_BASE}/objects/${docId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CONFIG.VERTESIA_API_KEY}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete: ${response.statusText}`);
      }
      
      await this.refreshDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert('Failed to delete document. Please try again.');
    }
  }

  // Refresh document library
  async refreshDocuments() {
    await this.loadDocuments();
    this.filterAndRenderDocuments();
    this.populateDocumentSelector(); // Refresh white label selector too
  }

  // ===== WHITE LABEL FUNCTIONALITY =====

  // Switch between research and white label panels
  switchPanelMode(mode) {
    this.panelMode = mode;
    
    const researchForm = document.getElementById('researchForm');
    const whiteLabelForm = document.getElementById('whiteLabelForm');
    const dropdownLabel = document.getElementById('createDropdownLabel');
    
    if (mode === 'research') {
      researchForm.style.display = 'block';
      whiteLabelForm.style.display = 'none';
      if (dropdownLabel) dropdownLabel.textContent = 'Create Research';
    } else if (mode === 'whitelabel') {
      researchForm.style.display = 'none';
      whiteLabelForm.style.display = 'block';
      if (dropdownLabel) dropdownLabel.textContent = 'Create White Label Document';
      this.populateDocumentSelector();
    }
  }

  // Populate document selector for white label
populateDocumentSelector() {
  const selector = document.getElementById('documentSelector');
  if (!selector) return;
  
  // Filter out Pulse documents (Digests and Watchlists)
  const availableDocs = this.documents.filter(doc => {
    const isDigest = doc.title && doc.title.toLowerCase().startsWith('digest:');
    const isWatchlist = doc.title && doc.title.toLowerCase().startsWith('my watchlist:');
    return !isDigest && !isWatchlist;
  });
  
  if (availableDocs.length === 0) {
    selector.innerHTML = '<div class="empty">No documents available. Create some research first.</div>';
    return;
  }
  
  const html = availableDocs.map(doc => `
      <div class="selectable-doc ${this.selectedDocuments.includes(doc.id) ? 'selected' : ''}" 
           data-doc-id="${doc.id}">
        <div class="selectable-doc-title">${doc.title}</div>
        <div class="selectable-doc-meta">${doc.when} • ${doc.area} • ${doc.topic}</div>
      </div>
    `).join('');
    
    selector.innerHTML = html;
  }

  // Toggle document selection
  toggleDocumentSelection(docId) {
    const index = this.selectedDocuments.indexOf(docId);
    
    if (index > -1) {
      // Deselect
      this.selectedDocuments.splice(index, 1);
    } else {
      // Select (max 5)
      if (this.selectedDocuments.length >= 5) {
        alert('Maximum 5 documents can be selected.');
        return;
      }
      this.selectedDocuments.push(docId);
    }
    
    this.updateDocumentCount();
    this.populateDocumentSelector();
    this.updateWhiteLabelButton();
  }

  // Update document count display
  updateDocumentCount() {
    const countElement = document.getElementById('documentCount');
    if (countElement) {
      countElement.textContent = `${this.selectedDocuments.length}/5`;
    }
  }

  // Update white label character count
  updateWhiteLabelCharCount() {
    const textarea = document.getElementById('whiteLabelJustification');
    const charCount = document.getElementById('whiteLabelCharCount');
    
    if (textarea && charCount) {
      charCount.textContent = textarea.value.length;
    }
  }

  // Update white label button state
  updateWhiteLabelButton() {
    const button = document.getElementById('createWhiteLabelBtn');
    const justification = document.getElementById('whiteLabelJustification');
    
    if (!button || !justification) return;
    
    const hasDocuments = this.selectedDocuments.length > 0;
    const hasJustification = justification.value.trim().length > 0;
    
    button.disabled = !(hasDocuments && hasJustification);
  }

  // Start white label generation
  async startWhiteLabelGeneration() {
    const justification = document.getElementById('whiteLabelJustification');
    
    if (!justification) return;
    
    // Get selected document length
    const lengthSeg = document.querySelector('.seg-option[data-group="documentLength"].is-active');
    const documentLength = lengthSeg?.dataset.value || '2 Pages';
    
    // Map page length to token length for AI
    const lengthTokenMap = {
      '1 Page': '~700 tokens max (No charts or tables, just clear logic)',
      '2 Pages': '~1400 tokens max (allows for charts/tables)', 
      '3 Pages': '~2100 tokens max (allows for sophisticated reasoning)'
    };
    
    const tokenLength = lengthTokenMap[documentLength] || '~4000 tokens (approximately 2 pages)';
    
    const whiteLabelData = {
      document_ids: this.selectedDocuments,
      justification: justification.value.trim(),
      length: documentLength,
      token_length: tokenLength
    };
    
    console.log('Starting white label generation:', whiteLabelData);
    
    // Build prompt for white label compilation
    const prompt = `
Create a professional white label document by synthesizing the following documents:

Document IDs: ${whiteLabelData.document_ids.join(', ')}

Justification and Purpose:
${whiteLabelData.justification}

Target Length: ${tokenLength}

Requirements:
- Synthesize information from all provided documents
- Create a cohesive narrative that addresses the justification
- Target the specified token length (${documentLength})
- Professional tone suitable for client-facing and official documentation based deliverables
- Include key insights and data from source documents
- Format as a polished, generically branded document

The final output must be a single markdown document uploaded to the content object library with the title prefix "White Label: "
    `.trim();
    
    try {
      // Call WhiteLabel interaction with both prompt and structured data
      const response = await vertesiaAPI.call('/execute/async', {
        method: 'POST',
        body: JSON.stringify({
          type: 'conversation',
          interaction: 'WhiteLabel',
          data: {
            task: prompt,
            document_ids: whiteLabelData.document_ids,
            justification: whiteLabelData.justification,
            length: whiteLabelData.length,
            token_length: whiteLabelData.token_length
          },
          config: {
            environment: CONFIG.ENVIRONMENT_ID,
            model: CONFIG.MODEL
          }
        })
      });
      
      console.log('WhiteLabel interaction started:', response);
      
      // Track as active job
      const newJob = {
        data: { 
          capability: 'White Label',
          framework: 'Document Synthesis',
          modifiers: {} 
        },
        startTime: Date.now(),
        timers: { refresh: null, autoDecrement: null }
      };
      
      researchEngine.currentJobs.push(newJob);
      researchEngine.saveJobsState();
      researchEngine.updateBadge();
      
      // Set 5-minute auto-decrement
      newJob.timers.autoDecrement = setTimeout(() => {
        researchEngine.autoDecrementJob(newJob);
      }, 5 * 60 * 1000);
      
      // Start polling after 5 minutes
      setTimeout(() => {
        researchEngine.startJobPolling(newJob);
      }, 5 * 60 * 1000);
      
      // Reset form
      this.selectedDocuments = [];
      justification.value = '';
      document.getElementById('whiteLabelCharCount').textContent = '0';
      document.getElementById('documentCount').textContent = '0/5';
      document.getElementById('createWhiteLabelBtn').disabled = true;
      this.populateDocumentSelector();
      
      console.log('White label generation started');
      
    } catch (error) {
      console.error('Failed to start white label generation:', error);
      alert('Failed to start white label generation. Please try again.');
    }
  }
}

// Custom Select Component
class CustomSelect {
  constructor(element) {
    this.element = element;
    this.trigger = element.querySelector('.custom-select-trigger');
    this.optionsContainer = element.querySelector('.custom-select-options');
    this.options = element.querySelectorAll('.custom-select-option');
    this.value = '';
    this.name = element.dataset.name;
    
    this.init();
  }

  init() {
    // Toggle dropdown
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.element.classList.contains('disabled')) return;
      this.toggle();
    });

    // Option selection
    this.optionsContainer.addEventListener('click', (e) => {
      const option = e.target.closest('.custom-select-option');
      if (option) {
        this.select(option.dataset.value, option.textContent);
      }
    });

    // Close on outside click
    document.addEventListener('click', () => this.close());
  }

  toggle() {
    this.element.classList.toggle('open');
    this.trigger.classList.toggle('open');
  }

  close() {
    this.element.classList.remove('open');
    this.trigger.classList.remove('open');
  }

  select(value, text) {
    this.value = value;
    this.trigger.querySelector('span').textContent = text;
    
    // Update selected state
    this.options.forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.value === value);
    });
    
    this.close();
    
    // Dispatch change event for app.js integration
    this.element.dispatchEvent(new CustomEvent('change', { 
      detail: { value, name: this.name }
    }));
  }

  enable() {
    this.element.classList.remove('disabled');
    this.trigger.classList.remove('disabled');
  }

  disable() {
    this.element.classList.add('disabled');
    this.trigger.classList.add('disabled');
    this.close();
  }

  setOptions(options) {
    // Clear existing (keep placeholder)
    const placeholder = this.optionsContainer.querySelector('.placeholder');
    this.optionsContainer.innerHTML = '';
    if (placeholder) this.optionsContainer.appendChild(placeholder);
    
    // Add new options
    options.forEach(opt => {
      const div = document.createElement('div');
      div.className = 'custom-select-option';
      div.dataset.value = opt.value;
      if (opt.tooltip) div.dataset.tooltip = opt.tooltip;
      div.textContent = opt.text;
      this.optionsContainer.appendChild(div);
    });
    
    this.options = this.optionsContainer.querySelectorAll('.custom-select-option');
  }

  reset() {
    this.value = '';
    const placeholder = this.optionsContainer.querySelector('.placeholder');
    this.trigger.querySelector('span').textContent = placeholder ? placeholder.textContent : 'Select...';
    this.options.forEach(opt => opt.classList.remove('selected'));
  }
}

// White Label Document Search (separate from main library search)
class WhiteLabelDocumentSearch {
  constructor(app) {
    this.app = app;
    this.setupSearch();
  }

  setupSearch() {
    const searchInput = document.getElementById('documentSearch');
    if (!searchInput) return;

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.filterDocuments(e.target.value);
      }, 150);
    });
  }

  filterDocuments(searchTerm) {
    const documentItems = document.querySelectorAll('.selectable-doc');
    const searchLower = searchTerm.toLowerCase();
    let visibleCount = 0;

    documentItems.forEach(item => {
      const title = item.querySelector('.selectable-doc-title')?.textContent?.toLowerCase() || '';
      const meta = item.querySelector('.selectable-doc-meta')?.textContent?.toLowerCase() || '';
      
      const matches = title.includes(searchLower) || meta.includes(searchLower);
      
      if (matches || searchTerm === '') {
        item.classList.remove('hidden');
        visibleCount++;
      } else {
        item.classList.add('hidden');
      }
    });

    this.updateNoResultsMessage(visibleCount, searchTerm);
  }

  updateNoResultsMessage(visibleCount, searchTerm) {
    const documentSelector = document.getElementById('documentSelector');
    const existingMessage = documentSelector?.querySelector('.no-results');
    
    if (visibleCount === 0 && searchTerm && documentSelector) {
      if (!existingMessage) {
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.textContent = `No documents found for "${searchTerm}"`;
        documentSelector.appendChild(noResults);
      }
    } else if (existingMessage) {
      existingMessage.remove();
    }
  }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new DeepResearchApp();
});
