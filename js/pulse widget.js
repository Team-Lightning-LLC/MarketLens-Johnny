// Portfolio Pulse Widget - Integrated Version
// Manages digest generation, loading, parsing, and display

class PortfolioPulseWidget {
  constructor() {
    this.digest = null;
    this.isGenerating = false;
    this.pulseAPI = null;
    this.init();
  }

  init() {
    // Initialize Pulse-specific API wrapper
    this.pulseAPI = new PulseVertesiaAPI();
    
    // Bind UI events
    this.bindUI();
    
    // Load latest digest on startup
    this.loadLatestDigest();
    
    // Schedule daily auto-generation
    this.scheduleDigestAt(PULSE_CONFIG.DAILY_GENERATION_TIME);
  }

  bindUI() {
    // Manual generation trigger
    const generateBtn = document.getElementById('pulseGenerateBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.generateDigest());
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
      this.scheduleDigestAt(timeStr); // Re-schedule for next day
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
    
    const generateBtn = document.getElementById('pulseGenerateBtn');
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.textContent = 'Generating...';
    }

    try {
      // Execute async Pulse interaction
      await this.pulseAPI.executeAsync({ Task: 'begin' });
      
      // Wait for async completion (5 minutes)
      await new Promise(resolve => setTimeout(resolve, PULSE_CONFIG.GENERATION_WAIT_MS));
      
      // Load the newly generated digest
      await this.loadLatestDigest();
      
    } catch (error) {
      console.error('[Pulse] Generation failed:', error);
      this.showEmpty('Error generating digest. Please try again.');
      this.updateStatus('Error', false);
    } finally {
      this.isGenerating = false;
      
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Digest';
      }
    }
  }

  // Load latest digest from Vertesia object store
  async loadLatestDigest() {
    this.updateStatus('Loading...', false);

    try {
      // Get all objects
      const response = await this.pulseAPI.loadAllObjects(1000);
      const objects = response.objects || [];
      
      if (objects.length === 0) {
        throw new Error('No documents found in object store');
      }

      // Sort by most recent
      objects.sort((a, b) => {
        const dateA = new Date(b.updated_at || b.created_at);
        const dateB = new Date(a.updated_at || a.created_at);
        return dateA - dateB;
      });

      // Find digest document
      const digestObj = objects.find(obj => {
        const searchText = `${obj.name || ''} ${obj.properties?.title || ''}`.toLowerCase();
        return PULSE_CONFIG.DIGEST_KEYWORDS.some(keyword => searchText.includes(keyword));
      });

      if (!digestObj) {
        throw new Error('No digest document found');
      }

      // Get full object details
      const fullObject = await this.pulseAPI.getObject(digestObj.id);
      const contentSource = fullObject?.content?.source;
      
      if (!contentSource) {
        throw new Error('No content source in digest object');
      }

      // Download content
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

      if (!digestText || digestText.trim().length < 20) {
        throw new Error('Empty or invalid digest content');
      }

      // Parse digest structure
      this.digest = this.parseDigest(digestText);
      this.digest.created_at = fullObject.created_at || fullObject.updated_at || new Date().toISOString();
      
      // Render to UI
      this.renderDigest();
      this.updateStatus('Active', true);

    } catch (error) {
      console.error('[Pulse] Failed to load digest:', error);
      this.updateStatus('Error', false);
      this.showEmpty('Unable to load digest. Click "Generate Digest" to create one.');
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
    // Clean formatting
    let text = rawText
      .replace(/\r/g, '')
      .replace(/\u00AD/g, '') // soft hyphens
      .replace(/^#+\s*/gm, '') // markdown headers
      .replace(/#+(?=\s|$)/g, '')
      .replace(/###+/g, '')
      .trim();

    // Split into article blocks
    const articleBlocks = text
      .split(/(?=Article\s+\d+)/gi)
      .map(block => block.trim())
      .filter(Boolean);

    const articles = [];

    for (const block of articleBlocks) {
      // Extract article title
      const titleMatch = block.match(/Article\s+\d+\s*[-–:]\s*(.+)/i);
      const title = titleMatch ? titleMatch[1].trim() : 'Untitled Article';

      // Extract contents section
      const contentsMatch = block.match(/Contents\s*\d*[\s\S]*?(?=(Citations|Article\s+\d+|$))/i);
      let contents = contentsMatch 
        ? contentsMatch[0].replace(/Contents\s*\d*/i, '').trim()
        : '';

      // Convert bullet points and format text
      const lines = contents
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      const formattedLines = [];
      for (const line of lines) {
        if (/^[-•*]\s*\*\*.+?:/.test(line)) {
          // Bullet with bold header
          formattedLines.push(`<li>${this.formatMarkdown(line.replace(/^[-•*]\s*/, '').trim())}</li>`);
        } else if (/^[-•*]\s+/.test(line)) {
          // Regular bullet
          formattedLines.push(`<li>${this.formatMarkdown(line.replace(/^[-•*]\s*/, '').trim())}</li>`);
        } else {
          // Paragraph
          formattedLines.push(`<p>${this.formatMarkdown(line)}</p>`);
        }
      }

      contents = `<ul class="pulse-article-content">${formattedLines.join('')}</ul>`;

      // Extract citations
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

    // Extract document title
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

    // Update date displays
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

    // Render articles
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

  // Format markdown text (bold, italic)
  formatMarkdown(text) {
    if (!text) return '';
    
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  // Update status indicator
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

  // Show empty state message
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
