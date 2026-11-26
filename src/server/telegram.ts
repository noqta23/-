import fs from 'fs';
import crypto from 'crypto';
import type { Response } from 'express';
import { OWNER_ID, dbLoadDoc, formatSize, getFileType } from './db.ts';
import {
  getFile,
  getAllFiles,
  getFilesInFolder,
  createFileRecord,
  updateFile,
  incrementDownloads,
  authenticateTelegramLoginOnly,
  linkTelegramAccount,
  registerOrUpdateUser,
  updateUserSettings,
  verifyTelegramPhoneContact,
  cancelAccountDeletion,
} from './managers.ts';

export function getBotToken(): string {
  return (process.env.TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
}

export async function sendVerificationCodeMessage(
  email: string,
  telegramId: string,
  code: string
): Promise<{ sent: boolean; channel: 'email' | 'telegram_bot' | 'google_or_smtp_required' }> {
  const cleanEmail = String(email || '').trim();
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  if (cleanEmail && resendKey) {
    try {
      const fromAddr = (process.env.EMAIL_FROM || 'Nukhaa Platform <onboarding@resend.dev>').trim();
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [cleanEmail],
          subject: 'رمز تأكيد بريدك الإلكتروني في منصة صفر (01)',
          html: `<div dir="rtl" style="font-family:sans-serif;padding:20px;background:#f8fafc;border-radius:12px;">
            <h2 style="color:#1e293b;">منصة صفر (01)</h2>
            <p>رمز تأكيد البريد الإلكتروني الفعلي الخاص بحسابك هو:</p>
            <div style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#0284c7;padding:12px 20px;background:#e0f2fe;border-radius:8px;display:inline-block;">${code}</div>
          </div>`,
        }),
      });
      if (r.ok) return { sent: true, channel: 'email' };
    } catch {
      // fall through
    }
  }

  // Deliver the 6-digit verification code via the Telegram Bot when Resend/SMTP is not configured
  const token = getBotToken();
  const tgId = String(telegramId || '').trim();
  if (token && tgId && /^\d{5,}$/.test(tgId)) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgId,
          parse_mode: 'HTML',
          text:
            `📧 <b>تأكيد البريد الإلكتروني — منصة صفر (01)</b>\n\n` +
            `البريد المطلوب تأكيده: <code>${cleanEmail}</code>\n` +
            `رمز التأكيد المكون من 6 أرقام هو:\n\n` +
            `<code>${code}</code>\n\n` +
            `أدخل هذا الرمز في حقل تأكيد البريد داخل المنصة لإتمام التوثيق.`,
        }),
      });
      const data = (await r.json().catch(() => ({}))) as any;
      if (r.ok && data?.ok) {
        return { sent: true, channel: 'telegram_bot' };
      }
    } catch {
      // fall through
    }
  }

  return { sent: false, channel: 'google_or_smtp_required' };
}

export async function sendTelegramPhoneVerificationRequest(
  telegramId: string
): Promise<{ ok: boolean; bot_username?: string; error?: string }> {
  const token = getBotToken();
  const tgId = String(telegramId || '').trim();
  if (!token) {
    return { ok: false, error: 'رمز بوت تلگرام غير مضاف في الخادم' };
  }
  if (!tgId || !/^\d{5,}$/.test(tgId)) {
    return { ok: false, error: 'يرجى ربط حسابك بتلگرام أولاً لتأكيد رقم الهاتف الحقيقي عبر تلگرام' };
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tgId,
        text: '📱 <b>تأكيد رقم الهاتف الحقيقي في حسابك (01)</b>\n\nاضغط على الزر أدناه لمشاركة رقم هاتفك المرتبط بحسابك في تلگرام ليتم تأكيده ومزامنته رسمياً في المنصة، أو اضغط على زر الإلغاء لإخفاء لوحة المفاتيح:',
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [
            [
              {
                text: '📱 مشاركة رقم هاتفي لتأكيد الحساب',
                request_contact: true,
              },
            ],
            [
              {
                text: '❌ إلغاء مشاركة الرقم',
              },
            ],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }),
    });
    const d = (await r.json()) as any;
    const botUsername = (process.env.BOT_USERNAME || '').trim().replace(/^@/, '');
    if (d?.ok) {
      return { ok: true, bot_username: botUsername };
    }
    return {
      ok: false,
      bot_username: botUsername,
      error: d?.description || 'تعذر إرسال طلب التأكيد إلى محادثة البوت، تأكد من مراسلة البوت أولاً.',
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'خطأ في الاتصال بتلگرام' };
  }
}

export async function sendAccountDeletionScheduledTelegram(
  telegramId: string,
  userId: string,
  platformId: string,
  formattedDate: string
): Promise<{ ok: boolean }> {
  const token = getBotToken();
  const tgId = String(telegramId || '').trim();
  if (!token || !tgId || !/^\d{5,}$/.test(tgId)) return { ok: false };
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tgId,
        text: `⚠️ <b>تنبيه جدولة حذف الحساب — منصة (01)</b>\n\nتمت جدولة حذف حسابك (<code>${platformId}</code>) نهائياً بعد 30 يوماً بتاريخ:\n📅 <b>${formattedDate}</b>\n\nيمكنك التراجع وإلغاء الحذف في أي وقت خلال هذه المهلة من إعدادات الحساب في المنصة أو بالضغط على الزر أدناه مباشرة:`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '↩️ إلغاء حذف الحساب واستعادته فوراً',
                callback_data: `cancel_acc_del:${userId}`,
              },
            ],
          ],
        },
      }),
    });
    const d = (await r.json()) as any;
    return { ok: Boolean(d?.ok) };
  } catch {
    return { ok: false };
  }
}

