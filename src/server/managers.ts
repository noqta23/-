import crypto from 'crypto';
import {
  OWNER_ID,
  dbLoadDoc,
  dbSaveDoc,
  dbDeleteDoc,
  dbLoadCollection,
  nowBaghdadStr,
  formatSize,
  getFileType,
} from './db.ts';
import { syncItemTags } from './taxonomy.ts';

function genId(len = 8): string {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

// ==================== ADMINS MANAGER ====================
const ADMINS_COL = 'admins';

export const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  can_edit: true,
  can_delete: true,
  can_upload: true,
  can_manage_groups: true,
  can_manage_folders: true,
  can_manage_quizzes: true,
  upload_files: true,
  edit_own_files: true,
  delete_own_files: true,
  edit_others_files: true,
  delete_others_files: true,
  create_folders: true,
  edit_own_folders: true,
  delete_own_folders: true,
  edit_others_folders: true,
  delete_others_folders: true,
  move_items: true,
  copy_items: true,
  create_quizzes: true,
  edit_own_quizzes: true,
  delete_own_quizzes: true,
  edit_others_quizzes: true,
  delete_others_quizzes: true,
  manage_tags: true,
  view_stats: true,
  view_users: false,
  ban_users: false,
  manage_groups: true,
  restore_deleted: false,
  permanent_delete: false,
};

export const OWNER_PERMISSIONS: Record<string, boolean> = Object.fromEntries(
  Object.keys(DEFAULT_PERMISSIONS).map((k) => [k, true])
);

export const PERMISSION_LABELS: Record<string, string> = {
  can_upload: 'رفع الملفات والروابط',
  can_edit: 'تعديل الملفات والمجلدات',
  can_delete: 'حذف الملفات والمجلدات',
  can_manage_folders: 'إدارة المجلدات',
  can_manage_groups: 'إدارة الكروبات والقنوات',
  can_manage_quizzes: 'إدارة الاختبارات والأسئلة',
};

function getCandidateUserIds(userId: string): string[] {
  const uid = String(userId || '').trim();
  if (!uid) return [];
  const ids = new Set<string>([uid]);
  const direct = dbLoadDoc('users', uid);
  if (direct) {
    if (direct.id) ids.add(String(direct.id));
    if (direct.telegram_id) ids.add(String(direct.telegram_id));
    if (direct.platform_id) ids.add(String(direct.platform_id));
  } else {
    const all = dbLoadCollection('users');
    for (const u of Object.values(all)) {
      if (
        String(u.platform_id || '').toLowerCase() === uid.toLowerCase() ||
        String(u.telegram_id || '') === uid
      ) {
        if (u.id) ids.add(String(u.id));
        if (u.telegram_id) ids.add(String(u.telegram_id));
        if (u.platform_id) ids.add(String(u.platform_id));
        break;
      }
    }
  }
  return [...ids];
}

export function isOwner(userId: string): boolean {
  if (!userId || !OWNER_ID) return false;
  return getCandidateUserIds(userId).includes(OWNER_ID);
}

export function isAdmin(userId: string): boolean {
  if (!userId) return false;
  const candidates = getCandidateUserIds(userId);
  if (OWNER_ID && candidates.includes(OWNER_ID)) return true;
  return candidates.some((id) => dbLoadDoc(ADMINS_COL, id) !== null);
}

export function getUserRole(userId: string): 'owner' | 'admin' | 'user' {
  if (!userId) return 'user';
  const candidates = getCandidateUserIds(userId);
  if (OWNER_ID && candidates.includes(OWNER_ID)) return 'owner';
  if (candidates.some((id) => dbLoadDoc(ADMINS_COL, id) !== null)) return 'admin';
  return 'user';
}

export function getAdminPermissions(userId: string): Record<string, boolean> {
  const candidates = getCandidateUserIds(userId);
  if (OWNER_ID && candidates.includes(OWNER_ID)) return { ...OWNER_PERMISSIONS };
  for (const id of candidates) {
    const doc = dbLoadDoc(ADMINS_COL, id);
    if (doc) {
      return { ...DEFAULT_PERMISSIONS, ...(doc.permissions || {}) };
    }
  }
  return {};
}

export function getAllAdmins(): Record<string, Record<string, any>> {
  const raw = dbLoadCollection(ADMINS_COL);
  const out: Record<string, Record<string, any>> = {};
  for (const [aid, info] of Object.entries(raw)) {
    out[aid] = {
      ...info,
      id: aid,
      first_name: info.first_name || info.name || aid,
      permissions: { ...DEFAULT_PERMISSIONS, ...(info.permissions || {}) },
    };
  }
  return out;
}

export function addAdmin(
  adminId: string,
  name = '',
  username = '',
  addedBy = '',
  permissions?: Record<string, boolean>,
  photoUrl = ''
): { ok: boolean; admin?: Record<string, any>; error?: string } {
  const aid = String(adminId || '').trim().replace(/^@/, '');
  if (!aid) return { ok: false, error: 'معرف المشرف مطلوب' };
  if (aid === OWNER_ID) return { ok: false, error: 'هذا المستخدم هو المالك بالفعل' };
  const existingUser = getUser(aid);
  const resolvedId = existingUser?.id || aid;
  const perms = { ...DEFAULT_PERMISSIONS, ...(permissions || {}) };
  const doc = {
    id: resolvedId,
    user_id: resolvedId,
    first_name: name || existingUser?.first_name || `مشرف ${resolvedId}`,
    name: name || existingUser?.display_name || `مشرف ${resolvedId}`,
    username: String(username || existingUser?.username || '').replace(/^@/, ''),
    photo_url: photoUrl || existingUser?.photo_url || '',
    added_by: String(addedBy || OWNER_ID),
    added_at: new Date().toISOString(),
    permissions: perms,
    activity_count: 0,
  };
  dbSaveDoc(ADMINS_COL, resolvedId, doc);
  return { ok: true, admin: doc };
}

export function removeAdmin(adminId: string): boolean {
  const aid = String(adminId || '').trim();
  if (!aid || aid === OWNER_ID) return false;
  return dbDeleteDoc(ADMINS_COL, aid);
}

export function updateAdminPermissions(adminId: string, permissions: Record<string, boolean>): Record<string, any> | null {
  const aid = String(adminId || '').trim();
  const doc = dbLoadDoc(ADMINS_COL, aid);
  if (!doc) return null;
  doc.permissions = { ...DEFAULT_PERMISSIONS, ...(doc.permissions || {}), ...permissions };
  doc.updated_at = new Date().toISOString();
  dbSaveDoc(ADMINS_COL, aid, doc);
  return doc;
}

// ==================== USERS MANAGER ====================
const USERS_COL = 'users';

