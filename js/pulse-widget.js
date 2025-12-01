// Portfolio Pulse Widget - Integrated Version 3
// Manages digest generation, loading, parsing, display, and history navigation

class PortfolioPulseWidget {
  constructor() {
    this.digest = null;
    this.allDigests = [];        // Store all digests for history navigation
    this.currentDigestIndex = 0; // Track current position in history
    this.isGenerating = false;
    this.pulseAPI = null;
    this.init();
  }

  async init() {
    // Initialize Pulse-specific API wrapper
    this.pulseAPI = new PulseVertesiaAPI();
    
    // Bind UI events
    this.bindUI();
    
    // Load all digests on startup
    await this.loadAllDigests();
    
    // Check if digest is from today, if not generate one
    await this.checkAndGenerateIfNeeded();
    
    // Schedule daily auto-generation
    this.scheduleDigestAt(PULSE_CONFIG.DAILY_GENERATION_TIME);
  }

  bindUI() {
    // Watchlist upload button
    const uploadBtn = document.getElementById('pulseUploadBtn');
    const fileInput = document.getElementById('watchlistFileInput');
    const changeBtn = document.getElementById('watchlistChangeBtn');
    const refreshBtn = document.getElementById('watchlistRefreshBtn');

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleWatchlistUpload(e));
    }

    if (changeBtn && fileInput) {
      changeBtn.addEventListener('click', () => fileInput.click());
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.generateDigest());
    }

    // History navigation buttons
    const prevBtn = document.getElementById('pulseNavPrev');
    const nextBtn = document.getElementById('pulseNavNext');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.navigateDigest(1)); // +1 = older (higher index)
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.navigateDigest(-1)); // -1 = newer (lower index)
    }

    // Expand/collapse article cards
    document.addEventListener('click', (e) => {
      const header = e.target.closest('.pulse-article-header');
      if (!header) return;
      
      const article = header.closest('.pulse-article');
      if (article) {
        article.classList.toggle('expanded');
      }
    });

    // Check for existing watchlist on load
    this.checkExistingWatchlist();
  }

  // Show/hide loading overlay
  showLoadingOverlay(show) {
    const overlay = document.getElementById('pulseLoadingOverlay');
    if (overlay) {
      overlay.style.display = show ? 'flex' : 'none';
    }
  }

  // Navigate between digests (-1 = newer, +1 = older)
  navigateDigest(direction) {
    const newIndex = this.currentDigestIndex + direction;
    
    if (newIndex < 0 || newIndex >= this.allDigests.length) return;
    
    this.currentDigestIndex = newIndex;
    this.digest = this.allDigests[newIndex];
    this.renderDigest();
    this.updateNavButtons();
  }

  // Update navigation button states
  updateNavButtons() {
    const prevBtn = document.getElementById('pulseNavPrev');
    const nextBtn = document.getElementById('pulseNavNext');
    
    if (prevBtn) {
      // Can go to older (higher index = older)
      prevBtn.disabled = this.currentDigestIndex >= this.allDigests.length - 1;
    }
    if (nextBtn) {
      // Can go to newer (lower index = newer)
      nextBtn.disabled = this.currentDigestIndex <= 0;
    }
  }

  // Check if user already has a watchlist uploaded
  async checkExistingWatchlist() {
    try {
      const response = await fetch(`${PULSE_CONFIG.VERTESIA_BASE_URL}/objects?limit=100`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PULSE_CONFIG.VERTESIA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;

      const objects = await response.json();
      const objectsArray = Array.isArray(objects) ? objects : objects.objects || [];
      const watchlist = objectsArray.find(obj => 
        (obj.name && obj.name.startsWith('My Watchlist:')) || 
        (obj.properties && obj.properties.type === 'watchlist')
      );

      if (watchlist) {
        this.showWatchlistDisplay(watchlist);
      }
    } catch (error) {
      console.error('[Pulse] Failed to check for existing watchlist:', error);
    }
  }

  // Handle watchlist file upload
  async handleWatchlistUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const controls = document.querySelector('.watchlist-controls');
    const uploadBtn = document.getElementById('pulseUploadBtn');
    
    try {
      // Show uploading state
      controls?.classList.add('uploading');
      if (uploadBtn) uploadBtn.textContent = 'Uploading...';

      // Step 1: Delete existing watchlist(s) - ONLY watchlists, nothing else
      await this.deleteExistingWatchlists();

      // Step 2: Delete today's digest to allow fresh generation
      await this.deleteTodaysDigest();

      // Step 3: Upload new watchlist with standardized name
      const today = new Date();
      const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}-${today.getFullYear()}`;
      const watchlistName = `My Watchlist: ${dateStr}`;

      const uploadedDoc = await this.uploadWatchlistFile(file, watchlistName);

      // Step 4: Show success state
      this.showWatchlistDisplay(uploadedDoc);

      // Step 5: Wait for vectorization then generate digest
      this.updateStatus('Processing...', true);
      console.log('[Pulse] Waiting 30 seconds for vectorization...');
      
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Step 6: Auto-generate digest
      await this.generateDigest();

    } catch (error) {
      console.error('[Pulse] Watchlist upload failed:', error);
      alert('Failed to upload watchlist. Please try again.');
      this.updateStatus('Upload Failed', false);
    } finally {
      controls?.classList.remove('uploading');
      if (uploadBtn) {
        uploadBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload Watchlist
        `;
      }
      // Reset file input
      event.target.value = '';
    }
  }

  // Delete any existing watchlist documents - SAFETY: Only deletes watchlist documents
  async deleteExistingWatchlists() {
    try {
      const response = await fetch(`${PULSE_CONFIG.VERTESIA_BASE_URL}/objects?limit=1000`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PULSE_CONFIG.VERTESIA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch objects: ${response.statusText}`);
      }

      const objects = await response.json();
      const objectsArray = Array.isArray(objects) ? objects : objects.objects || [];
      
      // SAFETY CHECK: Find ONLY watchlist documents
      const watchlists = objectsArray.filter(obj => {
        if (!obj.name) return false;
        
        const isWatchlistName = obj.name && obj.name.startsWith('My Watchlist:');
        const isWatchlistType = obj.properties && obj.properties.type === 'watchlist';
        
        if (!isWatchlistName && !isWatchlistType) return false;
        
        console.log(`[Pulse] Found watchlist to delete: "${obj.name}" (ID: ${obj.id})`);
        return true;
      });

      if (watchlists.length === 0) {
        console.log('[Pulse] No existing watchlists to delete');
        return;
      }

      for (const watchlist of watchlists) {
        console.log(`[Pulse] Deleting watchlist: ${watchlist.name}`);
        
        const deleteResponse = await fetch(`${PULSE_CONFIG.VERTESIA_BASE_URL}/objects/${watchlist.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${PULSE_CONFIG.VERTESIA_API_KEY}`
          }
        });

        if (!deleteResponse.ok) {
          console.error(`[Pulse] Failed to delete watchlist ${watchlist.id}:`, deleteResponse.statusText);
        } else {
          console.log(`[Pulse] Successfully deleted: ${watchlist.name}`);
        }
      }

      console.log(`[Pulse] Deleted ${watchlists.length} existing watchlist(s)`);
    } catch (error) {
      console.error('[Pulse] Error deleting existing watchlists:', error);
      throw error;
    }
  }

  // Upload the watchlist file to Vertesia
  async uploadWatchlistFile(file, name) {
    try {
      // Step 1: Get upload URL
      const uploadUrlResponse = await fetch(`${PULSE_CONFIG.VERTESIA_BASE_URL}/objects/upload-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PULSE_CONFIG.VERTESIA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          mime_type: file.type || 'application/octet-stream'
        })
      });

      if (!uploadUrlResponse.ok) {
        throw new Error(`Failed to get upload URL: ${uploadUrlResponse.statusText}`);
      }

      const uploadData = await uploadUrlResponse.json();
      console.log('[Pulse] Upload URL response:', uploadData);

      // Step 2: Upload file to the signed URL
      const uploadResponse = await fetch(uploadData.url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream'
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
      }

      console.log('[Pulse] File uploaded to cloud storage');

      // Step 3: Create object in Vertesia that references the uploaded file
      const createResponse = await fetch(`${PULSE_CONFIG.VERTESIA_BASE_URL}/objects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PULSE_CONFIG.VERTESIA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          content: {
            source: uploadData.id,
            type: file.type || 'application/octet-stream',
            name: file.name
          },
          properties: {
            type: 'watchlist',
            uploaded_at: new Date().toISOString(),
            original_filename: file.name
          }
        })
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('[Pulse] Create object failed:', errorText);
        throw new Error(`Failed to create object: ${createResponse.statusText}`);
      }

      const createdObject = await createResponse.json();
      console.log('[Pulse] Watchlist object created:', createdObject);
      
      return createdObject;
    } catch (error) {
      console.error('[Pulse] Error uploading watchlist:', error);
      throw error;
    }
  }

  // Delete today's digest to allow fresh generation
  async deleteTodaysDigest() {
    try {
      const response = await fetch(`${PULSE_CONFIG.VERTESIA_BASE_URL}/objects?limit=1000`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PULSE_CONFIG.VERTESIA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch objects: ${response.statusText}`);
      }

      const objects = await response.json();
      const objectsArray = Array.isArray(objects) ? objects : objects.objects || [];
      
      const today = new Date();
      const todayStr = today.toLocaleDateString('en-US');
      
      const todaysDigests = objectsArray.filter(obj => {
        if (!obj.name) return false;
        
        const isDigest = obj.name.toLowerCase().startsWith('digest:');
        if (!isDigest) return false;
        
        const objDate = new Date(obj.created_at || obj.updated_at);
        const objDateStr = objDate.toLocaleDateString('en-US');
        
        if (objDateStr !== todayStr) return false;
        
        console.log(`[Pulse] Found today's digest to delete: "${obj.name}" (ID: ${obj.id})`);
        return true;
      });

      if (todaysDigests.length === 0) {
        console.log('[Pulse] No digest from today to delete');
        return;
      }

      for (const digest of todaysDigests) {
        console.log(`[Pulse] Deleting today's digest: ${digest.name}`);
        
        const deleteResponse = await fetch(`${PULSE_CONFIG.VERTESIA_BASE_URL}/objects/${digest.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${PULSE_CONFIG.VERTESIA_API_KEY}`
          }
        });

        if (!deleteResponse.ok) {
          console.error(`[Pulse] Failed to delete digest ${digest.id}:`, deleteResponse.statusText);
        } else {
          console.log(`[Pulse] Successfully deleted: ${digest.name}`);
        }
      }

      console.log(`[Pulse] Deleted ${todaysDigests.length} digest(s) from today`);
    } catch (error) {
      console.error('[Pulse] Error deleting today\'s digest:', error);
    }
  }

  // Show the watchlist display UI
  showWatchlistDisplay(watchlistDoc) {
    const uploadBtn = document.getElementById('pulseUploadBtn');
    const watchlistDisplay = document.getElementById('watchlistDisplay');
    const watchlistName = document.getElementById('watchlistName');

    if (uploadBtn) uploadBtn.style.display = 'none';
    if (watchlistDisplay) watchlistDisplay.style.display = 'flex';

    if (watchlistName && watchlistDoc) {
      const updatedDate = new Date(watchlistDoc.created_at || watchlistDoc.properties?.uploaded_at);
      const formattedDate = updatedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      watchlistName.setAttribute('data-tooltip', `Last updated: ${formattedDate}`);
    }
  }

  // Check if digest is from today, if not generate new one
  async checkAndGenerateIfNeeded() {
    if (!this.digest || !this.digest.created_at) {
      console.log('[Pulse] No digest found, generating new one');
      await this.generateDigest();
      return;
    }

    const digestDate = new Date(this.digest.created_at);
    const today = new Date();
    
    const isSameDay = digestDate.getDate() === today.getDate() &&
                      digestDate.getMonth() === today.getMonth() &&
                      digestDate.getFullYear() === today.getFullYear();
    
    if (!isSameDay) {
      console.log('[Pulse] Digest is not from today, generating new one');
      console.log(`[Pulse] Last digest: ${digestDate.toLocaleDateString()}, Today: ${today.toLocaleDateString()}`);
      await this.generateDigest();
    } else {
      console.log('[Pulse] Digest is current, no generation needed');
    }
  }

  // Scheduler for daily auto-generation
  scheduleDigestAt(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    const scheduledTime = new Date(now);
    scheduledTime.setHours(hours, minutes, 0, 0);
    
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const delay = scheduledTime - now;
    console.log(`[Pulse] Next digest scheduled at ${timeStr} (in ${(delay / 60000).toFixed(1)} minutes)`);

    setTimeout(async () => {
      console.log('[Pulse] Running scheduled digest generation');
      await this.generateDigest();
      this.scheduleDigestAt(timeStr);
    }, delay);
  }

  // Manual or scheduled digest generation
  async generateDigest() {
    if (this.isGenerating) {
      console.log('[Pulse] Generation already in progress');
      return;
    }
    
    this.isGenerating = true;
    this.updateStatus('Generating...', false);
    this.showLoadingOverlay(true);
    
    const refreshBtn = document.getElementById('watchlistRefreshBtn');
    const changeBtn = document.getElementById('watchlistChangeBtn');
    
    if (refreshBtn) refreshBtn.disabled = true;
    if (changeBtn) changeBtn.disabled = true;

    try {
      await this.pulseAPI.executeAsync({ Task: 'begin' });
      await new Promise(resolve => setTimeout(resolve, PULSE_CONFIG.GENERATION_WAIT_MS));
      await this.loadAllDigests();
      
    } catch (error) {
      console.error('[Pulse] Generation failed:', error);
      this.showEmpty('Error generating digest. Please try again.');
      this.updateStatus('Error', false);
    } finally {
      this.isGenerating = false;
      this.showLoadingOverlay(false);
      
      if (refreshBtn) refreshBtn.disabled = false;
      if (changeBtn) changeBtn.disabled = false;
    }
  }

  // Load all digests from Vertesia object store