const filePathCache = new Map<string, { path: string; expires: number }>();
const userPhotoFileIdCache = new Map<string, { fileId: string; expires: number }>();
const pendingBotFiles: Array<Record<string, any>> = [];
const telegramAuthSessions = new Map<
  string,
  {
    token: string;
    accountId: string;
    status: 'pending' | 'completed' | 'failed';
    user?: Record<string, any>;
    error?: string;
    createdAt: number;
  }
>();

export function createTelegramAuthSession(accountId = ''): string {
  const token = crypto.randomBytes(12).toString('hex');
  telegramAuthSessions.set(token, {
    token,
    accountId: String(accountId || '').trim(),
    status: 'pending',
    createdAt: Date.now(),
  });
  return token;
}

export function getTelegramAuthSession(token: string) {
  const s = telegramAuthSessions.get(String(token || '').trim());
  if (!s) return null;
  if (Date.now() - s.createdAt > 15 * 60 * 1000) {
    telegramAuthSessions.delete(s.token);
    return null;
  }
  return s;
}

export function getTelegramClientId(): string {
  const explicit = (process.env.TELEGRAM_CLIENT_ID || '').trim();
  if (explicit) return explicit;
  const token = getBotToken();
  return token.includes(':') ? token.split(':')[0].trim() : '';
}

export function extractTelegramAuthUser(rawPayload: Record<string, any>): Record<string, any> | null {
  if (!rawPayload || typeof rawPayload !== 'object') return null;
  const candidate = rawPayload.tg_user || rawPayload;

  // 1. New Telegram OIDC library (https://oauth.telegram.org/js/telegram-login.js?6)
  // Returns { id_token: "eyJ...", user: { id, first_name, last_name, username, photo_url, phone_number } }
  if (candidate.user && typeof candidate.user === 'object' && (candidate.user.id || candidate.user.sub)) {
    const u = candidate.user;
    return {
      id: String(u.id || u.sub).trim(),
      first_name: String(u.first_name || u.name || '').trim(),
      last_name: String(u.last_name || '').trim(),
      username: String(u.username || u.preferred_username || '').trim(),
      photo_url: String(u.photo_url || u.picture || '').trim(),
      phone_number: String(u.phone_number || '').trim(),
      is_oidc: true,
    };
  }

  if (typeof candidate.id_token === 'string' && candidate.id_token.split('.').length === 3) {
    try {
      const payloadJson = Buffer.from(candidate.id_token.split('.')[1], 'base64url').toString('utf8');
      const claims = JSON.parse(payloadJson);
      const subId = String(claims.id || claims.sub || '').trim();
      if (subId) {
        return {
          id: subId,
          first_name: String(claims.first_name || claims.name || '').trim(),
          last_name: String(claims.last_name || '').trim(),
          username: String(claims.username || claims.preferred_username || '').trim(),
          photo_url: String(claims.photo_url || claims.picture || '').trim(),
          phone_number: String(claims.phone_number || '').trim(),
          is_oidc: true,
        };
      }
    } catch {
      // fall through
    }
  }

  // 2. Classic Telegram Login Widget / WebApp user object
  if (candidate.id) {
    return {
      ...candidate,
      id: String(candidate.id).trim(),
      first_name: String(candidate.first_name || '').trim(),
      last_name: String(candidate.last_name || '').trim(),
      username: String(candidate.username || '').trim(),
      photo_url: String(candidate.photo_url || '').trim(),
    };
  }

  return null;
}

export function verifyTelegramWidgetData(authData: Record<string, any>): boolean {
  const token = getBotToken();
  if (!token || !authData || !authData.id) return false;
  if (authData.is_oidc) return true;
  if (!authData.hash) return false;
  const checkHash = String(authData.hash);

  // Standard fields signed by Telegram Widget
  const allowed = ['auth_date', 'first_name', 'id', 'last_name', 'photo_url', 'username'];
  const dataCheckArr: string[] = [];
  for (const k of allowed) {
    const val = authData[k];
    if (val !== undefined && val !== null && String(val) !== '') {
      dataCheckArr.push(`${k}=${val}`);
    }
  }
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join('\n');
  const secretKey = crypto.createHash('sha256').update(token).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (hmac === checkHash) return true;

  // Fallback check against all non-hash non-oidc keys in case Telegram added extra parameters
  const altArr: string[] = [];
  for (const [k, v] of Object.entries(authData)) {
    if (k === 'hash' || k === 'is_oidc' || v === undefined || v === null || String(v) === '') continue;
    altArr.push(`${k}=${v}`);
  }
  altArr.sort();
  const altHmac = crypto.createHmac('sha256', secretKey).update(altArr.join('\n')).digest('hex');
  return altHmac === checkHash;
}

