
class SimpleFibonacciImprover {
    improveSignal(price, fibLevels, signals) {
        const confidence = this.calculateConfidence(price, fibLevels);
        return {
            confidence: confidence,
            reliable: confidence > 80, // 80% أو أكثر
            signals: signals
        };
    }
    
    calculateConfidence(price, levels) {
        let closestDistance = Infinity;
        Object.values(levels.retracements).forEach(level => {
            const distance = Math.abs(price - level) / price * 100;
            if (distance < closestDistance) {
                closestDistance = distance;
            }
        });
        
        return Math.max(10, 100 - (closestDistance * 20));
    }
}

// إنشاء المحسن
const fibImprover = new SimpleFibonacciImprover();
class FibonacciIndicator {
    constructor() {
        this.currentExchange = 'binance';
        this.coins = [];
        this.filteredCoins = [];
        this.currentFilter = 'all';
         // إضافة متغيرات التتبع الجديدة ← هنا
    this.trackedBreakouts = JSON.parse(localStorage.getItem('trackedBreakouts')) || [];
    this.trackedBreakdowns = JSON.parse(localStorage.getItem('trackedBreakdowns')) || [];
        // مستويات فيبوناتشي المصححة
        this.fibonacciRetracements = [0, 23.6, 38.2, 50, 61.8, 76.4, 100];
        this.fibonacciExtensions = [61.8, 100, 138.2, 161.8, 200, 261.8];
        
        // قائمة العملات المستقرة المستبعدة
        this.stableCoins = [
            'USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'USDD', 'FRAX',
            'LUSD', 'SUSD', 'GUSD', 'HUSD', 'USDN', 'RSR', 'USTC', 'USDX',
            'CUSD', 'DUSD', 'MUSD', 'NUSD', 'OUSD', 'PUSD', 'RUSD', 'SUSD',
            'VUSD', 'WUSD', 'XUSD', 'YUSD', 'ZUSD', 'FDUSD', 'PYUSD','DAI'
        ];
        
        this.init();
    }
    parseChangePercent(changePercent) {
    try {
        if (changePercent === null || changePercent === undefined || changePercent === '') {
            return 0;
        }
        
        let change = parseFloat(changePercent);
        
        if (Math.abs(change) <= 1) {
            change = change * 100;
        }
        
        return isNaN(change) ? 0 : change;
    } catch (error) {
        console.warn('خطأ في تحليل نسبة التغيير:', changePercent);
        return 0;
    }
}

init() {
    this.bindEvents();
    this.loadData();
        
        // تحديث البيانات كل 5 دقائق (300000 مللي ثانية)
        setInterval(() => {
            this.loadData();
        }, 300000);
    }
    
