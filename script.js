class ChatApp {
    constructor() {
        // 生成會話 ID
        this.sessionId = this.generateSessionId();
        
        // 跟蹤是否已顯示過識別碼
        this.hasShownSessionId = false;
        
        // 檢查是否需要顯示歡迎頁面
        this.showWelcomeModal();
        
        // 檢查是否使用 Worker 模式
        // 可以通過 URL 參數、環境變數或設定來決定
        this.workerUrl = this.detectWorkerUrl();
        
        // 如果沒有 Worker URL，使用直接 API 模式
        this.geminiApiKey = '';
        
        // 調試信息
        console.log('=== ChatApp 初始化 ===');
        console.log('Worker URL:', this.workerUrl || '未設定（使用直接 API 模式）');
        console.log('當前頁面位置:', window.location.href);
        console.log('會話 ID:', this.sessionId);
        
        this.initializeElements();
        this.bindEvents();
        this.loadSavedSettings();
        this.updateCharacterCount();
    }

    generateSessionId() {
        // 生成時間戳和隨機字符串組合的會話 ID
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        return `session-${timestamp}-${randomStr}`;
    }

    generateSessionCode(data) {
        // 第一位：判斷是否來自例題
        let digit1 = '0'; // 預設不是例題
        const currentQuestion = data.originalQuestion || '';
        
        if (currentQuestion && this.selectedExampleQuestion) {
            // 檢查當前問題是否與選擇的範例問題完全相同
            if (currentQuestion === this.selectedExampleQuestion) {
                const exampleQuestions = [
                    "如果我的車被別人騎走，但加滿油還回來了，我可以告他嗎？", // 例題1
                    "鄰居的狗經常在夜間吠叫影響睡眠，我可以採取什麼法律行動？", // 例題2
                    "我在網路上購買商品但收到假貨，賣家拒絕退款怎麼辦？" // 例題3
                ];
                
                for (let i = 0; i < exampleQuestions.length; i++) {
                    if (currentQuestion === exampleQuestions[i]) {
                        digit1 = (i + 1).toString();
                        break;
                    }
                }
            }
            // 如果問題已被修改（不等於原始範例問題），digit1保持為'0'
        }

        // 第二位：0到4隨機
        const digit2 = Math.floor(Math.random() * 5).toString();

        // 第三位：判斷是否開啟思考流程
        const digit3 = (this.showThinkingCheckbox.checked && data.thinking) ? '1' : '0';

        // 第四位：5到9隨機
        const digit4 = (Math.floor(Math.random() * 5) + 5).toString();

        // 第五、六位：引用數量（00-99）
        const referenceCount = (data.references && data.references.length) ? data.references.length : 0;
        const digits56 = referenceCount.toString().padStart(2, '0');

        return digit1 + digit2 + digit3 + digit4 + digits56;
    }

    showWelcomeModal() {
        // 檢查是否已經顯示過歡迎頁面（可以使用 sessionStorage）
        const hasSeenWelcome = sessionStorage.getItem('hasSeenWelcome');
        
        if (!hasSeenWelcome) {
            const modal = document.getElementById('researchWelcomeModal');
            if (modal) {
                // 顯示模態框
                modal.style.display = 'flex';
                
                // 綁定開始按鈕事件
                const startButton = document.getElementById('startSystemBtn');
                if (startButton) {
                    // 開始十秒倒數計時
                    this.startCountdown(startButton);
                }
                
                // 點擊背景關閉模態框
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.hideWelcomeModal();
                    }
                });
            }
        }
    }

    hideWelcomeModal() {
        const modal = document.getElementById('researchWelcomeModal');
        if (modal) {
            modal.classList.add('hidden');
            // 標記已經看過歡迎頁面
            sessionStorage.setItem('hasSeenWelcome', 'true');
            
            // 延遲移除以配合動畫
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
    }

    startCountdown(button) {
        let timeLeft = 10;
        
        console.log('⏰ 開始十秒倒數計時');
        
        // 初始設定按鈕狀態 - 移除 inline styles 讓 CSS 生效
        button.disabled = true;
        button.style.cursor = '';
        button.style.opacity = '';
        
        // 立即顯示初始時間
        const updateDisplay = () => {
            const btnText = document.getElementById('startBtnText');
            if (btnText) {
                btnText.textContent = `請先閱讀說明 (${timeLeft}秒)`;
            }
        };
        
        // 立即更新顯示
        updateDisplay();
        
        const countdown = setInterval(() => {
            timeLeft--;
            
            if (timeLeft > 0) {
                updateDisplay();
            }
            
            if (timeLeft <= 0) {
                clearInterval(countdown);
                
                // 啟用按鈕 - 移除 inline styles
                button.disabled = false;
                button.style.cursor = '';
                button.style.opacity = '';
                button.innerHTML = '<i class="fas fa-play"></i><span>開始使用系統</span>';
                
                // 添加事件監聽器
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🖱️ 開始按鈕被點擊');
                    this.hideWelcomeModal();
                });
                
                console.log('✅ 倒數計時完成，按鈕已啟用');
            }
        }, 1000);
    }

    copySessionId() {
        const sessionId = this.sessionId;
        const copyButton = document.getElementById('copySessionId');
        
        // 使用 Clipboard API 複製文字
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(sessionId).then(() => {
                this.showCopyFeedback(copyButton);
            }).catch(err => {
                console.error('複製失敗:', err);
                this.fallbackCopyText(sessionId, copyButton);
            });
        } else {
            // 備用複製方法
            this.fallbackCopyText(sessionId, copyButton);
        }
    }

    copySessionIdInChat(button) {
        const sessionId = this.sessionId;
        
        // 使用 Clipboard API 複製文字
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(sessionId).then(() => {
                this.showCopyFeedback(button);
            }).catch(err => {
                console.error('複製失敗:', err);
                this.fallbackCopyText(sessionId, button);
            });
        } else {
            // 備用複製方法
            this.fallbackCopyText(sessionId, button);
        }
    }

    copySessionCode(code, buttonElement) {
        // 使用 Clipboard API 複製識別碼
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(code).then(() => {
                this.showCodeCopyFeedback(buttonElement);
            }).catch(err => {
                console.error('複製失敗:', err);
                this.fallbackCopyText(code);
            });
        } else {
            // 備用複製方法
            this.fallbackCopyText(code);
        }
    }

    fallbackCopyText(text, button) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showCopyFeedback(button);
        } catch (err) {
            console.error('備用複製也失敗:', err);
        } finally {
            document.body.removeChild(textArea);
        }
    }

    showCopyFeedback(button) {
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i>';
        button.style.background = '#4caf50';
        
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.style.background = '';
        }, 1500);
    }

    showCodeCopyFeedback(buttonElement) {
        // 顯示識別碼複製成功的反饋
        const button = buttonElement || document.querySelector('.copy-session-btn');
        if (button) {
            const iconElement = button.querySelector('i');
            
            // 保存原始類別
            const originalIconClass = iconElement.className;
            
            // 更改為已複製狀態
            iconElement.className = 'fas fa-check';
            button.style.background = '#4caf50';
            
            setTimeout(() => {
                // 恢復原始狀態
                iconElement.className = originalIconClass;
                button.style.background = '';
            }, 2000);
        }
        
        console.log('✅ 識別碼已複製到剪貼板');
    }

    detectWorkerUrl() {
        // 檢查 URL 參數
        const urlParams = new URLSearchParams(window.location.search);
        const workerParam = urlParams.get('worker');
        if (workerParam) {
            console.log('🔧 從 URL 參數檢測到 Worker URL:', workerParam);
            return workerParam;
        }

        // 檢查是否在生產環境（例如 Cloudflare Pages）
        if (window.location.hostname.includes('pages.dev') || 
            window.location.hostname.includes('workers.dev')) {
            // 假設 Worker 在同一個域名下的 /api 路徑
            const workerUrl = window.location.origin + '/api';
            console.log('🔧 檢測到 Cloudflare 環境，使用 Worker URL:', workerUrl);
            return workerUrl;
        }

        // 檢查本地存儲的設定
        const savedWorkerUrl = localStorage.getItem('workerUrl');
        if (savedWorkerUrl) {
            console.log('🔧 從本地存儲檢測到 Worker URL:', savedWorkerUrl);
            return savedWorkerUrl;
        }

        // 默認不使用 Worker
        return null;
    }

    initializeElements() {
        // API Key elements
        this.geminiApiKeyInput = document.getElementById('geminiApiKey');
        this.toggleGeminiApiKeyBtn = document.getElementById('toggleGeminiApiKey');
        
        // Checkbox elements
        this.showReferencesCheckbox = document.getElementById('showReferences');
        this.showThinkingCheckbox = document.getElementById('showThinking');
        this.showDebugCheckbox = document.getElementById('showDebug');
        this.enableSearchCheckbox = document.getElementById('enableSearch');
        
        // Main elements
        this.chatContainer = document.getElementById('chatContainer');
        this.questionInput = document.getElementById('questionInput');
        this.sendButton = document.getElementById('sendButton');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.charCountElement = document.getElementById('charCount');
        
        // Settings panel elements
        this.settingsToggle = document.getElementById('settingsToggle');
        this.settingsPanel = document.getElementById('settingsPanel');
        
        // Model description
        this.modelDescription = document.getElementById('modelDescription');
        
        // 追蹤範例問題選擇
        this.selectedExampleQuestion = null;
        
        // Initialize API key
        this.geminiApiKey = '';
    }

    bindEvents() {
        // Settings panel toggle
        this.settingsToggle.addEventListener('click', () => {
            this.toggleSettingsPanel();
        });

        // API Key 相關事件
        if (this.geminiApiKeyInput) {
            this.geminiApiKeyInput.addEventListener('input', () => {
                this.geminiApiKey = this.geminiApiKeyInput.value.trim();
                this.updateSendButtonState();
                this.saveSettings();
            });
        }

        if (this.toggleGeminiApiKeyBtn) {
            this.toggleGeminiApiKeyBtn.addEventListener('click', () => {
                this.toggleApiKeyVisibility(this.geminiApiKeyInput, this.toggleGeminiApiKeyBtn);
            });
        }

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

        if (this.enableSearchCheckbox) {
            this.enableSearchCheckbox.addEventListener('change', () => {
                this.saveSettings();
            });
        }

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
                this.selectedExampleQuestion = question; // 記錄選擇的範例問題
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
        const isActive = this.settingsPanel.classList.contains('active');
        
        if (isActive) {
            this.hideSettingsPanel();
        } else {
            this.showSettingsPanel();
        }
    }

    showSettingsPanel() {
        this.settingsPanel.classList.add('active');
        this.settingsToggle.classList.add('active');
    }

    hideSettingsPanel() {
        this.settingsPanel.classList.remove('active');
        this.settingsToggle.classList.remove('active');
    }

    toggleApiKeyVisibility(input, button) {
        if (!input || !button) return;
        
        const icon = button.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    updateSendButtonState() {
        // 檢查是否有 API key（直接 API 模式）
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

    canSendMessage() {
        const hasApiKey = this.geminiApiKey.length > 0;
        const hasQuestion = this.questionInput.value.trim().length > 0;
        return hasApiKey && hasQuestion;
    }

    async sendMessage() {
        if (!this.canSendMessage()) return;

        const question = this.questionInput.value.trim();
        
        // 顯示載入中
        this.showLoading();
        
        // 添加用戶消息
        this.addUserMessage(question);
        
        // 清空輸入框
        this.questionInput.value = '';
        this.updateCharacterCount();
        this.updateSendButtonState();

        try {
            let response;
            
            // 檢查是否使用 Worker 模式（如果有 workerUrl 或環境變數指示）
            if (this.workerUrl) {
                // Worker 模式：發送請求到 Worker
                response = await this.callWorkerAPI(question);
                
                // 如果是 Worker 回應的雙重模式，需要特別處理
                if (response.isDualMode) {
                    response = this.processWorkerDualResponse(response);
                }
            } else {
                // 直接使用本地 Gemini API - 實現雙重調用
                response = await this.callDualGeminiAPI(question);
            }

            // 處理並顯示回應
            this.processAndDisplayResponse(response, question);
            
        } catch (error) {
            this.hideLoading();
            console.error('API 調用錯誤:', error);
            this.addErrorMessage('發生錯誤: ' + error.message);
        }
    }

    async callDualGeminiAPI(question) {
        // 決定是否進行雙重調用
        const enableSearch = this.enableSearchCheckbox ? this.enableSearchCheckbox.checked : true;
        
        if (enableSearch) {
            // 同時發送兩個請求：一個有 Google Search，一個沒有
            const [searchResponse, reasoningResponse] = await Promise.allSettled([
                this.callGeminiAPIWithSearch(question),    // 有搜尋：提供主要內容和引用
                this.callGeminiAPIWithoutSearch(question)  // 無搜尋：提供推理流程
            ]);

            // 調試：輸出雙重請求結果
            if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                console.log('=== 雙重 Gemini API 調用結果 ===');
                console.log('搜尋請求狀態:', searchResponse.status);
                console.log('推理請求狀態:', reasoningResponse.status);
                
                if (searchResponse.status === 'fulfilled') {
                    console.log('🔍 搜尋回應 (應該有 groundingMetadata):');
                    console.log('  - 是否有 groundingMetadata:', !!searchResponse.value.candidates?.[0]?.groundingMetadata);
                    console.log('  - Response ID:', searchResponse.value.responseId);
                }
                
                if (reasoningResponse.status === 'fulfilled') {
                    console.log('🧠 推理回應 (應該無 groundingMetadata):');
                    console.log('  - 是否有 groundingMetadata:', !!reasoningResponse.value.candidates?.[0]?.groundingMetadata);
                    console.log('  - Response ID:', reasoningResponse.value.responseId);
                }
            }

            // 處理請求結果 - 根據引用來源設定決定主文來源
            let finalResponse = null;

            if (searchResponse.status === 'fulfilled' && reasoningResponse.status === 'fulfilled') {
                // 兩個請求都成功
                if (!this.showReferencesCheckbox.checked) {
                    // 關閉引用來源：使用推理模式的主文 + 搜尋模式的引用資料結構（但不顯示）
                    finalResponse = reasoningResponse.value;
                    
                    // 將搜尋模式的 grounding metadata 附加到推理回應上（雖然不會顯示，但保持結構完整）
                    if (searchResponse.value.candidates?.[0]?.groundingMetadata && finalResponse.candidates?.[0]) {
                        finalResponse.candidates[0].groundingMetadata = searchResponse.value.candidates[0].groundingMetadata;
                    }
                    
                    if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                        console.log('✅ 關閉引用來源：使用推理模式主文 + 搜尋模式引用結構');
                    }
                } else {
                    // 開啟引用來源：使用搜尋模式的主文和引用
                    finalResponse = JSON.parse(JSON.stringify(searchResponse.value)); // 深拷貝避免修改原始數據
                    
                    // 特別處理 searchResponse 中的重複內容問題
                    if (finalResponse.candidates?.[0]?.content?.parts) {
                        const parts = finalResponse.candidates[0].content.parts;
                        const nonThoughtParts = parts.filter(part => part.thought !== true && !part.text?.includes('<thinking>'));
                        
                        if (nonThoughtParts.length > 1) {
                            if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                                console.log(`⚠️ 直接API SearchResponse 發現 ${nonThoughtParts.length} 個非思考內容 parts，進行去重處理`);
                                nonThoughtParts.forEach((part, index) => {
                                    console.log(`NonThought Part ${index} 長度:`, part.text?.length);
                                });
                            }
                            
                            // 選擇最長的非思考內容作為主要回答（通常最完整）
                            const longestPart = nonThoughtParts.reduce((longest, current) => 
                                (current.text?.length || 0) > (longest.text?.length || 0) ? current : longest
                            );
                            
                            // 重構 parts，保留思考內容和最長的回答內容
                            const thoughtParts = parts.filter(part => part.thought === true || part.text?.includes('<thinking>'));
                            finalResponse.candidates[0].content.parts = [...thoughtParts, longestPart];
                            
                            if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                                console.log('✅ 選擇最長的回答內容，長度:', longestPart.text?.length);
                            }
                        }
                    }
                    
                    if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                        console.log('✅ 開啟引用來源：使用搜尋模式主文和引用（已去重）');
                    }
                }
                
                // 提取兩個回應的思考內容進行比較，選擇更好的推理內容
                let searchThinkingText = '';
                let reasoningThinkingText = '';
                
                // 提取搜尋回應的思考內容
                if (searchResponse.value.candidates?.[0]?.content?.parts) {
                    searchResponse.value.candidates[0].content.parts.forEach(part => {
                        if (part.text && part.text.includes('<thinking>')) {
                            searchThinkingText += part.text + '\n';
                        }
                    });
                }
                
                // 提取推理回應的思考內容
                if (reasoningResponse.value.candidates?.[0]?.content?.parts) {
                    reasoningResponse.value.candidates[0].content.parts.forEach(part => {
                        if (part.text && part.text.includes('<thinking>')) {
                            reasoningThinkingText += part.text + '\n';
                        }
                    });
                }
                
                // 選擇更豐富的思考內容
                let selectedThinkingContent = '';
                if (reasoningThinkingText.length > searchThinkingText.length) {
                    selectedThinkingContent = reasoningThinkingText;
                    if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                        console.log('🧠 選擇推理模式的思考內容（更豐富）');
                    }
                } else if (searchThinkingText.length > 0) {
                    selectedThinkingContent = searchThinkingText;
                    if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                        console.log('🧠 選擇搜尋模式的思考內容');
                    }
                }
                
                // 將選中的思考內容作為 enhancedThinkingContent
                if (selectedThinkingContent && finalResponse.candidates?.[0]) {
                    finalResponse.candidates[0].enhancedThinkingContent = selectedThinkingContent;
                }
                
            } else if (searchResponse.status === 'fulfilled') {
                // 只有搜尋請求成功
                finalResponse = JSON.parse(JSON.stringify(searchResponse.value));
                
                // 即使只有搜尋結果，也要處理重複內容問題
                if (finalResponse.candidates?.[0]?.content?.parts) {
                    const parts = finalResponse.candidates[0].content.parts;
                    const nonThoughtParts = parts.filter(part => part.thought !== true && !part.text?.includes('<thinking>'));
                    
                    if (nonThoughtParts.length > 1) {
                        if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                            console.log(`⚠️ 僅搜尋結果：發現 ${nonThoughtParts.length} 個非思考內容 parts，進行去重處理`);
                        }
                        
                        const longestPart = nonThoughtParts.reduce((longest, current) => 
                            (current.text?.length || 0) > (longest.text?.length || 0) ? current : longest
                        );
                        const thoughtParts = parts.filter(part => part.thought === true || part.text?.includes('<thinking>'));
                        finalResponse.candidates[0].content.parts = [...thoughtParts, longestPart];
                    }
                }
                
                console.warn('推理請求失敗，僅使用搜尋結果（已去重）');
            } else if (reasoningResponse.status === 'fulfilled') {
                // 只有推理請求成功
                finalResponse = reasoningResponse.value;
                console.warn('搜尋請求失敗，僅使用推理結果');
            } else {
                // 兩個請求都失敗
                throw new Error('雙重 API 調用都失敗了');
            }
            
            return finalResponse;
        } else {
            // 不啟用搜尋，只調用普通的 API
            return await this.callGeminiAPIWithoutSearch(question);
        }
    }

    processWorkerDualResponse(workerResponse) {
        // 從 Worker 回應中提取 searchResponse 和 reasoningResponse
        const { searchResponse, reasoningResponse } = workerResponse;
        
        if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
            console.log('=== 處理 Worker 雙重回應 ===');
            console.log('SearchResponse 狀態:', searchResponse ? 'exists' : 'missing');
            console.log('ReasoningResponse 狀態:', reasoningResponse ? 'exists' : 'missing');
            
            if (searchResponse?.candidates?.[0]?.content?.parts) {
                console.log('SearchResponse parts 數量:', searchResponse.candidates[0].content.parts.length);
                searchResponse.candidates[0].content.parts.forEach((part, index) => {
                    console.log(`SearchResponse Part ${index}:`, {
                        isThought: part.thought === true,
                        hasThinkingTag: part.text?.includes('<thinking>'),
                        length: part.text?.length || 0,
                        preview: part.text?.substring(0, 100) + '...'
                    });
                });
            }
        }

        // 處理請求結果 - 根據引用來源設定決定主文來源
        let finalResponse = null;

        if (searchResponse && reasoningResponse) {
            // 兩個請求都成功
            if (!this.showReferencesCheckbox.checked) {
                // 關閉引用來源：使用推理模式的主文 + 搜尋模式的引用資料結構（但不顯示）
                finalResponse = JSON.parse(JSON.stringify(reasoningResponse)); // 深拷貝避免修改原始數據
                
                // 將搜尋模式的 grounding metadata 附加到推理回應上（雖然不會顯示，但保持結構完整）
                if (searchResponse.candidates?.[0]?.groundingMetadata && finalResponse.candidates?.[0]) {
                    finalResponse.candidates[0].groundingMetadata = searchResponse.candidates[0].groundingMetadata;
                }
                
                if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                    console.log('✅ Worker模式 - 關閉引用來源：使用推理模式主文 + 搜尋模式引用結構');
                }
            } else {
                // 開啟引用來源：使用搜尋模式的主文和引用，但需要處理重複內容問題
                finalResponse = JSON.parse(JSON.stringify(searchResponse)); // 深拷貝避免修改原始數據
                
                // 特別處理 searchResponse 中的重複內容問題
                if (finalResponse.candidates?.[0]?.content?.parts) {
                    const parts = finalResponse.candidates[0].content.parts;
                    const nonThoughtParts = parts.filter(part => part.thought !== true && !part.text?.includes('<thinking>'));
                    
                    if (nonThoughtParts.length > 1) {
                        if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                            console.log(`⚠️ Worker SearchResponse 發現 ${nonThoughtParts.length} 個非思考內容 parts，進行去重處理`);
                            nonThoughtParts.forEach((part, index) => {
                                console.log(`NonThought Part ${index} 長度:`, part.text?.length);
                            });
                        }
                        
                        // 選擇最長的非思考內容作為主要回答（通常最完整）
                        const longestPart = nonThoughtParts.reduce((longest, current) => 
                            (current.text?.length || 0) > (longest.text?.length || 0) ? current : longest
                        );
                        
                        // 重構 parts，保留思考內容和最長的回答內容
                        const thoughtParts = parts.filter(part => part.thought === true || part.text?.includes('<thinking>'));
                        finalResponse.candidates[0].content.parts = [...thoughtParts, longestPart];
                        
                        if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                            console.log('✅ 選擇最長的回答內容，長度:', longestPart.text?.length);
                        }
                    }
                }
                
                if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                    console.log('✅ Worker模式 - 開啟引用來源：使用搜尋模式主文和引用（已去重）');
                }
            }
            
            // 提取兩個回應的思考內容進行比較，選擇更好的推理內容
            let searchThinkingText = '';
            let reasoningThinkingText = '';
            
            // 提取搜尋回應的思考內容
            if (searchResponse.candidates?.[0]?.content?.parts) {
                searchResponse.candidates[0].content.parts.forEach(part => {
                    if (part.thought === true || part.text?.includes('<thinking>')) {
                        searchThinkingText += part.text + '\n';
                    }
                });
            }
            
            // 提取推理回應的思考內容
            if (reasoningResponse.candidates?.[0]?.content?.parts) {
                reasoningResponse.candidates[0].content.parts.forEach(part => {
                    if (part.thought === true || part.text?.includes('<thinking>')) {
                        reasoningThinkingText += part.text + '\n';
                    }
                });
            }
            
            // 選擇更豐富的思考內容
            let selectedThinkingContent = '';
            if (reasoningThinkingText.length > searchThinkingText.length) {
                selectedThinkingContent = reasoningThinkingText;
                if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                    console.log('🧠 Worker模式 - 選擇推理模式的思考內容（更豐富）');
                }
            } else if (searchThinkingText.length > 0) {
                selectedThinkingContent = searchThinkingText;
                if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
                    console.log('🧠 Worker模式 - 選擇搜尋模式的思考內容');
                }
            }
            
            // 將選中的思考內容作為 enhancedThinkingContent
            if (selectedThinkingContent && finalResponse.candidates?.[0]) {
                finalResponse.candidates[0].enhancedThinkingContent = selectedThinkingContent;
            }
            
        } else if (searchResponse) {
            // 只有搜尋請求成功
            finalResponse = JSON.parse(JSON.stringify(searchResponse));
            
            // 即使只有搜尋結果，也要處理重複內容問題
            if (finalResponse.candidates?.[0]?.content?.parts) {
                const parts = finalResponse.candidates[0].content.parts;
                const nonThoughtParts = parts.filter(part => part.thought !== true && !part.text?.includes('<thinking>'));
                
                if (nonThoughtParts.length > 1) {
                    const longestPart = nonThoughtParts.reduce((longest, current) => 
                        (current.text?.length || 0) > (longest.text?.length || 0) ? current : longest
                    );
                    const thoughtParts = parts.filter(part => part.thought === true || part.text?.includes('<thinking>'));
                    finalResponse.candidates[0].content.parts = [...thoughtParts, longestPart];
                }
            }
            
            console.warn('Worker模式 - 推理請求失敗，僅使用搜尋結果');
        } else if (reasoningResponse) {
            // 只有推理請求成功
            finalResponse = reasoningResponse;
            console.warn('Worker模式 - 搜尋請求失敗，僅使用推理結果');
        } else {
            // 兩個請求都失敗
            throw new Error('Worker 雙重 API 調用都失敗了');
        }

        return finalResponse;
    }

    async callWorkerAPI(question) {
        const requestBody = {
            question: question,
            enableSearch: this.enableSearchCheckbox ? this.enableSearchCheckbox.checked : true,
            showThinking: this.showThinkingCheckbox ? this.showThinkingCheckbox.checked : false,
            options: {
                showDebug: this.showDebugCheckbox ? this.showDebugCheckbox.checked : false
            }
        };

        if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
            console.log('🌐 調用 Worker API:', this.workerUrl);
            console.log('📤 請求內容:', requestBody);
        }

        const response = await fetch(this.workerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Worker API 請求失敗 (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        
        if (this.showDebugCheckbox && this.showDebugCheckbox.checked) {
            console.log('📥 Worker 回應:', result);
        }

        return result;
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
                    text: "您是一個回答法律問題的人工智慧，請全部用繁體中文回答，並以台灣的資料、法規、文化為準。請結合網路搜尋資料與深度邏輯推理：1. 基於搜尋到的最新資料提供準確答案，並確實引用相關來源 2. 同時進行深度分析和邏輯推理，展示您的思考過程、分析步驟和推理邏輯 3. 將網路資料與第一性原理結合，逐步建構完整論證 4. 既要有實證依據（網路資料），也要有理論基礎（邏輯推理），回答請先講結論，接著從民法、刑法、行政法等三大面向進行分析，若有詮釋其他面向的需求，可以多加說明。請積極上網找資料補充，追求補充資料的充足，資料來源未必要是官方法律資料，可以是網路文章、部落格、經驗分享、新聞等。"
                }]
            },
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 65536,
                responseMimeType: "text/plain",
                thinking_config: {
                    thinking_budget: 24576,
                    include_thoughts: true
                }
            }
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
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
                    text: "您是一個回答法律問題的人工智慧，請全部用繁體中文回答，並以台灣的資料、法規、文化為準。請進行純粹的邏輯推理分析：1. 專注於深度分析和邏輯推理，詳細展示您的思考過程、分析步驟和推理邏輯 2. 從第一性原理出發，逐步建構論證 3. 提供最深層的理論思考與概念探討，回答請先講結論，接著從民法、刑法、行政法等三大面向進行分析，若有詮釋其他面向的需求，可以多加說明。"
                }]
            },
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 65536,
                responseMimeType: "text/plain",
                thinking_config: {
                    thinking_budget: 24576,
                    include_thoughts: true
                }
            }
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    showSettingsPanel() {
        this.settingsPanel.classList.add('active');
        this.settingsToggle.classList.add('active');
    }

    hideSettingsPanel() {
        this.settingsPanel.classList.remove('active');
        this.settingsToggle.classList.remove('active');
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
        const hasApiKey = this.geminiApiKey.length > 0 || this.workerUrl;
        const hasQuestion = this.questionInput.value.trim().length > 0;
        return hasApiKey && hasQuestion;
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

        // 調試輸出
        console.log('=== 處理 API 回應 ===');
        console.log('Candidate parts:', candidate.content.parts);
        console.log('Has enhancedThinkingContent:', !!candidate.enhancedThinkingContent);
        console.log('Has groundingMetadata:', !!candidate.groundingMetadata);

        // 提取回應內容
        let answerText = '';
        let thinkingText = '';

        // 從 parts 中提取內容，處理 grounding API 可能產生的重複內容
        const textParts = [];
        const thoughtParts = [];
        
        candidate.content.parts.forEach((part, index) => {
            if (part.text) {
                console.log(`Part ${index}:`, {
                    length: part.text.length,
                    isThought: part.thought === true,
                    hasThinkingTag: part.text.includes('<thinking>'),
                    preview: part.text.substring(0, 100) + '...'
                });
                
                // 檢查是否為思考內容
                if (part.thought === true || part.text.includes('<thinking>')) {
                    thoughtParts.push(part.text);
                } else {
                    textParts.push(part.text);
                }
            }
        });

        // 處理思考內容
        thinkingText = thoughtParts.join('\n');

        // 處理回答內容 - 如果有多個 text parts，選擇最長的（通常是最完整的）
        if (textParts.length > 0) {
            if (textParts.length > 1) {
                console.log(`⚠️ 發現 ${textParts.length} 個文本 parts，選擇最長的避免重複`);
                // 選擇最長的 part 作為主要回答
                answerText = textParts.reduce((longest, current) => 
                    current.length > longest.length ? current : longest
                );
                console.log(`✅ 選擇最長的回答內容，長度: ${answerText.length}`);
            } else {
                answerText = textParts[0];
            }
        }

        // 如果有 enhancedThinkingContent，優先使用它作為思考內容
        if (candidate.enhancedThinkingContent) {
            thinkingText = candidate.enhancedThinkingContent;
            console.log('使用 enhancedThinkingContent 作為思考內容');
        }

        // 如果沒有通過 part.thought 找到思考內容，嘗試從文本中提取
        if (!thinkingText && answerText.includes('<thinking>')) {
            console.log('嘗試從回答文本中提取思考內容...');
            const thinkingMatch = answerText.match(/<thinking>([\s\S]*?)<\/thinking>/);
            if (thinkingMatch) {
                thinkingText = thinkingMatch[1].trim();
                // 從回答中移除思考內容
                answerText = answerText.replace(/<thinking>[\s\S]*?<\/thinking>/, '').trim();
                console.log('成功提取思考內容:', thinkingText.length, '字元');
            }
        }

        // 提取引用來源
        let references = [];
        if (candidate.groundingMetadata) {
            references = this.extractReferences(candidate.groundingMetadata);
            console.log('提取到引用來源:', references.length, '個');
        }

        // 無論是否有引用來源，都需要清理註腳編號，確保乾淨的閱讀體驗
        console.log('🧹 開始統一文本清理...');
        console.log('🔍 清理前文本長度:', answerText.length);
        console.log('🔍 清理前文本結尾預覽:', answerText.substring(answerText.length - 200));

        // 第一步：移除文本中的所有註腳編號 [1], [2], [3] 等（包括連續的如 [1][2]）
        console.log('📝 清理註腳編號...');
        const beforeFootnoteClean = answerText.length;
        
        // 多重清理策略，確保移除所有可能的註腳格式
        // 1. 移除單個註腳 [1], [2], [3] 等
        answerText = answerText.replace(/\[\d+\]/g, '');
        // 2. 移除連續註腳 [1][2][3] 等
        answerText = answerText.replace(/(\[\d+\])+/g, '');
        // 3. 移除帶空格的註腳 [ 1 ], [ 2 ] 等
        answerText = answerText.replace(/\[\s*\d+\s*\]/g, '');
        // 4. 移除可能的註腳變體（加強版）
        answerText = answerText.replace(/\[(\d+)\]/g, '');
        // 5. 移除任何剩餘的數字方括號組合
        answerText = answerText.replace(/\[[\d\s,]+\]/g, '');
        
        console.log(`✅ 註腳清理完成: 清理前 ${beforeFootnoteClean} 字元，清理後 ${answerText.length} 字元`);

        // 第二步：移除參考資料列表部分（如果存在於文本末尾）
        console.log('� 清理參考資料列表...');
        const beforeRefClean = answerText.length;
        
        // 核心清理邏輯：直接截斷「參考資料」字樣及其後的所有內容
        answerText = answerText.replace(/參考資料[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/引用資料[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/引用來源[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/參考來源[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/資料來源[\s\S]*$/m, '').trim();
        
        // 額外清理各種可能的格式變體，確保徹底移除
        answerText = answerText.replace(/---\s*\*\*參考資料\*\*[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/---\s*\*\*引用來源\*\*[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/---\s*\*\*參考來源\*\*[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/---\s*\*\*資料來源\*\*[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/---\s*\n\s*\*\*參考資料\*\*[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/---\s*\n\s*\*\*引用來源\*\*[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/---\s*\n\s*\*\*參考來源\*\*[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/---\s*\n\s*\*\*引用資料\*\*[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/---\s*\n\s*\*\*資料來源\*\*[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/\*\*參考資料\*\*[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/\*\*引用來源\*\*[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/\*\*參考來源\*\*[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/\*\*引用資料\*\*[\s\S]*$/m, '').trim();
        answerText = answerText.replace(/\*\*資料來源\*\*[\s\S]*$/m, '').trim();
        
        if (beforeRefClean !== answerText.length) {
            console.log(`✅ 移除參考資料列表: 清理前 ${beforeRefClean} 字元，清理後 ${answerText.length} 字元`);
        } else {
            console.log('ℹ️  未發現參考資料列表，無需清理');
        }

        // 第三步：清理可能產生的多餘空白和換行
        answerText = answerText.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

        console.log('🧹 清理後文本長度:', answerText.length);
        console.log('🔍 清理後文本結尾預覽:', answerText.substring(answerText.length - 200));

        // 記錄引用來源處理狀態
        if (references.length === 0) {
            console.log('ℹ️  沒有找到引用來源，文本已清理完成');
        } else if (references.length >= 10) {
            console.log(`� 引用來源數量 ${references.length} ≥ 10，將在專用區塊顯示`);
        } else {
            console.log(`📋 引用來源數量 ${references.length} < 10，將隱藏引用區塊`);
        }

        console.log('✅ 統一文本清理完成，註腳和參考資料列表已移除');

        console.log('=== 最終提取結果 ===');
        console.log('Thinking 內容:', thinkingText ? thinkingText.substring(0, 200) + '...' : '無');
        console.log('Answer 內容:', answerText ? answerText.substring(0, 200) + '...' : '無');
        console.log('References 數量:', references.length);
        console.log('顯示思考流程:', this.showThinkingCheckbox.checked);
        console.log('顯示引用來源:', this.showReferencesCheckbox.checked);

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

        // 添加詳細的調試信息
        console.log('=== 提取引用來源詳細信息 ===');
        console.log('groundingSupports 數量:', groundingMetadata.groundingSupports?.length || 0);
        console.log('groundingChunks 數量:', groundingMetadata.groundingChunks?.length || 0);

        // 檢查 groundingChunks 是否存在且有內容
        if (!groundingMetadata.groundingChunks || groundingMetadata.groundingChunks.length === 0) {
            console.log('⚠️ 沒有 groundingChunks 或 groundingChunks 為空');
            return references; // 返回空數組
        }

        // 直接從 groundingChunks 提取所有有效的 web 引用
        groundingMetadata.groundingChunks.forEach((chunk, index) => {
            console.log(`🔍 檢查 Chunk ${index}:`, chunk);
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
                    console.log(`✅ 添加引用 ${references.length}: ${title} -> ${url}`);
                } else if (url && seenUrls.has(url)) {
                    console.log(`⚠️ 重複的 URL，已跳過: ${url}`);
                } else {
                    console.log(`⚠️ Chunk ${index} 沒有有效的 URL`);
                }
            } else {
                console.log(`⚠️ Chunk ${index} 沒有 web 屬性:`, chunk);
            }
        });

        console.log(`📋 最終提取到 ${references.length} 個有效引用來源`);
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

        // 調試輸出
        console.log('=== 處理 API 回應 ===');
        console.log('Thinking 內容:', data.thinking ? data.thinking.substring(0, 200) + '...' : '無');
        console.log('Answer 內容:', data.answer ? data.answer.substring(0, 200) + '...' : '無');
        console.log('References 數量:', data.references ? data.references.length : 0);
        console.log('顯示思考流程:', this.showThinkingCheckbox.checked);
        console.log('顯示引用來源:', this.showReferencesCheckbox.checked);

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

        // 顯示引用來源（只有當引用數量 ≥ 10 個時才顯示）
        if (this.showReferencesCheckbox.checked && data.references && data.references.length >= 10) {
            console.log('✅ 顯示引用來源區塊，數量:', data.references.length, '≥ 10');
            
            const referenceTitle = '引用來源匯總';
            const referenceIcon = 'fas fa-list-alt';
            
            responseHtml += `
                <div class="references-section large-reference-set">
                    <div class="references-header">
                        <i class="${referenceIcon}"></i>
                        <span>${referenceTitle}</span>
                        <span class="reference-count">(${data.references.length} 個來源)</span>
                        <button class="toggle-references" onclick="this.parentElement.parentElement.classList.toggle('collapsed')">
                            <i class="fas fa-chevron-up"></i>
                        </button>
                    </div>
                    <div class="references-content">
                        ${this.formatLargeReferenceSet(data.references)}
                    </div>
                </div>
            `;
        } else {
            const reason = !this.showReferencesCheckbox.checked ? '引用來源開關關閉' : 
                          !data.references ? '沒有引用資料' : 
                          data.references.length === 0 ? '引用來源數量為0' : 
                          data.references.length < 10 ? `引用來源數量 ${data.references.length} < 10，隱藏引用區塊` : '未知原因';
            
            console.log('❌ 不顯示引用來源區塊，原因:', reason);
        }

        // 第一次回覆後顯示識別碼
        if (!this.hasShownSessionId) {
            // 生成動態識別碼
            const sessionCode = this.generateSessionCode(data);
            
            responseHtml += `
                <div class="session-id-display">
                    <div class="session-id-header">
                        <i class="fas fa-id-card"></i>
                        <span>研究識別碼</span>
                    </div>
                    <div class="session-id-content">
                        <div class="session-id-value">
                            <span class="session-id-text">${sessionCode}</span>
                            <button class="copy-session-btn" id="copy-btn-${sessionCode}" onclick="window.chatApp.copySessionCode('${sessionCode}', this)" title="複製識別碼">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <p class="session-id-note">
                            <i class="fas fa-info-circle"></i>
                            請記下此識別碼，用於問卷填寫和後續追蹤
                        </p>
                    </div>
                </div>
            `;
            this.hasShownSessionId = true;
            
            // 更新歡迎訊息中的識別碼顯示
            const displaySessionId = document.getElementById('displaySessionId');
            if (displaySessionId) {
                displaySessionId.textContent = this.sessionId;
            }
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
        
        // 處理 <thinking> 標籤 - 提取內容並移除標籤
        let formatted = thinking;
        
        // 如果包含 <thinking> 標籤，提取其中的內容
        const thinkingMatch = thinking.match(/<thinking>([\s\S]*?)<\/thinking>/);
        if (thinkingMatch) {
            formatted = thinkingMatch[1].trim();
        }
        
        // 移除任何剩餘的 <thinking> 標籤
        formatted = formatted.replace(/<\/?thinking>/g, '');

        // 處理 Markdown 格式 - 在轉換 HTML 之前先處理
        // 移除 Markdown 標題 ### ## #（包括行首和 <br> 後的）
        formatted = formatted.replace(/^#{1,6}\s*/gm, '');
        formatted = formatted.replace(/(<br>)#{1,6}\s*/g, '$1');
        
        // 先處理粗體文字 **text** - 在處理斜體之前
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<!BOLD!>$1<!ENDBOLD!>');
        
        // 先保護項目符號列表的星號 (行首或<br>後的 * 空格)
        formatted = formatted.replace(/^(\s*)\*\s/gm, '$1<!LISTBULLET!> ');
        formatted = formatted.replace(/(<br>)(\s*)\*\s/g, '$1$2<!LISTBULLET!> ');
        
        // 移除斜體格式 *text* - 只保留文字內容
        formatted = formatted.replace(/\*(.*?)\*/g, '$1');

        // 轉換為安全的 HTML
        formatted = this.escapeHtml(formatted);
        formatted = formatted.replace(/\n/g, '<br>');
        
        // 再次處理可能殘留的標題符號（針對轉換後的內容）
        formatted = formatted.replace(/<br>\s*#{1,6}\s*/g, '<br>');
        formatted = formatted.replace(/^#{1,6}\s*/gm, '');
        
        // 恢復粗體文字標記
        formatted = formatted.replace(/&lt;!BOLD!&gt;(.*?)&lt;!ENDBOLD!&gt;/g, '<strong>$1</strong>');
        
        // 處理數字列表
        formatted = formatted.replace(/(\d+)\.\s/g, '<strong>$1.</strong> ');
        
        // 處理項目符號列表 (包括星號、橫線、圓點)
        formatted = formatted.replace(/^[-•]\s/gm, '<span style="color: #666;">•</span> ');
        formatted = formatted.replace(/&lt;!LISTBULLET!&gt;/g, '<span style="color: #666;">•</span>');
        
        // 處理重要標題（以冒號結尾的行）
        formatted = formatted.replace(/^([^<\n]+：)/gm, '<strong style="color: #2c3e50;">$1</strong>');
        
        return formatted;
    }

    formatResponse(response) {
        if (!response) return '';
        
        // 移除任何 <thinking> 標籤（如果意外包含在回答中）
        let formatted = response.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
        
        // 處理 Markdown 格式 - 在轉換 HTML 之前先處理
        // 移除 Markdown 標題 ### ## #（包括行首和 <br> 後的）
        formatted = formatted.replace(/^#{1,6}\s*/gm, '');
        formatted = formatted.replace(/(<br>)#{1,6}\s*/g, '$1');
        
        // 先處理粗體文字 **text** - 在處理斜體之前
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<!BOLD!>$1<!ENDBOLD!>');
        
        // 先保護項目符號列表的星號 (行首或<br>後的 * 空格)
        formatted = formatted.replace(/^(\s*)\*\s/gm, '$1<!LISTBULLET!> ');
        formatted = formatted.replace(/(<br>)(\s*)\*\s/g, '$1$2<!LISTBULLET!> ');
        
        // 移除斜體格式 *text* - 只保留文字內容
        formatted = formatted.replace(/\*(.*?)\*/g, '$1');
        
        // 轉換為安全的 HTML
        formatted = this.escapeHtml(formatted);
        formatted = formatted.replace(/\n/g, '<br>');
        
        // 再次處理可能殘留的標題符號（針對轉換後的內容）
        formatted = formatted.replace(/<br>\s*#{1,6}\s*/g, '<br>');
        formatted = formatted.replace(/^#{1,6}\s*/gm, '');
        
        // 恢復粗體文字標記
        formatted = formatted.replace(/&lt;!BOLD!&gt;(.*?)&lt;!ENDBOLD!&gt;/g, '<strong>$1</strong>');
        
        // 處理標題（以冒號結尾）
        formatted = formatted.replace(/^([^<\n]+：)/gm, '<strong style="color: #2c3e50;">$1</strong>');
        
        // 處理數字列表
        formatted = formatted.replace(/^(\d+)\.\s/gm, '<strong>$1.</strong> ');
        
        // 處理項目符號列表 (包括星號、橫線、圓點)
        formatted = formatted.replace(/^[-•]\s/gm, '<span style="color: #666;">•</span> ');
        formatted = formatted.replace(/&lt;!LISTBULLET!&gt;/g, '<span style="color: #666;">•</span>');
        
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

    formatLargeReferenceSet(references) {
        if (!references || references.length === 0) return '';
        
        // 將大量引用來源以更緊湊的方式顯示
        return `
            <div class="large-reference-notice">
                <p><strong>📋 本回答引用了 ${references.length} 個來源，已移除文本中的註腳編號以提升閱讀體驗。</strong></p>
                <p>以下是完整的引用來源列表：</p>
            </div>
            <div class="large-reference-list">
                ${references.map((ref, index) => `
                    <div class="reference-item compact">
                        <div class="reference-number">${index + 1}</div>
                        <div class="reference-details">
                            <a href="${ref.url}" target="_blank" rel="noopener noreferrer" title="${this.escapeHtml(ref.title)}">
                                ${this.escapeHtml(ref.title.length > 80 ? ref.title.substring(0, 77) + '...' : ref.title)}
                            </a>
                            <div class="reference-domain">${this.extractDomain(ref.url)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    extractDomain(url) {
        try {
            const domain = new URL(url).hostname;
            return domain.replace('www.', '');
        } catch (e) {
            return url;
        }
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
            showDebug: this.showDebugCheckbox.checked,
            enableSearch: this.enableSearchCheckbox ? this.enableSearchCheckbox.checked : true,
            geminiApiKey: this.geminiApiKey
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
                
                if (this.enableSearchCheckbox) {
                    this.enableSearchCheckbox.checked = settings.enableSearch !== false;
                }
                
                if (settings.geminiApiKey && this.geminiApiKeyInput) {
                    this.geminiApiKey = settings.geminiApiKey;
                    this.geminiApiKeyInput.value = settings.geminiApiKey;
                    this.updateSendButtonState();
                }
            }
        } catch (error) {
            console.error('載入設定時發生錯誤:', error);
        }
    }
}

// 初始化應用
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});