export async function syncLiveTelegramUserData(telegramUserId: string, targetUserId?: string): Promise<Record<string, any> | null> {
  const tgId = String(telegramUserId || '').trim();
  if (!/^\d{5,}$/.test(tgId)) return null;
  const token = getBotToken();
  if (!token) return null;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(tgId)}`, {
      signal: AbortSignal.timeout(3500),
    });
    const data = (await resp.json()) as any;
    if (data?.ok && data?.result) {
      const c = data.result;
      const tgFirst = String(c.first_name || '').trim();
      const tgLast = String(c.last_name || '').trim();
      const tgUser = String(c.username || '').trim().replace(/^@/, '');
      const tgBio = String(c.bio || '').trim();
      const photoFid = c.photo?.big_file_id || c.photo?.small_file_id || '';
      const personalChatTitle = String(c.personal_chat?.title || '').trim();
      const personalChatUsername = String(c.personal_chat?.username || '').trim().replace(/^@/, '');
      const personalChatId = c.personal_chat?.id ? String(c.personal_chat.id) : '';
      const hasEmojiStatus = Boolean(c.emoji_status_custom_emoji_id);
      const accentColorId = typeof c.accent_color_id === 'number' ? c.accent_color_id : undefined;

      const updateData: Record<string, any> = {
        target_telegram_id: tgId,
        tg_first_name: tgFirst,
        tg_last_name: tgLast,
        tg_username: tgUser,
        tg_bio: tgBio,
        tg_personal_chat_title: personalChatTitle,
        tg_personal_chat_username: personalChatUsername,
        tg_personal_chat_id: personalChatId,
      };
      if (hasEmojiStatus) {
        updateData.tg_is_premium = true;
      }
      if (accentColorId !== undefined) {
        updateData.tg_accent_color_id = accentColorId;
      }
      if (c.birthdate && c.birthdate.day && c.birthdate.month) {
        const y = c.birthdate.year ? String(c.birthdate.year).padStart(4, '0') : '2000';
        const m = String(c.birthdate.month).padStart(2, '0');
        const d = String(c.birthdate.day).padStart(2, '0');
        updateData.tg_birth_date = `${y}-${m}-${d}`;
      }
      if (photoFid) {
        updateData.tg_photo_file_id = String(photoFid);
        userPhotoFileIdCache.set(tgId, { fileId: String(photoFid), expires: Date.now() + 5 * 60 * 1000 });
      }
      return updateUserSettings(targetUserId || tgId, updateData);
    }
  } catch {
    // fallback
  }
  return null;
}

const customBioMsgTextCache = new Map<string, string>();

export async function saveCustomBioToTelegramStorage(
  platformId: string,
  bioText: string,
  existingMsgId?: number,
  existingChatId?: string
): Promise<{ message_id: number; chat_id: string; text: string } | null> {
  const token = getBotToken();
  const cleanText = String(bioText || '').trim();
  const isValidTgChatId = (val: string) => /^(?:-?\d{5,}|@[a-zA-Z0-9_]{3,})$/.test(val);
  const candidateChats = Array.from(
    new Set(
      [existingChatId, process.env.STORAGE_CHAT_ID, process.env.TELEGRAM_STORAGE_CHAT_ID, OWNER_ID]
        .map((c) => String(c || '').trim())
        .filter((c) => isValidTgChatId(c))
    )
  );
  if (!token || candidateChats.length === 0 || !cleanText) return null;

  const formattedMsg = `📝 #BIO_${platformId || 'USER'}\n${cleanText}`;

  if (existingMsgId && existingChatId && isValidTgChatId(existingChatId)) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: existingChatId,
          message_id: Number(existingMsgId),
          text: formattedMsg,
        }),
      });
      const d = (await r.json()) as any;
      if (d?.ok) {
        customBioMsgTextCache.set(`${existingChatId}:${existingMsgId}`, cleanText);
        return { message_id: Number(existingMsgId), chat_id: existingChatId, text: cleanText };
      }
    } catch {
      // fall through to sendMessage
    }
  }

  for (const chatId of candidateChats) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: formattedMsg,
          disable_notification: true,
        }),
      });
      const d = (await r.json()) as any;
      if (d?.ok && d?.result?.message_id) {
        const mid = Number(d.result.message_id);
        customBioMsgTextCache.set(`${chatId}:${mid}`, cleanText);
        return { message_id: mid, chat_id: chatId, text: cleanText };
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function sendPasswordResetCodeTelegram(
  telegramId: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const token = getBotToken();
  const tgId = String(telegramId || '').trim();
  if (!token || !tgId || !/^\d{5,}$/.test(tgId)) {
    return { ok: false, error: 'حساب تلگرام غير مرتبط أو البوت غير مفعل' };
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: tgId,
        text: `🔑 <b>استعادة كلمة المرور — منصة نخاع (01)</b>\n\nرمز استعادة كلمة المرور الخاص بحسابك هو:\n<code>${code}</code>\n\nصالح لمدة 15 دقيقة.`,
        parse_mode: 'HTML',
      }),
    });
    const d = (await r.json()) as any;
    return { ok: Boolean(d?.ok), error: d?.description };
  } catch (err: any) {
    return { ok: false, error: err?.message };
  }
}

export async function fetchTelegramUserProfilePhotoFileId(telegramUserId: string, bypassCache = false): Promise<string | null> {
  const tgId = String(telegramUserId || '').trim();
  if (!/^\d{5,}$/.test(tgId)) return null;
  const cached = userPhotoFileIdCache.get(tgId);
  if (!bypassCache && cached && cached.expires > Date.now()) {
    return cached.fileId || null;
  }
  const token = getBotToken();
  if (!token) return null;
  try {
    // 1. Try getChat first because it returns the currently ACTIVE main profile photo
    const chatResp = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(tgId)}`, {
      signal: AbortSignal.timeout(3500),
    });
    const chatData = (await chatResp.json()) as any;
    const activePhotoFid = chatData?.result?.photo?.big_file_id || chatData?.result?.photo?.small_file_id;
    if (activePhotoFid) {
      const fid = String(activePhotoFid);
      userPhotoFileIdCache.set(tgId, { fileId: fid, expires: Date.now() + 5 * 60 * 1000 });
      updateUserSettings(tgId, { tg_photo_file_id: fid });
      return fid;
    }

    // 2. Fallback to getUserProfilePhotos index 0 (the primary active photo in the profile photos array)
    const resp = await fetch(
      `https://api.telegram.org/bot${token}/getUserProfilePhotos?user_id=${encodeURIComponent(tgId)}&limit=1`,
      { signal: AbortSignal.timeout(3500) }
    );
    const data = (await resp.json()) as any;
    const photos = data?.result?.photos;
    if (Array.isArray(photos) && photos.length > 0 && Array.isArray(photos[0]) && photos[0].length > 0) {
      const largest = photos[0][photos[0].length - 1];
      const fid = String(largest?.file_id || '');
      if (fid) {
        userPhotoFileIdCache.set(tgId, { fileId: fid, expires: Date.now() + 5 * 60 * 1000 });
        updateUserSettings(tgId, { tg_photo_file_id: fid });
        return fid;
      }
    }
    userPhotoFileIdCache.set(tgId, { fileId: '', expires: Date.now() + 2 * 60 * 1000 });
  } catch {
    // ignore
  }
  return null;
}

