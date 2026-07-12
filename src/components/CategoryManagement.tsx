/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FolderTree, 
  Tag, 
  MapPin, 
  Users, 
  Plus, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Mail, 
  Briefcase,
  Edit,
  Trash2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ThươngHieu, ChiNhanh, NhanVien, UserRole } from '../types';

/**
 * FILE: CategoryManagement.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Quản lý danh mục nền tảng (Master Data) bao gồm Thương hiệu, Chi nhánh và Nhân sự.
 *        Cung cấp các Form bổ sung, sửa và xóa danh mục, hỗ trợ thiết lập quyền hạn phân vai (Admin, Kho, Nhân viên)
 *        để bảo mật phân vùng chức năng trên toàn hệ thống.
 */

interface CategoryManagementProps {
  thuongHieus: ThươngHieu[];
  chiNhanhs: ChiNhanh[];
  nhanViens: NhanVien[];
  onAddThuongHieu: (brand: ThươngHieu) => void;
  onAddChiNhanh: (branch: ChiNhanh) => void;
  onAddNhanVien: (staff: NhanVien) => void;
  onUpdateThuongHieu: (oldBrandName: string, updatedBrand: ThươngHieu) => void;
  onDeleteThuongHieu: (brandName: string) => void;
  onUpdateChiNhanh: (oldBranchName: string, updatedBranch: ChiNhanh) => void;
  onDeleteChiNhanh: (branchName: string) => void;
  onUpdateNhanVien: (oldEmail: string, updatedStaff: NhanVien) => void;
  onDeleteNhanVien: (email: string) => void;
  currentUser: any;
}

