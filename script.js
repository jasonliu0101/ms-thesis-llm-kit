class ChatApp {
    constructor() {
        this.geminiApiKey = '';
        this.initializeElements();
        this.bindEvents();
        this.loadSavedSettings();
        this.updateCharacterCount();
    }

    initializeElements() {
        this.geminiApiKeyInput = document.getElementById('geminiApiKey');
        this.geminiApiKeyContainer = document.querySelector('.gemini-api-key');
        this.toggleGeminiApiKeyBtn = document.getElementById('toggleGeminiApiKey');
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

        // API Key 相關事件
        this.geminiApiKeyInput.addEventListener('input', () => {
            this.geminiApiKey = this.geminiApiKeyInput.value.trim();
            this.updateSendButtonState();
            this.saveSettings();
        });

        this.toggleGeminiApiKeyBtn.addEventListener('click', () => {
            this.toggleApiKeyVisibility(this.geminiApiKeyInput, this.toggleGeminiApiKeyBtn);
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

        // 預設問題按鈕事件
        document.querySelectorAll('.question-btn-compact').forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.getAttribute('data-question');
                this.questionInput.value = question;
                this.updateSendButtonState();
                this.questionInput.focus();
            });
        });

        // 問題輸入事件
        this.questionInput.addEventListener('input', () => {
            this.updateSendButtonState();
            this.updateCharacterCount();
        });

        this.questionInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (this.canSendMessage()) {
                    this.sendMessage();
                }
            }
        });

        // 發送按鈕事件
        this.sendButton.addEventListener('click', () => {
            if (this.canSendMessage()) {
                this.sendMessage();
            }
        });
    }

    toggleApiKeyVisibility(input, button) {
        const icon = button.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    toggleSettingsPanel() {
        const isActive = this.settingsPanel.classList.contains('active');
        
        if (isActive) {
            this.settingsPanel.classList.remove('active');
            this.settingsToggle.classList.remove('active');
        } else {
            this.settingsPanel.classList.add('active');
            this.settingsToggle.classList.add('active');
        }
        
        this.saveSettings();
    }

    updateSendButtonState() {
        const hasApiKey = this.geminiApiKey.length > 0;
        const hasQuestion = this.questionInput.value.trim().length > 0;
        
        this.sendButton.disabled = !(hasApiKey && hasQuestion);
        
        if (!hasApiKey) {
            this.sendButton.title = "請先設定 Gemini API Key";
        } else if (!hasQuestion) {
            this.sendButton.title = "請輸入問題";
        } else {
            this.sendButton.title = "發送問題";
        }
    }

    updateCharacterCount() {
        if (this.charCountElement) {
            const currentLength = this.questionInput.value.length;
            this.charCountElement.textContent = currentLength.toLocaleString();
            
            if (currentLength > 45000) {
                this.charCountElement.style.color = '#f44336';
            } else if (currentLength > 40000) {
                this.charCountElement.style.color = '#ff9800';
            } else {
                this.charCountElement.style.color = '#666';
            }
        }
    }

    canSendMessage() {
        return this.geminiApiKey.length > 0 && this.questionInput.value.trim().length > 0;
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
            // 調用雙重 Gemini API：同時獲取搜尋結果和推理流程
            const response = await this.callDualGeminiAPI(question);
            
            // 調試：記錄完整回應結構
            if (this.showDebugCheckbox.checked) {
                console.log('=== API Response 詳細分析 ===');
                console.log('API Response:', JSON.stringify(response, null, 2));
                
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
                
                this.addDebugMessage(response);
            }
            
            // 隱藏載入中
            this.hideLoading();
            
            // 添加 AI 回覆
            this.addAIMessage(response);
            
        } catch (error) {
            this.hideLoading();
            console.error('API 調用錯誤:', error);
            
            // 檢查是否是 Gemini 的 grounding 相關錯誤
            if (error.message.includes('grounding') || error.message.includes('search') || error.message.includes('google_search')) {
                this.addErrorMessage('Google 搜尋功能暫時不可用，正在嘗試使用 fallback API 重新回答...');
                
                // 嘗試使用 Gemini fallback API 重新請求
                try {
                    const fallbackResponse = await this.callGeminiFallbackAPI(question);
                    this.addAIMessage(fallbackResponse);
                } catch (fallbackError) {
                    this.addErrorMessage('Fallback 請求失敗: ' + fallbackError.message);
                }
            } else {
                this.addErrorMessage(error.message);
            }
        }
    }

    addUserMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message user-message';
        messageElement.innerHTML = `
            <div class="message-header">
                <i class="fas fa-user"></i>
                您
            </div>
            <div class="message-content">${this.escapeHtml(message)}</div>
        `;
        
        this.appendMessageToChat(messageElement);
    }

    addAIMessage(response) {
        if (!response.candidates || response.candidates.length === 0) {
            this.addErrorMessage('API 回應格式錯誤');
            return;
        }

        const candidate = response.candidates[0];
        
        // 檢查是否因為 token 限制而被截斷
        if (candidate.finishReason === 'MAX_TOKENS') {
            this.addErrorMessage('回應因為長度限制被截斷，請嘗試提出更簡短的問題或關閉思考流程選項');
            return;
        }

        // 檢查是否有實際內容
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            this.addErrorMessage('AI 沒有提供有效的回應內容');
            return;
        }

        const messageElement = document.createElement('div');
        messageElement.className = 'message ai-message';
        
        let content = `
            <div class="message-header">
                <i class="fas fa-robot"></i>
                AI 助手
            </div>
        `;

        // 處理內容部分
        let mainContent = '';
        let thinkingContent = '';
        
        // 收集所有非思考內容，用於去重
        const nonThoughtParts = [];
        const thoughtParts = [];
        
        candidate.content.parts.forEach(part => {
            if (part.text) {
                if (part.thought === true) {
                    thoughtParts.push(part.text);
                } else {
                    nonThoughtParts.push(part.text);
                }
            }
        });
        
        // 對非思考內容進行去重處理
        if (nonThoughtParts.length > 1) {
            // 根據是否顯示引用來源來選擇最適合的內容
            if (!this.showReferencesCheckbox.checked) {
                // 關閉引用來源時，主文直接採用推理模型（無搜尋）的回應
                // 推理模型的回應通常不包含參考資料區塊，長度較短
                const partsWithoutReferences = nonThoughtParts.filter(part => {
                    // 檢查是否包含參考資料區塊
                    const hasReferences = /---\s*\*?\*?參考資料：?\*?\*?\s*\n/.test(part) ||
                                        /---\s*參考資料：?\s*\n/.test(part) ||
                                        /\n\n參考來源：?\s*\n/.test(part) ||
                                        /\n\n引用來源：?\s*\n/.test(part) ||
                                        /\*\*引用來源：?\*\*/.test(part);
                    return !hasReferences;
                });
                
                if (partsWithoutReferences.length > 0) {
                    // 有無參考資料的版本（推理模型），選擇最長的
                    const sortedNoRef = partsWithoutReferences.sort((a, b) => b.length - a.length);
                    mainContent = sortedNoRef[0];
                    
                    if (this.showDebugCheckbox.checked) {
                        console.log('🧠 關閉引用來源，使用推理模型回應:');
                        console.log(`  找到 ${partsWithoutReferences.length} 個推理模型版本`);
                        console.log(`  選擇長度: ${mainContent.length} 字元`);
                        console.log(`  內容預覽: ${mainContent.substring(0, 100)}...`);
                    }
                } else {
                    // 沒有純推理版本，選擇最短的（可能是精簡版本）
                    const sortedByLength = nonThoughtParts.sort((a, b) => a.length - b.length);
                    mainContent = sortedByLength[0];
                    
                    if (this.showDebugCheckbox.checked) {
                        console.log('⚠️ 沒有找到純推理版本，選擇最短的:');
                        console.log(`  選擇長度: ${mainContent.length} 字元（含參考資料，稍後清理）`);
                    }
                }
            } else {
                // 開啟引用來源時，使用搜尋模型的回應
                // 搜尋模型的回應通常包含參考資料，長度較長
                const partsWithReferences = nonThoughtParts.filter(part => {
                    // 檢查是否包含參考資料區塊
                    const hasReferences = /---\s*\*?\*?參考資料：?\*?\*?\s*\n/.test(part) ||
                                        /---\s*參考資料：?\s*\n/.test(part) ||
                                        /\n\n參考來源：?\s*\n/.test(part) ||
                                        /\n\n引用來源：?\s*\n/.test(part) ||
                                        /\*\*引用來源：?\*\*/.test(part);
                    return hasReferences;
                });
                
                if (partsWithReferences.length > 0) {
                    // 有包含參考資料的版本（搜尋模型），選擇最長的
                    const sortedWithRef = partsWithReferences.sort((a, b) => b.length - a.length);
                    mainContent = sortedWithRef[0];
                    
                    if (this.showDebugCheckbox.checked) {
                        console.log('� 開啟引用來源，使用搜尋模型回應:');
                        console.log(`  找到 ${partsWithReferences.length} 個搜尋模型版本`);
                        console.log(`  選擇長度: ${mainContent.length} 字元`);
                        console.log(`  內容預覽: ${mainContent.substring(0, 100)}...`);
                    }
                } else {
                    // 沒有搜尋版本，選擇最長的
                    const sortedByLength = nonThoughtParts.sort((a, b) => b.length - a.length);
                    mainContent = sortedByLength[0];
                    
                    if (this.showDebugCheckbox.checked) {
                        console.log('⚠️ 沒有找到搜尋模型版本，選擇最長的:');
                        console.log(`  選擇長度: ${mainContent.length} 字元`);
                    }
                }
            }
            
            if (this.showDebugCheckbox.checked) {
                console.log('📊 所有非思考部分分析:');
                nonThoughtParts.forEach((part, index) => {
                    const hasRef = /---\s*\*?\*?參考資料：?\*?\*?\s*\n/.test(part) ||
                                  /\n\n參考來源：?\s*\n/.test(part);
                    console.log(`  Part ${index + 1}: 長度 ${part.length} 字元, 含參考資料: ${hasRef}`);
                });
            }
        } else if (nonThoughtParts.length === 1) {
            mainContent = nonThoughtParts[0];
        }
        
        // 合併思考內容
        thinkingContent = thoughtParts.join('\n\n');

        // 檢查是否有來自不同來源的思考內容，優先使用 enhancedThinkingContent
        if (candidate.enhancedThinkingContent) {
            // 最優先使用雙重 Gemini API 選擇的 enhancedThinkingContent
            thinkingContent = candidate.enhancedThinkingContent;
        }

        // 調試：輸出思考內容信息
        if (this.showDebugCheckbox.checked) {
            console.log('Content parts:', candidate.content.parts);
            console.log('Has thinking content:', !!thinkingContent);
            console.log('Thinking content:', thinkingContent);
            console.log('Main content length:', mainContent.length);
            console.log('Enhanced thinking content:', candidate.enhancedThinkingContent);
            
            if (candidate.thoughtMetadata) {
                console.log('Thought metadata:', candidate.thoughtMetadata);
            }
        }

        // 如果沒有文字內容，顯示錯誤
        if (!mainContent.trim()) {
            this.addErrorMessage('AI 回應為空，可能是因為內容過濾或其他限制');
            return;
        }

        // 使用從 API 回傳的思考內容
        let thinkingProcess = thinkingContent;
        let finalAnswer = mainContent;

        // 處理 grounding metadata（Google 搜尋結果）
        let references = [];
        let processedFinalAnswer = finalAnswer;

        // 檢查 Gemini 的 grounding metadata
        if (candidate.groundingMetadata && this.showReferencesCheckbox.checked) {
            // 調試：輸出 grounding metadata
            if (this.showDebugCheckbox.checked) {
                console.log('Processing grounding metadata:', candidate.groundingMetadata);
                console.log('Grounding chunks available:', !!candidate.groundingMetadata.groundingChunks);
                console.log('Grounding supports available:', !!candidate.groundingMetadata.groundingSupports);
            }
            
            // 處理引用來源
            if (candidate.groundingMetadata.groundingChunks && candidate.groundingMetadata.groundingChunks.length > 0) {
                // 有 grounding chunks，使用標準處理
                references = this.processGroundingChunks(candidate.groundingMetadata.groundingChunks);
                
                // 添加內嵌引用標記到回答文字中
                processedFinalAnswer = this.addInlineCitations(finalAnswer, candidate.groundingMetadata);
                
                if (this.showDebugCheckbox.checked) {
                    console.log('處理後的回答 (有內嵌引用):', processedFinalAnswer);
                    console.log('處理得到的引用數量:', references.length);
                }
            } else if (candidate.groundingMetadata.groundingSupports && candidate.groundingMetadata.groundingSupports.length > 0) {
                // 沒有 chunks 但有 supports，從 supports 中提取引用資訊
                references = this.processGroundingSupports(candidate.groundingMetadata.groundingSupports);
                
                if (this.showDebugCheckbox.checked) {
                    console.log('從 grounding supports 處理得到的引用數量:', references.length);
                }
            } else {
                if (this.showDebugCheckbox.checked) {
                    console.log('沒有可用的 grounding chunks 或 supports，可能搜尋結果有限');
                }
            }
        }

        // 如果沒有引用來源，則使用本地引用提取
        if (references.length === 0 && this.showReferencesCheckbox.checked) {
            if (this.showDebugCheckbox.checked) {
                console.log('🔍 沒有 API 引用，嘗試本地引用提取');
            }
            
            const extractResult = this.extractAndCleanReferences(finalAnswer);
            references = extractResult.references.map((ref, index) => ({
                id: index + 1,
                title: ref,
                url: '#'
            }));
            
            // 只有當文本真的有變化時才使用清理後的文本
            if (extractResult.cleanedText !== finalAnswer && extractResult.cleanedText.trim()) {
                processedFinalAnswer = extractResult.cleanedText;
                
                if (this.showDebugCheckbox.checked) {
                    console.log('📝 使用清理後的文本（移除了內建引用區塊）');
                }
            }
            
            if (this.showDebugCheckbox.checked) {
                console.log('📝 本地引用提取結果:', {
                    原始引用數量: extractResult.references.length,
                    處理後引用數量: references.length,
                    文本是否有變化: extractResult.cleanedText !== finalAnswer,
                    使用清理後文本: processedFinalAnswer !== finalAnswer
                });
            }
        } else if (this.showDebugCheckbox.checked) {
            console.log('📊 引用來源狀態:', {
                引用數量: references.length,
                顯示引用設定: this.showReferencesCheckbox.checked,
                引用來源: references.length > 0 ? 'API grounding metadata' : '無引用'
            });
        }

        // 顯示思考過程（如果有且啟用）
        if (this.showThinkingCheckbox.checked && thinkingProcess) {
            // 判斷推理內容來源，設定適當的標題
            let thinkingTitle = '<i class="fas fa-brain"></i> 思考過程';
            if (candidate.enhancedThinkingContent) {
                // 檢查推理內容來源，根據內容特徵判斷
                if (thinkingProcess.includes('Legal Analysis') || thinkingProcess.length > 2000) {
                    thinkingTitle = '<i class="fas fa-brain"></i> 深度推理分析';
                } else {
                    thinkingTitle = '<i class="fas fa-brain"></i> 搜尋整合推理';
                }
            }
            
            content += `
                <div class="thinking-process">
                    <h4>${thinkingTitle}</h4>
                    <div class="thinking-content">
                        ${this.formatText(thinkingProcess)}
                    </div>
                </div>
            `;
        }

        // 顯示最終回答（包含內嵌引用）
        content += `<div class="message-content">${this.formatText(processedFinalAnswer)}</div>`;

        // 添加引用資料（如果有）
        if (references.length > 0 && this.showReferencesCheckbox.checked) {
            content += `
                <div class="references">
                    <h4><i class="fas fa-link"></i> 引用來源</h4>
                    ${references.map(ref => 
                        `<div class="reference-item" id="footnote-${ref.id}">
                            <span class="reference-number">[${ref.id}]</span>
                            ${ref.url !== '#' ? 
                                `<a href="${ref.url}" target="_blank" class="reference-link">${this.escapeHtml(ref.title)}</a>` :
                                `<span class="reference-text">${this.escapeHtml(ref.title)}</span>`
                            }
                            ${ref.snippet ? `<div class="reference-snippet">${this.escapeHtml(ref.snippet)}</div>` : ''}
                        </div>`
                    ).join('')}
                </div>
            `;
        }

        messageElement.innerHTML = content;
        this.appendMessageToChat(messageElement);
    }

    // 添加內嵌引用標記到回答文字中
    addInlineCitations(text, groundingMetadata) {
        if (!groundingMetadata) {
            if (this.showDebugCheckbox.checked) {
                console.log('addInlineCitations: 沒有 groundingMetadata');
            }
            return text;
        }

        if (!groundingMetadata.groundingSupports && !groundingMetadata.groundingChunks) {
            if (this.showDebugCheckbox.checked) {
                console.log('addInlineCitations: 沒有 groundingSupports 和 groundingChunks');
            }
            return text;
        }

        const supports = groundingMetadata.groundingSupports || [];
        const chunks = groundingMetadata.groundingChunks || [];

        if (this.showDebugCheckbox.checked) {
            console.log('Adding inline citations:', {
                supportsLength: supports.length,
                chunksLength: chunks.length,
                originalTextLength: text.length,
                originalTextPreview: text.substring(0, 200) + '...'
            });
        }

        // 如果沒有 supports 但有 chunks，仍然返回原文本但記錄這個情況
        if (supports.length === 0) {
            if (this.showDebugCheckbox.checked) {
                console.warn('addInlineCitations: 沒有 groundingSupports，無法添加內嵌引用');
            }
            return text;
        }

        // 創建引用映射，將每個片段文字與其引用索引對應
        const citationMap = new Map();
        
        supports.forEach((support, supportIndex) => {
            if (this.showDebugCheckbox.checked) {
                console.log(`處理 support ${supportIndex}:`, support);
            }
            
            if (support.groundingChunkIndices && support.groundingChunkIndices.length > 0 && support.segment && support.segment.text) {
                const segmentText = support.segment.text.trim();
                if (segmentText.length > 10) { // 只處理足夠長的片段，避免誤匹配
                    const citationLinks = support.groundingChunkIndices
                        .filter(i => i >= 0 && i < chunks.length)
                        .map(i => `<sup><a href="#footnote-${i + 1}" class="citation-link" onclick="scrollToFootnote(${i + 1})">[${i + 1}]</a></sup>`)
                        .join('');
                    
                    if (citationLinks) {
                        citationMap.set(segmentText, citationLinks);
                    }
                }
            } else {
                if (this.showDebugCheckbox.checked) {
                    console.warn(`Support ${supportIndex} 缺少必要屬性:`, {
                        hasIndices: !!support.groundingChunkIndices,
                        indicesLength: support.groundingChunkIndices?.length || 0,
                        hasSegment: !!support.segment,
                        hasSegmentText: !!support.segment?.text
                    });
                }
            }
        });

        let modifiedText = text;

        // 將引用映射按文字長度降序排序，優先匹配較長的片段
        const sortedCitations = Array.from(citationMap.entries()).sort((a, b) => b[0].length - a[0].length);

        sortedCitations.forEach(([segmentText, citationLinks]) => {
            // 使用正則表達式進行更準確的匹配，避免部分匹配
            const escapedSegmentText = segmentText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedSegmentText})(?![^<]*>)`, 'g');
            
            // 只替換第一個匹配項，避免重複
            let hasReplaced = false;
            modifiedText = modifiedText.replace(regex, (match) => {
                if (!hasReplaced) {
                    hasReplaced = true;
                    return match + citationLinks;
                }
                return match;
            });
        });

        if (this.showDebugCheckbox.checked) {
            console.log('Citation mapping result:', {
                originalLength: text.length,
                modifiedLength: modifiedText.length,
                citationMapSize: citationMap.size,
                hasChanges: modifiedText !== text
            });
        }

        return modifiedText;
    }

    // 處理並格式化 grounding chunks 為引用來源
    processGroundingChunks(chunks) {
        if (!chunks || !Array.isArray(chunks)) {
            if (this.showDebugCheckbox.checked) {
                console.warn('processGroundingChunks: chunks 無效', { chunks: chunks, isArray: Array.isArray(chunks) });
            }
            return [];
        }

        if (this.showDebugCheckbox.checked) {
            console.log('processGroundingChunks: 處理', chunks.length, '個 chunks');
        }

        const results = chunks.map((chunk, index) => {
            let title = '無標題';
            let url = '#';
            let snippet = '';
            
            if (this.showDebugCheckbox.checked) {
                console.log(`Chunk ${index + 1}:`, chunk);
            }
            
            if (chunk.web) {
                // 處理標題
                if (chunk.web.title && chunk.web.title.trim()) {
                    title = chunk.web.title.trim();
                }
                
                // 處理 URL
                if (chunk.web.uri) {
                    url = chunk.web.uri;
                    if (title === '無標題') {
                        // 嘗試從 URL 提取域名作為標題
                        try {
                            const domain = new URL(url).hostname;
                            title = domain.replace('www.', '');
                        } catch (e) {
                            title = '網頁資源';
                        }
                    }
                }

                // 處理摘要片段
                if (chunk.web.snippet) {
                    snippet = chunk.web.snippet.trim();
                    // 限制摘要長度
                    if (snippet.length > 150) {
                        snippet = snippet.substring(0, 150) + '...';
                    }
                }
            } else {
                if (this.showDebugCheckbox.checked) {
                    console.warn(`Chunk ${index + 1} 沒有 web 屬性:`, Object.keys(chunk));
                }
            }
            
            const result = {
                id: index + 1,
                title: title,
                url: url,
                snippet: snippet
            };
            
            if (this.showDebugCheckbox.checked) {
                console.log(`處理結果 ${index + 1}:`, result);
            }
            
            return result;
        });

        if (this.showDebugCheckbox.checked) {
            console.log('processGroundingChunks 最終結果:', results);
        }

        return results;
    }

    // 處理並格式化 grounding supports 為引用來源（當 chunks 不可用時使用）
    processGroundingSupports(supports) {
        if (!supports || !Array.isArray(supports)) {
            if (this.showDebugCheckbox.checked) {
                console.warn('processGroundingSupports: supports 無效', { supports: supports, isArray: Array.isArray(supports) });
            }
            return [];
        }

        if (this.showDebugCheckbox.checked) {
            console.log('processGroundingSupports: 處理', supports.length, '個 supports');
        }

        const references = [];
        const seenTexts = new Set(); // 避免重複引用

        supports.forEach((support, index) => {
            if (support.segment && support.segment.text) {
                const segmentText = support.segment.text.trim();
                
                // 避免重複和過短的片段
                if (segmentText.length > 20 && !seenTexts.has(segmentText)) {
                    seenTexts.add(segmentText);
                    
                    // 嘗試從片段文字中提取有意義的標題
                    let title = segmentText;
                    
                    // 如果包含URL，嘗試提取
                    const urlMatch = segmentText.match(/https?:\/\/[^\s\]]+/);
                    let url = '#';
                    
                    if (urlMatch) {
                        url = urlMatch[0];
                        // 清理URL，移除可能的結尾字元
                        url = url.replace(/[)\]}>,.]*$/, '');
                        
                        // 從URL提取域名作為標題
                        try {
                            const domain = new URL(url).hostname;
                            title = domain.replace('www.', '');
                        } catch (e) {
                            title = '網頁資源';
                        }
                    }
                    
                    // 限制標題長度
                    if (title.length > 100) {
                        title = title.substring(0, 100) + '...';
                    }
                    
                    const reference = {
                        id: references.length + 1,
                        title: title,
                        url: url,
                        snippet: segmentText.length > 150 ? segmentText.substring(0, 150) + '...' : segmentText
                    };
                    
                    references.push(reference);
                    
                    if (this.showDebugCheckbox.checked) {
                        console.log(`Support ${index + 1} 處理結果:`, reference);
                    }
                }
            }
        });

        if (this.showDebugCheckbox.checked) {
            console.log('processGroundingSupports 最終結果:', references);
        }

        return references.slice(0, 10); // 最多返回10個引用
    }

    addErrorMessage(errorMsg) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message ai-message error-message';
        
        // 根據錯誤類型提供不同的圖標和建議
        let icon = 'fas fa-exclamation-triangle';
        let suggestions = '';
        
        if (errorMsg.includes('截斷') || errorMsg.includes('MAX_TOKENS')) {
            icon = 'fas fa-cut';
            suggestions = `
                <div class="error-suggestions">
                    <h5>💡 建議解決方案：</h5>
                    <ul>
                        <li>關閉「顯示思考流程」選項</li>
                        <li>將問題分解成更簡短的部分</li>
                        <li>使用更具體的問題</li>
                    </ul>
                </div>
            `;
        } else if (errorMsg.includes('空')) {
            icon = 'fas fa-question-circle';
            suggestions = `
                <div class="error-suggestions">
                    <h5>💡 可能的原因：</h5>
                    <ul>
                        <li>內容可能被安全過濾器攔截</li>
                        <li>API 暫時無法處理該請求</li>
                        <li>請嘗試重新表述您的問題</li>
                    </ul>
                </div>
            `;
        }
        
        messageElement.innerHTML = `
            <div class="message-header">
                <i class="${icon}" style="color: #f44336;"></i>
                系統提示
            </div>
            <div class="message-content" style="color: #f44336;">
                ${this.escapeHtml(errorMsg)}
                ${suggestions}
            </div>
        `;
        
        this.appendMessageToChat(messageElement);
    }

    // 從文本中提取引用來源並清理文本
    extractAndCleanReferences(text) {
        // 防呆：檢查 text 參數是否有效
        if (!text || typeof text !== 'string') {
            console.warn('extractAndCleanReferences: 輸入文本無效:', text);
            return { cleanedText: '', references: [] };
        }
        
        let cleanedText = text;
        const references = [];
        
        // 移除明確的參考資料區塊（包括 API 回應中的內建引用）
        const referencesSectionPatterns = [
            /\n\n引用來源：?\s*\n+[\s\S]+$/,                   // 匹配 "引用來源：" 格式
            /\n---\s*\*?\*?參考資料：?\*?\*?\s*\n+[\s\S]+$/,  // API 內建的參考來源格式（有換行）
            /---\s*\*?\*?參考資料：?\*?\*?\s*\n+[\s\S]+$/,   // API 內建的參考來源格式（無換行）
            /---\s*\n+#### 參考資料：?\s*\n+([\s\S]+)$/,
            /---\s*\n+### 參考資料：?\s*\n+([\s\S]+)$/,
            /---\s*\n+## 參考資料：?\s*\n+([\s\S]+)$/,
            /\n\n#### 參考資料：?\s*\n+([\s\S]+)$/,
            /\n\n### 參考資料：?\s*\n+([\s\S]+)$/,
            /\n\n## 參考資料：?\s*\n+([\s\S]+)$/,
            /\n\n參考來源：?\s*\n+([\s\S]+)$/,
            /\n\n資料來源：?\s*\n+([\s\S]+)$/,
            /\n\n來源：?\s*\n+([\s\S]+)$/
        ];

        for (const pattern of referencesSectionPatterns) {
            const match = text.match(pattern);
            if (match) {
                cleanedText = text.replace(match[0], '').trim();
                
                // 只有當是舊式的參考資料格式時才提取引用項目
                if (match[1] && pattern.toString().includes('參考資料')) {
                    const referencesSection = match[1];
                    const refItems = referencesSection.match(/\*\s+[^*\n]+/g);
                    if (refItems) {
                        refItems.forEach(item => {
                            const cleaned = item.replace(/^\*\s+/, '').trim();
                            if (cleaned.length > 5) {
                                references.push(cleaned);
                            }
                        });
                    }
                }
                break; // 找到一個就停止
            }
        }
        
        // 如果沒有找到明確的參考資料區塊，提取隱含的引用
        if (references.length === 0) {
            // 提取法條引用
            const lawArticles = cleanedText.match(/《[^》]+》第?\s*\d+\s*條/g);
            if (lawArticles) {
                lawArticles.forEach(article => {
                    if (!references.includes(article)) {
                        references.push(article);
                    }
                });
            }
            
            // 提取法律名稱
            const lawNames = cleanedText.match(/《[^》]+法》/g);
            if (lawNames) {
                lawNames.forEach(law => {
                    if (!references.includes(law)) {
                        references.push(law);
                    }
                });
            }
            
            // 提取網站引用
            const urls = cleanedText.match(/https?:\/\/[^\s\)]+/g);
            if (urls) {
                urls.forEach(url => {
                    if (!references.includes(url)) {
                        references.push(url);
                    }
                });
            }
        }
        
        return {
            cleanedText: cleanedText,
            references: references.slice(0, 10) // 最多顯示 10 個引用
        };
    }

    addDebugMessage(response) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message ai-message';
        messageElement.innerHTML = `
            <div class="message-header">
                <i class="fas fa-bug" style="color: #ff9800;"></i>
                調試資訊
            </div>
            <div class="message-content" style="font-family: monospace; font-size: 12px; background: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto;">
                <pre>${this.escapeHtml(JSON.stringify(response, null, 2))}</pre>
            </div>
        `;
        
        this.appendMessageToChat(messageElement);
    }

    appendMessageToChat(messageElement) {
        // 移除歡迎訊息
        const welcomeMessage = this.chatContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        this.chatContainer.appendChild(messageElement);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    formatText(text) {
        // 檢查文字是否已經包含 HTML 標記（引用連結）
        if (text.includes('<sup><a href="#footnote-')) {
            // 如果已經包含引用標記，只進行基本的文字格式化，但保留 HTML
            return text
                .replace(/\n/g, '<br>')
                .replace(/\*\*((?:[^*]|\*(?!\*))*)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '<em>$1</em>');
        } else {
            // 標準格式化：先轉義 HTML，然後格式化
            return this.escapeHtml(text)
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showLoading() {
        this.loadingOverlay.classList.add('show');
    }

    hideLoading() {
        this.loadingOverlay.classList.remove('show');
    }

    showNotification(message, type = 'info') {
        // 創建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icon = type === 'success' ? 'fas fa-check-circle' : 
                    type === 'error' ? 'fas fa-exclamation-circle' : 
                    'fas fa-info-circle';
        
        notification.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
        `;
        
        // 添加到頁面
        document.body.appendChild(notification);
        
        // 顯示動畫
        setTimeout(() => notification.classList.add('show'), 100);
        
        // 自動隱藏
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }

    saveSettings() {
        const settings = {
            geminiApiKey: this.geminiApiKey,
            showReferences: this.showReferencesCheckbox.checked,
            showThinking: this.showThinkingCheckbox.checked,
            showDebug: this.showDebugCheckbox.checked,
            settingsPanelExpanded: this.settingsPanel.classList.contains('active')
        };
        localStorage.setItem('chatAppSettings', JSON.stringify(settings));
    }

    loadSavedSettings() {
        try {
            const savedSettings = localStorage.getItem('chatAppSettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                
                if (settings.geminiApiKey) {
                    this.geminiApiKeyInput.value = settings.geminiApiKey;
                    this.geminiApiKey = settings.geminiApiKey;
                }
                
                if (typeof settings.showReferences === 'boolean') {
                    this.showReferencesCheckbox.checked = settings.showReferences;
                }
                
                if (typeof settings.showThinking === 'boolean') {
                    this.showThinkingCheckbox.checked = settings.showThinking;
                }
                
                if (typeof settings.showDebug === 'boolean') {
                    this.showDebugCheckbox.checked = settings.showDebug;
                }
                
                // 載入設定面板展開狀態
                if (typeof settings.settingsPanelExpanded === 'boolean' && settings.settingsPanelExpanded) {
                    this.settingsPanel.classList.add('active');
                    this.settingsToggle.classList.add('active');
                }
                
                this.updateSendButtonState();
                this.updateCharacterCount();
            }
        } catch (error) {
            console.warn('無法載入儲存的設定:', error);
        }
    }

    async callGeminiFallbackAPI(question) {
        const requestBody = {
            contents: [{
                parts: [{
                    text: question
                }]
            }],
            tools: [{
                googleSearch: {}
            }],
            systemInstruction: {
                parts: [{
                    text: "請全部用繁體中文回答，並以台灣的資料、法規、文化為準。請結合網路搜尋資料與深度邏輯推理：1. 基於搜尋到的最新資料提供準確答案，並確實引用相關來源2. 同時進行深度分析和邏輯推理，展示您的思考過程、分析步驟和推理邏輯3. 將網路資料與第一性原理結合，逐步建構完整論證 4. 既要有實證依據（網路資料），也要有理論基礎（邏輯推理）"
                }]
            },
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 65536,
                responseMimeType: "text/plain",
                // 始終啟用思考流程，無論 UI 設定如何
                thinking_config: {
                    thinking_budget: 24576,
                    include_thoughts: true
                }
            }
        };

        // 調試：輸出請求體
        if (this.showDebugCheckbox.checked) {
            console.log('Fallback request body:', JSON.stringify(requestBody, null, 2));
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Fallback API Error:', error);
            throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Fallback API Response:', data);
        return data;
    }

    async callDualGeminiAPI(question) {
        // 同時發送兩個請求：一個有 Google Search，一個沒有
        const [searchResponse, reasoningResponse] = await Promise.allSettled([
            this.callGeminiAPIWithSearch(question),    // 有搜尋：提供主要內容和引用
            this.callGeminiAPIWithoutSearch(question)  // 無搜尋：提供推理流程
        ]);

        // 調試：輸出雙重請求結果
        if (this.showDebugCheckbox.checked) {
            console.log('=== 雙重 Gemini API 調用結果 ===');
            console.log('搜尋請求狀態:', searchResponse.status);
            console.log('推理請求狀態:', reasoningResponse.status);
            
            if (searchResponse.status === 'fulfilled') {
                console.log('🔍 搜尋回應 (應該有 groundingMetadata):');
                console.log('  - 是否有 groundingMetadata:', !!searchResponse.value.candidates?.[0]?.groundingMetadata);
                console.log('  - Response ID:', searchResponse.value.responseId);
                
                // 詳細分析搜尋回應的思考內容
                if (searchResponse.value.usageMetadata) {
                    console.log('🔍 搜尋模式 Usage Metadata:', searchResponse.value.usageMetadata);
                }
                
                if (searchResponse.value.candidates && searchResponse.value.candidates[0]) {
                    const candidate = searchResponse.value.candidates[0];
                    let thoughtParts = 0;
                    let thoughtTextLength = 0;
                    let normalParts = 0;
                    let normalTextLength = 0;
                    
                    if (candidate.content && candidate.content.parts) {
                        candidate.content.parts.forEach((part, index) => {
                            if (part.thought === true) {
                                thoughtParts++;
                                thoughtTextLength += part.text ? part.text.length : 0;
                                console.log(`🧠 搜尋思考片段 ${index + 1}:`, part.text ? part.text.substring(0, 100) + '...' : 'empty');
                            } else {
                                normalParts++;
                                normalTextLength += part.text ? part.text.length : 0;
                            }
                        });
                    }
                    
                    console.log(`🔍 搜尋模式分析:`);
                    console.log(`  - 思考片段數量: ${thoughtParts}`);
                    console.log(`  - 思考內容長度: ${thoughtTextLength} 字元`);
                    console.log(`  - 普通片段數量: ${normalParts}`);
                    console.log(`  - 普通內容長度: ${normalTextLength} 字元`);
                    console.log(`  - 是否有 grounding: ${!!candidate.groundingMetadata}`);
                }
            } else {
                console.log('搜尋請求失敗:', searchResponse.reason);
            }
            
            if (reasoningResponse.status === 'fulfilled') {
                console.log('🧠 推理回應 (應該無 groundingMetadata):');
                console.log('  - 是否有 groundingMetadata:', !!reasoningResponse.value.candidates?.[0]?.groundingMetadata);
                console.log('  - Response ID:', reasoningResponse.value.responseId);
                
                // 詳細分析推理回應的思考內容
                if (reasoningResponse.value.usageMetadata) {
                    console.log('🧠 推理模式 Usage Metadata:', reasoningResponse.value.usageMetadata);
                }
                
                if (reasoningResponse.value.candidates && reasoningResponse.value.candidates[0]) {
                    const candidate = reasoningResponse.value.candidates[0];
                    let thoughtParts = 0;
                    let thoughtTextLength = 0;
                    let normalParts = 0;
                    let normalTextLength = 0;
                    
                    if (candidate.content && candidate.content.parts) {
                        candidate.content.parts.forEach((part, index) => {
                            if (part.thought === true) {
                                thoughtParts++;
                                thoughtTextLength += part.text ? part.text.length : 0;
                                console.log(`🧠 推理思考片段 ${index + 1}:`, part.text ? part.text.substring(0, 100) + '...' : 'empty');
                            } else {
                                normalParts++;
                                normalTextLength += part.text ? part.text.length : 0;
                            }
                        });
                    }
                    
                    console.log(`🧠 推理模式分析:`);
                    console.log(`  - 思考片段數量: ${thoughtParts}`);
                    console.log(`  - 思考內容長度: ${thoughtTextLength} 字元`);
                    console.log(`  - 普通片段數量: ${normalParts}`);
                    console.log(`  - 普通內容長度: ${normalTextLength} 字元`);
                }
            } else {
                console.log('推理請求失敗:', reasoningResponse.reason);
            }
        }

        // 處理請求結果 - 根據引用來源設定決定主文來源
        let finalResponse = null;
        let fallbackError = null;

        if (searchResponse.status === 'fulfilled' && reasoningResponse.status === 'fulfilled') {
            // 兩個請求都成功
            if (!this.showReferencesCheckbox.checked) {
                // 關閉引用來源：使用推理模式的主文 + 搜尋模式的引用資料結構（但不顯示）
                finalResponse = reasoningResponse.value;
                
                // 將搜尋模式的 grounding metadata 附加到推理回應上（雖然不會顯示，但保持結構完整）
                if (searchResponse.value.candidates?.[0]?.groundingMetadata) {
                    if (!finalResponse.candidates) finalResponse.candidates = [];
                    if (!finalResponse.candidates[0]) finalResponse.candidates[0] = {};
                    finalResponse.candidates[0].groundingMetadata = searchResponse.value.candidates[0].groundingMetadata;
                }
                
                if (this.showDebugCheckbox.checked) {
                    console.log('🚫 關閉引用來源：使用推理模式主文');
                    console.log('📝 推理回應 Response ID:', reasoningResponse.value.responseId);
                    console.log('📝 已附加搜尋模式的 grounding metadata（不顯示）');
                }
            } else {
                // 開啟引用來源：使用搜尋模式作為基礎（包含引用來源和搜尋結果）
                finalResponse = searchResponse.value;
                
                if (this.showDebugCheckbox.checked) {
                    console.log('📋 開啟引用來源：使用搜尋模式主文');
                    console.log('📝 搜尋回應 Response ID:', searchResponse.value.responseId);
                    console.log('📝 Grounding chunks 數量:', searchResponse.value.candidates[0].groundingMetadata?.groundingChunks?.length || 0);
                    console.log('📝 Grounding supports 數量:', searchResponse.value.candidates[0].groundingMetadata?.groundingSupports?.length || 0);
                }
            }
            
            // 清除可能存在的 enhancedThinkingContent，重新決定推理內容
            if (finalResponse.candidates && finalResponse.candidates[0]) {
                delete finalResponse.candidates[0].enhancedThinkingContent;
            }
            
            // 提取兩個回應的思考內容進行比較
            let searchThinkingText = '';
            let searchThoughtsTokenCount = 0;
            let reasoningThinkingText = '';
            let reasoningThoughtsTokenCount = 0;
            
            // 提取搜尋回應的思考內容
            if (searchResponse.value.candidates?.[0]?.content?.parts) {
                searchResponse.value.candidates[0].content.parts.forEach(part => {
                    if (part.text && part.thought === true) {
                        searchThinkingText += part.text;
                    }
                });
                if (searchResponse.value.usageMetadata?.thoughtsTokenCount) {
                    searchThoughtsTokenCount = searchResponse.value.usageMetadata.thoughtsTokenCount;
                }
            }
            
            // 提取推理回應的思考內容
            if (reasoningResponse.value.candidates?.[0]?.content?.parts) {
                reasoningResponse.value.candidates[0].content.parts.forEach(part => {
                    if (part.text && part.thought === true) {
                        reasoningThinkingText += part.text;
                    }
                });
                if (reasoningResponse.value.usageMetadata?.thoughtsTokenCount) {
                    reasoningThoughtsTokenCount = reasoningResponse.value.usageMetadata.thoughtsTokenCount;
                }
            }
            
            // 選擇思考 token 數量更多的作為思考內容
            if (this.showDebugCheckbox.checked) {
                console.log('🔍 Token 比較分析:');
                console.log(`  - 搜尋模式思考 Token: ${searchThoughtsTokenCount}`);
                console.log(`  - 推理模式思考 Token: ${reasoningThoughtsTokenCount}`);
                console.log(`  - 搜尋思考內容長度: ${searchThinkingText.length} 字元`);
                console.log(`  - 推理思考內容長度: ${reasoningThinkingText.length} 字元`);
            }
            
            if (reasoningThoughtsTokenCount > searchThoughtsTokenCount && reasoningThinkingText.trim()) {
                finalResponse.candidates[0].enhancedThinkingContent = reasoningThinkingText;
                if (this.showDebugCheckbox.checked) {
                    console.log('✅ 選擇推理模式的思考內容（Token 更多）');
                }
            } else if (searchThoughtsTokenCount >= reasoningThoughtsTokenCount && searchThinkingText.trim()) {
                finalResponse.candidates[0].enhancedThinkingContent = searchThinkingText;
                if (this.showDebugCheckbox.checked) {
                    console.log('✅ 選擇搜尋模式的思考內容（Token 更多或相等）');
                }
            } else if (reasoningThinkingText.trim()) {
                finalResponse.candidates[0].enhancedThinkingContent = reasoningThinkingText;
                if (this.showDebugCheckbox.checked) {
                    console.log('✅ 選擇推理模式的思考內容（唯一可用）');
                }
            } else if (searchThinkingText.trim()) {
                finalResponse.candidates[0].enhancedThinkingContent = searchThinkingText;
                if (this.showDebugCheckbox.checked) {
                    console.log('✅ 選擇搜尋模式的思考內容（唯一可用）');
                }
            }
            
        } else if (searchResponse.status === 'fulfilled') {
            // 只有搜尋請求成功
            finalResponse = searchResponse.value;
            fallbackError = reasoningResponse.reason;
            
            if (this.showDebugCheckbox.checked) {
                console.warn('⚠️ 推理請求失敗，僅使用搜尋回應');
            }
        } else if (reasoningResponse.status === 'fulfilled') {
            // 只有推理請求成功
            finalResponse = reasoningResponse.value;
            fallbackError = searchResponse.reason;
            
            if (this.showDebugCheckbox.checked) {
                console.warn('⚠️ 搜尋請求失敗，僅使用推理回應');
            }
        } else {
            // 兩個請求都失敗，拋出錯誤
            throw new Error(`雙重請求都失敗了。搜尋錯誤: ${searchResponse.reason?.message || '未知錯誤'}，推理錯誤: ${reasoningResponse.reason?.message || '未知錯誤'}`);
        }

        // 如果搜尋請求失敗但推理成功，顯示警告
        if (fallbackError && this.showDebugCheckbox.checked) {
            console.warn('Google 搜尋請求失敗，僅使用推理回應:', fallbackError);
        }

        return finalResponse;
    }

    async callGeminiAPIWithSearch(question) {
        const requestBody = {
            contents: [{
                parts: [{
                    text: question
                }]
            }],
            tools: [{
                googleSearch: {}
            }],
            systemInstruction: {
                parts: [{
                    text: "請全部用繁體中文回答，並以台灣的資料、法規、文化為準。\n\n請結合網路搜尋資料與深度邏輯推理：\n1. 基於搜尋到的最新資料提供準確答案，並確實引用相關來源\n2. 同時進行深度分析和邏輯推理，展示您的思考過程、分析步驟和推理邏輯\n3. 將網路資料與第一性原理結合，逐步建構完整論證\n4. 既要有實證依據（網路資料），也要有理論基礎（邏輯推理）"
                }]
            },
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 65536,
                responseMimeType: "text/plain",
                thinking_config: {
                    thinking_budget: 24576,  // 優化的思考預算，支援深度分析與資料整合
                    include_thoughts: true
                }
            }
        };

        // 調試：輸出請求體
        if (this.showDebugCheckbox.checked) {
            console.log('搜尋模式請求體:', JSON.stringify(requestBody, null, 2));
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('搜尋模式 API 錯誤:', error);
            throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (this.showDebugCheckbox.checked) {
            console.log('搜尋模式 API 回應:', data);
            if (data.usageMetadata) {
                console.log('搜尋模式 Token 使用:', data.usageMetadata);
            }
        }
        
        return data;
    }

    async callGeminiAPIWithoutSearch(question) {
        const requestBody = {
            contents: [{
                parts: [{
                    text: question
                }]
            }],
            systemInstruction: {
                parts: [{
                    text: "請全部用繁體中文回答，並以台灣的資料、法規、文化為準。\n\n請專注於深度邏輯推理與分析：\n1. 深入展示思考過程、分析步驟和推理邏輯\n2. 運用第一性原理進行分析，從基本原理出發逐步建構論證\n3. 提供多角度的分析，考慮不同觀點和可能性\n4. 展現完整的推理鏈條，說明每個推論的依據\n5. 在沒有最新資料的情況下，基於已知知識提供最佳的推理分析"
                }]
            },
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 65536,
                responseMimeType: "text/plain",
                thinking_config: {
                    thinking_budget: 24576,  // 更高的思考預算，專注於深度推理
                    include_thoughts: true
                }
            }
        };

        // 調試：輸出請求體
        if (this.showDebugCheckbox.checked) {
            console.log('推理模式請求體:', JSON.stringify(requestBody, null, 2));
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('推理模式 API 錯誤:', error);
            throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (this.showDebugCheckbox.checked) {
            console.log('推理模式 API 回應:', data);
            if (data.usageMetadata) {
                console.log('推理模式 Token 使用:', data.usageMetadata);
            }
        }
        
        return data;
    }
}

// 全局函數：滾動到引用腳註
function scrollToFootnote(id) {
    const footnote = document.getElementById(`footnote-${id}`);
    if (footnote) {
        footnote.scrollIntoView({ behavior: 'smooth', block: 'center' });
        footnote.style.backgroundColor = '#fffacd';
        setTimeout(() => {
            footnote.style.backgroundColor = '';
        }, 2000);
    }
}

// 初始化應用程式
document.addEventListener('DOMContentLoaded', function() {
    new ChatApp();
});