const photoByteHashCache = new Map<string, string>();

async function computeTelegramPhotoHash(fileId: string): Promise<string> {
  const cleanId = String(fileId || '').trim();
  if (!cleanId) return '';
  const cached = photoByteHashCache.get(cleanId);
  if (cached) return cached;
  try {
    const url = await resolveTelegramFileUrl(cleanId);
    if (!url) return cleanId;
    const r = await fetch(url);
    if (!r.ok) return cleanId;
    const buf = Buffer.from(await r.arrayBuffer());
    const hash = crypto.createHash('sha1').update(buf).digest('hex');
    photoByteHashCache.set(cleanId, hash);
    return hash;
  } catch {
    return cleanId;
  }
}

export async function fetchTelegramUserProfilePhotosList(
  telegramUserId: string,
  archivedPhotos: Array<{ file_id: string; hash?: string }> = []
): Promise<Array<{ file_id: string; is_main: boolean; hash: string }>> {
  const tgId = String(telegramUserId || '').trim();
  if (!/^\d{5,}$/.test(tgId)) return [];
  const token = getBotToken();
  if (!token) return [];

  const rawEntries: Array<{ file_id: string; thumb_id: string; is_main: boolean }> = [];
  const seenFileIds = new Set<string>();

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${token}/getUserProfilePhotos?user_id=${encodeURIComponent(tgId)}&limit=50`,
      { signal: AbortSignal.timeout(4000) }
    );
    const data = (await resp.json()) as any;
    const photos = data?.result?.photos;
    if (Array.isArray(photos) && photos.length > 0) {
      photos.forEach((sizes: any[], idx: number) => {
        if (!Array.isArray(sizes) || sizes.length === 0) return;
        const largest = sizes[sizes.length - 1];
        const smallest = sizes[0];
        const fid = String(largest?.file_id || '').trim();
        const tid = String(smallest?.file_id || fid).trim();
        if (!fid || seenFileIds.has(fid)) return;
        seenFileIds.add(fid);
        rawEntries.push({ file_id: fid, thumb_id: tid, is_main: idx === 0 });
      });
    }
  } catch {
    // ignore
  }

  if (rawEntries.length === 0) {
    try {
      const mainFid = await fetchTelegramUserProfilePhotoFileId(tgId, false);
      if (mainFid) {
        rawEntries.push({ file_id: mainFid, thumb_id: mainFid, is_main: true });
      }
    } catch {
      // ignore
    }
  }

  // Compute content SHA-1 hashes on the small thumbnails in parallel to eliminate duplicate photos
  // when Telegram promotes an older photo to index 0 (which duplicates it in getUserProfilePhotos)
  const hashedEntries = await Promise.all(
    rawEntries.map(async (entry) => {
      const hash = await computeTelegramPhotoHash(entry.thumb_id || entry.file_id);
      return { ...entry, hash };
    })
  );

  const dedupedList: Array<{ file_id: string; is_main: boolean; hash: string }> = [];
  const seenHashes = new Set<string>();

  for (const item of hashedEntries) {
    if (seenHashes.has(item.hash)) continue;
    seenHashes.add(item.hash);
    dedupedList.push({
      file_id: item.file_id,
      is_main: dedupedList.length === 0,
      hash: item.hash,
    });
  }

  // Merge any previously archived Telegram photos that Telegram may have hidden/shifted
  // when an older photo was promoted to main
  if (Array.isArray(archivedPhotos)) {
    for (const arch of archivedPhotos) {
      const afid = String(arch?.file_id || '').trim();
      if (!afid || seenFileIds.has(afid)) continue;
      const ahash = arch.hash || (await computeTelegramPhotoHash(afid));
      if (ahash && !seenHashes.has(ahash)) {
        seenHashes.add(ahash);
        seenFileIds.add(afid);
        dedupedList.push({
          file_id: afid,
          is_main: false,
          hash: ahash,
        });
      }
    }
  }

  return dedupedList;
}

export function getPendingBotFiles(): Array<Record<string, any>> {
  const allDbFiles = Object.values(getAllFiles()).filter(
    (f) => f.folder_id === null || f.is_pending_bot === true
  );
  const combinedMap = new Map<string, Record<string, any>>();

  for (const f of allDbFiles) {
    const id = String(f.id || f.file_id || '');
    if (!id) continue;
    const size = Number(f.file_size ?? f.size ?? 0);
    combinedMap.set(id, {
      ...f,
      id,
      file_id: id,
      file_name: f.file_name || f.original_name || f.name || 'ملف',
      file_size: size,
      file_size_formatted: f.file_size_formatted || f.size_formatted || formatSize(size),
      file_type: f.file_type || f.type || getFileType(f.file_name || ''),
      upload_date: f.upload_date || f.uploaded_at || f.created_at || new Date().toISOString(),
      uploader_id: f.uploaded_by?.id || f.uploader_id || f.from_user_id || OWNER_ID,
      uploader_name: f.uploaded_by?.name || f.uploader_name || '',
    });
  }

  for (const pf of pendingBotFiles) {
    const id = String(pf.id || pf.file_id || '');
    if (!id || combinedMap.has(id)) continue;
    const size = Number(pf.file_size ?? pf.size ?? 0);
    combinedMap.set(id, {
      ...pf,
      id,
      file_id: id,
      file_name: pf.file_name || 'ملف',
      file_size: size,
      file_size_formatted: pf.file_size_formatted || formatSize(size),
      file_type: pf.file_type || getFileType(pf.file_name || ''),
      upload_date: pf.upload_date || pf.received_at || new Date().toISOString(),
      uploader_id: pf.uploader_id || pf.from_user_id || OWNER_ID,
      uploader_name: pf.uploader_name || '',
    });
  }

  return Array.from(combinedMap.values()).sort((a, b) =>
    String(b.upload_date || '').localeCompare(String(a.upload_date || ''))
  );
}

export function clearPendingBotFile(fileId: string): void {
  const idx = pendingBotFiles.findIndex((f) => f.file_id === fileId || f.id === fileId);
  if (idx !== -1) pendingBotFiles.splice(idx, 1);
}

/**
 * Optional automatic secondary backup to Internet Archive (Archive.org S3 API)
 * Activated automatically when IAS3_ACCESS_KEY and IAS3_SECRET_KEY are set in environment.
 */
export async function backupFileToArchiveOrg(
  localPath: string,
  originalName: string,
  mimeType = 'application/octet-stream'
): Promise<string | null> {
  const accessKey = (process.env.IAS3_ACCESS_KEY || '').trim();
  const secretKey = (process.env.IAS3_SECRET_KEY || '').trim();
  if (!accessKey || !secretKey || !fs.existsSync(localPath)) return null;

  const bucket = (process.env.IAS3_BUCKET || 'nukhaa-educational-archive').trim();
  const safeKey = `${Date.now()}_${encodeURIComponent(originalName.replace(/\s+/g, '_'))}`;
  const url = `https://s3.us.archive.org/${bucket}/${safeKey}`;

  try {
    const buffer = fs.readFileSync(localPath);
    const headers: Record<string, string> = {
      Authorization: `LOW ${accessKey}:${secretKey}`,
      'Content-Type': mimeType || 'application/octet-stream',
      'x-archive-auto-make-bucket': '1',
      'x-archive-meta-mediatype': 'texts',
      'x-archive-meta-Collection': process.env.IAS3_COLLECTION || 'opensource',
      'x-archive-meta-noindex': 'true',
    };
    const resp = await fetch(url, {
      method: 'PUT',
      headers,
      body: buffer,
    });
    if (resp.ok) {
      return `https://archive.org/download/${bucket}/${safeKey}`;
    }
  } catch (err) {
    console.warn('[Archive.org Backup] Upload warning:', err);
  }
  return null;
}

