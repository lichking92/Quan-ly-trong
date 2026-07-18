import { createClient } from "@supabase/supabase-js";

// =========================================================================
// CẤU HÌNH SUPABASE / SUPABASE CONFIGURATION
// Đọc từ biến môi trường của Vite khi build hoặc fallback về giá trị mặc định.
// Tự động làm sạch URL nếu người dùng vô tình dán thêm hậu tố "/rest/v1/".
// =========================================================================

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/^['"]|['"]$/g, "");
const cleanUrl = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") : "";

const SUPABASE_URL = cleanUrl;
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim().replace(/^['"]|['"]$/g, "");
const SUPABASE_PUBLIC_KEY = rawKey;
export const SUPABASE_STORAGE_BUCKET = (import.meta.env.VITE_STORAGE_BUCKET || "user_luutru").trim().replace(/^['"]|['"]$/g, "");

if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
  console.error(
    "⚠️ [Supabase Config Alert] Thiếu biến môi trường VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY. Vui lòng cấu hình đầy đủ trong file .env hoặc Settings."
  );
} else {
  console.log(`[Supabase Init Diagnostics] URL: ${SUPABASE_URL}`);
  console.log(`[Supabase Init Diagnostics] Anon Key Length: ${SUPABASE_PUBLIC_KEY.length}`);
  console.log(`[Supabase Init Diagnostics] Anon Key Preview: ${SUPABASE_PUBLIC_KEY.substring(0, 8)}...${SUPABASE_PUBLIC_KEY.substring(SUPABASE_PUBLIC_KEY.length - 8)}`);
}

// -------------------------------------------------------------------------
// ĐỒNG BỘ THỜI GIAN ĐỂ FIX LỖI "JWT issued at future" (CLOCK SKEW CORRECTION)
// -------------------------------------------------------------------------
let timeOffset = 0;
const originalNow = Date.now;

// Ghi đè Date.now toàn cục để tự động cộng thêm độ lệch múi giờ so với server
Date.now = function() {
  return originalNow() + timeOffset;
};

// Đồng bộ thời gian thực tế với Supabase
export const syncTimeWithSupabase = async () => {
  try {
    const startTime = originalNow();
    // Gửi một yêu cầu nhẹ đến endpoint health của Auth để lấy header Date của server (kèm theo apikey để tránh lỗi 401)
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_PUBLIC_KEY
      }
    });
    const endTime = originalNow();
    const serverDateHeader = response.headers.get("date");
    if (serverDateHeader) {
      const serverTime = new Date(serverDateHeader).getTime();
      const rtt = endTime - startTime;
      // Ước lượng thời gian của server lúc phản hồi đến: serverTime + RTT / 2
      const adjustedServerTime = serverTime + Math.floor(rtt / 2);
      timeOffset = adjustedServerTime - endTime;
      
      const isDebug = typeof window !== 'undefined' && (window.__DEBUG_MODE__ || localStorage.getItem('DEBUG_MODE') === 'true');
      if (isDebug) {
        console.log(`[Time Sync] Đã đồng bộ thời gian thành công! Lệch thời gian (Offset): ${timeOffset}ms, RTT: ${rtt}ms`);
      }
    }
  } catch (error) {
    const isDebug = typeof window !== 'undefined' && (window.__DEBUG_MODE__ || localStorage.getItem('DEBUG_MODE') === 'true');
    if (isDebug) {
      console.warn("[Time Sync] Cảnh báo khi đồng bộ thời gian với Supabase server, sử dụng fallback:", error);
    }
    // Fallback im lặng dùng giờ local (timeOffset = 0)
    timeOffset = 0;
  }
};

// Chạy đồng bộ thời gian ngay lập tức khi ứng dụng khởi chạy
syncTimeWithSupabase();

// -------------------------------------------------------------------------
// THIẾT LẬP INTERCEPTOR CHO FETCH ĐỂ PHÁT HIỆN LỖI 401 (UNAUTHORIZED)
// VỚI CLIENT SUPABASE (TRÁNH LỖI WINDOW.FETCH LÀ READ-ONLY Ở MỘT SỐ PHIÊN BẢN TRÌNH DUYỆT)
// -------------------------------------------------------------------------
const customFetch = async function(input, init) {
  let requestUrl = "";
  let requestMethod = "GET";

  if (typeof input === "string") {
    requestUrl = input;
  } else if (input instanceof URL) {
    requestUrl = input.href;
  } else if (input && typeof input === "object") {
    requestUrl = input.url || "";
    if (!init || !init.method) {
      requestMethod = (input.method || "GET").toUpperCase();
    }
  }

  if (init && init.method) {
    requestMethod = init.method.toUpperCase();
  }

  try {
    const response = await window.fetch(input, init);

    if (response.status === 401) {
      const responseStatus = response.status;
      
      // Log lỗi theo đúng định dạng yêu cầu của user
      console.error(
        'API 401:',
        requestUrl,
        requestMethod,
        responseStatus
      );

      // Thêm log chi tiết về Tab và Trạng thái chạy ngầm/chạy nổi
      const activeTab = window.__activeTab || "UNKNOWN_TAB";
      const isBg = window.__isBackgroundRequest ? "Chạy ngầm (Background Polling)" : "Mở màn hình (Foreground)";
      console.error(`[401 Debug Info] Tab kích hoạt: ${activeTab} | Trạng thái: ${isBg}`);

      // Kiểm tra nếu có người dùng đang đăng nhập trong cache
      const hasCurrentUser = localStorage.getItem('CURRENT_USER') !== null;
      if (hasCurrentUser) {
        if (typeof window.__forceLogout === 'function') {
          console.warn("[401 Interceptor] Phát hiện tài khoản bị vô hiệu hóa hoặc hết hạn. Thực hiện đăng xuất cưỡng chế qua App UI...");
          window.__forceLogout();
        } else {
          console.warn("[401 Interceptor] Phát hiện 401 nhưng App UI chưa load xong. Tự động dọn sạch session...");
          localStorage.clear();
          sessionStorage.clear();
        }
      }
    }

    return response;
  } catch (err) {
    throw err;
  }
};

// Khởi tạo Supabase client / Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
  global: {
    fetch: customFetch
  }
});

