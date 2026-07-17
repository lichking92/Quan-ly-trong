import { supabase } from '../supabaseClient';
import { ensureStorageBucketExists } from '../supabaseSync';

/**
 * Tải file mẫu lên Supabase Storage bucket 'user_luutru'
 * @param file Đối tượng File, Blob hoặc ArrayBuffer cần tải lên
 * @param path Đường dẫn lưu trữ (ví dụ: 'user_id/template_id' hoặc tên file)
 * @param mimeType Định dạng của file (ví dụ: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
 */
export async function uploadTemplate(
  file: File | Blob | ArrayBuffer,
  path: string,
  mimeType?: string
) {
  try {
    // Đảm bảo bucket tồn tại và có các policy công khai
    await ensureStorageBucketExists();

    // Chuyển đổi ArrayBuffer thành Blob nếu cần thiết
    let body: Blob | File = file as any;
    if (file instanceof ArrayBuffer) {
      body = new Blob([file], { type: mimeType || 'application/octet-stream' });
    }

    const { data, error } = await supabase.storage
      .from('user_luutru')
      .upload(path, body, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      throw error;
    }

    console.log(`[Storage Service] Upload thành công file lên bucket 'user_luutru' tại đường dẫn: ${path}`);
    return { data, error: null };
  } catch (error: any) {
    console.warn('[Storage Service] Lỗi khi upload template lên user_luutru:', error);
    return { data: null, error };
  }
}

/**
 * Lấy URL công khai để tải về hoặc xem trực tuyến file mẫu từ bucket 'user_luutru'
 * @param path Đường dẫn của file trong bucket hoặc dạng 'STORAGE_PATH:user_luutru/path'
 */
export function getTemplateUrl(path: string): string {
  if (!path) return '';
  
  // Nếu path chứa định dạng STORAGE_PATH:user_luutru/...
  let cleanPath = path;
  if (path.startsWith('STORAGE_PATH:')) {
    cleanPath = path.substring('STORAGE_PATH:user_luutru/'.length);
  }

  // Trả về public URL từ Supabase Storage cho bucket 'user_luutru'
  const { data } = supabase.storage
    .from('user_luutru')
    .getPublicUrl(cleanPath);

  return data?.publicUrl || '';
}
