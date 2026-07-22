import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Smartphone, 
  WifiOff, 
  Wifi, 
  X, 
  Share, 
  PlusSquare, 
  CheckCircle2, 
  AlertTriangle,
  Monitor
} from 'lucide-react';
import { isStandaloneApp, isIOSDevice } from '../pwaRegister';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [showOnlineToast, setShowOnlineToast] = useState<boolean>(false);

  useEffect(() => {
    // Check initial standalone status
    if (isStandaloneApp()) {
      setIsInstalled(true);
    }

    // Handle beforeinstallprompt event (Chrome, Edge, Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    // Handle appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallBanner(false);
      setDeferredPrompt(null);
      console.log('[PWA] App successfully installed');
    };

    // Online / Offline status monitors
    const handleOffline = () => {
      setIsOffline(true);
      setShowOnlineToast(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowOnlineToast(true);
      setTimeout(() => {
        setShowOnlineToast(false);
      }, 4000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] User accepted the install prompt');
          setIsInstalled(true);
          setShowInstallBanner(false);
        } else {
          console.log('[PWA] User dismissed the install prompt');
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('[PWA] Error triggering install prompt:', err);
      }
    } else if (isIOSDevice()) {
      setShowIOSModal(true);
    } else {
      setShowIOSModal(true);
    }
  };

  return (
    <>
      {/* 1. Offline Top Warning Bar */}
      {isOffline && (
        <div className="bg-amber-600 text-white text-xs py-2 px-4 shadow-md flex items-center justify-between sticky top-0 z-50 animate-fadeIn">
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-amber-200" />
            <span className="font-semibold">
              <strong className="underline decoration-amber-300">Bạn đang ngoại tuyến (Offline):</strong> Bạn vẫn có thể xem dữ liệu đã lưu. Các thao tác thêm/sửa/xóa sẽ tạm khóa cho đến khi có mạng trở lại.
            </span>
          </div>
        </div>
      )}

      {/* 2. Back Online Notification Toast */}
      {showOnlineToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-500 animate-bounce">
          <Wifi className="w-5 h-5 text-emerald-200" />
          <div className="text-xs">
            <p className="font-bold text-white">Đã khôi phục kết nối mạng!</p>
            <p className="text-emerald-100">Dữ liệu hệ thống đã sẵn sàng đồng bộ trực tuyến.</p>
          </div>
          <button 
            onClick={() => setShowOnlineToast(false)}
            className="text-emerald-200 hover:text-white p-1 rounded-lg ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Install App Banner (shown when prompt is ready and app not installed) */}
      {!isInstalled && (showInstallBanner || deferredPrompt || isIOSDevice()) && (
        <div className="bg-slate-900/95 backdrop-blur-md text-white border-b border-indigo-500/30 px-3 py-2 text-xs flex items-center justify-between shadow-lg z-40">
          <div className="flex items-center gap-2.5">
            <img src="/pwa-192x192.png" alt="App Icon" className="w-7 h-7 rounded-lg shadow-sm border border-slate-700 object-cover" />
            <div>
              <p className="font-bold text-slate-100 flex items-center gap-1.5">
                Cài Đặt Ứng Dụng Quản Lý Kho
                <span className="bg-indigo-500/30 text-indigo-300 text-[10px] px-1.5 py-0.2 rounded border border-indigo-500/40 font-mono">PWA</span>
              </p>
              <p className="text-[11px] text-slate-400 hidden sm:block">Chạy mượt mà như app gốc, truy cập nhanh từ Màn hình chính</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Cài đặt ứng dụng</span>
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="text-slate-400 hover:text-white p-1 rounded-md"
              title="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 4. iOS / Manual Install Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative text-slate-800">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <img src="/pwa-192x192.png" alt="App Icon" className="w-12 h-12 rounded-xl shadow-md border border-slate-200" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Cài Đặt Quản Lý Kho</h3>
                <p className="text-xs text-slate-500">Thêm ứng dụng vào Màn hình chính (Home Screen)</p>
              </div>
            </div>

            <div className="space-y-3 my-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs text-slate-700">
              {isIOSDevice() ? (
                <>
                  <p className="font-bold text-slate-900 mb-2 flex items-center gap-1.5 text-sm">
                    <Smartphone className="w-4 h-4 text-indigo-600" />
                    Hướng dẫn cài đặt trên iPhone / iPad (Safari):
                  </p>
                  <ol className="list-decimal list-inside space-y-2.5 font-medium">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-indigo-600 shrink-0">1.</span>
                      <span>Nhấn vào biểu tượng <strong className="text-indigo-700 inline-flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200"><Share className="w-3.5 h-3.5" /> Chia sẻ (Share)</strong> ở thanh công cụ Safari.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-indigo-600 shrink-0">2.</span>
                      <span>Cuộn xuống danh sách tùy chọn và chọn <strong className="text-indigo-700 inline-flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200"><PlusSquare className="w-3.5 h-3.5" /> Thêm vào Màn hình chính (Add to Home Screen)</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-indigo-600 shrink-0">3.</span>
                      <span>Nhấn <strong className="text-indigo-700">Thêm (Add)</strong> ở góc trên bên phải để hoàn tất.</span>
                    </li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="font-bold text-slate-900 mb-2 flex items-center gap-1.5 text-sm">
                    <Monitor className="w-4 h-4 text-indigo-600" />
                    Hướng dẫn cài đặt trên Máy tính & Android:
                  </p>
                  <ol className="list-decimal list-inside space-y-2.5 font-medium">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-indigo-600 shrink-0">1.</span>
                      <span>Nhấn vào biểu tượng menu 3 chấm (⋮) hoặc biểu tượng Cài đặt ở góc trên phải trình duyệt.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-indigo-600 shrink-0">2.</span>
                      <span>Chọn <strong>"Cài đặt ứng dụng"</strong> hoặc <strong>"Thêm vào màn hình chính"</strong>.</span>
                    </li>
                  </ol>
                </>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md active:scale-98 cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Standalone Install Button component for Header / Menu
export const PWAInstallButton: React.FC<{ className?: string; showText?: boolean }> = ({ 
  className = '', 
  showText = true 
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  useEffect(() => {
    if (isStandaloneApp()) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (e) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 bg-indigo-600/90 hover:bg-indigo-600 text-white font-bold text-xs px-2.5 py-1.5 rounded-xl shadow-xs border border-indigo-500/50 hover:shadow-md transition-all active:scale-95 cursor-pointer ${className}`}
        title="Cài đặt ứng dụng lên thiết bị"
      >
        <Download className="w-3.5 h-3.5 shrink-0 text-indigo-200" />
        {showText && <span>Cài ứng dụng</span>}
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative text-slate-800">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <img src="/pwa-192x192.png" alt="App Icon" className="w-12 h-12 rounded-xl shadow-md border border-slate-200" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Cài Đặt Quản Lý Kho</h3>
                <p className="text-xs text-slate-500">Thêm ứng dụng vào Màn hình chính</p>
              </div>
            </div>

            <div className="space-y-3 my-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs text-slate-700">
              {isIOSDevice() ? (
                <>
                  <p className="font-bold text-slate-900 mb-2 flex items-center gap-1.5 text-sm">
                    <Smartphone className="w-4 h-4 text-indigo-600" />
                    Hướng dẫn cài đặt trên iOS (Safari):
                  </p>
                  <ol className="list-decimal list-inside space-y-2 font-medium">
                    <li>Nhấn nút <strong>Chia sẻ (Share)</strong> ở thanh công cụ Safari.</li>
                    <li>Chọn <strong>Thêm vào Màn hình chính (Add to Home Screen)</strong>.</li>
                    <li>Nhấn <strong>Thêm (Add)</strong> để hoàn tất.</li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="font-bold text-slate-900 mb-2 flex items-center gap-1.5 text-sm">
                    <Monitor className="w-4 h-4 text-indigo-600" />
                    Hướng dẫn cài đặt trên Android / Máy tính:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 font-medium">
                    <li>Mở menu trình duyệt (biểu tượng 3 chấm ⋮).</li>
                    <li>Chọn <strong>Cài đặt ứng dụng</strong> hoặc <strong>Thêm vào màn hình chính</strong>.</li>
                  </ol>
                </>
              )}
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
};