export default function CategoryManagement({
  thuongHieus,
  chiNhanhs,
  nhanViens,
  onAddThuongHieu,
  onAddChiNhanh,
  onAddNhanVien,
  onUpdateThuongHieu,
  onDeleteThuongHieu,
  onUpdateChiNhanh,
  onDeleteChiNhanh,
  onUpdateNhanVien,
  onDeleteNhanVien,
  currentUser
}: CategoryManagementProps) {
  
  // --- 1. QUẢN LÝ TAB DANH MỤC HIỆN TẠI ---
  const [activeSubTab, setActiveSubTab] = useState<'BRAND' | 'BRANCH' | 'STAFF'>('BRAND');
  
  // Các trạng thái Form và Edit
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [editingBrand, setEditingBrand] = useState<{ oldName: string; brand: ThươngHieu } | null>(null);
  const [editingBranch, setEditingBranch] = useState<{ oldName: string; branch: ChiNhanh } | null>(null);
  const [editingStaff, setEditingStaff] = useState<{ oldEmail: string; staff: NhanVien } | null>(null);

  // Form Thương hiệu
  const [newBrandName, setNewBrandName] = useState<string>('');
  const [newBrandCX, setNewBrandCX] = useState<string>('1.56');
  const [newBrandTN, setNewBrandTN] = useState<string>('ASX');

  // Form Chi nhánh
  const [newBranchName, setNewBranchName] = useState<string>('');
  const [newBranchAddress, setNewBranchAddress] = useState<string>('');
  const [newBranchPhone, setNewBranchPhone] = useState<string>('');

  // Form Nhân viên
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('NHAN_VIEN');
  const [newStaffEmail, setNewStaffEmail] = useState<string>('');
  const [newStaffBranch, setNewStaffBranch] = useState<string>('Kho Trung Tâm');
  const [newStaffChucVu, setNewStaffChucVu] = useState<string>('Nhân viên bán kính');
  const [newStaffUsername, setNewStaffUsername] = useState<string>('');
  const [newStaffPassword, setNewStaffPassword] = useState<string>('');

  // --- 2. THƯƠNG HIỆU (BRAND) ACTIONS ---
  const handleCreateBrand = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newBrandName.trim()) {
      setErrorMsg('Vui lòng nhập tên thương hiệu tròng kính.');
      return;
    }

    const isExist = thuongHieus.some(b => b.THUONG_HIEU.toLowerCase() === newBrandName.trim().toLowerCase());
    if (isExist) {
      setErrorMsg(`Thương hiệu [${newBrandName}] đã tồn tại trong danh mục.`);
      return;
    }

    const brandRecord: ThươngHieu = {
      THUONG_HIEU: newBrandName.trim(),
      CHIET_XUAT_MAC_DINH: newBrandCX,
      TINH_NANG_MAC_DINH: newBrandTN
    };

    onAddThuongHieu(brandRecord);
    setSuccessMsg(`Đã khai báo thương hiệu mới [${newBrandName}] thành công!`);
    setNewBrandName('');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleStartEditBrand = (brand: ThươngHieu) => {
    setEditingBrand({ oldName: brand.THUONG_HIEU, brand: { ...brand } });
    setNewBrandName(brand.THUONG_HIEU);
    setNewBrandCX(brand.CHIET_XUAT_MAC_DINH || '1.56');
    setNewBrandTN(brand.TINH_NANG_MAC_DINH || 'ASX');
  };

  const handleSaveEditBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (!newBrandName.trim()) {
      setErrorMsg('Vui lòng nhập tên thương hiệu tròng kính.');
      return;
    }

    const updatedBrand: ThươngHieu = {
      THUONG_HIEU: newBrandName.trim(),
      CHIET_XUAT_MAC_DINH: newBrandCX,
      TINH_NANG_MAC_DINH: newBrandTN
    };

    onUpdateThuongHieu(editingBrand.oldName, updatedBrand);
    setSuccessMsg(`Đã cập nhật thương hiệu [${newBrandName}] thành công!`);
    setEditingBrand(null);
    setNewBrandName('');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleCancelEditBrand = () => {
    setEditingBrand(null);
    setNewBrandName('');
  };

  const handleDeleteBrandItem = (brandName: string) => {
    onDeleteThuongHieu(brandName);
    setSuccessMsg(`Đã xóa thương hiệu [${brandName}] khỏi danh mục.`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // --- 3. CHI NHÁNH (BRANCH) ACTIONS ---
  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newBranchName.trim()) {
      setErrorMsg('Vui lòng nhập tên chi nhánh mới.');
      return;
    }

    const isExist = chiNhanhs.some(c => c.CHI_NHANH.toLowerCase() === newBranchName.trim().toLowerCase());
    if (isExist) {
      setErrorMsg(`Chi nhánh [${newBranchName}] đã có trong cơ sở dữ liệu.`);
      return;
    }

    const branchRecord: ChiNhanh = {
      CHI_NHANH: newBranchName.trim(),
      DIA_CHI: newBranchAddress.trim() || 'Chưa cập nhật',
      SDT: newBranchPhone.trim() || 'Chưa cập nhật'
    };

    onAddChiNhanh(branchRecord);
    setSuccessMsg(`Đã tạo chi nhánh mới [${newBranchName}] thành công!`);
    setNewBranchName('');
    setNewBranchAddress('');
    setNewBranchPhone('');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleStartEditBranch = (branch: ChiNhanh) => {
    setEditingBranch({ oldName: branch.CHI_NHANH, branch: { ...branch } });
    setNewBranchName(branch.CHI_NHANH);
    setNewBranchAddress(branch.DIA_CHI || '');
    setNewBranchPhone(branch.SDT || '');
  };

  const handleSaveEditBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (!newBranchName.trim()) {
      setErrorMsg('Vui lòng nhập tên chi nhánh.');
      return;
    }

    const updatedBranch: ChiNhanh = {
      CHI_NHANH: newBranchName.trim(),
      DIA_CHI: newBranchAddress.trim() || 'Chưa cập nhật',
      SDT: newBranchPhone.trim() || 'Chưa cập nhật'
    };

    onUpdateChiNhanh(editingBranch.oldName, updatedBranch);
    setSuccessMsg(`Đã cập nhật chi nhánh [${newBranchName}] thành công!`);
    setEditingBranch(null);
    setNewBranchName('');
    setNewBranchAddress('');
    setNewBranchPhone('');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleCancelEditBranch = () => {
    setEditingBranch(null);
    setNewBranchName('');
    setNewBranchAddress('');
    setNewBranchPhone('');
  };

  const handleDeleteBranchItem = (branchName: string) => {
    onDeleteChiNhanh(branchName);
    setSuccessMsg(`Đã xóa chi nhánh [${branchName}] khỏi hệ thống.`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // --- 4. NHÂN VIÊN & PHÂN QUYỀN (STAFF) ACTIONS ---
  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newStaffName.trim() || !newStaffUsername.trim() || !newStaffPassword.trim()) {
      setErrorMsg('Vui lòng cung cấp đầy đủ Họ tên, Tên đăng nhập và Mật khẩu.');
      return;
    }

    const isExist = nhanViens.some(n => (n.TEN_DANG_NHAP || '').toLowerCase() === newStaffUsername.trim().toLowerCase());
    if (isExist) {
      setErrorMsg(`Tên đăng nhập [${newStaffUsername}] đã được sử dụng.`);
      return;
    }

    // Tự sinh email ẩn để đảm bảo tính đồng bộ và không lỗi schema DB cũ
    const generatedEmail = `${newStaffUsername.trim().toLowerCase()}@glassstock.com`;

    const staffRecord: NhanVien = {
      MA_NV: `NV${String(nhanViens.length + 1).padStart(4, '0')}`,
      HO_TEN: newStaffName.trim(),
      CHUC_VU: newStaffChucVu,
      BO_PHAN: newStaffRole === 'ADMIN' ? 'Ban Giám Đốc' : newStaffRole === 'KHO' ? 'Bộ Phận Kho' : 'Bộ Phận Bán Hàng',
      CHI_NHANH: newStaffBranch,
      EMAIL: generatedEmail,
      ROLE: newStaffRole,
      WRITE_ACCESS: newStaffRole === 'ADMIN' || newStaffRole === 'KHO',
      TEN_DANG_NHAP: newStaffUsername.trim(),
      MAT_KHAU: newStaffPassword.trim()
    };

    onAddNhanVien(staffRecord);
    setSuccessMsg(`Đã tạo nhân sự mới [${newStaffName}] với quyền [${newStaffRole}] thành công!`);
    setNewStaffName('');
    setNewStaffUsername('');
    setNewStaffPassword('');
    setNewStaffChucVu('Nhân viên bán kính');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleStartEditStaff = (staff: NhanVien) => {
    setEditingStaff({ oldEmail: staff.EMAIL, staff: { ...staff } });
    setNewStaffName(staff.HO_TEN);
    setNewStaffUsername(staff.TEN_DANG_NHAP || '');
    setNewStaffPassword(staff.MAT_KHAU || '');
    setNewStaffBranch(staff.CHI_NHANH);
    setNewStaffChucVu(staff.CHUC_VU);
    setNewStaffRole(staff.ROLE);
  };

  const handleSaveEditStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setErrorMsg('');
    setSuccessMsg('');

    if (!newStaffName.trim() || !newStaffUsername.trim() || !newStaffPassword.trim()) {
      setErrorMsg('Vui lòng cung cấp đầy đủ Họ tên, Tên đăng nhập và Mật khẩu.');
      return;
    }

    const updatedStaff: NhanVien = {
      MA_NV: editingStaff.staff.MA_NV,
      HO_TEN: newStaffName.trim(),
      CHUC_VU: newStaffChucVu,
      BO_PHAN: newStaffRole === 'ADMIN' ? 'Ban Giám Đốc' : newStaffRole === 'KHO' ? 'Bộ Phận Kho' : 'Bộ Phận Bán Hàng',
      CHI_NHANH: newStaffBranch,
      EMAIL: editingStaff.staff.EMAIL, // Giữ nguyên Email cũ làm khóa duy nhất cho các logic đồng bộ cũ
      ROLE: newStaffRole,
      WRITE_ACCESS: newStaffRole === 'ADMIN' || newStaffRole === 'KHO',
      TEN_DANG_NHAP: newStaffUsername.trim(),
      MAT_KHAU: newStaffPassword.trim()
    };

    onUpdateNhanVien(editingStaff.oldEmail, updatedStaff);
    setSuccessMsg(`Đã cập nhật nhân sự [${newStaffName}] thành công!`);
    setEditingStaff(null);
    setNewStaffName('');
    setNewStaffUsername('');
    setNewStaffPassword('');
    setNewStaffChucVu('Nhân viên bán kính');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleCancelEditStaff = () => {
    setEditingStaff(null);
    setNewStaffName('');
    setNewStaffUsername('');
    setNewStaffPassword('');
    setNewStaffChucVu('Nhân viên bán kính');
  };

  const handleDeleteStaffItem = (email: string) => {
    onDeleteNhanVien(email);
    setSuccessMsg(`Đã xóa nhân sự khỏi hệ thống.`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="space-y-6">
      
      {currentUser.WRITE_ACCESS === false && (
        <div className="p-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl text-xs flex items-center gap-3 shadow-2xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
          <span className="font-semibold">
            Tài khoản của bạn <strong>({currentUser.fullName} - {currentUser.role})</strong> được phân quyền <strong>Chỉ Xem</strong>. Mọi tác vụ khai báo thương hiệu, chi nhánh và nhân sự đã bị khóa.
          </span>
        </div>
      )}

      {/* 1. THANH MENU TAB DANH MỤC */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <FolderTree className="w-5.5 h-5.5" />
          </div>
          <div>
            <h2 className="font-sans font-bold text-slate-800 text-base">Quản Lý Danh Mục Nền Tảng</h2>
            <p className="text-xs text-slate-400 font-mono">Khai báo cấu trúc dữ liệu tổng thể và phân quyền nhân viên</p>
          </div>
        </div>

        {/* Chuyển đổi tab */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => { setActiveSubTab('BRAND'); setErrorMsg(''); setSuccessMsg(''); handleCancelEditBrand(); }}
            className={`flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'BRAND' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Tag className="w-3.5 h-3.5" /> Thương Hiệu
          </button>
          <button
            onClick={() => { setActiveSubTab('BRANCH'); setErrorMsg(''); setSuccessMsg(''); handleCancelEditBranch(); }}
            className={`flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'BRANCH' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" /> Chi Nhánh
          </button>
          <button
            onClick={() => { setActiveSubTab('STAFF'); setErrorMsg(''); setSuccessMsg(''); handleCancelEditStaff(); }}
            className={`flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'STAFF' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Nhân Viên & Quyền
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs">
          <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs">
          <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* 2. CHIA LUỒNG HIỂN THỊ CHỨC NĂNG CỤ THỂ THEO TAB */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* TAB 1: THƯƠNG HIỆU & CÀI ĐẶT THƯƠNG HIỆU */}
        {activeSubTab === 'BRAND' && (
          <>
            {/* Form khai báo mới (Chỉ hiện nếu có quyền ghi) */}
            {currentUser.writeAccess !== false && (
              <div className="bento-card !p-5 space-y-4 lg:col-span-2">
                <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2">
                  Khai báo thương hiệu mới
                </h3>

                <form onSubmit={handleCreateBrand} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Tên Thương Hiệu</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Kodak, Hoya, Chemi..."
                      value={editingBrand ? '' : newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400">Chiết suất mặc định</label>
                      <select
                        value={editingBrand ? '1.56' : newBrandCX}
                        onChange={(e) => setNewBrandCX(e.target.value)}
                        className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 focus:outline-hidden"
                      >
                        <option value="1.56">1.56</option>
                        <option value="1.60">1.60</option>
                        <option value="1.61">1.61</option>
                        <option value="1.67">1.67</option>
                        <option value="1.74">1.74</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400">Tính năng mặc định</label>
                      <select
                        value={editingBrand ? 'ASX' : newBrandTN}
                        onChange={(e) => setNewBrandTN(e.target.value)}
                        className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 focus:outline-hidden"
                      >
                        <option value="ĐM">Đổi màu (ĐM)</option>
                        <option value="ASX">Ánh sáng xanh (ASX)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Thêm Thương Hiệu
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Bảng danh sách */}
            <div className={`bento-card !p-0 overflow-hidden ${currentUser.writeAccess !== false ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
              <div className="bg-slate-50/75 px-4 py-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700 uppercase">Danh sách thương hiệu hoạt động</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/25 border-b border-slate-100">
                      <th className="py-2.5 px-4 text-slate-400 font-bold uppercase font-mono">STT</th>
                      <th className="py-2.5 px-4 text-slate-400 font-bold uppercase">Thương Hiệu</th>
                      <th className="py-2.5 px-4 text-slate-400 font-bold uppercase text-center">Chiết suất mặc định</th>
                      <th className="py-2.5 px-4 text-slate-400 font-bold uppercase text-center">Tính năng mặc định</th>
                      {currentUser.writeAccess !== false && (
                        <th className="py-2.5 px-4 text-slate-400 font-bold uppercase text-right">Thao tác</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {thuongHieus.map((b, index) => (
                      <tr key={b.THUONG_HIEU} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400">{index + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-700">{b.THUONG_HIEU}</td>
                        <td className="py-3 px-4 text-center font-bold text-blue-600 font-mono">{b.CHIET_XUAT_MAC_DINH || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="bg-slate-100 text-slate-600 font-bold py-0.5 px-2 rounded text-[10px]">
                            {b.TINH_NANG_MAC_DINH || '—'}
                          </span>
                        </td>
                        {currentUser.writeAccess !== false && (
                          <td className="py-3 px-4 text-right space-x-1.5">
                            <button
                              onClick={() => handleStartEditBrand(b)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer transition-colors inline-flex"
                              title="Sửa"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteBrandItem(b.THUONG_HIEU)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded-md cursor-pointer transition-colors inline-flex"
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: CHI NHÁNH */}
        {activeSubTab === 'BRANCH' && (
          <>
            {/* Form khai báo mới (Chỉ hiện nếu có quyền ghi) */}
            {currentUser.writeAccess !== false && (
              <div className="bento-card !p-5 space-y-4 lg:col-span-2">
                <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2">
                  Thêm chi nhánh cửa hàng
                </h3>

                <form onSubmit={handleCreateBranch} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Tên Chi Nhánh</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Chi nhánh Gò Vấp..."
                      value={editingBranch ? '' : newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Địa Chỉ Chi Nhánh</label>
                    <input
                      type="text"
                      placeholder="Nhập địa chỉ cụ thể..."
                      value={editingBranch ? '' : newBranchAddress}
                      onChange={(e) => setNewBranchAddress(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Số Điện Thoại</label>
                    <input
                      type="text"
                      placeholder="Nhập hotline liên lạc..."
                      value={editingBranch ? '' : newBranchPhone}
                      onChange={(e) => setNewBranchPhone(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden font-mono"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Kích hoạt chi nhánh
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Bảng danh sách */}
            <div className={`bento-card !p-0 overflow-hidden ${currentUser.WRITE_ACCESS !== false ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
              <div className="bg-slate-50/75 px-4 py-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700 uppercase">Danh sách hệ thống chi nhánh</span>
              </div>
              <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                {chiNhanhs.map((c, index) => (
                  <div key={c.CHI_NHANH} className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800">{c.CHI_NHANH}</p>
                      <p className="text-[11px] text-slate-400 truncate">{c.DIA_CHI || 'Chưa cập nhật địa chỉ'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-50 border border-slate-100 py-1 px-2.5 rounded-md">
                        {c.SDT || '—'}
                      </span>
                      {currentUser.WRITE_ACCESS !== false && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEditBranch(c)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer transition-colors inline-flex"
                            title="Sửa"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteBranchItem(c.CHI_NHANH)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded-md cursor-pointer transition-colors inline-flex"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* TAB 3: NHÂN VIÊN & PHÂN QUYỀN */}
        {activeSubTab === 'STAFF' && (
          <>
            {/* Form khai báo mới (Chỉ hiện nếu có quyền ghi) */}
            {currentUser.writeAccess !== false && (
              <div className="bento-card !p-5 space-y-4 lg:col-span-2">
                <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2">
                  Tạo nhân sự mới & Cấp quyền
                </h3>

                <form onSubmit={handleCreateStaff} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Họ và Tên Nhân Viên</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Nguyễn Văn A..."
                      value={editingStaff ? '' : newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400">Tên Đăng Nhập</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: nva_glass..."
                        value={editingStaff ? '' : newStaffUsername}
                        onChange={(e) => setNewStaffUsername(e.target.value)}
                        className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400">Mật khẩu</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={editingStaff ? '' : newStaffPassword}
                        onChange={(e) => setNewStaffPassword(e.target.value)}
                        className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400">Chi nhánh trực thuộc</label>
                      <select
                        value={editingStaff ? 'Kho Trung Tâm' : newStaffBranch}
                        onChange={(e) => setNewStaffBranch(e.target.value)}
                        className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 focus:outline-hidden"
                      >
                        {chiNhanhs.map(c => (
                          <option key={c.CHI_NHANH} value={c.CHI_NHANH}>{c.CHI_NHANH}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400">Chức vụ cụ thể</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Kế toán, Thủ kho..."
                        value={editingStaff ? 'Nhân viên bán kính' : newStaffChucVu}
                        onChange={(e) => setNewStaffChucVu(e.target.value)}
                        className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Cấp quyền hệ thống</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['ADMIN', 'KHO', 'NHAN_VIEN'] as const).map(role => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setNewStaffRole(role)}
                          className={`py-2 px-1 text-[10px] font-bold rounded-lg cursor-pointer text-center ${
                            newStaffRole === role ? 'bg-red-600 text-white shadow-xs' : 'bg-slate-50 text-slate-400 border border-slate-100'
                          }`}
                        >
                          {role === 'ADMIN' ? 'Admin' : role === 'KHO' ? 'Thủ Kho' : 'Nhân Viên'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Lưu thông tin & Cấp quyền
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Bảng danh sách */}
            <div className={`bento-card !p-0 overflow-hidden ${currentUser.writeAccess !== false ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
              <div className="bg-slate-50/75 px-4 py-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-700 uppercase">Danh sách nhân sự & Quyền hạn</span>
              </div>
              <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                {nhanViens.map((n) => {
                  let roleColor = 'bg-blue-50 text-blue-700 border-blue-100';
                  if (n.ROLE === 'ADMIN') roleColor = 'bg-rose-50 text-rose-700 border-rose-100';
                  if (n.ROLE === 'KHO') roleColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';

                  return (
                    <div key={n.MA_NV} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1 min-w-0">
                        <p className="font-bold text-slate-800 flex items-center gap-1.5">
                          {n.HO_TEN} 
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 py-0.5 px-1.5 rounded">
                            {n.MA_NV}
                          </span>
                        </p>
                        <p className="text-slate-600 font-mono text-[11px] flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" /> Tài khoản: <span className="font-bold text-blue-600">{n.TEN_DANG_NHAP || 'Chưa thiết lập'}</span>
                        </p>
                        <p className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5 text-slate-300" /> {n.CHUC_VU} | {n.CHI_NHANH}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center gap-1 font-mono font-bold text-[10px] py-1 px-3 rounded-full border ${roleColor}`}>
                          <Shield className="w-3 h-3" /> {n.ROLE}
                        </span>
                        {currentUser.writeAccess !== false && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleStartEditStaff(n)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer transition-colors inline-flex"
                              title="Sửa"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteStaffItem(n.EMAIL)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded-md cursor-pointer transition-colors inline-flex"
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

      </div>

      {/* OVERLAY MODALS FOR EDITING (CENTERED) */}
      <AnimatePresence>
        {/* 1. Edit Brand Modal */}
        {editingBrand && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col"
            >
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-sans font-bold text-slate-800 text-sm uppercase">Cập nhật thương hiệu</h3>
                <button
                  type="button"
                  onClick={handleCancelEditBrand}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer text-xs font-bold"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditBrand} className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Tên Thương Hiệu</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Kodak, Hoya, Chemi..."
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Chiết suất mặc định</label>
                    <select
                      value={newBrandCX}
                      onChange={(e) => setNewBrandCX(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 focus:outline-hidden"
                    >
                      <option value="1.56">1.56</option>
                      <option value="1.60">1.60</option>
                      <option value="1.61">1.61</option>
                      <option value="1.67">1.67</option>
                      <option value="1.74">1.74</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Tính năng mặc định</label>
                    <select
                      value={newBrandTN}
                      onChange={(e) => setNewBrandTN(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 focus:outline-hidden"
                    >
                      <option value="ĐM">Đổi màu (ĐM)</option>
                      <option value="ASX">Ánh sáng xanh (ASX)</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelEditBrand}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-2 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" /> Lưu cập nhật
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* 2. Edit Branch Modal */}
        {editingBranch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col"
            >
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-sans font-bold text-slate-800 text-sm uppercase">Cập nhật chi nhánh</h3>
                <button
                  type="button"
                  onClick={handleCancelEditBranch}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer text-xs font-bold"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditBranch} className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Tên Chi Nhánh</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Chi nhánh Gò Vấp..."
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Địa Chỉ Chi Nhánh</label>
                  <input
                    type="text"
                    placeholder="Nhập địa chỉ cụ thể..."
                    value={newBranchAddress}
                    onChange={(e) => setNewBranchAddress(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Số Điện Thoại</label>
                  <input
                    type="text"
                    placeholder="Nhập hotline liên lạc..."
                    value={newBranchPhone}
                    onChange={(e) => setNewBranchPhone(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden font-mono"
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelEditBranch}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-2 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" /> Lưu cập nhật
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* 3. Edit Staff Modal */}
        {editingStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col"
            >
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-sans font-bold text-slate-800 text-sm uppercase">Cập nhật nhân sự & quyền</h3>
                <button
                  type="button"
                  onClick={handleCancelEditStaff}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer text-xs font-bold"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditStaff} className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Họ và Tên Nhân Viên</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Nguyễn Văn A..."
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Tên Đăng Nhập</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: nva_glass..."
                      value={newStaffUsername}
                      onChange={(e) => setNewStaffUsername(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Mật khẩu mới</label>
                    <input
                      type="password"
                      placeholder="Nhập mật khẩu mới..."
                      value={newStaffPassword}
                      onChange={(e) => setNewStaffPassword(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Chi nhánh trực thuộc</label>
                    <select
                      value={newStaffBranch}
                      onChange={(e) => setNewStaffBranch(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 focus:outline-hidden"
                    >
                      {chiNhanhs.map(c => (
                        <option key={c.CHI_NHANH} value={c.CHI_NHANH}>{c.CHI_NHANH}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Chức vụ cụ thể</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Kế toán, Thủ kho..."
                      value={newStaffChucVu}
                      onChange={(e) => setNewStaffChucVu(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Cấp quyền hệ thống</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['ADMIN', 'KHO', 'NHAN_VIEN'] as const).map(role => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setNewStaffRole(role)}
                        className={`py-2 px-1 text-[10px] font-bold rounded-lg cursor-pointer text-center ${
                          newStaffRole === role ? 'bg-red-600 text-white shadow-xs' : 'bg-slate-50 text-slate-400 border border-slate-100'
                        }`}
                      >
                        {role === 'ADMIN' ? 'Admin' : role === 'KHO' ? 'Thủ Kho' : 'Nhân Viên'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelEditStaff}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-2 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" /> Lưu cập nhật
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
