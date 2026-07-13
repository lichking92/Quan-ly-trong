/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Key, User as UserIcon, AlertCircle, Eye, EyeOff, Boxes, CheckCircle2, HelpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, NhanVien } from '../types';
import { supabase } from '../supabaseClient';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  nhanViens?: NhanVien[];
}

export default function Login({ onLoginSuccess, nhanViens = [] }: LoginProps) {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // States cho Quên mật khẩu
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetUsername, setResetUsername] = useState<string>('');
  const [resetError, setResetError] = useState<string>('');
  const [resetSuccess, setResetSuccess] = useState<string>('');
  const [resetLoading, setResetLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    const inputUser = username.trim();
    const cleanPass = password.trim();

    if (!inputUser || !cleanPass) {
      setErrorMsg('Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.');
      setLoading(false);
      return;
    }

    const lowerUser = inputUser.toLowerCase();

    // 1. Kiểm tra tài khoản trực tiếp từ bảng b_nhanvien trên Supabase Cloud
    try {
      const { data: dbNhanViens, error: dbError } = await supabase
        .from('b_nhanvien')
        .select('*')
        .eq('user_id', '00000000-0000-0000-0000-000000000000');

      if (dbNhanViens && dbNhanViens.length > 0) {
        const staffMember = dbNhanViens.find(n => {
          const storedUser = (n.TEN_DANG_NHAP || '').trim().toLowerCase();
          const storedEmail = (n.EMAIL || '').trim().toLowerCase();
          const storedCode = (n.MA_NV || '').trim().toLowerCase();
          return storedUser === lowerUser || storedEmail === lowerUser || storedCode === lowerUser;
        });

        if (staffMember) {
          // KIỂM TRA TRẠNG THÁI HOẠT ĐỘNG
          const rawStatus = (staffMember.TRANG_THAI || '').trim().toUpperCase();
          if (rawStatus && rawStatus !== 'HOẠT ĐỘNG' && rawStatus !== 'ACTIVE' && rawStatus !== 'KÍCH HOẠT' && rawStatus !== 'HOAT DONG') {
            setErrorMsg('Tài khoản này đã bị khóa hoặc tạm ngừng hoạt động. Vui lòng liên hệ Quản lý.');
            setLoading(false);
            return;
          }

          // Kiểm tra mật khẩu
          const matchedPassword = (staffMember.MAT_KHAU || staffMember.PASSWORD || '').trim();
          if (matchedPassword === cleanPass) {
            setLoading(false);
            onLoginSuccess({
              username: staffMember.TEN_DANG_NHAP || staffMember.EMAIL || staffMember.HO_TEN,
              fullName: staffMember.HO_TEN,
              role: staffMember.ROLE || staffMember.VAI_TRO || 'NHAN_VIEN',
              branch: staffMember.CHI_NHANH || 'Kho Trung Tâm',
              writeAccess: staffMember.WRITE_ACCESS !== false,
              WRITE_ACCESS: staffMember.WRITE_ACCESS !== false,
              id: staffMember.MA_NV
            });
            return;
          } else {
            setErrorMsg('Mật khẩu không chính xác. Vui lòng kiểm tra lại.');
            setLoading(false);
            return;
          }
        }
      }
    } catch (err) {
      console.error('Lỗi khi đối chiếu thông tin nhân viên trực tuyến:', err);
    }

    // 2. Dự phòng ngoại tuyến: Kiểm tra trong localStorage hoặc các prop truyền vào
    try {
      const savedNhanViens = localStorage.getItem('B_NHANVIEN');
      const localNhanVien: NhanVien[] = savedNhanViens ? JSON.parse(savedNhanViens) : [];
      const allNhanViens = [...nhanViens, ...localNhanVien];

      const staffMember = allNhanViens.find(n => {
        const storedUser = (n.TEN_DANG_NHAP || '').trim().toLowerCase();
        const storedEmail = (n.EMAIL || '').trim().toLowerCase();
        const storedCode = (n.MA_NV || '').trim().toLowerCase();
        return storedUser === lowerUser || storedEmail === lowerUser || storedCode === lowerUser;
      });

      if (staffMember) {
        const rawStatus = (staffMember.TRANG_THAI || '').trim().toUpperCase();
        if (rawStatus && rawStatus !== 'HOẠT ĐỘNG' && rawStatus !== 'ACTIVE' && rawStatus !== 'KÍCH HOẠT' && rawStatus !== 'HOAT DONG') {
          setErrorMsg('Tài khoản này đã bị khóa hoặc tạm ngừng hoạt động. Vui lòng liên hệ Quản lý.');
          setLoading(false);
          return;
        }

        const matchedPassword = (staffMember.MAT_KHAU || staffMember.PASSWORD || '').trim();
        if (matchedPassword === cleanPass) {
          setLoading(false);
          onLoginSuccess({
            username: staffMember.TEN_DANG_NHAP || staffMember.EMAIL || staffMember.HO_TEN,
            fullName: staffMember.HO_TEN,
            role: staffMember.ROLE || staffMember.VAI_TRO || 'NHAN_VIEN',
            branch: staffMember.CHI_NHANH || 'Kho Trung Tâm',
            writeAccess: staffMember.WRITE_ACCESS !== false,
            WRITE_ACCESS: staffMember.WRITE_ACCESS !== false,
            id: staffMember.MA_NV
          });
          return;
        } else {
          setErrorMsg('Mật khẩu không chính xác. Vui lòng kiểm tra lại.');
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Lỗi đối chiếu dự phòng:', err);
    }

    // 3. Nếu là tài khoản test nhanh cục bộ không chứa ký tự '@'
    if (!lowerUser.includes('@')) {
      setLoading(false);
      // Kiểm tra tài khoản Admin mặc định hoặc gõ "admin"
      if (lowerUser === 'admin' && cleanPass === '12345') {
        onLoginSuccess({
          username: 'nguyenkienduc.digital@gmail.com',
          fullName: 'Nguyễn Kiến Đức',
          role: 'ADMIN',
          branch: 'Kho Trung Tâm',
          writeAccess: true,
          WRITE_ACCESS: true,
          id: 'NV0001'
        });
        return;
      }

      // Kiểm tra tài khoản Thù Kho mặc định hoặc gõ "kho"
      if (lowerUser === 'kho' && cleanPass === '12345') {
        onLoginSuccess({
          username: 'kho',
          fullName: 'Trần Văn Kho',
          role: 'KHO',
          branch: 'Kho Trung Tâm',
          writeAccess: true,
          WRITE_ACCESS: true,
          id: 'NV0002'
        });
        return;
      }

      // Kiểm tra tài khoản Nhân viên bán hàng mặc định hoặc gõ "nhanvien"
      if (lowerUser === 'nhanvien' && cleanPass === '12345') {
        onLoginSuccess({
          username: 'nhanvien',
          fullName: 'Lê Thị Bán Hàng',
          role: 'NHAN_VIEN',
          branch: 'Chi nhánh Quận 1',
          writeAccess: false,
          WRITE_ACCESS: false,
          id: 'NV0003'
        });
        return;
      }

      setErrorMsg('Tên đăng nhập không tồn tại. Vui lòng kiểm tra lại.');
      return;
    }

    // 4. Fallback qua Supabase Auth nếu người dùng gõ Email thực tế của Admin
    try {
      if (lowerUser === 'nguyenkienduc.digital@gmail.com' || lowerUser === 'nguyennhanhoa.artist@gmail.com') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: lowerUser,
          password: cleanPass,
        });

        if (!error && data?.user) {
          onLoginSuccess({
            username: lowerUser,
            fullName: lowerUser === 'nguyenkienduc.digital@gmail.com' ? 'Nguyễn Kiến Đức' : 'Nguyễn Nhân Hòa',
            role: 'ADMIN',
            branch: 'Kho Trung Tâm',
            writeAccess: true,
            WRITE_ACCESS: true,
            id: 'NV0001'
          });
          return;
        }
      }
    } catch (authErr) {
      console.warn('Lỗi Supabase Auth fallback:', authErr);
    }

    setErrorMsg('Tên đăng nhập hoặc mật khẩu chưa chính xác.');
    setLoading(false);
  };

  // Gửi yêu cầu reset mật khẩu
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    setResetLoading(true);

    const targetUser = resetUsername.trim();
    if (!targetUser) {
      setResetError('Vui lòng nhập Tên đăng nhập.');
      setResetLoading(false);
      return;
    }

    try {
      const { data: dbNhanViens, error: dbError } = await supabase
        .from('b_nhanvien')
        .select('*')
        .eq('user_id', '00000000-0000-0000-0000-000000000000');

      if (dbNhanViens && dbNhanViens.length > 0) {
        const staffMember = dbNhanViens.find(n => {
          const storedUser = (n.TEN_DANG_NHAP || '').trim().toLowerCase();
          const storedEmail = (n.EMAIL || '').trim().toLowerCase();
          const storedCode = (n.MA_NV || '').trim().toLowerCase();
          return storedUser === targetUser.toLowerCase() || storedEmail === targetUser.toLowerCase() || storedCode === targetUser.toLowerCase();
        });

        if (staffMember) {
          const { error: updateError } = await supabase
            .from('b_nhanvien')
            .update({ YEU_CAU_RESET: true })
            .eq('MA_NV', staffMember.MA_NV)
            .eq('user_id', '00000000-0000-0000-0000-000000000000');

          if (updateError) {
            setResetError('Có lỗi xảy ra khi gửi yêu cầu lên máy chủ.');
          } else {
            setResetSuccess('Gửi yêu cầu thành công! Vui lòng báo cho Admin/Quản lý để đặt lại mật khẩu mới cho bạn.');
          }
        } else {
          setResetError('Không tìm thấy tài khoản nhân viên tương thích.');
        }
      } else {
        setResetError('Không thể kết nối CSDL hoặc dữ liệu nhân sự trống.');
      }
    } catch (err) {
      console.error(err);
      setResetError('Đã xảy ra lỗi ngoài ý muốn.');
    } finally {
      setResetLoading(false);
    }
  };

  // Trợ lý điền thông tin nhanh khi test
  const handleQuickLogin = (roleType: 'ADMIN' | 'KHO' | 'NHAN_VIEN') => {
    if (roleType === 'ADMIN') {
      setUsername('admin');
      setPassword('12345');
    } else if (roleType === 'KHO') {
      setUsername('kho');
      setPassword('12345');
    } else {
      setUsername('nhanvien');
      setPassword('12345');
    }
    setErrorMsg('');
    setSuccessMsg('');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      
      {/* Background Gradient Decorative Balls */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-600/10 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-slate-850/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl relative"
      >
        {/* LOGO & TIÊU ĐỀ */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex p-3.5 bg-blue-600/10 text-blue-400 rounded-2xl border border-blue-500/20 mb-3">
            <Boxes className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">HỆ THỐNG QUẢN LÝ KHO</h1>
          <p className="text-xs text-slate-400 font-mono uppercase tracking-widest">Tròng Kính Mắt • Real-time</p>
        </div>

        {/* THÔNG BÁO LỖI */}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl text-xs flex items-center gap-2.5 mb-6"
          >
            <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </motion.div>
        )}

        {/* THÔNG BÁO THÀNH CÔNG */}
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 rounded-xl text-xs flex items-center gap-2.5 mb-6"
          >
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </motion.div>
        )}

        {/* FORM ĐĂNG NHẬP */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tên Đăng Nhập / Email</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <UserIcon className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Nhập tên đăng nhập hoặc email..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-base md:text-xs font-semibold text-white bg-slate-800/60 border border-slate-750 rounded-xl py-3 pl-10 pr-4 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mật khẩu bảo mật</label>
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider flex items-center gap-1 cursor-pointer bg-transparent border-none"
              >
                <HelpCircle className="w-3 h-3" />
                Quên mật khẩu?
              </button>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Key className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-base md:text-xs font-semibold text-white bg-slate-800/60 border border-slate-750 rounded-xl py-3 pl-10 pr-10 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-md shadow-red-600/15 flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <span className="animate-spin inline-block w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Shield className="w-4.5 h-4.5" />
            )}
            ĐĂNG NHẬP HỆ THỐNG
          </button>
        </form>

        {/* PHÂN VAI KIỂM THỬ NHANH */}
        <div className="mt-8 border-t border-slate-800 pt-6 space-y-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">GỢI Ý TÀI KHẢN KHẢO SÁT CHỨC NĂNG</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleQuickLogin('ADMIN')}
              className="py-2 px-1 bg-slate-800/40 hover:bg-blue-600/10 border border-slate-750 hover:border-blue-500/30 text-slate-400 hover:text-blue-400 text-[10px] font-bold rounded-lg cursor-pointer transition-all text-center"
            >
              Chủ Cửa Hàng
              <span className="block text-[8px] opacity-65 font-normal font-mono">admin / 12345</span>
            </button>
            <button
              onClick={() => handleQuickLogin('KHO')}
              className="py-2 px-1 bg-slate-800/40 hover:bg-emerald-600/10 border border-slate-750 hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 text-[10px] font-bold rounded-lg cursor-pointer transition-all text-center"
            >
              Quản Lý Kho
              <span className="block text-[8px] opacity-65 font-normal font-mono">kho / 12345</span>
            </button>
            <button
              onClick={() => handleQuickLogin('NHAN_VIEN')}
              className="py-2 px-1 bg-slate-800/40 hover:bg-amber-600/10 border border-slate-750 hover:border-amber-500/30 text-slate-400 hover:text-amber-400 text-[10px] font-bold rounded-lg cursor-pointer transition-all text-center"
            >
              Nhân Viên Bán
              <span className="block text-[8px] opacity-65 font-normal font-mono">nhanvien / 12345</span>
            </button>
          </div>
        </div>

      </motion.div>

      {/* MODAL KHÔI PHỤC MẬT KHẨU */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md bg-slate-850 border border-slate-700 rounded-3xl p-6 relative shadow-2xl"
            >
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetUsername('');
                  setResetError('');
                  setResetSuccess('');
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Yêu Cầu Reset Mật Khẩu</h3>
                  <p className="text-xs text-slate-400">Gửi yêu cầu đặt lại mật khẩu mới tới Admin</p>
                </div>
              </div>

              {resetError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl text-xs flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 rounded-xl text-xs flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tên Đăng Nhập Của Bạn</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: admin, kho, nhanvien..."
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    className="w-full text-xs font-semibold text-white bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-hidden focus:border-blue-500 transition-all font-mono"
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetModal(false);
                      setResetUsername('');
                      setResetError('');
                      setResetSuccess('');
                    }}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    {resetLoading ? (
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      'Gửi Yêu Cầu'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
