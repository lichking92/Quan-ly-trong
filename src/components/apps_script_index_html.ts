/**
 * =========================================================================
 * FILE: apps_script_index_html.ts
 * TÁC GIẢ: Lập trình viên Hệ thống Lão làng (30+ năm kinh nghiệm)
 * MÔ TẢ: File HTML Index.html chứa toàn bộ Front-end SPA viết bằng AlpineJS
 *        và Tailwind CSS. Đầy đủ Đăng nhập, Phân quyền chặt chẽ, Lập phiếu,
 *        Bù trừ, Rollback, Xem hóa đơn chi tiết, và Đồng bộ Google Sheets.
 * =========================================================================
 */

export const indexHTMLContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no">
  <title>Quản lý Kho Tròng Kính - Glass Stock Pro</title>
  <!-- Tailwind CSS & Google Fonts -->
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <!-- AlpineJS -->
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <style>
    body {
      font-family: 'Inter', sans-serif;
    }
    .heading-font {
      font-family: 'Space Grotesk', sans-serif;
    }
    [x-cloak] { display: none !important; }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 antialiased" x-data="app()" x-init="init()" x-cloak>

  <!-- MÀN HÌNH TẢI DỮ LIỆU ĐỒNG BỘ -->
  <div x-show="isLoading" class="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex flex-col items-center justify-center space-y-4">
    <div class="animate-spin rounded-full h-14 w-14 border-4 border-white/20 border-t-blue-500"></div>
    <p class="text-white font-medium text-sm animate-pulse tracking-wide" x-text="loadingText">Đang đồng bộ dữ liệu từ Google Sheets...</p>
  </div>

  <!-- ==================== 1. MÀN HÌNH ĐĂNG NHẬP (LOGIN SCREEN) ==================== -->
  <template x-if="!currentUser">
    <div class="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <!-- Decor Balls -->
      <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-3xl pointer-events-none"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/10 blur-3xl pointer-events-none"></div>

      <div class="w-full max-w-md bg-slate-850/90 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl relative text-slate-100">
        <!-- Logo & Title -->
        <div class="text-center mb-8 space-y-2">
          <div class="inline-flex p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 mb-2">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
          </div>
          <h1 class="text-xl font-extrabold heading-font tracking-tight text-white uppercase">Glass Stock Pro</h1>
          <p class="text-xs text-slate-400 font-mono tracking-widest">HỆ THỐNG QUẢN LÝ KHO TRÒNG KÍNH</p>
        </div>

        <!-- Error Msg -->
        <div x-show="loginError" class="p-3.5 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl text-xs font-medium mb-5 flex items-center gap-2">
          <svg class="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <span x-text="loginError"></span>
        </div>

        <!-- Login Form -->
        <form @submit.prevent="handleLoginSubmit" class="space-y-4">
          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tên đăng nhập / Email</label>
            <input type="text" x-model="loginUsername" placeholder="Ví dụ: admin, kho hoặc nhanvien" class="w-full text-xs font-semibold text-white bg-slate-800/60 border border-slate-750 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono">
          </div>

          <div>
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Mật khẩu</label>
            <input type="password" x-model="loginPassword" placeholder="Nhập mật khẩu..." class="w-full text-xs font-semibold text-white bg-slate-800/60 border border-slate-750 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all">
          </div>

          <button type="submit" class="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-colors shadow-lg cursor-pointer">
            Đăng Nhập Hệ Thống
          </button>
        </form>

        <!-- Quick Login Shortcuts -->
        <div class="mt-8 border-t border-slate-800/80 pt-5">
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center mb-3">Tài khoản kiểm thử nhanh</p>
          <div class="grid grid-cols-3 gap-2">
            <button @click="quickLogin('ADMIN')" class="py-2 px-1 bg-slate-800 hover:bg-slate-750 rounded-xl text-[10px] font-bold cursor-pointer text-center text-blue-400">
              Quản Trị viên
            </button>
            <button @click="quickLogin('KHO')" class="py-2 px-1 bg-slate-800 hover:bg-slate-750 rounded-xl text-[10px] font-bold cursor-pointer text-center text-amber-400">
              Thủ Kho
            </button>
            <button @click="quickLogin('NHAN_VIEN')" class="py-2 px-1 bg-slate-800 hover:bg-slate-750 rounded-xl text-[10px] font-bold cursor-pointer text-center text-emerald-400">
              Nhân Viên
            </button>
          </div>
        </div>
      </div>
    </div>
  </template>


  <!-- ==================== 2. KHÔNG GIAN LÀM VIỆC CHÍNH (MAIN APP WORKSPACE) ==================== -->
  <template x-if="currentUser">
    <div class="min-h-screen flex flex-col md:flex-row">
      
      <!-- SIDEBAR DỌC BÊN TRÁI (UI/UX Sang trọng tương tự bản Preview) -->
      <aside class="w-full md:w-68 lg:w-72 bg-[#0f172a] text-white shrink-0 flex flex-col border-r border-slate-800">
        
        <!-- LOGO & BRAND -->
        <div class="p-5 border-b border-slate-800/80 flex items-center gap-3">
          <div class="p-2 bg-[#3b82f6] rounded-xl shadow-md text-white">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
          </div>
          <div>
            <h1 class="heading-font font-bold text-sm uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
              Glass Stock Pro
              <span class="text-[8px] bg-blue-500/20 text-blue-300 font-mono py-0.5 px-1.5 rounded-full uppercase">GAS v4.0</span>
            </h1>
            <p class="text-[9px] text-slate-400 font-mono uppercase tracking-widest">HỆ THỐNG KẾT NỐI REAL-TIME</p>
          </div>
        </div>

        <!-- PROFILE NGƯỜI DÙNG HIỆN TẠI -->
        <div class="p-4 mx-4 my-3 bg-slate-800/40 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-sm text-white border border-blue-400/20 shadow-inner">
            <span x-text="currentUser.fullName.charAt(0)"></span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold text-slate-200 truncate" x-text="currentUser.fullName"></p>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide"
                    :class="currentUser.role === 'ADMIN' ? 'bg-rose-500/10 text-rose-300' : currentUser.role === 'KHO' ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'"
                    x-text="currentUser.role === 'ADMIN' ? 'ADMIN' : currentUser.role === 'KHO' ? 'THỦ KHO' : 'NHÂN VIÊN'"></span>
              <span class="text-[9px] text-slate-400 font-mono truncate" x-text="currentUser.branch"></span>
            </div>
          </div>
        </div>

        <!-- DANH SÁCH MENU ĐIỀU HƯỚNG TÁC VỤ (Phân quyền Tab động) -->
        <nav class="flex-1 px-3 py-4 space-y-1">
          <!-- DASHBOARD (Ẩn với Nhân viên thường theo phân quyền bản Preview) -->
          <template x-if="currentUser.role !== 'NHAN_VIEN'">
            <button @click="activeTab = 'DASHBOARD'" 
                    class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer"
                    :class="activeTab === 'DASHBOARD' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2"/></svg>
              <span>Báo Cáo Tổng Quan</span>
            </button>
          </template>

          <!-- KHO HÀNG (SKU) -->
          <button @click="activeTab = 'PRODUCTS'" 
                  class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer"
                  :class="activeTab === 'PRODUCTS' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
            <span>Danh Mục Kho Hàng</span>
          </button>

          <!-- LẬP PHIẾU XUẤT NHẬP (Mở cho tất cả có quyền ghi hoặc theo vai trò) -->
          <button @click="activeTab = 'TX_FORM'" 
                  class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer"
                  :class="activeTab === 'TX_FORM' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span>Lập Phiếu Xuất Nhập</span>
          </button>

          <!-- LỊCH SỬ GIAO DỊCH -->
          <button @click="activeTab = 'TX_HISTORY'" 
                  class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer"
                  :class="activeTab === 'TX_HISTORY' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Nhật Ký Giao Dịch</span>
          </button>

          <!-- KIỂM KHO VẬT LÝ (Ẩn với Nhân viên) -->
          <template x-if="currentUser.role !== 'NHAN_VIEN'">
            <button @click="activeTab = 'AUDIT'" 
                    class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer"
                    :class="activeTab === 'AUDIT' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
              <span>Kiểm Kho Định Kỳ</span>
            </button>
          </template>

          <!-- THIẾT LẬP DANH MỤC (Ẩn với Nhân viên) -->
          <template x-if="currentUser.role !== 'NHAN_VIEN'">
            <button @click="activeTab = 'CATEGORIES'" 
                    class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer"
                    :class="activeTab === 'CATEGORIES' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 10H5m14 0a2 2 0 002-2v-3a2 2 0 00-2-2H5a2 2 0 00-2 2v3a2 2 0 002 2z"/></svg>
              <span>Quản Lý Chi Nhánh & DM</span>
            </button>
          </template>
        </nav>

        <!-- FOOTER SIDEBAR / ĐĂNG XUẤT -->
        <div class="p-4 border-t border-slate-800/80 mt-auto">
          <button @click="handleLogout()" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-red-900/40 hover:text-red-300 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700/50">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            Đăng xuất hệ thống
          </button>
        </div>
      </aside>

      <!-- KHU VỰC HIỂN THỊ NỘI DUNG CHÍNH (MAIN SCREEN AREA) -->
      <main class="flex-1 bg-slate-50 min-w-0 flex flex-col">
        
        <!-- TOP BAR -->
        <header class="bg-white border-b border-slate-200 py-3.5 px-6 shrink-0 flex items-center justify-between shadow-sm">
          <div class="flex items-center gap-2">
            <h2 class="heading-font font-bold text-slate-800 text-sm tracking-wide" x-text="getTabTitle()"></h2>
            <span class="text-[9px] bg-blue-50 text-blue-600 font-semibold py-0.5 px-2 rounded-full border border-blue-100 hidden sm:inline-block">Đồng bộ trực tiếp</span>
          </div>
          <div class="flex items-center gap-4">
            <button @click="refreshData(true)" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer flex items-center gap-1">
              <svg class="w-4 h-4 animate-spin-hover" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H18M9 21h11v-11"/></svg>
              <span class="text-[10px] font-bold hidden sm:inline">Đồng bộ ngay</span>
            </button>
            <div class="text-right text-[10px] font-mono text-slate-400 border-l border-slate-200 pl-4 hidden md:block">
              <p class="font-bold text-slate-600" x-text="userEmail"></p>
              <p>ID Sheets: google.script.run</p>
            </div>
          </div>
        </header>

        <!-- CONTAINER NỘI DUNG CÁC TAB -->
        <div class="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

          <!-- ==================== TAB 1: DASHBOARD ==================== -->
          <div x-show="activeTab === 'DASHBOARD'" class="space-y-6">
            
            <!-- Cards Thống Kê -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- Card 1 -->
              <div class="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                <div class="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                </div>
                <div>
                  <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mặt hàng (SKU)</p>
                  <h3 class="text-xl font-bold text-slate-800 font-mono" x-text="sanPhams.length">0</h3>
                </div>
              </div>
              <!-- Card 2 -->
              <div class="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                <div class="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                </div>
                <div>
                  <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng kho tồn cuối</p>
                  <h3 class="text-xl font-bold text-slate-800 font-mono" x-text="getTotalStock()">0</h3>
                </div>
              </div>
              <!-- Card 3 -->
              <div class="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                <div class="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                </div>
                <div>
                  <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng Nhập Lũy Kế</p>
                  <h3 class="text-xl font-bold text-slate-800 font-mono" x-text="getTotalNhap()">0</h3>
                </div>
              </div>
              <!-- Card 4 -->
              <div class="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                <div class="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                </div>
                <div>
                  <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng Xuất Lũy Kế</p>
                  <h3 class="text-xl font-bold text-slate-800 font-mono" x-text="getTotalXuat()">0</h3>
                </div>
              </div>
            </div>

            <!-- Dashboard Columns (Biểu đồ & Hàng cảnh báo) -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <!-- Biểu đồ hình cột (bar chart) vẽ bằng CSS mượt mà -->
              <div class="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm space-y-4">
                <h3 class="heading-font font-bold text-slate-800 text-xs uppercase tracking-wide">📊 TỒN KHO THEO THƯƠNG HIỆU</h3>
                <div class="space-y-3.5 pt-2">
                  <template x-for="b in getBrandStockData()" :key="b.brand">
                    <div class="space-y-1">
                      <div class="flex items-center justify-between text-xs">
                        <span class="font-bold text-slate-700" x-text="b.brand"></span>
                        <span class="font-bold font-mono text-slate-500" x-text="b.stock + ' cái'"></span>
                      </div>
                      <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div class="bg-blue-600 h-full rounded-full transition-all duration-500" :style="'width: ' + b.percentage + '%'"></div>
                      </div>
                    </div>
                  </template>
                  <template x-if="getBrandStockData().length === 0">
                    <p class="text-xs text-slate-400 text-center py-6">Chưa có dữ liệu thống kê thương hiệu.</p>
                  </template>
                </div>
              </div>

              <!-- Danh sách Cảnh Báo Sản Phẩm Sắp Hết Hàng (Tồn cuối <= Tồn tối thiểu) -->
              <div class="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm space-y-4">
                <h3 class="heading-font font-bold text-rose-600 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  ⚠️ CẢNH BÁO SẮP HẾT HÀNG (TỒN KHO <= TỒN TỐI THIỂU)
                </h3>
                <div class="overflow-y-auto max-h-[220px] divide-y divide-slate-100 pr-1">
                  <template x-for="p in sanPhams.filter(item => Number(item.TON_CUOI) <= Number(item.TON_TOI_THIEU))" :key="p.SKU">
                    <div class="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p class="font-bold text-slate-800" x-text="p.TEN_SP"></p>
                        <p class="text-[10px] font-mono text-slate-400" x-text="'SKU: ' + p.SKU + ' | Thương hiệu: ' + p.THUONG_HIEU"></p>
                      </div>
                      <div class="text-right">
                        <p class="font-mono font-bold text-rose-600" x-text="'Còn ' + p.TON_CUOI"></p>
                        <p class="text-[9px] text-slate-400 font-mono" x-text="'Tối thiểu: ' + p.TON_TOI_THIEU"></p>
                      </div>
                    </div>
                  </template>
                  <template x-if="sanPhams.filter(item => Number(item.TON_CUOI) <= Number(item.TON_TOI_THIEU)).length === 0">
                    <p class="text-xs text-emerald-600 text-center py-10 font-bold">🎉 Thật tuyệt vời! Không có sản phẩm nào sắp hết hàng.</p>
                  </template>
                </div>
              </div>

            </div>

            <!-- Giao Dịch Gần Đây Nhất -->
            <div class="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div class="px-6 py-4 border-b border-slate-150 flex items-center justify-between">
                <h3 class="heading-font font-bold text-slate-800 text-xs uppercase tracking-wide">📜 LỊCH SỬ GIAO DỊCH GẦN ĐÂY NHẤT</h3>
                <button @click="activeTab = 'TX_HISTORY'" class="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer">Xem tất cả</button>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50/50 text-slate-400 font-bold uppercase border-b border-slate-100">
                    <tr>
                      <th class="px-6 py-3">Số phiếu</th>
                      <th class="px-6 py-3">Ngày</th>
                      <th class="px-6 py-3">Loại</th>
                      <th class="px-6 py-3">Chi nhánh</th>
                      <th class="px-6 py-3 text-center">Tổng SL</th>
                      <th class="px-6 py-3">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <template x-for="t in nhapXuats.slice(0, 5)" :key="t.HOA_DON">
                      <tr class="hover:bg-slate-50/40 transition-colors">
                        <td class="px-6 py-3.5 font-bold text-slate-800 font-mono" x-text="t.HOA_DON"></td>
                        <td class="px-6 py-3.5 text-slate-500" x-text="t.NGAY"></td>
                        <td class="px-6 py-3.5">
                          <span :class="t.LOAI === 'NHẬP' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-blue-50 text-blue-700 border border-blue-100'" class="px-2.5 py-1 rounded-full font-bold text-[10px]" x-text="t.LOAI"></span>
                        </td>
                        <td class="px-6 py-3.5 text-slate-700 font-medium" x-text="t.CHI_NHANH"></td>
                        <td class="px-6 py-3.5 text-center font-bold text-slate-800 font-mono" x-text="t.TONG_SL"></td>
                        <td class="px-6 py-3.5 text-slate-500 italic max-w-xs truncate" x-text="t.GHI_CHU || '-'"></td>
                      </tr>
                    </template>
                    <template x-if="nhapXuats.length === 0">
                      <tr>
                        <td colspan="6" class="px-6 py-8 text-center text-slate-400">Chưa có giao dịch nào được ghi nhận.</td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <!-- ==================== TAB 2: PRODUCTS ==================== -->
          <div x-show="activeTab === 'PRODUCTS'" class="space-y-4">
            
            <!-- Filters & Add Button -->
            <div class="bg-white p-4 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col sm:flex-row gap-3 items-center">
              <div class="flex-1 w-full">
                <input type="text" x-model="productSearchQuery" placeholder="🔍 Tìm kiếm SKU, tên sản phẩm tròng kính..." class="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              </div>
              <div class="w-full sm:w-auto flex gap-2">
                <select x-model="productBrandFilter" class="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">-- Tất cả thương hiệu --</option>
                  <template x-for="b in thuongHieus" :key="b.THUONG_HIEU">
                    <option :value="b.THUONG_HIEU" x-text="b.THUONG_HIEU"></option>
                  </template>
                </select>

                <select x-model="productStockFilter" class="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="ALL">Tất cả tình trạng</option>
                  <option value="LOW">Sắp hết hàng</option>
                </select>
              </div>

              <!-- Thêm sản phẩm mới (Ẩn với Nhân viên thường) -->
              <template x-if="currentUser.role !== 'NHAN_VIEN'">
                <button @click="showAddProductModal = true" class="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                  Thêm SKU Mới
                </button>
              </template>
            </div>

            <!-- Bảng Dữ Liệu Sản Phẩm -->
            <div class="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50/50 text-slate-400 font-bold uppercase border-b border-slate-100">
                    <tr>
                      <th class="px-4 py-3">SKU</th>
                      <th class="px-4 py-3">Tên tròng kính</th>
                      <th class="px-4 py-3">Thương hiệu</th>
                      <th class="px-4 py-3">Cầu (SPH)</th>
                      <th class="px-4 py-3">Loạn (CYL)</th>
                      <th class="px-4 py-3 text-center">Tồn đầu</th>
                      <th class="px-4 py-3 text-center text-amber-600">Nhập</th>
                      <th class="px-4 py-3 text-center text-blue-600">Xuất</th>
                      <th class="px-4 py-3 text-center font-bold text-slate-800">Tồn cuối</th>
                      <th class="px-4 py-3 text-center">ĐVT</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <template x-for="p in getFilteredProducts()" :key="p.SKU">
                      <tr class="hover:bg-slate-50/30 transition-colors">
                        <td class="px-4 py-3 font-bold font-mono text-blue-600" x-text="p.SKU"></td>
                        <td class="px-4 py-3 font-semibold text-slate-800" x-text="p.TEN_SP"></td>
                        <td class="px-4 py-3 text-slate-500" x-text="p.THUONG_HIEU"></td>
                        <td class="px-4 py-3 text-slate-700 font-mono" x-text="Number(p.SPH).toFixed(2)"></td>
                        <td class="px-4 py-3 text-slate-700 font-mono" x-text="Number(p.CYL).toFixed(2)"></td>
                        <td class="px-4 py-3 text-center text-slate-400 font-mono" x-text="p.TON_DAU"></td>
                        <td class="px-4 py-3 text-center text-amber-600 font-mono font-semibold" x-text="p.NHAP"></td>
                        <td class="px-4 py-3 text-center text-blue-600 font-mono font-semibold" x-text="p.XUAT"></td>
                        <td class="px-4 py-3 text-center font-bold text-slate-800 font-mono">
                          <span :class="Number(p.TON_CUOI) <= Number(p.TON_TOI_THIEU) ? 'bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100 flex items-center justify-center gap-1 max-w-[60px] mx-auto' : ''">
                            <span x-text="p.TON_CUOI"></span>
                            <span x-show="Number(p.TON_CUOI) <= Number(p.TON_TOI_THIEU)" class="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                          </span>
                        </td>
                        <td class="px-4 py-3 text-center text-slate-400" x-text="p.DVT || 'Cái'"></td>
                      </tr>
                    </template>
                    <template x-if="getFilteredProducts().length === 0">
                      <tr>
                        <td colspan="10" class="px-4 py-10 text-center text-slate-400">Không có sản phẩm nào được tìm thấy.</td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <!-- ==================== TAB 3: TRANSACTION FORM ==================== -->
          <div x-show="activeTab === 'TX_FORM'" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <!-- Trái: Header Phiếu -->
            <div class="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm space-y-4 lg:col-span-1 h-fit">
              <h3 class="heading-font font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2.5">Thông tin Phiếu</h3>
              
              <div class="space-y-4 text-xs">
                <div>
                  <label class="block text-slate-500 font-bold mb-1.5">Loại phiếu xuất nhập</label>
                  <div class="grid grid-cols-2 gap-2">
                    <button @click="formTxType = 'NHẬP'" :class="formTxType === 'NHẬP' ? 'bg-amber-500 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'" class="py-2.5 rounded-xl cursor-pointer transition-colors text-center font-bold">
                      📥 NHẬP KHO
                    </button>
                    <button @click="formTxType = 'XUẤT'" :class="formTxType === 'XUẤT' ? 'bg-blue-600 text-white font-bold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'" class="py-2.5 rounded-xl cursor-pointer transition-colors text-center font-bold">
                      📤 XUẤT KHO
                    </button>
                  </div>
                </div>

                <div>
                  <label class="block text-slate-500 font-bold mb-1.5">Chi nhánh thực hiện</label>
                  <select x-model="formTxBranch" class="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
                    <template x-for="b in chiNhanhs" :key="b.CHI_NHANH">
                      <option :value="b.CHI_NHANH" x-text="b.CHI_NHANH"></option>
                    </template>
                  </select>
                </div>

                <div>
                  <label class="block text-slate-500 font-bold mb-1.5">Ghi chú phiếu</label>
                  <textarea x-model="formTxNote" rows="3" placeholder="Nhập lý do xuất nhập, số hóa đơn đỏ, hoặc tên khách hàng..." class="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"></textarea>
                </div>
              </div>
            </div>

            <!-- Phải: Chi tiết các dòng SKU -->
            <div class="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm space-y-4 lg:col-span-2 flex flex-col h-[520px]">
              <div class="flex items-center justify-between border-b border-slate-50 pb-2.5 shrink-0">
                <h3 class="heading-font font-bold text-slate-800 text-xs uppercase">Chi tiết danh sách SKU</h3>
                <button @click="addFormItem()" class="px-3.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1">
                  ➕ Thêm dòng
                </button>
              </div>

              <!-- Container Các Dòng -->
              <div class="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                <template x-for="(item, index) in formTxItems" :key="index">
                  <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 relative">
                    <button @click="removeFormItem(index)" class="absolute top-2 right-2 text-slate-400 hover:text-red-500 cursor-pointer p-1">
                      ❌
                    </button>
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <!-- Chọn SKU -->
                      <div class="md:col-span-7">
                        <label class="block text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wide">Chọn sản phẩm (SKU) - [TỒN CUỐI]</label>
                        <select x-model="item.sku" class="w-full px-2 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none">
                          <option value="">-- Chọn SKU tròng kính --</option>
                          <template x-for="p in sanPhams" :key="p.SKU">
                            <option :value="p.SKU" x-text="p.SKU + ' - ' + p.TEN_SP + ' (Tồn: ' + p.TON_CUOI + ')'"></option>
                          </template>
                        </select>
                      </div>
                      <!-- Số lượng -->
                      <div class="md:col-span-2">
                        <label class="block text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wide">Số lượng</label>
                        <input type="number" x-model="item.qty" min="1" class="w-full px-2 py-1.5 border border-slate-200 rounded-xl bg-white font-mono text-center">
                      </div>
                      <!-- Ghi chú dòng -->
                      <div class="md:col-span-3">
                        <label class="block text-[10px] text-slate-400 font-bold mb-1 uppercase tracking-wide">Ghi chú dòng</label>
                        <input type="text" x-model="item.note" placeholder="Lỗi, trầy..." class="w-full px-2 py-2 border border-slate-200 rounded-xl bg-white">
                      </div>
                    </div>
                  </div>
                </template>

                <template x-if="formTxItems.length === 0">
                  <div class="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 py-20">
                    <svg class="w-12 h-12 text-slate-300 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                    <p class="text-xs font-semibold">Chưa có dòng SKU nào. Nhấn "Thêm dòng" để bắt đầu thiết lập phiếu!</p>
                  </div>
                </template>
              </div>

              <!-- Lưu hóa đơn -->
              <div class="pt-3.5 border-t border-slate-100 shrink-0 flex justify-end">
                <button @click="submitTransactionForm()" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-md shadow-blue-500/10 flex items-center gap-1.5">
                  💾 Lưu & Đồng bộ lên Google Sheets
                </button>
              </div>
            </div>

          </div>

          <!-- ==================== TAB 4: TRANSACTION HISTORY ==================== -->
          <div x-show="activeTab === 'TX_HISTORY'" class="space-y-4">
            
            <!-- Tìm kiếm phiếu -->
            <div class="bg-white p-4 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col sm:flex-row gap-3">
              <input type="text" x-model="historySearchQuery" placeholder="🔍 Tìm kiếm theo mã phiếu, chi nhánh, ghi chú, người tạo..." class="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <button @click="historySearchQuery = ''" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer">Xóa bộ lọc</button>
            </div>

            <div class="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50/50 text-slate-400 font-bold uppercase border-b border-slate-100">
                    <tr>
                      <th class="px-6 py-3">Mã hóa đơn</th>
                      <th class="px-6 py-3">Ngày lập</th>
                      <th class="px-6 py-3">Phân loại</th>
                      <th class="px-6 py-3">Chi nhánh</th>
                      <th class="px-6 py-3 text-center">Tổng SL</th>
                      <th class="px-6 py-3 font-mono">Người tạo</th>
                      <th class="px-6 py-3">Ghi chú</th>
                      <th class="px-6 py-3 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <template x-for="t in getFilteredHistory()" :key="t.HOA_DON">
                      <tr class="hover:bg-slate-50/30 transition-colors">
                        <td class="px-6 py-4 font-bold text-slate-800 font-mono" x-text="t.HOA_DON"></td>
                        <td class="px-6 py-4 text-slate-500" x-text="t.NGAY"></td>
                        <td class="px-6 py-4">
                          <span :class="t.LOAI === 'NHẬP' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-blue-50 text-blue-700 border border-blue-100'" class="px-2.5 py-1 rounded-full font-bold text-[10px]" x-text="t.LOAI"></span>
                        </td>
                        <td class="px-6 py-4 text-slate-700 font-medium" x-text="t.CHI_NHANH"></td>
                        <td class="px-6 py-4 text-center font-bold text-slate-800 font-mono" x-text="t.TONG_SL"></td>
                        <td class="px-6 py-4 text-slate-400 font-mono" x-text="t.TEN_NGUOI_TAO || t.NGUOI_TAO"></td>
                        <td class="px-6 py-4 text-slate-500 italic max-w-xs truncate" x-text="t.GHI_CHU || '-'"></td>
                        <td class="px-6 py-4 text-center">
                          <div class="flex items-center justify-center gap-1.5">
                            <!-- Xem chi tiết -->
                            <button @click="showInvoiceDetails(t.HOA_DON)" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 hover:text-blue-600 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer">
                              👁️ Xem
                            </button>
                            <!-- Rollback (Chỉ dành cho Admin/Kho) -->
                            <template x-if="currentUser.role !== 'NHAN_VIEN'">
                              <button @click="rollbackTransaction(t.HOA_DON)" class="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-[10px] font-bold cursor-pointer">
                                🗑️ Hủy
                              </button>
                            </template>
                          </div>
                        </td>
                      </tr>
                    </template>
                    <template x-if="getFilteredHistory().length === 0">
                      <tr>
                        <td colspan="8" class="px-6 py-8 text-center text-slate-400">Không tìm thấy phiếu nào thỏa mãn điều kiện lọc.</td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <!-- ==================== TAB 5: AUDIT ==================== -->
          <div x-show="activeTab === 'AUDIT'" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <!-- Form Kiểm Kho -->
            <div class="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm space-y-4 lg:col-span-1 h-fit">
              <h3 class="heading-font font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2.5">Phiếu Kiểm kê vật lý</h3>
              
              <div class="space-y-4 text-xs">
                <div>
                  <label class="block text-slate-500 font-bold mb-1.5">Chọn SKU tròng kính cần kiểm</label>
                  <select x-model="auditSku" class="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
                    <option value="">-- Chọn SKU --</option>
                    <template x-for="p in sanPhams" :key="p.SKU">
                      <option :value="p.SKU" x-text="p.SKU + ' - ' + p.TEN_SP"></option>
                    </template>
                  </select>
                </div>

                <!-- Tồn hệ thống đọc từ state -->
                <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tồn hệ thống</span>
                  <p class="text-xl font-mono font-bold text-slate-850" x-text="getAuditSystemStock()"></p>
                </div>

                <div>
                  <label class="block text-slate-500 font-bold mb-1.5">Tồn thực tế vật lý ngoài kệ</label>
                  <input type="number" x-model="auditActual" min="0" class="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-center font-bold">
                </div>

                <!-- Chênh lệch tính toán tự động -->
                <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Lượng chênh lệch</span>
                    <span :class="getAuditLech() > 0 ? 'text-emerald-600' : getAuditLech() < 0 ? 'text-rose-600' : 'text-slate-400'" class="font-mono font-bold text-sm" x-text="(getAuditLech() > 0 ? '+' : '') + getAuditLech()"></span>
                  </div>
                  <div class="flex items-center justify-between border-t border-slate-200/50 pt-2">
                    <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hành động bù trừ</span>
                    <span class="font-bold text-slate-700" x-text="getAuditLoaiBu()"></span>
                  </div>
                </div>

                <button @click="submitAuditForm()" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm">
                  🔍 Xác Nhận & Bù Trừ Tồn Kho
                </button>
              </div>
            </div>

            <!-- Nhật Ký Kiểm Kho -->
            <div class="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm space-y-4 lg:col-span-2 overflow-hidden flex flex-col">
              <h3 class="heading-font font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2.5">Nhật ký lịch sử các phiếu kiểm kho</h3>
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50/50 text-slate-400 font-bold uppercase border-b border-slate-100">
                    <tr>
                      <th class="px-4 py-2">Mã phiếu</th>
                      <th class="px-4 py-2">SKU</th>
                      <th class="px-4 py-2 text-center">Hệ thống</th>
                      <th class="px-4 py-2 text-center">Thực tế</th>
                      <th class="px-4 py-2 text-center">Chênh lệch</th>
                      <th class="px-4 py-2">Nghiệp vụ</th>
                      <th class="px-4 py-2">Người kiểm</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <template x-for="k in kiemKhos" :key="k.MA_PHIEU">
                      <tr class="hover:bg-slate-50/30 transition-colors">
                        <td class="px-4 py-3 font-bold text-slate-800 font-mono" x-text="k.MA_PHIEU"></td>
                        <td class="px-4 py-3 font-bold font-mono text-blue-600" x-text="k.SKU"></td>
                        <td class="px-4 py-3 text-center font-mono text-slate-400" x-text="k.TON_HE_THONG"></td>
                        <td class="px-4 py-3 text-center font-mono text-slate-700 font-bold" x-text="k.TON_THUC_TE"></td>
                        <td class="px-4 py-3 text-center font-mono font-bold">
                          <span :class="Number(k.LECH) > 0 ? 'text-emerald-600' : Number(k.LECH) < 0 ? 'text-red-600' : 'text-slate-400'" x-text="(Number(k.LECH) > 0 ? '+' : '') + k.LECH"></span>
                        </td>
                        <td class="px-4 py-3 font-medium text-[10px] text-slate-500" x-text="k.LOAI_BU"></td>
                        <td class="px-4 py-3 text-slate-400 font-mono text-[10px]" x-text="k.NGUOI_KIEM.split('@')[0]"></td>
                      </tr>
                    </template>
                    <template x-if="kiemKhos.length === 0">
                      <tr>
                        <td colspan="7" class="px-4 py-8 text-center text-slate-400">Không có phiếu kiểm kê nào được lưu.</td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <!-- ==================== TAB 6: CATEGORIES & DM ==================== -->
          <div x-show="activeTab === 'CATEGORIES'" class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <!-- 1. THƯƠNG HIỆU -->
              <div class="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm space-y-4">
                <div class="flex items-center justify-between border-b border-slate-50 pb-2.5">
                  <h3 class="heading-font font-bold text-slate-800 text-xs uppercase">Thương hiệu kính</h3>
                  <button @click="openAddBrandForm()" class="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-lg cursor-pointer">➕ Thêm mới</button>
                </div>
                <div class="overflow-x-auto max-h-[250px]">
                  <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50 text-slate-400 font-bold uppercase">
                      <tr>
                        <th class="px-4 py-2">Thương hiệu</th>
                        <th class="px-4 py-2">Xuất xứ</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      <template x-for="b in thuongHieus" :key="b.THUONG_HIEU">
                        <tr>
                          <td class="px-4 py-2.5 font-bold text-slate-800" x-text="b.THUONG_HIEU"></td>
                          <td class="px-4 py-2.5 text-slate-500 font-medium" x-text="b.QUOC_GIA || 'Chưa cập nhật'"></td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- 2. CHI NHÁNH -->
              <div class="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm space-y-4">
                <div class="flex items-center justify-between border-b border-slate-50 pb-2.5">
                  <h3 class="heading-font font-bold text-slate-800 text-xs uppercase">Chi nhánh hoạt động</h3>
                  <button @click="openAddBranchForm()" class="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-lg cursor-pointer">➕ Thêm mới</button>
                </div>
                <div class="overflow-x-auto max-h-[250px]">
                  <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50 text-slate-400 font-bold uppercase">
                      <tr>
                        <th class="px-4 py-2">Tên chi nhánh</th>
                        <th class="px-4 py-2">Địa chỉ</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      <template x-for="b in chiNhanhs" :key="b.CHI_NHANH">
                        <tr>
                          <td class="px-4 py-2.5 font-bold text-slate-800" x-text="b.CHI_NHANH"></td>
                          <td class="px-4 py-2.5 text-slate-500" x-text="b.DIA_CHI || 'Chưa cập nhật'"></td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            <!-- 3. NHÂN VIÊN & PHÂN QUYỀN (CHỈ ADMIN THẤY) -->
            <template x-if="currentUser.role === 'ADMIN'">
              <div class="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm space-y-4">
                <div class="flex items-center justify-between border-b border-slate-50 pb-2.5">
                  <h3 class="heading-font font-bold text-slate-800 text-xs uppercase">👥 Danh sách Nhân Viên & Quyền ghi hệ thống</h3>
                  <button @click="openAddStaffForm()" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm">➕ Thêm Nhân Viên Mới</button>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50 text-slate-400 font-bold uppercase">
                      <tr>
                        <th class="px-4 py-2">Họ và tên</th>
                        <th class="px-4 py-2 font-mono">Email đăng nhập</th>
                        <th class="px-4 py-2">Vai trò</th>
                        <th class="px-4 py-2">Chi nhánh</th>
                        <th class="px-4 py-2 text-center">Quyền ghi</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      <template x-for="n in nhanViens" :key="n.EMAIL">
                        <tr class="hover:bg-slate-50/50">
                          <td class="px-4 py-3 font-semibold text-slate-800" x-text="n.HO_TEN"></td>
                          <td class="px-4 py-3 text-slate-500 font-mono" x-text="n.EMAIL"></td>
                          <td class="px-4 py-3">
                            <span :class="n.ROLE === 'ADMIN' ? 'bg-red-50 text-red-700 border-red-100' : n.ROLE === 'KHO' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'" class="px-2 py-0.5 border rounded-full font-bold text-[9px]" x-text="n.ROLE"></span>
                          </td>
                          <td class="px-4 py-3 text-slate-700 font-medium" x-text="n.CHI_NHANH"></td>
                          <td class="px-4 py-3 text-center font-bold">
                            <span :class="n.WRITE_ACCESS ? 'text-emerald-600' : 'text-slate-400'" x-text="n.WRITE_ACCESS ? 'Có' : 'Không'"></span>
                          </td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
          </div>

        </div>

        <!-- Footer -->
        <footer class="bg-white border-t border-slate-200 py-3.5 px-6 text-center text-xs text-slate-400 shrink-0">
          <p>© 2026 Glass Stock Pro. Đồng bộ thời gian thực 100% với Google Sheets của bạn.</p>
        </footer>
      </main>

    </div>
  </template>


  <!-- ==================== MODAL: XEM CHI TIẾT HÓA ĐƠN GIAO DỊCH ==================== -->
  <div x-show="showInvoiceDetailModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 flex items-center justify-center p-4" style="display: none;">
    <div class="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden" @click.away="showInvoiceDetailModal = false">
      <!-- Header -->
      <div class="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h3 class="heading-font font-bold text-sm tracking-wide" x-text="'CHI TIẾT PHIẾU ' + selectedInvoiceId"></h3>
          <p class="text-[9px] font-mono text-slate-400">Danh sách các SKU tròng kính trong giao dịch này</p>
        </div>
        <button @click="showInvoiceDetailModal = false" class="text-slate-400 hover:text-white text-lg p-1.5 cursor-pointer">❌</button>
      </div>
      <!-- Body -->
      <div class="p-6 flex-1 overflow-y-auto text-xs space-y-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div>
            <span class="text-slate-400 font-bold uppercase text-[9px]">Ngày tạo</span>
            <p class="font-semibold text-slate-800" x-text="invoiceHeaderData?.NGAY || '-'"></p>
          </div>
          <div>
            <span class="text-slate-400 font-bold uppercase text-[9px]">Loại phiếu</span>
            <p class="font-bold text-slate-800" x-text="invoiceHeaderData?.LOAI || '-'"></p>
          </div>
          <div>
            <span class="text-slate-400 font-bold uppercase text-[9px]">Chi nhánh</span>
            <p class="font-semibold text-slate-800" x-text="invoiceHeaderData?.CHI_NHANH || '-'"></p>
          </div>
          <div>
            <span class="text-slate-400 font-bold uppercase text-[9px]">Người tạo</span>
            <p class="font-mono text-slate-600" x-text="invoiceHeaderData?.TEN_NGUOI_TAO || invoiceHeaderData?.NGUOI_TAO || '-'"></p>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-slate-100 text-slate-500 font-bold uppercase border-b border-slate-250">
              <tr>
                <th class="px-4 py-2.5">SKU</th>
                <th class="px-4 py-2.5">Tên sản phẩm</th>
                <th class="px-4 py-2.5">Thương hiệu</th>
                <th class="px-4 py-2.5">Cầu (SPH)</th>
                <th class="px-4 py-2.5">Loạn (CYL)</th>
                <th class="px-4 py-2.5 text-center">Số lượng</th>
                <th class="px-4 py-2.5">Ghi chú dòng</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <template x-for="line in invoiceDetailLines" :key="line.ID">
                <tr class="hover:bg-slate-50/50">
                  <td class="px-4 py-2.5 font-bold font-mono text-blue-600" x-text="line.SKU"></td>
                  <td class="px-4 py-2.5 font-semibold text-slate-800" x-text="line.TEN_SP"></td>
                  <td class="px-4 py-2.5 text-slate-500" x-text="line.THUONG_HIEU"></td>
                  <td class="px-4 py-2.5 text-slate-700 font-mono" x-text="Number(line.SPH).toFixed(2)"></td>
                  <td class="px-4 py-2.5 text-slate-700 font-mono" x-text="Number(line.CYL).toFixed(2)"></td>
                  <td class="px-4 py-2.5 text-center font-bold text-slate-800 font-mono" x-text="line.SO_LUONG"></td>
                  <td class="px-4 py-2.5 text-slate-400 italic" x-text="line.GHI_CHU || '-'"></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>


  <!-- ==================== MODAL: THÊM SẢN PHẨM MỚI (ADD PRODUCT) ==================== -->
  <div x-show="showAddProductModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 flex items-center justify-center p-4" style="display: none;">
    <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden" @click.away="showAddProductModal = false">
      <div class="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <h3 class="heading-font font-bold text-sm">➕ THÊM SẢN PHẨM TRÒNG KÍNH MỚI</h3>
        <button @click="showAddProductModal = false" class="text-slate-400 hover:text-white text-lg p-1">❌</button>
      </div>
      <form @submit.prevent="submitAddProduct" class="p-6 text-xs space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-500 font-bold mb-1">Mã SKU (Duy nhất)</label>
            <input type="text" x-model="newProd.SKU" placeholder="Vd: SKU001" required class="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase font-bold bg-slate-50">
          </div>
          <div>
            <label class="block text-slate-500 font-bold mb-1">Tên sản phẩm</label>
            <input type="text" x-model="newProd.TEN_SP" placeholder="Tên mắt kính..." required class="w-full px-3 py-2 border border-slate-200 rounded-xl">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-500 font-bold mb-1">Thương hiệu</label>
            <select x-model="newProd.THUONG_HIEU" required class="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white">
              <option value="">-- Chọn thương hiệu --</option>
              <template x-for="b in thuongHieus" :key="b.THUONG_HIEU">
                <option :value="b.THUONG_HIEU" x-text="b.THUONG_HIEU"></option>
              </template>
            </select>
          </div>
          <div>
            <label class="block text-slate-500 font-bold mb-1">Đơn vị tính</label>
            <input type="text" x-model="newProd.DVT" placeholder="Vd: Cái, Cặp" class="w-full px-3 py-2 border border-slate-200 rounded-xl">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-500 font-bold mb-1">Cầu (SPH)</label>
            <input type="number" step="0.25" x-model="newProd.SPH" placeholder="Vd: -2.00" required class="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-center">
          </div>
          <div>
            <label class="block text-slate-500 font-bold mb-1">Loạn (CYL)</label>
            <input type="number" step="0.25" x-model="newProd.CYL" placeholder="Vd: -0.50" required class="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-center">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-slate-500 font-bold mb-1">Tồn kho ban đầu (Dầu kỳ)</label>
            <input type="number" x-model="newProd.TON_DAU" min="0" required class="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-center font-bold">
          </div>
          <div>
            <label class="block text-slate-500 font-bold mb-1">Ngưỡng tồn tối thiểu</label>
            <input type="number" x-model="newProd.TON_TOI_THIEU" min="0" required class="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-center">
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <button type="button" @click="showAddProductModal = false" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold">Đóng</button>
          <button type="submit" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/10">Lưu sản phẩm</button>
        </div>
      </form>
    </div>
  </div>


  <!-- ==================== DIALOG BOX THÊM NHANH DANH MỤC THƯƠNG HIỆU / CHI NHÁNH / NHÂN VIÊN ==================== -->
  <div x-show="showGenericModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 flex items-center justify-center p-4" style="display: none;">
    <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden" @click.away="showGenericModal = false">
      <div class="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <h3 class="heading-font font-bold text-sm" x-text="genericModalTitle"></h3>
        <button @click="showGenericModal = false" class="text-slate-400 hover:text-white text-lg p-1">❌</button>
      </div>
      <form @submit.prevent="submitGenericForm" class="p-6 text-xs space-y-4">
        
        <!-- THƯƠNG HIỆU -->
        <div x-show="genericModalType === 'BRAND'" class="space-y-4">
          <div>
            <label class="block text-slate-500 font-bold mb-1">Tên thương hiệu</label>
            <input type="text" x-model="brandData.THUONG_HIEU" placeholder="Vd: Essilor, Zeiss" class="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold">
          </div>
          <div>
            <label class="block text-slate-500 font-bold mb-1">Quốc gia xuất xứ</label>
            <input type="text" x-model="brandData.QUOC_GIA" placeholder="Vd: Pháp, Đức, Nhật" class="w-full px-3 py-2 border border-slate-200 rounded-xl">
          </div>
        </div>

        <!-- CHI NHÁNH -->
        <div x-show="genericModalType === 'BRANCH'" class="space-y-4">
          <div>
            <label class="block text-slate-500 font-bold mb-1">Tên chi nhánh cửa hàng</label>
            <input type="text" x-model="branchData.CHI_NHANH" placeholder="Vd: Chi nhánh Quận 3" class="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold">
          </div>
          <div>
            <label class="block text-slate-500 font-bold mb-1">Địa chỉ chi tiết</label>
            <input type="text" x-model="branchData.DIA_CHI" placeholder="Vd: 123 Nguyễn Thị Minh Khai..." class="w-full px-3 py-2 border border-slate-200 rounded-xl">
          </div>
        </div>

        <!-- NHÂN VIÊN -->
        <div x-show="genericModalType === 'STAFF'" class="space-y-4">
          <div>
            <label class="block text-slate-500 font-bold mb-1">Họ và tên nhân viên</label>
            <input type="text" x-model="staffData.HO_TEN" placeholder="Vd: Nguyễn Văn A" class="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold">
          </div>
          <div>
            <label class="block text-slate-500 font-bold mb-1">Email đăng nhập</label>
            <input type="email" x-model="staffData.EMAIL" placeholder="Vd: nv.a@gmail.com" class="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-500 font-bold mb-1">Vai trò</label>
              <select x-model="staffData.ROLE" class="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white">
                <option value="NHAN_VIEN">NHÂN VIÊN</option>
                <option value="KHO">THỦ KHO</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div>
              <label class="block text-slate-500 font-bold mb-1">Quyền ghi</label>
              <select x-model="staffData.WRITE_ACCESS" class="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white">
                <option value="false">Không</option>
                <option value="true">Có</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-slate-500 font-bold mb-1">Trực thuộc Chi nhánh</label>
            <select x-model="staffData.CHI_NHANH" class="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white">
              <template x-for="b in chiNhanhs" :key="b.CHI_NHANH">
                <option :value="b.CHI_NHANH" x-text="b.CHI_NHANH"></option>
              </template>
            </select>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <button type="button" @click="showGenericModal = false" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold">Đóng</button>
          <button type="submit" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/10">Lưu dữ liệu</button>
        </div>
      </form>
    </div>
  </div>


  <!-- ==================== ALPINE JS ENGINE ==================== -->
  <script>
    function app() {
      return {
        // --- Core State ---
        isLoading: true,
        loadingText: 'Đang tải dữ liệu ban đầu...',
        activeTab: 'DASHBOARD',
        currentUser: null,
        userEmail: 'nhanvien@glassstockpro.com',

        // --- Database Arrays ---
        sanPhams: [],
        nhapXuats: [],
        nhapXuatCTs: [],
        kiemKhos: [],
        thuongHieus: [],
        chiNhanhs: [],
        nhanViens: [],

        // --- Login Form State ---
        loginUsername: '',
        loginPassword: '',
        loginError: '',

        // --- Tab Products Filters ---
        productSearchQuery: '',
        productBrandFilter: '',
        productStockFilter: 'ALL',

        // --- Tab History Filters ---
        historySearchQuery: '',

        // --- Invoice Details Modal ---
        showInvoiceDetailModal: false,
        selectedInvoiceId: '',
        invoiceHeaderData: null,
        invoiceDetailLines: [],

        // --- Form Add Product ---
        showAddProductModal: false,
        newProd: {
          SKU: '',
          TEN_SP: '',
          THUONG_HIEU: '',
          CHIET_XUAT: '1.56',
          TINH_NANG: 'Chống phản quang',
          SPH: 0,
          CYL: 0,
          TON_DAU: 0,
          NHAP: 0,
          XUAT: 0,
          TON_CUOI: 0,
          TON_TOI_THIEU: 2,
          DVT: 'Cái'
        },

        // --- Form Transaction ---
        formTxType: 'NHẬP',
        formTxBranch: '',
        formTxNote: '',
        formTxItems: [],

        // --- Form Audit ---
        auditSku: '',
        auditActual: 0,

        // --- Generic Modal Add Brand/Branch/Staff ---
        showGenericModal: false,
        genericModalType: 'BRAND',
        genericModalTitle: '',
        brandData: { THUONG_HIEU: '', QUOC_GIA: '' },
        branchData: { CHI_NHANH: '', DIA_CHI: '' },
        staffData: { EMAIL: '', HO_TEN: '', ROLE: 'NHAN_VIEN', CHI_NHANH: '', WRITE_ACCESS: false },

        // --- Initialize ---
        init() {
          // Lấy user cũ nếu có lưu
          const savedUser = localStorage.getItem('GAS_CURRENT_USER');
          if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            // Theo phân quyền, tự động đổi tab nếu là NHAN_VIEN
            if (this.currentUser.role === 'NHAN_VIEN') {
              this.activeTab = 'PRODUCTS';
            }
          }
          this.refreshData();
        },

        // --- ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEETS ---
        refreshData(showSuccessAlert = false) {
          this.isLoading = true;
          this.loadingText = 'Đang kết nối API và tải cơ sở dữ liệu Sheets...';
          
          if (typeof google !== 'undefined') {
            google.script.run
              .withSuccessHandler((res) => {
                if (res && res.success !== false) {
                  this.sanPhams = res.sanPhams || [];
                  this.nhapXuats = res.nhapXuats || [];
                  this.nhapXuatCTs = res.nhapXuatCTs || [];
                  this.kiemKhos = res.kiemKhos || [];
                  this.thuongHieus = res.thuongHieus || [];
                  this.chiNhanhs = res.chiNhanhs || [];
                  this.nhanViens = res.nhanViens || [];
                  this.userEmail = res.userEmail || 'nhanvien@glassstockpro.com';

                  // Chọn mặc định chi nhánh cho lập phiếu
                  if (this.chiNhanhs.length > 0 && !this.formTxBranch) {
                    this.formTxBranch = this.chiNhanhs[0].CHI_NHANH;
                  }

                  if (showSuccessAlert) {
                    alert('Đã đồng bộ hóa 100% dữ liệu thời gian thực từ Google Sheets!');
                  }
                } else {
                  alert('Lỗi tải dữ liệu: ' + (res ? res.message : 'Chưa có cấu hình trang tính'));
                }
                this.isLoading = false;
              })
              .withFailureHandler((err) => {
                alert('Lỗi kết nối nghiêm trọng: ' + err.message);
                this.isLoading = false;
              })
              .getInitialData();
          } else {
            // Mock dữ liệu khi preview local
            this.userEmail = "Preview-Admin-Active";
            this.isLoading = false;
          }
        },

        // --- TIÊU ĐỀ TAB ---
        getTabTitle() {
          switch(this.activeTab) {
            case 'DASHBOARD': return '📊 TỔNG QUAN & PHÂN TÍCH KHO';
            case 'PRODUCTS': return '📦 DANH MỤC TRÒNG KÍNH HIỆN HÀNH';
            case 'TX_FORM': return '📝 LẬP PHIẾU XUẤT NHẬP KHO CHUẨN';
            case 'TX_HISTORY': return '📜 NHẬT KÝ LỊCH SỬ GIAO DỊCH';
            case 'AUDIT': return '🔍 PHIẾU KIỂM KÊ VẬT LÝ VÀ ĐIỀU CHỈNH';
            case 'CATEGORIES': return '📋 QUẢN LÝ THƯƠNG HIỆU & CHI NHÁNH';
            default: return 'Glass Stock Pro';
          }
        },

        // --- DASHBOARD CALCULATIONS ---
        getTotalStock() {
          return this.sanPhams.reduce((sum, p) => sum + (Number(p.TON_CUOI) || 0), 0);
        },
        getTotalNhap() {
          return this.nhapXuats.filter(t => t.LOAI === 'NHẬP').reduce((sum, t) => sum + (Number(t.TONG_SL) || 0), 0);
        },
        getTotalXuat() {
          return this.nhapXuats.filter(t => t.LOAI === 'XUẤT').reduce((sum, t) => sum + (Number(t.TONG_SL) || 0), 0);
        },

        // --- BIỂU ĐỒ BAR CHART THƯƠNG HIỆU ---
        getBrandStockData() {
          const map = {};
          this.sanPhams.forEach(p => {
            const b = p.THUONG_HIEU || 'Khác';
            if (!map[b]) map[b] = 0;
            map[b] += (Number(p.TON_CUOI) || 0);
          });

          const list = Object.keys(map).map(brand => ({
            brand: brand,
            stock: map[brand]
          }));

          list.sort((a,b) => b.stock - a.stock);
          const top5 = list.slice(0, 5);
          
          const maxStock = top5.length > 0 ? top5[0].stock : 1;
          return top5.map(item => ({
            ...item,
            percentage: Math.round((item.stock / maxStock) * 100)
          }));
        },

        // --- SẢN PHẨM FILTERS ---
        getFilteredProducts() {
          return this.sanPhams.filter(p => {
            const matchesSearch = !this.productSearchQuery || 
              p.SKU.toLowerCase().includes(this.productSearchQuery.toLowerCase()) || 
              p.TEN_SP.toLowerCase().includes(this.productSearchQuery.toLowerCase());
            
            const matchesBrand = !this.productBrandFilter || p.THUONG_HIEU === this.productBrandFilter;
            
            const matchesStock = this.productStockFilter === 'ALL' || 
              (this.productStockFilter === 'LOW' && Number(p.TON_CUOI) <= Number(p.TON_TOI_THIEU));

            return matchesSearch && matchesBrand && matchesStock;
          });
        },

        // --- HÓA ĐƠN CHI TIẾT MODAL ---
        showInvoiceDetails(invoiceId) {
          this.selectedInvoiceId = invoiceId;
          this.invoiceHeaderData = this.nhapXuats.find(h => h.HOA_DON === invoiceId) || null;
          this.invoiceDetailLines = this.nhapXuatCTs.filter(d => d.HOA_DON === invoiceId);
          this.showInvoiceDetailModal = true;
        },

        // --- LOGIN LOGIC ---
        handleLoginSubmit() {
          this.loginError = '';
          const userLower = this.loginUsername.trim().toLowerCase();
          const pass = this.loginPassword.trim();

          if (!userLower || !pass) {
            this.loginError = 'Vui lòng điền đầy đủ tài khoản và mật khẩu.';
            return;
          }

          // 1. Kiểm tra tài khoản cứng trước
          if (pass === '12345') {
            if (userLower === 'admin') {
              this.setLoginUser({ username: 'nguyenkienduc.digital@gmail.com', fullName: 'Nguyễn Kiến Đức', role: 'ADMIN', branch: 'Kho Trung Tâm', writeAccess: true });
              return;
            } else if (userLower === 'kho') {
              this.setLoginUser({ username: 'kho@gmail.com', fullName: 'Trần Văn Kho', role: 'KHO', branch: 'Kho Trung Tâm', writeAccess: true });
              return;
            } else if (userLower === 'nhanvien') {
              this.setLoginUser({ username: 'nhanvien@gmail.com', fullName: 'Lê Thị Bán Hàng', role: 'NHAN_VIEN', branch: 'Chi nhánh Quận 1', writeAccess: false });
              return;
            }
          }

          // 2. Tra cứu danh sách nhân viên từ Google Sheets
          const foundStaff = this.nhanViens.find(n => n.EMAIL.toLowerCase() === userLower);
          if (foundStaff && pass === '12345') {
            this.setLoginUser({
              username: foundStaff.EMAIL,
              fullName: foundStaff.HO_TEN,
              role: foundStaff.ROLE,
              branch: foundStaff.CHI_NHANH,
              writeAccess: String(foundStaff.WRITE_ACCESS) === 'true'
            });
            return;
          }

          this.loginError = 'Tên đăng nhập hoặc mật khẩu không chính xác. Hãy dùng 12345 để đăng nhập tài khoản gợi ý.';
        },

        setLoginUser(userObj) {
          this.currentUser = userObj;
          this.userEmail = userObj.username;
          localStorage.setItem('GAS_CURRENT_USER', JSON.stringify(userObj));
          this.loginUsername = '';
          this.loginPassword = '';
          // Theo phân quyền, tự động đổi tab
          if (userObj.role === 'NHAN_VIEN') {
            this.activeTab = 'PRODUCTS';
          } else {
            this.activeTab = 'DASHBOARD';
          }
        },

        quickLogin(roleType) {
          if (roleType === 'ADMIN') {
            this.loginUsername = 'admin';
          } else if (roleType === 'KHO') {
            this.loginUsername = 'kho';
          } else {
            this.loginUsername = 'nhanvien';
          }
          this.loginPassword = '12345';
          this.handleLoginSubmit();
        },

        handleLogout() {
          this.currentUser = null;
          localStorage.removeItem('GAS_CURRENT_USER');
          this.activeTab = 'DASHBOARD';
        },

        // --- THÊM SẢN PHẨM MỚI ---
        submitAddProduct() {
          this.isLoading = true;
          this.loadingText = 'Đang thêm sản phẩm mới vào Google Sheets...';
          
          this.newProd.SKU = this.newProd.SKU.trim().toUpperCase();
          this.newProd.TON_DAU = Number(this.newProd.TON_DAU);
          this.newProd.TON_CUOI = this.newProd.TON_DAU;
          this.newProd.TON_TOI_THIEU = Number(this.newProd.TON_TOI_THIEU);
          this.newProd.SPH = Number(this.newProd.SPH);
          this.newProd.CYL = Number(this.newProd.CYL);

          if (typeof google !== 'undefined') {
            google.script.run
              .withSuccessHandler((res) => {
                if (res && res.success) {
                  alert('Thêm sản phẩm thành công!');
                  this.showAddProductModal = false;
                  // reset form
                  this.newProd = { SKU: '', TEN_SP: '', THUONG_HIEU: '', CHIET_XUAT: '1.56', TINH_NANG: 'Chống phản quang', SPH: 0, CYL: 0, TON_DAU: 0, NHAP: 0, XUAT: 0, TON_CUOI: 0, TON_TOI_THIEU: 2, DVT: 'Cái' };
                  this.refreshData();
                } else {
                  alert('Lỗi: ' + (res ? res.message : 'Không xác định'));
                  this.isLoading = false;
                }
              })
              .withFailureHandler((err) => {
                alert('Lỗi: ' + err.message);
                this.isLoading = false;
              })
              .addNewProduct(this.newProd);
          } else {
            alert('Lưu sản phẩm (Giả lập Local): Thành công!');
            this.sanPhams.push({...this.newProd});
            this.showAddProductModal = false;
            this.isLoading = false;
          }
        },

        // --- FORM TRANSACTION ACTIONS ---
        addFormItem() {
          this.formTxItems.push({ sku: '', qty: 1, note: '' });
        },
        removeFormItem(index) {
          this.formTxItems.splice(index, 1);
        },
        submitTransactionForm() {
          if (this.formTxItems.length === 0) {
            alert('Vui lòng thêm ít nhất một sản phẩm vào danh sách!');
            return;
          }

          // Kiểm tra logic từng dòng
          for (let i = 0; i < this.formTxItems.length; i++) {
            const line = this.formTxItems[i];
            if (!line.sku) {
              alert('Dòng thứ ' + (i+1) + ' chưa chọn sản phẩm!');
              return;
            }
            if (Number(line.qty) <= 0) {
              alert('Dòng thứ ' + (i+1) + ' số lượng phải lớn hơn 0!');
              return;
            }

            // Kiểm tra xuất âm kho
            if (this.formTxType === 'XUẤT') {
              const prod = this.sanPhams.find(p => p.SKU === line.sku);
              const currentStock = prod ? (Number(prod.TON_CUOI) || 0) : 0;
              if (currentStock < Number(line.qty)) {
                alert('🚨 LỖI XUẤT ÂM KHO: SKU "' + line.sku + '" hiện chỉ còn ' + currentStock + ' cái, không đủ để xuất ' + line.qty + ' cái!');
                return;
              }
            }
          }

          this.isLoading = true;
          this.loadingText = 'Đang lưu phiếu xuất nhập và cập nhật tồn kho...';

          const headerData = {
            CHI_NHANH: this.formTxBranch,
            NGAY: new Date().toLocaleDateString('vi-VN'),
            LOAI: this.formTxType,
            TONG_SL: this.formTxItems.reduce((sum, item) => sum + Number(item.qty), 0),
            NGUOI_TAO: this.userEmail,
            TEN_NGUOI_TAO: this.currentUser.fullName,
            TG_TAO: new Date().toLocaleTimeString('vi-VN'),
            GHI_CHU: this.formTxNote
          };

          const listDetails = this.formTxItems.map((item, idx) => {
            const prod = this.sanPhams.find(p => p.SKU === item.sku) || {};
            return {
              ID: 'DT' + Date.now() + idx,
              SKU: item.sku,
              TEN_SP: prod.TEN_SP || '',
              THUONG_HIEU: prod.THUONG_HIEU || '',
              CHIET_XUAT: prod.CHIET_XUAT || '1.56',
              TINH_NANG: prod.TINH_NANG || 'Chống phản quang',
              SPH: Number(prod.SPH) || 0,
              CYL: Number(prod.CYL) || 0,
              SO_LUONG: Number(item.qty),
              DVT: prod.DVT || 'Cái',
              GHI_CHU: item.note,
              LOAI: this.formTxType,
              NGAY: headerData.NGAY
            };
          });

          if (typeof google !== 'undefined') {
            google.script.run
              .withSuccessHandler((res) => {
                if (res && res.success) {
                  alert('Lập phiếu xuất nhập thành công!');
                  this.formTxItems = [];
                  this.formTxNote = '';
                  this.refreshData();
                  this.activeTab = 'DASHBOARD';
                } else {
                  alert('Lỗi lưu phiếu: ' + (res ? res.message : 'Không xác định'));
                  this.isLoading = false;
                }
              })
              .withFailureHandler((err) => {
                alert('Lỗi lưu phiếu: ' + err.message);
                this.isLoading = false;
              })
              .createTransaction(headerData, listDetails);
          } else {
            alert('Lưu phiếu giả lập thành công!');
            this.formTxItems = [];
            this.formTxNote = '';
            this.isLoading = false;
          }
        },

        // --- ROLLBACK TRANSACTION ---
        rollbackTransaction(hoaDonId) {
          if (!confirm('Bạn có thực sự muốn HỦY và HOÀN TÁC tồn kho cho phiếu ' + hoaDonId + ' không?')) {
            return;
          }

          this.isLoading = true;
          this.loadingText = 'Đang hoàn tác và cân bằng lại số lượng tồn kho...';

          const relatedSkus = this.nhapXuatCTs
            .filter(d => d.HOA_DON === hoaDonId)
            .map(d => d.SKU);

          if (typeof google !== 'undefined') {
            google.script.run
              .withSuccessHandler((res) => {
                if (res && res.success) {
                  alert('Đã hủy phiếu và khôi phục lại kho thành công!');
                  this.refreshData();
                } else {
                  alert('Thất bại: ' + (res ? res.message : 'Không xác định'));
                  this.isLoading = false;
                }
              })
              .withFailureHandler((err) => {
                alert('Lỗi: ' + err.message);
                this.isLoading = false;
              })
              .deleteTransactionAndRollback(hoaDonId, relatedSkus);
          } else {
            alert('Hủy giả lập thành công!');
            this.isLoading = false;
          }
        },

        // --- LỌC NHẬT KÝ LỊCH SỬ ---
        getFilteredHistory() {
          return this.nhapXuats.filter(t => {
            if (!this.historySearchQuery) return true;
            const q = this.historySearchQuery.toLowerCase();
            return t.HOA_DON.toLowerCase().includes(q) ||
              t.CHI_NHANH.toLowerCase().includes(q) ||
              (t.GHI_CHU && t.GHI_CHU.toLowerCase().includes(q)) ||
              t.NGUOI_TAO.toLowerCase().includes(q);
          });
        },

        // --- AUDIT ACTIONS ---
        getAuditSystemStock() {
          if (!this.auditSku) return 0;
          const prod = this.sanPhams.find(p => p.SKU === this.auditSku);
          return prod ? (Number(prod.TON_CUOI) || 0) : 0;
        },
        getAuditLech() {
          if (!this.auditSku) return 0;
          return Number(this.auditActual) - this.getAuditSystemStock();
        },
        getAuditLoaiBu() {
          const l = this.getAuditLech();
          if (l > 0) return 'NHẬP BÙ (Lệch Dương)';
          if (l < 0) return 'XUẤT BÙ (Lệch Âm)';
          return 'CÂN BẰNG (Không bù)';
        },
        submitAuditForm() {
          if (!this.auditSku) {
            alert('Vui lòng chọn sản phẩm cần kiểm kê!');
            return;
          }

          this.isLoading = true;
          this.loadingText = 'Đang đồng bộ bù trừ tồn kho kiểm kê...';

          const auditData = {
            MA_PHIEU: '',
            SKU: this.auditSku,
            TON_HE_THONG: this.getAuditSystemStock(),
            TON_THUC_TE: Number(this.auditActual),
            LECH: this.getAuditLech(),
            LOAI_BU: this.getAuditLoaiBu(),
            NGUOI_KIEM: this.userEmail,
            THOI_DIEM: new Date().toLocaleString('vi-VN')
          };

          if (typeof google !== 'undefined') {
            google.script.run
              .withSuccessHandler((res) => {
                if (res && res.success) {
                  alert('Cập nhật kiểm kho và bù trừ thành công!');
                  this.auditSku = '';
                  this.auditActual = 0;
                  this.refreshData();
                  this.activeTab = 'DASHBOARD';
                } else {
                  alert('Lỗi: ' + (res ? res.message : 'Không xác định'));
                  this.isLoading = false;
                }
              })
              .withFailureHandler((err) => {
                alert('Lỗi: ' + err.message);
                this.isLoading = false;
              })
              .recordInventoryAudit(auditData);
          } else {
            alert('Lưu kiểm kho giả lập thành công!');
            this.auditSku = '';
            this.auditActual = 0;
            this.isLoading = false;
          }
        },

        // --- GENERIC DIALOG FORM (BRAND / BRANCH / STAFF) ---
        openAddBrandForm() {
          this.genericModalType = 'BRAND';
          this.genericModalTitle = '➕ THÊM THƯƠNG HIỆU KÍNH MỚI';
          this.brandData = { THUONG_HIEU: '', QUOC_GIA: '' };
          this.showGenericModal = true;
        },
        openAddBranchForm() {
          this.genericModalType = 'BRANCH';
          this.genericModalTitle = '➕ THÊM CHI NHÁNH MỚI';
          this.branchData = { CHI_NHANH: '', DIA_CHI: '' };
          this.showGenericModal = true;
        },
        openAddStaffForm() {
          this.genericModalType = 'STAFF';
          this.genericModalTitle = '👥 THÊM NHÂN VIÊN MỚI';
          this.staffData = { EMAIL: '', HO_TEN: '', ROLE: 'NHAN_VIEN', CHI_NHANH: this.chiNhanhs.length > 0 ? this.chiNhanhs[0].CHI_NHANH : '', WRITE_ACCESS: 'false' };
          this.showGenericModal = true;
        },
        submitGenericForm() {
          this.isLoading = true;
          this.loadingText = 'Đang đồng bộ dữ liệu danh mục lên Sheets...';

          if (this.genericModalType === 'BRAND') {
            this.brandData.THUONG_HIEU = this.brandData.THUONG_HIEU.trim();
            if (!this.brandData.THUONG_HIEU) { alert('Vui lòng điền tên thương hiệu!'); this.isLoading = false; return; }

            if (typeof google !== 'undefined') {
              google.script.run
                .withSuccessHandler((res) => {
                  if (res && res.success) {
                    alert('Đã thêm thương hiệu thành công!');
                    this.showGenericModal = false;
                    this.refreshData();
                  } else { alert('Lỗi: ' + res.message); this.isLoading = false; }
                })
                .withFailureHandler((err) => { alert('Lỗi: ' + err.message); this.isLoading = false; })
                .addNewBrand(this.brandData);
            } else {
              this.thuongHieus.push({...this.brandData});
              this.showGenericModal = false;
              this.isLoading = false;
            }
          } 
          else if (this.genericModalType === 'BRANCH') {
            this.branchData.CHI_NHANH = this.branchData.CHI_NHANH.trim();
            if (!this.branchData.CHI_NHANH) { alert('Vui lòng điền tên chi nhánh!'); this.isLoading = false; return; }

            if (typeof google !== 'undefined') {
              google.script.run
                .withSuccessHandler((res) => {
                  if (res && res.success) {
                    alert('Đã thêm chi nhánh thành công!');
                    this.showGenericModal = false;
                    this.refreshData();
                  } else { alert('Lỗi: ' + res.message); this.isLoading = false; }
                })
                .withFailureHandler((err) => { alert('Lỗi: ' + err.message); this.isLoading = false; })
                .addNewBranch(this.branchData);
            } else {
              this.chiNhanhs.push({...this.branchData});
              this.showGenericModal = false;
              this.isLoading = false;
            }
          } 
          else if (this.genericModalType === 'STAFF') {
            this.staffData.EMAIL = this.staffData.EMAIL.trim().toLowerCase();
            this.staffData.HO_TEN = this.staffData.HO_TEN.trim();
            this.staffData.WRITE_ACCESS = this.staffData.WRITE_ACCESS === 'true';

            if (!this.staffData.EMAIL || !this.staffData.HO_TEN) {
              alert('Vui lòng điền đầy đủ Email và Họ tên nhân viên!');
              this.isLoading = false;
              return;
            }

            if (typeof google !== 'undefined') {
              google.script.run
                .withSuccessHandler((res) => {
                  if (res && res.success) {
                    alert('Đã thêm nhân viên mới thành công!');
                    this.showGenericModal = false;
                    this.refreshData();
                  } else { alert('Lỗi: ' + res.message); this.isLoading = false; }
                })
                .withFailureHandler((err) => { alert('Lỗi: ' + err.message); this.isLoading = false; })
                .addNewStaff(this.staffData);
            } else {
              this.nhanViens.push({...this.staffData});
              this.showGenericModal = false;
              this.isLoading = false;
            }
          }
        }
      };
    }
  </script>
</body>
</html>
`;