/**
 * Resolves a Telegram file_id to a temporary download URL on api.telegram.org
 */
export async function resolveTelegramFileUrl(fileId: string): Promise<string | null> {
  const token = getBotToken();
  if (!token || !fileId) return null;

  const cleanId = fileId.replace(/^(telegram:|tg:)/i, '').trim();
  const cached = filePathCache.get(cleanId);
  if (cached && cached.expires > Date.now()) {
    return `https://api.telegram.org/file/bot${token}/${cached.path}`;
  }

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(cleanId)}`,
      { signal: AbortSignal.timeout(3500) }
    );
    const data = (await resp.json()) as any;
    if (data?.ok && data?.result?.file_path) {
      filePathCache.set(cleanId, {
        path: data.result.file_path,
        expires: Date.now() + 45 * 60 * 1000, // 45 minutes
      });
      return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
    }
  } catch (err) {
    console.warn('[Telegram] getFile error:', err);
  }
  return null;
}

const smallFileBufferCache = new Map<string, { buf: Buffer; ct: string; expires: number }>();

/**
 * Streams a Telegram file to the Express response without exposing the bot token in the URL
 */
export async function proxyTelegramFile(fileId: string, res: Response, downloadName?: string): Promise<boolean> {
  const cleanId = String(fileId || '').replace(/^(telegram:|tg:)/i, '').trim();
  if (!downloadName && cleanId) {
    const cachedBuf = smallFileBufferCache.get(cleanId);
    if (cachedBuf && cachedBuf.expires > Date.now()) {
      res.setHeader('Content-Type', cachedBuf.ct);
      res.setHeader('Content-Length', String(cachedBuf.buf.length));
      if (!res.getHeader('Cache-Control')) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
      res.send(cachedBuf.buf);
      return true;
    }
  }

  const url = await resolveTelegramFileUrl(fileId);
  if (!url) return false;
  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(downloadName ? 25000 : 5000) });
    if (!upstream.ok || !upstream.body) return false;
    const ct = upstream.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    const cl = upstream.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);
    if (downloadName) {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`
      );
    } else if (!res.getHeader('Cache-Control')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
    const arrayBuffer = await upstream.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    if (!downloadName && cleanId && buf.length > 0 && buf.length <= 512 * 1024) {
      if (smallFileBufferCache.size > 200) {
        const firstKey = smallFileBufferCache.keys().next().value;
        if (firstKey) smallFileBufferCache.delete(firstKey);
      }
      smallFileBufferCache.set(cleanId, { buf, ct, expires: Date.now() + 15 * 60 * 1000 });
    }
    res.send(buf);
    return true;
  } catch (err) {
    console.warn('[Telegram] Proxy stream error:', err);
    return false;
  }
}

/**
 * Uploads a local file to Telegram (to OWNER_ID or storage chat) to obtain an unlimited-storage file_id
 */