async loadAllDigests() {
  this.updateStatus('Loading...', false);
  this.showLoadingOverlay(true);

    try {
      const response = await this.pulseAPI.loadAllObjects(1000);
      const objects = response.objects || [];
      
      if (objects.length === 0) {
        throw new Error('No documents found in object store');
      }

      // Find all digest documents
      const digestObjects = objects.filter(obj => {
        const searchText = `${obj.name || ''} ${obj.properties?.title || ''}`.toLowerCase();
        return PULSE_CONFIG.DIGEST_KEYWORDS.some(keyword => searchText.includes(keyword));
      });

      if (digestObjects.length === 0) {
        throw new Error('No digest documents found');
      }

      // Sort by date (newest first)
      digestObjects.sort((a, b) => {
        const dateA = new Date(a.created_at || a.updated_at);
        const dateB = new Date(b.created_at || b.updated_at);
        return dateB - dateA;
      });

      // Load and parse each digest
      this.allDigests = [];
      for (const digestObj of digestObjects) {
        try {
          const fullObject = await this.pulseAPI.getObject(digestObj.id);
          const contentSource = fullObject?.content?.source;
          
          if (!contentSource) continue;

          let digestText;
          if (typeof contentSource === 'string') {
            if (contentSource.startsWith('gs://') || contentSource.startsWith('s3://')) {
              digestText = await this.downloadAsText(contentSource);
            } else {
              digestText = contentSource;
            }
          } else if (typeof contentSource === 'object') {
            const fileRef = contentSource.file || contentSource.store || contentSource.path || contentSource.key;
            digestText = await this.downloadAsText(fileRef);
          }

          if (!digestText || digestText.trim().length < 20) continue;

          const parsed = this.parseDigest(digestText);
          parsed.created_at = fullObject.created_at || fullObject.updated_at || new Date().toISOString();
          parsed.id = digestObj.id;
          
          this.allDigests.push(parsed);
        } catch (err) {
          console.error('[Pulse] Failed to load digest:', digestObj.id, err);
        }
      }

      if (this.allDigests.length === 0) {
        throw new Error('No valid digests found');
      }

      console.log(`[Pulse] Loaded ${this.allDigests.length} digest(s)`);

      // Set current to newest
      this.currentDigestIndex = 0;
      this.digest = this.allDigests[0];
      
      this.renderDigest();
      this.updateNavButtons();
      this.updateStatus('Active', true);
      this.showLoadingOverlay(false);

} catch (error) {
      console.error('[Pulse] Failed to load digests:', error);
      this.updateStatus('No Digest', false);
      this.showLoadingOverlay(false); 
      this.digest = null;
      this.allDigests = [];
      this.updateNavButtons();
    }
  }

  async downloadAsText(fileRef) {
    const urlData = await this.pulseAPI.getDownloadUrl(fileRef, 'original');
    const response = await fetch(urlData.url);
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.text();
  }

  // Parse digest markdown into structured data
  parseDigest(rawText) {
    let text = rawText
      .replace(/\r/g, '')
      .replace(/\u00AD/g, '')
      .replace(/^#+\s*/gm, '')
      .replace(/#+(?=\s|$)/g, '')
      .replace(/###+/g, '')
      .trim();

    const articleBlocks = text
      .split(/(?=Article\s+\d+)/gi)
      .map(block => block.trim())
      .filter(Boolean);

    let articles = [];

    for (const block of articleBlocks) {
      const titleMatch = block.match(/Article\s+\d+\s*[-–:]\s*(.+)/i);
      const title = titleMatch ? titleMatch[1].trim() : 'Untitled Article';

      const contentsMatch = block.match(/Contents\s*\d*[\s\S]*?(?=(Citations|Article\s+\d+|$))/i);
      let contents = contentsMatch 
        ? contentsMatch[0].replace(/Contents\s*\d*/i, '').trim()
        : '';

      const lines = contents
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      const formattedLines = [];
      for (const line of lines) {
        if (/^[-•*]\s*\*\*.+?:/.test(line)) {
          formattedLines.push(`<li>${this.formatMarkdown(line.replace(/^[-•*]\s*/, '').trim())}</li>`);
        } else if (/^[-•*]\s+/.test(line)) {
          formattedLines.push(`<li>${this.formatMarkdown(line.replace(/^[-•*]\s*/, '').trim())}</li>`);
        } else {
          formattedLines.push(`<p>${this.formatMarkdown(line)}</p>`);
        }
      }

      contents = `<ul class="pulse-article-content">${formattedLines.join('')}</ul>`;

      const citations = [];
      const citationsMatch = block.match(/Citations\s*\d*[\s\S]*?(?=(Article\s+\d+|$))/i);
      
      if (citationsMatch) {
        const citationLines = citationsMatch[0]
          .replace(/Citations\s*\d*/i, '')
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean);

        for (const line of citationLines) {
          const urlMatch = line.match(/\((https?:\/\/[^\s)]+)\)/);
          if (urlMatch) {
            const url = urlMatch[1];
            const text = line
              .replace(/\[|\]/g, '')
              .replace(/\(https?:\/\/[^\s)]+\)/, '')
              .trim();
            
            citations.push({
              title: text || 'Source',
              url: url
            });
          }
        }
      }

      articles.push({ title, contents, citations });
    }

    articles = articles.filter(article => article.title !== 'Untitled Article');

    const docTitle = text.match(/^#?\s*Scout Pulse Portfolio Digest.*$/m)?.[0]
      ?.replace(/^#\s*/, '').trim() 
      || 'Portfolio Digest';

    return { title: docTitle, articles };
  }

  // Render digest to UI
  renderDigest() {
    if (!this.digest) return;

    const container = document.getElementById('pulseArticlesContainer');
    const dateDisplay = document.getElementById('pulseDateDisplay');
    const lastUpdate = document.getElementById('pulseLastUpdate');

    if (!container) return;

    const createdDate = new Date(this.digest.created_at);

    if (dateDisplay) {
      dateDisplay.textContent = createdDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    if (lastUpdate) {
      lastUpdate.textContent = `Last Update: ${createdDate.toLocaleString()}`;
    }

    container.innerHTML = this.digest.articles.map(article => `
      <div class="pulse-article">
        <div class="pulse-article-header">
          <div class="pulse-article-title">${this.formatMarkdown(article.title)}</div>
          <div class="pulse-article-toggle">▼</div>
        </div>
        <div class="pulse-article-details">
          <div class="pulse-article-body">
            ${article.contents}
          </div>
          ${article.citations.length > 0 ? `
            <div class="pulse-article-sources">
              <strong>Citations:</strong>
              <ul class="pulse-source-list">
                ${article.citations.map(citation => `
                  <li>
                    <a href="${citation.url}" target="_blank" rel="noopener noreferrer">
                      ${this.formatMarkdown(citation.title)}
                    </a>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  formatMarkdown(text) {
    if (!text) return '';
    
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  updateStatus(text, active) {
    const statusDot = document.getElementById('pulseStatusDot');
    const statusText = document.getElementById('pulseStatusText');

    if (statusText) {
      statusText.textContent = text;
    }

    if (statusDot) {
      statusDot.style.background = active ? '#10b981' : '#9ca3af';
    }
  }

  showEmpty(message) {
    const container = document.getElementById('pulseArticlesContainer');
    if (container) {
      container.innerHTML = `
        <div class="pulse-empty-state">
          <p>${message}</p>
        </div>
      `;
    }
  }
}

// Pulse-specific Vertesia API wrapper
class PulseVertesiaAPI {
  constructor() {
    this.baseURL = PULSE_CONFIG.VERTESIA_BASE_URL;
    this.apiKey = PULSE_CONFIG.VERTESIA_API_KEY;
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async call(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const defaultOptions = {
      method: 'GET',
      headers: this.getHeaders()
    };

    const response = await fetch(url, { ...defaultOptions, ...options });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  }

  async executeAsync(data = { Task: 'begin' }) {
    return await this.call('/execute/async', {
      method: 'POST',
      body: JSON.stringify({
        type: 'conversation',
        interaction: PULSE_CONFIG.INTERACTION_NAME,
        data: data,
        config: {
          environment: PULSE_CONFIG.ENVIRONMENT_ID,
          model: PULSE_CONFIG.MODEL
        }
      })
    });
  }

  async loadAllObjects(limit = 1000, offset = 0) {
    const response = await this.call(`/objects?limit=${limit}&offset=${offset}`);
    return Array.isArray(response) ? { objects: response } : response;
  }

  async getObject(id) {
    if (!id) throw new Error('Object ID required');
    return await this.call(`/objects/${encodeURIComponent(id)}`);
  }

  async getDownloadUrl(file, format = 'original') {
    return await this.call('/objects/download-url', {
      method: 'POST',
      body: JSON.stringify({ file, format })
    });
  }
}

// Initialize when included
window.portfolioPulse = null;
