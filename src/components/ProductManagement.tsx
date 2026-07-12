/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  Info, 
  Tag, 
  Layers, 
  Compass, 
  AlertCircle, 
  CheckCircle,
  Eye,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SanPham, ThươngHieu } from '../types';
import { generateSKUString, formatDop } from '../data/mockData';

/**
 * FILE: ProductManagement.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Quản lý danh mục Sản phẩm tròng kính (B_SANPHAM).
 *        Hỗ trợ tìm kiếm thông minh, lọc nâng cao theo thuộc tính quang học (SPH, CYL, Chiết suất),
 *        và cung cấp Form tạo sản phẩm mới tự động hóa sinh SKU và kiểm tra trùng lặp chặt chẽ.
 */

export const getStockStatus = (tonCuoi: number, tonToiThieu: number) => {
  if (tonCuoi <= 0) {
    return {
      level: 5,
      label: 'Hết hàng',
      colorClass: 'bg-red-50 text-red-600 border border-red-200',
      iconClass: 'text-red-500'
    };
  }
  if (tonCuoi < tonToiThieu) {
    return {
      level: 4,
      label: 'Sắp hết hàng',
      colorClass: 'bg-orange-50 text-orange-600 border border-orange-200',
      iconClass: 'text-orange-500'
    };
  }
  if (tonCuoi === tonToiThieu) {
    return {
      level: 3,
      label: 'Hàng còn ít',
      colorClass: 'bg-amber-50 text-amber-600 border border-amber-200',
      iconClass: 'text-amber-500'
    };
  }
  if (tonCuoi > tonToiThieu * 2) {
    return {
      level: 1,
      label: 'Còn nhiều hàng',
      colorClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
      iconClass: 'text-emerald-500'
    };
  }
  return {
    level: 2,
    label: 'Tồn kho an toàn',
    colorClass: 'bg-blue-50 text-blue-600 border border-blue-200',
    iconClass: 'text-blue-500'
  };
};

interface ProductManagementProps {
  sanPhams: SanPham[];
  onAddProduct: (newProduct: SanPham) => void;
  thuongHieus: ThươngHieu[];
  currentUser: any;
  onUpdateMinStock?: (sku: string, newMinStock: number) => void;
}