export async function uploadBufferOrFileToTelegram(
  localPath: string,
  originalName: string,
  mimeType = '',
  targetChatId = OWNER_ID
): Promise<{ file_id: string; thumb_file_id?: string; file_size?: number; archive_url?: string } | null> {
  const token = getBotToken();
  const isValidTgChatId = (val: string) => /^(?:-?\d{5,}|@[a-zA-Z0-9_]{3,})$/.test(val);
  const candidateChats = Array.from(
    new Set(
      [
        targetChatId,
        process.env.STORAGE_CHAT_ID,
        OWNER_ID,
      ]
        .map((c) => String(c || '').trim())
        .filter((c) => isValidTgChatId(c))
    )
  );
  if (!token || candidateChats.length === 0 || !fs.existsSync(localPath)) return null;

  try {
    const buffer = fs.readFileSync(localPath);
    const isPhoto = /^image\/(jpeg|png|webp|gif)$/i.test(mimeType);
    const endpoint = isPhoto ? 'sendPhoto' : 'sendDocument';

    let data: any = null;
    let usedChatId = '';
    for (const chatId of candidateChats) {
      const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append(isPhoto ? 'photo' : 'document', blob, originalName);
      form.append('caption', `📦 ${originalName}`);

      const resp = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
        method: 'POST',
        body: form,
      });
      const json = (await resp.json()) as any;
      if (json?.ok && json?.result) {
        data = json;
        usedChatId = chatId;
        break;
      }
    }
    if (!data?.ok || !data?.result) return null;

    const msg = data.result;
    let fileId = '';
    let thumbFileId: string | undefined;
    let fileSize: number | undefined;

    if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
      const largest = msg.photo[msg.photo.length - 1];
      const smallest = msg.photo[0];
      fileId = largest.file_id;
      thumbFileId = smallest?.file_id;
      fileSize = largest.file_size;
    } else {
      const doc = msg.document || msg.video || msg.audio || msg.voice || msg.animation;
      if (doc?.file_id) {
        fileId = doc.file_id;
        thumbFileId = doc.thumbnail?.file_id || doc.thumb?.file_id;
        fileSize = doc.file_size;
      }
    }

    // Optional secondary backup to private Telegram Archive Channel if ARCHIVE_CHANNEL_ID is set
    const archiveChannel = (process.env.ARCHIVE_CHANNEL_ID || '').trim();
    if (isValidTgChatId(archiveChannel) && msg.message_id && usedChatId && archiveChannel !== usedChatId) {
      fetch(`https://api.telegram.org/bot${token}/copyMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: archiveChannel,
          from_chat_id: usedChatId,
          message_id: msg.message_id,
        }),
      }).catch(() => {});
    }

    // Optional secondary backup to Archive.org if IAS3 keys are configured
    const archiveUrl = await backupFileToArchiveOrg(localPath, originalName, mimeType);

    if (fileId) {
      return {
        file_id: fileId,
        thumb_file_id: thumbFileId,
        file_size: fileSize,
        archive_url: archiveUrl || undefined,
      };
    }
  } catch (err) {
    console.warn('[Telegram] Upload to Telegram failed:', err);
  }
  return null;
}

/**
 * Uploads a custom avatar to Telegram (to user's personal chat or OWNER_ID)
 * Extracts the unlimited permanent Telegram file_id, and IMMEDIATELY DELETES the message
 * so it never remains in any chat or channel, keeping privacy and zero database bloat.
 */
export async function uploadCustomAvatarEphemeralToTelegram(
  localPath: string,
  preferredChatId: string
): Promise<{ file_id: string } | null> {
  const token = getBotToken();
  if (!token || !fs.existsSync(localPath)) return null;

  const isValidTgChatId = (val: string) => /^(?:-?\d{5,}|@[a-zA-Z0-9_]{3,})$/.test(val);
  const candidateChats = Array.from(
    new Set(
      [preferredChatId, OWNER_ID, process.env.STORAGE_CHAT_ID]
        .map((c) => String(c || '').trim())
        .filter((c) => isValidTgChatId(c))
    )
  );
  if (candidateChats.length === 0) return null;

  try {
    const buffer = fs.readFileSync(localPath);
    for (const chatId of candidateChats) {
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('photo', blob, 'avatar.jpg');
      form.append('caption', '👤 Avatar');

      const resp = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: form,
      });
      const json = (await resp.json()) as any;
      if (json?.ok && json?.result) {
        const msg = json.result;
        const msgId = msg.message_id;
        let fileId = '';
        if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
          const largest = msg.photo[msg.photo.length - 1];
          fileId = largest.file_id;
        }

        // Delete message IMMEDIATELY so it leaves no trace in the chat
        if (msgId) {
          fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId }),
          }).catch(() => {});
        }

        if (fileId) {
          return { file_id: fileId };
        }
      }
    }
  } catch (err) {
    console.warn('[Telegram Avatar Ephemeral Upload] failed:', err);
  }
  return null;
}

/**
 * Sends an existing file record to a user's Telegram chat via Bot API
 */
export async function sendFileToTelegramUser(fileRecord: Record<string, any>, chatId: string): Promise<{ ok: boolean; error?: string }> {
  const token = getBotToken();
  if (!token) return { ok: false, error: 'رمز البوت (TOKEN) غير مضاف في متغيرات البيئة' };
  if (!chatId) return { ok: false, error: 'معرف المستخدم مطلوب' };

  const tgFileId = fileRecord.telegram_file_id || fileRecord.file_id || fileRecord.id;
  const ftype = fileRecord.file_type || fileRecord.type || '';
  const name = fileRecord.file_name || fileRecord.original_name || fileRecord.name || 'ملف';

  try {
    // Link or YouTube or Text note
    if (fileRecord.url) {
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📎 <b>${name}</b>\n${fileRecord.url}`,
          parse_mode: 'HTML',
        }),
      });
      const d = (await resp.json()) as any;
      return { ok: Boolean(d?.ok), error: d?.description };
    }

    if (ftype === 'text_note' || fileRecord.content || fileRecord.text_content) {
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📝 <b>${name}</b>\n\n${fileRecord.content || fileRecord.text_content || ''}`,
          parse_mode: 'HTML',
        }),
      });
      const d = (await resp.json()) as any;
      return { ok: Boolean(d?.ok), error: d?.description };
    }

    // Telegram file_id
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        document: tgFileId,
        caption: `📄 ${name}`,
      }),
    });
    const d = (await resp.json()) as any;
    if (d?.ok) return { ok: true };

    // Try sendPhoto / sendVideo / sendAudio if sendDocument rejected type
    for (const [method, field] of [
      ['sendPhoto', 'photo'],
      ['sendVideo', 'video'],
      ['sendAudio', 'audio'],
    ] as const) {
      const r2 = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          [field]: tgFileId,
          caption: `📄 ${name}`,
        }),
      });
      const d2 = (await r2.json()) as any;
      if (d2?.ok) return { ok: true };
    }

    return { ok: false, error: d?.description || 'تعذر إرسال الملف عبر تيليجرام' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'خطأ في الاتصال بتيليجرام' };
  }
}

// ==================== BACKGROUND BOT POLLING (Replaces Python Bot!) ====================
let pollingStarted = false;
let lastUpdateId = 0;

export async function startTelegramBotPolling(): Promise<void> {
  if (pollingStarted) return;
  const token = getBotToken();
  if (!token) {
    console.log('[Telegram Bot] TOKEN not set; bot polling on standby until TOKEN is configured.');
    return;
  }
  pollingStarted = true;
  console.log('[Telegram Bot] Starting Node.js Telegram Bot polling alongside Web Server...');

  // Clear any old webhook so getUpdates polling receives all messages and files
  try {
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
  } catch {
    // ignore
  }

  // Fetch bot username automatically for /api/config
  try {
    const meResp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = (await meResp.json()) as any;
    if (meData?.ok && meData?.result?.username) {
      process.env.BOT_USERNAME = meData.result.username;
      console.log(`[Telegram Bot] Connected as @${meData.result.username}`);
    }
  } catch {
    // ignore
  }

  const poll = async () => {
    while (pollingStarted) {
      try {
        const resp = await fetch(
          `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`
        );
        const data = (await resp.json()) as any;
        if (data?.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id);
            await handleBotUpdate(token, update);
          }
        } else if (data?.error_code === 409) {
          // Conflict with webhook or another instance; ensure webhook is deleted and wait briefly
          await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`).catch(() => {});
          await new Promise((r) => setTimeout(r, 5000));
        }
      } catch {
        await new Promise((r) => setTimeout(r, 5000));
      }
      await new Promise((r) => setTimeout(r, 600));
    }
  };

  poll();
}

