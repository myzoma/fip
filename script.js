class FibonacciIndicator {
    constructor() {
        this.currentExchange = 'binance';
        this.coins = [];
        this.filteredCoins = [];
        this.currentFilter = 'all';
        
        // مستويات فيبوناتشي المصححة
        this.fibonacciRetracements = [0, 23.6, 38.2, 50, 61.8, 76.4, 100];
        this.fibonacciExtensions = [61.8, 100, 138.2, 161.8, 200, 261.8];
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadData();
        
        // تحديث البيانات كل 30 ثانية
        setInterval(() => {
            this.loadData();
        }, 30000);
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
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError();
        } finally {
            this.showLoading(false);
        }
    }
    
    async fetchBinanceData() {
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        if (!response.ok) throw new Error('Failed to fetch Binance data');
        
        const data = await response.json();
        
        // فلترة العملات USDT فقط
        const usdtPairs = data.filter(coin => 
            coin.symbol.endsWith('USDT') && 
            parseFloat(coin.volume) > 1000000 && // حجم تداول أكبر من مليون
            parseFloat(coin.priceChangePercent) !== 0
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
        
        // فلترة العملات USDT فقط
        const usdtPairs = data.filter(coin => 
            coin.instId.endsWith('-USDT') && 
            parseFloat(coin.vol24h) > 1000000 &&
            parseFloat(coin.last) > 0
        );
        
        const processedData = await Promise.all(
            usdtPairs.slice(0, 100).map(async (coin) => {
                try {
                    const klineData = await this.fetchKlineData(coin.instId, 'okx');
                    return {
                        symbol: coin.instId,
                        price: parseFloat(coin.last),
                        change: parseFloat(coin.changePercent) * 100,
                        volume: parseFloat(coin.vol24h),
                        high24h: parseFloat(coin.high24h),
                        low24h: parseFloat(coin.low24h),
                        klineData: klineData
                    };
                } catch (error) {
                    console.error(`Error processing ${coin.instId}:`, error);
                    return null;
                }
            })
        );
        
        return processedData.filter(coin => coin !== null);
    }
    
    async fetchKlineData(symbol, exchange) {
        try {
            let url;
            if (exchange === 'binance') {
                url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=100`;
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
        // البحث عن مستوى المقاومة التالي في التصحيحات
        const currentIndex = this.fibonacciRetracements.indexOf(currentRatio);
        if (currentIndex > 0) {
            const nextRatio = this.fibonacciRetracements[currentIndex - 1];
            return {
                type: 'retracement',
                ratio: nextRatio,
                price: retracements[nextRatio]
            };
        }
        
        // إذا لم يوجد في التصحيحات، البحث في الامتدادات
        const firstExtension = this.fibonacciExtensions[0];
        return {
            type: 'extension',
            ratio: firstExtension,
            price: extensions[firstExtension]
        };
    }
    
    getNextSupportLevel(currentRatio, retracements) {
        const currentIndex = this.fibonacciRetracements.indexOf(currentRatio);
        if (currentIndex < this.fibonacciRetracements.length - 1) {
            const nextRatio = this.fibonacciRetracements[currentIndex + 1];
            return {
                type: 'retracement',
                ratio: nextRatio,
                price: retracements[nextRatio]
            };
        }
        return null;
    }
    
    processData(data) {
        this.coins = data.map(coin => {
            if (!coin.klineData || coin.klineData.length < 20) {
                return { ...coin, fibonacciData: null, signals: [] };
            }
            
            // حساب أعلى وأقل سعر في آخر 50 شمعة
            const recentData = coin.klineData.slice(-50);
            const high = Math.max(...recentData.map(candle => candle.high));
            const low = Math.min(...recentData.map(candle => candle.low));
            
            const fibonacciData = this.calculateFibonacciLevels(high, low, coin.price);
            
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
    
    createCoinCard(coin) {
        const card = document.createElement('div');
        const signal = coin.signals[0]; // أخذ أول إشارة
        const signalClass = signal.type === 'resistance_break' ? 'resistance-break' : 'support-break';
        
        card.className = `coin-card ${signalClass}`;
        
        const changeClass = coin.change >= 0 ? 'change-positive' : 'change-negative';
        const changeSymbol = coin.change >= 0 ? '+' : '';
        
        const signalText = signal.type === 'resistance_break' ? 'اختراق مقاومة' : 'كسر دعم';
        const signalBadgeClass = signal.type === 'resistance_break' ? 'signal-resistance' : 'signal-support';
        
        card.innerHTML = `
            <div class="signal-badge ${signalBadgeClass}">${signalText}</div>
            
            <div class="coin-header">
                <div class="coin-name">${coin.symbol.replace('USDT', '').replace('-USDT', '')}</div>
                <div class="coin-price">$${coin.price.toFixed(4)}</div>
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
                    <div class="info-value">$${signal.price.toFixed(4)}</div>
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
                                      <span class="level-value">$${signal.nextTarget.price.toFixed(4)}</span>
                </div>
                <div class="fibonacci-level">
                    <span class="level-name">نوع المستوى</span>
                    <span class="level-value">${signal.nextTarget.type === 'retracement' ? 'تصحيح' : 'امتداد'}</span>
                </div>
                ` : ''}
                <div class="fibonacci-level">
                    <span class="level-name">أعلى سعر</span>
                    <span class="level-value">$${coin.high52w.toFixed(4)}</span>
                </div>
                <div class="fibonacci-level">
                    <span class="level-name">أقل سعر</span>
                    <span class="level-value">$${coin.low52w.toFixed(4)}</span>
                </div>
            </div>
        `;
        
        return card;
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
}

// تشغيل التطبيق
document.addEventListener('DOMContentLoaded', () => {
    new FibonacciIndicator();
});

// إضافة معالج للأخطاء العامة
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
});

// إضافة معالج للوعود المرفوضة
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    e.preventDefault();
});

// إضافة وظائف مساعدة إضافية
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

// إضافة وظائف التحليل المتقدم
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

// تحسين معالجة الأخطاء
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
        
        // يمكن إرسال الخطأ إلى خدمة مراقبة الأخطاء هنا
        // مثل Sentry أو LogRocket
    }
}

// إضافة وظائف الإشعارات
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
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// إضافة الأنيميشن للإشعارات في CSS
const notificationStyles = `
@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes slideOut {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(100%);
        opacity: 0;
    }
}
`;

// إضافة الأنيميشن إلى الصفحة
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