    bindEvents() {
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadData();
        });
        
        document.getElementById('exchangeSelect').addEventListener('change', (e) => {
            this.currentExchange = e.target.value;
            this.loadData();
        });
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });
    }
    
    // فلترة العملات المستقرة
    isStableCoin(symbol) {
        const coinName = symbol.replace('USDT', '').replace('-USDT', '');
        return this.stableCoins.includes(coinName.toUpperCase());
    }
    
    async loadData() {
        this.showLoading(true);
        this.hideError();
        
        try {
            let data;
            if (this.currentExchange === 'binance') {
                data = await this.fetchBinanceData();
            } else {
                data = await this.fetchOKXData();
            }
            
            this.processData(data);
            this.renderCards();
            this.updateStats();
            
            // إشعار بنجاح التحديث
            NotificationManager.show('تم تحديث البيانات بنجاح', 'success');
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError();
            NotificationManager.show('فشل في تحميل البيانات', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    async fetchBinanceData() {
        const response = await fetch('https://api1.binance.com/api/v3/ticker/24hr');
        if (!response.ok) throw new Error('Failed to fetch Binance data');
        
        const data = await response.json();
        
        // فلترة العملات USDT فقط واستبعاد العملات المستقرة
        const usdtPairs = data.filter(coin => 
            coin.symbol.endsWith('USDT') && 
            !this.isStableCoin(coin.symbol) && // استبعاد العملات المستقرة
            parseFloat(coin.volume) > 1000000 && // حجم تداول أكبر من مليون
            parseFloat(coin.priceChangePercent) !== 0 &&
            parseFloat(coin.lastPrice) > 0.001 // استبعاد العملات ذات القيمة المنخفضة جداً
        );
        
        // الحصول على بيانات الشموع للتحليل الفني
        const processedData = await Promise.all(
            usdtPairs.slice(0, 100).map(async (coin) => {
                try {
                    const klineData = await this.fetchKlineData(coin.symbol, 'binance');
                    return {
                        symbol: coin.symbol,
                        price: parseFloat(coin.lastPrice),
                        change: parseFloat(coin.priceChangePercent),
                        volume: parseFloat(coin.volume),
                        high24h: parseFloat(coin.highPrice),
                        low24h: parseFloat(coin.lowPrice),
                        klineData: klineData
                    };
                } catch (error) {
                    console.error(`Error processing ${coin.symbol}:`, error);
                    return null;
                }
            })
        );
        
        return processedData.filter(coin => coin !== null);
    }
    
   async fetchOKXData() {
    const response = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT');
    if (!response.ok) throw new Error('Failed to fetch OKX data');

    const result = await response.json();
    const data = result.data;

    // فلترة العملات USDT فقط واستبعاد العملات المستقرة
    const usdtPairs = data.filter(coin => 
        coin.instId.endsWith('-USDT') &&
        !this.isStableCoin(coin.instId) &&
        parseFloat(coin.vol24h) > 1000000 &&
        parseFloat(coin.last) > 0.001
    );

    // معالجة تدريجية لتجنب 429
    const processedData = [];
    const batchSize = 3; // 3 عملات فقط في المرة
    const delayMs = 2000; // ثانيتين تأخير

    for (let i = 0; i < Math.min(30, usdtPairs.length); i += batchSize) {
        const batch = usdtPairs.slice(i, i + batchSize);
        
        console.log(`📊 معالجة مجموعة ${Math.floor(i/batchSize) + 1} من ${Math.ceil(Math.min(30, usdtPairs.length)/batchSize)}`);
        
        for (const coin of batch) {
            try {
                await new Promise(resolve => setTimeout(resolve, 500)); // تأخير بين كل عملة
                const klineData = await this.fetchKlineData(coin.instId, 'okx');
                
                processedData.push({
                    symbol: coin.instId,
                    price: parseFloat(coin.last),
                    change: this.parseChangePercent(coin.changePercent),
                    volume: parseFloat(coin.vol24h),
                    high24h: parseFloat(coin.high24h),
                    low24h: parseFloat(coin.low24h),
                    klineData: klineData
                });
            } catch (error) {
                console.warn(`⚠️ تخطي ${coin.instId}:`, error.message);
            }
        }
        
        // تأخير بين المجموعات
        if (i + batchSize < Math.min(30, usdtPairs.length)) {
            console.log(`⏳ تأخير ${delayMs/1000} ثانية...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    return processedData;
}

    
    async fetchKlineData(symbol, exchange) {
         // قائمة العملات المُشكِلة التي نتجاهلها
    const problematicCoins = ['SWEAT-USDT', 'LUNC-USDT', 'USTC-USDT'];
    
    if (problematicCoins.includes(symbol)) {
        console.warn(`⚠️ تجاهل العملة المُشكِلة: ${symbol}`);
        return [];
    }
        try {
            let url;
            if (exchange === 'binance') {
                url = `https://api1.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=100`;
            } else {
                url = `https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=1D&limit=100`;
            }
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch kline data for ${symbol}`);
            
            const data = await response.json();
            
            if (exchange === 'binance') {
                return data.map(candle => ({
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4])
                }));
            } else {
                return data.data.map(candle => ({
                    high: parseFloat(candle[2]),
                    low: parseFloat(candle[3]),
                    close: parseFloat(candle[4])
                }));
            }
        } catch (error) {
            console.error(`Error fetching kline data for ${symbol}:`, error);
            return [];
        }
    }
    
calculateFibonacciLevels(high, low, currentPrice) {
        const range = high - low;
        const levels = {
            retracements: {},
            extensions: {},
            signals: []
        };
        
        // حساب مستويات التصحيح
        this.fibonacciRetracements.forEach(ratio => {
            const level = high - (range * ratio / 100);
            levels.retracements[ratio] = level;
        });
        
        // حساب مستويات الامتداد
        this.fibonacciExtensions.forEach(ratio => {
            const level = high + (range * (ratio - 100) / 100);
            levels.extensions[ratio] = level;
        });
        
        // تحديد الإشارات
        const tolerance = currentPrice * 0.005; // 0.5% tolerance
        
        // فحص اختراق المقاومة (مستويات التصحيح)
        for (let ratio of this.fibonacciRetracements) {
            const level = levels.retracements[ratio];
            if (currentPrice > level && currentPrice <= level + tolerance) {
                // العثور على المستوى التالي
                const nextLevel = this.getNextResistanceLevel(ratio, levels.retracements, levels.extensions);
                levels.signals.push({
                    type: 'resistance_break',
                    level: ratio,
                    price: level,
                    nextTarget: nextLevel
                });
                break;
            }
        }
        
        // فحص كسر الدعم (مستويات التصحيح)
        for (let ratio of this.fibonacciRetracements.reverse()) {
            const level = levels.retracements[ratio];
            if (currentPrice < level && currentPrice >= level - tolerance) {
                // العثور على المستوى التالي
                const nextLevel = this.getNextSupportLevel(ratio, levels.retracements);
                levels.signals.push({
                    type: 'support_break',
                    level: ratio,
                    price: level,
                    nextTarget: nextLevel
                });
                break;
            }
        }
        
        this.fibonacciRetracements.reverse(); // إعادة الترتيب الأصلي
        
        return levels;
    }
    
   getNextResistanceLevel(currentRatio, retracements, extensions) {
    const ratios = this.fibonacciRetracements.sort((a, b) => a - b);
    const currentIndex = ratios.indexOf(currentRatio);
    
    // للمقاومة: نريد المستوى التالي للأعلى (رقم أصغر = سعر أعلى)
    for (let i = currentIndex - 1; i >= 0; i--) {
        const nextRatio = ratios[i];
        const nextPrice = retracements[nextRatio];
        
        // التأكد أن السعر التالي أعلى من الحالي
        if (nextPrice > retracements[currentRatio]) {
            return {
                type: 'retracement',
                ratio: nextRatio,
                price: nextPrice
            };
        }
    }
    
    // إذا لم نجد في التصحيحات، نجرب الامتدادات
    if (extensions) {
        const extRatios = this.fibonacciExtensions.sort((a, b) => a - b);
        for (let ratio of extRatios) {
            const extPrice = extensions[ratio];
            if (extPrice && extPrice > retracements[currentRatio]) {
                return {
                    type: 'extension',
                    ratio: ratio,
                    price: extPrice
                };
            }
        }
    }
    
    return null;
}

    
   getNextSupportLevel(currentRatio, retracements) {
    const ratios = this.fibonacciRetracements.sort((a, b) => a - b);
    const currentIndex = ratios.indexOf(currentRatio);
    
    // للدعم: نريد المستوى التالي للأسفل (رقم أكبر = سعر أقل)
    for (let i = currentIndex + 1; i < ratios.length; i++) {
        const nextRatio = ratios[i];
        const nextPrice = retracements[nextRatio];
        
        // التأكد أن السعر التالي أقل من الحالي
        if (nextPrice < retracements[currentRatio]) {
            return {
                type: 'retracement',
                ratio: nextRatio,
                price: nextPrice
            };
        }
    }
    
    return null;
}

    
    processData(data) {
        // فلترة العملات المستقرة والأخطاء
    const filteredData = data.filter(coin => {
        // استبعاد العملات المستقرة
        const stableCoins = ['DAI', 'USDC', 'USDT', 'BUSD', 'TUSD', 'FRAX'];
        const cleanSymbol = coin.symbol.replace('-USDT', '').replace('USDT', '');
        
        if (stableCoins.includes(cleanSymbol)) {
            return false;
        }
        
        // استبعاد العملات ذات البيانات الخاطئة
        if (!coin.klineData || coin.klineData.length < 50) {
            return false;
        }
        
        return true;
    });
        this.coins = data.map(coin => {
            if (!coin.klineData || coin.klineData.length < 20) {
                return { ...coin, fibonacciData: null, signals: [] };
            }
            
            // حساب أعلى وأقل سعر في آخر 50 شمعة
            const recentData = coin.klineData.slice(-50);
            const high = Math.max(...recentData.map(candle => candle.high));
            const low = Math.min(...recentData.map(candle => candle.low));
            
            const fibonacciData = this.calculateFibonacciLevels(high, low, coin.price);

// إضافة التحسين هنا
const improved = fibImprover.improveSignal(coin.price, fibonacciData, fibonacciData.signals);
fibonacciData.confidence = improved.confidence;
fibonacciData.reliable = improved.reliable;

// فقط إظهار الإشارات الموثوقة
if (!improved.reliable) {
    fibonacciData.signals = []; // إخفاء الإشارات الضعيفة
}
            
            return {
                ...coin,
                fibonacciData,
                signals: fibonacciData.signals,
                high52w: high,
                low52w: low
            };
        }).filter(coin => coin.signals && coin.signals.length > 0);
        
        this.applyFilter();
    }
    
    setFilter(filter) {
        this.currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        this.applyFilter();
        this.renderCards();
    }
    
    applyFilter() {
        switch (this.currentFilter) {
            case 'resistance':
                this.filteredCoins = this.coins.filter(coin => 
                    coin.signals.some(signal => signal.type === 'resistance_break')
                );
                break;
            case 'support':
                this.filteredCoins = this.coins.filter(coin => 
                    coin.signals.some(signal => signal.type === 'support_break')
                );
                break;
            default:
                this.filteredCoins = this.coins;
        }
    }
    
    renderCards() {
        const grid = document.getElementById('cardsGrid');
        grid.innerHTML = '';
        
        this.filteredCoins.forEach(coin => {
            const card = this.createCoinCard(coin);
            grid.appendChild(card);
        });
    }
    
   // تحديث دالة إنشاء البطاقة مع تحسين التنسيق
createCoinCard(coin) {
    const card = document.createElement('div');
    const signal = coin.signals[0];
    const signalClass = signal.type === 'resistance_break' ? 'resistance-break' : 'support-break';
    
    card.className = `coin-card ${signalClass}`;
    
    const changeClass = coin.change >= 0 ? 'change-positive' : 'change-negative';
    const changeSymbol = coin.change >= 0 ? '+' : '';
    
    const signalText = signal.type === 'resistance_break' ? 'اختراق مقاومة' : 'كسر دعم';
    const signalBadgeClass = signal.type === 'resistance_break' ? 'signal-resistance' : 'signal-support';
    
   const cleanSymbol = coin.symbol.replace('-USDT', '').replace('USDT', '').replace('-', '');

    
    card.innerHTML = `
       <div class="signal-badge ${signalBadgeClass}">
    ${signalText} 
    <span style="background: #00ff00; color: black; padding: 2px 6px; border-radius: 10px; font-size: 0.8em; margin-right: 5px;">
        ${Math.round(coin.fibonacciData.confidence)}%
    </span>
</div>

        
        <div class="coin-header">
            <div class="coin-name">${cleanSymbol}</div>
            <div class="coin-price">$${this.formatPrice(coin.price)}</div>
        </div>
        
        <div class="coin-info">
            <div class="info-item">
                <div class="info-label">نسبة التغيير</div>
                <div class="info-value ${changeClass}">${changeSymbol}${coin.change.toFixed(2)}%</div>
            </div>
            <div class="info-item">
                <div class="info-label">الحجم</div>
                <div class="info-value">${this.formatVolume(coin.volume)}</div>
            </div>
            <div class="info-item">
                <div class="info-label">المستوى الحالي</div>
                <div class="info-value">${signal.level}%</div>
            </div>
            <div class="info-item">
                <div class="info-label">سعر المستوى</div>
                <div class="info-value">$${this.formatPrice(signal.price)}</div>
            </div>
        </div>
        
        <div class="fibonacci-info">
            <div class="fibonacci-level">
                <span class="level-name">الهدف التالي</span>
                <span class="level-value">${signal.nextTarget ? signal.nextTarget.ratio + '%' : 'غير محدد'}</span>
            </div>
            ${signal.nextTarget ? `
            <div class="fibonacci-level">
                <span class="level-name">سعر الهدف</span>
               <span class="level-value">
    ${signal.nextTarget.price ? '$' + this.formatPrice(signal.nextTarget.price) : '$' + this.formatPrice(coin.low52w)}
</span>

            </div>
            <div class="fibonacci-level">
                <span class="level-name">نوع المستوى</span>
                <span class="level-value">${signal.nextTarget.type === 'retracement' ? 'تصحيح' : 'امتداد'}</span>
            </div>
            <div class="fibonacci-level">
                <span class="level-name">الربح المحتمل</span>
                <span class="level-value ${this.calculatePotentialProfit(coin.price, signal.nextTarget.price).startsWith('+') ? 'change-positive' : 'change-negative'}">${this.calculatePotentialProfit(coin.price, signal.nextTarget.price)}%</span>
            </div>
            ` : ''}
            <div class="fibonacci-level">
                <span class="level-name">أعلى سعر (50 يوم)</span>
                <span class="level-value">$${this.formatPrice(coin.high52w)}</span>
            </div>
            <div class="fibonacci-level">
                <span class="level-name">أقل سعر (50 يوم)</span>
                <span class="level-value">$${this.formatPrice(coin.low52w)}</span>
            </div>
        </div>
    `;
    
    return card;
}

    
    // تحسين تنسيق الأسعار
    formatPrice(price) {
        if (price >= 1000) {
            return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else if (price >= 1) {
            return price.toFixed(4);
        } else if (price >= 0.01) {
            return price.toFixed(6);
        } else {
            return price.toFixed(8);
        }
    }
    
    // حساب الربح المحتمل
    calculatePotentialProfit(currentPrice, targetPrice) {
        const profit = ((targetPrice - currentPrice) / currentPrice * 100);
        return profit > 0 ? `+${profit.toFixed(2)}` : profit.toFixed(2);
    }
    
      formatVolume(volume) {
        if (volume >= 1000000000) {
            return (volume / 1000000000).toFixed(2) + 'B';
        } else if (volume >= 1000000) {
            return (volume / 1000000).toFixed(2) + 'M';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(2) + 'K';
        }
        return volume.toFixed(2);
    }
    
    updateStats() {
        const resistanceBreaks = this.coins.filter(coin => 
            coin.signals.some(signal => signal.type === 'resistance_break')
        ).length;
        
        const supportBreaks = this.coins.filter(coin => 
            coin.signals.some(signal => signal.type === 'support_break')
        ).length;
        
        document.getElementById('resistanceBreakCount').textContent = resistanceBreaks;
        document.getElementById('supportBreakCount').textContent = supportBreaks;
        document.getElementById('totalCoinsCount').textContent = this.coins.length;
        
        // تحديث وقت آخر تحديث
        const now = new Date();
        const timeString = now.toLocaleTimeString('ar-SA', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        
        // إضافة عنصر لعرض وقت آخر تحديث إذا لم يكن موجوداً
        let lastUpdateElement = document.getElementById('lastUpdate');
        if (!lastUpdateElement) {
            lastUpdateElement = document.createElement('div');
            lastUpdateElement.id = 'lastUpdate';
            lastUpdateElement.style.cssText = `
                text-align: center;
                color: var(--text-muted);
                font-size: 0.9rem;
                margin-top: 10px;
            `;
            document.querySelector('.stats').appendChild(lastUpdateElement);
        }
        lastUpdateElement.textContent = `آخر تحديث: ${timeString}`;
    }
    
    showLoading(show) {
        const loading = document.getElementById('loading');
        const grid = document.getElementById('cardsGrid');
        
        if (show) {
            loading.style.display = 'flex';
            grid.style.display = 'none';
        } else {
            loading.style.display = 'none';
            grid.style.display = 'grid';
        }
    }
    
    showError() {
        document.getElementById('errorMessage').style.display = 'block';
        document.getElementById('cardsGrid').style.display = 'none';
    }
    
    hideError() {
        document.getElementById('errorMessage').style.display = 'none';
    }

    
    // إضافة الدوال الجديدة هنا ↓
    
    // دالة حفظ الاختراقات
    addToTracking(coin, signalType) {
        const entry = {
            symbol: coin.symbol,
            price: coin.price,
            timestamp: Date.now(),
            breakLevel: coin.signals[0].level,
            breakPrice: coin.signals[0].price,
            nextTarget: coin.signals[0].nextTarget,
            signalType: signalType
        };
        
        if (signalType === 'resistance_breakout') {
            if (!this.trackedBreakouts.find(item => item.symbol === coin.symbol)) {
                this.trackedBreakouts.push(entry);
                localStorage.setItem('trackedBreakouts', JSON.stringify(this.trackedBreakouts));
                console.log(`✅ تم حفظ اختراق: ${coin.symbol}`);
            }
        } else if (signalType === 'support_break') {
            if (!this.trackedBreakdowns.find(item => item.symbol === coin.symbol)) {
                this.trackedBreakdowns.push(entry);
                localStorage.setItem('trackedBreakdowns', JSON.stringify(this.trackedBreakdowns));
                console.log(`✅ تم حفظ كسر: ${coin.symbol}`);
            }
        }
    }

    // دالة فحص شروط الخروج
    checkExitConditions(coin) {
        const currentPrice = coin.price;
        
        this.trackedBreakouts = this.trackedBreakouts.filter(tracked => {
            if (tracked.symbol === coin.symbol) {
                const levels = this.calculateFibonacciLevels(coin.high52w, coin.low52w, currentPrice);
                const supportLevels = Object.values(levels.retracements)
                    .filter(level => level < tracked.breakPrice)
                    .sort((a, b) => b - a);
                
                const nearestSupport = supportLevels[0];
                
                if (nearestSupport && currentPrice < nearestSupport * 0.995) {
                    console.log(`🔴 إزالة ${tracked.symbol} - كسر دعم`);
                    return false;
                }
            }
            return true;
        });
        
        this.trackedBreakdowns = this.trackedBreakdowns.filter(tracked => {
            if (tracked.symbol === coin.symbol) {
                const levels = this.calculateFibonacciLevels(coin.high52w, coin.low52w, currentPrice);
                const resistanceLevels = Object.values(levels.retracements)
                    .filter(level => level > tracked.breakPrice)
                    .sort((a, b) => a - b);
                
                const nearestResistance = resistanceLevels[0];
                
                if (nearestResistance && currentPrice > nearestResistance * 1.005) {
                    console.log(`🔴 إزالة ${tracked.symbol} - اخترق مقاومة`);
                    return false;
                }
            }
            return true;
        });
        
        localStorage.setItem('trackedBreakouts', JSON.stringify(this.trackedBreakouts));
        localStorage.setItem('trackedBreakdowns', JSON.stringify(this.trackedBreakdowns));
    }

    // دالة إضافة المحفوظة للعرض
    addTrackedToCoins() {
        this.trackedBreakouts.forEach(tracked => {
            if (!this.coins.find(coin => coin.symbol === tracked.symbol)) {
                this.coins.push({
                    symbol: tracked.symbol,
                    price: tracked.price,
                    change: 0,
                    volume: 0,
                    signals: [{
                        type: 'resistance_break',
                        level: tracked.breakLevel,
                        price: tracked.breakPrice,
                        nextTarget: tracked.nextTarget
                    }],
                    fibonacciData: { confidence: 85, reliable: true },
                    high52w: tracked.price * 1.2,
                    low52w: tracked.price * 0.8,
                    isTracked: true
                });
            }
        });
    }
} // ← هذا القوس مهم جداً لإغلاق FibonacciIndicator

// وظائف مساعدة متقدمة
class FibonacciUtils {
    static calculatePotentialProfit(currentPrice, targetPrice) {
        return ((targetPrice - currentPrice) / currentPrice * 100).toFixed(2);
    }
    
    static calculateRiskReward(currentPrice, targetPrice, stopLoss) {
        const reward = Math.abs(targetPrice - currentPrice);
        const risk = Math.abs(currentPrice - stopLoss);
        return (reward / risk).toFixed(2);
    }
    
    static formatCurrency(amount, decimals = 4) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(amount);
    }
    
    static formatPercentage(value) {
        return new Intl.NumberFormat('ar-SA', {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value / 100);
    }
}

// تحليل متقدم
class AdvancedAnalysis {
    static calculateTrend(klineData) {
        if (klineData.length < 10) return 'غير محدد';
        
        const recent = klineData.slice(-10);
        const older = klineData.slice(-20, -10);
        
        const recentAvg = recent.reduce((sum, candle) => sum + candle.close, 0) / recent.length;
        const olderAvg = older.reduce((sum, candle) => sum + candle.close, 0) / older.length;
        
        if (recentAvg > olderAvg * 1.02) return 'صاعد';
        if (recentAvg < olderAvg * 0.98) return 'هابط';
        return 'جانبي';
    }
    
    static calculateVolatility(klineData) {
        if (klineData.length < 20) return 0;
        
        const prices = klineData.slice(-20).map(candle => candle.close);
        const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / prices.length;
        const volatility = Math.sqrt(variance) / avg * 100;
        
        return volatility.toFixed(2);
    }
    
    static calculateSupport(klineData) {
        if (klineData.length < 20) return null;
        
        const lows = klineData.slice(-20).map(candle => candle.low);
        lows.sort((a, b) => a - b);
        
        return lows[Math.floor(lows.length * 0.2)]; // 20th percentile
    }
    
    static calculateResistance(klineData) {
        if (klineData.length < 20) return null;
        
        const highs = klineData.slice(-20).map(candle => candle.high);
        highs.sort((a, b) => b - a);
        
        return highs[Math.floor(highs.length * 0.2)]; // 80th percentile
    }
}

// معالجة الأخطاء
class ErrorHandler {
    static handleAPIError(error, exchange) {
        console.error(`خطأ في API ${exchange}:`, error);
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return 'خطأ في الاتصال بالشبكة. تحقق من اتصال الإنترنت.';
        }
        
        if (error.message.includes('429')) {
            return 'تم تجاوز حد الطلبات. يرجى المحاولة لاحقاً.';
        }
        
        if (error.message.includes('403')) {
            return 'غير مسموح بالوصول إلى البيانات.';
        }
        
        return 'حدث خطأ في تحميل البيانات. يرجى المحاولة مرة أخرى.';
    }
    
    static logError(error, context) {
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            context: context,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        };
        
        console.error('تفاصيل الخطأ:', errorInfo);
    }
}

// نظام الإشعارات
class NotificationManager {
    static show(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        switch (type) {
            case 'success':
                notification.style.background = 'var(--success-color)';
                break;
            case 'error':
                notification.style.background = 'var(--danger-color)';
                break;
            case 'warning':
                notification.style.background = 'var(--secondary-color)';
                notification.style.color = 'var(--bg-dark)';
                break;
            default:
                notification.style.background = 'var(--info-color)';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// تشغيل التطبيق
document.addEventListener('DOMContentLoaded', () => {
    new FibonacciIndicator();
    
    // إضافة مؤشر التحديث التلقائي
    const autoUpdateIndicator = document.createElement('div');
    autoUpdateIndicator.id = 'autoUpdateIndicator';
    autoUpdateIndicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: var(--bg-card);
        color: var(--text-light);
        padding: 10px 15px;
        border-radius: 20px;
        font-size: 0.8rem;
        border: 1px solid var(--primary-color);
        z-index: 1000;
    `;
    autoUpdateIndicator.innerHTML = `
        <i class="fas fa-sync-alt" style="margin-left: 5px; animation: spin 2s linear infinite;"></i>
        تحديث تلقائي كل 5 دقائق
    `;
    document.body.appendChild(autoUpdateIndicator);
    
    // إضافة عداد للتحديث التالي
    let nextUpdateCountdown = 300; // 5 دقائق بالثواني
    
    setInterval(() => {
        nextUpdateCountdown--;
        if (nextUpdateCountdown <= 0) {
            nextUpdateCountdown = 300;
        }
        
        const minutes = Math.floor(nextUpdateCountdown / 60);
        const seconds = nextUpdateCountdown % 60;
        
        autoUpdateIndicator.innerHTML = `
            <i class="fas fa-clock" style="margin-left: 5px;"></i>
            التحديث التالي خلال ${minutes}:${seconds.toString().padStart(2, '0')}
        `;
    }, 1000);
});

// معالجة الأخطاء العامة
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    ErrorHandler.logError(e.error, 'Global Error');
});

// معالجة الوعود المرفوضة
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    ErrorHandler.logError(e.reason, 'Unhandled Promise Rejection');
    e.preventDefault();
});

// إضافة وظائف إضافية للتحسين
class PerformanceMonitor {
    static startTimer(label) {
        console.time(label);
    }
    
    static endTimer(label) {
        console.timeEnd(label);
    }
    
    static logMemoryUsage() {
        if (performance.memory) {
            console.log('Memory Usage:', {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB',
                total: Math.round(performance.memory.totalJSHeapSize / 1048576) + ' MB',
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) + ' MB'
            });
        }
    }
}

// إضافة مراقبة الأداء
setInterval(() => {
    PerformanceMonitor.logMemoryUsage();
}, 60000); // كل دقيقة

// إضافة دعم للوضع المظلم/الفاتح
class ThemeManager {
    static toggleTheme() {
        const body = document.body;
        body.classList.toggle('light-theme');
        
        const theme = body.classList.contains('light-theme') ? 'light' : 'dark';
        localStorage.setItem('theme', theme);
    }
    
    static loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
        }
    }
}

// تحميل الثيم المحفوظ
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.loadTheme();
});
