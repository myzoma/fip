// الفئات المساعدة (يجب أن تبقى كما هي)
class FibonacciUtils { /* ... */ }
class AdvancedAnalysis { /* ... */ }
class ErrorHandler { /* ... */ }
class NotificationManager { /* ... */ }

// الفئة الرئيسية المعدلة بالكامل
class FibonacciIndicator {
    constructor() {
        // 1. تهيئة الخصائص
        this.currentExchange = 'binance';
        this.coins = [];
        this.filteredCoins = [];
        this.currentFilter = 'all';
        this.cache = {
            binance: { data: null, timestamp: 0 },
            okx: { data: null, timestamp: 0 }
        };
        
        // 2. مستويات فيبوناتشي
        this.fibonacciRetracements = [0, 23.6, 38.2, 50, 61.8, 76.4, 78.6, 100];
        this.fibonacciExtensions = [61.8, 100, 138.2, 161.8, 200, 261.8];
        
        // 3. قوالب العملات المستقرة
        this.stableCoinPatterns = [
            /^USDT$/i, /^USDC$/i, /^BUSD$/i, /^DAI$/i, /^TUSD$/i,
            /^FDUSD$/i, /^PYUSD$/i, /^USDP$/i, /^USDD$/i, /^FRAX$/i,
            /^[A-Z]*USD[A-Z]*$/i
        ];
        
        // 4. الربط الآمن للدوال
        this.init = this.init.bind(this);
        this.loadData = this.loadData.bind(this);
        this.processData = this.processData.bind(this);
        
        // 5. البدء بالتنفيذ
        this.init();
    }

    init() {
        try {
            this.bindEvents();
            this.loadData();
            
            setInterval(() => {
                if (navigator.onLine) {
                    this.loadData();
                } else {
                    NotificationManager.show('لا يوجد اتصال بالإنترنت', 'error');
                }
            }, 300000);
        } catch (error) {
            console.error('Error in init:', error);
            ErrorHandler.logError(error, 'FibonacciIndicator initialization');
        }
    }

    bindEvents() {
        try {
            const refreshBtn = document.getElementById('refreshBtn');
            const exchangeSelect = document.getElementById('exchangeSelect');
            
            if (refreshBtn) {
                refreshBtn.addEventListener('click', this.loadData);
            }
            
            if (exchangeSelect) {
                exchangeSelect.addEventListener('change', (e) => {
                    this.currentExchange = e.target.value;
                    this.loadData();
                });
            }
            
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.setFilter(e.target.dataset.filter);
                });
            });
        } catch (error) {
            ErrorHandler.logError(error, 'Binding Events');
        }
    }

    // ... [جميع الدوال الأخرى تبقى كما هي مع التأكد من وجودها] ...
    
    // دالة معالجة البيانات المعدلة
    processData(data) {
        try {
            if (!Array.isArray(data)) {
                throw new Error('Invalid data format');
            }
            
            this.coins = data.map(coin => {
                if (!coin?.klineData || coin.klineData.length < 20) {
                    return { ...coin, fibonacciData: null, signals: [] };
                }
                
                const recentData = coin.klineData.slice(-50);
                const validData = recentData.filter(c => c?.high && c?.low);
                
                if (validData.length < 20) return { ...coin, fibonacciData: null, signals: [] };
                
                const high = Math.max(...validData.map(c => c.high));
                const low = Math.min(...validData.map(c => c.low));
                
                if (high <= low) return { ...coin, fibonacciData: null, signals: [] };
                
                return {
                    ...coin,
                    fibonacciData: this.calculateFibonacciLevels(high, low, coin.price),
                    high52w: high,
                    low52w: low
                };
            }).filter(coin => coin?.signals?.length > 0);
            
            this.applyFilter();
        } catch (error) {
            ErrorHandler.logError(error, 'Processing Data');
            this.coins = [];
            this.filteredCoins = [];
        }
    }
}

// التهيئة الآمنة للتطبيق
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            window.fibonacciApp = new FibonacciIndicator();
        } catch (error) {
            console.error('Application failed to start:', error);
            NotificationManager.show('فشل تشغيل التطبيق', 'error');
        }
    });
}
