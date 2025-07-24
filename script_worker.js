class ChatApp {
    constructor() {
        // 設定 Worker URL - 部署後請更新此 URL
        // 部署說明請參考 README_DEPLOYMENT.md
        this.workerUrl = 'https://ai-qa-backend.jasonliu1563.workers.dev'; // 請替換為您的 Worker URL
        
        // 調試信息
        console.log('=== ChatApp 初始化 ===');
        console.log('設定的 Worker URL:', this.workerUrl);
        console.log('當前頁面位置:', window.location.href);
        
        this.initializeElements();
        this.bindEvents();
        this.loadSavedSettings();
        this.updateCharacterCount();
    }

    initializeElements() {
        this.showReferencesCheckbox = document.getElementById('showReferences');
        this.showThinkingCheckbox = document.getElementById('showThinking');
        this.showDebugCheckbox = document.getElementById('showDebug');
        this.chatContainer = document.getElementById('chatContainer');
        this.questionInput = document.getElementById('questionInput');
        this.sendButton = document.getElementById('sendButton');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.charCountElement = document.getElementById('charCount');
        
        // Settings panel elements
        this.settingsToggle = document.getElementById('settingsToggle');
        this.settingsPanel = document.getElementById('settingsPanel');
    }

    bindEvents() {
        // Settings panel toggle
        this.settingsToggle.addEventListener('click', () => {
            this.toggleSettingsPanel();
        });

        // 選項變更事件
        this.showReferencesCheckbox.addEventListener('change', () => {
            this.saveSettings();
        });

        this.showThinkingCheckbox.addEventListener('change', () => {
            this.saveSettings();
        });

        this.showDebugCheckbox.addEventListener('change', () => {
            this.saveSettings();
        });

        // 輸入框事件
        this.questionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (this.canSendMessage()) {
                    this.sendMessage();
                }
            }
        });

        this.questionInput.addEventListener('input', () => {
            this.updateCharacterCount();
            this.updateSendButtonState();
        });

        // 發送按鈕事件
        this.sendButton.addEventListener('click', () => {
            if (this.canSendMessage()) {
                this.sendMessage();
            }
        });

        // 快速問題按鈕事件
        document.querySelectorAll('.question-btn-compact').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const question = e.currentTarget.getAttribute('data-question');
                this.questionInput.value = question;
                this.updateCharacterCount();
                this.updateSendButtonState();
                if (this.canSendMessage()) {
                    this.sendMessage();
                }
            });
        });

        // 點擊設定面板外部時關閉
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.bottom-right-settings')) {
                this.hideSettingsPanel();
            }
        });

        // 防止設定面板內部點擊事件冒泡
        this.settingsPanel.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    toggleSettingsPanel() {
        const panel = this.settingsPanel;
        if (panel.style.display === 'block') {
            this.hideSettingsPanel();
        } else {
            this.showSettingsPanel();
        }
    }

    showSettingsPanel() {
        this.settingsPanel.style.display = 'block';
        this.settingsToggle.classList.add('active');
    }

    hideSettingsPanel() {
        this.settingsPanel.style.display = 'none';
        this.settingsToggle.classList.remove('active');
    }

    updateSendButtonState() {
        const hasQuestion = this.questionInput.value.trim().length > 0;
        this.sendButton.disabled = !hasQuestion;
        
        if (!hasQuestion) {
            this.sendButton.title = "請輸入問題";
        } else {
            this.sendButton.title = "發送問題";
        }
    }

    updateCharacterCount() {
        const currentLength = this.questionInput.value.length;
        this.charCountElement.textContent = currentLength.toLocaleString();
        
        // 根據字數變更顏色
        if (currentLength > 45000) {
            this.charCountElement.style.color = '#ff4757';
        } else if (currentLength > 40000) {
            this.charCountElement.style.color = '#ffa502';
        } else {
            this.charCountElement.style.color = '#666';
        }
    }

    canSendMessage() {
        return this.questionInput.value.trim().length > 0;
    }

    async sendMessage() {
        const question = this.questionInput.value.trim();
        if (!question) return;

        // 添加用戶消息
        this.addUserMessage(question);
        
        // 清空輸入框
        this.questionInput.value = '';
        this.updateSendButtonState();

        // 顯示載入中
        this.showLoading();

        try {
            // 調用 Cloudflare Worker API
            const response = await this.callWorkerAPI(question);
            
            // 調試：記錄完整回應結構
            if (this.showDebugCheckbox.checked) {
                console.log('=== Worker API Response 詳細分析 ===');
                console.log('Worker Response:', JSON.stringify(response, null, 2));
                
                // 特別檢查 grounding metadata
                if (response.candidates && response.candidates[0]) {
                    const candidate = response.candidates[0];
                    console.log('=== Gemini 回應分析 ===');
                    console.log('Grounding Metadata 存在:', !!candidate.groundingMetadata);
                    
                    if (candidate.groundingMetadata) {
                        console.log('Grounding Metadata Found:', candidate.groundingMetadata);
                        console.log('Search Queries:', candidate.groundingMetadata.webSearchQueries);
                        console.log('Grounding Chunks:', candidate.groundingMetadata.groundingChunks);
                        console.log('Grounding Chunks 數量:', candidate.groundingMetadata.groundingChunks?.length || 0);
                        console.log('Grounding Supports:', candidate.groundingMetadata.groundingSupports);
                        console.log('Grounding Supports 數量:', candidate.groundingMetadata.groundingSupports?.length || 0);
                    } else {
                        console.log('No grounding metadata found in response');
                    }
                    
                    // 檢查 enhancedThinkingContent（雙重 API 的標誌）
                    if (candidate.enhancedThinkingContent) {
                        console.log('✅ EnhancedThinkingContent 存在 (雙重 API 模式正常)');
                        console.log('EnhancedThinkingContent 長度:', candidate.enhancedThinkingContent.length);
                        console.log('EnhancedThinkingContent 預覽:', candidate.enhancedThinkingContent.substring(0, 100) + '...');
                    } else {
                        console.warn('⚠️ EnhancedThinkingContent 不存在 - 可能不是雙重 API 回應');
                    }
                }
            }

            // 處理和顯示回應
            this.processAndDisplayResponse(response, question);

        } catch (error) {
            console.error('發送消息時發生錯誤:', error);
            this.addErrorMessage('抱歉，發生了錯誤。請稍後再試。');
        } finally {
            this.hideLoading();
        }
    }

    // 調用 Cloudflare Worker API
    async callWorkerAPI(question) {
        if (!this.workerUrl || this.workerUrl.includes('your-worker-name')) {
            throw new Error('請先設定 Worker URL');
        }

        // 確保 URL 是絕對路徑且格式正確
        let finalUrl = this.workerUrl;
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            finalUrl = 'https://' + finalUrl;
        }
        
        // 調試信息
        console.log('=== API 調用詳細信息 ===');
        console.log('原始 workerUrl:', this.workerUrl);
        console.log('最終 URL:', finalUrl);
        console.log('當前頁面 URL:', window.location.href);

        const requestBody = {
            question: question,
            options: {
                dualMode: true, // 啟用雙重 API 模式
                withSearch: true
            }
        };

        console.log('請求體:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(finalUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log('收到回應，狀態:', response.status, response.statusText);
        console.log('實際請求的 URL:', response.url);

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            
            // 只嘗試讀取一次 response body - 克隆 response 以避免 stream 問題
            try {
                const responseClone = response.clone();
                const responseText = await responseClone.text();
                if (responseText) {
                    try {
                        const errorData = JSON.parse(responseText);
                        errorMessage = errorData.error || errorMessage;
                    } catch (parseError) {
                        errorMessage = responseText || errorMessage;
                    }
                }
            } catch (readError) {
                console.warn('無法讀取錯誤回應內容:', readError);
            }
            
            throw new Error(`Worker API 錯誤: ${errorMessage}`);
        }

        return await response.json();
    }

    processAndDisplayResponse(response, originalQuestion) {
        if (!response.candidates || response.candidates.length === 0) {
            this.addErrorMessage('API 回應中沒有找到候選答案');
            return;
        }

        const candidate = response.candidates[0];
        if (!candidate.content || !candidate.content.parts) {
            this.addErrorMessage('API 回應格式不正確');
            return;
        }

        // 提取回應內容
        let answerText = '';
        let thinkingText = '';

        // 從 parts 中提取內容
        candidate.content.parts.forEach(part => {
            if (part.text) {
                if (part.thought === true) {
                    thinkingText += part.text + '\n';
                } else {
                    answerText += part.text + '\n';
                }
            }
        });

        // 如果有 enhancedThinkingContent，使用它作為思考內容
        if (candidate.enhancedThinkingContent) {
            thinkingText = candidate.enhancedThinkingContent;
        }

        // 提取引用來源
        let references = [];
        if (candidate.groundingMetadata && candidate.groundingMetadata.groundingSupports) {
            references = this.extractReferences(candidate.groundingMetadata);
        }

        // 顯示回應
        this.addAIResponse({
            answer: answerText.trim() || '無法生成回應',
            thinking: thinkingText.trim(),
            references: references,
            originalQuestion: originalQuestion
        });
    }

    extractReferences(groundingMetadata) {
        const references = [];
        const seenUrls = new Set();

        if (groundingMetadata.groundingSupports) {
            groundingMetadata.groundingSupports.forEach(support => {
                if (support.groundingChunkIndices && groundingMetadata.groundingChunks) {
                    support.groundingChunkIndices.forEach(index => {
                        const chunk = groundingMetadata.groundingChunks[index];
                        if (chunk && chunk.web) {
                            const url = chunk.web.uri;
                            const title = chunk.web.title || 'Untitled';
                            
                            if (url && !seenUrls.has(url)) {
                                seenUrls.add(url);
                                references.push({
                                    title: title,
                                    url: url,
                                    snippet: ''
                                });
                            }
                        }
                    });
                }
            });
        }

        return references;
    }

    addUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <i class="fas fa-user"></i>
                    <span class="message-label">用戶</span>
                    <span class="message-time">${this.getCurrentTime()}</span>
                </div>
                <div class="message-text">${this.escapeHtml(message)}</div>
            </div>
        `;
        
        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addAIResponse(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai-message';
        
        let responseHtml = `
            <div class="message-content">
                <div class="message-header">
                    <i class="fas fa-robot"></i>
                    <span class="message-label">AI 助手</span>
                    <span class="message-time">${this.getCurrentTime()}</span>
                </div>
        `;

        // 顯示思考流程（如果啟用且有內容）
        if (this.showThinkingCheckbox.checked && data.thinking) {
            responseHtml += `
                <div class="thinking-section">
                    <div class="thinking-header">
                        <i class="fas fa-brain"></i>
                        <span>思考流程</span>
                        <button class="toggle-thinking" onclick="this.parentElement.parentElement.classList.toggle('collapsed')">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                    </div>
                    <div class="thinking-content">
                        ${this.formatThinking(data.thinking)}
                    </div>
                </div>
            `;
        }

        // 主要回答內容
        responseHtml += `
            <div class="response-section">
                <div class="response-header">
                    <i class="fas fa-comment-alt"></i>
                    <span>回答</span>
                </div>
                <div class="response-content">
                    ${this.formatResponse(data.answer)}
                </div>
            </div>
        `;

        // 顯示引用來源（如果啟用且有內容）
        if (this.showReferencesCheckbox.checked && data.references && data.references.length > 0) {
            responseHtml += `
                <div class="references-section">
                    <div class="references-header">
                        <i class="fas fa-link"></i>
                        <span>引用來源</span>
                        <button class="toggle-references" onclick="this.parentElement.parentElement.classList.toggle('collapsed')">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                    </div>
                    <div class="references-content">
                        ${this.formatReferences(data.references)}
                    </div>
                </div>
            `;
        }

        responseHtml += `</div>`;
        messageDiv.innerHTML = responseHtml;
        
        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addErrorMessage(errorText) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message error-message';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-header">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span class="message-label">錯誤</span>
                    <span class="message-time">${this.getCurrentTime()}</span>
                </div>
                <div class="error-text">${this.escapeHtml(errorText)}</div>
            </div>
        `;
        
        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatThinking(thinking) {
        if (!thinking) return '';
        
        // 處理 <thinking> 標籤
        let formatted = thinking.replace(/<thinking>([\s\S]*?)<\/thinking>/g, (match, content) => {
            return content.trim();
        });

        // 轉換為 HTML
        formatted = this.escapeHtml(formatted);
        formatted = formatted.replace(/\n/g, '<br>');
        
        // 處理數字列表
        formatted = formatted.replace(/(\d+)\.\s/g, '<strong>$1.</strong> ');
        
        return formatted;
    }

    formatResponse(response) {
        if (!response) return '';
        
        let formatted = this.escapeHtml(response);
        formatted = formatted.replace(/\n/g, '<br>');
        
        // 處理粗體文字
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // 處理斜體文字
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        return formatted;
    }

    formatReferences(references) {
        if (!references || references.length === 0) return '';
        
        return references.map((ref, index) => `
            <div class="reference-item">
                <div class="reference-number">${index + 1}</div>
                <div class="reference-details">
                    <a href="${ref.url}" target="_blank" rel="noopener noreferrer">
                        ${this.escapeHtml(ref.title)}
                    </a>
                    ${ref.snippet ? `<div class="reference-snippet">${this.escapeHtml(ref.snippet)}</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getCurrentTime() {
        return new Date().toLocaleTimeString('zh-TW', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }, 100);
    }

    showLoading() {
        this.loadingOverlay.style.display = 'flex';
        this.sendButton.disabled = true;
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
        this.updateSendButtonState();
    }

    saveSettings() {
        const settings = {
            showReferences: this.showReferencesCheckbox.checked,
            showThinking: this.showThinkingCheckbox.checked,
            showDebug: this.showDebugCheckbox.checked
        };
        
        localStorage.setItem('aiQASettings', JSON.stringify(settings));
    }

    loadSavedSettings() {
        try {
            const savedSettings = localStorage.getItem('aiQASettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                this.showReferencesCheckbox.checked = settings.showReferences !== false;
                this.showThinkingCheckbox.checked = settings.showThinking !== false;
                this.showDebugCheckbox.checked = settings.showDebug === true;
            }
        } catch (error) {
            console.error('載入設定時發生錯誤:', error);
        }
    }
}

// 初始化應用
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
