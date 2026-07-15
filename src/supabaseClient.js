import { createClient } from "@supabase/supabase-js";

// =========================================================================
// CẤU HÌNH SUPABASE / SUPABASE CONFIGURATION
// Đọc từ biến môi trường của Vite khi build hoặc fallback về giá trị mặc định.
// Tự động làm sạch URL nếu người dùng vô tình dán thêm hậu tố "/rest/v1/".
// =========================================================================

const rawUrl = import.meta.env.VITE_SUPABASE_URL || "https://fuyyregblrjugejetunj.supabase.co";
const cleanUrl = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

const SUPABASE_URL = cleanUrl;
const SUPABASE_PUBLIC_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_G-1asuq_o55iGIuput1wHA__0wdrGAV";

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
    // Gửi một yêu cầu nhẹ đến endpoint health của Auth để lấy header Date của server
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, { method: "GET" });
    const endTime = originalNow();
    const serverDateHeader = response.headers.get("date");
    if (serverDateHeader) {
      const serverTime = new Date(serverDateHeader).getTime();
      const rtt = endTime - startTime;
      // Ước lượng thời gian của server lúc phản hồi đến: serverTime + RTT / 2
      const adjustedServerTime = serverTime + Math.floor(rtt / 2);
      timeOffset = adjustedServerTime - endTime;
      console.log(`[Time Sync] Đã đồng bộ thời gian thành công! Lệch thời gian (Offset): ${timeOffset}ms, RTT: ${rtt}ms`);
    }
  } catch (error) {
    console.warn("[Time Sync] Cảnh báo khi đồng bộ thời gian với Supabase server, sử dụng fallback:", error);
    // Nếu bị lỗi mạng hoặc chặn CORS, tự động thiết lập một offset nhỏ an toàn là +5000ms 
    // phòng hờ trường hợp giờ máy client chạy chậm hơn server làm lỗi token.
    timeOffset = 5000;
  }
};

// Chạy đồng bộ thời gian ngay lập tức khi ứng dụng khởi chạy
syncTimeWithSupabase();

// Khởi tạo Supabase client / Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);