export default function ProductManagement({ sanPhams, onAddProduct, thuongHieus, currentUser, onUpdateMinStock }: ProductManagementProps) {
  // --- 1. QUẢN LÝ TRẠNG THÁI HIỂN THỊ & TÌM KIẾM ---
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterBrand, setFilterBrand] = useState<string>('Tất cả');
  const [filterStockStatus, setFilterStockStatus] = useState<string>('Tất cả');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // --- TRẠNG THÁI SẮP XẾP CỘT ---
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // --- PHÂN TRANG CHO SẢN PHẨM (TỐI ƯU HÓA TRÁNH LAG) ---
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 30; // Giới hạn 30 sản phẩm/trang để tải siêu nhanh, mượt mà

  // Reset về trang 1 khi lọc hoặc tìm kiếm thay đổi
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterBrand, filterStockStatus]);

  // --- 2. QUẢN LÝ TRẠNG THÁI FORM TẠO MỚI ---
  const [formBrand, setFormBrand] = useState<string>('Blick');
  const [formChietXuat, setFormChietXuat] = useState<string>('1.56');
  const [formTinhNang, setFormTinhNang] = useState<string>('ĐM');
  const [formDoSphType, setFormDoSphType] = useState<'CẬN' | 'VIỄN'>('CẬN');
  const [formDoSph, setFormDoSph] = useState<number>(-2.00);
  const [formDoCyl, setFormDoCyl] = useState<number>(0.00);
  const [formTonDau, setFormTonDau] = useState<number>(10);
  const [formTonToiThieu, setFormTonToiThieu] = useState<number>(5);
  const [formDvt, setFormDvt] = useState<string>('miếng');
  const [formError, setFormError] = useState<string>('');

  // --- 2.5 DYNAMIC AVAILABLE FEATURES MEMO ---
  const activeBrandObj = useMemo(() => {
    return thuongHieus.find(t => t.THUONG_HIEU === formBrand);
  }, [thuongHieus, formBrand]);

  const availableFeatures = useMemo(() => {
    if (activeBrandObj?.TINH_NANG_LIST && activeBrandObj.TINH_NANG_LIST.length > 0) {
      return activeBrandObj.TINH_NANG_LIST;
    }
    return [activeBrandObj?.TINH_NANG_MAC_DINH || 'ASX'];
  }, [activeBrandObj]);

  // --- 3. ĐỒNG BỘ ĐỘNG THEO QUY TẮC NGHIỆP VỤ (RULE 1, 2) KHI THAY ĐỔI THƯƠNG HIỆU ---
  const handleBrandChange = (brand: string) => {
    setFormBrand(brand);
    
    // Tìm đối tượng thương hiệu tương ứng
    const brandObj = thuongHieus.find(t => t.THUONG_HIEU === brand);
    
    // Quy tắc 1: Nếu Thương hiệu có TINH_NANG_LIST thì lấy tính năng đầu tiên hoặc mặc định, nếu không thì dùng quy tắc cũ
    let newTinhNang = 'ASX';
    if (brandObj) {
      if (brandObj.TINH_NANG_LIST && brandObj.TINH_NANG_LIST.length > 0) {
        newTinhNang = brandObj.TINH_NANG_LIST[0];
      } else {
        newTinhNang = brandObj.TINH_NANG_MAC_DINH || 'ASX';
      }
    } else {
      const isDM = ['Blick', 'Element', 'Nikki'].includes(brand);
      newTinhNang = isDM ? 'ĐM' : 'ASX';
    }
    setFormTinhNang(newTinhNang);

    // Quy tắc 2: Nếu Thương hiệu là Blick, Zeiss Clear, Essilor Pre, Essilor Rock thì Chiết suất là 1.56.
    // Zeiss Blue chiết suất sẽ là 1.60. Còn lại thì sẽ cho lựa chọn dropdown 1.56, 1.61, 1.67, 1.74.
    if (['Blick', 'Zeiss Clear', 'Essilor Pre', 'Essilor Rock'].includes(brand)) {
      setFormChietXuat('1.56');
    } else if (brand === 'Zeiss Blue') {
      setFormChietXuat('1.60');
    } else {
      setFormChietXuat(brandObj?.CHIET_XUAT_MAC_DINH || '1.61'); // Giá trị mặc định cho dropdown tùy chọn
    }
  };

  // Tính toán SPH Range dựa trên loại độ (Cận: 0.00 đến -8.00, Viễn: 0.75 đến 4.00, bước nhảy 0.25)
  const sphOptions = useMemo(() => {
    const opts: number[] = [];
    if (formDoSphType === 'CẬN') {
      // Cận từ -0.00 đến -8.00
      for (let i = 0; i >= -8.00; i -= 0.25) {
        opts.push(Number(i.toFixed(2)));
      }
    } else {
      // Viễn từ 0.75 đến 4.00
      for (let i = 0.75; i <= 4.00; i += 0.25) {
        opts.push(Number(i.toFixed(2)));
      }
    }
    return opts;
  }, [formDoSphType]);

  // Luôn cập nhật lại độ SPH được chọn nếu nó không nằm trong dãy tùy chọn mới thay đổi
  React.useEffect(() => {
    if (formDoSphType === 'CẬN') {
      setFormDoSph(-2.00); // Reset mặc định độ cận thông dụng
    } else {
      setFormDoSph(1.50);  // Reset mặc định độ viễn thông dụng
    }
  }, [formDoSphType]);

  // Độ loạn từ -0.00 đến -2.00 (bước nhảy 0.25)
  const cylOptions = useMemo(() => {
    const opts: number[] = [];
    for (let i = 0; i >= -2.00; i -= 0.25) {
      opts.push(Number(i.toFixed(2)));
    }
    return opts;
  }, []);

  // --- 4. TÍNH SKU & TÊN SẢN PHẨM REAL-TIME TRÊN FORM ---
  const currentFormSKU = useMemo(() => {
    return generateSKUString(formBrand, formChietXuat, formTinhNang, formDoSph, formDoCyl);
  }, [formBrand, formChietXuat, formTinhNang, formDoSph, formDoCyl]);

  const currentFormProductName = useMemo(() => {
    const labelTinhNang = formTinhNang === 'ĐM' ? 'Đổi màu' : 'Lọc ánh sáng xanh';
    const labelDo = formDoSphType === 'CẬN' ? `Cận ${formatDop(formDoSph)}` : `Viễn ${formatDop(formDoSph)}`;
    const labelCyl = formDoCyl !== 0 ? ` Loạn ${formatDop(formDoCyl)}` : '';
    return `Tròng kính ${labelTinhNang} ${formBrand} ${formChietXuat} ${labelDo}${labelCyl}`;
  }, [formBrand, formChietXuat, formTinhNang, formDoSph, formDoCyl, formDoSphType]);

  // --- 5. LỌC DANH SÁCH SẢN PHẨM HIỂN THỊ ---
  const filteredProducts = useMemo(() => {
    let result = sanPhams.filter(p => {
      const matchSearch = p.SKU.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.TEN_SAN_PHAM.toLowerCase().includes(searchTerm.toLowerCase());
      const matchBrand = filterBrand === 'Tất cả' || p.THUONG_HIEU === filterBrand;
      
      const status = getStockStatus(p.TON_CUOI, p.TON_TOI_THIEU);
      const matchStock = filterStockStatus === 'Tất cả' || 
                         (filterStockStatus === 'Còn nhiều hàng' && status.level === 1) ||
                         (filterStockStatus === 'Tồn kho an toàn' && status.level === 2) ||
                         (filterStockStatus === 'Hàng còn ít' && status.level === 3) ||
                         (filterStockStatus === 'Sắp hết hàng' && status.level === 4) ||
                         (filterStockStatus === 'Hết hàng' && status.level === 5);
      
      return matchSearch && matchBrand && matchStock;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        if (sortField === 'TRANG_THAI') {
          const isAEmpty = a.TON_CUOI <= 0;
          const isBEmpty = b.TON_CUOI <= 0;
          if (isAEmpty && !isBEmpty) return -1;
          if (!isAEmpty && isBEmpty) return 1;
          
          const levelA = getStockStatus(a.TON_CUOI, a.TON_TOI_THIEU).level;
          const levelB = getStockStatus(b.TON_CUOI, b.TON_TOI_THIEU).level;
          
          return sortDirection === 'asc' ? levelB - levelA : levelA - levelB;
        }

        const valA = a[sortField as keyof SanPham];
        const valB = b[sortField as keyof SanPham];

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' 
            ? valA.localeCompare(valB, 'vi', { sensitivity: 'accent' }) 
            : valB.localeCompare(valA, 'vi', { sensitivity: 'accent' });
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' 
            ? valA - valB 
            : valB - valA;
        }
        return 0;
      });
    }

    return result;
  }, [sanPhams, searchTerm, filterBrand, filterStockStatus, sortField, sortDirection]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  }, [filteredProducts, itemsPerPage]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  // --- 6. XỬ LÝ LƯU SẢN PHẨM MỚI (VALIDATION CHẶT CHẼ) ---
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Kiểm tra trùng lặp SKU (Yêu cầu nghiệp vụ: SKU là duy nhất)
    const isDuplicate = sanPhams.some(p => p.SKU.toUpperCase() === currentFormSKU.toUpperCase());
    if (isDuplicate) {
      setFormError(`Lỗi: Mã SKU [${currentFormSKU}] đã tồn tại trong hệ thống. Hãy kiểm tra lại cấu hình thông số.`);
      return;
    }

    if (formTonDau < 0 || formTonToiThieu < 0) {
      setFormError('Lỗi: Số lượng tồn đầu và tồn tối thiểu không được là số âm.');
      return;
    }

    // Tạo đối tượng sản phẩm mới chuẩn hóa
    const newProduct: SanPham = {
      SKU: currentFormSKU,
      TEN_SAN_PHAM: currentFormProductName,
      THUONG_HIEU: formBrand,
      CHIET_XUAT: formChietXuat,
      TINH_NANG: formTinhNang,
      CAN: formDoSph,
      LOAN: formDoCyl,
      DVT: formDvt,
      TON_DAU: formTonDau,
      NHAP: 0,
      XUAT: 0,
      TON_CUOI: formTonDau, // Khi tạo mới thì tồn cuối = tồn đầu
      TON_TOI_THIEU: formTonToiThieu
    };

    onAddProduct(newProduct);
    
    // Đóng Modal và Reset trạng thái Form cơ bản
    setShowAddModal(false);
    setFormTonDau(10);
    setFormTonToiThieu(5);
    setFormError('');
  };

  return (
    <div className="space-y-6">
      
      {currentUser.WRITE_ACCESS === false && (
        <div className="p-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl text-xs flex items-center gap-3 shadow-2xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
          <span className="font-semibold">
            Tài khoản của bạn <strong>({currentUser.fullName} - {currentUser.role})</strong> được phân quyền <strong>Chỉ Xem</strong>. Chức năng khởi tạo, chỉnh sửa sản phẩm tròng kính đã bị khóa.
          </span>
        </div>
      )}

      {/* 1. THANH TÁC VỤ: TÌM KIẾM, BỘ LỌC, THÊM MỚI */}
      <div className="bento-card !p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Tìm kiếm */}
        <div className="relative w-full sm:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input 
            type="text"
            placeholder="Tìm kiếm SKU hoặc tên tròng kính..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-100 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 text-slate-700 font-medium"
          />
        </div>

        {/* Bộ lọc & Nút Thêm mới */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          
          {/* Lọc thương hiệu */}
          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-100 text-slate-600 font-semibold py-2 px-3 rounded-xl focus:outline-hidden"
          >
            <option value="Tất cả">Mọi thương hiệu</option>
            {thuongHieus.map(b => (
              <option key={b.THUONG_HIEU} value={b.THUONG_HIEU}>{b.THUONG_HIEU}</option>
            ))}
          </select>

          {/* Lọc trạng thái tồn */}
          <select
            value={filterStockStatus}
            onChange={(e) => setFilterStockStatus(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-100 text-slate-600 font-semibold py-2 px-3 rounded-xl focus:outline-hidden"
          >
            <option value="Tất cả">Mọi trạng thái kho</option>
            <option value="Còn nhiều hàng">Còn nhiều hàng (Xanh lá) 🟢</option>
            <option value="Tồn kho an toàn">Tồn kho an toàn (Xanh dương) 🔵</option>
            <option value="Hàng còn ít">Hàng còn ít (Vàng) 🟡</option>
            <option value="Sắp hết hàng">Sắp hết hàng (Cam) 🟠</option>
            <option value="Hết hàng">Hết hàng (Đỏ) 🔴</option>
          </select>

          {/* Nút thêm mới - Chỉ hiện nếu có quyền ghi */}
          {currentUser.WRITE_ACCESS !== false && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition-all shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tạo Tròng Kính
            </button>
          )}
        </div>
      </div>

      {/* 2. HIỂN THỊ DANH SÁCH SẢN PHẨM (B_SANPHAM) */}
      <div className="bento-card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100">
                <th onClick={() => handleSort('SKU')} className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono cursor-pointer hover:bg-slate-100 select-none">
                  Mã SKU {sortField === 'SKU' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                </th>
                <th onClick={() => handleSort('TEN_SAN_PHAM')} className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none">
                  Tên Tròng Kính {sortField === 'TEN_SAN_PHAM' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                </th>
                <th onClick={() => handleSort('CAN')} className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none">
                  Độ Cận (SPH) {sortField === 'CAN' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                </th>
                <th onClick={() => handleSort('LOAN')} className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none">
                  Độ Loạn (CYL) {sortField === 'LOAN' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                </th>
                <th onClick={() => handleSort('TON_DAU')} className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100 select-none">
                  Tồn Đầu {sortField === 'TON_DAU' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                </th>
                <th className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center select-none">
                  Nhập / Xuất
                </th>
                <th onClick={() => handleSort('TON_CUOI')} className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100 select-none">
                  Tồn Cuối {sortField === 'TON_CUOI' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                </th>
                <th onClick={() => handleSort('TON_TOI_THIEU')} className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100 select-none">
                  Tồn tối thiểu {sortField === 'TON_TOI_THIEU' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                </th>
                <th onClick={() => handleSort('TRANG_THAI')} className="py-3.5 px-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center cursor-pointer hover:bg-slate-100 select-none">
                  Trạng Thái {sortField === 'TRANG_THAI' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedProducts.length > 0 ? (
                paginatedProducts.map((p) => {
                  const status = getStockStatus(p.TON_CUOI, p.TON_TOI_THIEU);
                  const isRedText = p.TON_CUOI <= 0 || p.TON_CUOI < p.TON_TOI_THIEU;
                  return (
                    <tr key={p.SKU} className="hover:bg-slate-50/50 transition-colors duration-150">
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-bold font-mono text-slate-700 bg-slate-100 py-1 px-2.5 rounded-md">
                          {p.SKU}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-slate-800">{p.TEN_SAN_PHAM}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-medium bg-slate-50 py-0.5 px-1.5 border border-slate-100 rounded-sm">
                              {p.THUONG_HIEU}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium bg-slate-50 py-0.5 px-1.5 border border-slate-100 rounded-sm">
                              Chiết suất: {p.CHIET_XUAT}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-xs font-semibold font-mono ${p.CAN < 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                          {formatDop(p.CAN)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-semibold font-mono text-purple-600">
                          {formatDop(p.LOAN)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-xs font-medium text-slate-500 font-mono">
                          {p.TON_DAU}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium">
                          <span className="text-emerald-600">+{p.NHAP}</span>
                          <span className="text-slate-300">/</span>
                          <span className="text-rose-600">-{p.XUAT}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-xs font-bold font-mono ${isRedText ? 'text-red-600 font-extrabold' : 'text-slate-800'}`}>
                          {p.TON_CUOI} {p.DVT}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {currentUser.WRITE_ACCESS !== false && onUpdateMinStock ? (
                          <input
                            type="number"
                            min={0}
                            value={p.TON_TOI_THIEU}
                            onChange={(e) => onUpdateMinStock(p.SKU, Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-16 px-2 py-1 text-xs text-center border border-slate-200 hover:border-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/15 rounded-lg font-mono bg-slate-50/50 hover:bg-white focus:bg-white transition-all outline-hidden font-bold text-slate-700"
                          />
                        ) : (
                          <span className="text-xs font-semibold font-mono text-slate-600">
                            {p.TON_TOI_THIEU}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold py-1 px-2.5 rounded-full ${status.colorClass}`}>
                          {status.level === 5 && <ShieldAlert className="w-4 h-4 text-red-600 animate-pulse" />}
                          {status.level === 4 && <AlertCircle className="w-3.5 h-3.5 text-orange-500" />}
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-slate-400 font-mono">
                    Không tìm thấy tròng kính mắt nào khớp với tiêu chuẩn tìm kiếm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* THANH PHÂN TRANG TỐI ƯU HÓA TRÁNH LAG */}
        {totalPages > 1 && (
          <div className="bg-slate-50/75 border-t border-slate-100 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-slate-500 font-medium">
              Hiển thị <span className="font-semibold text-slate-700">{Math.min(filteredProducts.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredProducts.length, currentPage * itemsPerPage)}</span> trong tổng số <span className="font-bold text-slate-700">{filteredProducts.length}</span> tròng kính
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="px-2 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white cursor-pointer"
              >
                Đầu
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white cursor-pointer"
              >
                Trước
              </button>
              
              {/* Hiển thị số trang */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = 1;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg cursor-pointer ${
                      currentPage === pageNum 
                        ? 'bg-red-600 text-white' 
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white cursor-pointer"
              >
                Sau
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2 py-1 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white cursor-pointer"
              >
                Cuối
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. MODAL FORM: TẠO TRÒNG KÍNH MỚI (ANIMATE) */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              
              {/* Header Modal */}
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-sans font-bold text-slate-800 text-sm">Khai Báo SKU Tròng Kính Mới</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Hệ thống tự động sinh mã SKU theo chuẩn quang học</p>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-semibold cursor-pointer text-xs"
                >
                  Đóng
                </button>
              </div>

              {/* Form Nội dung */}
              <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-4">
                
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* Thương hiệu */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Thương Hiệu</label>
                    <select
                      value={formBrand}
                      onChange={(e) => handleBrandChange(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5"
                    >
                      {thuongHieus.map(b => (
                        <option key={b.THUONG_HIEU} value={b.THUONG_HIEU}>{b.THUONG_HIEU}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tính năng (Dropdown theo thương hiệu) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      Tính Năng
                    </label>
                    <select
                      value={formTinhNang}
                      onChange={(e) => setFormTinhNang(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 focus:outline-hidden font-mono"
                    >
                      {availableFeatures.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Chiết suất (Tự động hoặc Dropdown tùy loại thương hiệu) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Chiết Suất</label>
                    {['Blick', 'Zeiss Clear', 'Zeiss Blue', 'Essilor Pre', 'Essilor Rock'].includes(formBrand) ? (
                      <input
                        type="text"
                        value={formChietXuat}
                        disabled
                        className="w-full text-xs font-bold text-slate-500 bg-slate-100 border border-slate-100 rounded-lg p-2.5"
                      />
                    ) : (
                      <select
                        value={formChietXuat}
                        onChange={(e) => setFormChietXuat(e.target.value)}
                        className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 animate-pulse"
                      >
                        <option value="1.56">1.56</option>
                        <option value="1.61">1.61</option>
                        <option value="1.67">1.67</option>
                        <option value="1.74">1.74</option>
                      </select>
                    )}
                  </div>

                  {/* Loại độ */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Loại Độ</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormDoSphType('CẬN')}
                        className={`py-2 px-3 text-xs font-bold rounded-lg cursor-pointer ${
                          formDoSphType === 'CẬN' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-slate-50 text-slate-400 border border-slate-100'
                        }`}
                      >
                        Cận Thị
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormDoSphType('VIỄN')}
                        className={`py-2 px-3 text-xs font-bold rounded-lg cursor-pointer ${
                          formDoSphType === 'VIỄN' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-slate-50 text-slate-400 border border-slate-100'
                        }`}
                      >
                        Viễn Thị
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Độ cầu (SPH) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Độ Cầu SPH (Bước nhảy 0.25)</label>
                    <select
                      value={formDoSph}
                      onChange={(e) => setFormDoSph(Number(e.target.value))}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-mono"
                    >
                      {sphOptions.map(sph => (
                        <option key={sph} value={sph}>{formatDop(sph)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Độ loạn (CYL) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Độ Loạn CYL (Bước nhảy 0.25)</label>
                    <select
                      value={formDoCyl}
                      onChange={(e) => setFormDoCyl(Number(e.target.value))}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-mono"
                    >
                      {cylOptions.map(cyl => (
                        <option key={cyl} value={cyl}>{formatDop(cyl)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Tồn kho đầu kì */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Tồn Đầu Kì</label>
                    <input
                      type="number"
                      min={0}
                      value={formTonDau}
                      onChange={(e) => setFormTonDau(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-mono"
                    />
                  </div>

                  {/* Tồn tối thiểu */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Tối Thiểu Cảnh Báo</label>
                    <input
                      type="number"
                      min={0}
                      value={formTonToiThieu}
                      onChange={(e) => setFormTonToiThieu(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-mono"
                    />
                  </div>

                  {/* ĐVT */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Đơn Vị Tính</label>
                    <input
                      type="text"
                      value="miếng"
                      disabled
                      className="w-full text-xs font-bold text-slate-500 bg-slate-100 border border-slate-100 rounded-lg p-2.5"
                    />
                  </div>
                </div>

                {/* Kết quả SKU và Tên Tự Động */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400">SKU Tự Sinh:</span>
                    <span className="text-xs font-bold font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      {currentFormSKU}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Tên Sản Phẩm Tự Sinh:</span>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed">
                      {currentFormProductName}
                    </p>
                  </div>
                </div>

              </form>

              {/* Footer Modal */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleSaveProduct}
                  className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  Xác nhận & Lưu <ArrowRight className="w-4.5 h-4.5" />
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
