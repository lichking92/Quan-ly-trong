/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Key, User as UserIcon, AlertCircle, Eye, EyeOff, Boxes, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { User, NhanVien } from '../types';
import { supabase } from '../supabaseClient';

/**
 * FILE: Login.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Giao diện đăng nhập & đăng ký bảo mật của hệ thống quản lý kho tròng kính.
 *        Cổng tích hợp trực tiếp với Supabase Auth, hỗ trợ chế độ Đăng ký (Sign Up)
 *        và Đăng nhập (Sign In) tự động nhận diện vai trò nhân viên.
 */

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  nhanViens?: NhanVien[];
}

export default function Login({ onLoginSuccess, nhanViens = [] }: LoginProps) {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

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

    // 1. Kiểm tra tài khoản trong danh sách B_NHANVIEN (từ props & localStorage)
    try {
      const savedNhanViens = localStorage.getItem('B_NHANVIEN');
      const localNhanVien: NhanVien[] = savedNhanViens ? JSON.parse(savedNhanViens) : [];
      
      // Hợp nhất dữ liệu để đảm bảo chính xác nhất
      const allNhanViens = [...nhanViens];
      localNhanVien.forEach(ln => {
        if (!allNhanViens.some(n => n.MA_NV === ln.MA_NV)) {
          allNhanViens.push(ln);
        }
      });

      // Tìm kiếm nhân viên hợp lệ (so sánh không phân biệt chữ hoa/thường, hỗ trợ cả mã nhân viên, email, tên đăng nhập)
      const staffMember = allNhanViens.find(n => {
        const storedUser = (n.TEN_DANG_NHAP || '').trim().toLowerCase();
        const storedEmail = (n.EMAIL || '').trim().toLowerCase();
        const storedCode = (n.MA_NV || '').trim().toLowerCase();
        return storedUser === lowerUser || storedEmail === lowerUser || storedCode === lowerUser;
      });

      if (staffMember) {
        // KIỂM TRA TRẠNG THÁI HOẠT ĐỘNG (Lọc tài khoản hoạt động)
        const rawStatus = (staffMember.TRANG_THAI || '').trim().toUpperCase();
        // Nếu có trạng thái và không phải là hoạt động/active/kích hoạt
        if (rawStatus && rawStatus !== 'HOẠT ĐỘNG' && rawStatus !== 'ACTIVE' && rawStatus !== 'KÍCH HOẠT' && rawStatus !== 'HOAT DONG') {
          setErrorMsg('Tài khoản này đã bị khóa hoặc tạm ngừng hoạt động. Vui lòng liên hệ Quản lý.');
          setLoading(false);
          return;
        }

        // Kiểm tra mật khẩu (hỗ trợ cả MAT_KHAU và PASSWORD cũ, so sánh phân biệt chữ hoa/thường, loại bỏ khoảng trắng thừa)
        const matchedPassword = (staffMember.MAT_KHAU || staffMember.PASSWORD || '').trim();
        if (matchedPassword === cleanPass) {
          setLoading(false);
          onLoginSuccess({
            username: staffMember.EMAIL || staffMember.TEN_DANG_NHAP || staffMember.HO_TEN,
            fullName: staffMember.HO_TEN,
            role: staffMember.VAI_TRO || staffMember.ROLE,
            branch: staffMember.CHI_NHANH,
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
      console.error('Lỗi khi đối chiếu thông tin nhân viên:', err);
    }

    // 2. Nếu là tài khoản test nhanh cục bộ không chứa ký tự '@'
    if (!lowerUser.includes('@')) {
      setLoading(false);
      // Kiểm tra tài khoản Admin mặc định hoặc gõ "admin"
      if (lowerUser === 'admin' && cleanPass === '12345') {
        onLoginSuccess({
          username: 'nguyenkienduc.digital@gmail.com',
          fullName: 'Nguyễn Kiến Đức',
          role: 'ADMIN',
          branch: 'Kho Trung Tâm',
          writeAccess: true
        });
        return;
      }

      // Kiểm tra tài khoản Thù Kho mặc định hoặc gõ "kho"
      if (lowerUser === 'kho' && cleanPass === '12345') {
        onLoginSuccess({
          username: 'kho@gmail.com',
          fullName: 'Trần Văn Kho',
          role: 'KHO',
          branch: 'Kho Trung Tâm',
          writeAccess: true
        });
        return;
      }

      // Kiểm tra tài khoản Nhân viên bán hàng mặc định hoặc gõ "nhanvien"
      if (lowerUser === 'nhanvien' && cleanPass === '12345') {
        onLoginSuccess({
          username: 'nhanvien@gmail.com',
          fullName: 'Lê Thị Bán Hàng',
          role: 'NHAN_VIEN',
          branch: 'Chi nhánh Quận 1',
          writeAccess: false
        });
        return;
      }

      setErrorMsg('Tên đăng nhập không tồn tại. Vui lòng kiểm tra lại.');
      return;
    }

    // 3. Xử lý qua Supabase Auth (dành cho các tài khoản email trực tuyến)
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: lowerUser,
          password: cleanPass,
        });

        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }

        if (data?.user) {
          // Tìm nhân viên tương thích trong danh sách đã được thiết lập sẵn ở localStorage
          const savedNhanViens = localStorage.getItem('B_NHANVIEN');
          const listNhanVien: NhanVien[] = savedNhanViens ? JSON.parse(savedNhanViens) : [];
          const staffMember = listNhanVien.find(n => n.EMAIL.toLowerCase() === lowerUser);

          const isOwner = lowerUser === 'nguyenkienduc.digital@gmail.com';
          if (data.session) {
            onLoginSuccess({
              username: lowerUser,
              fullName: isOwner ? 'Nguyễn Kiến Đức' : (staffMember?.HO_TEN || lowerUser.split('@')[0]),
              role: isOwner ? 'ADMIN' : (staffMember?.ROLE || 'NHAN_VIEN'),
              branch: isOwner ? 'Kho Trung Tâm' : (staffMember?.CHI_NHANH || 'Kho Trung Tâm'),
              writeAccess: isOwner ? true : (staffMember ? staffMember.WRITE_ACCESS : false),
              WRITE_ACCESS: isOwner ? true : (staffMember ? staffMember.WRITE_ACCESS : false),
              id: data.user.id
            });
          } else {
            setSuccessMsg('Đăng ký thành công! Hãy xác nhận email của bạn hoặc tiến hành Đăng nhập.');
            setIsSignUp(false);
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: lowerUser,
          password: cleanPass,
        });

        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }

        if (data?.user) {
          const savedNhanViens = localStorage.getItem('B_NHANVIEN');
          const listNhanVien: NhanVien[] = savedNhanViens ? JSON.parse(savedNhanViens) : [];
          const staffMember = listNhanVien.find(n => n.EMAIL.toLowerCase() === lowerUser);

          const isOwner = lowerUser === 'nguyenkienduc.digital@gmail.com';
          onLoginSuccess({
            username: lowerUser,
            fullName: isOwner ? 'Nguyễn Kiến Đức' : (staffMember?.HO_TEN || lowerUser.split('@')[0]),
            role: isOwner ? 'ADMIN' : (staffMember?.ROLE || 'NHAN_VIEN'),
            branch: isOwner ? 'Kho Trung Tâm' : (staffMember?.CHI_NHANH || 'Kho Trung Tâm'),
            writeAccess: isOwner ? true : (staffMember ? staffMember.WRITE_ACCESS : false),
            WRITE_ACCESS: isOwner ? true : (staffMember ? staffMember.WRITE_ACCESS : false),
            id: data.user.id
          });
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi bất ngờ xảy ra khi kết nối dịch vụ Auth.');
    } finally {
      setLoading(false);
    }
  };

  // Trợ lý điền thông tin nhanh khi test
  const handleQuickLogin = (roleType: 'ADMIN' | 'KHO' | 'NHAN_VIEN') => {
    setIsSignUp(false);
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

        {/* FORM ĐĂNG NHẬP / ĐĂNG KÝ */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tên Đăng Nhập</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <UserIcon className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder={isSignUp ? "Đăng ký email (cho Supabase)" : "Nhập tên đăng nhập hoặc email..."}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-base md:text-xs font-semibold text-white bg-slate-800/60 border border-slate-750 rounded-xl py-3 pl-10 pr-4 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mật khẩu bảo mật</label>
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
            {isSignUp ? 'ĐĂNG KÝ TÀI KHOẢN MỚI' : 'ĐĂNG NHẬP HỆ THỐNG'}
          </button>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer underline decoration-dotted"
            >
              {isSignUp ? 'Đã có tài khoản? Đăng nhập tại đây' : 'Chưa có tài khoản? Đăng ký ngay'}
            </button>
          </div>
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
    </div>
  );
}
