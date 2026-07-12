/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Boxes, 
  ClipboardCheck, 
  History, 
  FolderTree, 
  UserCheck,
  Shield,
  Info,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { motion } from 'motion/react';

interface HomeProps {
  currentUser: any;
  setActiveTab: (tab: string) => void;
  lowStockCount: number;
}

export default function Home({ currentUser, setActiveTab, lowStockCount }: HomeProps) {
  // Định nghĩa danh sách các module chức năng dưới dạng card
  const modules = [
    {
      id: 'PRODUCT',
      title: 'Sản Phẩm',
      description: 'Quản lý danh mục tròng kính, cập nhật thông tin và điều chỉnh trực tiếp tồn tối thiểu.',
      icon: Boxes,
      color: 'from-amber-500 to-orange-600',
      textColor: 'text-amber-500',
      bgColor: 'bg-amber-50/70',
      borderColor: 'border-amber-100',
      roleAllowed: ['ADMIN', 'KHO', 'NHAN_VIEN']
    },
    {
      id: 'TRANSACTION_NHAP',
      title: 'Nhập Kho',
      description: 'Lập phiếu nhập kho nhanh, cập nhật tồn kho tự động theo bước nhảy quang học chuẩn.',
      icon: TrendingUp,
      color: 'from-emerald-500 to-teal-600',
      textColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50/70',
      borderColor: 'border-emerald-100',
      roleAllowed: ['ADMIN', 'KHO', 'NHAN_VIEN']
    },
    {
      id: 'TRANSACTION_XUAT',
      title: 'Xuất Kho',
      description: 'Lập phiếu xuất kho cho khách lẻ hoặc chi nhánh, cảnh báo tồn kho và tự động rollback.',
      icon: TrendingDown,
      color: 'from-rose-500 to-red-600',
      textColor: 'text-rose-500',
      bgColor: 'bg-rose-50/70',
      borderColor: 'border-rose-100',
      roleAllowed: ['ADMIN', 'KHO', 'NHAN_VIEN']
    },
    {
      id: 'AUDIT',
      title: 'Kiểm Kê Kho',
      description: 'Kiểm kê kho định kỳ, tự động tính chênh lệch lệch tồn thực tế và tạo phiếu bù trừ.',
      icon: ClipboardCheck,
      color: 'from-violet-500 to-purple-600',
      textColor: 'text-violet-500',
      bgColor: 'bg-violet-50/70',
      borderColor: 'border-violet-100',
      roleAllowed: ['ADMIN', 'KHO']
    },
    {
      id: 'DASHBOARD',
      title: 'Dashboard',
      description: 'Biểu đồ trực quan hóa dữ liệu xuất nhập, phân tích dữ liệu lọc và thống kê tổng quan.',
      icon: TrendingUp,
      color: 'from-blue-500 to-sky-600',
      textColor: 'text-blue-500',
      bgColor: 'bg-blue-50/70',
      borderColor: 'border-blue-100',
      roleAllowed: ['ADMIN', 'KHO']
    },
    {
      id: 'USER_MGMT',
      title: 'Quản Lý Người Dùng',
      description: 'Quản lý tài khoản nhân viên, cấp phát thông tin tài khoản mật khẩu và phân quyền hệ thống.',
      icon: UserCheck,
      color: 'from-pink-500 to-rose-600',
      textColor: 'text-pink-500',
      bgColor: 'bg-pink-50/70',
      borderColor: 'border-pink-100',
      roleAllowed: ['ADMIN']
    },
    {
      id: 'CATEGORY',
      title: 'Cài Đặt',
      description: 'Quản lý danh mục thương hiệu tròng kính, các chi nhánh cửa hàng và kho hàng.',
      icon: FolderTree,
      color: 'from-indigo-500 to-blue-600',
      textColor: 'text-indigo-500',
      bgColor: 'bg-indigo-50/70',
      borderColor: 'border-indigo-100',
      roleAllowed: ['ADMIN']
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* BANNER CHÀO MỪNG HIỆN ĐẠI */}
      <div className="relative overflow-hidden bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-72 h-72 bg-gradient-to-br from-red-600/20 to-blue-600/0 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-80 h-80 bg-gradient-to-tr from-blue-600/10 to-red-600/0 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600/25 border border-red-500/20 rounded-full text-[10px] font-bold text-red-400 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-red-500" /> Nhịp đập hệ thống ổn định
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight font-sans">
              Xin chào, <span className="text-red-500">{currentUser.fullName}</span>!
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-xl leading-relaxed">
              Chào mừng bạn trở lại hệ thống quản trị <strong className="text-white">Glass Stock Pro</strong>. 
              Hãy chọn một module tác vụ nhanh bên dưới để bắt đầu quản lý hoặc kiểm kê tròng kính mắt.
            </p>
          </div>

          {/* CHỈ BÁO THÔNG SỐ NHANH */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="px-4 py-3 bg-slate-800/60 rounded-2xl border border-slate-700/50 flex flex-col items-center justify-center min-w-[110px]">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Vai trò</span>
              <span className="text-xs font-extrabold text-blue-400 mt-0.5">
                {currentUser.role === 'ADMIN' ? 'Chủ cửa hàng' : currentUser.role === 'KHO' ? 'Thủ kho' : 'Bán hàng'}
              </span>
            </div>
            <div className="px-4 py-3 bg-slate-800/60 rounded-2xl border border-slate-700/50 flex flex-col items-center justify-center min-w-[110px]">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Chi nhánh</span>
              <span className="text-xs font-extrabold text-white mt-0.5 truncate max-w-[100px]" title={currentUser.branch}>
                {currentUser.branch}
              </span>
            </div>
            {lowStockCount > 0 && (
              <div className="px-4 py-3 bg-red-950/40 rounded-2xl border border-red-500/20 flex flex-col items-center justify-center min-w-[110px] animate-pulse">
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wide">Sắp hết hàng</span>
                <span className="text-xs font-extrabold text-red-500 mt-0.5">
                  {lowStockCount} dòng kính
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DANH SÁCH MODULES DẠNG BENTO CARDS */}
      <div>
        <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-4">Các chức năng chính</h3>
        
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {modules.map((m) => {
            const IconComponent = m.icon;
            const isAllowed = m.roleAllowed.includes(currentUser.role);
            
            return (
              <motion.div
                key={m.id}
                variants={itemVariants}
                whileHover={isAllowed ? { y: -4, scale: 1.01 } : {}}
                onClick={() => {
                  if (isAllowed) {
                    setActiveTab(m.id);
                  }
                }}
                className={`group relative bento-card flex flex-col justify-between cursor-pointer overflow-hidden p-5 border transition-all ${
                  isAllowed 
                    ? 'hover:border-slate-300' 
                    : 'opacity-60 cursor-not-allowed bg-slate-50/50 border-slate-100'
                }`}
              >
                {/* Background Accent on Hover */}
                {isAllowed && (
                  <div className={`absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r ${m.color}`} />
                )}

                <div className="space-y-4">
                  {/* Icon & Status */}
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-xl ${m.bgColor} ${m.textColor} ${isAllowed ? 'group-hover:scale-110 transition-transform duration-200' : ''}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    
                    {isAllowed ? (
                      <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 flex items-center gap-0.5">
                        Truy cập <ChevronRight className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-slate-100 text-slate-400 py-0.5 px-2 rounded-full border border-slate-200">
                        <Shield className="w-2.5 h-2.5" /> Bị khóa
                      </span>
                    )}
                  </div>

                  {/* Title & Info */}
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                      {m.title}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      {m.description}
                    </p>
                  </div>
                </div>

                {/* Phân quyền indicator */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold">Phân quyền:</span>
                  <span className="font-mono bg-slate-100 text-slate-500 py-0.5 px-1.5 rounded-sm uppercase tracking-wide font-bold">
                    {m.roleAllowed.join(', ')}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* PHẦN FOOTER HOẶC TIP NHANH */}
      <div className="p-4 bg-blue-50/50 border border-blue-100/60 rounded-2xl flex items-start gap-3.5 shadow-2xs">
        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl shrink-0 mt-0.5">
          <Info className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <h5 className="text-xs font-bold text-blue-800">Mẹo quản trị thông minh:</h5>
          <p className="text-xs text-blue-700/90 leading-relaxed font-medium">
            Tại mục <strong className="text-blue-900 font-bold">"Sản phẩm"</strong>, bạn có thể bấm trực tiếp vào tiêu đề các cột như Mã SKU, Tên, Độ cầu SPH,... để sắp xếp nhanh, đồng thời trực tiếp chỉnh sửa ô <strong className="text-blue-900 font-bold">"Tồn tối thiểu"</strong> ngay trên bảng mà không cần phải mở hộp thoại chỉnh sửa phức tạp.
          </p>
        </div>
      </div>

    </div>
  );
}
