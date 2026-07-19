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

    try {
      // 1. Kiểm tra xem Email hoặc Tên đăng nhập đã tồn tại trong bảng b_nhanvien chưa (kiểm tra toàn hệ thống để đảm bảo duy nhất)
      const { data: dbNhanViens, error: checkError } = await supabase
        .from('b_nhanvien')
        .select('EMAIL, TEN_DANG_NHAP');

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

      // B1. Đăng ký tài khoản bằng Supabase Auth signUp
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: passwordInput,
        options: {
          data: {
            full_name: fullName,
            username: usernameInput
          }
        }
      });

      if (signUpError) {
        setErrorMsg('Lỗi đăng ký tài khoản Auth: ' + signUpError.message);
        setRegLoading(false);
        return;
      }

      // B2. Lấy auth.user.id từ Supabase Auth
      const authUserId = signUpData.user?.id;
      if (!authUserId) {
        setErrorMsg('Đăng ký thành công trên Auth nhưng không nhận được User ID.');
        setRegLoading(false);
        return;
      }

      // B3. Đăng ký thông tin nhân viên vào bảng b_nhanvien
      const randomId = 'NV' + Math.floor(100000 + Math.random() * 900000);
      const currentDate = new Date().toISOString().split('T')[0];
      let registeredRole = 'PENDING';
      let rpcRes = null;
      let rpcError = null;

      try {
        const { data, error } = await supabase.rpc('register_nhanvien', {
          p_ma_nv: randomId,
          p_ho_ten: fullName,
          p_email: email,
          p_ten_dang_nhap: usernameInput,
          p_mat_khau: passwordInput,
          p_user_id: authUserId
        });
        rpcRes = data;
        rpcError = error;
      } catch (err) {
        rpcError = err;
      }

      if (rpcError || !rpcRes || rpcRes.success === false) {
        console.warn('RPC register_nhanvien không khả dụng hoặc trả về lỗi, chuyển sang cơ chế client-side fallback:', rpcError || rpcRes?.message);
        
        // Cơ chế client-side fallback tự phục hồi (self-healing fallback)
        let hasAdmin = false;
        let targetUserId = authUserId;
        let assignedRole = 'PENDING';
        let assignedStatus = 'PENDING';
        let assignedActive = false;
        let assignedChucVu = 'Nhân viên chờ duyệt';
        let assignedBoPhan = 'Bộ Phận Bán Hàng';
        let assignedWriteAccess = false;
        let assignedRoles = ['NHAN_VIEN', 'PENDING', 'pending'];
        let assignedPermissions = ['TRANSACTION'];

        try {
          const { data: existingStaff } = await supabase
            .from('b_nhanvien')
            .select('ROLE, user_id');

          if (existingStaff && existingStaff.length > 0) {
            const adminStaff = existingStaff.find(s => {
              const r = (s.ROLE || '').trim().toUpperCase();
              return r === 'ADMIN';
            });
            if (adminStaff) {
              hasAdmin = true;
              if (adminStaff.user_id) {
                targetUserId = adminStaff.user_id;
              }
            }
          }
        } catch (err) {
          console.warn('Lỗi kiểm tra tài khoản Admin hiện tại:', err);
        }

        if (!hasAdmin) {
          assignedRole = 'ADMIN';
          assignedStatus = 'ACTIVE';
          assignedActive = true;
          assignedChucVu = 'Chủ sở hữu (Admin)';
          assignedBoPhan = 'Ban Giám Đốc';
          assignedWriteAccess = true;
          assignedRoles = ['ADMIN', 'admin'];
          assignedPermissions = ["DASHBOARD", "PRODUCT", "TRANSACTION", "HISTORY", "AUDIT", "CATEGORY"];
          targetUserId = authUserId;
        }

        registeredRole = assignedRole;

        const fullPayload = {
          "MA_NV": randomId,
          "HO_TEN": fullName,
          "CHUC_VU": assignedChucVu,
          "BO_PHAN": assignedBoPhan,
          "CHI_NHANH": "Kho Trung Tâm",
          "EMAIL": email,
          "ROLE": assignedRole,
          "active": assignedActive,
          "TEN_DANG_NHAP": usernameInput,
          "MAT_KHAU": passwordInput,
          "TRANG_THAI": assignedStatus,
          "YEU_CAU_RESET": false,
          "NGAY_DANG_KY": currentDate,
          "user_id": targetUserId,
          "ROLES": assignedRoles,
          "WRITE_ACCESS": assignedWriteAccess,
          "PERMISSIONS": assignedPermissions
        };

        const minimalPayload = {
          "MA_NV": randomId,
          "HO_TEN": fullName,
          "CHUC_VU": assignedChucVu,
          "BO_PHAN": assignedBoPhan,
          "CHI_NHANH": "Kho Trung Tâm",
          "EMAIL": email,
          "ROLE": assignedRole,
          "active": assignedActive,
          "TRANG_THAI": assignedStatus,
          "user_id": targetUserId
        };

        let { error: insertError } = await supabase
          .from('b_nhanvien')
          .insert(fullPayload);

        if (insertError) {
          console.warn('Lỗi khi ghi thông tin với payload đầy đủ, đang thử lại với payload tối giản:', insertError.message);
          const { error: retryError } = await supabase
            .from('b_nhanvien')
            .insert(minimalPayload);

          if (retryError) {
            console.error('Lỗi khi ghi thông tin đăng ký trực tiếp:', retryError);
            setErrorMsg('Lỗi khi lưu thông tin đăng ký: ' + retryError.message);
            setRegLoading(false);
            return;
          }
        }
      } else {
        registeredRole = rpcRes.role || 'PENDING';
      }

      // B5. Đăng xuất ngay sau khi đăng ký thành công (Không tự tạo session đăng nhập để chờ duyệt nếu cần)
      await supabase.auth.signOut();

      // B4. Hiển thị thông báo đăng ký thành công dựa vào vai trò được phân gán
      if (registeredRole === 'ADMIN') {
        setSuccessMsg("Đăng ký thành công! Tài khoản của bạn đã được khởi tạo làm Quản trị viên (Admin) chính và kích hoạt tự động.");
      } else {
        setSuccessMsg("Tài khoản đã được tạo thành công. Vui lòng chờ quản trị viên phê duyệt.");
      }
        
      // Gửi email thông báo đang chờ duyệt
      try {
        const emailDate = new Date().toLocaleString('vi-VN');
        const mailContent = `Chào ${fullName},\n\n` +
          `Chúc mừng bạn đã đăng ký tài khoản thành công trên hệ thống Quản Lý Kho!\n\n` +
          `Thông tin tài khoản đăng ký:\n` +
          `- Họ và tên: ${fullName}\n` +
          `- Email liên hệ: ${email}\n` +
          `- Tên đăng nhập: ${usernameInput}\n` +
          `- Ngày đăng ký: ${emailDate}\n` +
          `- Trạng thái hiện tại: Chờ duyệt (Pending)\n\n` +
          `Tài khoản của bạn hiện đang chờ Admin phê duyệt và kích hoạt quyền sử dụng hệ thống. Bạn sẽ nhận được email thông báo ngay sau khi tài khoản được phê duyệt.\n\n` +
          `Đường dẫn truy cập ứng dụng: ${window.location.origin}\n\n` +
          `Trân trọng,\nBan Quản Trị Quản Lý Kho`;
          
        await syncEmailLog({
          EMAIL: email,
          TIEU_DE: "Đăng ký tài khoản Glass Stock thành công - Đang chờ phê duyệt",
          NOI_DUNG: mailContent,
          NGAY_GUI: emailDate,
          TRANG_THAI: "Thành công",
          LOAI_EMAIL: "Đăng ký"
        }, authUserId);
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

    // 1. Tìm thông tin Email của nhân sự từ b_nhanvien theo Tên đăng nhập / Email / Mã NV
    let loginEmail = inputUser;
    let staffRecord = null;

    try {
      const { data: dbNhanViens, error: dbError } = await supabase
        .from('b_nhanvien')
        .select('*');

      if (dbNhanViens && dbNhanViens.length > 0) {
        staffRecord = dbNhanViens.find(n => {
          const storedUser = (n.TEN_DANG_NHAP || '').trim().toLowerCase();
          const storedEmail = (n.EMAIL || '').trim().toLowerCase();
          const storedCode = (n.MA_NV || '').trim().toLowerCase();
          return storedUser === lowerUser || storedEmail === lowerUser || storedCode === lowerUser;
        });
      }
    } catch (err) {
      console.error('Lỗi truy cập b_nhanvien trước đăng nhập:', err);
    }

    if (staffRecord && staffRecord.EMAIL) {
      loginEmail = staffRecord.EMAIL;
    }

    // 2. Tiến hành đăng nhập bằng Supabase Auth signInWithPassword()
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: cleanPass
      });

      if (!signInError && signInData?.user) {
        const authUser = signInData.user;
        // 3. Truy vấn bảng b_nhanvien theo user_id = authUser.id hoặc email (để tự động liên kết tài khoản cũ)
        let freshStaff = null;
        
        const { data: freshStaffs, error: fetchError } = await supabase
          .from('b_nhanvien')
          .select('*')
          .eq('user_id', authUser.id);

        if (freshStaffs && freshStaffs.length > 0) {
          freshStaff = freshStaffs[0];
        }

        // Dự phòng tự động liên kết tài khoản cũ khớp Email hoặc Tên đăng nhập nhưng chưa gắn user_id
        if (!freshStaff) {
          console.log(`[Login] Không tìm thấy nhân sự theo user_id ${authUser.id}. Tiến hành tìm dự phòng theo Email hoặc Tên đăng nhập...`);
          const userIdentifier = (loginEmail || authUser.email || '').trim().toLowerCase();
          
          if (userIdentifier) {
            const { data: dbNhanViens, error: dbError } = await supabase
              .from('b_nhanvien')
              .select('*');

            if (dbNhanViens && dbNhanViens.length > 0) {
              const matched = dbNhanViens.find(n => {
                const storedUser = (n.TEN_DANG_NHAP || '').trim().toLowerCase();
                const storedEmail = (n.EMAIL || '').trim().toLowerCase();
                return storedUser === userIdentifier || storedEmail === userIdentifier;
              });

              if (matched) {
                freshStaff = matched;
                console.log(`[Login Auth Link] Phát hiện tài khoản khớp thông tin (${matched.MA_NV}). Tiến hành tự động liên kết user_id...`);
                try {
                  await supabase
                    .from('b_nhanvien')
                    .update({ user_id: authUser.id })
                    .eq('MA_NV', matched.MA_NV);
                  freshStaff.user_id = authUser.id;
                  console.log('[Login Auth Link] Đã liên kết tài khoản thành công!');
                } catch (linkErr) {
                  console.warn('[Login Auth Link] Lỗi khi tự động lưu liên kết user_id:', linkErr);
                }
              }
            }
          }
        }

        if (!freshStaff) {
          setErrorMsg('Không tìm thấy thông tin nhân viên liên kết với tài khoản này.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        // 4. Kiểm tra trạng thái tài khoản: Nếu active = false hoặc TRANG_THAI = 'CHỜ DUYỆT'
        const rawStatus = (freshStaff.TRANG_THAI || '').trim().toUpperCase();
        const role = (freshStaff.ROLE || '').trim().toUpperCase();
        const isActive = freshStaff.active === true;
        
        const isApprovedAdmin = role === 'ADMIN' && isActive && 
          (rawStatus === 'ACTIVE' || rawStatus === 'HOẠT ĐỘNG' || rawStatus === 'KÍCH HOẠT' || rawStatus === 'HOAT DONG');

        const isPending = !isApprovedAdmin && (
          !isActive || 
          rawStatus === 'PENDING' || 
          rawStatus === 'CHỜ DUYỆT' || 
          rawStatus === 'CHO DUYET' || 
          role === 'PENDING'
        );

        if (isPending) {
          setErrorMsg('Tài khoản đang chờ quản trị viên phê duyệt.');
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        // Đăng nhập thành công!
        setLoading(false);
        onLoginSuccess({
          username: freshStaff.TEN_DANG_NHAP || freshStaff.EMAIL || freshStaff.HO_TEN,
          fullName: freshStaff.HO_TEN,
          role: freshStaff.ROLE || 'NHAN_VIEN',
          branch: freshStaff.CHI_NHANH || 'Kho Trung Tâm',
          writeAccess: freshStaff.WRITE_ACCESS !== false,
          WRITE_ACCESS: freshStaff.WRITE_ACCESS !== false,
          id: freshStaff.MA_NV,
          user_id: freshStaff.user_id,
          ROLES: freshStaff.ROLES || (freshStaff.ROLE ? [freshStaff.ROLE] : [])
        });
        return;
      } else {
        console.warn('Lỗi đăng nhập qua Supabase Auth:', signInError ? signInError.message : 'No user returned');
      }
    } catch (authErr) {
      console.warn('Lỗi hệ thống đăng nhập Auth:', authErr);
    }

    // 5. Dự phòng Trực tuyến từ bảng b_nhanvien trực tiếp nếu có kết nối trực tuyến
    if (staffRecord) {
      const matchedPassword = (staffRecord.MAT_KHAU || staffRecord.PASSWORD || '').trim();
      if (matchedPassword === cleanPass) {
        // Kiểm tra trạng thái tài khoản
        const rawStatus = (staffRecord.TRANG_THAI || '').trim().toUpperCase();
        const role = (staffRecord.ROLE || '').trim().toUpperCase();
        const isActive = staffRecord.active === true;

        const isApprovedAdmin = role === 'ADMIN' && isActive && 
          (rawStatus === 'ACTIVE' || rawStatus === 'HOẠT ĐỘNG' || rawStatus === 'KÍCH HOẠT' || rawStatus === 'HOAT DONG');

        const isPending = !isApprovedAdmin && (
          !isActive || 
          rawStatus === 'PENDING' || 
          rawStatus === 'CHỜ DUYỆT' || 
          rawStatus === 'CHO DUYET' || 
          role === 'PENDING'
        );

        if (isPending) {
          setErrorMsg('Tài khoản đang chờ quản trị viên phê duyệt.');
          setLoading(false);
          return;
        }

        // Tài khoản hợp lệ nhưng Supabase Auth chưa có/lỗi. Thử đồng bộ hóa tài khoản lên Supabase Auth
        console.log('Tài khoản hợp lệ trong b_nhanvien. Tiến hành tự động đồng bộ lên Auth...');
        try {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: staffRecord.EMAIL,
            password: cleanPass,
            options: {
              data: {
                full_name: staffRecord.HO_TEN,
                username: staffRecord.TEN_DANG_NHAP || staffRecord.EMAIL.split('@')[0]
              }
            }
          });

          if (!signUpError && signUpData?.user) {
            const newUserId = signUpData.user.id;
            await supabase
              .from('b_nhanvien')
              .update({ user_id: newUserId })
              .eq('MA_NV', staffRecord.MA_NV);
            
            // Đăng nhập lại để lấy session chính thức
            await supabase.auth.signInWithPassword({
              email: staffRecord.EMAIL,
              password: cleanPass
            });
            
            staffRecord.user_id = newUserId;
          }
        } catch (syncErr) {
          console.warn('Không thể tự động đồng bộ Auth:', syncErr);
        }

        // Cho phép vào hệ thống ngay lập tức
        setLoading(false);
        onLoginSuccess({
          username: staffRecord.TEN_DANG_NHAP || staffRecord.EMAIL || staffRecord.HO_TEN,
          fullName: staffRecord.HO_TEN,
          role: staffRecord.ROLE || 'NHAN_VIEN',
          branch: staffRecord.CHI_NHANH || 'Kho Trung Tâm',
          writeAccess: staffRecord.WRITE_ACCESS !== false,
          WRITE_ACCESS: staffRecord.WRITE_ACCESS !== false,
          id: staffRecord.MA_NV,
          user_id: staffRecord.user_id || 'LOCAL_' + staffRecord.MA_NV,
          ROLES: staffRecord.ROLES || (staffRecord.ROLE ? [staffRecord.ROLE] : [])
        });
        return;
      } else {
        setErrorMsg('Mật khẩu không chính xác. Vui lòng kiểm tra lại.');
        setLoading(false);
        return;
      }
    }

    // 6. Dự phòng Ngoại tuyến / LocalStorage hoàn toàn nếu không kết nối được DB
    try {
      const savedNhanViens = localStorage.getItem('B_NHANVIEN');
      const localNhanVien: NhanVien[] = savedNhanViens ? JSON.parse(savedNhanViens) : [];
      const allNhanViens = [...nhanViens, ...localNhanVien];

      const localStaff = allNhanViens.find(n => {
        const storedUser = (n.TEN_DANG_NHAP || '').trim().toLowerCase();
        const storedEmail = (n.EMAIL || '').trim().toLowerCase();
        const storedCode = (n.MA_NV || '').trim().toLowerCase();
        return storedUser === lowerUser || storedEmail === lowerUser || storedCode === lowerUser;
      });

      if (localStaff) {
        const rawStatus = (localStaff.TRANG_THAI || '').trim().toUpperCase();
        const role = (localStaff.ROLE || '').trim().toUpperCase();
        const isActive = localStaff.active === true;

        const isApprovedAdmin = role === 'ADMIN' && isActive && 
          (rawStatus === 'ACTIVE' || rawStatus === 'HOẠT ĐỘNG' || rawStatus === 'KÍCH HOẠT' || rawStatus === 'HOAT DONG');

        const isPending = !isApprovedAdmin && (
          !isActive || 
          rawStatus === 'PENDING' || 
          rawStatus === 'CHỜ DUYỆT' || 
          rawStatus === 'CHO DUYET' || 
          role === 'PENDING'
        );

        if (isPending) {
          setErrorMsg('Tài khoản đang chờ quản trị viên phê duyệt.');
          setLoading(false);
          return;
        }

        const matchedPassword = (localStaff.MAT_KHAU || localStaff.PASSWORD || '').trim();
        if (matchedPassword === cleanPass) {
          setLoading(false);
          onLoginSuccess({
            username: localStaff.TEN_DANG_NHAP || localStaff.EMAIL || localStaff.HO_TEN,
            fullName: localStaff.HO_TEN,
            role: localStaff.ROLE || 'NHAN_VIEN',
            branch: localStaff.CHI_NHANH || 'Kho Trung Tâm',
            writeAccess: localStaff.WRITE_ACCESS !== false,
            WRITE_ACCESS: localStaff.WRITE_ACCESS !== false,
            id: localStaff.MA_NV,
            user_id: localStaff.user_id,
            ROLES: localStaff.ROLES || (localStaff.ROLE ? [localStaff.ROLE] : [])
          });
          return;
        } else {
          setErrorMsg('Mật khẩu không chính xác. Vui lòng kiểm tra lại.');
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Lỗi đối chiếu dự phòng ngoại tuyến:', err);
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
      const { data: dbNhanViens, error: dbError } = await supabase
        .from('b_nhanvien')
        .select('*');

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
            .eq('user_id', staffMember.user_id);

          if (updateError) {
            setResetError('Có lỗi xảy ra khi gửi yêu cầu lên máy chủ.');
          } else {
            setResetSuccess('Gửi yêu cầu thành công! Vui lòng báo cho Admin/Quản lý để đặt lại mật khẩu mới cho bạn.');
            
            // Gửi email khôi phục mật khẩu (Quên mật khẩu)
            try {
              const emailDate = new Date().toLocaleString('vi-VN');
              const mailContent = `Chào ${staffMember.HO_TEN || targetUser},\n\n` +
                `Hệ thống Quản Lý Kho đã nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn.\n\n` +
                `Thông tin yêu cầu:\n` +
                `- Họ tên: ${staffMember.HO_TEN}\n` +
                `- Tên đăng nhập: ${staffMember.TEN_DANG_NHAP || targetUser}\n` +
                `- Email: ${staffMember.EMAIL}\n` +
                `- Thời gian yêu cầu: ${emailDate}\n` +
                `- Trạng thái yêu cầu: Đang chờ Admin xử lý\n\n` +
                `Yêu cầu của bạn đã được chuyển đến Quản trị viên hệ thống để tiến hành đặt lại mật khẩu. Vui lòng liên hệ trực tiếp với Admin để được cấp mật khẩu mới sớm nhất.\n\n` +
                `Trân trọng,\nBan Quản Trị Quản Lý Kho`;

              await syncEmailLog({
                EMAIL: staffMember.EMAIL || targetUser,
                TIEU_DE: "Yêu cầu khôi phục mật khẩu tài khoản Quản Lý Kho",
                NOI_DUNG: mailContent,
                NGAY_GUI: emailDate,
                TRANG_THAI: "Thành công",
                LOAI_EMAIL: "Quên mật khẩu"
              }, staffMember.user_id);
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
