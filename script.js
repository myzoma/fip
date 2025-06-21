// 1. الفئات المساعدة (يجب وضعها أولاً)
class FibonacciUtils {
    static calculatePotentialProfit(currentPrice, targetPrice) {
        if (isNaN(currentPrice) || isNaN(targetPrice) || currentPrice <= 0) return '0.00';
        return ((targetPrice - currentPrice) / currentPrice * 100).toFixed(2);
    }
    
    static calculateRiskReward(currentPrice, targetPrice, stopLoss) {
        if (!currentPrice || !targetPrice || !stopLoss) return '0.00';
        const reward = Math.abs(targetPrice - currentPrice);
        const risk = Math.abs(currentPrice - stopLoss);
        return risk > 0 ? (reward / risk).toFixed(2) : '0.00';
    }
}

class AdvancedAnalysis {
    static calculateTrend(klineData) {
        if (!klineData || klineData.length < 10) return 'غير محدد';
        
        const recent = klineData.slice(-10);
        const older = klineData.slice(-20, -10);
        
        const recentAvg = recent.reduce((sum, candle) => sum + candle.close, 0) / recent.length;
        const olderAvg = older.reduce((sum, candle) => sum + candle.close, 0) / older.length;
        
        if (recentAvg > olderAvg * 1.02) return 'صاعد';
        if (recentAvg < olderAvg * 0.98) return 'هابط';
        return 'جانبي';
    }
    
    static calculateVolatility(klineData) {
        if (!klineData || klineData.length < 20) return '0.00';
        
        const prices = klineData.slice(-20).map(candle => candle.close);
        const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) / prices.length;
        const volatility = Math.sqrt(variance) / avg * 100;
        
        return volatility.toFixed(2);
    }
}

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

class NotificationManager {
    static show(message, type = 'info') {
        if (typeof document === 'undefined') return;
        
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
                notification.style.background = 'var(--warning-color)';
                notification.style.color = 'var(--text-dark)';
                break;
            default:
                notification.style.background = 'var(--info-color)';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
}

// 2. الفئة الرئيسية (FibonacciIndicator)
class FibonacciIndicator {
    constructor() {
        this.currentExchange = 'binance';
        this.coins = [];
        this.filteredCoins = [];
        this.currentFilter = 'all';
        this.cache = {
            binance: { data: null, timestamp: 0 },
            okx: { data: null, timestamp: 0 }
        };
        
        this.fibonacciRetracements = [0, 23.6, 38.2, 50, 61.8, 76.4, 78.6, 100];
        this.fibonacciExtensions = [61.8, 100, 138.2, 161.8, 200, 261.8];
        
        this.stableCoinPatterns = [
            /^USDT$/i, /^USDC$/i, /^BUSD$/i, /^DAI$/i, /^TUSD$/i,
            /^FDUSD$/i, /^PYUSD$/i, /^USDP$/i, /^USDD$/i, /^FRAX$/i,
            /^[A-Z]*USD[A-Z]*$/i
        ];
        
        this.init();
    }
    
    // ... (أضف هنا جميع دوال FibonacciIndicator المحسنة من الإجابة السابقة)
    // بما في ذلك init(), bindEvents(), isStableCoin(), loadData(),
    // fetchBinanceData(), fetchOKXData(), fetchKlineData(),
    // calculateFibonacciLevels(), processData(), createCoinCard(),
    // formatPrice(), formatVolume(), وغيرها من الدوال...
}

// 3. تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    if (typeof document !== 'undefined') {
        new FibonacciIndicator();
        
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
        document.body.appendChild(autoUpdateIndicator);
        
        let nextUpdateCountdown = 300;
        setInterval(() => {
            nextUpdateCountdown--;
            if (nextUpdateCountdown <= 0) nextUpdateCountdown = 300;
            
            const minutes = Math.floor(nextUpdateCountdown / 60);
            const seconds = nextUpdateCountdown % 60;
            
            autoUpdateIndicator.innerHTML = `
                <i class="fas fa-clock" style="margin-left: 5px;"></i>
                التحديث التالي خلال ${minutes}:${seconds.toString().padStart(2, '0')}
            `;
        }, 1000);
    }
});

// 4. معالجة الأخطاء العامة
if (typeof window !== 'undefined') {
    window.addEventListener('error', (e) => {
        ErrorHandler.logError(e.error, 'Global Error');
    });
    
    window.addEventListener('unhandledrejection', (e) => {
        ErrorHandler.logError(e.reason, 'Unhandled Promise Rejection');
        e.preventDefault();
    });
}