function getEncryptionKey(): Buffer {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.OWNER_KEY ||
    process.env.TOKEN ||
    process.env.TELEGRAM_BOT_TOKEN ||
    'nukhaa-platform-aes256-secret-key';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

export function encryptSensitive(plainText: string): string {
  const text = String(plainText || '').trim();
  if (!text) return '';
  if (text.startsWith('enc:v1:')) return text;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch {
    return text;
  }
}

export function decryptSensitive(cipherText: string): string {
  const raw = String(cipherText || '').trim();
  if (!raw) return '';
  if (!raw.startsWith('enc:v1:')) return raw;
  try {
    const parts = raw.split(':');
    if (parts.length !== 5) return '';
    const iv = Buffer.from(parts[2], 'hex');
    const tag = Buffer.from(parts[3], 'hex');
    const encrypted = Buffer.from(parts[4], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

export function ensurePlatformId(uid: string, existingPlatformId?: string): string {
  if (existingPlatformId) {
    const raw = String(existingPlatformId).trim().toUpperCase();
    if (raw.startsWith('01-') && raw.length >= 6) {
      return raw;
    }
    if (raw.startsWith('NK-') && raw.length >= 6) {
      return `01-${raw.slice(3)}`;
    }
  }
  const hash = crypto.createHash('sha1').update(`nukhaa:${uid}`).digest('hex').slice(0, 8).toUpperCase();
  return `01-${hash}`;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
  } catch {
    return false;
  }
}

export const DEFAULT_USER_PRIVACY: Record<string, any> = {
  show_platform_id: true,
  show_first_name: true,
  show_last_name: true,
  show_username: true,
  show_email: false,
  show_phone: false,
  show_birth_date: false,
  show_gender: true,
  show_bio: true,
  show_telegram: true,
  show_google: false,
  show_stats: true,
  show_photos_custom: true,
  show_photos_telegram: true,
  show_photos_google: true,
  hidden_photo_ids: [],
  hidden_tg_accounts: [],
  hidden_google_accounts: [],
  hidden_fields: [],
};

export function normalizeUserRecord(doc: Record<string, any>, includePrivate = true): Record<string, any> {
  if (!doc || typeof doc !== 'object') return {};
  const uid = String(doc.id || doc.user_id || '').trim();
  const isNumericTg = /^\d{5,}$/.test(uid);
  const tgUnlinked = Boolean(doc.telegram_unlinked);
  const primaryTgIdRaw = tgUnlinked ? '' : String(doc.primary_bot_telegram_id || doc.telegram_id || (isNumericTg ? uid : '') || '').trim();

  // Build normalized telegram_accounts list
  const rawTgAccountsInput: Array<Record<string, any>> = Array.isArray(doc.telegram_accounts)
    ? doc.telegram_accounts
    : [];
  const tgAccountsMap = new Map<string, Record<string, any>>();
  for (const ta of rawTgAccountsInput) {
    const tid = String(ta?.telegram_id || ta?.id || '').trim();
    if (!tid) continue;
    tgAccountsMap.set(tid, {
      telegram_id: tid,
      id: tid,
      first_name: String(ta.first_name || '').trim(),
      last_name: String(ta.last_name || '').trim(),
      username: String(ta.username || '').trim().replace(/^@/, ''),
      phone: decryptSensitive(ta.phone_enc || ta.phone || ''),
      phone_verified: Boolean(ta.phone_verified || ta.phone_enc || ta.phone),
      bio: String(ta.bio || '').trim(),
      birth_date: String(ta.birth_date || '').trim(),
      photo_file_id: String(ta.photo_file_id || '').trim(),
      personal_chat_title: String(ta.personal_chat_title || '').trim(),
      personal_chat_username: String(ta.personal_chat_username || '').trim().replace(/^@/, ''),
      personal_chat_id: String(ta.personal_chat_id || '').trim(),
      is_premium: Boolean(ta.is_premium),
      language_code: String(ta.language_code || '').trim(),
      accent_color_id: typeof ta.accent_color_id === 'number' ? ta.accent_color_id : undefined,
      linked_at: String(ta.linked_at || doc.tg_linked_at || doc.joined_at || ''),
      is_primary_bot: false,
    });
  }
  if (!tgUnlinked && primaryTgIdRaw && !tgAccountsMap.has(primaryTgIdRaw)) {
    const legacyTgPhone = decryptSensitive(doc.tg_phone_enc || doc.tg_phone || '');
    tgAccountsMap.set(primaryTgIdRaw, {
      telegram_id: primaryTgIdRaw,
      id: primaryTgIdRaw,
      first_name: String(doc.tg_first_name || (isNumericTg ? doc.first_name : '') || '').trim(),
      last_name: String(doc.tg_last_name || (isNumericTg ? doc.last_name : '') || '').trim(),
      username: String(doc.tg_username ?? (isNumericTg && !doc.custom_username ? doc.username : '') ?? '').trim().replace(/^@/, ''),
      phone: legacyTgPhone,
      phone_verified: Boolean(legacyTgPhone),
      bio: String(doc.tg_bio || '').trim(),
      birth_date: String(doc.tg_birth_date || '').trim(),
      photo_file_id: String(doc.tg_photo_file_id || '').trim(),
      personal_chat_title: String(doc.tg_personal_chat_title || '').trim(),
      personal_chat_username: String(doc.tg_personal_chat_username || '').trim().replace(/^@/, ''),
      personal_chat_id: String(doc.tg_personal_chat_id || '').trim(),
      is_premium: Boolean(doc.tg_is_premium),
      language_code: String(doc.tg_language_code || '').trim(),
      accent_color_id: typeof doc.tg_accent_color_id === 'number' ? doc.tg_accent_color_id : undefined,
      linked_at: String(doc.tg_linked_at || doc.joined_at || ''),
      is_primary_bot: true,
    });
  }

  const tgAccountsList = tgUnlinked ? [] : Array.from(tgAccountsMap.values());
  const telegramId = tgAccountsList.length > 0
    ? (tgAccountsMap.has(primaryTgIdRaw) ? primaryTgIdRaw : tgAccountsList[0].telegram_id)
    : '';
  const tgLinked = tgAccountsList.length > 0 && !tgUnlinked;
  for (const ta of tgAccountsList) {
    ta.is_primary_bot = ta.telegram_id === telegramId;
  }
  const primaryTgAcc = tgAccountsMap.get(telegramId) || tgAccountsList[0] || null;

  // Build normalized google_accounts list
  const googleUnlinked = Boolean(doc.google_unlinked);
  const rawGoogleId = googleUnlinked ? '' : String(doc.google_id || '').trim();
  const rawGoogleEmail = googleUnlinked ? '' : decryptSensitive(doc.google_email_enc || doc.google_email || '');
  const rawGoogleGiven = googleUnlinked ? '' : String(doc.google_given_name || '').trim();
  const rawGoogleFamily = googleUnlinked ? '' : String(doc.google_family_name || '').trim();
  const rawGoogleName = googleUnlinked
    ? ''
    : String(doc.google_name || [rawGoogleGiven, rawGoogleFamily].filter(Boolean).join(' ') || '').trim();
  const rawGooglePhoto = googleUnlinked ? '' : String(doc.google_photo_url || '').trim();

  const googleAccountsMap = new Map<string, Record<string, any>>();
  if (!googleUnlinked && Array.isArray(doc.google_accounts)) {
    for (const ga of doc.google_accounts) {
      const gid = String(ga?.sub || ga?.google_id || '').trim();
      if (!gid) continue;
      googleAccountsMap.set(gid, {
        id: gid,
        sub: gid,
        google_id: gid,
        email: String(ga.email || '').trim(),
        name: String(ga.name || [ga.given_name, ga.family_name].filter(Boolean).join(' ') || '').trim(),
        given_name: String(ga.given_name || '').trim(),
        family_name: String(ga.family_name || '').trim(),
        nickname: String(ga.nickname || '').trim(),
        picture: String(ga.picture || ga.photo_url || '').trim(),
        photo_url: String(ga.picture || ga.photo_url || '').trim(),
        phone: decryptSensitive(ga.phone_enc || ga.phone || ''),
        birth_date: String(ga.birth_date || '').trim(),
        gender: String(ga.gender || '').trim(),
        bio: String(ga.bio || '').trim(),
        organization: String(ga.organization || '').trim(),
        occupation: String(ga.occupation || '').trim(),
        address: String(ga.address || '').trim(),
        locale: String(ga.locale || '').trim(),
        urls: Array.isArray(ga.urls) ? ga.urls : [],
        linked_at: String(ga.linked_at || doc.google_linked_at || ''),
        is_primary: false,
      });
    }
  }
  if (!googleUnlinked && rawGoogleId && !googleAccountsMap.has(rawGoogleId)) {
    googleAccountsMap.set(rawGoogleId, {
      id: rawGoogleId,
      sub: rawGoogleId,
      google_id: rawGoogleId,
      email: rawGoogleEmail,
      name: rawGoogleName,
      given_name: rawGoogleGiven,
      family_name: rawGoogleFamily,
      nickname: String(doc.google_nickname || '').trim(),
      picture: rawGooglePhoto,
      photo_url: rawGooglePhoto,
      phone: decryptSensitive(doc.google_phone_enc || doc.google_phone || ''),
      birth_date: String(doc.google_birth_date || '').trim(),
      gender: String(doc.google_gender || '').trim(),
      bio: String(doc.google_bio || '').trim(),
      organization: String(doc.google_organization || '').trim(),
      occupation: String(doc.google_occupation || '').trim(),
      address: String(doc.google_address || '').trim(),
      locale: String(doc.google_locale || '').trim(),
      urls: Array.isArray(doc.google_urls) ? doc.google_urls : [],
      linked_at: String(doc.google_linked_at || ''),
      is_primary: true,
    });
  }
  const rawGoogleAccounts = googleUnlinked ? [] : Array.from(googleAccountsMap.values());
  const googleId = rawGoogleAccounts.length > 0
    ? (googleAccountsMap.has(rawGoogleId) ? rawGoogleId : rawGoogleAccounts[0].google_id)
    : '';
  const googleLinked = rawGoogleAccounts.length > 0 && !googleUnlinked;
  for (const ga of rawGoogleAccounts) {
    ga.is_primary = ga.google_id === googleId;
  }
  const primaryGoogleAcc = googleAccountsMap.get(googleId) || rawGoogleAccounts[0] || null;
  const googleEmail = primaryGoogleAcc?.email || rawGoogleEmail;
  const googleGivenName = primaryGoogleAcc?.given_name || rawGoogleGiven;
  const googleFamilyName = primaryGoogleAcc?.family_name || rawGoogleFamily;
  const googleName = primaryGoogleAcc?.name || rawGoogleName;
  const googlePhotoUrl = primaryGoogleAcc?.picture || rawGooglePhoto;

  const platformId = ensurePlatformId(uid || telegramId || genId(8), doc.platform_id);
  const settings = { ...(doc.settings || {}) };

  const rawNameSource = doc.name_source || settings.name_source;
  const rawUsernameSource = doc.username_source || settings.username_source;
  const rawPhotoSource = doc.photo_source || settings.photo_source;
  const rawEmailSource = doc.email_source || settings.email_source;
  const rawPhoneSource = doc.phone_source || settings.phone_source;
  const rawBioSource = doc.bio_source || settings.bio_source;

  const nameSource: 'telegram' | 'google' | 'custom' =
    tgLinked && rawNameSource === 'telegram'
      ? 'telegram'
      : googleLinked && rawNameSource === 'google'
      ? 'google'
      : 'custom';

  const usernameSource: 'telegram' | 'custom' =
    tgLinked && rawUsernameSource === 'telegram' ? 'telegram' : 'custom';

  let photoSource: 'telegram' | 'google' | 'custom' = 'custom';
  if (rawPhotoSource === 'telegram' && tgLinked) {
    photoSource = 'telegram';
  } else if (rawPhotoSource === 'google' && googleLinked) {
    photoSource = 'google';
  } else if (rawPhotoSource === 'custom' || Boolean(doc.custom_photo_data || doc.custom_photo_file_id)) {
    photoSource = 'custom';
  } else if (tgLinked) {
    photoSource = 'telegram';
  } else if (googleLinked) {
    photoSource = 'google';
  }

  const tgFirstName = primaryTgAcc?.first_name || (tgUnlinked ? '' : String(doc.tg_first_name || (isNumericTg ? doc.first_name : '') || '').trim());
  const tgLastName = primaryTgAcc?.last_name || (tgUnlinked ? '' : String(doc.tg_last_name || (isNumericTg ? doc.last_name : '') || '').trim());
  const tgFullName = [tgFirstName, tgLastName].filter(Boolean).join(' ').trim();
  const tgPhone = primaryTgAcc?.phone || (tgUnlinked ? '' : decryptSensitive(doc.tg_phone_enc || doc.tg_phone || ''));
  const tgBio = primaryTgAcc?.bio || (tgUnlinked ? '' : String(doc.tg_bio || '').trim());
  const tgBirthDate = primaryTgAcc?.birth_date || (tgUnlinked ? '' : String(doc.tg_birth_date || '').trim());

  const rawCustomName = String(doc.custom_name || doc.full_name || (!isNumericTg ? doc.display_name || doc.name : '') || '').trim();
  const customParts = rawCustomName.split(/\s+/).filter(Boolean);
  const customFirstName = String(doc.custom_first_name ?? (customParts[0] || '')).trim();
  const customLastName = String(doc.custom_last_name ?? (customParts.slice(1).join(' ') || '')).trim();
  const customName = [customFirstName, customLastName].filter(Boolean).join(' ').trim() || rawCustomName;

  // Granular field_sources resolution (supports per-account selection like 'tg:12345' or 'google:67890' or 'custom' or 'none')
  const fsRaw = (doc.field_sources && typeof doc.field_sources === 'object') ? doc.field_sources : {};
  const fieldSources: Record<string, string> = {
    first_name: String(fsRaw.first_name || (nameSource === 'telegram' ? `tg:${telegramId}` : nameSource === 'google' ? `google:${googleId}` : 'custom')),
    last_name: String(fsRaw.last_name || (nameSource === 'telegram' ? `tg:${telegramId}` : nameSource === 'google' ? `google:${googleId}` : 'custom')),
    username: String(fsRaw.username || (usernameSource === 'telegram' ? `tg:${telegramId}` : 'custom')),
    phone: String(fsRaw.phone || (rawPhoneSource === 'telegram' ? `tg:${telegramId}` : 'custom')),
    email: String(fsRaw.email || (rawEmailSource === 'google' ? `google:${googleId}` : 'custom')),
    bio: String(fsRaw.bio || (rawBioSource === 'telegram' ? `tg:${telegramId}` : 'custom')),
    birth_date: String(fsRaw.birth_date || 'custom'),
    gender: String(fsRaw.gender || 'custom'),
    photo: String(fsRaw.photo || (photoSource === 'telegram' ? `tg:${telegramId}` : photoSource === 'google' ? `google:${googleId}` : 'custom')),
  };

  const resolveFromSource = (src: string, fieldKey: string, customFallback: string): string => {
    if (!src || src === 'none') return '';
    if (src === 'custom') return customFallback;
    if (src.startsWith('tg:') || src === 'telegram') {
      const tid = src.startsWith('tg:') ? src.slice(3) : telegramId;
      const acc = tgAccountsMap.get(tid) || primaryTgAcc;
      if (!acc) return customFallback;
      return String(acc[fieldKey] || '').trim();
    }
    if (src.startsWith('google:') || src === 'google') {
      const gid = src.startsWith('google:') ? src.slice(7) : googleId;
      const acc = googleAccountsMap.get(gid) || primaryGoogleAcc;
      if (!acc) return customFallback;
      if (fieldKey === 'first_name') return String(acc.given_name || '').trim();
      if (fieldKey === 'last_name') return String(acc.family_name || '').trim();
      return String(acc[fieldKey] || '').trim();
    }
    return customFallback;
  };

  const resolvedFirst = resolveFromSource(fieldSources.first_name, 'first_name', customFirstName);
  const resolvedLast = resolveFromSource(fieldSources.last_name, 'last_name', customLastName);
  const combinedFromFirstLast = [resolvedFirst, resolvedLast].filter(Boolean).join(' ').trim();

  const effectiveDisplayName =
    combinedFromFirstLast ||
    (nameSource === 'telegram'
      ? tgFullName || tgFirstName || customName || googleName || (uid === OWNER_ID ? 'المالك' : `مستخدم ${platformId}`)
      : nameSource === 'google'
      ? googleName || googleGivenName || customName || tgFullName || (uid === OWNER_ID ? 'المالك' : `مستخدم ${platformId}`)
      : customName || tgFullName || googleName || tgFirstName || (uid === OWNER_ID ? 'المالك' : `مستخدم ${platformId}`));

  const tgUsername = primaryTgAcc?.username || '';
  const customUsername = String(doc.custom_username || (!isNumericTg ? doc.username : '') || '')
    .trim()
    .replace(/^@/, '');

  const effectiveUsername =
    resolveFromSource(fieldSources.username, 'username', customUsername) || customUsername || tgUsername;

  const decryptedEmail = decryptSensitive(doc.email_enc || doc.email || '');
  const decryptedPhone = decryptSensitive(doc.phone_enc || doc.phone || '');

  const emailSource: 'google' | 'custom' =
    googleLinked && (fieldSources.email.startsWith('google') || rawEmailSource === 'google' || (!decryptedEmail && googleEmail)) ? 'google' : 'custom';

  const phoneSource: 'telegram' | 'custom' =
    tgLinked && (fieldSources.phone.startsWith('tg') || rawPhoneSource === 'telegram' || (!decryptedPhone && tgPhone)) ? 'telegram' : 'custom';

  const bioSource: 'telegram' | 'custom' =
    tgLinked && (fieldSources.bio.startsWith('tg') || rawBioSource === 'telegram') ? 'telegram' : 'custom';

  const customBio = String(doc.custom_bio || '').trim();
  const effectiveBio = resolveFromSource(fieldSources.bio, 'bio', customBio) || (bioSource === 'telegram' ? tgBio || customBio : customBio || tgBio);

  const effectiveEmail = resolveFromSource(fieldSources.email, 'email', decryptedEmail) || (emailSource === 'google' && googleEmail ? googleEmail : decryptedEmail);
  const effectivePhone = resolveFromSource(fieldSources.phone, 'phone', decryptedPhone) || (phoneSource === 'telegram' && tgPhone ? tgPhone : decryptedPhone);

  const customBirthDate = String(doc.custom_birth_date ?? doc.birth_date ?? '').trim();
  const effectiveBirthDate = resolveFromSource(fieldSources.birth_date, 'birth_date', customBirthDate) || customBirthDate || tgBirthDate;

  const emailVerified = Boolean(
    (emailSource === 'google' && effectiveEmail) ||
      doc.email_verified ||
      rawGoogleAccounts.some((ga) => ga.email && effectiveEmail && ga.email.toLowerCase() === effectiveEmail.toLowerCase())
  );
  const phoneVerified = Boolean(
    (phoneSource === 'telegram' && effectivePhone) ||
      doc.phone_verified ||
      tgAccountsList.some((ta) => ta.phone && effectivePhone && ta.phone.replace(/[\s\-()+]/g, '') === effectivePhone.replace(/[\s\-()+]/g, ''))
  );

  const privacy = {
    ...DEFAULT_USER_PRIVACY,
    ...(settings.privacy || {}),
    ...(doc.privacy || {}),
  };

  // Normalize custom_photos list
  const rawCustomPhotos: Array<{ id: string; file_id: string; added_at: string }> = Array.isArray(doc.custom_photos)
    ? doc.custom_photos.filter((cp: any) => cp && cp.file_id)
    : [];
  const mainCustomFid = String(doc.custom_photo_file_id || '').trim();
  if (mainCustomFid && !rawCustomPhotos.some((cp) => cp.file_id === mainCustomFid)) {
    rawCustomPhotos.unshift({
      id: `cp_${mainCustomFid.slice(-8)}`,
      file_id: mainCustomFid,
      added_at: doc.last_active || new Date().toISOString(),
    });
  }

  const hiddenPhotoIds: string[] = Array.isArray(doc.hidden_photo_ids)
    ? doc.hidden_photo_ids.map((x: any) => String(x || '').trim()).filter(Boolean)
    : Array.isArray(privacy.hidden_photo_ids)
    ? privacy.hidden_photo_ids.map((x: any) => String(x || '').trim()).filter(Boolean)
    : [];

  const rawGender = String(doc.custom_gender || doc.gender || settings.gender || '').trim();
  const resolvedGenderRaw = resolveFromSource(fieldSources.gender, 'gender', rawGender);
  const gender: 'male' | 'female' | '' =
    resolvedGenderRaw === 'male' || resolvedGenderRaw === 'female' ? resolvedGenderRaw : (rawGender === 'male' || rawGender === 'female' ? rawGender : '');

  // Active sessions & blocked devices
  const sessionsList: Array<Record<string, any>> = Array.isArray(doc.sessions) ? doc.sessions : [];
  const blockedDevicesList: Array<Record<string, any>> = Array.isArray(doc.blocked_devices) ? doc.blocked_devices : [];

  // 30-day scheduled account deletion
  const deletionScheduledAt = String(doc.deletion_scheduled_at || '').trim();
  const deletionExecuteAt = String(doc.deletion_execute_at || '').trim();
  const deletionExecuteTs = Number(doc.deletion_execute_ts || 0);

  const {
    password_hash,
    email_enc,
    phone_enc,
    tg_phone_enc,
    google_email_enc,
    google_access_token_enc,
    verification_code,
    reset_code_enc,
    custom_photo_data,
    ...safeDoc
  } = doc;

  return {
    ...settings,
    ...safeDoc,
    id: uid,
    user_id: uid,
    platform_id: includePrivate || privacy.show_platform_id !== false ? platformId : '',
    platform_id_hidden: privacy.show_platform_id === false,
    telegram_id: includePrivate || privacy.show_telegram !== false ? telegramId : '',
    primary_bot_telegram_id: telegramId,
    telegram_linked: tgLinked,
    telegram_unlinked: tgUnlinked,
    tg_linked_at: String(doc.tg_linked_at || (tgLinked ? doc.joined_at || '' : '') || ''),
    tg_phone: includePrivate || privacy.show_telegram !== false ? tgPhone : '',
    tg_bio: tgBio,
    tg_birth_date: tgBirthDate,
    telegram_accounts: includePrivate
      ? tgAccountsList
      : privacy.show_telegram !== false
      ? tgAccountsList.filter((ta) => !(Array.isArray(privacy.hidden_tg_accounts) && privacy.hidden_tg_accounts.includes(ta.telegram_id)))
      : [],
    google_id: includePrivate || privacy.show_google ? googleId : '',
    google_linked: googleLinked,
    google_unlinked: googleUnlinked,
    google_linked_at: String(doc.google_linked_at || ''),
    google_email: includePrivate || privacy.show_google ? googleEmail : '',
    google_given_name: googleGivenName,
    google_family_name: googleFamilyName,
    google_name: googleName,
    google_photo_url: googlePhotoUrl,
    google_accounts: includePrivate
      ? rawGoogleAccounts
      : privacy.show_google
      ? rawGoogleAccounts.filter((ga) => !(Array.isArray(privacy.hidden_google_accounts) && privacy.hidden_google_accounts.includes(ga.google_id)))
      : [],
    field_sources: fieldSources,
    has_password: Boolean(password_hash),
    is_registered_account: Boolean(password_hash || doc.is_registered_account || googleLinked || tgLinked),
    contact_type: doc.contact_type || (effectivePhone && !effectiveEmail ? 'phone' : 'email'),
    email_source: emailSource,
    phone_source: phoneSource,
    custom_first_name: includePrivate ? customFirstName : '',
    custom_last_name: includePrivate ? customLastName : '',
    custom_email: includePrivate ? decryptedEmail : '',
    custom_phone: includePrivate ? decryptedPhone : '',
    custom_birth_date: includePrivate ? customBirthDate : '',
    custom_gender: includePrivate ? rawGender : '',
    email: includePrivate || privacy.show_email ? effectiveEmail : '',
    phone: includePrivate || privacy.show_phone ? effectivePhone : '',
    email_verified: emailVerified,
    phone_verified: phoneVerified,
    contact_verified: Boolean(doc.contact_verified || emailVerified || phoneVerified),
    birth_date: includePrivate || privacy.show_birth_date ? effectiveBirthDate : '',
    gender: includePrivate || privacy.show_gender !== false ? gender : '',
    bio_source: bioSource,
    custom_bio: includePrivate ? customBio : '',
    custom_bio_msg_id: doc.custom_bio_msg_id ? Number(doc.custom_bio_msg_id) : 0,
    bio: includePrivate || privacy.show_bio !== false ? effectiveBio : '',
    full_name: customName || effectiveDisplayName,
    custom_name: customName,
    tg_first_name: tgFirstName,
    tg_last_name: tgLastName,
    name_source: nameSource,
    display_name: effectiveDisplayName,
    name: effectiveDisplayName,
    first_name: resolvedFirst || tgFirstName || googleGivenName || effectiveDisplayName,
    last_name: resolvedLast || tgLastName || googleFamilyName || '',
    custom_username: customUsername,
    tg_username: tgUsername,
    username_source: usernameSource,
    username: includePrivate || privacy.show_username !== false ? effectiveUsername : '',
    photo_source: photoSource,
    has_custom_photo: Boolean(custom_photo_data || mainCustomFid || rawCustomPhotos.length > 0),
    custom_photo_file_id: mainCustomFid || (rawCustomPhotos[0]?.file_id || ''),
    custom_photos: includePrivate
      ? rawCustomPhotos
      : privacy.show_photos_custom !== false
      ? rawCustomPhotos.filter((cp) => !hiddenPhotoIds.includes(cp.file_id))
      : [],
    hidden_photo_ids: includePrivate ? hiddenPhotoIds : [],
    tg_photo_file_id: tgUnlinked ? '' : String(primaryTgAcc?.photo_file_id || doc.tg_photo_file_id || '').trim(),
    selected_tg_photo_file_id: tgUnlinked ? '' : String(doc.selected_tg_photo_file_id || '').trim(),
    photo_url: String(doc.photo_url || googlePhotoUrl || '').trim(),
    sessions: includePrivate ? sessionsList : [],
    blocked_devices: includePrivate ? blockedDevicesList : [],
    deletion_scheduled_at: deletionScheduledAt,
    deletion_execute_at: deletionExecuteAt,
    deletion_execute_ts: deletionExecuteTs,
    privacy,
    settings: {
      ...settings,
      name_source: nameSource,
      username_source: usernameSource,
      photo_source: photoSource,
      email_source: emailSource,
      phone_source: phoneSource,
      bio_source: bioSource,
      field_sources: fieldSources,
      gender,
      selected_tg_photo_file_id: tgUnlinked ? '' : String(doc.selected_tg_photo_file_id || '').trim(),
      privacy,
    },
  };
}

export function findUserRawByIdentifier(identifier: string): Record<string, any> | null {
  const key = String(identifier || '').trim().replace(/^@/, '');
  if (!key) return null;
  const direct = dbLoadDoc(USERS_COL, key);
  const all = dbLoadCollection(USERS_COL);

  if (direct) {
    if (!direct.password_hash && !direct.is_registered_account && /^\d{5,}$/.test(key)) {
      for (const u of Object.values(all)) {
        if (u.id !== key && !u.telegram_unlinked && (u.password_hash || u.is_registered_account)) {
          if (String(u.telegram_id || '') === key) return u;
          if (Array.isArray(u.telegram_accounts) && u.telegram_accounts.some((ta: any) => String(ta.telegram_id || ta.id || '') === key)) {
            return u;
          }
        }
      }
    }
    return direct;
  }

  const lower = key.toLowerCase();
  const normalizedPid = lower.replace(/^(01-|nk-)/i, '');
  const isPidFormat = /^(01-|nk-)[a-f0-9]{6,10}$/i.test(lower);
  const normalizedPhone = key.replace(/[\s\-()]/g, '');
  for (const u of Object.values(all)) {
    const uEmail = decryptSensitive(u.email_enc || u.email || '').toLowerCase();
    const uGoogleEmail = decryptSensitive(u.google_email_enc || u.google_email || '').toLowerCase();
    const uPhone = decryptSensitive(u.phone_enc || u.phone || '').replace(/[\s\-()]/g, '');
    const uTgPhone = decryptSensitive(u.tg_phone_enc || u.tg_phone || '').replace(/[\s\-()]/g, '');
    const uPid = ensurePlatformId(u.id || '', u.platform_id).toLowerCase();
    const uPidHex = uPid.replace(/^(01-|nk-)/i, '');
    const inTgAccounts =
      !u.telegram_unlinked &&
      Array.isArray(u.telegram_accounts) &&
      u.telegram_accounts.some(
        (ta: any) =>
          String(ta.telegram_id || ta.id || '') === key ||
          (ta.username && String(ta.username).toLowerCase() === lower)
      );
    const inGoogleAccounts =
      !u.google_unlinked &&
      Array.isArray(u.google_accounts) &&
      u.google_accounts.some(
        (ga: any) =>
          String(ga.sub || ga.google_id || '') === key ||
          (ga.email && String(ga.email).toLowerCase() === lower)
      );
    if (
      String(u.id || '') === key ||
      (!u.telegram_unlinked && String(u.telegram_id || '') === key) ||
      inTgAccounts ||
      (!u.google_unlinked && String(u.google_id || '') === key) ||
      inGoogleAccounts ||
      uPid === lower ||
      (isPidFormat && uPidHex === normalizedPid) ||
      (uEmail && uEmail === lower) ||
      (!u.google_unlinked && uGoogleEmail && uGoogleEmail === lower) ||
      (uPhone && normalizedPhone.length >= 6 && uPhone === normalizedPhone) ||
      (!u.telegram_unlinked && uTgPhone && normalizedPhone.length >= 6 && uTgPhone === normalizedPhone) ||
      (u.custom_username && String(u.custom_username).trim().toLowerCase() === lower) ||
      (!u.telegram_unlinked && u.tg_username && String(u.tg_username).trim().toLowerCase() === lower) ||
      (u.username && String(u.username).trim().toLowerCase() === lower)
    ) {
      return u;
    }
  }
  return null;
}

export function getRawUserPhotoData(userId: string): { mime: string; buffer: Buffer } | null {
  const doc = findUserRawByIdentifier(userId);
  if (!doc || !doc.custom_photo_data) return null;
  const dataUrl = String(doc.custom_photo_data);
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  try {
    return {
      mime: match[1],
      buffer: Buffer.from(match[2], 'base64'),
    };
  } catch {
    return null;
  }
}

export function registerOrUpdateUser(
  userId: string,
  name = '',
  username = '',
  photoUrl = '',
  extra?: Record<string, any>
): Record<string, any> {
  const rawUid = String(userId || '').trim();
  if (!rawUid) return {};
  const existingMatch = findUserRawByIdentifier(rawUid);
  const uid = existingMatch?.id ? String(existingMatch.id) : rawUid;
  const existing = existingMatch || dbLoadDoc(USERS_COL, uid) || {};
  const isNumericTg = /^\d{5,}$/.test(rawUid);
  const nowIso = new Date().toISOString();
  const nowTs = Math.floor(Date.now() / 1000);
  const safeExtra = { ...(extra || {}) };
  if (existing.language && safeExtra.language) {
    delete safeExtra.language;
  }

  const tgUnlinked = Boolean(existing.telegram_unlinked && !safeExtra.telegram_id);
  const cleanUsername = username ? String(username).replace(/^@/, '').trim() : '';
  const tgFirstName =
    isNumericTg && !tgUnlinked
      ? String(safeExtra.first_name || name || existing.tg_first_name || existing.first_name || '').trim()
      : String(existing.tg_first_name || '').trim();
  const tgLastName =
    isNumericTg && !tgUnlinked
      ? String(safeExtra.last_name ?? existing.tg_last_name ?? existing.last_name ?? '').trim()
      : String(existing.tg_last_name || '').trim();
  const tgUsername =
    isNumericTg && !tgUnlinked
      ? cleanUsername || String(existing.tg_username || existing.username || '').replace(/^@/, '')
      : String(existing.tg_username || '').replace(/^@/, '');

  const customName = String(
    safeExtra.custom_name ??
      safeExtra.full_name ??
      existing.custom_name ??
      existing.full_name ??
      (!isNumericTg ? name : '') ??
      existing.display_name ??
      ''
  ).trim();

  const customUsername = String(
    safeExtra.custom_username ??
      existing.custom_username ??
      (!isNumericTg ? cleanUsername : '') ??
      ''
  )
    .replace(/^@/, '')
    .trim();

  const platformId = ensurePlatformId(uid, existing.platform_id);
  const telegramId = tgUnlinked
    ? ''
    : String(existing.telegram_id || safeExtra.telegram_id || (isNumericTg ? rawUid : '') || '').trim();

  const updated: Record<string, any> = {
    ...existing,
    ...safeExtra,
    id: uid,
    user_id: uid,
    platform_id: platformId,
    telegram_id: telegramId,
    telegram_unlinked: tgUnlinked,
    tg_first_name: tgUnlinked ? '' : tgFirstName || existing.tg_first_name || '',
    tg_last_name: tgUnlinked ? '' : tgLastName || existing.tg_last_name || '',
    tg_username: tgUnlinked ? '' : tgUsername || existing.tg_username || '',
    custom_name: customName || existing.custom_name || '',
    full_name: customName || existing.full_name || tgFirstName || '',
    custom_username: customUsername || existing.custom_username || '',
    first_name: tgFirstName || customName || name || existing.first_name || (uid === OWNER_ID ? 'المالك' : `مستخدم ${platformId}`),
    display_name: safeExtra.display_name || existing.display_name || customName || tgFirstName || name || (uid === OWNER_ID ? 'المالك' : `مستخدم ${platformId}`),
    name: customName || name || existing.name || tgFirstName || (uid === OWNER_ID ? 'المالك' : `مستخدم ${platformId}`),
    username: customUsername || tgUsername || existing.username || '',
    photo_url: photoUrl || existing.photo_url || '',
    name_source: safeExtra.name_source || existing.name_source || existing.settings?.name_source || (existing.custom_name ? 'custom' : 'telegram'),
    username_source: safeExtra.username_source || existing.username_source || existing.settings?.username_source || (existing.custom_username ? 'custom' : 'telegram'),
    photo_source: safeExtra.photo_source || existing.photo_source || existing.settings?.photo_source || ((existing.custom_photo_data || existing.custom_photo_file_id) ? 'custom' : 'telegram'),
    joined_at: existing.joined_at || existing.first_seen || nowIso,
    last_active: nowIso,
    last_seen: nowBaghdadStr(),
    last_active_ts: nowTs,
    activity_count: (Number(existing.activity_count) || 0) + 1,
    banned: Boolean(existing.banned),
    privacy: {
      ...DEFAULT_USER_PRIVACY,
      ...(existing.settings?.privacy || {}),
      ...(existing.privacy || {}),
      ...(safeExtra.privacy || {}),
    },
    settings: existing.settings || {},
    stats: existing.stats || {
      downloads: 0,
      quiz_correct: 0,
      messages_sent: 0,
      quiz_answered: 0,
      ratings_given: 0,
    },
    admin_stats: existing.admin_stats || {
      files_deleted: 0,
      groups_linked: 0,
      files_uploaded: 0,
      folders_created: 0,
      folders_deleted: 0,
      questions_added: 0,
    },
  };
  dbSaveDoc(USERS_COL, uid, updated);
  return normalizeUserRecord(updated, true);
}

export function getUser(userId: string): Record<string, any> | null {
  const uid = String(userId || '').trim();
  if (!uid) return null;
  const doc = findUserRawByIdentifier(uid);
  if (!doc) return null;
  const expectedPid = ensurePlatformId(doc.id || uid, doc.platform_id);
  if (doc.platform_id !== expectedPid) {
    doc.platform_id = expectedPid;
    dbSaveDoc(USERS_COL, doc.id || uid, doc);
  }
  return normalizeUserRecord(doc, true);
}

export function getAllUsers(): Record<string, Record<string, any>> {
  const raw = dbLoadCollection(USERS_COL);
  const out: Record<string, Record<string, any>> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = normalizeUserRecord(v, false);
  }
  return out;
}

export function getActiveUsers(minutes = 5): Array<Record<string, any>> {
  const all = getAllUsers();
  const cutoff = Math.floor(Date.now() / 1000) - minutes * 60;
  return Object.values(all).filter((u) => (Number(u.last_active_ts) || 0) >= cutoff);
}

export function updateUserSettings(userId: string, settings: Record<string, any>): Record<string, any> {
  const uid = String(userId || '').trim();
  const matched = findUserRawByIdentifier(uid);
  const targetId = matched?.id ? String(matched.id) : uid;
  const existing = matched || { id: targetId, user_id: targetId, joined_at: new Date().toISOString() };

  const payload = { ...settings };
  if (payload.password && String(payload.password).trim().length >= 6) {
    existing.password_hash = hashPassword(String(payload.password).trim());
    existing.is_registered_account = true;
  }
  delete payload.password;
  delete payload.password_hash;

  if (payload.custom_username !== undefined) {
    payload.custom_username = String(payload.custom_username || '').trim().replace(/^@/, '');
  }
  if (payload.custom_first_name !== undefined) {
    existing.custom_first_name = String(payload.custom_first_name || '').trim();
  }
  if (payload.custom_last_name !== undefined) {
    existing.custom_last_name = String(payload.custom_last_name || '').trim();
  }
  if (payload.custom_first_name !== undefined || payload.custom_last_name !== undefined) {
    const combinedCustom = [existing.custom_first_name || '', existing.custom_last_name || ''].filter(Boolean).join(' ').trim();
    if (combinedCustom) {
      existing.custom_name = combinedCustom;
      existing.full_name = combinedCustom;
    }
  }
  if (payload.field_sources && typeof payload.field_sources === 'object') {
    existing.field_sources = {
      ...(existing.field_sources || {}),
      ...payload.field_sources,
    };
  }
  if (payload.primary_bot_telegram_id !== undefined) {
    const pTgId = String(payload.primary_bot_telegram_id || '').trim();
    existing.primary_bot_telegram_id = pTgId;
    if (Array.isArray(existing.telegram_accounts)) {
      existing.telegram_accounts = existing.telegram_accounts.map((a: any) => ({
        ...a,
        is_primary_bot: String(a.id || '') === pTgId,
      }));
    }
  }
  if (payload.email_source === 'google' || payload.email_source === 'custom' || String(payload.email_source || '').startsWith('google:')) {
    existing.email_source = payload.email_source;
  }
  if (payload.phone_source === 'telegram' || payload.phone_source === 'custom' || String(payload.phone_source || '').startsWith('telegram:') || String(payload.phone_source || '').startsWith('google:')) {
    existing.phone_source = payload.phone_source;
  }
  if (payload.bio_source === 'telegram' || payload.bio_source === 'custom' || String(payload.bio_source || '').startsWith('telegram:')) {
    existing.bio_source = payload.bio_source;
  }
  if (payload.gender !== undefined) {
    const g = String(payload.gender || '').trim().toLowerCase();
    existing.gender = g === 'male' || g === 'female' ? g : '';
    existing.custom_gender = existing.gender;
  }
  if (payload.custom_gender !== undefined) {
    const g = String(payload.custom_gender || '').trim().toLowerCase();
    existing.custom_gender = g === 'male' || g === 'female' ? g : '';
    existing.gender = existing.custom_gender;
  }
  if (payload.custom_bio !== undefined) {
    existing.custom_bio = String(payload.custom_bio || '').trim();
  }
  if (payload.custom_bio_msg_id !== undefined) {
    existing.custom_bio_msg_id = Number(payload.custom_bio_msg_id) || 0;
  }
  if (payload.custom_bio_chat_id !== undefined) {
    existing.custom_bio_chat_id = String(payload.custom_bio_chat_id || '').trim();
  }
  if (payload.tg_bio !== undefined) {
    existing.tg_bio = String(payload.tg_bio || '').trim();
  }

  let contactChanged = false;
  if (payload.email !== undefined) {
    const cleanEmail = String(payload.email || '').trim().toLowerCase();
    const currentEmail = decryptSensitive(existing.email_enc || existing.email || '').toLowerCase();
    const linkedGoogleEmail = decryptSensitive(existing.google_email_enc || existing.google_email || '').toLowerCase();
    if (cleanEmail !== currentEmail) {
      existing.email_enc = cleanEmail ? encryptSensitive(cleanEmail) : '';
      if (cleanEmail && linkedGoogleEmail && !existing.google_unlinked && cleanEmail === linkedGoogleEmail) {
        existing.email_verified = true;
        existing.contact_verified = true;
      } else {
        existing.email_verified = false;
        contactChanged = true;
      }
    }
    delete existing.email;
    delete payload.email;
  }
  if (payload.clear_phone === true) {
    existing.phone_enc = '';
    delete existing.phone;
    if (existing.phone_source === 'custom') {
      existing.phone_verified = false;
    }
    delete payload.clear_phone;
    delete payload.phone;
  } else if (payload.phone !== undefined) {
    const cleanPhone = String(payload.phone || '').trim();
    const currentPhone = decryptSensitive(existing.phone_enc || existing.phone || '').trim();
    const linkedTgPhone = decryptSensitive(existing.tg_phone_enc || existing.tg_phone || '').trim();
    if (!cleanPhone) {
      existing.phone_enc = '';
      delete existing.phone;
      existing.phone_verified = false;
    } else if (cleanPhone !== currentPhone) {
      existing.phone_enc = encryptSensitive(cleanPhone);
      const normClean = cleanPhone.replace(/[\s\-()+]/g, '');
      const normTg = linkedTgPhone.replace(/[\s\-()+]/g, '');
      if (normClean && normTg && !existing.telegram_unlinked && normClean === normTg) {
        existing.phone_verified = true;
        existing.contact_verified = true;
      } else {
        existing.phone_verified = false;
        contactChanged = true;
      }
    }
    delete existing.phone;
    delete payload.phone;
  }
  if (contactChanged) {
    const vcode = String(Math.floor(100000 + Math.random() * 900000));
    existing.verification_code = encryptSensitive(vcode);
  }
  if (payload.birth_date !== undefined) {
    existing.birth_date = String(payload.birth_date || '').trim();
    existing.custom_birth_date = existing.birth_date;
  }
  if (payload.custom_birth_date !== undefined) {
    existing.custom_birth_date = String(payload.custom_birth_date || '').trim();
    existing.birth_date = existing.custom_birth_date;
  }
  if (payload.selected_tg_photo_file_id !== undefined) {
    existing.selected_tg_photo_file_id = String(payload.selected_tg_photo_file_id || '').trim();
  }

  // Maintain custom_photos gallery automatically whenever custom_photo_file_id is set
  const existingCustomPhotos: Array<{ id: string; file_id: string; added_at: string }> = Array.isArray(existing.custom_photos)
    ? [...existing.custom_photos]
    : [];
  if (existing.custom_photo_file_id && !existingCustomPhotos.some((p) => p.file_id === existing.custom_photo_file_id)) {
    existingCustomPhotos.unshift({
      id: `cp_${existing.custom_photo_file_id.slice(-10)}`,
      file_id: String(existing.custom_photo_file_id),
      added_at: existing.joined_at || new Date().toISOString(),
    });
  }
  if (payload.custom_photo_file_id) {
    const newFid = String(payload.custom_photo_file_id).trim();
    if (newFid && !existingCustomPhotos.some((p) => p.file_id === newFid)) {
      existingCustomPhotos.unshift({
        id: `cp_${Date.now()}_${newFid.slice(-6)}`,
        file_id: newFid,
        added_at: new Date().toISOString(),
      });
    }
  }
  if (Array.isArray(payload.custom_photos)) {
    existing.custom_photos = payload.custom_photos;
    delete payload.custom_photos;
  } else {
    existing.custom_photos = existingCustomPhotos;
  }

  if (Array.isArray(payload.hidden_photo_ids)) {
    existing.hidden_photo_ids = payload.hidden_photo_ids.map((x: any) => String(x || '').trim()).filter(Boolean);
    delete payload.hidden_photo_ids;
  }

  if (payload.privacy && typeof payload.privacy === 'object') {
    existing.privacy = {
      ...DEFAULT_USER_PRIVACY,
      ...(existing.settings?.privacy || {}),
      ...(existing.privacy || {}),
      ...payload.privacy,
    };
  }
  if (payload.custom_name !== undefined) {
    const rawCn = String(payload.custom_name || '').trim();
    if (rawCn) {
      existing.custom_name = rawCn;
      existing.full_name = rawCn;
    }
  } else if (payload.display_name !== undefined && String(payload.display_name).trim()) {
    const rawDn = String(payload.display_name).trim();
    if (rawDn) {
      existing.custom_name = rawDn;
      existing.full_name = rawDn;
    }
  }
  if (payload.custom_username !== undefined) {
    const rawCu = String(payload.custom_username || '').trim().replace(/^@/, '');
    if (rawCu) {
      existing.custom_username = rawCu;
    }
  }

  // Also keep active linked Telegram account metadata in sync if tg_photo_file_id or tg_bio was updated
  if (Array.isArray(existing.telegram_accounts) && existing.telegram_accounts.length > 0) {
    const activeTgId = String(payload.target_telegram_id || existing.telegram_id || existing.telegram_accounts[0].id || '').trim();
    existing.telegram_accounts = existing.telegram_accounts.map((acc: any) => {
      if (String(acc.id || '') !== activeTgId) return acc;
      return {
        ...acc,
        first_name: payload.tg_first_name !== undefined ? payload.tg_first_name : acc.first_name,
        last_name: payload.tg_last_name !== undefined ? payload.tg_last_name : acc.last_name,
        username: payload.tg_username !== undefined ? payload.tg_username : acc.username,
        bio: payload.tg_bio !== undefined ? payload.tg_bio : acc.bio,
        birth_date: payload.tg_birth_date !== undefined ? payload.tg_birth_date : acc.birth_date,
        photo_file_id: payload.tg_photo_file_id !== undefined ? payload.tg_photo_file_id : acc.photo_file_id,
        personal_chat_title: payload.tg_personal_chat_title !== undefined ? payload.tg_personal_chat_title : acc.personal_chat_title,
        personal_chat_username: payload.tg_personal_chat_username !== undefined ? payload.tg_personal_chat_username : acc.personal_chat_username,
        personal_chat_id: payload.tg_personal_chat_id !== undefined ? payload.tg_personal_chat_id : acc.personal_chat_id,
        is_premium: payload.tg_is_premium !== undefined ? Boolean(payload.tg_is_premium) : acc.is_premium,
        language_code: payload.tg_language_code !== undefined ? payload.tg_language_code : acc.language_code,
        accent_color_id: payload.tg_accent_color_id !== undefined ? payload.tg_accent_color_id : acc.accent_color_id,
      };
    });
  }
  delete payload.target_telegram_id;

  const { custom_photo_data: incomingPhotoData, ...settingsWithoutPhotoData } = payload;
  if (incomingPhotoData !== undefined) {
    existing.custom_photo_data = incomingPhotoData;
  }

  Object.assign(existing, settingsWithoutPhotoData);
  existing.platform_id = ensurePlatformId(targetId, existing.platform_id);
  existing.settings = {
    ...(existing.settings || {}),
    ...settingsWithoutPhotoData,
    field_sources: existing.field_sources || {},
    email_source: existing.email_source || 'custom',
    phone_source: existing.phone_source || 'custom',
    bio_source: existing.bio_source || 'custom',
    gender: existing.gender || '',
    privacy: existing.privacy || DEFAULT_USER_PRIVACY,
  };
  delete existing.settings.custom_photo_data;
  existing.last_active = new Date().toISOString();
  dbSaveDoc(USERS_COL, targetId, existing);
  return normalizeUserRecord(existing, true);
}

export function manageUserCustomPhotos(
  userId: string,
  payload: {
    action: 'select' | 'reorder' | 'delete' | 'toggle_hide' | 'set_tab_visibility';
    file_id?: string;
    direction?: 'up' | 'down' | 'first';
    order?: string[];
    tab?: 'custom' | 'telegram' | 'google';
    visible?: boolean;
  }
): { ok: boolean; user?: Record<string, any>; error?: string } {
  const doc = findUserRawByIdentifier(userId);
  if (!doc) return { ok: false, error: 'الحساب غير موجود' };

  const customPhotos: Array<{ id: string; file_id: string; added_at: string }> = Array.isArray(doc.custom_photos)
    ? [...doc.custom_photos]
    : [];
  if (doc.custom_photo_file_id && !customPhotos.some((p) => p.file_id === doc.custom_photo_file_id)) {
    customPhotos.unshift({
      id: `cp_${String(doc.custom_photo_file_id).slice(-10)}`,
      file_id: String(doc.custom_photo_file_id),
      added_at: doc.joined_at || new Date().toISOString(),
    });
  }
  const hiddenIds = new Set<string>(
    Array.isArray(doc.hidden_photo_ids) ? doc.hidden_photo_ids.map((x: any) => String(x || '').trim()).filter(Boolean) : []
  );

  const act = payload.action;
  const fid = String(payload.file_id || '').trim();

  if (act === 'select' && fid) {
    const matched = customPhotos.find((p) => p.file_id === fid || p.id === fid);
    const resolvedFid = matched ? matched.file_id : fid;
    doc.custom_photo_file_id = resolvedFid;
    doc.photo_source = 'custom';
    doc.custom_photo_data = '';
    if (!doc.field_sources || typeof doc.field_sources !== 'object') doc.field_sources = {};
    doc.field_sources.photo = 'custom';
    if (doc.settings) {
      doc.settings.photo_source = 'custom';
      doc.settings.field_sources = doc.field_sources;
    }
  } else if (act === 'reorder') {
    if (fid && payload.direction) {
      const idx = customPhotos.findIndex((p) => p.file_id === fid || p.id === fid);
      if (idx !== -1) {
        if (payload.direction === 'up' && idx > 0) {
          const temp = customPhotos[idx - 1];
          customPhotos[idx - 1] = customPhotos[idx];
          customPhotos[idx] = temp;
        } else if (payload.direction === 'down' && idx < customPhotos.length - 1) {
          const temp = customPhotos[idx + 1];
          customPhotos[idx + 1] = customPhotos[idx];
          customPhotos[idx] = temp;
        } else if (payload.direction === 'first' && idx > 0) {
          const [item] = customPhotos.splice(idx, 1);
          customPhotos.unshift(item);
        }
      }
      doc.custom_photos = customPhotos;
    } else if (Array.isArray(payload.order)) {
      const orderSet = payload.order.map((x) => String(x || '').trim()).filter(Boolean);
      const byFid = new Map(customPhotos.map((p) => [p.file_id, p]));
      const reordered: Array<{ id: string; file_id: string; added_at: string }> = [];
      for (const oFid of orderSet) {
        const item = byFid.get(oFid);
        if (item) {
          reordered.push(item);
          byFid.delete(oFid);
        }
      }
      for (const rest of byFid.values()) {
        reordered.push(rest);
      }
      doc.custom_photos = reordered;
      if (reordered.length > 0 && !doc.custom_photo_file_id) {
        doc.custom_photo_file_id = reordered[0].file_id;
      }
    }
  } else if (act === 'delete' && fid) {
    const matched = customPhotos.find((p) => p.file_id === fid || p.id === fid);
    const resolvedFid = matched ? matched.file_id : fid;
    const filtered = customPhotos.filter((p) => p.file_id !== fid && p.id !== fid);
    doc.custom_photos = filtered;
    hiddenIds.delete(fid);
    hiddenIds.delete(resolvedFid);
    if (doc.custom_photo_file_id === fid || doc.custom_photo_file_id === resolvedFid) {
      doc.custom_photo_file_id = filtered[0]?.file_id || '';
      doc.custom_photo_data = '';
    }
  } else if (act === 'toggle_hide' && fid) {
    const matched = customPhotos.find((p) => p.file_id === fid || p.id === fid);
    const resolvedFid = matched ? matched.file_id : fid;
    if (hiddenIds.has(resolvedFid) || hiddenIds.has(fid)) {
      hiddenIds.delete(resolvedFid);
      hiddenIds.delete(fid);
    } else {
      hiddenIds.add(resolvedFid);
    }
    doc.hidden_photo_ids = Array.from(hiddenIds);
  } else if (act === 'set_tab_visibility' && payload.tab) {
    doc.privacy = {
      ...DEFAULT_USER_PRIVACY,
      ...(doc.settings?.privacy || {}),
      ...(doc.privacy || {}),
    };
    const key =
      payload.tab === 'custom'
        ? 'show_photos_custom'
        : payload.tab === 'telegram'
        ? 'show_photos_telegram'
        : 'show_photos_google';
    doc.privacy[key] = payload.visible !== undefined ? Boolean(payload.visible) : !doc.privacy[key];
    if (doc.settings) {
      doc.settings.privacy = doc.privacy;
    }
  }

  if (act !== 'reorder' && act !== 'delete') {
    doc.custom_photos = customPhotos;
  }
  doc.hidden_photo_ids = Array.from(hiddenIds);
  doc.last_active = new Date().toISOString();
  dbSaveDoc(USERS_COL, doc.id, doc);
  return { ok: true, user: normalizeUserRecord(doc, true) };
}

export function archiveUserTelegramPhotos(
  userId: string,
  livePhotos: Array<{ file_id: string; width?: number; height?: number; hash?: string }>
): Array<{ file_id: string; width?: number; height?: number; hash?: string }> {
  const doc = findUserRawByIdentifier(userId);
  if (!doc) return livePhotos;
  const existingArchive: Array<{ file_id: string; width?: number; height?: number; hash?: string }> = Array.isArray(doc.tg_photos_archive)
    ? doc.tg_photos_archive
    : [];
  const seenHashes = new Set<string>();
  const seenFids = new Set<string>();
  const merged: Array<{ file_id: string; width?: number; height?: number; hash?: string }> = [];

  for (const p of [...livePhotos, ...existingArchive]) {
    if (!p || !p.file_id) continue;
    if (seenFids.has(p.file_id)) continue;
    if (p.hash && seenHashes.has(p.hash)) continue;
    seenFids.add(p.file_id);
    if (p.hash) seenHashes.add(p.hash);
    merged.push({
      file_id: p.file_id,
      width: p.width || 0,
      height: p.height || 0,
      hash: p.hash || '',
    });
  }
  doc.tg_photos_archive = merged.slice(0, 40);
  dbSaveDoc(USERS_COL, doc.id, doc);
  return doc.tg_photos_archive;
}

export function registerPlatformAccount(input: {
  full_name: string;
  username: string;
  contact_type?: 'email' | 'phone';
  email?: string;
  phone?: string;
  birth_date?: string;
  password: string;
}): { ok: boolean; user?: Record<string, any>; verification_code?: string; error?: string } {
  const fullName = String(input.full_name || '').trim();
  const rawUsername = String(input.username || '').trim().replace(/^@/, '');
  const contactType: 'email' | 'phone' = input.contact_type === 'phone' ? 'phone' : 'email';
  const email = String(input.email || '').trim().toLowerCase();
  const phone = String(input.phone || '').trim();
  const normalizedPhone = phone.replace(/[\s\-()]/g, '');
  const birthDate = String(input.birth_date || '').trim();
  const password = String(input.password || '');

  if (!fullName) return { ok: false, error: 'الاسم الكامل مطلوب' };
  if (!rawUsername || rawUsername.length < 3) return { ok: false, error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' };
  if (!/^[a-zA-Z0-9_.\u0600-\u06FF]+$/.test(rawUsername)) {
    return { ok: false, error: 'اسم المستخدم يحتوي على رموز غير مسموحة' };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'البريد الإلكتروني غير صالح' };
  }
  if (normalizedPhone && !/^\+?\d{7,15}$/.test(normalizedPhone)) {
    return { ok: false, error: 'رقم الهاتف غير صالح (أدخل الرقم مع مفتاح الدولة مثل +964...)' };
  }
  if (!password || password.length < 6) {
    return { ok: false, error: 'كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل' };
  }

  const allRaw = dbLoadCollection(USERS_COL);
  for (const u of Object.values(allRaw)) {
    const uEmail = decryptSensitive(u.email_enc || u.email || '').toLowerCase();
    const uPhone = decryptSensitive(u.phone_enc || u.phone || '').replace(/[\s\-()]/g, '');
    if (email && uEmail === email) {
      return { ok: false, error: 'البريد الإلكتروني مسجل مسبقاً في حساب آخر' };
    }
    if (normalizedPhone && uPhone === normalizedPhone) {
      return { ok: false, error: 'رقم الهاتف مسجل مسبقاً في حساب آخر' };
    }
    if (u.custom_username && String(u.custom_username).trim().toLowerCase() === rawUsername.toLowerCase()) {
      return { ok: false, error: 'اسم المستخدم محجوز مسبقاً، اختر اسماً آخر' };
    }
  }

  const uid = `usr_${genId(10)}`;
  const platformId = ensurePlatformId(uid);
  const nowIso = new Date().toISOString();
  const nowTs = Math.floor(Date.now() / 1000);
  const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
  const nameParts = fullName.split(/\s+/);
  const customFirstName = nameParts[0] || fullName;
  const customLastName = nameParts.slice(1).join(' ');

  const doc: Record<string, any> = {
    id: uid,
    user_id: uid,
    platform_id: platformId,
    telegram_id: '',
    telegram_unlinked: false,
    telegram_accounts: [],
    google_id: '',
    google_unlinked: false,
    google_accounts: [],
    is_registered_account: true,
    contact_type: contactType,
    full_name: fullName,
    custom_name: fullName,
    custom_first_name: customFirstName,
    custom_last_name: customLastName,
    display_name: fullName,
    name: fullName,
    first_name: customFirstName,
    last_name: customLastName,
    tg_first_name: '',
    tg_last_name: '',
    tg_username: '',
    custom_username: rawUsername,
    username: rawUsername,
    email_enc: email ? encryptSensitive(email) : '',
    phone_enc: normalizedPhone ? encryptSensitive(normalizedPhone) : '',
    email_verified: false,
    phone_verified: false,
    verification_code: encryptSensitive(verificationCode),
    birth_date: birthDate,
    custom_birth_date: birthDate,
    password_hash: hashPassword(password),
    name_source: 'custom',
    username_source: 'custom',
    photo_source: 'custom',
    field_sources: {
      first_name: 'custom',
      last_name: 'custom',
      username: 'custom',
      phone: 'custom',
      email: 'custom',
      bio: 'custom',
      birth_date: 'custom',
      gender: 'custom',
      photo: 'custom',
    },
    photo_url: '',
    privacy: { ...DEFAULT_USER_PRIVACY },
    joined_at: nowIso,
    last_active: nowIso,
    last_seen: nowBaghdadStr(),
    last_active_ts: nowTs,
    activity_count: 1,
    banned: false,
    sessions: [],
    blocked_devices: [],
    settings: {
      name_source: 'custom',
      username_source: 'custom',
      photo_source: 'custom',
      privacy: { ...DEFAULT_USER_PRIVACY },
    },
    stats: {
      downloads: 0,
      quiz_correct: 0,
      messages_sent: 0,
      quiz_answered: 0,
      ratings_given: 0,
    },
    admin_stats: {
      files_deleted: 0,
      groups_linked: 0,
      files_uploaded: 0,
      folders_created: 0,
      folders_deleted: 0,
      questions_added: 0,
    },
  };

  dbSaveDoc(USERS_COL, uid, doc);
  return { ok: true, user: normalizeUserRecord(doc, true), verification_code: verificationCode };
}

export function verifyUserContactCode(
  userId: string,
  code: string
): { ok: boolean; user?: Record<string, any>; error?: string } {
  const doc = findUserRawByIdentifier(userId);
  if (!doc) return { ok: false, error: 'الحساب غير موجود' };
  const expected = decryptSensitive(doc.verification_code || '');
  const cleanCode = String(code || '').trim();
  if (!cleanCode || !expected || cleanCode !== expected) {
    return { ok: false, error: 'رمز التأكيد غير صحيح' };
  }
  doc.email_verified = true;
  doc.contact_verified = true;
  doc.verification_code = '';
  dbSaveDoc(USERS_COL, doc.id, doc);
  return { ok: true, user: normalizeUserRecord(doc, true) };
}

export const verifyUserEmailCode = verifyUserContactCode;

export function regenerateVerificationCode(
  userId: string,
  newEmail?: string
): {
  ok: boolean;
  code?: string;
  email?: string;
  phone?: string;
  telegram_id?: string;
  auto_verified?: boolean;
  user?: Record<string, any>;
  error?: string;
} {
  const doc = findUserRawByIdentifier(userId);
  if (!doc) return { ok: false, error: 'الحساب غير موجود' };
  const incomingEmail = String(newEmail || '').trim().toLowerCase();
  if (incomingEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(incomingEmail)) {
    doc.email_enc = encryptSensitive(incomingEmail);
    doc.custom_email = incomingEmail;
    delete doc.email;
  }
  const currentEmail = decryptSensitive(doc.email_enc || doc.email || '').trim().toLowerCase();
  if (!currentEmail) {
    return { ok: false, error: 'يرجى إدخال عنوان بريد إلكتروني صالح أولاً' };
  }
  // Check if this email matches any linked Google account email -> auto-verify
  const googleEmailPrimary = doc.google_unlinked ? '' : decryptSensitive(doc.google_email_enc || doc.google_email || '').trim().toLowerCase();
  const googleAccountsList: Array<Record<string, any>> = (!doc.google_unlinked && Array.isArray(doc.google_accounts)) ? doc.google_accounts : [];
  const matchesGoogle =
    (googleEmailPrimary && googleEmailPrimary === currentEmail) ||
    googleAccountsList.some((ga) => String(ga?.email || '').trim().toLowerCase() === currentEmail);
  if (matchesGoogle) {
    doc.email_verified = true;
    doc.contact_verified = true;
    doc.verification_code = '';
    dbSaveDoc(USERS_COL, doc.id, doc);
    return {
      ok: true,
      auto_verified: true,
      email: currentEmail,
      user: normalizeUserRecord(doc, true),
    };
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  doc.verification_code = encryptSensitive(code);
  dbSaveDoc(USERS_COL, doc.id, doc);
  return {
    ok: true,
    code,
    email: currentEmail,
    phone: decryptSensitive(doc.phone_enc || doc.phone || ''),
    telegram_id: doc.telegram_unlinked ? '' : String(doc.primary_bot_telegram_id || doc.telegram_id || ''),
    user: normalizeUserRecord(doc, true),
  };
}

export function authenticatePlatformAccount(
  identifier: string,
  password: string
): { ok: boolean; user?: Record<string, any>; error?: string } {
  const key = String(identifier || '').trim();
  if (!key || !password) {
    return { ok: false, error: 'أدخل اسم المستخدم/البريد/الهاتف وكلمة المرور' };
  }
  const doc = findUserRawByIdentifier(key);
  if (!doc || !doc.password_hash) {
    return { ok: false, error: 'بيانات الدخول غير صحيحة أو الحساب غير مسجل بكلمة مرور' };
  }
  if (!verifyPassword(password, doc.password_hash)) {
    return { ok: false, error: 'كلمة المرور غير صحيحة' };
  }
  if (doc.banned) {
    return { ok: false, error: 'هذا الحساب محظور من المنصة' };
  }
  doc.last_active = new Date().toISOString();
  doc.last_seen = nowBaghdadStr();
  doc.last_active_ts = Math.floor(Date.now() / 1000);
  doc.platform_id = ensurePlatformId(doc.id, doc.platform_id);
  dbSaveDoc(USERS_COL, doc.id, doc);
  return { ok: true, user: normalizeUserRecord(doc, true) };
}

export function authenticateTelegramLoginOnly(
  tgIdInput: string
): { ok: boolean; user?: Record<string, any>; error?: string } {
  const tgId = String(tgIdInput || '').trim();
  if (!tgId) return { ok: false, error: 'معرف تلگرام غير صالح' };
  const all = dbLoadCollection(USERS_COL);
  let matchedDoc: Record<string, any> | null = null;
  for (const u of Object.values(all)) {
    if (u.telegram_unlinked) continue;
    const uTgId = String(u.telegram_id || (/^\d{5,}$/.test(String(u.id || '')) ? u.id : '') || '').trim();
    const inTgAccounts = Array.isArray(u.telegram_accounts) && u.telegram_accounts.some((a: any) => String(a.id || '').trim() === tgId);
    if ((uTgId === tgId || inTgAccounts) && (u.password_hash || u.is_registered_account || u.id === OWNER_ID)) {
      matchedDoc = u;
      break;
    }
  }
  if (!matchedDoc) {
    return {
      ok: false,
      error: 'لا يوجد حساب مسجل في المنصة مرتبط بحساب تلگرام هذا. يرجى إنشاء حساب أولاً ثم ربطه بتلگرام من الإعدادات.',
    };
  }
  if (matchedDoc.banned) {
    return { ok: false, error: 'هذا الحساب محظور من المنصة' };
  }
  matchedDoc.last_active = new Date().toISOString();
  matchedDoc.last_seen = nowBaghdadStr();
  matchedDoc.last_active_ts = Math.floor(Date.now() / 1000);
  matchedDoc.platform_id = ensurePlatformId(matchedDoc.id, matchedDoc.platform_id);
  dbSaveDoc(USERS_COL, matchedDoc.id, matchedDoc);
  return { ok: true, user: normalizeUserRecord(matchedDoc, true) };
}

export function linkTelegramAccount(
  currentUserId: string,
  tgData: {
    id: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    phone_number?: string;
    bio?: string;
    birth_date?: string;
  }
): { ok: boolean; user?: Record<string, any>; error?: string } {
  const tgId = String(tgData?.id || '').trim();
  if (!tgId) return { ok: false, error: 'معرف تلگرام غير صالح' };

  const currentDoc = currentUserId ? findUserRawByIdentifier(currentUserId) : null;
  if (!currentDoc) {
    return { ok: false, error: 'يرجى إنشاء حساب وتسجيل الدخول أولاً قبل ربط تلگرام' };
  }

  // Enforce strict cross-account uniqueness: a Telegram account can ONLY be linked to ONE 01 platform account at a time
  const all = dbLoadCollection(USERS_COL);
  let existingTgDoc: Record<string, any> | null = null;
  for (const u of Object.values(all)) {
    if (u.id === currentDoc.id) continue;
    const uPrimaryTg = !u.telegram_unlinked && (String(u.telegram_id || '') === tgId || String(u.id || '') === tgId);
    const uMultiTg = !u.telegram_unlinked && Array.isArray(u.telegram_accounts) && u.telegram_accounts.some((a: any) => String(a.id || '') === tgId);
    if (uPrimaryTg || uMultiTg) {
      if (u.password_hash || u.is_registered_account) {
        return {
          ok: false,
          error: 'حساب تلگرام هذا مرتبط بالفعل بحساب آخر في منصة (01). يجب إلغاء ربطه من الحساب الآخر أولاً قبل ربطه هنا.',
        };
      }
      existingTgDoc = u;
      break;
    }
  }

  const canonicalId =
    existingTgDoc?.id === tgId || tgId === OWNER_ID || dbLoadDoc(ADMINS_COL, tgId)
      ? tgId
      : currentDoc.id || existingTgDoc?.id || tgId;

  const mergedPlatformId = ensurePlatformId(
    canonicalId,
    currentDoc.platform_id || existingTgDoc?.platform_id
  );

  const tgFirst = String(tgData.first_name || existingTgDoc?.tg_first_name || existingTgDoc?.first_name || '').trim();
  const tgLast = String(tgData.last_name || existingTgDoc?.tg_last_name || existingTgDoc?.last_name || '').trim();
  const tgUser = String(tgData.username || existingTgDoc?.tg_username || existingTgDoc?.username || '')
    .trim()
    .replace(/^@/, '');
  const tgPhoto = String(tgData.photo_url || existingTgDoc?.photo_url || '').trim();
  const tgBio = String(tgData.bio || existingTgDoc?.tg_bio || currentDoc.tg_bio || '').trim();
  const tgBirth = String(tgData.birth_date || existingTgDoc?.tg_birth_date || '').trim();
  const rawTgPhone = String(tgData.phone_number || '').trim();
  const formattedTgPhone = rawTgPhone
    ? rawTgPhone.startsWith('+')
      ? rawTgPhone
      : `+${rawTgPhone.replace(/^\+/, '')}`
    : decryptSensitive(existingTgDoc?.tg_phone_enc || '');

  // Maintain multi-Telegram accounts list on the user record
  const existingTgAccounts: Array<Record<string, any>> = Array.isArray(currentDoc.telegram_accounts)
    ? [...currentDoc.telegram_accounts]
    : [];
  if (
    existingTgAccounts.length === 0 &&
    !currentDoc.telegram_unlinked &&
    currentDoc.telegram_id &&
    String(currentDoc.telegram_id) !== tgId
  ) {
    existingTgAccounts.push({
      id: String(currentDoc.telegram_id),
      first_name: String(currentDoc.tg_first_name || ''),
      last_name: String(currentDoc.tg_last_name || ''),
      username: String(currentDoc.tg_username || ''),
      bio: String(currentDoc.tg_bio || ''),
      birth_date: String(currentDoc.tg_birth_date || ''),
      phone_enc: currentDoc.tg_phone_enc || '',
      phone_verified: Boolean(currentDoc.phone_verified),
      photo_file_id: String(currentDoc.tg_photo_file_id || ''),
      photo_url: String(currentDoc.photo_url || ''),
      linked_at: currentDoc.joined_at || new Date().toISOString(),
      is_primary_bot: true,
    });
  }

  const accIdx = existingTgAccounts.findIndex((a) => String(a.id || '') === tgId);
  const existingAccEntry = accIdx >= 0 ? existingTgAccounts[accIdx] : null;
  const isFirstTgAccount = existingTgAccounts.length === 0;
  const newAccEntry = {
    id: tgId,
    first_name: tgFirst || existingAccEntry?.first_name || '',
    last_name: tgLast || existingAccEntry?.last_name || '',
    username: tgUser || existingAccEntry?.username || '',
    bio: tgBio || existingAccEntry?.bio || '',
    birth_date: tgBirth || existingAccEntry?.birth_date || '',
    phone_enc: formattedTgPhone
      ? encryptSensitive(formattedTgPhone)
      : existingAccEntry?.phone_enc || '',
    phone_verified: Boolean(formattedTgPhone || existingAccEntry?.phone_verified),
    photo_file_id: String(existingAccEntry?.photo_file_id || existingTgDoc?.tg_photo_file_id || ''),
    photo_url: tgPhoto || existingAccEntry?.photo_url || '',
    personal_chat_title: String((tgData as any).personal_chat_title || existingAccEntry?.personal_chat_title || ''),
    personal_chat_username: String((tgData as any).personal_chat_username || existingAccEntry?.personal_chat_username || ''),
    personal_chat_id: String((tgData as any).personal_chat_id || existingAccEntry?.personal_chat_id || ''),
    is_premium: Boolean((tgData as any).is_premium || existingAccEntry?.is_premium),
    language_code: String((tgData as any).language_code || existingAccEntry?.language_code || ''),
    linked_at: existingAccEntry?.linked_at || new Date().toISOString(),
    is_primary_bot: existingAccEntry ? Boolean(existingAccEntry.is_primary_bot) : isFirstTgAccount,
  };

  if (accIdx >= 0) {
    existingTgAccounts[accIdx] = newAccEntry;
  } else {
    existingTgAccounts.push(newAccEntry);
  }
  if (!existingTgAccounts.some((a) => a.is_primary_bot) && existingTgAccounts.length > 0) {
    existingTgAccounts[0].is_primary_bot = true;
  }
  const primaryAcc = existingTgAccounts.find((a) => a.is_primary_bot) || existingTgAccounts[0];

  const currentPhone = decryptSensitive(currentDoc.phone_enc || existingTgDoc?.phone_enc || currentDoc.phone || '');
  const finalPhone = currentPhone || formattedTgPhone;
  const phoneVerified = Boolean(
    currentDoc.phone_verified ||
      (formattedTgPhone &&
        (!currentPhone ||
          currentPhone.replace(/[\s\-()+]/g, '') === formattedTgPhone.replace(/[\s\-()+]/g, '')))
  );

  const merged: Record<string, any> = {
    ...(existingTgDoc || {}),
    ...currentDoc,
    id: canonicalId,
    user_id: canonicalId,
    platform_id: mergedPlatformId,
    telegram_id: String(primaryAcc?.id || tgId),
    primary_bot_telegram_id: String(primaryAcc?.id || tgId),
    telegram_unlinked: false,
    telegram_accounts: existingTgAccounts,
    is_registered_account: true,
    tg_first_name: primaryAcc?.first_name || tgFirst,
    tg_last_name: primaryAcc?.last_name || tgLast,
    tg_username: primaryAcc?.username || tgUser,
    tg_bio: primaryAcc?.bio || tgBio,
    tg_phone_enc: primaryAcc?.phone_enc || (formattedTgPhone ? encryptSensitive(formattedTgPhone) : currentDoc.tg_phone_enc || ''),
    photo_url: tgPhoto || currentDoc.photo_url || existingTgDoc?.photo_url || '',
    custom_name: currentDoc.custom_name || existingTgDoc?.custom_name || currentDoc.full_name || '',
    full_name: currentDoc.full_name || existingTgDoc?.full_name || tgFirst || '',
    custom_username: currentDoc.custom_username || existingTgDoc?.custom_username || '',
    email_enc: currentDoc.email_enc || existingTgDoc?.email_enc || (currentDoc.email ? encryptSensitive(currentDoc.email) : ''),
    phone_enc: finalPhone ? encryptSensitive(finalPhone) : '',
    phone_source: currentDoc.phone_source || (formattedTgPhone && !currentPhone ? `telegram:${tgId}` : 'custom'),
    phone_verified: phoneVerified,
    birth_date: currentDoc.birth_date || existingTgDoc?.birth_date || '',
    password_hash: currentDoc.password_hash || existingTgDoc?.password_hash || '',
    custom_photo_data: currentDoc.custom_photo_data || existingTgDoc?.custom_photo_data || '',
    custom_photo_file_id: currentDoc.custom_photo_file_id || existingTgDoc?.custom_photo_file_id || '',
    name_source: currentDoc.name_source || 'custom',
    username_source: currentDoc.username_source || 'custom',
    photo_source: currentDoc.photo_source || (currentDoc.custom_photo_data || currentDoc.custom_photo_file_id ? 'custom' : 'telegram'),
    privacy: {
      ...DEFAULT_USER_PRIVACY,
      ...(existingTgDoc?.privacy || {}),
      ...(currentDoc.privacy || {}),
    },
    settings: {
      ...(existingTgDoc?.settings || {}),
      ...(currentDoc.settings || {}),
    },
    last_active: new Date().toISOString(),
    last_seen: nowBaghdadStr(),
    last_active_ts: Math.floor(Date.now() / 1000),
  };

  dbSaveDoc(USERS_COL, canonicalId, merged);

  if (currentDoc.id && currentDoc.id !== canonicalId) {
    dbDeleteDoc(USERS_COL, currentDoc.id);
  }
  if (existingTgDoc && existingTgDoc.id && existingTgDoc.id !== canonicalId) {
    dbDeleteDoc(USERS_COL, existingTgDoc.id);
  }

  return { ok: true, user: normalizeUserRecord(merged, true) };
}

export function switchPrimaryTelegramAccount(
  userId: string,
  targetTgId: string
): { ok: boolean; user?: Record<string, any>; error?: string } {
  const doc = findUserRawByIdentifier(userId);
  if (!doc) return { ok: false, error: 'الحساب غير موجود' };
  const cleanTgId = String(targetTgId || '').trim();
  const accounts: Array<Record<string, any>> = Array.isArray(doc.telegram_accounts) ? [...doc.telegram_accounts] : [];
  const found = accounts.find((a) => String(a.id || '') === cleanTgId);
  if (!found) {
    return { ok: false, error: 'حساب تلگرام المحدد غير موجود ضمن الحسابات المرتبطة' };
  }
  doc.telegram_accounts = accounts.map((a) => ({
    ...a,
    is_primary_bot: String(a.id || '') === cleanTgId,
  }));
  doc.telegram_id = cleanTgId;
  doc.primary_bot_telegram_id = cleanTgId;
  doc.telegram_unlinked = false;
  doc.tg_first_name = String(found.first_name || '');
  doc.tg_last_name = String(found.last_name || '');
  doc.tg_username = String(found.username || '');
  doc.tg_bio = String(found.bio || '');
  doc.tg_birth_date = String(found.birth_date || '');
  doc.tg_photo_file_id = String(found.photo_file_id || '');
  if (found.phone_enc) {
    doc.tg_phone_enc = found.phone_enc;
  }
  doc.last_active = new Date().toISOString();
  dbSaveDoc(USERS_COL, doc.id, doc);
  return { ok: true, user: normalizeUserRecord(doc, true) };
}

export function unlinkTelegramAccount(
  userId: string,
  targetTgId?: string
): { ok: boolean; user?: Record<string, any>; error?: string } {
  const currentDoc = findUserRawByIdentifier(userId);
  if (!currentDoc) {
    return { ok: false, error: 'الحساب غير موجود' };
  }
  const accounts: Array<Record<string, any>> = Array.isArray(currentDoc.telegram_accounts)
    ? [...currentDoc.telegram_accounts]
    : [];

  if (targetTgId && accounts.length > 1) {
    const remaining = accounts.filter((a) => String(a.id || '') !== String(targetTgId).trim());
    if (remaining.length > 0) {
      if (!remaining.some((a) => a.is_primary_bot)) {
        remaining[0].is_primary_bot = true;
      }
      const next = remaining.find((a) => a.is_primary_bot) || remaining[0];
      currentDoc.telegram_accounts = remaining;
      currentDoc.telegram_id = String(next.id || '');
      currentDoc.primary_bot_telegram_id = String(next.id || '');
      currentDoc.telegram_unlinked = false;
      currentDoc.tg_first_name = String(next.first_name || '');
      currentDoc.tg_last_name = String(next.last_name || '');
      currentDoc.tg_username = String(next.username || '');
      currentDoc.tg_bio = String(next.bio || '');
      currentDoc.tg_birth_date = String(next.birth_date || '');
      currentDoc.tg_photo_file_id = String(next.photo_file_id || '');
      currentDoc.tg_phone_enc = next.phone_enc || '';
      if (currentDoc.field_sources && typeof currentDoc.field_sources === 'object') {
        for (const [k, v] of Object.entries(currentDoc.field_sources)) {
          if (v === `telegram:${targetTgId}`) {
            currentDoc.field_sources[k] = `telegram:${next.id}`;
          }
        }
      }
      currentDoc.last_active = new Date().toISOString();
      dbSaveDoc(USERS_COL, currentDoc.id, currentDoc);
      return { ok: true, user: normalizeUserRecord(currentDoc, true) };
    }
  }

  currentDoc.telegram_unlinked = true;
  currentDoc.telegram_id = '';
  currentDoc.primary_bot_telegram_id = '';
  currentDoc.telegram_accounts = [];
  currentDoc.tg_first_name = '';
  currentDoc.tg_last_name = '';
  currentDoc.tg_username = '';
  currentDoc.tg_bio = '';
  currentDoc.tg_phone_enc = '';
  currentDoc.tg_phone = '';
  currentDoc.tg_photo_file_id = '';
  if (currentDoc.name_source === 'telegram') {
    currentDoc.name_source = 'custom';
  }
  if (currentDoc.username_source === 'telegram') {
    currentDoc.username_source = 'custom';
  }
  if (String(currentDoc.phone_source || '').startsWith('telegram')) {
    currentDoc.phone_source = 'custom';
  }
  if (String(currentDoc.bio_source || '').startsWith('telegram')) {
    currentDoc.bio_source = 'custom';
  }
  if (String(currentDoc.photo_source || '').startsWith('telegram')) {
    currentDoc.photo_source = currentDoc.google_id && !currentDoc.google_unlinked ? 'google' : 'custom';
  }
  if (currentDoc.field_sources && typeof currentDoc.field_sources === 'object') {
    for (const [k, v] of Object.entries(currentDoc.field_sources)) {
      if (String(v || '').startsWith('telegram')) {
        currentDoc.field_sources[k] = 'custom';
      }
    }
  }
  if (currentDoc.settings) {
    currentDoc.settings.name_source = currentDoc.name_source;
    currentDoc.settings.username_source = currentDoc.username_source;
    currentDoc.settings.photo_source = currentDoc.photo_source;
    currentDoc.settings.phone_source = currentDoc.phone_source;
    currentDoc.settings.bio_source = currentDoc.bio_source;
  }
  currentDoc.last_active = new Date().toISOString();
  dbSaveDoc(USERS_COL, currentDoc.id, currentDoc);
  return { ok: true, user: normalizeUserRecord(currentDoc, true) };
}

export function verifyTelegramPhoneContact(
  telegramUserId: string,
  rawPhoneNumber: string
): { ok: boolean; user?: Record<string, any>; phone?: string; error?: string } {
  const tgId = String(telegramUserId || '').trim();
  const cleanDigits = String(rawPhoneNumber || '').replace(/[^\d+]/g, '');
  if (!tgId || !cleanDigits) {
    return { ok: false, error: 'بيانات رقم الهاتف غير مكتملة' };
  }
  const formattedPhone = cleanDigits.startsWith('+') ? cleanDigits : `+${cleanDigits}`;
  const all = dbLoadCollection(USERS_COL);
  let targetDoc: Record<string, any> | null = null;
  for (const u of Object.values(all)) {
    if (u.telegram_unlinked) continue;
    const uTgId = String(u.telegram_id || (/^\d{5,}$/.test(String(u.id || '')) ? u.id : '') || '').trim();
    const inAccounts = Array.isArray(u.telegram_accounts) && u.telegram_accounts.some((a: any) => String(a.id || '').trim() === tgId);
    if (uTgId === tgId || inAccounts) {
      targetDoc = u;
      break;
    }
  }
  if (!targetDoc) {
    targetDoc = findUserRawByIdentifier(tgId);
  }
  if (!targetDoc) {
    return { ok: false, error: 'لم يتم العثور على حساب مرتبط بمعرف تلگرام هذا' };
  }
  targetDoc.tg_phone_enc = encryptSensitive(formattedPhone);
  if (Array.isArray(targetDoc.telegram_accounts)) {
    targetDoc.telegram_accounts = targetDoc.telegram_accounts.map((a: any) =>
      String(a.id || '').trim() === tgId
        ? { ...a, phone_enc: encryptSensitive(formattedPhone), phone_verified: true }
        : a
    );
  }
  const existingCustomPhone = decryptSensitive(targetDoc.phone_enc || targetDoc.phone || '');
  if (!existingCustomPhone || existingCustomPhone.replace(/[\s\-()+]/g, '') === formattedPhone.replace(/[\s\-()+]/g, '')) {
    targetDoc.phone_enc = encryptSensitive(formattedPhone);
    targetDoc.phone_source = targetDoc.phone_source || `telegram:${tgId}`;
    targetDoc.phone_verified = true;
    if (!targetDoc.field_sources || typeof targetDoc.field_sources !== 'object') {
      targetDoc.field_sources = {};
    }
    if (!targetDoc.field_sources.phone || targetDoc.field_sources.phone === 'custom') {
      targetDoc.field_sources.phone = `telegram:${tgId}`;
    }
  }
  delete targetDoc.phone;
  targetDoc.contact_verified = true;
  targetDoc.last_active = new Date().toISOString();
  dbSaveDoc(USERS_COL, targetDoc.id, targetDoc);
  return { ok: true, user: normalizeUserRecord(targetDoc, true), phone: formattedPhone };
}

export function linkGoogleAccount(
  currentUserId: string,
  googleData: {
    sub: string;
    email?: string;
    email_verified?: boolean;
    given_name?: string;
    family_name?: string;
    name?: string;
    nickname?: string;
    picture?: string;
    phone?: string;
    birth_date?: string;
    gender?: string;
    bio?: string;
    organization?: string;
    occupation?: string;
    address?: string;
    locale?: string;
    urls?: string[];
    access_token?: string;
  }
): { ok: boolean; user?: Record<string, any>; error?: string } {
  const googleId = String(googleData?.sub || '').trim();
  if (!googleId) return { ok: false, error: 'معرف كوكل غير صالح' };

  const currentDoc = currentUserId ? findUserRawByIdentifier(currentUserId) : null;
  if (!currentDoc) {
    return { ok: false, error: 'يرجى تسجيل الدخول أولاً قبل ربط حساب كوكل' };
  }

  const gEmail = String(googleData.email || '').trim().toLowerCase();
  const all = dbLoadCollection(USERS_COL);
  for (const u of Object.values(all)) {
    if (u.id === currentDoc.id) continue;
    const primaryMatch = !u.google_unlinked && String(u.google_id || '') === googleId;
    const multiMatch =
      !u.google_unlinked &&
      Array.isArray(u.google_accounts) &&
      u.google_accounts.some((a: any) => String(a.sub || '') === googleId);
    if (primaryMatch || multiMatch) {
      return {
        ok: false,
        error: 'حساب كوكل هذا مرتبط بالفعل بحساب آخر في منصة (01). يجب إلغاء ربطه من الحساب الآخر أولاً قبل ربطه هنا.',
      };
    }
  }

  const givenName = String(googleData.given_name || '').trim();
  const familyName = String(googleData.family_name || '').trim();
  const fullName = String(googleData.name || [givenName, familyName].filter(Boolean).join(' ') || '').trim();
  const nickname = String(googleData.nickname || '').trim();
  const picture = String(googleData.picture || '').trim();
  const gPhone = String(googleData.phone || '').trim();
  const gBirthDate = String(googleData.birth_date || '').trim();
  const gGenderRaw = String(googleData.gender || '').trim().toLowerCase();
  const gGender = gGenderRaw === 'male' || gGenderRaw === 'female' ? gGenderRaw : '';
  const gBio = String(googleData.bio || '').trim();
  const gOrg = String(googleData.organization || '').trim();
  const gOccupation = String(googleData.occupation || '').trim();
  const gAddress = String(googleData.address || '').trim();
  const gLocale = String(googleData.locale || '').trim();
  const gUrls = Array.isArray(googleData.urls) ? googleData.urls : [];
  const accessToken = String(googleData.access_token || '').trim();

  // Maintain multi-Google accounts list on the user record so they can switch between Google accounts for Drive/Classroom/Profile
  // IMPORTANT: Seed existing legacy primary Google account BEFORE overwriting currentDoc.google_id!
  const existingAccounts: Array<Record<string, any>> = Array.isArray(currentDoc.google_accounts)
    ? [...currentDoc.google_accounts]
    : [];
  const prevPrimaryGoogleId = !currentDoc.google_unlinked ? String(currentDoc.google_id || '').trim() : '';
  if (
    prevPrimaryGoogleId &&
    prevPrimaryGoogleId !== googleId &&
    !existingAccounts.some((a) => String(a.sub || a.google_id || '') === prevPrimaryGoogleId)
  ) {
    existingAccounts.push({
      id: prevPrimaryGoogleId,
      sub: prevPrimaryGoogleId,
      google_id: prevPrimaryGoogleId,
      email: decryptSensitive(currentDoc.google_email_enc || currentDoc.google_email || ''),
      given_name: String(currentDoc.google_given_name || ''),
      family_name: String(currentDoc.google_family_name || ''),
      name: String(currentDoc.google_name || [currentDoc.google_given_name, currentDoc.google_family_name].filter(Boolean).join(' ') || ''),
      nickname: String(currentDoc.google_nickname || ''),
      picture: String(currentDoc.google_photo_url || ''),
      phone_enc: currentDoc.google_phone_enc || '',
      birth_date: String(currentDoc.google_birth_date || ''),
      gender: String(currentDoc.google_gender || ''),
      bio: String(currentDoc.google_bio || ''),
      organization: String(currentDoc.google_organization || ''),
      occupation: String(currentDoc.google_occupation || ''),
      address: String(currentDoc.google_address || ''),
      locale: String(currentDoc.google_locale || ''),
      urls: Array.isArray(currentDoc.google_urls) ? currentDoc.google_urls : [],
      access_token_enc: currentDoc.google_access_token_enc || '',
      linked_at: currentDoc.google_linked_at || currentDoc.joined_at || new Date().toISOString(),
    });
  }

  currentDoc.google_id = googleId;
  currentDoc.google_unlinked = false;
  currentDoc.google_email_enc = gEmail ? encryptSensitive(gEmail) : '';
  currentDoc.google_given_name = givenName;
  currentDoc.google_family_name = familyName;
  currentDoc.google_name = fullName;
  currentDoc.google_nickname = nickname;
  currentDoc.google_photo_url = picture;
  if (gPhone) currentDoc.google_phone_enc = encryptSensitive(gPhone);
  if (gBirthDate) currentDoc.google_birth_date = gBirthDate;
  if (gGender) currentDoc.google_gender = gGender;
  if (gBio) currentDoc.google_bio = gBio;
  if (gOrg) currentDoc.google_organization = gOrg;
  if (gOccupation) currentDoc.google_occupation = gOccupation;
  if (gAddress) currentDoc.google_address = gAddress;
  if (gLocale) currentDoc.google_locale = gLocale;
  if (gUrls.length) currentDoc.google_urls = gUrls;
  if (accessToken) {
    currentDoc.google_access_token_enc = encryptSensitive(accessToken);
    currentDoc.google_token_updated_at = new Date().toISOString();
  }
  currentDoc.is_registered_account = true;

  const accIdx = existingAccounts.findIndex((a) => String(a.sub || a.google_id || '') === googleId || (gEmail && String(a.email || '').toLowerCase() === gEmail));
  const prevAcc = accIdx >= 0 ? existingAccounts[accIdx] : null;
  const accEntry = {
    id: googleId,
    sub: googleId,
    google_id: googleId,
    email: gEmail || prevAcc?.email || '',
    given_name: givenName || prevAcc?.given_name || '',
    family_name: familyName || prevAcc?.family_name || '',
    name: fullName || prevAcc?.name || '',
    nickname: nickname || prevAcc?.nickname || '',
    picture: picture || prevAcc?.picture || '',
    phone_enc: gPhone ? encryptSensitive(gPhone) : prevAcc?.phone_enc || '',
    birth_date: gBirthDate || prevAcc?.birth_date || '',
    gender: gGender || prevAcc?.gender || '',
    bio: gBio || prevAcc?.bio || '',
    organization: gOrg || prevAcc?.organization || '',
    occupation: gOccupation || prevAcc?.occupation || '',
    address: gAddress || prevAcc?.address || '',
    locale: gLocale || prevAcc?.locale || '',
    urls: gUrls.length ? gUrls : prevAcc?.urls || [],
    access_token_enc: accessToken ? encryptSensitive(accessToken) : prevAcc?.access_token_enc || '',
    linked_at: prevAcc?.linked_at || new Date().toISOString(),
  };
  if (accIdx >= 0) {
    existingAccounts[accIdx] = accEntry;
  } else {
    existingAccounts.push(accEntry);
  }
  currentDoc.google_accounts = existingAccounts;

  const existingEmail = decryptSensitive(currentDoc.email_enc || currentDoc.email || '').toLowerCase();
  if (gEmail && googleData.email_verified !== false) {
    if (!existingEmail || existingEmail === gEmail) {
      currentDoc.email_enc = encryptSensitive(gEmail);
      delete currentDoc.email;
      currentDoc.email_source = currentDoc.email_source || `google:${googleId}`;
      currentDoc.email_verified = true;
      currentDoc.contact_verified = true;
      if (!currentDoc.field_sources || typeof currentDoc.field_sources !== 'object') {
        currentDoc.field_sources = {};
      }
      if (!currentDoc.field_sources.email || currentDoc.field_sources.email === 'custom') {
        currentDoc.field_sources.email = `google:${googleId}`;
      }
    }
  }

  currentDoc.platform_id = ensurePlatformId(currentDoc.id, currentDoc.platform_id);
  currentDoc.last_active = new Date().toISOString();
  dbSaveDoc(USERS_COL, currentDoc.id, currentDoc);
  return { ok: true, user: normalizeUserRecord(currentDoc, true) };
}

export function authenticateGoogleLoginOnly(googleData: {
  sub: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  nickname?: string;
  picture?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
  bio?: string;
  organization?: string;
  occupation?: string;
  address?: string;
  locale?: string;
  urls?: string[];
  access_token?: string;
}): { ok: boolean; user?: Record<string, any>; error?: string } {
  const googleId = String(googleData?.sub || '').trim();
  const gEmail = String(googleData?.email || '').trim().toLowerCase();
  if (!googleId) return { ok: false, error: 'بيانات حساب كوكل غير صالحة' };

  const all = dbLoadCollection(USERS_COL);
  let matchedDoc: Record<string, any> | null = null;
  for (const u of Object.values(all)) {
    if (!u.google_unlinked && String(u.google_id || '').trim() === googleId) {
      matchedDoc = u;
      break;
    }
    if (!u.google_unlinked && Array.isArray(u.google_accounts)) {
      if (u.google_accounts.some((a: any) => String(a.sub || '') === googleId)) {
        matchedDoc = u;
        break;
      }
    }
  }

  // Also allow login if a registered user's email matches the verified Google email
  if (!matchedDoc && gEmail && googleData.email_verified !== false) {
    for (const u of Object.values(all)) {
      const uEmail = decryptSensitive(u.email_enc || u.email || '').toLowerCase();
      const uGoogleEmail = decryptSensitive(u.google_email_enc || u.google_email || '').toLowerCase();
      if ((uEmail === gEmail || (!u.google_unlinked && uGoogleEmail === gEmail)) && (u.password_hash || u.is_registered_account)) {
        matchedDoc = u;
        break;
      }
    }
  }

  if (!matchedDoc) {
    return {
      ok: false,
      error: 'لا يوجد حساب مسجل في المنصة مرتبط بحساب كوكل هذا. يرجى إنشاء حساب أو تسجيل الدخول أولاً ثم ربط حساب كوكل من الإعدادات.',
    };
  }
  if (matchedDoc.banned) {
    return { ok: false, error: 'هذا الحساب محظور من المنصة' };
  }

  // Keep Google profile info and access token synced upon login
  matchedDoc.google_id = googleId;
  matchedDoc.google_unlinked = false;
  if (gEmail) matchedDoc.google_email_enc = encryptSensitive(gEmail);
  if (googleData.given_name) matchedDoc.google_given_name = String(googleData.given_name).trim();
  if (googleData.family_name) matchedDoc.google_family_name = String(googleData.family_name).trim();
  if (googleData.name) matchedDoc.google_name = String(googleData.name).trim();
  if (googleData.nickname) matchedDoc.google_nickname = String(googleData.nickname).trim();
  if (googleData.picture) matchedDoc.google_photo_url = String(googleData.picture).trim();
  if (googleData.phone) matchedDoc.google_phone_enc = encryptSensitive(String(googleData.phone).trim());
  if (googleData.birth_date) matchedDoc.google_birth_date = String(googleData.birth_date).trim();
  if (googleData.gender) matchedDoc.google_gender = String(googleData.gender).trim().toLowerCase();
  if (googleData.bio) matchedDoc.google_bio = String(googleData.bio).trim();
  if (googleData.organization) matchedDoc.google_organization = String(googleData.organization).trim();
  if (googleData.occupation) matchedDoc.google_occupation = String(googleData.occupation).trim();
  if (googleData.address) matchedDoc.google_address = String(googleData.address).trim();
  if (googleData.locale) matchedDoc.google_locale = String(googleData.locale).trim();
  if (Array.isArray(googleData.urls) && googleData.urls.length) matchedDoc.google_urls = googleData.urls;
  if (googleData.access_token) {
    matchedDoc.google_access_token_enc = encryptSensitive(String(googleData.access_token).trim());
    matchedDoc.google_token_updated_at = new Date().toISOString();
  }

  const existingAccounts: Array<Record<string, any>> = Array.isArray(matchedDoc.google_accounts)
    ? [...matchedDoc.google_accounts]
    : [];
  const accIdx = existingAccounts.findIndex((a) => String(a.sub || '') === googleId || (gEmail && String(a.email || '').toLowerCase() === gEmail));
  const prevAcc = accIdx >= 0 ? existingAccounts[accIdx] : null;
  const accEntry = {
    sub: googleId,
    email: gEmail || prevAcc?.email || '',
    given_name: String(googleData.given_name || prevAcc?.given_name || matchedDoc.google_given_name || '').trim(),
    family_name: String(googleData.family_name || prevAcc?.family_name || matchedDoc.google_family_name || '').trim(),
    name: String(googleData.name || prevAcc?.name || matchedDoc.google_name || '').trim(),
    nickname: String(googleData.nickname || prevAcc?.nickname || matchedDoc.google_nickname || '').trim(),
    picture: String(googleData.picture || prevAcc?.picture || matchedDoc.google_photo_url || '').trim(),
    phone_enc: googleData.phone ? encryptSensitive(String(googleData.phone).trim()) : prevAcc?.phone_enc || '',
    birth_date: String(googleData.birth_date || prevAcc?.birth_date || '').trim(),
    gender: String(googleData.gender || prevAcc?.gender || '').trim().toLowerCase(),
    bio: String(googleData.bio || prevAcc?.bio || '').trim(),
    organization: String(googleData.organization || prevAcc?.organization || '').trim(),
    occupation: String(googleData.occupation || prevAcc?.occupation || '').trim(),
    address: String(googleData.address || prevAcc?.address || '').trim(),
    locale: String(googleData.locale || prevAcc?.locale || '').trim(),
    urls: Array.isArray(googleData.urls) && googleData.urls.length ? googleData.urls : prevAcc?.urls || [],
    access_token_enc: googleData.access_token
      ? encryptSensitive(String(googleData.access_token).trim())
      : prevAcc?.access_token_enc || '',
    linked_at: prevAcc?.linked_at || new Date().toISOString(),
  };
  if (accIdx >= 0) {
    existingAccounts[accIdx] = accEntry;
  } else {
    existingAccounts.push(accEntry);
  }
  matchedDoc.google_accounts = existingAccounts;

  const existingEmail = decryptSensitive(matchedDoc.email_enc || matchedDoc.email || '').toLowerCase();
  if (gEmail && (!existingEmail || existingEmail === gEmail)) {
    matchedDoc.email_enc = encryptSensitive(gEmail);
    matchedDoc.email_verified = true;
    matchedDoc.contact_verified = true;
  }

  matchedDoc.last_active = new Date().toISOString();
  matchedDoc.last_seen = nowBaghdadStr();
  matchedDoc.last_active_ts = Math.floor(Date.now() / 1000);
  matchedDoc.platform_id = ensurePlatformId(matchedDoc.id, matchedDoc.platform_id);
  dbSaveDoc(USERS_COL, matchedDoc.id, matchedDoc);
  return { ok: true, user: normalizeUserRecord(matchedDoc, true) };
}

export function switchActiveGoogleAccount(
  userId: string,
  targetSubOrEmail: string
): { ok: boolean; user?: Record<string, any>; error?: string } {
  const doc = findUserRawByIdentifier(userId);
  if (!doc) return { ok: false, error: 'الحساب غير موجود' };
  const key = String(targetSubOrEmail || '').trim().toLowerCase();
  const accounts: Array<Record<string, any>> = Array.isArray(doc.google_accounts) ? doc.google_accounts : [];
  const found = accounts.find(
    (a) => String(a.sub || '').toLowerCase() === key || String(a.email || '').toLowerCase() === key
  );
  if (!found) {
    return { ok: false, error: 'حساب كوكل المحدد غير موجود ضمن الحسابات المرتبطة' };
  }
  doc.google_id = String(found.sub || '');
  doc.google_unlinked = false;
  doc.google_email_enc = found.email ? encryptSensitive(String(found.email).toLowerCase()) : '';
  doc.google_given_name = String(found.given_name || '');
  doc.google_family_name = String(found.family_name || '');
  doc.google_name = String(found.name || '');
  doc.google_photo_url = String(found.picture || '');
  if (found.phone_enc) doc.google_phone_enc = found.phone_enc;
  if (found.birth_date) doc.google_birth_date = found.birth_date;
  if (found.gender) doc.google_gender = found.gender;
  if (found.access_token_enc) {
    doc.google_access_token_enc = found.access_token_enc;
  }
  doc.last_active = new Date().toISOString();
  dbSaveDoc(USERS_COL, doc.id, doc);
  return { ok: true, user: normalizeUserRecord(doc, true) };
}

export function getUserActiveGoogleAccessToken(userId: string): {
  token: string;
  email: string;
  name: string;
  picture: string;
  sub: string;
  accounts: Array<{ sub: string; email: string; name: string; picture: string; has_token: boolean; active: boolean }>;
} | null {
  const doc = findUserRawByIdentifier(userId);
  if (!doc || doc.google_unlinked || !doc.google_id) return null;
  const activeSub = String(doc.google_id || '').trim();
  const activeEmail = decryptSensitive(doc.google_email_enc || doc.google_email || '');
  let token = decryptSensitive(doc.google_access_token_enc || '');
  const accountsRaw: Array<Record<string, any>> = Array.isArray(doc.google_accounts) ? doc.google_accounts : [];
  if (!token && accountsRaw.length > 0) {
    const activeAcc = accountsRaw.find((a) => String(a.sub || '') === activeSub) || accountsRaw[0];
    if (activeAcc?.access_token_enc) {
      token = decryptSensitive(activeAcc.access_token_enc);
    }
  }
  const accounts = accountsRaw.map((a) => ({
    sub: String(a.sub || ''),
    email: String(a.email || ''),
    name: String(a.name || [a.given_name, a.family_name].filter(Boolean).join(' ') || ''),
    picture: String(a.picture || ''),
    has_token: Boolean(a.access_token_enc),
    active: String(a.sub || '') === activeSub,
  }));
  return {
    token,
    email: activeEmail,
    name: String(doc.google_name || [doc.google_given_name, doc.google_family_name].filter(Boolean).join(' ') || ''),
    picture: String(doc.google_photo_url || ''),
    sub: activeSub,
    accounts,
  };
}

export function unlinkGoogleAccount(
  userId: string,
  targetSub?: string
): { ok: boolean; user?: Record<string, any>; error?: string } {
  const currentDoc = findUserRawByIdentifier(userId);
  if (!currentDoc) {
    return { ok: false, error: 'الحساب غير موجود' };
  }
  const accounts: Array<Record<string, any>> = Array.isArray(currentDoc.google_accounts)
    ? [...currentDoc.google_accounts]
    : [];

  if (targetSub && accounts.length > 1) {
    const remaining = accounts.filter((a) => String(a.sub || '') !== String(targetSub));
    currentDoc.google_accounts = remaining;
    if (remaining.length > 0) {
      const next = remaining[0];
      currentDoc.google_id = String(next.sub || '');
      currentDoc.google_unlinked = false;
      currentDoc.google_email_enc = next.email ? encryptSensitive(String(next.email).toLowerCase()) : '';
      currentDoc.google_given_name = String(next.given_name || '');
      currentDoc.google_family_name = String(next.family_name || '');
      currentDoc.google_name = String(next.name || '');
      currentDoc.google_photo_url = String(next.picture || '');
      currentDoc.google_access_token_enc = next.access_token_enc || '';
      if (currentDoc.field_sources && typeof currentDoc.field_sources === 'object') {
        for (const [k, v] of Object.entries(currentDoc.field_sources)) {
          if (v === `google:${targetSub}`) {
            currentDoc.field_sources[k] = `google:${next.sub}`;
          }
        }
      }
      currentDoc.last_active = new Date().toISOString();
      dbSaveDoc(USERS_COL, currentDoc.id, currentDoc);
      return { ok: true, user: normalizeUserRecord(currentDoc, true) };
    }
  }

  currentDoc.google_unlinked = true;
  currentDoc.google_id = '';
  currentDoc.google_email_enc = '';
  currentDoc.google_email = '';
  currentDoc.google_given_name = '';
  currentDoc.google_family_name = '';
  currentDoc.google_name = '';
  currentDoc.google_photo_url = '';
  currentDoc.google_access_token_enc = '';
  currentDoc.google_accounts = [];
  if (currentDoc.name_source === 'google') {
    currentDoc.name_source = 'custom';
  }
  if (String(currentDoc.email_source || '').startsWith('google')) {
    currentDoc.email_source = 'custom';
  }
  if (String(currentDoc.photo_source || '').startsWith('google')) {
    currentDoc.photo_source = currentDoc.telegram_id && !currentDoc.telegram_unlinked ? 'telegram' : 'custom';
  }
  if (currentDoc.field_sources && typeof currentDoc.field_sources === 'object') {
    for (const [k, v] of Object.entries(currentDoc.field_sources)) {
      if (String(v || '').startsWith('google')) {
        currentDoc.field_sources[k] = 'custom';
      }
    }
  }
  if (currentDoc.settings) {
    currentDoc.settings.name_source = currentDoc.name_source;
    currentDoc.settings.photo_source = currentDoc.photo_source;
    currentDoc.settings.email_source = currentDoc.email_source;
  }
  currentDoc.last_active = new Date().toISOString();
  dbSaveDoc(USERS_COL, currentDoc.id, currentDoc);
  return { ok: true, user: normalizeUserRecord(currentDoc, true) };
}

export function parseUserAgentSummary(uaRaw: string): { browser: string; os: string; label: string } {
  const ua = String(uaRaw || '');
  let browser = 'متصفح ويب';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Apple Safari';
  else if (/Telegram/i.test(ua)) browser = 'Telegram Mini App';

  let os = 'نظام غير معروف';
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { browser, os, label: `${browser} — ${os}` };
}

export function recordUserSession(
  userId: string,
  meta: {
    session_id?: string;
    device_fp?: string;
    user_agent?: string;
    ip?: string;
  }
): { allowed: boolean; reason?: string; session_id: string } {
  const doc = findUserRawByIdentifier(userId);
  const sid = String(meta.session_id || 'default_session').trim();
  const fp = String(meta.device_fp || sid).trim();
  if (!doc) return { allowed: true, session_id: sid };

  const blocked: Array<Record<string, any>> = Array.isArray(doc.blocked_devices) ? doc.blocked_devices : [];
  if (blocked.some((b) => String(b.device_fp || '') === fp || String(b.session_id || '') === sid)) {
    return {
      allowed: false,
      reason: 'تم حظر هذا الجهاز أو المتصفح من الدخول إلى هذا الحساب من إعدادات الأمان.',
      session_id: sid,
    };
  }

  const revoked: string[] = Array.isArray(doc.revoked_sessions) ? doc.revoked_sessions : [];
  if (revoked.includes(sid)) {
    return {
      allowed: false,
      reason: 'تم تسجيل الخروج من هذه الجلسة عن بُعد.',
      session_id: sid,
    };
  }

  const { browser, os, label } = parseUserAgentSummary(meta.user_agent || '');
  const nowIso = new Date().toISOString();
  const sessions: Array<Record<string, any>> = Array.isArray(doc.sessions) ? [...doc.sessions] : [];
  const idx = sessions.findIndex((s) => String(s.session_id || '') === sid);
  const entry = {
    session_id: sid,
    device_fp: fp,
    browser,
    os,
    label,
    ip: String(meta.ip || '').replace(/^::ffff:/, ''),
    created_at: idx >= 0 ? sessions[idx].created_at || nowIso : nowIso,
    last_active: nowIso,
  };
  if (idx >= 0) {
    sessions[idx] = entry;
  } else {
    sessions.unshift(entry);
  }
  doc.sessions = sessions.slice(0, 25);
  dbSaveDoc(USERS_COL, doc.id, doc);
  return { allowed: true, session_id: sid };
}

export function manageUserSessions(
  userId: string,
  payload: {
    action: 'revoke' | 'revoke_others' | 'block_device' | 'unblock_device';
    target_session_id?: string;
    current_session_id?: string;
    device_fp?: string;
    label?: string;
  }
): { ok: boolean; user?: Record<string, any>; error?: string } {
  const doc = findUserRawByIdentifier(userId);
  if (!doc) return { ok: false, error: 'الحساب غير موجود' };

  const sessions: Array<Record<string, any>> = Array.isArray(doc.sessions) ? [...doc.sessions] : [];
  const blocked: Array<Record<string, any>> = Array.isArray(doc.blocked_devices) ? [...doc.blocked_devices] : [];
  const revoked: Set<string> = new Set(Array.isArray(doc.revoked_sessions) ? doc.revoked_sessions : []);

  const act = payload.action;
  const targetSid = String(payload.target_session_id || '').trim();
  const currentSid = String(payload.current_session_id || '').trim();
  const fp = String(payload.device_fp || '').trim();

  if (act === 'revoke' && targetSid) {
    revoked.add(targetSid);
    doc.sessions = sessions.filter((s) => String(s.session_id || '') !== targetSid);
  } else if (act === 'revoke_others') {
    for (const s of sessions) {
      const sid = String(s.session_id || '');
      if (sid && sid !== currentSid) revoked.add(sid);
    }
    doc.sessions = sessions.filter((s) => String(s.session_id || '') === currentSid);
  } else if (act === 'block_device') {
    const targetSession = sessions.find((s) => String(s.session_id || '') === targetSid || (fp && String(s.device_fp || '') === fp));
    const finalFp = fp || String(targetSession?.device_fp || targetSid);
    if (finalFp && !blocked.some((b) => String(b.device_fp || '') === finalFp)) {
      blocked.push({
        device_fp: finalFp,
        session_id: targetSid || String(targetSession?.session_id || ''),
        label: payload.label || targetSession?.label || 'جهاز محظور',
        browser: targetSession?.browser || '',
        os: targetSession?.os || '',
        ip: targetSession?.ip || '',
        blocked_at: new Date().toISOString(),
      });
    }
    if (targetSid) revoked.add(targetSid);
    doc.sessions = sessions.filter((s) => String(s.device_fp || '') !== finalFp && String(s.session_id || '') !== targetSid);
    doc.blocked_devices = blocked;
  } else if (act === 'unblock_device' && fp) {
    doc.blocked_devices = blocked.filter((b) => String(b.device_fp || '') !== fp && String(b.session_id || '') !== fp);
  }

  doc.revoked_sessions = Array.from(revoked).slice(-100);
  doc.last_active = new Date().toISOString();
  dbSaveDoc(USERS_COL, doc.id, doc);
  return { ok: true, user: normalizeUserRecord(doc, true) };
}

export function scheduleAccountDeletion(
  userId: string,
  passwordInput?: string
): {
  ok: boolean;
  user?: Record<string, any>;
  execute_at?: string;
  telegram_id?: string;
  error?: string;
} {
  const doc = findUserRawByIdentifier(userId);
  if (!doc) return { ok: false, error: 'الحساب غير موجود' };
  if (doc.id === OWNER_ID) {
    return { ok: false, error: 'لا يمكن جدولة حذف الحساب الرئيسي لمالك المنصة' };
  }
  if (doc.password_hash) {
    if (!passwordInput || !verifyPassword(String(passwordInput), doc.password_hash)) {
      return { ok: false, error: 'كلمة المرور غير صحيحة. يرجى إدخال كلمة المرور لتأكيد جدولة حذف الحساب.' };
    }
  }
  const now = Date.now();
  const executeAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  doc.deletion_scheduled_at = new Date(now).toISOString();
  doc.deletion_execute_at = executeAt;
  doc.last_active = new Date(now).toISOString();
  dbSaveDoc(USERS_COL, doc.id, doc);
  const tgId = doc.telegram_unlinked ? '' : String(doc.primary_bot_telegram_id || doc.telegram_id || '');
  return {
    ok: true,
    user: normalizeUserRecord(doc, true),
    execute_at: executeAt,
    telegram_id: tgId,
  };
}

export function cancelAccountDeletion(userId: string): {
  ok: boolean;
  user?: Record<string, any>;
  error?: string;
} {
  const doc = findUserRawByIdentifier(userId);
  if (!doc) return { ok: false, error: 'الحساب غير موجود' };
  doc.deletion_scheduled_at = '';
  doc.deletion_execute_at = '';
  doc.last_active = new Date().toISOString();
  dbSaveDoc(USERS_COL, doc.id, doc);
  return { ok: true, user: normalizeUserRecord(doc, true) };
}

export function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): { ok: boolean; user?: Record<string, any>; error?: string } {
  const doc = findUserRawByIdentifier(userId);
  if (!doc) return { ok: false, error: 'الحساب غير موجود' };
  const cleanNew = String(newPassword || '');
  if (cleanNew.length < 6) {
    return { ok: false, error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف أو أرقام على الأقل' };
  }
  if (doc.password_hash) {
    if (!currentPassword || !verifyPassword(String(currentPassword), doc.password_hash)) {
      return { ok: false, error: 'كلمة المرور الحالية غير صحيحة' };
    }
  }
  doc.password_hash = hashPassword(cleanNew);
  doc.is_registered_account = true;
  doc.last_active = new Date().toISOString();
  dbSaveDoc(USERS_COL, doc.id, doc);
  return { ok: true, user: normalizeUserRecord(doc, true) };
}

export function initiatePasswordReset(identifier: string): {
  ok: boolean;
  user_id?: string;
  email?: string;
  telegram_id?: string;
  code?: string;
  error?: string;
} {
  const key = String(identifier || '').trim();
  if (!key) return { ok: false, error: 'أدخل اسم المستخدم أو المعرف أو البريد الإلكتروني' };
  const doc = findUserRawByIdentifier(key);
  if (!doc) return { ok: false, error: 'لم يتم العثور على حساب مطابق لهذه البيانات' };

  const email = decryptSensitive(doc.email_enc || doc.email || '');
  const tgId = doc.telegram_unlinked ? '' : String(doc.telegram_id || (/^\d{5,}$/.test(String(doc.id || '')) ? doc.id : '') || '').trim();
  if (!email && !tgId) {
    return {
      ok: false,
      error: 'هذا الحساب غير مرتبط بتلگرام ولا يحتوي على بريد إلكتروني لإرسال رمز الاستعادة. تواصل مع إدارة المنصة.',
    };
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  doc.reset_code_enc = encryptSensitive(code);
  doc.reset_code_expires = Date.now() + 15 * 60 * 1000;
  dbSaveDoc(USERS_COL, doc.id, doc);
  return {
    ok: true,
    user_id: doc.id,
    email,
    telegram_id: tgId,
    code,
  };
}

export function completePasswordReset(
  identifier: string,
  code: string,
  newPassword: string
): { ok: boolean; user?: Record<string, any>; error?: string } {
  const doc = findUserRawByIdentifier(identifier);
  if (!doc) return { ok: false, error: 'الحساب غير موجود' };
  const expected = decryptSensitive(doc.reset_code_enc || '');
  const expires = Number(doc.reset_code_expires || 0);
  const cleanCode = String(code || '').trim();
  if (!cleanCode || !expected || cleanCode !== expected) {
    return { ok: false, error: 'رمز الاستعادة غير صحيح' };
  }
  if (expires && Date.now() > expires) {
    return { ok: false, error: 'انتهت صلاحية رمز الاستعادة، اطلب رمزاً جديداً' };
  }
  const cleanNew = String(newPassword || '');
  if (cleanNew.length < 6) {
    return { ok: false, error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف أو أرقام على الأقل' };
  }
  doc.password_hash = hashPassword(cleanNew);
  doc.is_registered_account = true;
  doc.reset_code_enc = '';
  doc.reset_code_expires = 0;
  doc.last_active = new Date().toISOString();
  dbSaveDoc(USERS_COL, doc.id, doc);
  return { ok: true, user: normalizeUserRecord(doc, true) };
}

export function ownerUpdateUserFull(
  requesterId: string,
  targetUserId: string,
  payload: Record<string, any>
): { ok: boolean; user?: Record<string, any>; error?: string } {
  if (!isOwner(requesterId)) {
    return { ok: false, error: 'هذه الصلاحية للمالك فقط' };
  }
  const doc = findUserRawByIdentifier(targetUserId);
  if (!doc) return { ok: false, error: 'المستخدم غير موجود' };

  if (payload.custom_name !== undefined) {
    doc.custom_name = String(payload.custom_name || '').trim();
    doc.full_name = doc.custom_name || doc.full_name;
    doc.display_name = doc.custom_name || doc.display_name;
  }
  if (payload.custom_username !== undefined) {
    doc.custom_username = String(payload.custom_username || '').trim().replace(/^@/, '');
  }
  if (payload.platform_id !== undefined && String(payload.platform_id).trim()) {
    doc.platform_id = String(payload.platform_id).trim().toUpperCase();
  }
  if (payload.name_source !== undefined) doc.name_source = payload.name_source;
  if (payload.username_source !== undefined) doc.username_source = payload.username_source;
  if (payload.photo_source !== undefined) doc.photo_source = payload.photo_source;
  if (payload.email_source !== undefined) doc.email_source = payload.email_source;
  if (payload.phone_source !== undefined) doc.phone_source = payload.phone_source;
  if (payload.bio_source !== undefined) doc.bio_source = payload.bio_source;
  if (payload.gender !== undefined) {
    const g = String(payload.gender || '').trim().toLowerCase();
    doc.gender = g === 'male' || g === 'female' ? g : '';
  }
  if (payload.custom_bio !== undefined) {
    doc.custom_bio = String(payload.custom_bio || '').trim();
  }
  if (payload.tg_bio !== undefined) {
    doc.tg_bio = String(payload.tg_bio || '').trim();
  }
  if (payload.email !== undefined) {
    const cleanEmail = String(payload.email || '').trim().toLowerCase();
    doc.email_enc = cleanEmail ? encryptSensitive(cleanEmail) : '';
    delete doc.email;
  }
  if (payload.email_verified !== undefined) {
    doc.email_verified = Boolean(payload.email_verified);
  }
  if (payload.phone !== undefined) {
    const cleanPhone = String(payload.phone || '').trim();
    doc.phone_enc = cleanPhone ? encryptSensitive(cleanPhone) : '';
    delete doc.phone;
  }
  if (payload.phone_verified !== undefined) {
    doc.phone_verified = Boolean(payload.phone_verified);
  }
  if (payload.birth_date !== undefined) {
    doc.birth_date = String(payload.birth_date || '').trim();
  }
  if (payload.telegram_id !== undefined) {
    const tid = String(payload.telegram_id || '').trim();
    doc.telegram_id = tid;
    doc.telegram_unlinked = !tid;
  }
  if (payload.tg_first_name !== undefined) doc.tg_first_name = String(payload.tg_first_name || '').trim();
  if (payload.tg_last_name !== undefined) doc.tg_last_name = String(payload.tg_last_name || '').trim();
  if (payload.tg_username !== undefined) doc.tg_username = String(payload.tg_username || '').trim().replace(/^@/, '');
  if (payload.tg_phone !== undefined) {
    const tp = String(payload.tg_phone || '').trim();
    doc.tg_phone_enc = tp ? encryptSensitive(tp) : '';
    delete doc.tg_phone;
  }
  if (payload.google_id !== undefined) {
    const gid = String(payload.google_id || '').trim();
    doc.google_id = gid;
    doc.google_unlinked = !gid;
  }
  if (payload.google_email !== undefined) {
    const ge = String(payload.google_email || '').trim().toLowerCase();
    doc.google_email_enc = ge ? encryptSensitive(ge) : '';
    delete doc.google_email;
  }
  if (payload.google_given_name !== undefined) doc.google_given_name = String(payload.google_given_name || '').trim();
  if (payload.google_family_name !== undefined) doc.google_family_name = String(payload.google_family_name || '').trim();
  if (payload.joined_at !== undefined && String(payload.joined_at).trim()) {
    doc.joined_at = String(payload.joined_at).trim();
  }
  if (payload.new_password && String(payload.new_password).trim().length >= 6) {
    doc.password_hash = hashPassword(String(payload.new_password).trim());
    doc.is_registered_account = true;
  }
  if (payload.privacy && typeof payload.privacy === 'object') {
    doc.privacy = {
      ...DEFAULT_USER_PRIVACY,
      ...(doc.settings?.privacy || {}),
      ...(doc.privacy || {}),
      ...payload.privacy,
    };
  }
  doc.settings = {
    ...(doc.settings || {}),
    name_source: doc.name_source || 'custom',
    username_source: doc.username_source || 'custom',
    photo_source: doc.photo_source || 'custom',
    email_source: doc.email_source || 'custom',
    phone_source: doc.phone_source || 'custom',
    bio_source: doc.bio_source || 'custom',
    gender: doc.gender || '',
    privacy: doc.privacy || DEFAULT_USER_PRIVACY,
  };
  dbSaveDoc(USERS_COL, doc.id, doc);
  return { ok: true, user: normalizeUserRecord(doc, true) };
}

export function setBanStatus(userId: string, banned: boolean, reason = ''): Record<string, any> | null {
  const uid = String(userId || '').trim();
  if (!uid || isOwner(uid)) return null;
  const existing = findUserRawByIdentifier(uid) || { id: uid, user_id: uid };
  const targetId = existing.id || uid;
  existing.banned = Boolean(banned);
  existing.ban_reason = banned ? reason : '';
  existing.banned_at = banned ? new Date().toISOString() : '';
  dbSaveDoc(USERS_COL, targetId, existing);
  return normalizeUserRecord(existing);
}

export function getUserStats(): Record<string, any> {
  const all = Object.values(getAllUsers());
  const nowTs = Math.floor(Date.now() / 1000);
  const todayStr = nowBaghdadStr('date');
  return {
    total_users: all.length,
    active_5m: all.filter((u) => (Number(u.last_active_ts) || 0) >= nowTs - 300).length,
    active_24h: all.filter((u) => (Number(u.last_active_ts) || 0) >= nowTs - 86400).length,
    new_today: all.filter((u) => String(u.joined_at || u.first_seen || '').startsWith(todayStr)).length,
    banned_users: all.filter((u) => Boolean(u.banned)).length,
  };
}

// ==================== FOLDERS MANAGER ====================
const FOLDERS_COL = 'folders';

export const FOLDER_COLORS = [
  '#D4A574', '#E57373', '#F06292', '#BA68C8',
  '#9575CD', '#7986CB', '#64B5F6', '#4FC3F7',
  '#4DD0E1', '#4DB6AC', '#81C784', '#AED581',
  '#FFD54F', '#FFB74D', '#FF8A65', '#90A4AE',
];

export function getAllFolders(): Record<string, Record<string, any>> {
  const raw = dbLoadCollection(FOLDERS_COL);
  const out: Record<string, Record<string, any>> = {};
  for (const [k, v] of Object.entries(raw)) {
    // Skip the container root document itself so it doesn't render as a card inside root
    if (k === 'root' || v?.id === 'root') continue;
    out[k] = { ...v, id: v?.id || k };
  }
  return out;
}

export function getFolder(folderId: string): Record<string, any> | null {
  if (!folderId || folderId === 'root') {
    return dbLoadDoc(FOLDERS_COL, 'root') || { id: 'root', name: 'الرئيسية', tags: [] };
  }
  const f = dbLoadDoc(FOLDERS_COL, folderId);
  return f ? { ...f, id: f.id || folderId } : null;
}

export function getSubfolders(parentId: string | null = null): Array<Record<string, any>> {
  const folders = getAllFolders();
  const isRoot = !parentId || parentId === 'root';
  return Object.values(folders)
    .filter((f) => {
      const pid = f.parent_id;
      if (isRoot) return !pid || pid === 'root';
      return pid === parentId;
    })
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

export function getBreadcrumb(folderId: string | null): Array<{ id: string; name: string }> {
  const crumbs: Array<{ id: string; name: string }> = [{ id: 'root', name: 'الرئيسية' }];
  if (!folderId || folderId === 'root') return crumbs;
  const folders = getAllFolders();
  const chain: Array<{ id: string; name: string }> = [];
  let currId: string | null = folderId;
  const visited = new Set<string>();
  while (currId && currId !== 'root' && !visited.has(currId)) {
    visited.add(currId);
    const f = folders[currId];
    if (!f) break;
    chain.unshift({ id: currId, name: f.name || currId });
    currId = f.parent_id || null;
  }
  return [...crumbs, ...chain];
}

export function createFolder(
  name: string,
  parentId: string | null = null,
  color = '#D4A574',
  icon = 'folder',
  createdBy = '',
  description = '',
  tags: string[] = [],
  customAppearance?: Record<string, any>
): Record<string, any> {
  const id = `folder_${Math.floor(Date.now() / 1000)}_${genId(4)}`;
  const normalizedParent = !parentId || parentId === 'root' ? 'root' : parentId;
  const folder: Record<string, any> = {
    id,
    name: String(name || 'مجلد جديد').trim(),
    parent_id: normalizedParent,
    type: 'folder',
    children: [],
    color: color || '#D4A574',
    icon: icon || 'folder',
    description: description || '',
    tags: Array.isArray(tags) ? tags : [],
    custom_appearance: customAppearance || null,
    created_at: new Date().toISOString(),
    created_by: String(createdBy || ''),
  };
  dbSaveDoc(FOLDERS_COL, id, folder);
  if (folder.tags.length > 0) {
    syncItemTags('folder', id, folder.name, folder.tags, createdBy);
  }
  return folder;
}

export function updateFolder(folderId: string, updates: Record<string, any>): Record<string, any> | null {
  const folder = dbLoadDoc(FOLDERS_COL, folderId);
  if (!folder) return null;
  const updated: Record<string, any> = {
    ...folder,
    ...updates,
    id: folderId,
    updated_at: new Date().toISOString(),
  };
  dbSaveDoc(FOLDERS_COL, folderId, updated);
  if (Array.isArray(updates.tags)) {
    syncItemTags('folder', folderId, updated.name, updates.tags, updated.created_by || '');
  }
  return updated;
}

export function getDescendantFolderIds(folderId: string): string[] {
  const folders = getAllFolders();
  const result: string[] = [];
  const queue = [folderId];
  const visited = new Set<string>([folderId]);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const f of Object.values(folders)) {
      if (f.parent_id === curr && !visited.has(f.id)) {
        visited.add(f.id);
        result.push(f.id);
        queue.push(f.id);
      }
    }
  }
  return result;
}

export function deleteFolder(folderId: string): Record<string, any> | null {
  if (!folderId || folderId === 'root') return null;
  const folder = dbLoadDoc(FOLDERS_COL, folderId);
  if (!folder) return null;
  const descIds = getDescendantFolderIds(folderId);
  for (const did of descIds) {
    dbDeleteDoc(FOLDERS_COL, did);
  }
  dbDeleteDoc(FOLDERS_COL, folderId);
  return folder;
}

export function moveFolder(folderId: string, newParentId: string | null): { ok: boolean; folder?: Record<string, any>; error?: string } {
  if (!folderId || folderId === 'root') return { ok: false, error: 'لا يمكن نقل هذا المجلد' };
  const folder = dbLoadDoc(FOLDERS_COL, folderId);
  if (!folder) return { ok: false, error: 'المجلد غير موجود' };
  const normalizedTarget = !newParentId || newParentId === 'root' ? 'root' : newParentId;
  if (normalizedTarget === folderId) return { ok: false, error: 'لا يمكن نقل المجلد داخل نفسه' };
  if (normalizedTarget !== 'root') {
    const desc = getDescendantFolderIds(folderId);
    if (desc.includes(normalizedTarget)) {
      return { ok: false, error: 'لا يمكن نقل المجلد إلى مجلد فرعي تابع له' };
    }
  }
  folder.parent_id = normalizedTarget;
  folder.updated_at = new Date().toISOString();
  dbSaveDoc(FOLDERS_COL, folderId, folder);
  return { ok: true, folder };
}

export function copyFolder(folderId: string, targetParentId: string | null, createdBy = ''): Record<string, any> | null {
  const src = dbLoadDoc(FOLDERS_COL, folderId);
  if (!src) return null;
  const newFolder = createFolder(
    `${src.name} (نسخة)`,
    targetParentId,
    src.color,
    src.icon,
    createdBy || src.created_by,
    src.description,
    src.tags,
    src.custom_appearance
  );
  const files = getFilesInFolder(folderId);
  for (const f of files) {
    copyFile(f.id, newFolder.id);
  }
  return newFolder;
}

export function buildFolderTree(parentId: string | null = null): Array<Record<string, any>> {
  const subs = getSubfolders(parentId);
  return subs.map((f) => ({
    ...f,
    children: buildFolderTree(f.id),
  }));
}

export function getInheritedFolderTags(folderId: string | null): string[] {
  if (!folderId || folderId === 'root') return [];
  const folders = getAllFolders();
  const tags = new Set<string>();
  let curr: string | null = folderId;
  const visited = new Set<string>();
  while (curr && curr !== 'root' && !visited.has(curr)) {
    visited.add(curr);
    const f = folders[curr];
    if (!f) break;
    if (Array.isArray(f.tags)) {
      for (const t of f.tags) if (t) tags.add(String(t));
    }
    curr = f.parent_id || null;
  }
  return Array.from(tags);
}

// ==================== FILES MANAGER ====================
const FILES_COL = 'files';

function sanitizeFileName(rawName: string): string {
  const str = String(rawName || '').trim();
  if (!str) return 'ملف';
  if (/<[a-zA-Z!/]/.test(str)) {
    // Strip HTML tags and broken unclosed tags like <a href="https://youtu.be/...
    const cleaned = str
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/<[a-zA-Z][^>]*$/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || 'ملاحظة نصية';
  }
  return str;
}

function isLikelyTelegramFileId(val: string): boolean {
  if (!val || val.length < 20) return false;
  return /^(BQAC|CQAC|AgAC|BAAC|DQAC|AwAC|CAAC|EAAC)/.test(val);
}

function normalizeFileRecord(key: string, f: Record<string, any>): Record<string, any> {
  const id = String(f.id || f.file_id || key).trim();
  const fileId = String(f.file_id || f.id || key).trim();
  const tgId = f.telegram_file_id || (isLikelyTelegramFileId(fileId) ? fileId : isLikelyTelegramFileId(id) ? id : '');
  const rawName = f.file_name || f.original_name || f.name || 'ملف';
  const cleanName = sanitizeFileName(rawName);
  const ftype = f.file_type || f.type || getFileType(cleanName);
  return {
    ...f,
    id,
    file_id: fileId,
    telegram_file_id: tgId,
    file_name: cleanName,
    original_name: cleanName,
    name: cleanName,
    type: ftype === 'text' ? 'text_note' : ftype,
    file_type: ftype === 'text' ? 'text_note' : ftype,
  };
}

export function getAllFiles(): Record<string, Record<string, any>> {
  const raw = dbLoadCollection(FILES_COL);
  const out: Record<string, Record<string, any>> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!v || typeof v !== 'object') continue;
    out[k] = normalizeFileRecord(k, v);
  }
  return out;
}

export function getFile(fileId: string): Record<string, any> | null {
  if (!fileId) return null;
  const direct = dbLoadDoc(FILES_COL, fileId);
  if (direct) return normalizeFileRecord(fileId, direct);
  const all = getAllFiles();
  for (const f of Object.values(all)) {
    if (f.id === fileId || f.file_id === fileId || f.telegram_file_id === fileId) {
      return f;
    }
  }
  return null;
}

export function getFilesInFolder(folderId: string | null): Array<Record<string, any>> {
  const all = getAllFiles();
  const isRoot = !folderId || folderId === 'root';
  return Object.values(all)
    .filter((f) => {
      // Pending bot files have folder_id === null and are waiting to be assigned
      if (f.folder_id === null || f.is_pending_bot === true) return false;
      const fid = f.folder_id || 'root';
      if (isRoot) return fid === 'root';
      return fid === folderId;
    })
    .map((f) => ({ ...f }));
}

export function createFileRecord(params: {
  original_name: string;
  size?: number;
  folder_id?: string | null;
  uploaded_by?: string;
  description?: string;
  tags?: string[];
  source?: string;
  url?: string;
  text_content?: string;
  custom_appearance?: Record<string, any> | null;
  telegram_file_id?: string;
  local_path?: string;
  mime_type?: string;
  is_pending_bot?: boolean;
}): Record<string, any> {
  const id = crypto.randomUUID();
  const sizeBytes = Number(params.size) || 0;
  const ftype = params.source === 'url'
    ? 'link'
    : params.source === 'text'
    ? 'text_note'
    : getFileType(params.original_name || '');
  const folderId = params.is_pending_bot || params.folder_id === null
    ? null
    : !params.folder_id || params.folder_id === 'root'
    ? 'root'
    : params.folder_id;
  const fname = sanitizeFileName(String(params.original_name || 'ملف بدون اسم').trim());
  const record: Record<string, any> = {
    id,
    file_id: id,
    file_name: fname,
    original_name: fname,
    name: fname,
    type: ftype,
    file_type: ftype,
    size: sizeBytes,
    file_size: sizeBytes,
    size_formatted: formatSize(sizeBytes),
    file_size_formatted: formatSize(sizeBytes),
    folder_id: folderId,
    is_pending_bot: Boolean(params.is_pending_bot || folderId === null),
    uploaded_by: { id: params.uploaded_by || OWNER_ID, source: params.source || 'web' },
    upload_date: new Date().toISOString(),
    uploaded_at: nowBaghdadStr('short'),
    downloads: 0,
    views: 0,
    description: params.description || '',
    tags: Array.isArray(params.tags) ? params.tags : [],
    source: params.source || 'web',
    url: params.url || '',
    content: params.text_content || '',
    text_content: params.text_content || '',
    custom_appearance: params.custom_appearance || null,
    telegram_file_id: params.telegram_file_id || '',
    local_path: params.local_path || '',
    mime_type: params.mime_type || '',
  };
  dbSaveDoc(FILES_COL, id, record);
  if (record.tags.length > 0) {
    syncItemTags('file', id, fname, record.tags, String(params.uploaded_by || ''));
  }
  return record;
}

export function updateFile(fileId: string, updates: Record<string, any>): Record<string, any> | null {
  const existing = getFile(fileId);
  if (!existing) return null;
  const docKey = existing.id || fileId;
  const updated: Record<string, any> = {
    ...existing,
    ...updates,
    id: docKey,
    updated_at: new Date().toISOString(),
  };
  dbSaveDoc(FILES_COL, docKey, updated);
  if (Array.isArray(updates.tags)) {
    syncItemTags('file', docKey, updated.file_name || updated.original_name || '', updates.tags, '');
  }
  return normalizeFileRecord(docKey, updated);
}

export function deleteFile(fileId: string): Record<string, any> | null {
  const existing = getFile(fileId);
  if (!existing) return null;
  const docKey = existing.id || fileId;
  dbDeleteDoc(FILES_COL, docKey);
  return existing;
}

export function moveFile(fileId: string, targetFolderId: string | null): Record<string, any> | null {
  const existing = getFile(fileId);
  if (!existing) return null;
  const docKey = existing.id || fileId;
  existing.folder_id = !targetFolderId || targetFolderId === 'root' ? 'root' : targetFolderId;
  existing.is_pending_bot = false;
  existing.updated_at = new Date().toISOString();
  dbSaveDoc(FILES_COL, docKey, existing);
  return normalizeFileRecord(docKey, existing);
}

export function copyFile(fileId: string, targetFolderId: string | null): Record<string, any> | null {
  const existing = getFile(fileId);
  if (!existing) return null;
  const newId = crypto.randomUUID();
  const copy: Record<string, any> = {
    ...JSON.parse(JSON.stringify(existing)),
    id: newId,
    file_id: newId,
    folder_id: !targetFolderId || targetFolderId === 'root' ? 'root' : targetFolderId,
    is_pending_bot: false,
    upload_date: new Date().toISOString(),
    downloads: 0,
  };
  dbSaveDoc(FILES_COL, newId, copy);
  return normalizeFileRecord(newId, copy);
}

export function incrementDownloads(fileId: string): void {
  const f = getFile(fileId);
  if (f) {
    const docKey = f.id || fileId;
    f.downloads = (Number(f.downloads) || 0) + 1;
    dbSaveDoc(FILES_COL, docKey, f);
  }
}

// ==================== RATINGS MANAGER ====================
const RATINGS_COL = 'ratings';

function extractStarsFromRatingDoc(doc: Record<string, any>, userId = ''): { vals: number[]; userRating: number | null } {
  const ratingsObj = doc?.ratings || doc?.votes || {};
  const vals: number[] = [];
  let userRating: number | null = null;
  for (const [uid, entry] of Object.entries(ratingsObj)) {
    const stars = typeof entry === 'object' && entry !== null ? Number((entry as any).stars ?? (entry as any).rating) : Number(entry);
    if (stars >= 1 && stars <= 5) {
      vals.push(stars);
      if (userId && String(uid) === String(userId)) {
        userRating = stars;
      }
    }
  }
  return { vals, userRating };
}

export function getItemRatings(itemType: string, itemId: string, userId = ''): Record<string, any> {
  const key = `${itemType}_${itemId}`;
  const altKey = `${itemType}:${itemId}`;
  const doc = dbLoadDoc(RATINGS_COL, key) || dbLoadDoc(RATINGS_COL, altKey) || { item_type: itemType, item_id: itemId, ratings: {} };
  const { vals, userRating } = extractStarsFromRatingDoc(doc, userId);
  const count = vals.length;
  const average = count > 0 ? Number((vals.reduce((a, b) => a + b, 0) / count).toFixed(2)) : 0;
  return {
    item_type: itemType,
    item_id: itemId,
    avg: average,
    average,
    count,
    user_rating: userRating,
  };
}

export function setItemRating(itemType: string, itemId: string, userId: string, stars: number): Record<string, any> {
  const key = `${itemType}_${itemId}`;
  const doc = dbLoadDoc(RATINGS_COL, key) || { item_type: itemType, item_id: itemId, ratings: {} };
  if (!doc.ratings || typeof doc.ratings !== 'object') doc.ratings = {};
  const clamped = Math.max(1, Math.min(5, Math.round(Number(stars) || 5)));
  doc.ratings[String(userId)] = {
    stars: clamped,
    rated_at: new Date().toISOString(),
  };
  dbSaveDoc(RATINGS_COL, key, doc);
  return getItemRatings(itemType, itemId, userId);
}

export function deleteItemRating(itemType: string, itemId: string, userId: string): Record<string, any> {
  const key = `${itemType}_${itemId}`;
  const doc = dbLoadDoc(RATINGS_COL, key);
  if (doc) {
    if (doc.ratings && userId in doc.ratings) delete doc.ratings[userId];
    if (doc.votes && userId in doc.votes) delete doc.votes[userId];
    dbSaveDoc(RATINGS_COL, key, doc);
  }
  return getItemRatings(itemType, itemId, userId);
}

export function getTopRatedItems(limit = 20): Array<Record<string, any>> {
  const all = dbLoadCollection(RATINGS_COL);
  const list: Array<Record<string, any>> = [];
  for (const [key, doc] of Object.entries(all)) {
    const { vals } = extractStarsFromRatingDoc(doc);
    if (vals.length === 0) continue;
    const avg = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
    const sepIdx = key.indexOf('_') !== -1 ? key.indexOf('_') : key.indexOf(':');
    const parsedType = sepIdx !== -1 ? key.slice(0, sepIdx) : 'file';
    const parsedId = sepIdx !== -1 ? key.slice(sepIdx + 1) : key;
    list.push({
      key,
      item_type: doc.item_type || parsedType,
      item_id: doc.item_id || parsedId,
      avg,
      average: avg,
      count: vals.length,
    });
  }
  return list.sort((a, b) => b.average - a.average || b.count - a.count).slice(0, limit);
}

// ==================== DELETED MANAGER (TRASH) ====================
const DELETED_COL = 'deleted_items';

export function addToTrash(
  itemType: 'file' | 'folder' | 'quiz' | 'question',
  itemId: string,
  itemData: Record<string, any>,
  deletedBy = ''
): Record<string, any> {
  const trashId = `${itemType}_${itemId}`;
  const entry = {
    trash_id: trashId,
    id: itemId,
    type: itemType,
    item_type: itemType,
    item_id: itemId,
    item_name: itemData.file_name || itemData.original_name || itemData.title || itemData.name || itemData.text || itemId,
    data: itemData,
    deleted_by: String(deletedBy || ''),
    deleted_at: new Date().toISOString(),
    deleted_ts: Math.floor(Date.now() / 1000),
  };
  dbSaveDoc(DELETED_COL, trashId, entry);
  return entry;
}

export function getAllDeleted(): Array<Record<string, any>> {
  const all = dbLoadCollection(DELETED_COL);
  return Object.values(all).sort((a, b) => (Number(b.deleted_ts) || 0) - (Number(a.deleted_ts) || 0));
}

export function restoreFromTrash(trashId: string): Record<string, any> | null {
  const entry = dbLoadDoc(DELETED_COL, trashId);
  if (!entry) return null;
  const { item_type, item_id, data } = entry;
  if (item_type === 'file') {
    dbSaveDoc(FILES_COL, item_id, data);
  } else if (item_type === 'folder') {
    dbSaveDoc(FOLDERS_COL, item_id, data);
  } else if (item_type === 'quiz') {
    dbSaveDoc('quizzes', item_id, data);
  } else if (item_type === 'question') {
    dbSaveDoc('questions', item_id, data);
  }
  dbDeleteDoc(DELETED_COL, trashId);
  return entry;
}

export function permanentDeleteFromTrash(trashId: string): boolean {
  return dbDeleteDoc(DELETED_COL, trashId);
}

// ==================== GROUPS MANAGER ====================
const GROUPS_COL = 'groups';
const GROUP_MESSAGES_COL = 'group_messages';

export function getAllGroups(): Array<Record<string, any>> {
  return Object.values(dbLoadCollection(GROUPS_COL));
}

export function createGroup(params: Record<string, any>): Record<string, any> {
  const id = params.id || genId(8);
  const grp = {
    id,
    name: params.name || params.title || 'مجموعة جديدة',
    title: params.title || params.name || 'مجموعة جديدة',
    telegram_chat_id: params.telegram_chat_id || params.chat_id || '',
    description: params.description || '',
    created_at: new Date().toISOString(),
    ...params,
  };
  dbSaveDoc(GROUPS_COL, id, grp);
  return grp;
}

export function deleteGroup(groupId: string): boolean {
  return dbDeleteDoc(GROUPS_COL, groupId);
}

export function getGroupMessages(groupId: string): Array<Record<string, any>> {
  const cfg = dbLoadDoc(GROUP_MESSAGES_COL, 'config') || {};
  if (Array.isArray(cfg[groupId])) return cfg[groupId];
  const g = dbLoadDoc(GROUPS_COL, groupId);
  return Array.isArray(g?.messages) ? g.messages : [];
}

export function addGroupMessage(groupId: string, msg: Record<string, any>): Record<string, any> | null {
  const cfg = dbLoadDoc(GROUP_MESSAGES_COL, 'config') || {};
  if (!Array.isArray(cfg[groupId])) cfg[groupId] = [];
  const entry = {
    message_id: Date.now(),
    text: msg.text || '',
    from: msg.from || 'أنت',
    date: new Date().toISOString(),
    is_sent: true,
    ...msg,
  };
  cfg[groupId].push(entry);
  dbSaveDoc(GROUP_MESSAGES_COL, 'config', cfg);
  return entry;
}

// ==================== QUIZZES & QUESTIONS MANAGER ====================
const QUIZZES_COL = 'quizzes';
const QUESTIONS_COL = 'questions';

export function getAllQuizzes(folderId?: string | null): Array<Record<string, any>> {
  const all = Object.values(dbLoadCollection(QUIZZES_COL));
  if (folderId === undefined) return all;
  const isRoot = !folderId || folderId === 'root';
  return all.filter((q) => {
    const fid = q.folder_id;
    if (isRoot) return !fid || fid === 'root';
    return fid === folderId;
  });
}

export function getQuiz(quizId: string): Record<string, any> | null {
  if (!quizId) return null;
  const q = dbLoadDoc(QUIZZES_COL, quizId);
  if (!q) return null;
  const standaloneForQuiz = getAllQuestions().filter((item) => item.quiz_id === quizId);
  const inlineQuestions: Array<Record<string, any>> = Array.isArray(q.questions) ? [...q.questions] : [];
  const combined = [...inlineQuestions];
  for (const sq of standaloneForQuiz) {
    if (!combined.some((x) => x.id === sq.id)) {
      combined.push(sq);
    }
  }
  return {
    ...q,
    questions: combined,
    question_count: combined.length,
    questions_count: combined.length,
  };
}

export function createQuiz(params: Record<string, any>): Record<string, any> {
  const id = genId(8);
  const folderId = !params.folder_id || params.folder_id === 'root' ? null : params.folder_id;
  const questions = Array.isArray(params.questions)
    ? params.questions.map((q: any, idx: number) => ({
        id: q.id || genId(8),
        sort_order: idx,
        ...q,
      }))
    : [];
  const quiz: Record<string, any> = {
    id,
    title: String(params.title || 'اختبار جديد').trim(),
    description: params.description || '',
    folder_id: folderId,
    quiz_type: params.quiz_type || 'multiple_choice',
    created_by: String(params.created_by || params.user_id || OWNER_ID),
    created_at: new Date().toISOString(),
    tags: Array.isArray(params.tags) ? params.tags : [],
    questions,
    image_file_id: params.image_file_id || null,
    question_numbering_template: params.question_numbering_template || '{x}.',
    option_numbering_template: params.option_numbering_template || '',
  };
  dbSaveDoc(QUIZZES_COL, id, quiz);
  if (quiz.tags.length > 0) {
    syncItemTags('quiz', id, quiz.title, quiz.tags, quiz.created_by);
  }
  return quiz;
}

export function updateQuiz(quizId: string, updates: Record<string, any>): Record<string, any> | null {
  const existing = dbLoadDoc(QUIZZES_COL, quizId);
  if (!existing) return null;
  const updated: Record<string, any> = {
    ...existing,
    ...updates,
    id: quizId,
    updated_at: new Date().toISOString(),
  };
  dbSaveDoc(QUIZZES_COL, quizId, updated);
  if (Array.isArray(updates.tags)) {
    syncItemTags('quiz', quizId, updated.title, updates.tags, updated.created_by || '');
  }
  return getQuiz(quizId);
}

export function deleteQuiz(quizId: string): Record<string, any> | null {
  const existing = dbLoadDoc(QUIZZES_COL, quizId);
  if (!existing) return null;
  dbDeleteDoc(QUIZZES_COL, quizId);
  return existing;
}

export function addQuizQuestion(quizId: string, questionData: Record<string, any>): Record<string, any> | null {
  const quiz = dbLoadDoc(QUIZZES_COL, quizId);
  if (!quiz) return null;
  if (!Array.isArray(quiz.questions)) quiz.questions = [];
  const q = {
    id: questionData.id || genId(8),
    text: questionData.text || questionData.question_text || '',
    question_text: questionData.question_text || questionData.text || '',
    type: questionData.type || questionData.question_type || 'multiple_choice',
    options: Array.isArray(questionData.options) ? questionData.options : [],
    correct_indices: Array.isArray(questionData.correct_indices) ? questionData.correct_indices : [0],
    explanation: questionData.explanation || { text: '', image_file_id: null, image_file_ids: [] },
    image_file_id: questionData.image_file_id || null,
    image_file_ids: Array.isArray(questionData.image_file_ids) ? questionData.image_file_ids : [],
    tags: Array.isArray(questionData.tags) ? questionData.tags : [],
    points: Number(questionData.points) || 1,
    quiz_id: quizId,
    sort_order: quiz.questions.length,
    created_at: new Date().toISOString(),
    ...questionData,
  };
  quiz.questions.push(q);
  dbSaveDoc(QUIZZES_COL, quizId, quiz);
  return q;
}

export function updateQuizQuestion(quizId: string, questionId: string, updates: Record<string, any>): Record<string, any> | null {
  const quiz = dbLoadDoc(QUIZZES_COL, quizId);
  if (!quiz || !Array.isArray(quiz.questions)) return null;
  const idx = quiz.questions.findIndex((q: any) => q.id === questionId);
  if (idx === -1) return null;
  quiz.questions[idx] = { ...quiz.questions[idx], ...updates, id: questionId };
  dbSaveDoc(QUIZZES_COL, quizId, quiz);
  return quiz.questions[idx];
}

export function deleteQuizQuestion(quizId: string, questionId: string): boolean {
  const quiz = dbLoadDoc(QUIZZES_COL, quizId);
  if (!quiz || !Array.isArray(quiz.questions)) return false;
  const before = quiz.questions.length;
  quiz.questions = quiz.questions.filter((q: any) => q.id !== questionId);
  dbSaveDoc(QUIZZES_COL, quizId, quiz);
  return quiz.questions.length < before;
}

export function getAllQuestions(folderId?: string | null): Array<Record<string, any>> {
  const all = Object.values(dbLoadCollection(QUESTIONS_COL));
  if (folderId === undefined) return all;
  const isRoot = !folderId || folderId === 'root';
  return all.filter((q) => {
    const fid = q.folder_id;
    if (isRoot) return !fid || fid === 'root';
    return fid === folderId;
  });
}

export function getQuestion(questionId: string): Record<string, any> | null {
  if (!questionId) return null;
  return dbLoadDoc(QUESTIONS_COL, questionId);
}

export function createQuestion(params: Record<string, any>): Record<string, any> {
  const id = params.id || genId(8);
  const folderId = !params.folder_id || params.folder_id === 'root' ? null : params.folder_id;
  const q: Record<string, any> = {
    id,
    text: params.text || params.question_text || '',
    question_text: params.question_text || params.text || '',
    type: params.type || params.question_type || 'multiple_choice',
    options: Array.isArray(params.options) ? params.options : [],
    correct_indices: Array.isArray(params.correct_indices) ? params.correct_indices : [0],
    explanation: params.explanation || { text: '', image_file_id: null, image_file_ids: [] },
    image_file_id: params.image_file_id || null,
    image_file_ids: Array.isArray(params.image_file_ids) ? params.image_file_ids : [],
    folder_id: folderId,
    quiz_id: params.quiz_id || null,
    tags: Array.isArray(params.tags) ? params.tags : [],
    points: Number(params.points) || 1,
    created_by: String(params.created_by || params.user_id || OWNER_ID),
    created_at: new Date().toISOString(),
    ...params,
  };
  q.id = id;
  q.folder_id = folderId;
  dbSaveDoc(QUESTIONS_COL, id, q);
  if (q.tags.length > 0) {
    syncItemTags('question', id, (q.text || '').slice(0, 60), q.tags, q.created_by);
  }
  return q;
}

export function updateQuestion(questionId: string, updates: Record<string, any>): Record<string, any> | null {
  const existing = getQuestion(questionId);
  if (!existing) return null;
  const updated: Record<string, any> = {
    ...existing,
    ...updates,
    id: questionId,
    updated_at: new Date().toISOString(),
  };
  dbSaveDoc(QUESTIONS_COL, questionId, updated);
  return updated;
}

export function deleteQuestion(questionId: string): Record<string, any> | null {
  const existing = getQuestion(questionId);
  if (!existing) return null;
  dbDeleteDoc(QUESTIONS_COL, questionId);
  return existing;
}
