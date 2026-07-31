/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Check, Package, Sparkles } from 'lucide-react';
import { SanPham } from '../types';
import { formatSKUForDisplay } from '../data/mockData';

export interface SkuAutocompleteSearchProps {
  sanPhams: SanPham[];
  value: string; // SKU đã chọn
  onChange: (sku: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const SkuAutocompleteSearch: React.FC<SkuAutocompleteSearchProps> = ({
  sanPhams,
  value,
  onChange,
  placeholder = 'Tìm theo SKU, Thương hiệu (HEN), Chiết suất (1.56), Độ cận (-2.00)...',
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tìm sản phẩm đã chọn hiện tại từ sanPhams cache RAM
  const selectedProduct = useMemo(() => {
    if (!value || !sanPhams) return null;
    return sanPhams.find(p => p.SKU === value) || null;
  }, [value, sanPhams]);

  // Đóng dropdown khi click ra ngoài component
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  // Khi mở dropdown thì tự động focus vào ô tìm kiếm
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Hàm kiểm tra 1 sản phẩm có khớp với token tìm kiếm không
  const matchToken = (p: SanPham, token: string): boolean => {
    const t = token.toLowerCase();
    if ((p.SKU || '').toLowerCase().includes(t)) return true;
    if ((p.TEN_SAN_PHAM || '').toLowerCase().includes(t)) return true;
    if ((p.THUONG_HIEU || '').toLowerCase().includes(t)) return true;
    if ((p.CHIET_XUAT || '').toLowerCase().includes(t)) return true;
    if ((p.TINH_NANG || '').toLowerCase().includes(t)) return true;
    if (p.CAN !== undefined && p.CAN !== null) {
      if (String(p.CAN).includes(t) || Number(p.CAN).toFixed(2).includes(t)) return true;
    }
    if (p.LOAN !== undefined && p.LOAN !== null) {
      if (String(p.LOAN).includes(t) || Number(p.LOAN).toFixed(2).includes(t)) return true;
    }
    return false;
  };

  // Tìm kiếm thông minh trong RAM (không query Supabase liên tục)
  const filteredProducts = useMemo(() => {
    if (!sanPhams || sanPhams.length === 0) return [];
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

    // Nếu chưa gõ từ khóa, hiển thị 50 SKU đầu tiên
    if (tokens.length === 0) {
      return sanPhams.slice(0, 50);
    }

    const results: SanPham[] = [];
    for (let i = 0; i < sanPhams.length; i++) {
      const p = sanPhams[i];
      let allMatch = true;
      for (let j = 0; j < tokens.length; j++) {
        if (!matchToken(p, tokens[j])) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        results.push(p);
        // Giới hạn 100 kết quả để giao diện mượt mà 60fps trên mobile
        if (results.length >= 100) break;
      }
    }
    return results;
  }, [sanPhams, query]);

  // Reset highlight khi danh sách kết quả thay đổi
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredProducts]);

  // Thao tác phím mũi tên và Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, Math.max(0, filteredProducts.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredProducts[highlightedIndex];
      if (target) {
        handleSelectSku(target.SKU);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelectSku = (sku: string) => {
    onChange(sku);
    setIsOpen(false);
    setQuery('');
  };

  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* TRẠNG THÁI ĐÃ CHỌN SKU & DROPDOWN ĐANG ĐÓNG */}
      {value && !isOpen ? (
        <div
          onClick={() => !disabled && setIsOpen(true)}
          className={`w-full bg-white border-2 border-blue-500 hover:border-blue-600 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs transition-all ${
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          }`}
          title="Nhấp để tìm và thay đổi SKU tròng kính khác"
        >
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold font-mono text-xs sm:text-sm text-slate-900 truncate">
                {formatSKUForDisplay(selectedProduct?.SKU || value)}
              </span>
            </div>
            {selectedProduct ? (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                {selectedProduct.THUONG_HIEU && (
                  <span className="font-semibold text-slate-700">{selectedProduct.THUONG_HIEU}</span>
                )}
                {selectedProduct.THUONG_HIEU && selectedProduct.TINH_NANG && (
                  <span className="text-slate-300">|</span>
                )}
                {selectedProduct.TINH_NANG && (
                  <span>{selectedProduct.TINH_NANG}</span>
                )}
                {selectedProduct.CHIET_XUAT && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span>CX: {selectedProduct.CHIET_XUAT}</span>
                  </>
                )}
                <span className="text-slate-300">|</span>
                <span
                  className={`font-bold ${
                    selectedProduct.TON_CUOI > 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  Tồn kho: {selectedProduct.TON_CUOI} {selectedProduct.DVT || 'Cái'}
                </span>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 mt-0.5">
                SKU: {value}
              </div>
            )}
          </div>

          {!disabled && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-rose-600 transition-colors shrink-0 cursor-pointer"
              title="Xóa lựa chọn SKU"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        /* TRẠNG THÁI Ô TÌM KIẾM TẠI CHỖ (Ô TÌM KIẾM NẰM TRÊN CÙNG) */
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              disabled={disabled}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full text-xs sm:text-sm font-semibold text-slate-800 bg-white border-2 border-blue-400 rounded-xl pl-9 pr-9 py-2.5 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-xs transition-all"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                title="Xóa từ khóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : value ? (
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer text-[10px] font-bold"
                title="Đóng tìm kiếm"
              >
                Đóng
              </button>
            ) : null}
          </div>

          {/* Hướng dẫn từ khóa nhanh trên mobile & desktop */}
          <div className="flex items-center gap-1.5 mt-1 px-1 overflow-x-auto text-[10px] text-slate-400 no-scrollbar">
            <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="shrink-0">Gõ nhanh:</span>
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">HEN 1.56</span>
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">-2.00 -1.25</span>
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">BLICK</span>
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">ASX</span>
          </div>

          {/* DANH SÁCH AUTOCOMPLETE LỌC THEO THỜI GIAN THỰC */}
          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100">
              {filteredProducts.length > 0 ? (
                <>
                  {filteredProducts.map((p, index) => {
                    const isSelected = p.SKU === value;
                    const isHighlighted = index === highlightedIndex;
                    return (
                      <button
                        type="button"
                        key={`${p.SKU}-${index}`}
                        onClick={() => handleSelectSku(p.SKU)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`w-full text-left px-3.5 py-2.5 transition-colors flex flex-col gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/90 hover:bg-blue-100'
                            : isHighlighted
                            ? 'bg-slate-50 hover:bg-blue-50/60'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Hàng 1: SKU đầy đủ */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                            <span className="font-bold font-mono text-xs sm:text-sm text-slate-900 break-all">
                              {formatSKUForDisplay(p.SKU)}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              p.TON_CUOI > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            Tồn: {p.TON_CUOI}
                          </span>
                        </div>

                        {/* Hàng 2: Thương hiệu | Tính năng | Tồn kho */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          {p.THUONG_HIEU && (
                            <span className="font-semibold text-slate-700">{p.THUONG_HIEU}</span>
                          )}
                          {p.THUONG_HIEU && p.TINH_NANG && (
                            <span className="text-slate-300">|</span>
                          )}
                          {p.TINH_NANG && <span>{p.TINH_NANG}</span>}
                          {p.CHIET_XUAT && (
                            <>
                              <span className="text-slate-300">|</span>
                              <span>CX: {p.CHIET_XUAT}</span>
                            </>
                          )}
                          {(p.CAN !== undefined || p.LOAN !== undefined) && (
                            <>
                              <span className="text-slate-300">|</span>
                              <span className="font-mono text-slate-600">
                                SPH {Number(p.CAN || 0).toFixed(2)} / CYL {Number(p.LOAN || 0).toFixed(2)}
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  {/* Footer thông báo số lượng hiển thị */}
                  <div className="px-3.5 py-2 bg-slate-50 text-[10px] font-semibold text-slate-400 text-center sticky bottom-0 border-t border-slate-100">
                    {query ? (
                      <span>
                        Hiển thị {filteredProducts.length} SKU khớp với từ khóa "{query}"
                      </span>
                    ) : (
                      <span>
                        Hiển thị 50 SKU đầu tiên / {sanPhams.length} trong kho. Hãy gõ từ khóa để lọc nhanh...
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-6 text-center space-y-2">
                  <Package className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    Không tìm thấy SKU nào phù hợp
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Không có tròng kính nào khớp với "{query}". Thử tìm theo Thương hiệu (HEN, BLICK), Chiết suất (1.56) hoặc Độ cận (-2.00)...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