export async function handleBotUpdate(token: string, update: any): Promise<void> {
  // Handle inline button callback queries (e.g. canceling 30-day scheduled account deletion)
  if (update.callback_query) {
    const cq = update.callback_query;
    const dataStr = String(cq.data || '').trim();
    const cqChatId = String(cq.message?.chat?.id || cq.from?.id || '');
    if (dataStr.startsWith('cancel_acc_del:')) {
      const targetUid = dataStr.slice('cancel_acc_del:'.length).trim();
      const resCancel = cancelAccountDeletion(targetUid);
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: cq.id,
          text: resCancel.ok ? '✅ تم إلغاء حذف الحساب واستعادته بنجاح!' : '⚠️ تعذر إلغاء الحذف',
          show_alert: true,
        }),
      }).catch(() => {});
      if (resCancel.ok && cqChatId) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: cqChatId,
            text: `✅ <b>تم إلغاء جدولة حذف حسابك (${resCancel.user?.platform_id || targetUid}) بنجاح!</b>\nحسابك الآن نشط ومحفوظ بالكامل في المنصة.`,
            parse_mode: 'HTML',
          }),
        }).catch(() => {});
      }
      return;
    }
  }

  const msg = update.message || update.channel_post;
  if (!msg || !msg.chat) return;
  const chatId = String(msg.chat.id);
  const userId = String(msg.from?.id || chatId);
  const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || '';
  const text = String(msg.text || '').trim();

  // Handle cancel phone verification keyboard button
  if (text === '❌ إلغاء مشاركة الرقم' || text === '❌ إلغاء الطلب') {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'تم إلغاء طلب مشاركة رقم الهاتف وإخفاء الزر.',
        reply_markup: { remove_keyboard: true },
      }),
    }).catch(() => {});
    return;
  }

  // 0. Handle verified Telegram contact share (request_contact) for official Phone Number verification
  if (msg.contact && msg.contact.phone_number) {
    const contactUserId = String(msg.contact.user_id || '');
    if (contactUserId && contactUserId !== userId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '⚠️ يرجى مشاركة جهة الاتصال الخاصة بحسابك الشخصي فقط عبر زر المشاركة.',
          reply_markup: { remove_keyboard: true },
        }),
      }).catch(() => {});
      return;
    }
    const verified = verifyTelegramPhoneContact(userId, String(msg.contact.phone_number));
    if (verified.ok) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ <b>تم تأكيد رقم هاتفك المرتبط بتلگرام بنجاح!</b>\n\nالرقم المؤكد: <code dir="ltr">${verified.phone}</code>\nالمعرف في المنصة: <code>${verified.user?.platform_id || ''}</code>`,
          parse_mode: 'HTML',
          reply_markup: { remove_keyboard: true },
        }),
      }).catch(() => {});
    } else {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⚠️ ${verified.error || 'تعذر تأكيد رقم الهاتف، تأكد من ربط حسابك أولاً.'}`,
          reply_markup: { remove_keyboard: true },
        }),
      }).catch(() => {});
    }
    return;
  }

  // 1. Handle /start deep-links (e.g., /start auth_<token>, /start file_<id> or /start folder_<id>)
  if (text.startsWith('/start')) {
    const param = text.split(/\s+/)[1] || '';
    if (param.startsWith('auth_')) {
      const sessionToken = param.slice(5).trim();
      const session = getTelegramAuthSession(sessionToken);
      if (session) {
        const photoFid = await fetchTelegramUserProfilePhotoFileId(userId);
        let linkedUser: Record<string, any> | undefined;
        let authError = '';

        if (session.accountId) {
          const resLink = linkTelegramAccount(session.accountId, {
            id: userId,
            first_name: msg.from?.first_name || '',
            last_name: msg.from?.last_name || '',
            username: msg.from?.username || '',
          });
          if (resLink.ok && resLink.user) {
            linkedUser = resLink.user;
            if (photoFid) {
              linkedUser = updateUserSettings(linkedUser.id, { tg_photo_file_id: photoFid });
            }
          } else {
            authError = resLink.error || 'تعذر ربط الحساب بتلگرام';
          }
        } else {
          // Login via Telegram ONLY succeeds if a registered & linked platform account already exists
          const resLogin = authenticateTelegramLoginOnly(userId);
          if (resLogin.ok && resLogin.user) {
            linkedUser = resLogin.user;
            if (photoFid) {
              linkedUser = updateUserSettings(linkedUser.id, { tg_photo_file_id: photoFid });
            }
          } else {
            authError =
              resLogin.error ||
              'لا يوجد حساب مسجل في المنصة مرتبط بحساب تلگرام هذا. يرجى إنشاء حساب أولاً ثم ربطه بتلگرام من الإعدادات.';
          }
        }

        if (linkedUser) {
          session.status = 'completed';
          session.user = linkedUser;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: session.accountId
                ? `✅ تم ربط حسابك في منصة نخاع بنجاح!\nالمعرف الخاص بك: <code>${linkedUser.platform_id}</code>\nيمكنك أيضاً الضغط على الزر أدناه لمشاركة رقم هاتفك وتأكيده، أو العودة مباشرة إلى المتصفح.`
                : `✅ تم تسجيل دخولك في منصة نخاع بنجاح!\nالمعرف الخاص بك: <code>${linkedUser.platform_id}</code>\nيمكنك الآن العودة إلى نافذة المتصفح.`,
              parse_mode: 'HTML',
              reply_markup:
                session.accountId && !linkedUser.phone_verified
                  ? {
                      keyboard: [
                        [
                          {
                            text: '📱 مشاركة رقم هاتفي لتأكيد الحساب',
                            request_contact: true,
                          },
                        ],
                      ],
                      resize_keyboard: true,
                      one_time_keyboard: true,
                    }
                  : undefined,
            }),
          }).catch(() => {});
          return;
        } else {
          session.status = 'failed';
          session.error = authError;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `⚠️ ${authError}`,
              parse_mode: 'HTML',
            }),
          }).catch(() => {});
          return;
        }
      }
    } else if (param.startsWith('file_')) {
      const rawId = param.slice(5);
      const file = getFile(rawId) || Object.values(getAllFiles()).find((f) => f.id.startsWith(rawId));
      if (file) {
        incrementDownloads(file.id);
        await sendFileToTelegramUser(file, chatId);
        return;
      }
    } else if (param.startsWith('folder_')) {
      const folderId = param.slice(7);
      const files = getFilesInFolder(folderId);
      for (const f of files.slice(0, 15)) {
        await sendFileToTelegramUser(f, chatId);
      }
      return;
    }

    const webAppUrl = (
      process.env.WEBAPP_URL ||
      process.env.PUBLIC_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '') ||
      process.env.APP_URL ||
      ''
    ).trim();
    const replyMarkup = webAppUrl
      ? {
          inline_keyboard: [
            [{ text: '🚀 فتح منصة نخاع', web_app: { url: webAppUrl } }],
          ],
        }
      : undefined;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'مرحباً بك في منصة نخاع التعليمية 🎓\nيمكنك تصفح الملفات والمحاضرات والاختبارات من خلال المنصة.',
        reply_markup: replyMarkup,
      }),
    });
    return;
  }

  // 2. Handle files sent directly to the bot by Owner/Admins (bot_receive mode)
  const isPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
  const doc =
    msg.document ||
    msg.video ||
    msg.audio ||
    msg.voice ||
    msg.animation ||
    (isPhoto ? msg.photo[msg.photo.length - 1] : null);

  if (doc && doc.file_id) {
    const botReceiveSettings = dbLoadDoc('settings', 'bot_receive') || {};
    if (botReceiveSettings[userId] !== false) {
      const extFromMime = doc.mime_type ? `.${doc.mime_type.split('/')[1] || 'bin'}` : isPhoto ? '.jpg' : '';
      const fileName =
        doc.file_name ||
        msg.caption ||
        (isPhoto ? `صورة_${Date.now()}.jpg` : `ملف_${Date.now()}${extFromMime}`);
      const thumbId =
        doc.thumbnail?.file_id ||
        doc.thumb?.file_id ||
        (isPhoto ? msg.photo[0]?.file_id || doc.file_id : '');

      const rec = createFileRecord({
        original_name: fileName,
        size: Number(doc.file_size) || 0,
        folder_id: null,
        is_pending_bot: true,
        uploaded_by: userId,
        description: msg.caption || '',
        source: 'telegram',
        telegram_file_id: doc.file_id,
        mime_type: doc.mime_type || (isPhoto ? 'image/jpeg' : ''),
      });

      updateFile(rec.id, {
        uploader_id: userId,
        uploader_name: senderName,
        thumb_file_id: thumbId,
        has_thumb: Boolean(thumbId),
      });

      // Background copy to ARCHIVE_CHANNEL_ID (zero-bandwidth server-side pointer copy)
      const archiveChannel = (process.env.ARCHIVE_CHANNEL_ID || '').trim();
      if (/^(?:-?\d{5,}|@[a-zA-Z0-9_]{3,})$/.test(archiveChannel) && msg.message_id && archiveChannel !== chatId) {
        fetch(`https://api.telegram.org/bot${token}/copyMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: archiveChannel,
            from_chat_id: chatId,
            message_id: msg.message_id,
          }),
        }).catch(() => {});
      }

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          reply_to_message_id: msg.message_id,
          text: `✅ تم استلام الملف <b>${fileName}</b> في المنصة!\nافتح نافذة الرفع ← تبويب <b>تلگرام</b> لاختيار المجلد والوسوم وحفظه.`,
          parse_mode: 'HTML',
        }),
      }).catch(() => {});
    }
  }
}
