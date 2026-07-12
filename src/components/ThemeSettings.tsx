/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sun, Moon, Palette, Check, Save } from 'lucide-react';
import { motion } from 'motion/react';
import { User as UserType } from '../types';

/**
 * FILE: ThemeSettings.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Xử lý nghiệp vụ cấu hình cá nhân hóa giao diện (Theme & Accent Color).
 *        Lưu trữ riêng biệt theo từng tài khoản đăng nhập (Persist per user).
 *        Hỗ trợ xem trước trực quan và áp dụng tức thì.
 */

interface ThemeSettingsProps {
  currentUser: UserType;
  themeMode: 'light' | 'dark';
  accentColor: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  onUpdateTheme: (theme: 'light' | 'dark', accent: 'blue' | 'green' | 'orange' | 'red' | 'purple') => void;
}

const ACCENT_OPTIONS = [
  { id: 'blue', name: 'Xanh Dương (Blue)', hex: '#2563eb', bgClass: 'bg-blue-600', textClass: 'text-blue-600' },
  { id: 'green', name: 'Xanh Lá (Green)', hex: '#10b981', bgClass: 'bg-emerald-500', textClass: 'text-emerald-600' },
  { id: 'orange', name: 'Cam (Orange)', hex: '#f97316', bgClass: 'bg-orange-500', textClass: 'text-orange-500' },
  { id: 'red', name: 'Đỏ (Red)', hex: '#dc2626', bgClass: 'bg-red-600', textClass: 'text-red-600' },
  { id: 'purple', name: 'Tím (Purple)', hex: '#8b5cf6', bgClass: 'bg-violet-500', textClass: 'text-violet-600' },
] as const;

export default function ThemeSettings({
  currentUser,
  themeMode,
  accentColor,
  onUpdateTheme
}: ThemeSettingsProps) {

  const [localTheme, setLocalTheme] = useState<'light' | 'dark'>(themeMode);
  const [localAccent, setLocalAccent] = useState<'blue' | 'green' | 'orange' | 'red' | 'purple'>(accentColor);
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Đồng bộ với Props khi props thay đổi (ví dụ khi F5 hoặc đổi vai nhanh)
  useEffect(() => {
    setLocalTheme(themeMode);
    setLocalAccent(accentColor);
  }, [themeMode, accentColor]);

  const handleSaveSettings = () => {
    onUpdateTheme(localTheme, localAccent);
    setSuccessMsg('Đã lưu cấu hình giao diện cá nhân thành công!');
    setTimeout(() => {
      setSuccessMsg('');
    }, 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      
      {/* TIÊU ĐỀ COMPONENT */}
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
        <div className="p-2.5 bg-slate-100 text-slate-700 rounded-xl">
          <Palette className="w-5.5 h-5.5 text-title-color" />
        </div>
        <div>
          <h2 className="font-sans font-bold text-slate-800 text-base text-title-color">Cài Đặt Giao Diện Cá Nhân</h2>
          <p className="text-xs text-slate-400 font-medium text-desc-color">Tùy biến không gian làm việc, lưu trữ độc lập theo tài khoản</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {/* THẺ ĐIỀU CHỈNH CHÍNH (CÓ SHADOW VÀ LỚP BENTO CHUẨN) */}
      <div className="bento-card bg-white p-6 rounded-2xl shadow-md border border-slate-100 space-y-6">
        
        {/* CHỌN CHẾ ĐỘ SÁNG / TỐI */}
        <div className="space-y-3">
          <h3 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider text-title-color">
            Chế độ hiển thị (Theme Mode)
          </h3>
          <p className="text-[11px] text-slate-400 text-desc-color">Lựa chọn chế độ sáng hoặc tối phù hợp nhất với điều kiện ánh sáng của bạn</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* SÁNG */}
            <button
              type="button"
              onClick={() => setLocalTheme('light')}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left cursor-pointer ${
                localTheme === 'light'
                  ? 'border-red-500/30 bg-red-50/5 ring-2 ring-red-500/10'
                  : 'border-slate-150 bg-slate-50/50 hover:bg-slate-50'
              }`}
              style={{
                borderColor: localTheme === 'light' ? 'var(--accent-color)' : 'var(--border-color)',
                color: 'var(--text-main)'
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-500 rounded-lg">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-xs text-title-color">Chế độ sáng</p>
                  <p className="text-[10px] text-slate-400 text-desc-color">Thanh lịch, dễ quan sát ban ngày</p>
                </div>
              </div>
              {localTheme === 'light' && <Check className="w-4 h-4 text-red-500 shrink-0" style={{ color: 'var(--accent-color)' }} />}
            </button>

            {/* TỐI */}
            <button
              type="button"
              onClick={() => setLocalTheme('dark')}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left cursor-pointer ${
                localTheme === 'dark'
                  ? 'border-red-500/30 bg-slate-900/40 ring-2 ring-red-500/10'
                  : 'border-slate-150 bg-slate-50/50 hover:bg-slate-50'
              }`}
              style={{
                borderColor: localTheme === 'dark' ? 'var(--accent-color)' : 'var(--border-color)',
                color: 'var(--text-main)'
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 text-slate-300 rounded-lg">
                  <Moon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-xs text-title-color">Chế độ tối</p>
                  <p className="text-[10px] text-slate-400 text-desc-color">Bảo vệ mắt tối đa khi làm việc ban đêm</p>
                </div>
              </div>
              {localTheme === 'dark' && <Check className="w-4 h-4 text-red-500 shrink-0" style={{ color: 'var(--accent-color)' }} />}
            </button>
          </div>
        </div>

        {/* CHỌN TÔNG MÀU CHỦ ĐẠO (ACCENT COLOR) */}
        <div className="space-y-3 pt-2 border-t border-slate-100 border-theme">
          <h3 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider text-title-color">
            Tông màu chủ đạo (Accent Color)
          </h3>
          <p className="text-[11px] text-slate-400 text-desc-color">Thay đổi toàn bộ nút hành động, liên kết và điểm nhấn trên giao diện của bạn</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
            {ACCENT_OPTIONS.map((opt) => {
              const isSelected = localAccent === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLocalAccent(opt.id)}
                  className={`p-3 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-2 cursor-pointer ${
                    isSelected ? 'bg-slate-50/80 ring-2 ring-red-500/10' : 'bg-slate-50/20 hover:bg-slate-50'
                  }`}
                  style={{
                    borderColor: isSelected ? opt.hex : 'var(--border-color)',
                    color: 'var(--text-main)'
                  }}
                >
                  <div className={`w-8 h-8 rounded-full ${opt.bgClass} flex items-center justify-center text-white shadow-sm`}>
                    {isSelected && <Check className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-bold text-title-color">{opt.id.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* THÔNG TIN TÀI KHOẢN ĐANG CẤU HÌNH */}
        <div className="bg-slate-50 input-theme rounded-xl p-4 text-[11px] text-slate-500 text-desc-color flex items-center justify-between">
          <span>Tài khoản áp dụng: <strong>{currentUser.fullName} ({currentUser.username})</strong></span>
          <span className="font-mono text-[9px] bg-slate-200/50 px-2 py-0.5 rounded">PERSIST_PER_USER</span>
        </div>

        {/* NÚT LƯU CẤU HÌNH */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSaveSettings}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs py-2.5 px-6 rounded-xl cursor-pointer transition-colors shadow-sm"
            style={{ backgroundColor: 'var(--accent-color)' }}
          >
            <Save className="w-4 h-4" />
            Lưu Giao Diện
          </button>
        </div>

      </div>

    </div>
  );
}
