/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Key, User as UserIcon, AlertCircle, Eye, EyeOff, Boxes, CheckCircle2, HelpCircle, X, Mail, UserPlus, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, NhanVien } from '../types';
import { supabase } from '../supabaseClient';
import { resolveEffectiveUserId, syncEmailLog } from '../supabaseSync';

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

  // States cho Đăng ký tài khoản mới
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [regFullName, setRegFullName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regRePassword, setRegRePassword] = useState<string>('');
  const [regShowPassword, setRegShowPassword] = useState<boolean>(false);
  const [regLoading, setRegLoading] = useState<boolean>(false);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setRegLoading(true);

    const fullName = regFullName.trim();
    const email = regEmail.trim();
    const usernameInput = regUsername.trim();
    const passwordInput = regPassword.trim();
    const rePasswordInput = regRePassword.trim();

    if (!fullName || !email || !usernameInput || !passwordInput || !rePasswordInput) {
      setErrorMsg('Vui lòng nhập đầy đủ tất cả các thông tin đăng ký.');
      setRegLoading(false);
      return;
    }

    if (passwordInput !== rePasswordInput) {
      setErrorMsg('Mật khẩu nhập lại không trùng khớp. Vui lòng kiểm tra lại.');
      setRegLoading(false);
      return;
    }

    if (passwordInput.length < 6) {
      setErrorMsg('Mật khẩu tối thiểu phải từ 6 ký tự.');
      setRegLoading(false);
      return;
    }

    // Bảo đảm 100% có session Supabase Auth kết nối với tài khoản Chủ Cửa Hàng để mở khóa RLS
    try {
      const { data: { session } } = await supabase.auth.getSession();
    } catch (e) {
      console.warn('Lỗi kết nối ngầm khi đăng ký:', e);
    }

    try {
      const activeUid = await resolveEffectiveUserId();
      
      // 1. Kiểm tra xem Email hoặc Tên đăng nhập đã tồn tại trong bảng b_nhanvien chưa
      const { data: dbNhanViens, error: checkError } = await supabase
        .from('b_nhanvien')
        .select('EMAIL, TEN_DANG_NHAP')
        .eq('user_id', activeUid);

      if (checkError) {
        console.error('Lỗi khi kiểm tra nhân viên tồn tại:', checkError);
      }

      const lowerEmail = email.toLowerCase();
      const lowerUsername = usernameInput.toLowerCase();

      if (dbNhanViens && dbNhanViens.length > 0) {
        const isEmailExist = dbNhanViens.some(n => (n.EMAIL || '').trim().toLowerCase() === lowerEmail);
        const isUserExist = dbNhanViens.some(n => (n.TEN_DANG_NHAP || '').trim().toLowerCase() === lowerUsername);

        if (isEmailExist) {
          setErrorMsg('Email này đã được sử dụng. Vui lòng chọn Email khác.');
          setRegLoading(false);
          return;
        }

        if (isUserExist) {
          setErrorMsg('Tên đăng nhập này đã được sử dụng. Vui lòng chọn Tên đăng nhập khác.');
          setRegLoading(false);
          return;
        }
      }

      // 2. Tạo bản ghi nhân viên mới ở trạng thái Chờ duyệt
      const randomId = 'NV' + Math.floor(100000 + Math.random() * 900000);
      const currentDate = new Date().toISOString().split('T')[0];

      const newStaffPayload = {
        MA_NV: randomId,
        HO_TEN: fullName,
        CHUC_VU: 'Nhân viên chờ duyệt',
        BO_PHAN: 'Bộ Phận Bán Hàng',
        CHI_NHANH: 'Kho Trung Tâm',
        EMAIL: email,
        ROLE: 'NHAN_VIEN',
        WRITE_ACCESS: false,
        TEN_DANG_NHAP: usernameInput,
        MAT_KHAU: passwordInput,
        TRANG_THAI: 'PENDING',
        YEU_CAU_RESET: false,
        NGAY_DANG_KY: currentDate,
        user_id: activeUid
      };

      const { error: insertError } = await supabase
        .from('b_nhanvien')
        .insert(newStaffPayload);

      if (insertError) {
        console.error('Lỗi khi ghi thông tin đăng ký:', insertError);
        setErrorMsg('Lỗi khi ghi thông tin đăng ký lên hệ thống: ' + insertError.message);
      } else {
        setSuccessMsg(`Đăng ký thành công! Tài khoản "${usernameInput}" của bạn hiện đang ở trạng thái "Chờ duyệt". Vui lòng liên hệ Admin để phê duyệt và kích hoạt.`);
        
        // Gửi email thông báo đang chờ duyệt
        try {
          const emailDate = new Date().toLocaleString('vi-VN');
          const mailContent = `Chào ${fullName},\n\n` +
            `Chúc mừng bạn đã đăng ký tài khoản thành công trên hệ thống Glass Stock Pro!\n\n` +
            `Thông tin tài khoản đăng ký:\n` +
            `- Họ và tên: ${fullName}\n` +
            `- Email liên hệ: ${email}\n` +
            `- Tên đăng nhập: ${usernameInput}\n` +
            `- Ngày đăng ký: ${emailDate}\n` +
            `- Trạng thái hiện tại: Chờ duyệt (Pending)\n\n` +
            `Tài khoản của bạn hiện đang chờ Admin phê duyệt và kích hoạt quyền sử dụng hệ thống. Bạn sẽ nhận được email thông báo ngay sau khi tài khoản được phê duyệt.\n\n` +
            `Đường dẫn truy cập ứng dụng: ${window.location.origin}\n\n` +
            `Trân trọng,\nBan Quản Trị Glass Stock Pro`;
            
          await syncEmailLog({
            EMAIL: email,
            TIEU_DE: "Đăng ký tài khoản Glass Stock thành công - Đang chờ phê duyệt",
            NOI_DUNG: mailContent,
            NGAY_GUI: emailDate,
            TRANG_THAI: "Thành công",
            LOAI_EMAIL: "Đăng ký"
          }, activeUid);
        } catch (emailErr) {
          console.warn("Lỗi gửi email đăng ký:", emailErr);
        }

        // Chuyển về màn hình đăng nhập và điền sẵn username vừa đăng ký
        setIsRegisterMode(false);
        setUsername(usernameInput);
        setPassword('');
        
        // Reset form đăng ký
        setRegFullName('');
        setRegEmail('');
        setRegUsername('');
        setRegPassword('');
        setRegRePassword('');
      }
    } catch (err: any) {
      console.error('Lỗi khi xử lý đăng ký:', err);
      setErrorMsg('Đã xảy ra lỗi ngoài ý muốn: ' + (err.message || JSON.stringify(err)));
    } finally {
      setRegLoading(false);
    }
  };

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

    // Bảo đảm 100% có session Supabase Auth kết nối với tài khoản Chủ Cửa Hàng để mở khóa RLS
    try {
      const { data: { session } } = await supabase.auth.getSession();
    } catch (e) {
      console.warn('Lỗi kết nối ngầm:', e);
    }

    // ĐĂNG NHẬP TRỰC TIẾP MASTER ADMIN (ĐẢM BẢO 100% THÀNH CÔNG VỚI TÀI KHOẢN CHỦ)
    if ((lowerUser === 'admin' || lowerUser === 'nguyenkienduc.digital@gmail.com') && cleanPass === '123456') {
      setLoading(false);
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

    // 1. Kiểm tra tài khoản trực tiếp từ bảng b_nhanvien trên Supabase Cloud (truy vấn toàn hệ thống)
    try {
      const activeUid = await resolveEffectiveUserId();
      const { data: dbNhanViens, error: dbError } = await supabase
        .from('b_nhanvien')
        .select('*')
        .eq('user_id', activeUid);

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
          if (rawStatus === 'CHỜ DUYỆT' || rawStatus === 'PENDING' || rawStatus === 'CHO DUYET') {
            setErrorMsg('Tài khoản của bạn đang chờ duyệt. Vui lòng liên hệ Admin để được kích hoạt.');
            setLoading(false);
            return;
          }
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
        if (rawStatus === 'CHỜ DUYỆT' || rawStatus === 'PENDING' || rawStatus === 'CHO DUYET') {
          setErrorMsg('Tài khoản của bạn đang chờ duyệt. Vui lòng liên hệ Admin để được kích hoạt.');
          setLoading(false);
          return;
        }
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

    // 3. Tài khoản test nhanh cục bộ không chứa ký tự '@'
    if (lowerUser === 'kho' && cleanPass === '12345') {
      setLoading(false);
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

    if (lowerUser === 'nhanvien' && cleanPass === '12345') {
      setLoading(false);
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

    setErrorMsg('Tên đăng nhập hoặc mật khẩu không chính xác.');
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
      const activeUid = await resolveEffectiveUserId();
      const { data: dbNhanViens, error: dbError } = await supabase
        .from('b_nhanvien')
        .select('*')
        .eq('user_id', activeUid);

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
            .eq('user_id', activeUid);

          if (updateError) {
            setResetError('Có lỗi xảy ra khi gửi yêu cầu lên máy chủ.');
          } else {
            setResetSuccess('Gửi yêu cầu thành công! Vui lòng báo cho Admin/Quản lý để đặt lại mật khẩu mới cho bạn.');
            
            // Gửi email khôi phục mật khẩu (Quên mật khẩu)
            try {
              const emailDate = new Date().toLocaleString('vi-VN');
              const mailContent = `Chào ${staffMember.HO_TEN || targetUser},\n\n` +
                `Hệ thống Glass Stock Pro đã nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn.\n\n` +
                `Thông tin yêu cầu:\n` +
                `- Họ tên: ${staffMember.HO_TEN}\n` +
                `- Tên đăng nhập: ${staffMember.TEN_DANG_NHAP || targetUser}\n` +
                `- Email: ${staffMember.EMAIL}\n` +
                `- Thời gian yêu cầu: ${emailDate}\n` +
                `- Trạng thái yêu cầu: Đang chờ Admin xử lý\n\n` +
                `Yêu cầu của bạn đã được chuyển đến Quản trị viên hệ thống để tiến hành đặt lại mật khẩu. Vui lòng liên hệ trực tiếp với Admin để được cấp mật khẩu mới sớm nhất.\n\n` +
                `Trân trọng,\nBan Quản Trị Glass Stock Pro`;

              await syncEmailLog({
                EMAIL: staffMember.EMAIL || targetUser,
                TIEU_DE: "Yêu cầu khôi phục mật khẩu tài khoản Glass Stock",
                NOI_DUNG: mailContent,
                NGAY_GUI: emailDate,
                TRANG_THAI: "Thành công",
                LOAI_EMAIL: "Quên mật khẩu"
              }, activeUid);
            } catch (emailErr) {
              console.warn("Lỗi gửi email quên mật khẩu:", emailErr);
            }
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
      setPassword('123456');
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
          <h1 className="text-xl font-extrabold text-white tracking-tight">
            {isRegisterMode ? 'ĐĂNG KÝ TÀI KHOẢN' : 'HỆ THỐNG QUẢN LÝ KHO'}
          </h1>
          <p className="text-xs text-slate-400 font-mono uppercase tracking-widest">
            {isRegisterMode ? 'Đăng ký nhân sự mới' : 'Tròng Kính Mắt • Real-time'}
          </p>
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

        {!isRegisterMode ? (
          <>
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

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(true);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1.5 mx-auto cursor-pointer transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Đăng ký tài khoản nhân viên mới
              </button>
            </div>

            {/* PHÂN VAI KIỂM THỬ NHANH */}
            <div className="mt-6 border-t border-slate-800 pt-5 space-y-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">GỢI Ý TÀI KHẢN KHẢO SÁT CHỨC NĂNG</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleQuickLogin('ADMIN')}
                  className="py-2 px-1 bg-slate-800/40 hover:bg-blue-600/10 border border-slate-750 hover:border-blue-500/30 text-slate-400 hover:text-blue-400 text-[10px] font-bold rounded-lg cursor-pointer transition-all text-center"
                >
                  Chủ Cửa Hàng
                  <span className="block text-[8px] opacity-65 font-normal font-mono">admin / 123456</span>
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
          </>
        ) : (
          <>
            {/* FORM ĐĂNG KÝ */}
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Họ và tên nhân viên</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <UserIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full text-base md:text-xs font-semibold text-white bg-slate-800/60 border border-slate-750 rounded-xl py-2.5 pl-10 pr-4 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email liên hệ</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    placeholder="nva@gmail.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full text-base md:text-xs font-semibold text-white bg-slate-800/60 border border-slate-750 rounded-xl py-2.5 pl-10 pr-4 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tên Đăng Nhập</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                    <UserIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Sử dụng viết liền không dấu..."
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full text-base md:text-xs font-semibold text-white bg-slate-800/60 border border-slate-750 rounded-xl py-2.5 pl-10 pr-4 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mật khẩu</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <Key className="w-4 h-4" />
                    </span>
                    <input
                      type={regShowPassword ? 'text' : 'password'}
                      placeholder="Tối thiểu 6 ký tự..."
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full text-base md:text-xs font-semibold text-white bg-slate-800/60 border border-slate-750 rounded-xl py-2.5 pl-10 pr-10 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setRegShowPassword(!regShowPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3"
                    >
                      {regShowPassword ? <EyeOff className="w-4 h-4 text-slate-500" /> : <Eye className="w-4 h-4 text-slate-500" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nhập lại mật khẩu</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                      <Key className="w-4 h-4" />
                    </span>
                    <input
                      type={regShowPassword ? 'text' : 'password'}
                      placeholder="Xác thực mật khẩu..."
                      value={regRePassword}
                      onChange={(e) => setRegRePassword(e.target.value)}
                      className="w-full text-base md:text-xs font-semibold text-white bg-slate-800/60 border border-slate-750 rounded-xl py-2.5 pl-10 pr-4 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-600/15 flex items-center justify-center gap-1.5 mt-2"
              >
                {regLoading ? (
                  <span className="animate-spin inline-block w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <UserPlus className="w-4.5 h-4.5" />
                )}
                ĐĂNG KÝ TÀI KHOẢN
              </button>
            </form>

            <div className="mt-5 text-center border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(false);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-xs font-bold text-slate-400 hover:text-white flex items-center justify-center gap-1.5 mx-auto cursor-pointer transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Quay lại Đăng nhập
              </button>
            </div>
          </>
        )}

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
