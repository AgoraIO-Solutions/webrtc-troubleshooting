// Agora WebRTC Troubleshooting Demo
class WebRTCTroubleshooting {
    constructor() {
        this.appId = '';
        this.token = null;
        this.channel = '';
        this.userId = null;
        this.isCloudProxyEnabled = false;
        this.proxyMode = 3;
        this.currentStep = 0;
        this.isTesting = false;
        this.language = 'en';
        
        // Agora clients
        this.sendClient = null;
        this.recvClient = null;
        this.audioTrack = null;
        this.videoTrack = null;
        this.localAudioTrack = null;
        
        // Test results
        this.testResults = {
            browser: { status: 'pending', message: '' },
            microphone: { status: 'pending', message: '' },
            speaker: { status: 'pending', message: '' },
            resolution: { status: 'pending', message: '', results: [] },
            network: { status: 'pending', message: '', data: { bitrate: [], packetLoss: [] }, candidatePair: null }
        };
        
        // Test profiles for resolution check
        this.testProfiles = [
            { resolution: '120p_1', width: 160, height: 120 },
            { resolution: '180p_1', width: 320, height: 180 },
            { resolution: '240p_1', width: 320, height: 240 },
            { resolution: '360p_1', width: 640, height: 360 },
            { resolution: '480p_1', width: 640, height: 480 },
            { resolution: '720p_1', width: 1280, height: 720 },
            { resolution: '1080p_1', width: 1920, height: 1080 }
        ];
        
        // Chart data
        this.bitrateChart = null;
        this.packetLossChart = null;
        this.chartData = {
            bitrate: [['Time', 'Local Video Bitrate', 'Local Audio Bitrate', 'Remote Video Bitrate', 'Remote Audio Bitrate']],
            packetLoss: [['Time', 'Local Video Packet Loss', 'Local Audio Packet Loss', 'Remote Video Packet Loss', 'Remote Audio Packet Loss']]
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.generateChannelName();
        this.setupCharts();
        this.enableAgoraLogging();
    }
    
    enableAgoraLogging() {
        // Enable Agora SDK debug logging
        AgoraRTC.setLogLevel(0); // 0 = DEBUG, 1 = INFO, 2 = WARN, 3 = ERROR, 4 = NONE
        AgoraRTC.enableLogUpload();
    }
    
    setupEventListeners() {
        // Start test button
        document.getElementById('startBtn').addEventListener('click', () => this.startTest());
        
        // Language toggle - removed (element not present in HTML)
        
        // Download logs
        document.getElementById('downloadLogsBtn').addEventListener('click', () => this.downloadLogs());
        
        // Cloud proxy toggle
        document.getElementById('enableCloudProxy').addEventListener('change', (e) => {
            this.isCloudProxyEnabled = e.target.checked;
            const proxyModes = document.getElementById('proxyModes');
            proxyModes.style.display = e.target.checked ? 'block' : 'none';
        });
        
        // Proxy mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.proxyMode = parseInt(e.target.dataset.mode);
            });
        });
        
        // Speaker test buttons - these are now attached dynamically in createTestAudio()
        
        // Modal controls
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('endTestBtn').addEventListener('click', () => this.endLiveTest());
        
        // Device selection modal controls
        document.getElementById('closeDeviceModal').addEventListener('click', () => this.closeDeviceModal());
        document.getElementById('cancelDeviceSelection').addEventListener('click', () => this.closeDeviceModal());
        document.getElementById('confirmDeviceSelection').addEventListener('click', () => this.confirmDeviceSelection());
        
        // Report actions
        document.getElementById('tryAgainBtn').addEventListener('click', () => this.resetTest());
        document.getElementById('shareReportBtn').addEventListener('click', () => this.shareReport());
        
        // Seeing is believing controls
        document.getElementById('startLiveTestBtn').addEventListener('click', () => this.showDeviceSelection());
        document.getElementById('stopLiveTestBtn').addEventListener('click', () => this.stopLiveTest());
    }
    
    generateChannelName() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000000);
        this.channel = `test_${timestamp}_${random}`;
        document.getElementById('channelName').value = this.channel;
    }
    
    setupCharts() {
        google.charts.load('current', {'packages':['corechart']});
        google.charts.setOnLoadCallback(() => {
            this.initializeCharts();
        });
    }
    
    initializeCharts() {
        const bitrateOptions = {
            title: 'Bitrate (kbps)',
            hAxis: { title: 'Time (s)' },
            vAxis: { title: 'Bitrate (kbps)', minValue: 0 },
            backgroundColor: 'transparent',
            legend: { position: 'top' }
        };
        
        const packetLossOptions = {
            title: 'Packet Loss (%)',
            hAxis: { title: 'Time (s)' },
            vAxis: { title: 'Packet Loss (%)', minValue: 0, maxValue: 100 },
            backgroundColor: 'transparent',
            legend: { position: 'top' }
        };
        
        this.bitrateChart = new google.visualization.LineChart(document.getElementById('bitrateChart'));
        this.packetLossChart = new google.visualization.LineChart(document.getElementById('packetLossChart'));
        
        // Initialize with empty data
        this.updateCharts();
    }
    
    async startTest() {
        this.appId = document.getElementById('appId').value;
        this.token = document.getElementById('token').value || null;
        this.channel = document.getElementById('channelName').value;
        this.userId = document.getElementById('userId').value ? parseInt(document.getElementById('userId').value) : null;
        
        if (!this.appId || !this.channel) {
            this.showMessage('Please enter App ID and Channel Name', 'error');
            return;
        }
        
        this.isTesting = true;
        this.currentStep = 0;
        this.resetTestResults();
        
        // Show test steps
        document.getElementById('testConfig').style.display = 'none';
        document.getElementById('testSteps').style.display = 'block';
        document.getElementById('testReport').style.display = 'none';
        
        this.showMessage('Starting WebRTC troubleshooting test...', 'info');
        
        try {
            await this.runBrowserCheck();
            await this.runMicrophoneCheck();
            await this.runSpeakerCheck();
            await this.runResolutionCheck();
            await this.runNetworkCheck();
            this.showTestReport();
        } catch (error) {
            console.error('Test failed:', error);
            this.showMessage(`Test failed: ${error.message}`, 'error');
        }
    }
    
    resetTestResults() {
        this.testResults = {
            browser: { status: 'pending', message: '' },
            microphone: { status: 'pending', message: '' },
            speaker: { status: 'pending', message: '' },
            resolution: { status: 'pending', message: '', results: [] },
            network: { status: 'pending', message: '', data: { bitrate: [], packetLoss: [] }, candidatePair: null }
        };
    }
    
    async runBrowserCheck() {
        this.updateStep(0);
        this.showMessage('Checking browser compatibility...', 'info');
        
        try {
            const isSupported = AgoraRTC.checkSystemRequirements();
            
            // Get detailed browser information
            const userAgent = navigator.userAgent;
            const browserInfo = this.parseUserAgent(userAgent);
            const sdkVersion = AgoraRTC.VERSION;
            
            if (isSupported) {
                this.testResults.browser = {
                    status: 'success',
                    message: `${browserInfo.name} - Fully supported`,
                    details: {
                        browser: `${browserInfo.name} ${browserInfo.version}`,
                        platform: browserInfo.platform,
                        sdkVersion: sdkVersion,
                        userAgent: userAgent
                    }
                };
                this.updateStepResult('browserResult', 
                    `✅ ${browserInfo.name} ${browserInfo.version}<br>
                     <small>SDK Version: ${sdkVersion}</small><br>
                     <small>Platform: ${browserInfo.platform}</small><br>
                     <small>User Agent: ${userAgent}</small>`, 'success');
            } else {
                this.testResults.browser = {
                    status: 'warning',
                    message: `${browserInfo.name} - Limited support`,
                    details: {
                        browser: `${browserInfo.name} ${browserInfo.version}`,
                        platform: browserInfo.platform,
                        sdkVersion: sdkVersion,
                        userAgent: userAgent
                    }
                };
                this.updateStepResult('browserResult', 
                    `⚠️ ${browserInfo.name} ${browserInfo.version}<br>
                     <small>Some functions may be limited</small><br>
                     <small>SDK Version: ${sdkVersion}</small><br>
                     <small>User Agent: ${userAgent}</small>`, 'warning');
            }
            
            // Show browser info for 4 seconds before moving on
            await this.delay(4000);
            this.nextStep();
        } catch (error) {
            this.testResults.browser = {
                status: 'error',
                message: error.message
            };
            this.updateStepResult('browserResult', `❌ Browser check failed: ${error.message}`, 'error');
            throw error;
        }
    }
    
    parseUserAgent(userAgent) {
        let browserName = 'Unknown';
        let browserVersion = '';
        let platform = 'Unknown';
        
        // Detect browser
        if (userAgent.includes('Chrome') && !userAgent.includes('Edge')) {
            browserName = 'Chrome';
            const match = userAgent.match(/Chrome\/(\d+\.\d+)/);
            browserVersion = match ? match[1] : '';
        } else if (userAgent.includes('Firefox')) {
            browserName = 'Firefox';
            const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
            browserVersion = match ? match[1] : '';
        } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
            browserName = 'Safari';
            const match = userAgent.match(/Version\/(\d+\.\d+)/);
            browserVersion = match ? match[1] : '';
        } else if (userAgent.includes('Edge')) {
            browserName = 'Edge';
            const match = userAgent.match(/Edge\/(\d+\.\d+)/);
            browserVersion = match ? match[1] : '';
        }
        
        // Detect platform
        if (userAgent.includes('Windows')) {
            platform = 'Windows';
        } else if (userAgent.includes('Mac')) {
            platform = 'macOS';
        } else if (userAgent.includes('Linux')) {
            platform = 'Linux';
        } else if (userAgent.includes('Android')) {
            platform = 'Android';
        } else if (userAgent.includes('iOS')) {
            platform = 'iOS';
        }
        
        return { name: browserName, version: browserVersion, platform: platform };
    }
    
    async runMicrophoneCheck() {
        this.updateStep(1);
        this.showMessage('Testing microphone... Speak into your microphone!', 'info');
        
        try {
            this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            
            // Show the volume meter with user controls
            const micResult = document.getElementById('micResult');
            micResult.innerHTML = `
                <div class="microphone-test">
                    <div class="mic-instructions">
                        <h4>🎤 Microphone Test</h4>
                        <p>Speak into your microphone and watch the volume bar below.</p>
                        <p>Click "Test Complete" when you're ready to proceed.</p>
                    </div>
                    <div class="volume-meter">
                        <div class="volume-bar" id="volumeBar"></div>
                        <div class="volume-text" id="volumeText">Speak into your microphone - Watch the bar above!</div>
                    </div>
                    <div class="mic-controls">
                        <button id="micTestComplete" class="btn-primary">✅ Test Complete</button>
                        <button id="micTestFailed" class="btn-danger">❌ Microphone Not Working</button>
                    </div>
                </div>
            `;
            
            let volumeSum = 0;
            let volumeCount = 0;
            let maxVolume = 0;
            let testCompleted = false;
            
            const volumeInterval = setInterval(() => {
                const volume = this.localAudioTrack.getVolumeLevel();
                volumeSum += volume;
                volumeCount++;
                maxVolume = Math.max(maxVolume, volume);
                
                const volumePercent = Math.min(volume * 100, 100);
                const volumeBar = document.getElementById('volumeBar');
                if (volumeBar) {
                    volumeBar.style.width = `${volumePercent}%`;
                }
                
                // Update text with current volume
                const volumeText = document.getElementById('volumeText');
                if (volumeText) {
                    volumeText.textContent = `Current volume: ${Math.round(volumePercent)}% - Speak louder!`;
                }
            }, 100);
            
            // Return a promise that resolves when user clicks a button
            return new Promise((resolve) => {
                // Add event listeners for user interaction - use setTimeout to ensure DOM is ready
                setTimeout(() => {
                    const completeBtn = document.getElementById('micTestComplete');
                    const failedBtn = document.getElementById('micTestFailed');
                    
                    console.log('Microphone buttons found:', { completeBtn, failedBtn });
                    
                    if (completeBtn) {
                        completeBtn.addEventListener('click', () => {
                            console.log('Microphone Complete clicked');
                            if (!testCompleted) {
                                testCompleted = true;
                                clearInterval(volumeInterval);
                                this.localAudioTrack.close();
                                
                                const avgVolume = volumeSum / volumeCount;
                                console.log(`Microphone test - Avg volume: ${avgVolume}, Max volume: ${maxVolume}`);
                                
                                if (maxVolume > 0.05) {
                this.testResults.microphone = {
                    status: 'success',
                    message: 'Microphone OK'
                };
                                    this.updateStepResult('micResult', '✅ Microphone works well - Good volume detected!', 'success');
                                } else {
                                    this.testResults.microphone = {
                                        status: 'warning',
                                        message: 'Low volume detected'
                                    };
                                    this.updateStepResult('micResult', '⚠️ Can barely hear you - Try speaking louder next time', 'warning');
                                }
                                
                                this.nextStep();
                                resolve();
                            }
                        });
                    }
                    
                    if (failedBtn) {
                        failedBtn.addEventListener('click', () => {
                            console.log('Microphone Failed clicked');
                            if (!testCompleted) {
                                testCompleted = true;
                                clearInterval(volumeInterval);
                                this.localAudioTrack.close();
                                
                                this.testResults.microphone = {
                                    status: 'error',
                                    message: 'Microphone failed'
                                };
                                this.updateStepResult('micResult', '❌ Microphone test failed - Check your microphone settings', 'error');
                                
                                this.nextStep();
                                resolve();
                            }
                        });
                    }
                }, 100);
            });
            
        } catch (error) {
            this.testResults.microphone = {
                status: 'error',
                message: error.message
            };
            this.updateStepResult('micResult', `❌ Microphone test failed: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async runSpeakerCheck() {
        this.updateStep(2);
        this.showMessage('Testing speaker/headphones...', 'info');
        
        // Create audio element with a free test sound
        this.createTestAudio();
        
        // Wait for user interaction
        return new Promise((resolve) => {
            this.speakerResolve = resolve;
        });
    }
    
    createTestAudio() {
        try {
            // Create a more complex test tone with multiple frequencies
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Update UI to show play button and instructions
            const speakerResult = document.getElementById('speakerResult');
            speakerResult.innerHTML = `
                <div class="audio-test">
                    <div class="audio-instructions">
                        <h4>🔊 Speaker Test</h4>
                        <p>Click the play button below to test your speakers/headphones.</p>
                        <p>You should hear a test tone for 4 seconds. You can play it multiple times.</p>
                    </div>
                    <div class="audio-controls">
                        <button id="playTestAudio" class="btn-primary">▶️ Play Test Audio</button>
                        <button id="playTestAudioAgain" class="btn-secondary" style="display: none;">🔄 Play Again</button>
                        <div class="speaker-buttons" style="display: none;">
                            <button id="speakerYes" class="btn-success">✅ Yes, I can hear it</button>
                            <button id="speakerNo" class="btn-danger">❌ No, I cannot hear it</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Function to play test audio
            const playTestTone = () => {
                try {
                    // Create a more audible test tone with multiple frequencies
                    const oscillator1 = audioContext.createOscillator();
                    const oscillator2 = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator1.connect(gainNode);
                    oscillator2.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    // Two frequencies for better audibility
                    oscillator1.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
                    oscillator2.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
                    oscillator1.type = 'sine';
                    oscillator2.type = 'sine';
                    
                    // Higher volume for better audibility
                    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 4);
                    
                    oscillator1.start(audioContext.currentTime);
                    oscillator2.start(audioContext.currentTime);
                    oscillator1.stop(audioContext.currentTime + 4);
                    oscillator2.stop(audioContext.currentTime + 4);
                    
                    this.showMessage('Playing test tone - Can you hear it?', 'info');
                } catch (error) {
                    console.error('Error playing test audio:', error);
                    this.showMessage('Could not play test audio - Please check your speakers', 'warning');
                }
            };
            
            // Add event listeners with proper timing
            setTimeout(() => {
                const playBtn = document.getElementById('playTestAudio');
                const playAgainBtn = document.getElementById('playTestAudioAgain');
                const speakerYesBtn = document.getElementById('speakerYes');
                const speakerNoBtn = document.getElementById('speakerNo');
                
                console.log('Speaker buttons found:', { playBtn, playAgainBtn, speakerYesBtn, speakerNoBtn });
                
                if (playBtn) {
                    playBtn.addEventListener('click', () => {
                        playTestTone();
                        
                        // Show the play again button and yes/no buttons
                        if (playAgainBtn) playAgainBtn.style.display = 'inline-block';
                        const speakerButtons = document.querySelector('.speaker-buttons');
                        if (speakerButtons) speakerButtons.style.display = 'flex';
                        playBtn.style.display = 'none';
                    });
                }
                
                if (playAgainBtn) {
                    playAgainBtn.addEventListener('click', () => {
                        playTestTone();
                    });
                }
                
                // Re-attach speaker buttons event listeners
                if (speakerYesBtn) {
                    // Remove any existing listeners first
                    speakerYesBtn.removeEventListener('click', this.handleSpeakerResult);
                    speakerYesBtn.addEventListener('click', () => {
                        console.log('Speaker Yes clicked');
                        this.handleSpeakerResult(true);
                    });
                }
                
                if (speakerNoBtn) {
                    // Remove any existing listeners first
                    speakerNoBtn.removeEventListener('click', this.handleSpeakerResult);
                    speakerNoBtn.addEventListener('click', () => {
                        console.log('Speaker No clicked');
                        this.handleSpeakerResult(false);
                    });
                }
            }, 100);
            
            this.audioContext = audioContext;
            
            // Auto-advance after 20 seconds if no user interaction
            this.speakerTimeout = setTimeout(() => {
                if (this.speakerResolve) {
                    this.showMessage('No response detected - assuming speaker test failed', 'warning');
                    this.handleSpeakerResult(false);
                }
            }, 20000);
            
        } catch (error) {
            console.error('Could not create test audio:', error);
            this.showMessage('Could not play test audio - Please check your speakers', 'warning');
        }
    }
    
    handleSpeakerResult(canHear) {
        console.log('handleSpeakerResult called with canHear:', canHear);
        
        // Clear the timeout to prevent auto-advance
        if (this.speakerTimeout) {
            clearTimeout(this.speakerTimeout);
            this.speakerTimeout = null;
        }
        
        // Clean up audio elements
        if (this.testAudio) {
            try {
                if (this.testAudio.stop) {
                    this.testAudio.stop();
                }
            } catch (error) {
                console.error('Error stopping test audio:', error);
            }
            this.testAudio = null;
        }
        
        if (this.audioContext) {
            try {
                this.audioContext.close();
            } catch (error) {
                console.error('Error closing audio context:', error);
            }
            this.audioContext = null;
        }
        
        if (canHear) {
            console.log('Setting speaker result to success');
            this.testResults.speaker = {
                status: 'success',
                message: 'Speaker OK'
            };
            this.updateStepResult('speakerResult', '✅ Speaker works well - Audio output is working!', 'success');
        } else {
            console.log('Setting speaker result to error');
            this.testResults.speaker = {
                status: 'error',
                message: 'Speaker failed'
            };
            this.updateStepResult('speakerResult', '❌ Something is wrong with the speaker - Check your audio settings', 'error');
        }
        
        this.nextStep();
        if (this.speakerResolve) {
            this.speakerResolve();
        }
    }
    
    async runResolutionCheck() {
        this.updateStep(3);
        this.showMessage('Testing video resolutions...', 'info');
        
        const resolutionList = document.getElementById('resolutionList');
        resolutionList.innerHTML = '<div class="loading">🔄 Testing resolutions...</div>';
        
        try {
            const results = [];
            
            // Set a flag to prevent interruption
            this.isResolutionTesting = true;
            
            for (let i = 0; i < this.testProfiles.length; i++) {
                // Check if we should continue (in case of interruption)
                if (!this.isResolutionTesting) {
                    console.log('Resolution test interrupted');
                    break;
                }
                const profile = this.testProfiles[i];
                console.log(`Testing resolution: ${profile.resolution} (${profile.width}x${profile.height})`);
                
                // Update UI to show current test
                resolutionList.innerHTML = `
                    <div class="loading">🔄 Testing ${profile.width} × ${profile.height}...</div>
                    ${results.map(result => `
                        <div class="resolution-item">
                            <div class="resolution-info">
                                ${result.width} × ${result.height}
                                ${result.actualWidth && result.actualHeight ? 
                                    ` (Actual: ${result.actualWidth} × ${result.actualHeight})` : ''}
                            </div>
                            <div class="resolution-status ${result.status}">
                                ${result.status === 'success' ? '✅' : 
                                  result.status === 'warning' ? '⚠️' : '❌'}
                            </div>
                        </div>
                    `).join('')}
                `;
                
                try {
                    // Create video track with specific resolution
                    const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
                        {},
                        { encoderConfig: profile.resolution }
                    );
                    
                    // Play video to test resolution
                    videoTrack.play('test-send');
                    
                    // Wait for video to load with timeout - increased to 8 seconds
                    await Promise.race([
                        this.delay(200), // 1 second timeout
                        new Promise((resolve) => {
                            const checkVideo = () => {
                                const videoElement = document.querySelector('#test-send video');
                                if (videoElement && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                                    resolve();
                                } else {
                                    setTimeout(checkVideo, 200);
                                }
                            };
                            checkVideo();
                        })
                    ]);
                    
                    // Additional wait to ensure video is fully rendered
                    await this.delay(2000);
                    
                    // Check if video is displaying correctly
                    const videoElement = document.querySelector('#test-send video');
                    if (videoElement && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                        const actualWidth = videoElement.videoWidth;
                        const actualHeight = videoElement.videoHeight;
                        const expectedWidth = profile.width;
                        const expectedHeight = profile.height;
                        
                        console.log(`Resolution ${profile.resolution}: Expected ${expectedWidth}x${expectedHeight}, Got ${actualWidth}x${actualHeight}`);
                        
                        // Allow some tolerance for resolution matching
                        const widthMatch = Math.abs(actualWidth - expectedWidth) <= 20;
                        const heightMatch = Math.abs(actualHeight - expectedHeight) <= 20;
                        
                        if (widthMatch && heightMatch) {
                            results.push({ ...profile, status: 'success' });
                        } else {
                            results.push({ ...profile, status: 'warning', actualWidth, actualHeight });
                        }
                    } else {
                        results.push({ ...profile, status: 'error' });
                    }
                    
                    // Clean up
                    audioTrack.close();
                    videoTrack.close();
                    
                } catch (error) {
                    console.error(`Resolution test failed for ${profile.resolution}:`, error);
                    results.push({ ...profile, status: 'error', error: error.message });
                }
                
                // Update UI with current results
                this.updateResolutionList(results);
                
                // Longer delay between tests - 3 seconds
                await this.delay(3000);
            }
            
            // Clear the flag
            this.isResolutionTesting = false;
            
            this.testResults.resolution = {
                status: results.some(r => r.status === 'success') ? 'success' : 'error',
                message: `${results.filter(r => r.status === 'success').length}/${results.length} resolutions OK`,
                results: results
            };
            
            this.nextStep();
            
        } catch (error) {
            this.isResolutionTesting = false;
            this.testResults.resolution = {
                status: 'error',
                message: error.message,
                results: []
            };
            this.updateStepResult('resolutionResult', `❌ Resolution test failed: ${error.message}`, 'error');
            throw error;
        }
    }
    
    updateResolutionList(results) {
        const resolutionList = document.getElementById('resolutionList');
        resolutionList.innerHTML = results.map(result => `
            <div class="resolution-item">
                <div class="resolution-info">
                    ${result.width} × ${result.height}
                    ${result.actualWidth && result.actualHeight ? 
                        ` (Actual: ${result.actualWidth} × ${result.actualHeight})` : ''}
                </div>
                <div class="resolution-status ${result.status}">
                    ${result.status === 'success' ? '✅' : 
                      result.status === 'warning' ? '⚠️' : '❌'}
                </div>
            </div>
        `).join('');
    }
    
    async runNetworkCheck() {
        this.updateStep(4);
        this.showMessage('Testing network connectivity...', 'info');
        
        try {
            // Initialize Agora clients
            await this.initializeAgoraClients();
            
            // Start network monitoring
            this.startNetworkMonitoring();
            
            // Wait for network data
            await this.delay(10000); // 10 seconds
            
            // Analyze candidate pairs
            const candidatePairData = await this.analyzeCandidatePairs();
            
            this.stopNetworkMonitoring();
            await this.cleanupAgoraClients();
            
            // Analyze network results
            const bitrateData = this.chartData.bitrate;
            const packetLossData = this.chartData.packetLoss;
            
            if (bitrateData.length > 1) {
                const lastBitrate = bitrateData[bitrateData.length - 1];
                const lastPacketLoss = packetLossData[packetLossData.length - 1];
                
                let networkStatus = 'success';
                let message = 'Network OK';
                
                if (lastBitrate[1] < 100 || lastBitrate[2] < 10) { // Low bitrates
                    networkStatus = 'warning';
                    message = 'Low bitrate';
                }
                
                if (lastPacketLoss[1] > 5 || lastPacketLoss[2] > 5) { // High packet loss
                    networkStatus = 'error';
                    message = 'High packet loss';
                }
                
                this.testResults.network = {
                    status: networkStatus,
                    message: message,
                    data: {
                        bitrate: lastBitrate,
                        packetLoss: lastPacketLoss
                    },
                    candidatePair: candidatePairData
                };
            } else {
                this.testResults.network = {
                    status: 'error',
                    message: 'No network data collected',
                    candidatePair: candidatePairData
                };
            }
            
            this.nextStep();
            
        } catch (error) {
            this.testResults.network = {
                status: 'error',
                message: error.message,
                candidatePair: null
            };
            this.updateStepResult('networkResult', `❌ Network test failed: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async initializeAgoraClients() {
        // Create clients
        this.sendClient = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        this.recvClient = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        
        // Set client roles
        await this.sendClient.setClientRole('host');
        await this.recvClient.setClientRole('audience');
        
        // Setup cloud proxy if enabled
        if (this.isCloudProxyEnabled) {
            await this.sendClient.startProxyServer(this.proxyMode);
            await this.recvClient.startProxyServer(this.proxyMode);
        }
        
        // Create tracks
        [this.audioTrack, this.videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
            {},
            { encoderConfig: '720p_2' }
        );
        
        // Join channels
        const sendUid = Math.floor(Math.random() * 100000) + 100000;
        const recvUid = Math.floor(Math.random() * 100000) + 200000;
        
        await this.sendClient.join(this.appId, this.channel, this.token, sendUid);
        await this.recvClient.join(this.appId, this.channel, this.token, recvUid);
        
        // Publish tracks
        await this.sendClient.publish([this.audioTrack, this.videoTrack]);
        
        // Setup remote user handling
        this.recvClient.on('user-published', async (user, mediaType) => {
            await this.recvClient.subscribe(user, mediaType);
            if (mediaType === 'video') {
                user.videoTrack.play('test-recv');
            }
        });
    }
    
    startNetworkMonitoring() {
        this.networkInterval = setInterval(async () => {
            try {
                const sendStats = await this.sendClient.getRTCStats();
                const recvStats = await this.recvClient.getRTCStats();
                const localVideoStats = await this.sendClient.getLocalVideoStats();
                const localAudioStats = await this.sendClient.getLocalAudioStats();
                const remoteVideoStats = await this.recvClient.getRemoteVideoStats();
                const remoteAudioStats = await this.recvClient.getRemoteAudioStats();
                
                // Call the new updateStats method for debugging
                await this.updateStats(this.sendClient, this.recvClient);
                
                const time = Date.now() - this.testStartTime;
                
                // Debug logging to see what stats we're getting
                console.log('Network Test - Send Stats:', sendStats);
                console.log('Network Test - Local Audio Stats:', localAudioStats);
                console.log('Network Test - Remote Video Stats:', remoteVideoStats);
                console.log('Network Test - Remote Audio Stats:', remoteAudioStats);
                
                // Check if sendStats has any audio-related properties
                console.log('🔍 SendStats properties:', Object.keys(sendStats));
                console.log('🔍 LocalAudioStats properties:', Object.keys(localAudioStats));
                console.log('🔍 LocalAudioStats values:', localAudioStats);
                
                // Check what's in the first local audio stat object
                if (Object.keys(localAudioStats).length > 0) {
                    const firstLocalAudioKey = Object.keys(localAudioStats)[0];
                    console.log('🔍 First Local Audio Key:', firstLocalAudioKey);
                    console.log('🔍 First Local Audio Object:', localAudioStats[firstLocalAudioKey]);
                    console.log('🔍 First Local Audio Object Keys:', Object.keys(localAudioStats[firstLocalAudioKey]));
                }
                
                // Calculate all 4 bitrates
                const localVideoKeys = Object.keys(localVideoStats);
                const localAudioKeys = Object.keys(localAudioStats);
                const remoteVideoKeys = Object.keys(remoteVideoStats);
                const remoteAudioKeys = Object.keys(remoteAudioStats);
                
                // Local video bitrate - read directly from the flat object
                let localVideoBitrate = Number(localVideoStats?.sendBitrate || 0) * 0.001;
                
                // Local audio bitrate - read directly from the flat object
                let localAudioBitrate = Number(localAudioStats?.sendBitrate || 0) * 0.001;
                
                // Remote video bitrate
                let remoteVideoBitrate = 0;
                if (remoteVideoKeys.length > 0) {
                    remoteVideoBitrate = Number(remoteVideoStats[remoteVideoKeys[0]]?.receiveBitrate || remoteVideoStats[remoteVideoKeys[0]]?.bitrate || 0) * 0.001;
                }
                
                // Remote audio bitrate
                let remoteAudioBitrate = 0;
                if (remoteAudioKeys.length > 0) {
                    remoteAudioBitrate = Number(remoteAudioStats[remoteAudioKeys[0]]?.receiveBitrate || remoteAudioStats[remoteAudioKeys[0]]?.bitrate || 0) * 0.001;
                }
                
                // Ensure we have valid numbers and handle edge cases
                const validLocalVideoBitrate = isNaN(localVideoBitrate) || localVideoBitrate < 0 ? 0 : Math.max(0, localVideoBitrate);
                const validLocalAudioBitrate = isNaN(localAudioBitrate) || localAudioBitrate < 0 ? 0 : Math.max(0, localAudioBitrate);
                const validRemoteVideoBitrate = isNaN(remoteVideoBitrate) || remoteVideoBitrate < 0 ? 0 : Math.max(0, remoteVideoBitrate);
                const validRemoteAudioBitrate = isNaN(remoteAudioBitrate) || remoteAudioBitrate < 0 ? 0 : Math.max(0, remoteAudioBitrate);
                
                // Calculate packet loss - both local and remote
                const localVideoPacketLoss = Number(localVideoStats?.sendPacketsLost || localVideoStats?.currentPacketLossRate || 0);
                const localAudioPacketLoss = Number(localAudioStats?.sendPacketsLost || localAudioStats?.currentPacketLossRate || 0);
                
                const remoteVideoPacketLoss = remoteVideoKeys.length > 0 ? 
                    (remoteVideoStats[remoteVideoKeys[0]]?.receivePacketsLost || remoteVideoStats[remoteVideoKeys[0]]?.packetLossRate || 0) : 0;
                const remoteAudioPacketLoss = remoteAudioKeys.length > 0 ? 
                    (remoteAudioStats[remoteAudioKeys[0]]?.receivePacketsLost || remoteAudioStats[remoteAudioKeys[0]]?.packetLossRate || 0) : 0;
                
                this.chartData.bitrate.push([time / 1000, validLocalVideoBitrate, validLocalAudioBitrate, validRemoteVideoBitrate, validRemoteAudioBitrate]);
                this.chartData.packetLoss.push([time / 1000, localVideoPacketLoss, localAudioPacketLoss, remoteVideoPacketLoss, remoteAudioPacketLoss]);
                
                // Debug logging
                console.log(`Network stats - Local Video: ${validLocalVideoBitrate.toFixed(1)}kbps, Local Audio: ${validLocalAudioBitrate.toFixed(1)}kbps, Remote Video: ${validRemoteVideoBitrate.toFixed(1)}kbps, Remote Audio: ${validRemoteAudioBitrate.toFixed(1)}kbps, Local Video PL: ${localVideoPacketLoss.toFixed(1)}%, Local Audio PL: ${localAudioPacketLoss.toFixed(1)}%, Remote Video PL: ${remoteVideoPacketLoss.toFixed(1)}%, Remote Audio PL: ${remoteAudioPacketLoss.toFixed(1)}%, Time: ${(time/1000).toFixed(1)}s`);
                
                // Debug: Check if we're getting valid audio data
                if (validLocalAudioBitrate > 0 || validRemoteAudioBitrate > 0) {
                    console.log('✅ Audio bitrate is working - Local:', validLocalAudioBitrate, 'Remote:', validRemoteAudioBitrate);
                    console.log('📊 Audio stats details:', remoteAudioKeys.length > 0 ? remoteAudioStats[remoteAudioKeys[0]] : 'No remote audio stats');
                } else {
                    console.log('❌ Audio bitrate is 0 - checking remoteAudioStats properties:', remoteAudioKeys.length > 0 ? Object.keys(remoteAudioStats[remoteAudioKeys[0]]) : 'No remote audio stats');
                }
                
                // Update charts
                this.updateCharts();
                
            } catch (error) {
                console.error('Network monitoring error:', error);
            }
        }, 1000);
        
        this.testStartTime = Date.now();
    }
    
    stopNetworkMonitoring() {
        if (this.networkInterval) {
            clearInterval(this.networkInterval);
            this.networkInterval = null;
        }
    }
    
    updateCharts() {
        if (this.bitrateChart && this.packetLossChart) {
            const bitrateOptions = {
                title: 'Bitrate (kbps)',
                hAxis: { title: 'Time (s)' },
                vAxis: { title: 'Bitrate (kbps)', minValue: 0 },
                backgroundColor: 'transparent',
                legend: { position: 'top' }
            };
            
            const packetLossOptions = {
                title: 'Packet Loss (%)',
                hAxis: { title: 'Time (s)' },
                vAxis: { title: 'Packet Loss (%)', minValue: 0, maxValue: 100 },
                backgroundColor: 'transparent',
                legend: { position: 'top' }
            };
            
            // Ensure we have valid data arrays
            const bitrateData = this.chartData.bitrate.length > 1 ? 
                this.chartData.bitrate : 
                [['Time', 'Local Video Bitrate', 'Local Audio Bitrate', 'Remote Video Bitrate', 'Remote Audio Bitrate'], [0, 0, 0, 0, 0]];
            
            const packetLossData = this.chartData.packetLoss.length > 1 ? 
                this.chartData.packetLoss : 
                [['Time', 'Local Video Packet Loss', 'Local Audio Packet Loss', 'Remote Video Packet Loss', 'Remote Audio Packet Loss'], [0, 0, 0, 0, 0]];
            
            try {
                this.bitrateChart.draw(google.visualization.arrayToDataTable(bitrateData), bitrateOptions);
                this.packetLossChart.draw(google.visualization.arrayToDataTable(packetLossData), packetLossOptions);
            } catch (error) {
                console.error('Chart update error:', error);
            }
        }
    }
    
    async analyzeCandidatePairs() {
        try {
            // Get the peer connection from the send client
            const pc = await this.sendClient._p2pChannel.connection.peerConnection;
            const stats = await pc.getStats();
            
            // Find transport stats
            const transport = [...stats.values()].find(r => r.type === 'transport' || r.type === 'ice-transport');
            const pair = transport?.selectedCandidatePairId
                ? stats.get(transport.selectedCandidatePairId)
                : null;
            
            // Fallback if a browser doesn't expose selectedCandidatePairId
            const selected = pair ||
                [...stats.values()].find(r =>
                    r.type === 'candidate-pair' &&
                    (r.nominated || r.state === 'succeeded' || r.selected === true)
                );
            
            if (!selected) {
                console.log('No selected candidate pair yet. iceConnectionState =', pc.iceConnectionState);
                return {
                    status: 'warning',
                    message: 'No candidate pair selected',
                    iceConnectionState: pc.iceConnectionState,
                    selectedPair: null,
                    localCandidate: null,
                    pathSummary: null
                };
            }
            
            const local = stats.get(selected.localCandidateId);
            console.log('Selected candidate pair:', selected);
            console.log('Local candidate:', local);
            
            const candType = local?.candidateType;
            const proto = local?.relayProtocol || local?.protocol;
            const localIP = local?.ip || local?.address;
            
            const pathSummary = `type=${candType}, protocol=${proto}, localIP=${localIP}`;
            console.log(`Path summary → ${pathSummary}`);
            
            return {
                status: 'success',
                message: 'Candidate pair analysis completed',
                selectedPair: selected,
                localCandidate: local,
                pathSummary: pathSummary,
                candidateType: candType,
                protocol: proto,
                localIP: localIP,
                iceConnectionState: pc.iceConnectionState
            };
            
        } catch (error) {
            console.error('Candidate pair analysis failed:', error);
            return {
                status: 'error',
                message: `Candidate pair analysis failed: ${error.message}`,
                selectedPair: null,
                localCandidate: null,
                pathSummary: null
            };
        }
    }
    
    async cleanupAgoraClients() {
        try {
            if (this.audioTrack) {
                this.audioTrack.close();
                this.audioTrack = null;
            }
            if (this.videoTrack) {
                this.videoTrack.close();
                this.videoTrack = null;
            }
            if (this.sendClient) {
                await this.sendClient.leave();
                this.sendClient = null;
            }
            if (this.recvClient) {
                await this.recvClient.leave();
                this.recvClient = null;
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }
    
    showTestReport() {
        this.isTesting = false;
        document.getElementById('testSteps').style.display = 'none';
        document.getElementById('testReport').style.display = 'block';
        document.getElementById('seeingIsBelieving').style.display = 'block';
        
        this.updateTestReport();
        this.showMessage('Test completed! Check the report below.', 'success');
    }
    
    updateTestReport() {
        const summary = document.getElementById('reportSummary');
        const details = document.getElementById('reportDetails');
        
        // Create summary (keep simple, no collapsible here)
        const summaryItems = Object.entries(this.testResults).map(([key, result]) => {
            const statusIcon = result.status === 'success' ? '✅' : 
                              result.status === 'warning' ? '⚠️' : '❌';
            const statusClass = result.status;
            
            return `
                <div class="summary-item ${statusClass}">
                    <div class="summary-title">${this.getTestName(key)}</div>
                    <div class="summary-status">${statusIcon}</div>
                    <div class="summary-description">${result.message}</div>
                </div>
            `;
        }).join('');
        
        summary.innerHTML = summaryItems;
        
        
        // Create detailed report
        const detailsContent = Object.entries(this.testResults).map(([key, result]) => {
            let detailContent = `<div class="report-section" data-details-key="${key}">
                <h4 class="collapsible-heading">
                    ${this.getTestName(key)}
                    <span class="collapse-arrow">▼</span>
                </h4>
                <div class="test-content">
                <p class="test-message">${result.message}</p>`;
            
            if (key === 'browser' && result.details) {
                detailContent += `
                    <div class="browser-details">
                        <div class="detail-item">
                            <span class="detail-label">Browser:</span>
                            <span class="detail-value">${result.details.browser}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Platform:</span>
                            <span class="detail-value">${result.details.platform}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">SDK Version:</span>
                            <span class="detail-value">${result.details.sdkVersion}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">User Agent:</span>
                            <span class="detail-value user-agent">${result.details.userAgent}</span>
                        </div>
                    </div>
                `;
            }
            
            if (key === 'resolution' && result.results) {
                detailContent += '<div class="resolution-results">';
                result.results.forEach(res => {
                    const icon = res.status === 'success' ? '✅' : 
                                res.status === 'warning' ? '⚠️' : '❌';
                    const statusClass = res.status;
                    detailContent += `
                        <div class="resolution-result ${statusClass}">
                            <span class="resolution-icon">${icon}</span>
                            <span class="resolution-text">${res.width} × ${res.height}</span>
                            ${res.actualWidth && res.actualHeight ? 
                                `<span class="resolution-actual">(Actual: ${res.actualWidth} × ${res.actualHeight})</span>` : ''}
                        </div>
                    `;
                });
                detailContent += '</div>';
            }
            
            if (key === 'network' && result.data) {
                // Show network charts in the report
                detailContent += `
                    <div class="network-charts-report">
                        <div class="chart-container-report">
                            <div id="reportBitrateChart"></div>
                        </div>
                        <div class="chart-container-report">
                            <div id="reportPacketLossChart"></div>
                        </div>
                    </div>
                    <div class="network-stats">
                        <div class="stat-item">
                            <span class="stat-label">Video Bitrate:</span>
                            <span class="stat-value">Send: ${(result.data.bitrate[1] || 0).toFixed(1)} kbps / Recv: ${(result.data.bitrate[3] || 0).toFixed(1)} kbps</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Audio Bitrate:</span>
                            <span class="stat-value">Send: ${(result.data.bitrate[2] || 0).toFixed(1)} kbps / Recv: ${(result.data.bitrate[4] || 0).toFixed(1)} kbps</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Video Packet Loss:</span>
                            <span class="stat-value">Send: ${(result.data.packetLoss[1] || 0).toFixed(1)}% / Recv: ${(result.data.packetLoss[3] || 0).toFixed(1)}%</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Audio Packet Loss:</span>
                            <span class="stat-value">Send: ${(result.data.packetLoss[2] || 0).toFixed(1)}% / Recv: ${(result.data.packetLoss[4] || 0).toFixed(1)}%</span>
                        </div>
                    </div>
                `;
                
                // Add candidate pair information if available
                if (result.candidatePair) {
                    const candidateData = result.candidatePair;
                    detailContent += `
                        <div class="candidate-pair-section">
                            <h5>Connection Path Analysis</h5>
                            <div class="candidate-pair-info">
                                <div class="candidate-status ${candidateData.status}">
                                    ${candidateData.status === 'success' ? '✅' : 
                                      candidateData.status === 'warning' ? '⚠️' : '❌'}
                                    ${candidateData.message}
                                </div>
                    `;
                    
                    if (candidateData.pathSummary) {
                        detailContent += `
                            <div class="path-details">
                                <div class="path-summary">
                                    <strong>Path Summary:</strong> ${candidateData.pathSummary}
                                </div>
                        `;
                        
                        if (candidateData.candidateType) {
                            detailContent += `
                                <div class="path-detail">
                                    <span class="detail-label">Candidate Type:</span>
                                    <span class="detail-value">${candidateData.candidateType}</span>
                                </div>
                            `;
                        }
                        
                        if (candidateData.protocol) {
                            detailContent += `
                                <div class="path-detail">
                                    <span class="detail-label">Protocol:</span>
                                    <span class="detail-value">${candidateData.protocol}</span>
                                </div>
                            `;
                        }
                        
                        if (candidateData.localIP) {
                            detailContent += `
                                <div class="path-detail">
                                    <span class="detail-label">Local IP:</span>
                                    <span class="detail-value">${candidateData.localIP}</span>
                                </div>
                            `;
                        }
                        
                        if (candidateData.iceConnectionState) {
                            detailContent += `
                                <div class="path-detail">
                                    <span class="detail-label">ICE Connection State:</span>
                                    <span class="detail-value">${candidateData.iceConnectionState}</span>
                                </div>
                            `;
                        }
                        
                        detailContent += `
                            </div>
                        `;
                    }
                    
                    detailContent += `
                            </div>
                        </div>
                    `;
                }
            }
            
            detailContent += `
                </div>
            </div>`;
            return detailContent;
        }).join('');
        
        details.innerHTML = detailsContent;
        
        // Add click handlers for collapsible functionality AFTER HTML is inserted
        setTimeout(() => {
            document.querySelectorAll('.collapsible-heading').forEach(heading => {
                heading.addEventListener('click', () => {
                    console.log('Heading clicked!');
                    const reportSection = heading.closest('.report-section');
                    const content = reportSection.querySelector('.test-content');
                    const arrow = heading.querySelector('.collapse-arrow');
                    
                    console.log('Report section:', reportSection);
                    console.log('Content:', content);
                    console.log('Arrow:', arrow);
                    
                    if (content && arrow) {
                        const isCollapsed = content.classList.contains('collapsed');
                        console.log('Is collapsed:', isCollapsed);
                        
                        if (isCollapsed) {
                            content.classList.remove('collapsed');
                            content.style.display = 'block';
                            arrow.textContent = '▼';
                            console.log('Expanding content');
                        } else {
                            content.classList.add('collapsed');
                            content.style.display = 'none';
                            arrow.textContent = '▲';
                            console.log('Collapsing content');
                        }
                    } else {
                        console.log('Content or arrow not found!');
                    }
                });
            });
        }, 100);
        
        // Initialize charts in the report if network data exists
        if (this.testResults.network && this.testResults.network.data) {
            setTimeout(() => {
                this.initializeReportCharts();
            }, 100);
        }
    }
    
    initializeReportCharts() {
        if (this.chartData.bitrate.length > 1 && this.chartData.packetLoss.length > 1) {
            const bitrateOptions = {
                title: 'Bitrate (kbps)',
                hAxis: { title: 'Time (s)' },
                vAxis: { title: 'Bitrate (kbps)', minValue: 0 },
                backgroundColor: 'transparent',
                legend: { position: 'top' },
                width: 400,
                height: 200
            };
            
            const packetLossOptions = {
                title: 'Packet Loss (%)',
                hAxis: { title: 'Time (s)' },
                vAxis: { title: 'Packet Loss (%)', minValue: 0, maxValue: 100 },
                backgroundColor: 'transparent',
                legend: { position: 'top' },
                width: 400,
                height: 200
            };
            
            try {
                const reportBitrateChart = new google.visualization.LineChart(document.getElementById('reportBitrateChart'));
                const reportPacketLossChart = new google.visualization.LineChart(document.getElementById('reportPacketLossChart'));
                
                reportBitrateChart.draw(google.visualization.arrayToDataTable(this.chartData.bitrate), bitrateOptions);
                reportPacketLossChart.draw(google.visualization.arrayToDataTable(this.chartData.packetLoss), packetLossOptions);
            } catch (error) {
                console.error('Report chart initialization error:', error);
            }
        }
    }
    
    getTestName(key) {
        const names = {
            browser: 'Browser Compatibility',
            microphone: 'Microphone',
            speaker: 'Speaker',
            resolution: 'Video Resolution',
            network: 'Network Connection'
        };
        return names[key] || key;
    }
    
    updateStep(step) {
        this.currentStep = step;
        
        // Update step indicator
        document.querySelectorAll('.step').forEach((stepEl, index) => {
            stepEl.classList.remove('active', 'completed');
            if (index === step) {
                stepEl.classList.add('active');
            } else if (index < step) {
                stepEl.classList.add('completed');
            }
        });
        
        // Update step panels
        document.querySelectorAll('.step-panel').forEach((panel, index) => {
            panel.classList.remove('active');
            if (index === step) {
                panel.classList.add('active');
            }
        });
        
    }
    
    
    nextStep() {
        this.currentStep++;
        if (this.currentStep < 5) {
            this.updateStep(this.currentStep);
        }
    }
    
    updateStepResult(elementId, message, type) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `<div class="step-result-${type}">${message}</div>`;
        }
    }
    
    showMessage(message, type = 'info') {
        const container = document.getElementById('statusMessages');
        const messageEl = document.createElement('div');
        messageEl.className = `status-message ${type}`;
        messageEl.textContent = message;
        
        container.appendChild(messageEl);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            messageEl.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 5000);
    }
    
    downloadLogs() {
        // Create a comprehensive log file with all test results and data
        const logData = {
            timestamp: new Date().toISOString(),
            appId: this.appId,
            channel: this.channel,
            userId: this.userId,
            token: this.token ? '***' : null, // Don't expose actual token
            cloudProxyEnabled: this.isCloudProxyEnabled,
            proxyMode: this.proxyMode,
            results: this.testResults,
            // Include all the detailed chart data that was collected
            chartData: {
                bitrate: this.chartData.bitrate,
                packetLoss: this.chartData.packetLoss
            },
            // Include browser and SDK info (no duplicates since testResults.browser.details has more info)
            browser: navigator.userAgent,
            sdkVersion: AgoraRTC.VERSION,
            // Include any live test data if available
            liveTestData: this.liveSendClient ? {
                hasLiveTest: true,
                liveStats: {
                    // Add any live monitoring data if needed
                }
            } : null
        };
        
        const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `webrtc-troubleshooting-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showMessage('Logs downloaded successfully', 'success');
    }
    
    shareReport() {
        const reportData = {
            timestamp: new Date().toISOString(),
            results: this.testResults,
            browser: navigator.userAgent,
            sdkVersion: AgoraRTC.VERSION
        };
        
        // Create a more detailed report text
        const reportText = `WebRTC Troubleshooting Report\n\n` +
            `Generated: ${new Date().toLocaleString()}\n` +
            `Browser: ${navigator.userAgent}\n` +
            `SDK Version: ${AgoraRTC.VERSION}\n` +
            `App ID: ${this.appId || 'Not set'}\n` +
            `Channel: ${this.channel || 'Not set'}\n\n` +
            `Test Results:\n` +
            Object.entries(this.testResults).map(([key, result]) => {
                let details = `${this.getTestName(key)}: ${result.status} - ${result.message}`;
                
                // Add more details for specific tests
                if (key === 'network' && result.data) {
                    const bitrate = result.data.bitrate;
                    const packetLoss = result.data.packetLoss;
                    if (bitrate && bitrate.length > 1) {
                        details += `\n  - Video Bitrate: Send ${(bitrate[1] || 0).toFixed(1)}kbps / Recv ${(bitrate[3] || 0).toFixed(1)}kbps`;
                        details += `\n  - Audio Bitrate: Send ${(bitrate[2] || 0).toFixed(1)}kbps / Recv ${(bitrate[4] || 0).toFixed(1)}kbps`;
                    }
                    if (packetLoss && packetLoss.length > 1) {
                        details += `\n  - Video Packet Loss: Send ${(packetLoss[1] || 0).toFixed(1)}% / Recv ${(packetLoss[3] || 0).toFixed(1)}%`;
                        details += `\n  - Audio Packet Loss: Send ${(packetLoss[2] || 0).toFixed(1)}% / Recv ${(packetLoss[4] || 0).toFixed(1)}%`;
                    }
                }
                
                if (key === 'resolution' && result.results) {
                    const successCount = result.results.filter(r => r.status === 'success').length;
                    details += `\n  - Supported Resolutions: ${successCount}/${result.results.length}`;
                }
                
                return details;
            }).join('\n\n');
        
        // Try native sharing first (works on mobile and some desktop browsers)
        if (navigator.share && navigator.canShare && navigator.canShare({ text: reportText })) {
            navigator.share({
                title: 'WebRTC Troubleshooting Report',
                text: reportText
            }).then(() => {
                this.showMessage('Report shared successfully', 'success');
            }).catch((error) => {
                console.log('Native sharing failed, falling back to clipboard:', error);
                this.fallbackToClipboard(reportText);
            });
        } else {
            // Fallback to clipboard
            this.fallbackToClipboard(reportText);
        }
    }
    
    fallbackToClipboard(reportText) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(reportText).then(() => {
                this.showMessage('Report copied to clipboard', 'success');
            }).catch(() => {
                this.showMessage('Could not copy to clipboard. Please copy manually.', 'error');
            });
        } else {
            // Last resort - show the text in an alert or prompt
            this.showMessage('Please copy the report text manually', 'warning');
            console.log('Report text:', reportText);
        }
    }
    
    resetTest() {
        this.isTesting = false;
        this.currentStep = 0;
        this.resetTestResults();
        
        // Reset UI
        document.getElementById('testConfig').style.display = 'block';
        document.getElementById('testSteps').style.display = 'none';
        document.getElementById('testReport').style.display = 'none';
        document.getElementById('seeingIsBelieving').style.display = 'none';
        
        // Reset step indicator
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active', 'completed');
        });
        document.querySelector('.step').classList.add('active');
        
        // Reset step panels
        document.querySelectorAll('.step-panel').forEach((panel, index) => {
            panel.classList.remove('active');
            if (index === 0) {
                panel.classList.add('active');
            }
        });
        
        // Reset charts
        this.chartData = {
            bitrate: [['Time', 'Local Video Bitrate', 'Local Audio Bitrate', 'Remote Video Bitrate', 'Remote Audio Bitrate']],
            packetLoss: [['Time', 'Local Video Packet Loss', 'Local Audio Packet Loss', 'Remote Video Packet Loss', 'Remote Audio Packet Loss']]
        };
        
        this.showMessage('Test reset successfully', 'info');
    }
    
    closeModal() {
        document.getElementById('liveTestModal').style.display = 'none';
    }
    
    closeDeviceModal() {
        document.getElementById('deviceSelectionModal').style.display = 'none';
        // Stop any preview video
        this.stopDevicePreview();
    }
    
    endLiveTest() {
        this.closeModal();
        this.showMessage('Live test ended', 'info');
    }
    
    async showDeviceSelection() {
        try {
            // Show the device selection modal
            document.getElementById('deviceSelectionModal').style.display = 'flex';
            
            // Enumerate devices
            await this.enumerateDevices();
            
            // Set up device change listeners
            this.setupDeviceChangeListeners();
            
        } catch (error) {
            console.error('Error showing device selection:', error);
            this.showMessage(`Error accessing devices: ${error.message}`, 'error');
        }
    }
    
    async enumerateDevices() {
        try {
            // Get available devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            // Filter cameras and microphones
            const cameras = devices.filter(device => device.kind === 'videoinput');
            const microphones = devices.filter(device => device.kind === 'audioinput');
            
            // Populate camera dropdown
            const cameraSelect = document.getElementById('cameraSelect');
            cameraSelect.innerHTML = '<option value="">Select a camera...</option>';
            
            cameras.forEach((camera, index) => {
                const option = document.createElement('option');
                option.value = camera.deviceId;
                option.textContent = camera.label || `Camera ${index + 1}`;
                cameraSelect.appendChild(option);
            });
            
            // Populate microphone dropdown
            const microphoneSelect = document.getElementById('microphoneSelect');
            microphoneSelect.innerHTML = '<option value="">Select a microphone...</option>';
            
            microphones.forEach((microphone, index) => {
                const option = document.createElement('option');
                option.value = microphone.deviceId;
                option.textContent = microphone.label || `Microphone ${index + 1}`;
                microphoneSelect.appendChild(option);
            });
            
            // Auto-select first devices if available
            if (cameras.length > 0) {
                cameraSelect.value = cameras[0].deviceId;
                this.updateDevicePreview();
            }
            if (microphones.length > 0) {
                microphoneSelect.value = microphones[0].deviceId;
            }
            
        } catch (error) {
            console.error('Error enumerating devices:', error);
            this.showMessage('Could not access device list. Please check permissions.', 'error');
        }
    }
    
    setupDeviceChangeListeners() {
        const cameraSelect = document.getElementById('cameraSelect');
        const microphoneSelect = document.getElementById('microphoneSelect');
        
        cameraSelect.addEventListener('change', () => {
            this.updateDevicePreview();
        });
        
        // Microphone selection doesn't need preview, but we can log it
        microphoneSelect.addEventListener('change', () => {
            console.log('Selected microphone:', microphoneSelect.value);
        });
    }
    
    async updateDevicePreview() {
        const cameraSelect = document.getElementById('cameraSelect');
        const selectedCameraId = cameraSelect.value;
        
        if (!selectedCameraId) {
            // Show placeholder
            const preview = document.getElementById('devicePreview');
            preview.innerHTML = `
                <div class="preview-placeholder">
                    <span>📹</span>
                    <p>Camera preview will appear here</p>
                </div>
            `;
            return;
        }
        
        try {
            // Stop any existing preview
            this.stopDevicePreview();
            
            // Create new preview stream
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: selectedCameraId } },
                audio: false
            });
            
            // Create video element
            const video = document.createElement('video');
            video.srcObject = stream;
            video.autoplay = true;
            video.muted = true;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'cover';
            
            // Update preview container
            const preview = document.getElementById('devicePreview');
            preview.innerHTML = '';
            preview.appendChild(video);
            
            // Store stream for cleanup
            this.devicePreviewStream = stream;
            
        } catch (error) {
            console.error('Error creating device preview:', error);
            const preview = document.getElementById('devicePreview');
            preview.innerHTML = `
                <div class="preview-placeholder">
                    <span>❌</span>
                    <p>Could not access selected camera</p>
                </div>
            `;
        }
    }
    
    stopDevicePreview() {
        if (this.devicePreviewStream) {
            this.devicePreviewStream.getTracks().forEach(track => track.stop());
            this.devicePreviewStream = null;
        }
    }
    
    async confirmDeviceSelection() {
        const cameraSelect = document.getElementById('cameraSelect');
        const microphoneSelect = document.getElementById('microphoneSelect');
        
        const selectedCamera = cameraSelect.value;
        const selectedMicrophone = microphoneSelect.value;
        
        if (!selectedCamera || !selectedMicrophone) {
            this.showMessage('Please select both a camera and microphone', 'warning');
            return;
        }
        
        // Store selected devices
        this.selectedCameraId = selectedCamera;
        this.selectedMicrophoneId = selectedMicrophone;
        
        // Close device selection modal
        this.closeDeviceModal();
        
        // Start live test with selected devices
        await this.startLiveTestWithDevices();
    }
    
    async startLiveTestWithDevices() {
        try {
            this.showMessage('Starting live test with selected devices...', 'info');
            
            // Initialize live test clients
            this.liveSendClient = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
            this.liveRecvClient = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
            
            // Set client roles
            await this.liveSendClient.setClientRole('host');
            await this.liveRecvClient.setClientRole('audience');
            
            // Setup cloud proxy if enabled
            if (this.isCloudProxyEnabled) {
                await this.liveSendClient.startProxyServer(this.proxyMode);
                await this.liveRecvClient.startProxyServer(this.proxyMode);
            }
            
            // Create tracks with selected devices
            const [liveAudioTrack, liveVideoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
                { microphoneId: this.selectedMicrophoneId },
                { 
                    cameraId: this.selectedCameraId,
                    encoderConfig: '720p_2' 
                }
            );
            
            this.liveAudioTrack = liveAudioTrack;
            this.liveVideoTrack = liveVideoTrack;
            
            // Play local video
            liveVideoTrack.play('localVideo');
            
            // Join channels
            const liveSendUid = Math.floor(Math.random() * 100000) + 300000;
            const liveRecvUid = Math.floor(Math.random() * 100000) + 400000;
            
            await this.liveSendClient.join(this.appId, this.channel + '_live', this.token, liveSendUid);
            await this.liveRecvClient.join(this.appId, this.channel + '_live', this.token, liveRecvUid);
            
            // Publish tracks
            await this.liveSendClient.publish([liveAudioTrack, liveVideoTrack]);
            
            // Setup remote user handling
            this.liveRecvClient.on('user-published', async (user, mediaType) => {
                await this.liveRecvClient.subscribe(user, mediaType);
                if (mediaType === 'video') {
                    user.videoTrack.play('remoteVideo');
                }
            });
            
            // Start live monitoring
            this.startLiveMonitoring();
            
            // Update UI
            document.getElementById('startLiveTestBtn').style.display = 'none';
            document.getElementById('stopLiveTestBtn').style.display = 'inline-block';
            
            this.showMessage('Live test started! You should see your local video and remote video.', 'success');
            
        } catch (error) {
            console.error('Live test failed:', error);
            this.showMessage(`Live test failed: ${error.message}`, 'error');
        }
    }
    
    
    startLiveMonitoring() {
        this.liveMonitorInterval = setInterval(async () => {
            try {
                const sendStats = await this.liveSendClient.getRTCStats();
                const recvStats = await this.liveRecvClient.getRTCStats();
                const localAudioStats = await this.liveSendClient.getLocalAudioStats();
                const localVideoStats = await this.liveSendClient.getLocalVideoStats();
                const remoteVideoStats = await this.liveRecvClient.getRemoteVideoStats();
                const remoteAudioStats = await this.liveRecvClient.getRemoteAudioStats();
                
                // Debug logging to see what stats we're getting
                console.log('Send Stats:', sendStats);
                console.log('Local Audio Stats:', localAudioStats);
                console.log('Local Video Stats:', localVideoStats);
                console.log('Remote Video Stats:', remoteVideoStats);
                console.log('Remote Audio Stats:', remoteAudioStats);

                // Stats logging function for debugging
                await this.updateStats(this.liveSendClient, this.liveRecvClient);
                
                // Calculate all 4 bitrates for live monitoring
                const localVideoKeys = Object.keys(localVideoStats);
                const localAudioKeys = Object.keys(localAudioStats);
                const remoteVideoKeys = Object.keys(remoteVideoStats);
                const remoteAudioKeys = Object.keys(remoteAudioStats);
                
                // Local video bitrate - read directly from the flat object
                let localVideoBitrate = Number(localVideoStats?.sendBitrate || 0) * 0.001;
                
                // Local audio bitrate - read directly from the flat object
                let localAudioBitrate = Number(localAudioStats?.sendBitrate || 0) * 0.001;
                
                // Remote video bitrate
                let remoteVideoBitrate = 0;
                if (remoteVideoKeys.length > 0) {
                    remoteVideoBitrate = Number(remoteVideoStats[remoteVideoKeys[0]]?.receiveBitrate || remoteVideoStats[remoteVideoKeys[0]]?.bitrate || 0) * 0.001;
                }
                
                // Remote audio bitrate
                let remoteAudioBitrate = 0;
                if (remoteAudioKeys.length > 0) {
                    remoteAudioBitrate = Number(remoteAudioStats[remoteAudioKeys[0]]?.receiveBitrate || remoteAudioStats[remoteAudioKeys[0]]?.bitrate || 0) * 0.001;
                }
                
                // Ensure we have valid numbers
                const validLocalVideoBitrate = isNaN(localVideoBitrate) || localVideoBitrate < 0 ? 0 : Math.max(0, localVideoBitrate);
                const validLocalAudioBitrate = isNaN(localAudioBitrate) || localAudioBitrate < 0 ? 0 : Math.max(0, localAudioBitrate);
                const validRemoteVideoBitrate = isNaN(remoteVideoBitrate) || remoteVideoBitrate < 0 ? 0 : Math.max(0, remoteVideoBitrate);
                const validRemoteAudioBitrate = isNaN(remoteAudioBitrate) || remoteAudioBitrate < 0 ? 0 : Math.max(0, remoteAudioBitrate);
                
                // Calculate packet loss - both local and remote
                const localVideoPacketLoss = Number(localVideoStats?.sendPacketsLost || localVideoStats?.currentPacketLossRate || 0);
                const localAudioPacketLoss = Number(localAudioStats?.sendPacketsLost || localAudioStats?.currentPacketLossRate || 0);
                
                const remoteVideoPacketLoss = remoteVideoKeys.length > 0 ? 
                    (remoteVideoStats[remoteVideoKeys[0]]?.receivePacketsLost || remoteVideoStats[remoteVideoKeys[0]]?.packetLossRate || 0) : 0;
                const remoteAudioPacketLoss = remoteAudioKeys.length > 0 ? 
                    (remoteAudioStats[remoteAudioKeys[0]]?.receivePacketsLost || remoteAudioStats[remoteAudioKeys[0]]?.packetLossRate || 0) : 0;
                
                // Debug the calculated values
                console.log(`Live stats - Local Video: ${validLocalVideoBitrate.toFixed(1)}kbps, Local Audio: ${validLocalAudioBitrate.toFixed(1)}kbps, Remote Video: ${validRemoteVideoBitrate.toFixed(1)}kbps, Remote Audio: ${validRemoteAudioBitrate.toFixed(1)}kbps, Local Video PL: ${localVideoPacketLoss.toFixed(1)}%, Local Audio PL: ${localAudioPacketLoss.toFixed(1)}%, Remote Video PL: ${remoteVideoPacketLoss.toFixed(1)}%, Remote Audio PL: ${remoteAudioPacketLoss.toFixed(1)}%`);
                
                // Debug: Check if we're getting valid audio data
                if (validLocalAudioBitrate > 0 || validRemoteAudioBitrate > 0) {
                    console.log('✅ Live Audio bitrate is working - Local:', validLocalAudioBitrate, 'Remote:', validRemoteAudioBitrate);
                } else {
                    console.log('❌ Live Audio bitrate is 0 - checking remoteAudioStats properties:', remoteAudioKeys.length > 0 ? Object.keys(remoteAudioStats[remoteAudioKeys[0]]) : 'No remote audio stats');
                }
                
                // Update live stats display
                const liveVideoBitrateEl = document.getElementById('liveVideoBitrate');
                const liveAudioBitrateEl = document.getElementById('liveAudioBitrate');
                const liveVideoPacketLossEl = document.getElementById('liveVideoPacketLoss');
                const liveAudioPacketLossEl = document.getElementById('liveAudioPacketLoss');
                
                console.log('DOM elements found:', {
                    liveVideoBitrateEl,
                    liveAudioBitrateEl,
                    liveVideoPacketLossEl,
                    liveAudioPacketLossEl
                });
                
                if (liveVideoBitrateEl) {
                    liveVideoBitrateEl.textContent = `Send: ${validLocalVideoBitrate.toFixed(1)} / Recv: ${validRemoteVideoBitrate.toFixed(1)} kbps`;
                } else {
                    console.error('liveVideoBitrate element not found');
                }
                
                if (liveAudioBitrateEl) {
                    liveAudioBitrateEl.textContent = `Send: ${validLocalAudioBitrate.toFixed(1)} / Recv: ${validRemoteAudioBitrate.toFixed(1)} kbps`;
                } else {
                    console.error('liveAudioBitrate element not found');
                }
                
                if (liveVideoPacketLossEl) {
                    liveVideoPacketLossEl.textContent = `Send: ${localVideoPacketLoss.toFixed(1)}% / Recv: ${remoteVideoPacketLoss.toFixed(1)}%`;
                } else {
                    console.error('liveVideoPacketLoss element not found');
                }
                
                if (liveAudioPacketLossEl) {
                    liveAudioPacketLossEl.textContent = `Send: ${localAudioPacketLoss.toFixed(1)}% / Recv: ${remoteAudioPacketLoss.toFixed(1)}%`;
                } else {
                    console.error('liveAudioPacketLoss element not found');
                }
                
            } catch (error) {
                console.error('Live monitoring error:', error);
            }
        }, 1000);
    }
    
    async stopLiveTest() {
        try {
            // Stop monitoring
            if (this.liveMonitorInterval) {
                clearInterval(this.liveMonitorInterval);
                this.liveMonitorInterval = null;
            }
            
            // Clean up tracks
            if (this.liveAudioTrack) {
                this.liveAudioTrack.close();
                this.liveAudioTrack = null;
            }
            if (this.liveVideoTrack) {
                this.liveVideoTrack.close();
                this.liveVideoTrack = null;
            }
            
            // Leave channels
            if (this.liveSendClient) {
                await this.liveSendClient.leave();
                this.liveSendClient = null;
            }
            if (this.liveRecvClient) {
                await this.liveRecvClient.leave();
                this.liveRecvClient = null;
            }
            
            // Update UI
            document.getElementById('startLiveTestBtn').style.display = 'inline-block';
            document.getElementById('stopLiveTestBtn').style.display = 'none';
            
            // Clear video containers
            document.getElementById('localVideo').innerHTML = '';
            document.getElementById('remoteVideo').innerHTML = '';
            
            // Reset stats
            document.getElementById('liveVideoBitrate').textContent = '0 kbps';
            document.getElementById('liveAudioBitrate').textContent = '0 kbps';
            document.getElementById('liveVideoPacketLoss').textContent = '0%';
            document.getElementById('liveAudioPacketLoss').textContent = '0%';
            
            this.showMessage('Live test stopped', 'info');
            
        } catch (error) {
            console.error('Error stopping live test:', error);
            this.showMessage(`Error stopping live test: ${error.message}`, 'error');
        }
    }
    
    async updateStats(sendClient, recvClient) {
        try {
            // Local stats (by track ID)
            const localVideoStats = await sendClient.getLocalVideoStats();
            const localAudioStats = await sendClient.getLocalAudioStats();

            console.log("📹 Local Video Stats:");
            Object.entries(localVideoStats).forEach(([trackId, stats]) => {
                console.log(`TrackID: ${trackId}`, stats);
            });

            console.log("🎤 Local Audio Stats:");
            Object.entries(localAudioStats).forEach(([trackId, stats]) => {
                console.log(`TrackID: ${trackId}`, stats);
            });

            // Remote stats (by UID)
            const remoteVideoStats = await recvClient.getRemoteVideoStats();
            const remoteAudioStats = await recvClient.getRemoteAudioStats();

            console.log("📥 Remote Video Stats:");
            Object.entries(remoteVideoStats).forEach(([uid, stats]) => {
                console.log(`UID: ${uid}`, stats);
            });

            console.log("🔈 Remote Audio Stats:");
            Object.entries(remoteAudioStats).forEach(([uid, stats]) => {
                console.log(`UID: ${uid}`, stats);
            });

        } catch (err) {
            console.error("Error fetching stats:", err);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.webrtcTroubleshooting = new WebRTCTroubleshooting();
});
