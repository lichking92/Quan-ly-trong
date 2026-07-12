/**
 * =========================================================================
 * FILE: AppsScriptExporter.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Khung kết xuất mã nguồn và hướng dẫn chuyển giao hệ thống sang Google Apps Script.
 *        Cung cấp trọn vẹn Code.gs và Index.html được chuẩn hóa 100% tiếng Việt,
 *        tối ưu hóa tốc độ truy xuất Sheets, triển khai LockService tránh xung đột.
 * =========================================================================
 */

import React, { useState } from 'react';
import { 
  FileCode, 
  Copy, 
  Check, 
  HelpCircle, 
  Layers, 
  Terminal, 
  Info,
  BookOpen,
  ArrowUpRight
} from 'lucide-react';
import { codeGSContent } from './apps_script_code_gs';
import { indexHTMLContent } from './apps_script_index_html';

export default function AppsScriptExporter() {
  const [copiedCodeGS, setCopiedCodeGS] = useState<boolean>(false);
  const [copiedIndexHTML, setCopiedIndexHTML] = useState<boolean>(false);

  const handleCopy = (text: string, type: 'GS' | 'HTML') => {
    navigator.clipboard.writeText(text);
    if (type === 'GS') {
      setCopiedCodeGS(true);
      setTimeout(() => setCopiedCodeGS(false), 2000);
    } else {
      setCopiedIndexHTML(true);
      setTimeout(() => setCopiedIndexHTML(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* TIÊU ĐỀ */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Terminal className="w-5.5 h-5.5" />
          </div>
          <div>
            <h2 className="font-sans font-bold text-slate-800 text-base">Cổng Chuyển Giao Google Apps Script</h2>
            <p className="text-xs text-slate-400 font-mono">Đóng gói mã nguồn tinh gọn sẵn sàng dán trực tiếp vào Spreadsheet của bạn</p>
          </div>
        </div>
      </div>

      {/* 3 BƯỚC HƯỚNG DẪN CÀI ĐẶT */}
      <div className="bento-card bg-blue-50/10 !border-blue-100 !p-6 space-y-4">
        <h3 className="font-sans font-bold text-blue-900 text-sm flex items-center gap-1.5">
          <BookOpen className="w-4.5 h-4.5" /> Hướng Dẫn Triển Khai 3 Bước (Siêu Dễ)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-slate-600">
          <div className="space-y-1.5 bg-white p-4 rounded-xl border border-blue-100/50">
            <p className="font-bold text-blue-600 font-mono text-sm">Bước 1: Mở Apps Script</p>
            <p className="leading-relaxed">
              Truy cập vào trang tính Google Sheets của bạn. Vào menu <strong className="text-slate-800">Tiện ích mở rộng (Extensions)</strong> &gt; chọn <strong className="text-slate-800">Apps Script</strong>.
            </p>
          </div>

          <div className="space-y-1.5 bg-white p-4 rounded-xl border border-blue-100/50">
            <p className="font-bold text-blue-600 font-mono text-sm">Bước 2: Tạo tệp mã nguồn</p>
            <p className="leading-relaxed">
              Tạo tệp <strong className="font-mono text-slate-800">Code.gs</strong> (mặc định) và copy toàn bộ mã ở khung dưới dán vào. Tiếp theo nhấn dấu (+) để tạo thêm tệp HTML đặt tên là <strong className="font-mono text-slate-800">Index</strong> (Index.html) và dán mã HTML vào.
            </p>
          </div>

          <div className="space-y-1.5 bg-white p-4 rounded-xl border border-blue-100/50">
            <p className="font-bold text-blue-600 font-mono text-sm">Bước 3: Triển khai Web App</p>
            <p className="leading-relaxed">
              Nhấn nút <strong className="text-slate-800">Triển khai (Deploy)</strong> ở góc trên bên phải &gt; Chọn <strong className="text-slate-800">Triển khai mới</strong> &gt; Chọn loại <strong className="text-slate-800">Ứng dụng web</strong> &gt; Cấp quyền truy cập cho "Bất kỳ ai (Anyone)" và nhấn hoàn tất!
            </p>
          </div>
        </div>
      </div>

      {/* HIỂN THỊ HAI KHUNG SOẠN THẢO MÃ NGUỒN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* KHUNG CODE 1: Code.gs */}
        <div className="bento-card bg-slate-900 overflow-hidden !p-0 shadow-lg flex flex-col h-[500px] border border-slate-800">
          <div className="bg-slate-950 px-5 py-3 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span className="text-xs font-bold text-slate-300 font-mono">Code.gs (Google Apps Script Backend)</span>
            </div>
            
            <button
              onClick={() => handleCopy(codeGSContent, 'GS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                copiedCodeGS ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {copiedCodeGS ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedCodeGS ? 'Đã sao chép!' : 'Sao chép mã'}
            </button>
          </div>

          <div className="flex-1 p-4 overflow-auto font-mono text-[11px] text-slate-300 leading-relaxed bg-slate-900/90 select-all whitespace-pre">
            {codeGSContent}
          </div>
        </div>

        {/* KHUNG CODE 2: Index.html */}
        <div className="bento-card bg-slate-900 overflow-hidden !p-0 shadow-lg flex flex-col h-[500px] border border-slate-800">
          <div className="bg-slate-950 px-5 py-3 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              <span className="text-xs font-bold text-slate-300 font-mono">Index.html (Front-end Web App)</span>
            </div>
            
            <button
              onClick={() => handleCopy(indexHTMLContent, 'HTML')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                copiedIndexHTML ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {copiedIndexHTML ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedIndexHTML ? 'Đã sao chép!' : 'Sao chép mã'}
            </button>
          </div>

          <div className="flex-1 p-4 overflow-auto font-mono text-[11px] text-slate-300 leading-relaxed bg-slate-900/90 select-all whitespace-pre">
            {indexHTMLContent}
          </div>
        </div>

      </div>

    </div>
  );
}
