/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  User as UserIcon, 
  Key, 
  Shield, 
  MapPin, 
  Briefcase, 
  Mail, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';
import { User, NhanVien } from '../types';
import { supabase } from '../supabaseClient';

/**
 * FILE: UserProfile.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Module quản lý hồ sơ cá nhân và thay đổi mật khẩu của chính người dùng.
 *        Cung cấp cơ chế tự cập nhật thông tin cơ bản đồng bộ với bảng nhân viên b_nhanvien
 *        và thay đổi mật khẩu tài khoản an toàn thông qua cổng Supabase Auth.
 */

interface UserProfileProps {
  currentUser: User;
  nhanViens: NhanVien[];
  onUpdateNhanVien: (oldEmail: string, updatedStaff: NhanVien) => void;
  onUpdateCurrentUser: (user: User) => void;
}

export default function UserProfile({ 
  currentUser, 
  nhanViens, 
  onUpdateNhanVien,
  onUpdateCurrentUser 
}: UserProfileProps) {
  // Tìm thông tin đầy đủ của nhân sự này trong danh sách nhân viên
  const staffMember = nhanViens.find(n => n.EMAIL.toLowerCase() === currentUser.username.toLowerCase());

  // Trạng thái cập nhật thông tin cá nhân
  const [fullName, setFullName] = useState<string>(currentUser.fullName);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string>('');
  const [profileErrorMsg, setProfileErrorMsg] = useState<string>('');

  // Trạng thái đổi mật khẩu
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState<boolean>(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string>('');
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string>('');

  // Xử lý cập nhật thông tin cá nhân (Họ tên)
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrorMsg('');
    setProfileSuccessMsg('');

    if (!fullName.trim()) {
      setProfileErrorMsg('Họ và tên không được để trống.');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      // 1. Cập nhật lại trong bảng nhân viên nếu có tài khoản liên kết email
      if (staffMember) {
        const updatedStaff: NhanVien = {
          ...staffMember,
          HO_TEN: fullName.trim()
        };
        onUpdateNhanVien(staffMember.EMAIL, updatedStaff);
      }

      // 2. Cập nhật lại currentUser state và localStorage
      const updatedUser: User = {
        ...currentUser,
        fullName: fullName.trim()
      };
      onUpdateCurrentUser(updatedUser);

      setProfileSuccessMsg('Cập nhật họ tên của bạn thành công!');
      setTimeout(() => setProfileSuccessMsg(''), 4000);
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'Có lỗi xảy ra khi cập nhật.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Xử lý thay đổi mật khẩu bằng Supabase Auth
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg('');
    setPasswordSuccessMsg('');

    if (!newPassword) {
      setPasswordErrorMsg('Vui lòng nhập mật khẩu mới.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordErrorMsg('Mật khẩu mới phải chứa ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    // Nếu là tài khoản demo offline (không có email thật, ví dụ đăng nhập demo admin/kho/nhanvien)
    if (!currentUser.username.includes('@')) {
      setPasswordErrorMsg('Tài khoản demo offline không hỗ trợ đổi mật khẩu trên Cloud. Hãy đăng nhập bằng Email thật.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      setPasswordSuccessMsg('Đã thay đổi mật khẩu tài khoản thành công!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccessMsg(''), 4000);
    } catch (err: any) {
      setPasswordErrorMsg(err.message || 'Thay đổi mật khẩu thất bại. Đảm bảo bạn đang kết nối mạng.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* HEADER GIỚI THIỆU */}
      <div className="bento-card !p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <UserIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-sans font-semibold text-slate-800 text-base">Hồ Sơ Cá Nhân & Bảo Mật</h2>
            <p className="text-xs text-slate-400 font-mono">Quản lý hồ sơ công tác cá nhân và cập nhật thông tin xác thực</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* PHÂN VÙNG 1: THÔNG TIN CHI TIẾT CỦA BẠN */}
        <div className="space-y-6">
          <div className="bento-card !p-5 space-y-4">
            <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" /> Thông tin công tác
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center gap-3">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Email đăng nhập</p>
                  <p className="font-mono font-bold text-slate-700 mt-0.5 break-all">{currentUser.username}</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center gap-3">
                <Shield className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Phân vai hệ thống</p>
                  <p className="font-bold text-red-600 mt-0.5">
                    {currentUser.role === 'ADMIN' ? 'Chủ Cửa Hàng (Admin)' : currentUser.role === 'KHO' ? 'Thủ Kho (Kho)' : 'Nhân Viên Bán Hàng'}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center gap-3">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Chi nhánh trực thuộc</p>
                  <p className="font-bold text-slate-700 mt-0.5">{currentUser.branch}</p>
                </div>
              </div>

              {staffMember && (
                <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center gap-3">
                  <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Chức danh / Mã số nhân sự</p>
                    <p className="font-bold text-slate-700 mt-0.5">{staffMember.CHUC_VU} ({staffMember.MA_NV})</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form cập nhật Họ & Tên */}
          <div className="bento-card !p-5">
            <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 mb-4">
              Cập nhật Họ và Tên
            </h3>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {profileErrorMsg && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{profileErrorMsg}</span>
                </div>
              )}

              {profileSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Họ và tên của bạn</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdatingProfile}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isUpdatingProfile ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Đang cập nhật...
                  </>
                ) : (
                  'Lưu thông tin cá nhân'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* PHÂN VÙNG 2: ĐỔI MẬT KHẨU TÀI KHOẢN (CHỈ ÁP DỤNG TRÊN CLOUD AUTH) */}
        <div className="bento-card !p-5">
          <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-500" /> Thiết lập mật khẩu mới
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Để đổi mật khẩu tài khoản đã xác thực của riêng bạn, hãy thiết lập mật khẩu mới bên dưới. Đảm bảo mật khẩu của bạn có độ dài từ 6 ký tự trở lên để tránh lỗi từ phía hệ thống bảo mật Supabase.
          </p>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {passwordErrorMsg && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{passwordErrorMsg}</span>
              </div>
            )}

            {passwordSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-2 font-medium">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{passwordSuccessMsg}</span>
              </div>
            )}

            {/* Mật khẩu mới */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Mật khẩu mới</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập tối thiểu 6 ký tự..."
                  className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 pr-10 focus:outline-hidden font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Xác nhận mật khẩu mới */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Xác nhận mật khẩu</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 pr-10 focus:outline-hidden font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isUpdatingPassword ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Đang cập nhật...
                </>
              ) : (
                'Cập nhật mật khẩu mới'
              )}
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
