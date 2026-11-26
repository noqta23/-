import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

import {
  OWNER_ID,
  initDb,
  dbIsEnabled,
  dbPing,
  dbLoadDoc,
  dbSaveDoc,
  nowBaghdadStr,
  normalizeArabic,
  formatSize,
} from './src/server/db.ts';

import {
  getCountryCatalog,
  saveCountryProfiles,
  getInstitutionCatalog,
  getInstitutionProfiles,
  saveInstitutionProfiles,
  saveCatalogVisibility,
  consolidateDuplicateInstitutions,
  getTagCategories,
  createTagCategory,
  updateTagCategory,
  deleteTagCategory,
  reorderTagCategories,
  getAllTags,
  getTagsGrouped,
  createTag,
  updateTag,
  deleteTag,
  getDeletedTags,
  restoreTag,
  permanentDeleteTag,
  addTagPlacement,
  removeTagPlacement,
  bulkModifyPlacements,
  reorderTags,
  getAllTagNames,
  removeItemFromAllTags,
} from './src/server/taxonomy.ts';

import {
  PERMISSION_LABELS,
  DEFAULT_PERMISSIONS,
  isOwner,
  isAdmin,
  getUserRole,
  getAdminPermissions,
  getAllAdmins,
  addAdmin,
  removeAdmin,
  updateAdminPermissions,
  registerOrUpdateUser,
  getUser,
  getAllUsers,
  getActiveUsers,
  updateUserSettings,
  registerPlatformAccount,
  authenticatePlatformAccount,
  authenticateTelegramLoginOnly,
  verifyUserEmailCode,
  regenerateVerificationCode,
  getRawUserPhotoData,
  linkTelegramAccount,
  setBanStatus,
  getUserStats,
  getAllFolders,
  getFolder,
  getSubfolders,
  getBreadcrumb,
  createFolder,
  updateFolder,
  deleteFolder,
  moveFolder,
  copyFolder,
  buildFolderTree,
  getInheritedFolderTags,
  getDescendantFolderIds,
  getAllFiles,
  getFile,
  createFileRecord,
  updateFile,
  deleteFile,
  moveFile,
  copyFile,
  incrementDownloads,
  getItemRatings,
  setItemRating,
  deleteItemRating,
  getTopRatedItems,
  addToTrash,
  getAllDeleted,
  restoreFromTrash,
  permanentDeleteFromTrash,
  getAllGroups,
  createGroup,
  deleteGroup,
  getGroupMessages,
  addGroupMessage,
  getAllQuizzes,
  getQuiz,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  addQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  getAllQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  unlinkTelegramAccount,
  switchPrimaryTelegramAccount,
  linkGoogleAccount,
  authenticateGoogleLoginOnly,
  unlinkGoogleAccount,
  switchActiveGoogleAccount,
  getUserActiveGoogleAccessToken,
  manageUserCustomPhotos,
  archiveUserTelegramPhotos,
  changeUserPassword,
  initiatePasswordReset,
  completePasswordReset,
  ownerUpdateUserFull,
  recordUserSession,
  manageUserSessions,
  scheduleAccountDeletion,
  cancelAccountDeletion,
  DEFAULT_USER_PRIVACY,
} from './src/server/managers.ts';

import {
  getPendingBotFiles,
  clearPendingBotFile,
  proxyTelegramFile,
  uploadBufferOrFileToTelegram,
  sendFileToTelegramUser,
  startTelegramBotPolling,
  handleBotUpdate,
  getBotToken,
  getTelegramClientId,
  extractTelegramAuthUser,
  sendVerificationCodeMessage,
  sendTelegramPhoneVerificationRequest,
  sendAccountDeletionScheduledTelegram,
  sendPasswordResetCodeTelegram,
  createTelegramAuthSession,
  getTelegramAuthSession,
  verifyTelegramWidgetData,
  fetchTelegramUserProfilePhotoFileId,
  fetchTelegramUserProfilePhotosList,
  syncLiveTelegramUserData,
  uploadCustomAvatarEphemeralToTelegram,
  saveCustomBioToTelegramStorage,
} from './src/server/telegram.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

function pStr(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] || '';
  return String(val || '');
}

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const id = crypto.randomBytes(6).toString('hex');
    cb(null, `${Date.now()}_${id}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure database is initialized without blocking /api requests for more than 1.5s on cold start
app.use('/api', async (_req: Request, _res: Response, next) => {
  await Promise.race([initDb().catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
  next();
});

// Static assets (1:1 paths for /static/assets/*) with no-cache for JS/CSS upgrades
app.use('/static', (req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.css')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
app.use('/static', express.static(path.join(process.cwd(), 'public', 'static')));
app.use('/static', express.static(path.join(process.cwd(), 'files_mini_app', 'static')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Helper to normalize file object for frontend compatibility
function formatFileForClient(f: Record<string, any>, userId = ''): Record<string, any> {
  const fid = String(f.id || f.file_id || '');
  const ratingInfo = getItemRatings('file', fid, userId);
  const inherited = getInheritedFolderTags(f.folder_id || 'root');
  const fname = f.file_name || f.original_name || f.name || 'ملف';
  const rawType = f.file_type || f.type || 'other';
  const ftype = rawType === 'text' ? 'text_note' : rawType;
  const fsize = Number(f.file_size ?? f.size ?? 0);
  const fsizeFmt = f.file_size_formatted || f.size_formatted || formatSize(fsize);
  const uploadDate = f.upload_date || f.uploaded_at || f.created_at || '';
  return {
    ...f,
    id: fid,
    file_id: fid,
    item_type: 'file',
    name: fname,
    file_name: fname,
    original_name: fname,
    type: ftype,
    file_type: ftype,
    size: fsize,
    file_size: fsize,
    size_formatted: fsizeFmt,
    file_size_formatted: fsizeFmt,
    upload_date: uploadDate,
    created_at: f.created_at || uploadDate,
    content: f.content ?? f.text_content ?? '',
    text_content: f.text_content ?? f.content ?? '',
    has_thumb: true,
    inherited_tags: inherited,
    rating: { avg: ratingInfo.average, average: ratingInfo.average, count: ratingInfo.count },
    user_rating: ratingInfo.user_rating,
  };
}

function formatFolderForClient(
  f: Record<string, any>,
  allFolders: Record<string, Record<string, any>>,
  allFiles: Record<string, Record<string, any>>,
  userId = ''
): Record<string, any> {
  const ratingInfo = getItemRatings('folder', f.id, userId);
  const inherited = getInheritedFolderTags(f.parent_id || 'root');
  const subfoldersCount = Object.values(allFolders).filter((sub) => (sub.parent_id || 'root') === f.id).length;
  const filesCount = Object.values(allFiles).filter(
    (fl) => fl.folder_id !== null && !fl.is_pending_bot && (fl.folder_id || 'root') === f.id
  ).length;
  return {
    ...f,
    id: f.id,
    item_type: 'folder',
    type: 'folder',
    file_type: 'folder',
    upload_date: f.created_at || f.upload_date || '',
    created_at: f.created_at || f.upload_date || '',
    files_count: filesCount,
    subfolders_count: subfoldersCount,
    inherited_tags: inherited,
    rating: { avg: ratingInfo.average, average: ratingInfo.average, count: ratingInfo.count },
    user_rating: ratingInfo.user_rating,
  };
}

function formatQuizForClient(q: Record<string, any>, userId = ''): Record<string, any> {
  const ratingInfo = getItemRatings('quiz', q.id, userId);
  const inherited = getInheritedFolderTags(q.folder_id || 'root');
  const qCount = q.questions_count ?? q.question_count ?? (Array.isArray(q.questions) ? q.questions.length : 0);
  return {
    ...q,
    id: q.id,
    item_type: 'quiz',
    name: q.title || q.name || 'اختبار',
    type: 'quiz',
    file_type: 'quiz',
    upload_date: q.created_at || q.upload_date || '',
    created_at: q.created_at || q.upload_date || '',
    questions_count: qCount,
    question_count: qCount,
    inherited_tags: inherited,
    rating: { avg: ratingInfo.average, average: ratingInfo.average, count: ratingInfo.count },
    user_rating: ratingInfo.user_rating,
  };
}

// ==================== MAIN PAGE (1:1 EXACT COPY) ====================
app.get('/', (_req: Request, res: Response) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  const candidates = [
    path.join(process.cwd(), 'index.html'),
    path.join(process.cwd(), 'files_mini_app', 'templates', 'index.html'),
    path.join(process.cwd(), 'public', 'index.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return res.sendFile(p);
    }
  }
  res.status(404).send('index.html not found');
});

// ==================== CONFIG & HEALTH ====================
function getFirebaseAppletConfig(): Record<string, any> {
  try {
    const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    }
  } catch {
    // ignore
  }
  return {};
}

app.get('/api/config', (_req: Request, res: Response) => {
  const clientId = getTelegramClientId();
  const fbCfg = getFirebaseAppletConfig();
  res.json({
    bot_username: (process.env.BOT_USERNAME || 'NukhaaBot').trim().replace(/^@/, ''),
    bot_id: clientId,
    client_id: clientId,
    google_client_id: (process.env.GOOGLE_CLIENT_ID || fbCfg.oAuthClientId || '').trim(),
    firebase_config: fbCfg,
    app_short_name: (process.env.APP_SHORT_NAME || '').trim(),
    owner_id: OWNER_ID,
  });
});

app.get('/api/db-status', async (_req: Request, res: Response) => {
  const pingOk = await dbPing();
  res.json({
    enabled: dbIsEnabled(),
    connected: pingOk,
    mode: process.env.SUPABASE_DB_URL ? 'supabase' : 'local_store',
    timestamp: nowBaghdadStr(),
  });
});

app.get('/api/files/ping', (_req: Request, res: Response) => {
  const files = getAllFiles();
  res.json({ count: Object.keys(files).length, ts: Date.now() });
});

app.get('/api/pending-bot-files/ping', (_req: Request, res: Response) => {
  const list = getPendingBotFiles();
  const latest = list[0]?.upload_date || '';
  res.json({ count: list.length, latest, items: list });
});

app.get('/api/pending-bot-files', (_req: Request, res: Response) => {
  const list = getPendingBotFiles();
  res.json(list);
});

app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
  const token = getBotToken();
  if (token && req.body) {
    await handleBotUpdate(token, req.body).catch(() => {});
  }
  res.json({ ok: true });
});

app.all('/api/bot-receive', (req: Request, res: Response) => {
  const doc = dbLoadDoc('settings', 'bot_receive') || {};
  const uid = String(req.query.user_id || req.body?.user_id || OWNER_ID);
  if (req.method === 'POST' && req.body && 'enabled' in req.body) {
    doc[uid] = Boolean(req.body.enabled);
    dbSaveDoc('settings', 'bot_receive', doc);
  }
  res.json({ success: true, enabled: doc[uid] !== false });
});

// ==================== AUTH & ROLE & USERS ====================
app.get('/api/role', (req: Request, res: Response) => {
  const userId = String(req.query.user_id || '').trim();
  const role = getUserRole(userId);
  const permissions = getAdminPermissions(userId);
  res.json({
    user_id: userId,
    role,
    is_owner: isOwner(userId),
    is_admin: isAdmin(userId),
    permissions,
    permission_labels: PERMISSION_LABELS,
  });
});

app.post('/api/owner-login', (req: Request, res: Response) => {
  const key = String(req.body?.key || '').trim();
  const expectedKey = (process.env.OWNER_KEY || '').trim();
  if (!key) {
    return res.status(400).json({ success: false, error: 'أدخل الرمز السري' });
  }
  if (expectedKey && key !== expectedKey && key !== OWNER_ID) {
    return res.status(403).json({ success: false, error: 'الرمز السري غير صحيح' });
  }
  registerOrUpdateUser(OWNER_ID, 'المالك', 'owner');
  res.json({
    success: true,
    owner_id: OWNER_ID,
    role: 'owner',
  });
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const b = req.body || {};
  const result = registerPlatformAccount({
    full_name: b.full_name || b.name || '',
    username: b.username || '',
    contact_type: b.contact_type === 'phone' ? 'phone' : 'email',
    email: b.email || '',
    phone: b.phone || '',
    birth_date: b.birth_date || '',
    password: b.password || '',
  });
  if (!result.ok || !result.user) {
    return res.status(400).json({ success: false, error: result.error || 'تعذر إنشاء الحساب' });
  }
  const u = result.user;
  recordUserSession(u.id, {
    session_id: String(b.session_id || req.headers['x-session-id'] || ''),
    device_fp: String(b.device_fp || req.headers['x-device-fp'] || ''),
    user_agent: String(req.headers['user-agent'] || ''),
    ip: String(req.ip || ''),
  });
  let deliveryChannel: 'email' | 'telegram_bot' | 'google_or_smtp_required' = 'google_or_smtp_required';
  if (result.verification_code && u.email) {
    const sent = await sendVerificationCodeMessage(u.email || '', u.telegram_id || '', result.verification_code);
    deliveryChannel = sent.channel;
  }
  res.json({
    success: true,
    verification_channel: deliveryChannel,
    user: {
      ...u,
      role: u.banned ? 'banned' : getUserRole(u.id),
      permissions: getAdminPermissions(u.id),
    },
  });
});

app.post('/api/auth/verify-email', (req: Request, res: Response) => {
  const uid = String(req.body?.user_id || '').trim();
  const code = String(req.body?.code || '').trim();
  const result = verifyUserEmailCode(uid, code);
  if (!result.ok || !result.user) {
    return res.status(400).json({ success: false, error: result.error || 'رمز التأكيد غير صحيح' });
  }
  const u = result.user;
  res.json({
    success: true,
    user: {
      ...u,
      role: u.banned ? 'banned' : getUserRole(u.id),
      permissions: getAdminPermissions(u.id),
    },
  });
});

app.post('/api/auth/resend-verification', async (req: Request, res: Response) => {
  const uid = String(req.body?.user_id || '').trim();
  const customEmail = String(req.body?.email || '').trim();
  const regen = regenerateVerificationCode(uid, customEmail);
  if (!regen.ok) {
    return res.status(400).json({ success: false, error: regen.error || 'تعذر إنشاء رمز التأكيد' });
  }
  if (regen.auto_verified) {
    return res.json({
      success: true,
      auto_verified: true,
      channel: 'google_verified',
      user: regen.user,
    });
  }
  if (!regen.code) {
    return res.status(400).json({ success: false, error: 'تعذر إنشاء رمز التأكيد' });
  }
  const sent = await sendVerificationCodeMessage(regen.email || '', regen.telegram_id || '', regen.code);
  res.json({
    success: sent.sent,
    channel: sent.channel,
    user: regen.user,
    error: sent.sent
      ? undefined
      : 'لتلقي رمز تأكيد البريد مجاناً، اربط حساب تلگرام ليصلك الرمز فوراً عبر البوت، أو اربط حساب كوكل لتأكيد البريد تلقائياً، أو أضف مفتاح RESEND_API_KEY في متغيرات البيئة.',
  });
});

app.post('/api/auth/request-phone-verify', async (req: Request, res: Response) => {
  const uid = String(req.body?.user_id || '').trim();
  const targetTgId = String(req.body?.target_telegram_id || '').trim();
  const u = getUser(uid);
  if (!u) {
    return res.status(404).json({ success: false, error: 'الحساب غير موجود' });
  }
  const tgIdToUse = targetTgId || String(u.primary_bot_telegram_id || u.telegram_id || '').trim();
  if (!u.telegram_linked || !tgIdToUse) {
    return res.status(400).json({
      success: false,
      error: 'يرجى ربط حسابك بتلگرام أولاً، ليتم التحقق من رقم هاتفك الفعلي المرتبط بتلگرام',
    });
  }
  const result = await sendTelegramPhoneVerificationRequest(tgIdToUse);
  if (!result.ok) {
    return res.status(400).json({
      success: false,
      bot_username: result.bot_username,
      error: result.error || 'تعذر إرسال طلب مشاركة رقم الهاتف إلى تلگرام',
    });
  }
  res.json({
    success: true,
    bot_username: result.bot_username,
    target_telegram_id: tgIdToUse,
    message: 'تم إرسال زر مشاركة رقم الهاتف (مع زر الإلغاء) إلى محادثتك مع البوت في تلگرام.',
  });
});

app.post('/api/auth/google', async (req: Request, res: Response) => {
  const b = req.body || {};
  const accessToken = String(b.access_token || '').trim();
  const idToken = String(b.id_token || b.credential || '').trim();
  const accountId = String(b.account_id || '').trim();
  const mode = String(b.mode || (accountId ? 'link' : 'login')).trim();

  if (!accessToken && !idToken) {
    return res.status(400).json({ success: false, error: 'لم يتم استلام رمز مصادقة كوكل الرسمي' });
  }

  let googleProfile: Record<string, any> | null = null;
  let peopleBirthDate = '';
  let peoplePhone = '';
  let peopleGender = '';
  let peopleBio = '';
  let peopleNickname = '';
  let peopleOrganization = '';
  let peopleOccupation = '';
  let peopleAddress = '';
  let peopleLocale = '';
  let peopleUrls: string[] = [];

  try {
    if (accessToken) {
      const [userInfoResp, peopleResp] = await Promise.all([
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(
          'https://people.googleapis.com/v1/people/me?personFields=names,nicknames,emailAddresses,photos,birthdays,phoneNumbers,genders,biographies,organizations,occupations,addresses,locales,urls,ageRanges',
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        ).catch(() => null),
      ]);
      if (userInfoResp.ok) {
        googleProfile = (await userInfoResp.json()) as Record<string, any>;
      }
      if (peopleResp && peopleResp.ok) {
        const pData = (await peopleResp.json()) as Record<string, any>;
        if (Array.isArray(pData.birthdays)) {
          const bdayObj =
            pData.birthdays.find((x: any) => x?.date?.year && x?.date?.month && x?.date?.day) ||
            pData.birthdays.find((x: any) => x?.date?.month && x?.date?.day);
          if (bdayObj?.date) {
            const yr = bdayObj.date.year ? String(bdayObj.date.year).padStart(4, '0') : '2000';
            const mo = String(bdayObj.date.month).padStart(2, '0');
            const dy = String(bdayObj.date.day).padStart(2, '0');
            peopleBirthDate = `${yr}-${mo}-${dy}`;
          }
        }
        if (Array.isArray(pData.phoneNumbers) && pData.phoneNumbers.length > 0) {
          peoplePhone = String(pData.phoneNumbers[0].canonicalForm || pData.phoneNumbers[0].value || '').trim();
        }
        if (Array.isArray(pData.genders) && pData.genders.length > 0) {
          const gVal = String(pData.genders[0].value || '').toLowerCase();
          if (gVal === 'male' || gVal === 'female') peopleGender = gVal;
        }
        if (Array.isArray(pData.biographies) && pData.biographies.length > 0) {
          peopleBio = String(pData.biographies[0].value || '').trim();
        }
        if (Array.isArray(pData.nicknames) && pData.nicknames.length > 0) {
          peopleNickname = String(pData.nicknames[0].value || '').trim();
        }
        if (Array.isArray(pData.organizations) && pData.organizations.length > 0) {
          const org = pData.organizations[0];
          peopleOrganization = [org?.name, org?.title, org?.department].filter(Boolean).join(' — ').trim();
        }
        if (Array.isArray(pData.occupations) && pData.occupations.length > 0) {
          peopleOccupation = String(pData.occupations[0].value || '').trim();
        }
        if (Array.isArray(pData.addresses) && pData.addresses.length > 0) {
          const addr = pData.addresses[0];
          peopleAddress = String(
            addr?.formattedValue || [addr?.city, addr?.region, addr?.country].filter(Boolean).join('، ') || ''
          ).trim();
        }
        if (Array.isArray(pData.locales) && pData.locales.length > 0) {
          peopleLocale = String(pData.locales[0].value || '').trim();
        }
        if (Array.isArray(pData.urls) && pData.urls.length > 0) {
          peopleUrls = pData.urls.map((u: any) => String(u?.value || '').trim()).filter(Boolean);
        }
      }
    }
    if (!googleProfile && idToken) {
      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
      if (r.ok) {
        googleProfile = (await r.json()) as Record<string, any>;
      }
    }
  } catch {
    // ignore
  }

  if (!googleProfile || !googleProfile.sub) {
    return res.status(401).json({ success: false, error: 'فشل التحقق الرسمي من حساب كوكل' });
  }

  const googleData = {
    sub: String(googleProfile.sub).trim(),
    email: String(googleProfile.email || '').trim().toLowerCase(),
    email_verified:
      googleProfile.email_verified === true || String(googleProfile.email_verified) === 'true',
    given_name: String(googleProfile.given_name || '').trim(),
    family_name: String(googleProfile.family_name || '').trim(),
    name: String(googleProfile.name || '').trim(),
    nickname: peopleNickname,
    picture: String(googleProfile.picture || '').trim(),
    phone: peoplePhone,
    birth_date: peopleBirthDate,
    gender: peopleGender,
    bio: peopleBio,
    organization: peopleOrganization,
    occupation: peopleOccupation,
    address: peopleAddress,
    locale: peopleLocale || String(googleProfile.locale || '').trim(),
    urls: peopleUrls,
    access_token: accessToken,
  };

  if (mode === 'link' || mode === 'verify_email' || mode === 'drive_classroom' || accountId) {
    if (!accountId) {
      return res.status(400).json({ success: false, error: 'يرجى تسجيل الدخول أولاً قبل ربط حساب كوكل' });
    }
    const linked = linkGoogleAccount(accountId, googleData);
    if (!linked.ok || !linked.user) {
      return res.status(400).json({ success: false, error: linked.error || 'تعذر ربط حساب كوكل' });
    }
    const u = linked.user;
    return res.json({
      success: true,
      user: {
        ...u,
        role: u.banned ? 'banned' : getUserRole(u.id),
        permissions: getAdminPermissions(u.id),
      },
    });
  }

  const authRes = authenticateGoogleLoginOnly(googleData);
  if (!authRes.ok || !authRes.user) {
    return res.status(403).json({
      success: false,
      error:
        authRes.error ||
        'لا يوجد حساب مسجل في المنصة مرتبط بحساب كوكل هذا. يرجى إنشاء حساب أولاً ثم ربطه بكوكل من الإعدادات.',
    });
  }
  const u = authRes.user;
  const sessCheck = recordUserSession(u.id, {
    session_id: String(b.session_id || req.headers['x-session-id'] || ''),
    device_fp: String(b.device_fp || req.headers['x-device-fp'] || ''),
    user_agent: String(req.headers['user-agent'] || ''),
    ip: String(req.ip || ''),
  });
  if (!sessCheck.allowed) {
    return res.status(403).json({ success: false, error: sessCheck.reason || 'تم حظر هذا الجهاز' });
  }
  res.json({
    success: true,
    user: {
      ...u,
      role: u.banned ? 'banned' : getUserRole(u.id),
      permissions: getAdminPermissions(u.id),
    },
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const b = req.body || {};
  const result = authenticatePlatformAccount(
    b.identifier || b.username || b.email || b.phone || '',
    b.password || ''
  );
  if (!result.ok || !result.user) {
    return res.status(401).json({ success: false, error: result.error || 'بيانات الدخول غير صحيحة' });
  }
  const u = result.user;
  const sessCheck = recordUserSession(u.id, {
    session_id: String(b.session_id || req.headers['x-session-id'] || ''),
    device_fp: String(b.device_fp || req.headers['x-device-fp'] || ''),
    user_agent: String(req.headers['user-agent'] || ''),
    ip: String(req.ip || ''),
  });
  if (!sessCheck.allowed) {
    return res.status(403).json({ success: false, error: sessCheck.reason || 'تم حظر هذا الجهاز' });
  }
  res.json({
    success: true,
    user: {
      ...u,
      role: u.banned ? 'banned' : getUserRole(u.id),
      permissions: getAdminPermissions(u.id),
    },
  });
});

app.post('/api/auth/telegram-widget', async (req: Request, res: Response) => {
  const b = req.body || {};
  const tgUser = extractTelegramAuthUser(b);
  const accountId = String(b.account_id || '').trim();
  const mode = String(b.mode || (accountId ? 'link' : 'login')).trim();
  const isMiniApp = Boolean(b.from_mini_app);

  if (!tgUser || !tgUser.id) {
    return res.status(400).json({ success: false, error: 'بيانات تلگرام غير مكتملة' });
  }
  if (!isMiniApp && !tgUser.is_oidc && tgUser.hash && getBotToken()) {
    const valid = verifyTelegramWidgetData(tgUser);
    if (!valid) {
      return res.status(403).json({ success: false, error: 'فشل التحقق من توقيع تلگرام' });
    }
  }

  const tgId = String(tgUser.id).trim();
  const photoFid = await fetchTelegramUserProfilePhotoFileId(tgId).catch(() => null);

  if (mode === 'link' || accountId) {
    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'يرجى إنشاء حساب وتسجيل الدخول أولاً قبل ربط الحساب بتلگرام',
      });
    }
    const linked = linkTelegramAccount(accountId, {
      id: tgId,
      first_name: tgUser.first_name || '',
      last_name: tgUser.last_name || '',
      username: tgUser.username || '',
      photo_url: tgUser.photo_url || '',
      phone_number: tgUser.phone_number || '',
    });
    if (!linked.ok || !linked.user) {
      return res.status(400).json({ success: false, error: linked.error || 'تعذر ربط حساب تلگرام' });
    }
    let u = linked.user;
    if (photoFid) {
      u = updateUserSettings(u.id, { tg_photo_file_id: photoFid, target_telegram_id: tgId });
    }
    await syncLiveTelegramUserData(tgId, u.id).catch(() => null);
    u = getUser(u.id) || u;
    return res.json({
      success: true,
      user: {
        ...u,
        role: u.banned ? 'banned' : getUserRole(u.id),
        permissions: getAdminPermissions(u.id),
      },
    });
  }

  // Login via Telegram: ONLY allowed for already registered & linked platform accounts!
  const authResult = authenticateTelegramLoginOnly(tgId);
  if (!authResult.ok || !authResult.user) {
    return res.status(403).json({
      success: false,
      error:
        authResult.error ||
        'لا يوجد حساب مسجل في المنصة مرتبط بحساب تلگرام هذا. يرجى إنشاء حساب أولاً ثم ربطه بتلگرام من الإعدادات.',
    });
  }
  let u = authResult.user;
  const sessCheck = recordUserSession(u.id, {
    session_id: String(b.session_id || req.headers['x-session-id'] || ''),
    device_fp: String(b.device_fp || req.headers['x-device-fp'] || ''),
    user_agent: String(req.headers['user-agent'] || ''),
    ip: String(req.ip || ''),
  });
  if (!sessCheck.allowed) {
    return res.status(403).json({ success: false, error: sessCheck.reason || 'تم حظر هذا الجهاز' });
  }
  if (photoFid) {
    u = updateUserSettings(u.id, { tg_photo_file_id: photoFid, target_telegram_id: tgId });
  }
  res.json({
    success: true,
    user: {
      ...u,
      role: u.banned ? 'banned' : getUserRole(u.id),
      permissions: getAdminPermissions(u.id),
    },
  });
});

app.post('/api/auth/telegram-session', (req: Request, res: Response) => {
  const accountId = String(req.body?.account_id || '').trim();
  const token = createTelegramAuthSession(accountId);
  const botUsername = (process.env.BOT_USERNAME || '').trim().replace(/^@/, '');
  res.json({
    success: true,
    token,
    bot_username: botUsername,
    url: botUsername ? `https://t.me/${botUsername}?start=auth_${token}` : '',
  });
});

app.get('/api/auth/telegram-session/:token', (req: Request, res: Response) => {
  const session = getTelegramAuthSession(pStr(req.params.token));
  if (!session) {
    return res.status(404).json({ success: false, status: 'expired' });
  }
  if (session.status === 'failed') {
    return res.json({
      success: false,
      status: 'failed',
      error:
        session.error ||
        'لا يوجد حساب مسجل في المنصة مرتبط بحساب تلگرام هذا. يرجى إنشاء حساب أولاً ثم ربطه بتلگرام من الإعدادات.',
    });
  }
  if (session.status === 'completed' && session.user) {
    const u = getUser(session.user.id) || session.user;
    return res.json({
      success: true,
      status: 'completed',
      user: {
        ...u,
        role: u.banned ? 'banned' : getUserRole(u.id),
        permissions: getAdminPermissions(u.id),
      },
    });
  }
  res.json({ success: true, status: 'pending' });
});

app.post('/api/users/register', async (req: Request, res: Response) => {
  const b = req.body || {};
  const uid = String(b.id || b.user_id || '').trim();
  if (!uid) return res.status(400).json({ error: 'user id required' });
  const displayName = b.display_name || [b.first_name, b.last_name].filter(Boolean).join(' ') || `مستخدم ${uid}`;
  const user = registerOrUpdateUser(uid, displayName, b.username || '', b.photo_url || '', {
    first_name: b.first_name || displayName,
    last_name: b.last_name || '',
    display_name: displayName,
    language: b.language_code || 'ar',
  });
  if (/^\d{5,}$/.test(uid) && !user.tg_photo_file_id) {
    fetchTelegramUserProfilePhotoFileId(uid).catch(() => {});
  }
  res.json({
    success: true,
    user: {
      ...user,
      role: user.banned ? 'banned' : getUserRole(user.id),
      permissions: getAdminPermissions(user.id),
    },
  });
});

app.get('/api/users', (_req: Request, res: Response) => {
  const users = Object.values(getAllUsers()).map((u) => ({
    ...u,
    first_name: u.first_name || u.name || u.id,
    display_name: u.display_name || u.name || u.first_name || u.id,
    role: u.banned ? 'banned' : getUserRole(u.id),
    last_active: u.last_active || u.last_seen,
  }));
  res.json(users);
});

app.get('/api/users/active', (req: Request, res: Response) => {
  const mins = Number(req.query.minutes) || 5;
  res.json({ users: getActiveUsers(mins) });
});

app.get('/api/users/:user_id', async (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  let u = getUser(uid);
  if (!u) {
    return res.status(404).json({ error: 'الحساب غير موجود', not_found: true });
  }

  // Non-blocking background sync with Telegram profile (only await if ?sync=1 is explicitly requested)
  if (u.telegram_linked && u.telegram_id && !u.telegram_unlinked) {
    if (req.query.sync === '1') {
      const synced = await syncLiveTelegramUserData(String(u.telegram_id), u.id || uid).catch(() => null);
      if (synced) u = synced;
    } else {
      syncLiveTelegramUserData(String(u.telegram_id), u.id || uid).catch(() => null);
    }
  }

  const canonicalId = u.id || uid;
  const viewerId = String(req.query.viewer_id || req.query.requester_id || '').trim();
  const viewerIsOwner = viewerId ? isOwner(viewerId) : false;
  const viewerIsSelf =
    !viewerId ||
    viewerId === canonicalId ||
    viewerId === uid ||
    (u.telegram_id && viewerId === String(u.telegram_id)) ||
    (u.platform_id && viewerId.toUpperCase() === String(u.platform_id).toUpperCase());

  if (viewerIsSelf) {
    const sid = String(req.headers['x-session-id'] || req.query.session_id || '').trim();
    const fp = String(req.headers['x-device-fp'] || req.query.device_fp || '').trim();
    if (sid || fp) {
      const sessRes = recordUserSession(canonicalId, {
        session_id: sid || fp,
        device_fp: fp || sid,
        user_agent: String(req.headers['user-agent'] || ''),
        ip: String(req.ip || ''),
      });
      if (!sessRes.allowed) {
        return res.status(403).json({
          error: sessRes.reason || 'تم إنهاء الجلسة أو حظر هذا الجهاز',
          session_revoked: true,
        });
      }
      u = getUser(canonicalId) || u;
    }
  }

  const privacy = {
    ...DEFAULT_USER_PRIVACY,
    ...(u.privacy || {}),
  };

  const allFiles = Object.values(getAllFiles());
  const userFiles = allFiles.filter((f) => {
    const up = String(f.uploaded_by?.id || f.uploaded_by || f.creator_id || '');
    return up === canonicalId || up === uid || (u.telegram_id && up === String(u.telegram_id)) || (u.platform_id && up === String(u.platform_id));
  });

  const fullStats = {
    uploads: userFiles.length,
    downloads: u.stats?.downloads ?? u.downloads ?? 0,
    downloads_count: u.stats?.downloads ?? u.downloads ?? 0,
    files_uploaded: userFiles.length,
    visits: u.activity_count || u.visits || 1,
    ...(u.stats || {}),
  };

  // Enforce privacy rules when viewed by someone other than the user or the Owner
  const responseUser: Record<string, any> = {
    ...u,
    id: canonicalId,
    first_name: u.first_name || u.name || canonicalId,
    display_name: u.display_name || u.name || canonicalId,
    role: u.banned ? 'banned' : getUserRole(canonicalId),
    permissions: getAdminPermissions(canonicalId),
    privacy,
    viewer_is_owner: viewerIsOwner,
    viewer_is_self: viewerIsSelf,
    stats: viewerIsSelf || viewerIsOwner || privacy.show_stats ? fullStats : { hidden: true, uploads: 0, downloads: 0, visits: 0 },
  };

  if (!viewerIsSelf && !viewerIsOwner) {
    delete responseUser.sessions;
    delete responseUser.blocked_devices;
    if (privacy.show_platform_id === false) {
      responseUser.platform_id_hidden = true;
    }
    if (privacy.show_first_name === false) responseUser.first_name = '';
    if (privacy.show_last_name === false) responseUser.last_name = '';
    if (privacy.show_username === false) responseUser.username = '';
    if (!privacy.show_email) responseUser.email = '';
    if (!privacy.show_phone) {
      responseUser.phone = '';
      responseUser.tg_phone = '';
    }
    if (!privacy.show_birth_date) responseUser.birth_date = '';
    if (privacy.show_gender === false) responseUser.gender = '';
    if (privacy.show_bio === false) {
      responseUser.bio = '';
      responseUser.custom_bio = '';
      responseUser.tg_bio = '';
    }
    const hiddenTgAccs: string[] = Array.isArray(privacy.hidden_tg_accounts) ? privacy.hidden_tg_accounts : [];
    const hiddenGoogleAccs: string[] = Array.isArray(privacy.hidden_google_accounts) ? privacy.hidden_google_accounts : [];
    if (!privacy.show_telegram) {
      responseUser.telegram_id = '';
      responseUser.tg_username = '';
      responseUser.tg_first_name = '';
      responseUser.tg_last_name = '';
      responseUser.tg_phone = '';
      responseUser.telegram_accounts = [];
    } else if (Array.isArray(responseUser.telegram_accounts)) {
      responseUser.telegram_accounts = responseUser.telegram_accounts.filter((a: any) => !hiddenTgAccs.includes(String(a.id || '')));
    }
    if (!privacy.show_google) {
      responseUser.google_id = '';
      responseUser.google_email = '';
      responseUser.google_given_name = '';
      responseUser.google_family_name = '';
      responseUser.google_name = '';
      responseUser.google_accounts = [];
    } else if (Array.isArray(responseUser.google_accounts)) {
      responseUser.google_accounts = responseUser.google_accounts.filter((a: any) => !hiddenGoogleAccs.includes(String(a.sub || '')));
    }
  }

  res.json(responseUser);
});

app.post('/api/auth/change-password', (req: Request, res: Response) => {
  const b = req.body || {};
  const uid = String(b.user_id || '').trim();
  const currentPw = String(b.current_password || '');
  const newPw = String(b.new_password || '');
  const result = changeUserPassword(uid, currentPw, newPw);
  if (!result.ok || !result.user) {
    return res.status(400).json({ success: false, error: result.error || 'تعذر تغيير كلمة المرور' });
  }
  res.json({ success: true, user: result.user });
});

app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  const identifier = String(req.body?.identifier || '').trim();
  const initRes = initiatePasswordReset(identifier);
  if (!initRes.ok || !initRes.code) {
    return res.status(400).json({ success: false, error: initRes.error || 'تعذر بدء استعادة كلمة المرور' });
  }
  let sentTelegram = false;
  let sentEmail = false;
  if (initRes.telegram_id) {
    const tgSent = await sendPasswordResetCodeTelegram(initRes.telegram_id, initRes.code).catch(() => ({ ok: false }));
    sentTelegram = Boolean(tgSent.ok);
  }
  if (initRes.email) {
    const emSent = await sendVerificationCodeMessage(initRes.email, '', initRes.code).catch(() => ({ sent: false }));
    sentEmail = Boolean(emSent.sent);
  }
  if (!sentTelegram && !sentEmail) {
    return res.status(400).json({
      success: false,
      error: 'تعذر إرسال رمز الاستعادة. تأكد من أن حسابك مرتبط بتلگرام وأنك قمت بمراسلة البوت، أو أن البريد مفعل.',
    });
  }
  res.json({
    success: true,
    sent_telegram: sentTelegram,
    sent_email: sentEmail,
    message: sentTelegram
      ? 'تم إرسال رمز الاستعادة (6 أرقام) إلى حسابك المرتبط في تلگرام'
      : 'تم إرسال رمز الاستعادة (6 أرقام) إلى بريدك الإلكتروني',
  });
});

app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const b = req.body || {};
  const identifier = String(b.identifier || '').trim();
  const code = String(b.code || '').trim();
  const newPw = String(b.new_password || '');
  const resReset = completePasswordReset(identifier, code, newPw);
  if (!resReset.ok || !resReset.user) {
    return res.status(400).json({ success: false, error: resReset.error || 'تعذر إعادة تعيين كلمة المرور' });
  }
  const u = resReset.user;
  res.json({
    success: true,
    user: {
      ...u,
      role: u.banned ? 'banned' : getUserRole(u.id),
      permissions: getAdminPermissions(u.id),
    },
  });
});

app.put('/api/owner/users/:user_id', (req: Request, res: Response) => {
  const targetId = pStr(req.params.user_id).trim();
  const requesterId = String(req.body?.requester_id || req.query.requester_id || '').trim();
  const result = ownerUpdateUserFull(requesterId, targetId, req.body || {});
  if (!result.ok || !result.user) {
    return res.status(403).json({ success: false, error: result.error || 'تعذر تحديث بيانات المستخدم' });
  }
  res.json({ success: true, user: result.user });
});

app.get('/api/users/:user_id/telegram-photos', async (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const targetTg = String(req.query.telegram_id || '').trim();
  const u = getUser(uid);
  if (!u || !u.telegram_linked || (!u.telegram_id && !targetTg)) {
    return res.json({ success: true, photos: [], selected_file_id: '' });
  }
  const tgId = targetTg || String(u.telegram_id).trim();
  const rawDoc = dbLoadDoc('users', u.id) || {};
  const archived = Array.isArray(rawDoc.tg_photos_archive) ? rawDoc.tg_photos_archive : [];
  const photos = await fetchTelegramUserProfilePhotosList(tgId, archived);
  if (photos.length > 0) {
    archiveUserTelegramPhotos(u.id, photos);
  }
  const hiddenIds: string[] = Array.isArray(u.hidden_photo_ids) ? u.hidden_photo_ids : [];
  res.json({
    success: true,
    telegram_id: tgId,
    photos: photos.map((p, idx) => ({
      ...p,
      index: idx,
      hidden: hiddenIds.includes(p.file_id),
    })),
    selected_file_id: u.selected_tg_photo_file_id || u.tg_photo_file_id || (photos[0]?.file_id || ''),
    tab_visible: u.privacy?.show_photos_telegram !== false,
  });
});

app.get('/api/users/:user_id/photos-gallery', async (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const u = getUser(uid);
  if (!u) {
    return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
  }
  const canonicalId = String(u.id || uid);
  const viewerId = String(req.query.viewer_id || req.query.requester_id || '').trim();
  const viewerIsOwner = viewerId ? isOwner(viewerId) : false;
  const viewerIsSelf =
    !viewerId ||
    viewerId === canonicalId ||
    viewerId === uid ||
    (u.telegram_id && viewerId === String(u.telegram_id)) ||
    (u.platform_id && viewerId.toUpperCase() === String(u.platform_id).toUpperCase());

  const canSeeHidden = viewerIsSelf || viewerIsOwner;
  const privacy = {
    ...DEFAULT_USER_PRIVACY,
    ...(u.privacy || {}),
  };
  const hiddenIds = new Set<string>(Array.isArray(u.hidden_photo_ids) ? u.hidden_photo_ids : []);

  // 1. Custom photos
  const rawCustom: Array<{ id: string; file_id: string; added_at: string }> = Array.isArray(u.custom_photos)
    ? u.custom_photos
    : [];
  const customTabVisible = privacy.show_photos_custom !== false;
  const customList =
    !canSeeHidden && !customTabVisible
      ? []
      : rawCustom
          .filter((cp) => canSeeHidden || !hiddenIds.has(cp.file_id))
          .map((cp) => ({
            id: cp.id,
            file_id: cp.file_id,
            added_at: cp.added_at,
            url: `/api/user/photo/${encodeURIComponent(canonicalId)}?file_id=${encodeURIComponent(cp.file_id)}`,
            active: u.custom_photo_file_id === cp.file_id,
            hidden: hiddenIds.has(cp.file_id),
          }));

  // 2. Telegram photos
  let tgList: Array<Record<string, any>> = [];
  const tgTabVisible = privacy.show_photos_telegram !== false;
  if (u.telegram_linked && u.telegram_id && (canSeeHidden || tgTabVisible)) {
    const rawDoc = dbLoadDoc('users', canonicalId) || {};
    const archived = Array.isArray(rawDoc.tg_photos_archive) ? rawDoc.tg_photos_archive : [];
    const liveTgPhotos = await fetchTelegramUserProfilePhotosList(String(u.telegram_id), archived).catch(() => []);
    if (liveTgPhotos.length > 0) {
      archiveUserTelegramPhotos(canonicalId, liveTgPhotos);
    }
    const selTgFid = u.selected_tg_photo_file_id || u.tg_photo_file_id || liveTgPhotos[0]?.file_id || '';
    tgList = liveTgPhotos
      .filter((tp) => canSeeHidden || !hiddenIds.has(tp.file_id))
      .map((tp, idx) => ({
        index: idx,
        file_id: tp.file_id,
        url: `/api/user/photo/${encodeURIComponent(canonicalId)}?file_id=${encodeURIComponent(tp.file_id)}`,
        active: selTgFid === tp.file_id,
        is_main: idx === 0,
        hidden: hiddenIds.has(tp.file_id),
      }));
  }

  // 3. Google photos (across linked Google accounts)
  let googleList: Array<Record<string, any>> = [];
  const googleTabVisible = privacy.show_photos_google !== false;
  if (u.google_linked && (canSeeHidden || googleTabVisible)) {
    const gAccounts: Array<Record<string, any>> = Array.isArray(u.google_accounts) && u.google_accounts.length > 0
      ? u.google_accounts
      : u.google_photo_url
      ? [{ sub: u.google_id || 'main', email: u.google_email || '', name: u.google_name || '', picture: u.google_photo_url }]
      : [];
    googleList = gAccounts
      .filter((ga) => ga.picture && (canSeeHidden || !hiddenIds.has(`google_${ga.sub}`)))
      .map((ga) => ({
        id: `google_${ga.sub}`,
        file_id: `google_${ga.sub}`,
        email: ga.email || '',
        name: ga.name || '',
        url: ga.picture,
        active: String(u.google_id || '') === String(ga.sub || ''),
        hidden: hiddenIds.has(`google_${ga.sub}`),
      }));
  }

  res.json({
    success: true,
    active_source: u.photo_source || 'custom',
    viewer_can_see_hidden: canSeeHidden,
    tabs: {
      custom: {
        visible: customTabVisible,
        photos: customList,
      },
      telegram: {
        visible: tgTabVisible,
        linked: Boolean(u.telegram_linked),
        photos: tgList,
      },
      google: {
        visible: googleTabVisible,
        linked: Boolean(u.google_linked),
        photos: googleList,
      },
    },
  });
});

const handleCustomPhotosRoute = (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const result = manageUserCustomPhotos(uid, req.body || {});
  if (!result.ok || !result.user) {
    return res.status(400).json({ success: false, error: result.error || 'تعذر تحديث الصور' });
  }
  res.json({ success: true, user: result.user });
};
app.put('/api/users/:user_id/custom-photos', handleCustomPhotosRoute);
app.post('/api/users/:user_id/custom-photos', handleCustomPhotosRoute);
app.post('/api/users/:user_id/custom-photos/action', handleCustomPhotosRoute);

app.post('/api/users/:user_id/switch-telegram', (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const targetTgId = String(req.body?.telegram_id || req.body?.target_id || '').trim();
  const switched = switchPrimaryTelegramAccount(uid, targetTgId);
  if (!switched.ok || !switched.user) {
    return res.status(400).json({ success: false, error: switched.error || 'تعذر تبديل حساب تلگرام الرئيسي' });
  }
  res.json({ success: true, user: switched.user });
});

app.post('/api/users/:user_id/unlink-telegram', (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const rawTarget = req.body?.telegram_id || req.body?.target_id;
  const targetTgId = rawTarget ? String(rawTarget).trim() : undefined;
  const unlinked = unlinkTelegramAccount(uid, targetTgId);
  if (!unlinked.ok || !unlinked.user) {
    return res.status(400).json({ success: false, error: unlinked.error || 'تعذر إلغاء الربط' });
  }
  res.json({ success: true, user: unlinked.user });
});

app.post('/api/users/:user_id/unlink-google', (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const rawSub = req.body?.sub || req.body?.target_id || req.body?.google_id;
  const sub = rawSub ? String(rawSub).trim() : undefined;
  const unlinked = unlinkGoogleAccount(uid, sub);
  if (!unlinked.ok || !unlinked.user) {
    return res.status(400).json({ success: false, error: unlinked.error || 'تعذر إلغاء ربط حساب كوكل' });
  }
  res.json({ success: true, user: unlinked.user });
});

app.get('/api/users/:user_id/sessions', (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const u = getUser(uid);
  if (!u) {
    return res.status(404).json({ success: false, error: 'الحساب غير موجود' });
  }
  res.json({
    success: true,
    sessions: Array.isArray(u.sessions) ? u.sessions : [],
    blocked_devices: Array.isArray(u.blocked_devices) ? u.blocked_devices : [],
  });
});

const handleUserSessionsAction = (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const body = req.body || {};
  const result = manageUserSessions(uid, {
    ...body,
    target_session_id: body.target_session_id || body.session_id,
    device_fp: body.device_fp || body.fingerprint,
  });
  if (!result.ok || !result.user) {
    return res.status(400).json({ success: false, error: result.error || 'تعذر تحديث الجلسات والأجهزة' });
  }
  res.json({
    success: true,
    user: result.user,
    sessions: Array.isArray(result.user.sessions) ? result.user.sessions : [],
    blocked_devices: Array.isArray(result.user.blocked_devices) ? result.user.blocked_devices : [],
  });
};
app.post('/api/users/:user_id/sessions', handleUserSessionsAction);
app.post('/api/users/:user_id/sessions/action', handleUserSessionsAction);

app.post('/api/users/:user_id/schedule-delete', async (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const password = String(req.body?.password || '');
  const formattedDateClient = String(req.body?.formatted_date || '');
  const result = scheduleAccountDeletion(uid, password);
  if (!result.ok || !result.user) {
    return res.status(400).json({ success: false, error: result.error || 'تعذر جدولة حذف الحساب' });
  }
  if (result.telegram_id && result.execute_at) {
    const dateLabel = formattedDateClient || new Date(result.execute_at).toLocaleString('ar-IQ');
    await sendAccountDeletionScheduledTelegram(
      result.telegram_id,
      result.user.id,
      result.user.platform_id || result.user.id,
      dateLabel
    ).catch(() => {});
  }
  res.json({
    success: true,
    user: result.user,
    execute_at: result.execute_at,
  });
});

app.post('/api/users/:user_id/cancel-delete', (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const result = cancelAccountDeletion(uid);
  if (!result.ok || !result.user) {
    return res.status(400).json({ success: false, error: result.error || 'تعذر إلغاء جدولة حذف الحساب' });
  }
  res.json({ success: true, user: result.user });
});

app.put('/api/users/:user_id/settings', async (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const body = { ...(req.body || {}) };
  if (body.custom_bio !== undefined) {
    const existingRaw = dbLoadDoc('users', uid) || getUser(uid) || {};
    const prevBio = String(existingRaw.custom_bio || '').trim();
    const nextBio = String(body.custom_bio || '').trim();
    if (nextBio && (nextBio !== prevBio || !existingRaw.custom_bio_msg_id)) {
      const savedMsg = await saveCustomBioToTelegramStorage(
        String(existingRaw.platform_id || uid),
        nextBio,
        Number(existingRaw.custom_bio_msg_id) || undefined,
        String(existingRaw.custom_bio_chat_id || '') || undefined
      ).catch(() => null);
      if (savedMsg?.message_id) {
        body.custom_bio_msg_id = savedMsg.message_id;
        body.custom_bio_chat_id = savedMsg.chat_id;
      }
    }
  }
  const updatedUser = updateUserSettings(uid, body);
  res.json({ success: true, settings: updatedUser, user: updatedUser });
});

app.post('/api/users/:user_id/avatar', upload.single('photo'), async (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const file = req.file;
  if (!uid || !file) {
    return res.status(400).json({ success: false, error: 'اختر صورة صالحة للرفع' });
  }
  try {
    const userDoc = getUser(uid);
    const preferredChatId = String(userDoc?.telegram_id || (userDoc?.telegram_linked ? uid : '') || '').trim();

    // Ephemeral upload: uploads to Telegram user's chat (or owner if not linked), captures file_id, and immediately deletes message!
    const tgUpload = await uploadCustomAvatarEphemeralToTelegram(file.path, preferredChatId).catch(() => null);

    let dataUrl = '';
    // Only if Telegram Bot API is unavailable, keep a small compressed dataUrl fallback
    if (!tgUpload?.file_id) {
      const buffer = fs.readFileSync(file.path);
      const mime = file.mimetype && file.mimetype.startsWith('image/') ? file.mimetype : 'image/jpeg';
      dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    }

    try {
      fs.unlinkSync(file.path);
    } catch {}

    const settingsUpdate: Record<string, any> = {
      custom_photo_file_id: tgUpload?.file_id || '',
      custom_photo_data: dataUrl, // empty when tgUpload succeeds, saving zero DB space!
      photo_source: 'custom',
    };
    const updatedUser = updateUserSettings(uid, settingsUpdate);
    res.json({
      success: true,
      user: updatedUser,
    });
  } catch {
    try {
      if (file?.path) fs.unlinkSync(file.path);
    } catch {}
    res.status(500).json({
      success: false,
      error: 'تعذر حفظ الصورة الشخصية',
    });
  }
});

app.post('/api/users/:user_id/ban', (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const banned = req.body?.banned !== undefined ? Boolean(req.body.banned) : true;
  const updated = setBanStatus(uid, banned, req.body?.reason || '');
  res.json({ success: Boolean(updated), user: updated });
});

app.post('/api/users/:user_id/promote', (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const u = getUser(uid);
  const resAdd = addAdmin(uid, u?.first_name || u?.name || uid, u?.username || '', req.body?.requester_id || OWNER_ID, req.body?.permissions);
  res.json({ success: resAdd.ok, admin: resAdd.admin, error: resAdd.error });
});

app.get('/api/user/photo/:user_id', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const uid = pStr(req.params.user_id).trim();
  const explicitFileId = String(req.query.file_id || '').trim();
  if (explicitFileId) {
    const streamed = await proxyTelegramFile(explicitFileId, res);
    if (streamed) return;
    return res.status(404).end();
  }

  const u = getUser(uid);
  if (!u) return res.status(404).end();
  const canonicalId = String(u.id || uid);

  const reqSource = String(req.query.source || '').trim();

  // If caller explicitly requests the main Telegram profile photo (e.g., for the Telegram linked card)
  if (reqSource === 'telegram_main') {
    if (!u.telegram_unlinked && u.telegram_linked) {
      const tgId = String(u.telegram_id || (/^\d{5,}$/.test(canonicalId) ? canonicalId : '') || '').trim();
      const mainTgFid = u.tg_photo_file_id || (tgId ? await fetchTelegramUserProfilePhotoFileId(tgId, false) : null);
      if (mainTgFid) {
        const streamed = await proxyTelegramFile(String(mainTgFid), res);
        if (streamed) return;
      }
    }
    return res.status(404).end();
  }

  const photoSource =
    reqSource === 'telegram' || reqSource === 'google' || reqSource === 'custom'
      ? reqSource
      : u.photo_source === 'google'
      ? 'google'
      : u.photo_source === 'custom'
      ? 'custom'
      : 'telegram';

  if (photoSource === 'google' && u.google_linked && u.google_photo_url) {
    try {
      const upstream = await fetch(String(u.google_photo_url), { signal: AbortSignal.timeout(3500) });
      if (upstream.ok) {
        const ct = upstream.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', ct);
        const ab = await upstream.arrayBuffer();
        return res.send(Buffer.from(ab));
      }
    } catch {
      return res.status(404).end();
    }
  }

  if (photoSource === 'custom' || (!u.telegram_linked && photoSource !== 'google')) {
    const rawPhoto = getRawUserPhotoData(canonicalId) || getRawUserPhotoData(uid);
    if (rawPhoto) {
      res.setHeader('Content-Type', rawPhoto.mime);
      return res.send(rawPhoto.buffer);
    }
    if (u.custom_photo_file_id) {
      const streamed = await proxyTelegramFile(String(u.custom_photo_file_id), res);
      if (streamed) return;
    }
    return res.status(404).end();
  }

  // Telegram sync mode: serve selected Telegram photo if chosen, otherwise main Telegram photo
  if (!u.telegram_unlinked && u.telegram_linked) {
    const tgId = String(u.telegram_id || (/^\d{5,}$/.test(canonicalId) ? canonicalId : '') || '').trim();
    const chosenTgFid =
      u.selected_tg_photo_file_id ||
      u.tg_photo_file_id ||
      (tgId ? await fetchTelegramUserProfilePhotoFileId(tgId, false) : null);
    if (chosenTgFid) {
      const streamed = await proxyTelegramFile(String(chosenTgFid), res);
      if (streamed) return;
    }
  }

  if (u.photo_url && String(u.photo_url).startsWith('http')) {
    try {
      const upstream = await fetch(String(u.photo_url), { signal: AbortSignal.timeout(3500) });
      if (upstream.ok) {
        const ct = upstream.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', ct);
        const ab = await upstream.arrayBuffer();
        return res.send(Buffer.from(ab));
      }
    } catch {
      // fall through
    }
  }

  res.status(404).end();
});

app.get('/api/users/:user_id/ai-settings', (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const doc = dbLoadDoc('ai_settings', uid) || {};
  res.json({ success: true, settings: doc });
});

app.put('/api/users/:user_id/ai-settings', (req: Request, res: Response) => {
  const uid = pStr(req.params.user_id).trim();
  const current = dbLoadDoc('ai_settings', uid) || {};
  const updated = { ...current, ...(req.body || {}), updated_at: nowBaghdadStr() };
  dbSaveDoc('ai_settings', uid, updated);
  res.json({ success: true, settings: updated });
});

// ==================== ADMINS ====================
app.get('/api/admins', (_req: Request, res: Response) => {
  const adminsMap = getAllAdmins();
  const list = Object.values(adminsMap).map((a) => ({
    ...a,
    first_name: a.first_name || a.name || a.id,
  }));
  res.json({ admins: list, items: list, default_permissions: DEFAULT_PERMISSIONS, labels: PERMISSION_LABELS });
});

app.post('/api/admins/add', (req: Request, res: Response) => {
  const b = req.body || {};
  const targetId = String(b.user_id || b.admin_id || b.id || '').trim();
  const result = addAdmin(targetId, b.name || '', b.username || '', b.requester_id || OWNER_ID, b.permissions);
  if (!result.ok) return res.status(400).json({ success: false, error: result.error });
  res.json({ success: true, admin: result.admin });
});

app.delete('/api/admins/:admin_id', (req: Request, res: Response) => {
  const ok = removeAdmin(pStr(req.params.admin_id));
  res.json({ success: ok });
});

app.put('/api/admins/:admin_id/permissions', (req: Request, res: Response) => {
  const updated = updateAdminPermissions(pStr(req.params.admin_id), req.body?.permissions || req.body || {});
  if (!updated) return res.status(404).json({ success: false, error: 'المشرف غير موجود' });
  res.json({ success: true, admin: updated });
});

// ==================== CONTENTS & FOLDERS & FILES ====================
app.get('/api/contents', (req: Request, res: Response) => {
  const folderId = String(req.query.folder_id || 'root').trim() || 'root';
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const perPage = Math.max(1, parseInt(String(req.query.per_page || '100000'), 10) || 100000);
  const q = String(req.query.q || '').trim();
  const sortBy = String(req.query.sort_by || 'date').trim();
  const sortOrder = String(req.query.sort_order || 'desc').trim();
  const userId = String(req.query.user_id || '').trim();
  const searchDeep = req.query.search_deep === '1' || req.query.search_deep === 'true' || Boolean(q);

  const rawTags = String(req.query.tags || '').trim();
  const simpleTags = rawTags ? rawTags.split(',').map((t) => t.trim()).filter(Boolean) : [];
  let tagFilterGroups: string[][] = [];
  if (req.query.tag_filters) {
    try {
      const parsed = JSON.parse(String(req.query.tag_filters));
      if (Array.isArray(parsed)) {
        tagFilterGroups = parsed
          .map((g) => (Array.isArray(g) ? g.map(String) : [String(g)]))
          .filter((g) => g.length > 0);
      }
    } catch {
      // ignore invalid JSON
    }
  } else if (simpleTags.length > 0) {
    tagFilterGroups = simpleTags.map((t) => [t]);
  }
  const tagMatch = String(req.query.tag_match || 'all') === 'any' ? 'any' : 'all';

  const allFolders = getAllFolders();
  const allFiles = getAllFiles();
  const allQuizzes = getAllQuizzes();
  const allQuestions = getAllQuestions();

  let allowedFolderIds: Set<string> | null = null;
  if (!searchDeep) {
    allowedFolderIds = new Set([folderId === 'root' ? 'root' : folderId]);
  } else if (folderId !== 'root') {
    const desc = getDescendantFolderIds(folderId);
    allowedFolderIds = new Set([folderId, ...desc]);
  }

  const items: Array<Record<string, any>> = [];

  // 1. Folders
  for (const f of Object.values(allFolders)) {
    if (f.id === 'root') continue;
    const parentId = f.parent_id || 'root';
    if (allowedFolderIds && !allowedFolderIds.has(parentId)) continue;
    items.push(formatFolderForClient(f, allFolders, allFiles, userId));
  }

  // 2. Files (skip pending bot files that have folder_id === null)
  for (const fl of Object.values(allFiles)) {
    if (fl.folder_id === null || fl.is_pending_bot === true) continue;
    const fid = fl.folder_id || 'root';
    if (allowedFolderIds && !allowedFolderIds.has(fid)) continue;
    items.push(formatFileForClient(fl, userId));
  }

  // 3. Quizzes
  for (const qz of allQuizzes) {
    const fid = qz.folder_id || 'root';
    if (allowedFolderIds && !allowedFolderIds.has(fid)) continue;
    items.push(formatQuizForClient(qz, userId));
  }

  // 4. Standalone Questions (if placed in folder)
  for (const qu of allQuestions) {
    if (qu.quiz_id) continue;
    const fid = qu.folder_id || 'root';
    if (allowedFolderIds && !allowedFolderIds.has(fid)) continue;
    const qText = String(qu.text || qu.question_text || qu.title || 'سؤال');
    items.push({
      ...qu,
      id: qu.id,
      item_type: 'question',
      name: qText.length > 80 ? qText.slice(0, 80) + '…' : qText,
      type: 'question',
      file_type: 'question',
      upload_date: qu.created_at || qu.upload_date || '',
      created_at: qu.created_at || qu.upload_date || '',
      inherited_tags: getInheritedFolderTags(fid),
      rating: { avg: 0, average: 0, count: 0 },
    });
  }

  // Filter by search query `q`
  let filtered = items;
  if (q) {
    const qNorm = normalizeArabic(q);
    filtered = filtered.filter((item) => {
      const hay = normalizeArabic(
        `${item.name || ''} ${item.description || ''} ${(item.tags || []).join(' ')} ${(item.inherited_tags || []).join(' ')}`
      );
      return hay.includes(qNorm);
    });
  }

  // Filter by tags
  if (tagFilterGroups.length > 0) {
    filtered = filtered.filter((item) => {
      const itemTagSet = new Set(
        [...(item.tags || []), ...(item.inherited_tags || [])].map((t: string) => normalizeArabic(t))
      );
      const groupMatches = tagFilterGroups.map((group) =>
        group.some((alt) => itemTagSet.has(normalizeArabic(alt)))
      );
      return tagMatch === 'any' ? groupMatches.some(Boolean) : groupMatches.every(Boolean);
    });
  }

  // Issue #5: Sort folders, files, and quizzes together by the selected criterion (do not force folders before files)
  filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') {
      cmp = String(a.name || '').localeCompare(String(b.name || ''), 'ar');
    } else if (sortBy === 'size') {
      cmp = (Number(a.size) || 0) - (Number(b.size) || 0);
    } else if (sortBy === 'rating') {
      cmp = (Number(a.rating?.avg) || 0) - (Number(b.rating?.avg) || 0);
    } else if (sortBy === 'type') {
      cmp = String(a.type || '').localeCompare(String(b.type || ''));
    } else {
      const dateA = String(a.upload_date || a.created_at || '');
      const dateB = String(b.upload_date || b.created_at || '');
      cmp = dateA.localeCompare(dateB);
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pagedItems = filtered.slice(start, start + perPage);

  const currentFolderObj = folderId === 'root'
    ? { id: 'root', name: 'الرئيسية', tags: [] }
    : getFolder(folderId) || { id: folderId, name: folderId, tags: [] };

  res.json({
    items: pagedItems,
    path: getBreadcrumb(folderId),
    current_folder: currentFolderObj,
    page: safePage,
    per_page: perPage,
    total_items: totalItems,
    total_pages: totalPages,
    has_prev: safePage > 1,
    has_next: safePage < totalPages,
  });
});

app.get('/api/folders', (req: Request, res: Response) => {
  const parentId = req.query.parent_id ? String(req.query.parent_id) : null;
  if (parentId !== null) {
    return res.json(getSubfolders(parentId));
  }
  res.json(Object.values(getAllFolders()));
});

app.get('/api/folders/tree', (_req: Request, res: Response) => {
  res.json(buildFolderTree(null));
});

app.post('/api/folders/create', (req: Request, res: Response) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ success: false, error: 'اسم المجلد مطلوب' });
  const folder = createFolder(
    b.name,
    b.parent_id || null,
    b.color || '#D4A574',
    b.icon || 'folder',
    b.user_id || b.created_by || OWNER_ID,
    b.description || '',
    Array.isArray(b.tags) ? b.tags : [],
    b.custom_appearance
  );
  res.json({ success: true, folder });
});

app.put('/api/folders/:folder_id', (req: Request, res: Response) => {
  const updated = updateFolder(pStr(req.params.folder_id), req.body || {});
  if (!updated) return res.status(404).json({ success: false, error: 'المجلد غير موجود' });
  res.json({ success: true, folder: updated });
});

app.delete('/api/folders/:folder_id', (req: Request, res: Response) => {
  const fid = pStr(req.params.folder_id);
  const folder = deleteFolder(fid);
  if (!folder) return res.status(400).json({ success: false, error: 'لا يمكن حذف هذا المجلد' });
  addToTrash('folder', fid, folder, String(req.query.user_id || req.body?.user_id || ''));
  removeItemFromAllTags('folder', fid);
  res.json({ success: true });
});

app.post('/api/folders/:folder_id/move', (req: Request, res: Response) => {
  const target = req.body?.target_folder_id ?? req.body?.parent_id ?? null;
  const result = moveFolder(pStr(req.params.folder_id), target);
  if (!result.ok) return res.status(400).json({ success: false, error: result.error });
  res.json({ success: true, folder: result.folder });
});

app.post('/api/folders/:folder_id/copy', (req: Request, res: Response) => {
  const target = req.body?.target_folder_id ?? req.body?.parent_id ?? null;
  const copied = copyFolder(pStr(req.params.folder_id), target, req.body?.user_id || '');
  if (!copied) return res.status(404).json({ success: false, error: 'المجلد غير موجود' });
  res.json({ success: true, folder: copied });
});

app.post('/api/folders/:folder_id/send-all', async (req: Request, res: Response) => {
  const fid = pStr(req.params.folder_id);
  const userId = String(req.body?.user_id || req.query.user_id || OWNER_ID);
  const allFiles = Object.values(getAllFiles()).filter((f) => (f.folder_id || 'root') === fid);
  let sent = 0;
  for (const f of allFiles.slice(0, 20)) {
    const r = await sendFileToTelegramUser(f, userId);
    if (r.ok) sent++;
  }
  res.json({ success: true, sent, message: 'تم إرسال محتويات المجلد' });
});

// ==================== FILES ENDPOINTS ====================
app.get('/api/files', (req: Request, res: Response) => {
  const userId = String(req.query.user_id || '');
  const list = Object.values(getAllFiles()).map((f) => formatFileForClient(f, userId));
  res.json(list);
});

app.get('/api/files/:file_id', (req: Request, res: Response) => {
  const f = getFile(pStr(req.params.file_id));
  if (!f) return res.status(404).json({ error: 'الملف غير موجود' });
  res.json(formatFileForClient(f, String(req.query.user_id || '')));
});

app.put('/api/files/:file_id', (req: Request, res: Response) => {
  const b = req.body || {};
  const updates: Record<string, any> = { ...b };
  if (b.name || b.file_name || b.original_name) {
    updates.original_name = b.name || b.file_name || b.original_name;
    updates.file_name = updates.original_name;
    updates.name = updates.original_name;
  }
  if (b.content !== undefined) {
    updates.text_content = b.content;
    updates.content = b.content;
  }
  const updated = updateFile(pStr(req.params.file_id), updates);
  if (!updated) return res.status(404).json({ success: false, error: 'الملف غير موجود' });
  res.json({ success: true, file: formatFileForClient(updated) });
});

app.delete('/api/files/:file_id', (req: Request, res: Response) => {
  const fid = pStr(req.params.file_id);
  const deleted = deleteFile(fid);
  if (!deleted) return res.status(404).json({ success: false, error: 'الملف غير موجود' });
  addToTrash('file', fid, deleted, String(req.query.user_id || req.body?.user_id || ''));
  removeItemFromAllTags('file', fid);
  res.json({ success: true });
});

app.post('/api/files/:file_id/move', (req: Request, res: Response) => {
  const target = req.body?.target_folder_id ?? req.body?.folder_id ?? 'root';
  const moved = moveFile(pStr(req.params.file_id), target);
  if (!moved) return res.status(404).json({ success: false, error: 'الملف غير موجود' });
  res.json({ success: true, file: formatFileForClient(moved) });
});

app.post('/api/files/:file_id/copy', (req: Request, res: Response) => {
  const target = req.body?.target_folder_id ?? req.body?.folder_id ?? 'root';
  const copied = copyFile(pStr(req.params.file_id), target);
  if (!copied) return res.status(404).json({ success: false, error: 'الملف غير موجود' });
  res.json({ success: true, file: formatFileForClient(copied) });
});

app.get('/api/files/:file_id/link-token', (req: Request, res: Response) => {
  res.json({ token: pStr(req.params.file_id) });
});

app.get('/api/files/:file_id/dl-url', (req: Request, res: Response) => {
  const f = getFile(pStr(req.params.file_id));
  if (!f) return res.status(404).json({ error: 'الملف غير موجود' });
  if (f.url) return res.json({ url: f.url });
  if (f.local_path) return res.json({ url: `/api/download/${encodeURIComponent(f.id)}` });
  res.json({ url: `/api/download/${encodeURIComponent(f.id)}` });
});

app.get('/api/files/:file_id/download-url', (req: Request, res: Response) => {
  const f = getFile(pStr(req.params.file_id));
  if (!f) return res.status(404).json({ error: 'الملف غير موجود' });
  if (f.url) return res.json({ url: f.url });
  res.json({ url: `/api/download/${encodeURIComponent(f.id)}` });
});

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildRichFilePreviewSvg(f: Record<string, any>): string {
  const ftype = String(f?.file_type || f?.type || 'other').toLowerCase();
  const title = String(f?.file_name || f?.original_name || f?.name || 'ملف').trim();
  const rawText = String(f?.content || f?.text_content || f?.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const extMatch = title.match(/\.([a-zA-Z0-9]{2,5})$/);
  const ext = extMatch ? extMatch[1].toUpperCase() : '';

  const themeMap: Record<string, { bg1: string; bg2: string; accent: string; badge: string }> = {
    pdf: { bg1: '#2b1216', bg2: '#1a0c0e', accent: '#ef5350', badge: 'PDF' },
    document: { bg1: '#102038', bg2: '#0b1526', accent: '#42a5f5', badge: ext || 'DOCX' },
    presentation: { bg1: '#2e1910', bg2: '#1c0f09', accent: '#ff7043', badge: ext || 'PPTX' },
    spreadsheet: { bg1: '#0f291b', bg2: '#091a11', accent: '#66bb6a', badge: ext || 'XLSX' },
    video: { bg1: '#241434', bg2: '#150b20', accent: '#ab47bc', badge: ext || 'MP4' },
    audio: { bg1: '#0e2629', bg2: '#081719', accent: '#26c6da', badge: ext || 'AUDIO' },
    text_note: { bg1: '#292214', bg2: '#1a150c', accent: '#d4a574', badge: 'TXT' },
    text: { bg1: '#292214', bg2: '#1a150c', accent: '#d4a574', badge: 'TXT' },
    archive: { bg1: '#262118', bg2: '#17140e', accent: '#ffa726', badge: ext || 'ZIP' },
    youtube: { bg1: '#2e1010', bg2: '#1a0808', accent: '#ff1744', badge: 'YOUTUBE' },
    youtube_playlist: { bg1: '#2e1010', bg2: '#1a0808', accent: '#ff1744', badge: 'PLAYLIST' },
    link: { bg1: '#10252e', bg2: '#09161c', accent: '#29b6f6', badge: 'LINK' },
    image: { bg1: '#142824', bg2: '#0c1816', accent: '#26a69a', badge: ext || 'IMG' },
  };

  const th = themeMap[ftype] || { bg1: '#231f1b', bg2: '#141210', accent: '#d4a574', badge: ext || 'FILE' };
  const line1 = escapeXml(title.slice(0, 26));
  const line2 = escapeXml((rawText || title.slice(26) || '').slice(0, 32));
  const line3 = escapeXml((rawText.slice(32) || '').slice(0, 32));

  let centerGraphic = '';
  if (ftype === 'video' || ftype === 'youtube' || ftype === 'youtube_playlist') {
    centerGraphic = `
      <rect x="24" y="22" width="112" height="68" rx="10" fill="rgba(255,255,255,0.06)" stroke="${th.accent}" stroke-width="1.5"/>
      <circle cx="80" cy="56" r="18" fill="${th.accent}" opacity="0.9"/>
      <polygon points="75,47 75,65 90,56" fill="#ffffff"/>
    `;
  } else if (ftype === 'audio') {
    centerGraphic = `
      <g stroke="${th.accent}" stroke-linecap="round" stroke-width="4" opacity="0.9">
        <line x1="36" y1="62" x2="36" y2="48"/>
        <line x1="48" y1="70" x2="48" y2="40"/>
        <line x1="60" y1="76" x2="60" y2="34"/>
        <line x1="72" y1="64" x2="72" y2="46"/>
        <line x1="84" y1="78" x2="84" y2="32"/>
        <line x1="96" y1="68" x2="96" y2="42"/>
        <line x1="108" y1="72" x2="108" y2="38"/>
        <line x1="120" y1="60" x2="120" y2="50"/>
      </g>
    `;
  } else {
    centerGraphic = `
      <rect x="26" y="18" width="108" height="78" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>
      <line x1="38" y1="34" x2="96" y2="34" stroke="${th.accent}" stroke-width="3" stroke-linecap="round"/>
      <line x1="38" y1="48" x2="122" y2="48" stroke="rgba(255,255,255,0.35)" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="38" y1="60" x2="116" y2="60" stroke="rgba(255,255,255,0.25)" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="38" y1="72" x2="98" y2="72" stroke="rgba(255,255,255,0.2)" stroke-width="2.5" stroke-linecap="round"/>
      ${line2 ? `<text x="80" y="88" font-family="Cairo, sans-serif" font-size="9" fill="rgba(255,255,255,0.65)" text-anchor="middle">${line2}</text>` : ''}
      ${line3 ? `<text x="80" y="99" font-family="Cairo, sans-serif" font-size="8" fill="rgba(255,255,255,0.45)" text-anchor="middle">${line3}</text>` : ''}
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 140" width="160" height="140">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${th.bg1}"/>
        <stop offset="100%" stop-color="${th.bg2}"/>
      </linearGradient>
    </defs>
    <rect width="160" height="140" rx="12" fill="url(#bg)"/>
    ${centerGraphic}
    <rect x="14" y="104" width="44" height="20" rx="5" fill="${th.accent}"/>
    <text x="36" y="118" font-family="Inter, Cairo, sans-serif" font-weight="700" font-size="10" fill="#ffffff" text-anchor="middle">${escapeXml(th.badge)}</text>
    <text x="144" y="118" font-family="Cairo, sans-serif" font-weight="600" font-size="10.5" fill="rgba(255,255,255,0.9)" text-anchor="end">${line1}</text>
  </svg>`;
}

app.get('/api/files/:file_id/thumb', async (req: Request, res: Response) => {
  const fid = pStr(req.params.file_id);
  const f = getFile(fid);
  const ftype = String(f?.file_type || f?.type || '').toLowerCase();

  // 1. Local image file
  if (f?.local_path && fs.existsSync(f.local_path) && ftype === 'image') {
    return res.sendFile(path.resolve(f.local_path));
  }

  // 2. YouTube video / link thumbnail
  const url = String(f?.url || '').trim();
  if (url) {
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) {
      return res.redirect(`https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`);
    }
  }

  // 3. Telegram thumbnail (or Telegram image file itself if ftype === 'image')
  const tgThumbId = f?.thumb_file_id || (ftype === 'image' ? (f?.telegram_file_id || f?.file_id || fid) : '');
  if (tgThumbId) {
    const streamed = await proxyTelegramFile(String(tgThumbId), res);
    if (streamed) return;
  }

  // 4. Rich SVG preview for all file types (PDF, Office, Video, Audio, Text notes, Archives, Links)
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(buildRichFilePreviewSvg(f || { id: fid, file_name: fid, file_type: 'other' }));
});

app.post('/api/files/:file_id/rename-reupload', (req: Request, res: Response) => {
  const updated = updateFile(pStr(req.params.file_id), {
    original_name: req.body?.new_name || req.body?.name,
  });
  if (!updated) return res.status(404).json({ success: false, error: 'الملف غير موجود' });
  res.json({ success: true, file: formatFileForClient(updated) });
});

// ==================== UPLOADS & DOWNLOADS ====================
app.post('/api/upload', upload.any(), async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) || [];
  const b = req.body || {};
  const folderId = b.folder_id || 'root';
  const userId = b.user_id || OWNER_ID;
  const description = b.description || '';
  let tags: string[] = [];
  if (Array.isArray(b.tags)) tags = b.tags;
  else if (typeof b.tags === 'string' && b.tags.trim()) {
    try {
      const parsed = JSON.parse(b.tags);
      tags = Array.isArray(parsed) ? parsed : b.tags.split(',').map((s: string) => s.trim()).filter(Boolean);
    } catch {
      tags = b.tags.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }

  const created: Array<Record<string, any>> = [];
  for (const file of files) {
    const fileName = b.custom_name || file.originalname;
    const tgUploaded = await uploadBufferOrFileToTelegram(file.path, fileName, file.mimetype, userId || OWNER_ID);
    if (tgUploaded?.file_id) {
      // Remove temporary local file after uploading to Telegram unlimited storage
      try { fs.unlinkSync(file.path); } catch {}
    }
    const rec = createFileRecord({
      original_name: fileName,
      size: tgUploaded?.file_size || file.size,
      folder_id: folderId,
      uploaded_by: userId,
      description,
      tags,
      source: tgUploaded?.file_id ? 'telegram' : 'web',
      telegram_file_id: tgUploaded?.file_id || '',
      local_path: tgUploaded?.file_id ? '' : file.path,
      mime_type: file.mimetype,
    });
    if (tgUploaded?.thumb_file_id) {
      updateFile(rec.id, { thumb_file_id: tgUploaded.thumb_file_id, has_thumb: true });
    }
    created.push(formatFileForClient(rec, userId));
  }

  if (created.length === 0 && b.file_name) {
    const rec = createFileRecord({
      original_name: b.file_name,
      size: Number(b.file_size) || 0,
      folder_id: folderId,
      uploaded_by: userId,
      description,
      tags,
      source: 'web',
      telegram_file_id: b.file_id || '',
    });
    if (b.file_id) clearPendingBotFile(String(b.file_id));
    created.push(formatFileForClient(rec, userId));
  }

  res.json({ success: true, file: created[0] || null, files: created });
});

app.post('/api/upload-url', (req: Request, res: Response) => {
  const b = req.body || {};
  const url = String(b.url || '').trim();
  if (!url) return res.status(400).json({ success: false, error: 'الرابط مطلوب' });
  const isYtPlaylist = url.includes('youtube.com/playlist') || url.includes('list=');
  const isYt = url.includes('youtube.com/') || url.includes('youtu.be/');
  const fileType = isYtPlaylist ? 'youtube_playlist' : isYt ? 'youtube' : (b.file_type || 'link');
  const rec = createFileRecord({
    original_name: b.title || b.name || url,
    size: 0,
    folder_id: b.folder_id || 'root',
    uploaded_by: b.user_id || OWNER_ID,
    description: b.description || '',
    tags: Array.isArray(b.tags) ? b.tags : [],
    source: 'url',
    url,
  });
  const updated = updateFile(rec.id, { type: fileType, file_type: fileType }) || rec;
  res.json({ success: true, file: formatFileForClient(updated) });
});

app.post('/api/upload-text', (req: Request, res: Response) => {
  const b = req.body || {};
  const content = String(b.content || '').trim();
  if (!content) return res.status(400).json({ success: false, error: 'المحتوى النصي مطلوب' });
  const rec = createFileRecord({
    original_name: b.title || 'ملاحظة نصية',
    size: Buffer.byteLength(content, 'utf-8'),
    folder_id: b.folder_id || 'root',
    uploaded_by: b.user_id || OWNER_ID,
    description: b.description || '',
    tags: Array.isArray(b.tags) ? b.tags : [],
    source: 'text',
    text_content: content,
  });
  const updated = updateFile(rec.id, { type: 'text_note', file_type: 'text_note', content }) || rec;
  res.json({ success: true, file: formatFileForClient(updated) });
});

app.post('/api/assign-file-folder', (req: Request, res: Response) => {
  const b = req.body || {};
  const fileId = b.file_id || b.id;
  const folderId = b.folder_id || 'root';
  if (fileId) {
    clearPendingBotFile(String(fileId));
    const moved = moveFile(String(fileId), folderId);
    if (moved && Array.isArray(b.tags)) {
      updateFile(String(fileId), { tags: b.tags, description: b.description ?? moved.description });
    }
    return res.json({ success: true, file: moved ? formatFileForClient(moved) : null });
  }
  res.json({ success: true });
});

app.get('/api/download/:file_id', async (req: Request, res: Response) => {
  const fid = pStr(req.params.file_id);
  const f = getFile(fid);
  if (!f) {
    const streamedRaw = await proxyTelegramFile(fid, res);
    if (streamedRaw) return;
    return res.status(404).send('File not found');
  }
  incrementDownloads(f.id);
  if (f.url) return res.redirect(f.url);
  if (f.local_path && fs.existsSync(f.local_path)) {
    return res.download(path.resolve(f.local_path), f.file_name || f.original_name || 'file');
  }
  if (f.text_content || f.content) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(f.text_content || f.content);
  }
  const tgId = f.telegram_file_id || f.file_id || f.id;
  const streamed = await proxyTelegramFile(String(tgId), res, f.file_name || f.original_name || undefined);
  if (streamed) return;
  res.status(404).send('File binary not available locally — set TOKEN in env to stream from Telegram');
});

app.post('/api/send/:file_id', async (req: Request, res: Response) => {
  const fid = pStr(req.params.file_id);
  const f = getFile(fid);
  incrementDownloads(fid);
  if (f) {
    const targetChat = String(req.body?.user_id || req.query.user_id || OWNER_ID);
    const sent = await sendFileToTelegramUser(f, targetChat);
    if (!sent.ok && process.env.TOKEN) {
      return res.status(400).json({ success: false, error: sent.error });
    }
  }
  res.json({ success: true, message: 'تم إرسال الملف' });
});

app.get('/api/url-title', async (req: Request, res: Response) => {
  const url = String(req.query.url || '').trim();
  if (!url) return res.json({ title: '' });
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const html = await resp.text();
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    res.json({ title: match ? match[1].trim() : url });
  } catch {
    res.json({ title: url });
  }
});

// ==================== TAGS & TAXONOMY ====================
app.get('/api/tags', (_req: Request, res: Response) => {
  res.json(getTagsGrouped());
});

app.post('/api/tags', (req: Request, res: Response) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ success: false, error: 'اسم الوسم مطلوب' });
  const tag = createTag(
    b.name,
    b.category || b.category_id || '',
    b.color || '#D4A574',
    b.description || '',
    Array.isArray(b.placements) ? b.placements : [],
    b.requester_id || b.created_by || OWNER_ID,
    b.icon || '',
    b.parent_tag_ids,
    {
      translations: b.translations || { en: '', ku: '' },
      standalone: Boolean(b.standalone),
      legacy_names: Array.isArray(b.legacy_names) ? b.legacy_names : [],
    }
  );
  res.json({ success: true, tag });
});

app.put('/api/tags/:tag_id', (req: Request, res: Response) => {
  const updated = updateTag(pStr(req.params.tag_id), req.body || {});
  if (!updated) return res.status(404).json({ success: false, error: 'الوسم غير موجود' });
  res.json({ success: true, tag: updated });
});

app.delete('/api/tags/:tag_id', (req: Request, res: Response) => {
  const deleted = deleteTag(pStr(req.params.tag_id), String(req.query.requester_id || req.body?.requester_id || ''));
  if (!deleted) return res.status(404).json({ success: false, error: 'الوسم غير موجود' });
  res.json({ success: true, tag: deleted });
});

app.get('/api/tag-categories', (_req: Request, res: Response) => {
  res.json(getTagCategories());
});

app.get('/api/tags/names', (_req: Request, res: Response) => {
  res.json(getAllTagNames());
});

app.get('/api/tags/trash', (_req: Request, res: Response) => {
  res.json({ items: getDeletedTags(), tags: getDeletedTags() });
});

app.post('/api/tags/trash/:tag_id/restore', (req: Request, res: Response) => {
  const restored = restoreTag(pStr(req.params.tag_id));
  if (!restored) return res.status(404).json({ success: false, error: 'الوسم غير موجود في السلة' });
  res.json({ success: true, tag: restored });
});

app.delete('/api/tags/trash/:tag_id', (req: Request, res: Response) => {
  const ok = permanentDeleteTag(pStr(req.params.tag_id));
  res.json({ success: ok });
});

app.post('/api/tags/:tag_id/placements', (req: Request, res: Response) => {
  const b = req.body || {};
  const tag = addTagPlacement(
    pStr(req.params.tag_id),
    b.category_id || b.type || '',
    b.parent_tag_id || b.id || '',
    b.name || '',
    Boolean(b.include_subfolders)
  );
  if (!tag) return res.status(404).json({ success: false, error: 'الوسم غير موجود' });
  res.json({ success: true, tag });
});

app.delete('/api/tags/:tag_id/placements', (req: Request, res: Response) => {
  const b = req.body || req.query || {};
  const tag = removeTagPlacement(
    pStr(req.params.tag_id),
    String(b.category_id || b.type || ''),
    String(b.parent_tag_id || b.id || '')
  );
  if (!tag) return res.status(404).json({ success: false, error: 'الوسم غير موجود' });
  res.json({ success: true, tag });
});

app.post('/api/tags/placements/bulk', (req: Request, res: Response) => {
  const result = bulkModifyPlacements(req.body || {});
  res.json(result);
});

app.post('/api/tags/reorder', (req: Request, res: Response) => {
  const ids = Array.isArray(req.body?.tag_ids) ? req.body.tag_ids : Array.isArray(req.body?.ids) ? req.body.ids : [];
  reorderTags(ids, req.body?.category_id || req.body?.category);
  res.json({ success: true });
});

app.post('/api/tags/categories', (req: Request, res: Response) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ success: false, error: 'اسم القائمة مطلوب' });
  const cat = createTagCategory(b.name, b.icon || '', b.color || '#D4A574', {
    translations: b.translations || { en: '', ku: '' },
    linked_from_category_ids: Array.isArray(b.linked_from_category_ids) ? b.linked_from_category_ids : [],
    catalog_source: b.catalog_source || '',
  });
  res.json({ success: true, category: cat });
});

app.put('/api/tags/categories/:cat_id', (req: Request, res: Response) => {
  const updated = updateTagCategory(pStr(req.params.cat_id), req.body || {});
  if (!updated) return res.status(404).json({ success: false, error: 'القائمة غير موجودة' });
  res.json({ success: true, category: updated });
});

app.delete('/api/tags/categories/:cat_id', (req: Request, res: Response) => {
  const ok = deleteTagCategory(pStr(req.params.cat_id));
  if (!ok) return res.status(404).json({ success: false, error: 'القائمة غير موجودة' });
  res.json({ success: true });
});

app.post('/api/tags/categories/reorder', (req: Request, res: Response) => {
  const ids = Array.isArray(req.body?.category_ids) ? req.body.category_ids : Array.isArray(req.body?.ids) ? req.body.ids : [];
  reorderTagCategories(ids);
  res.json({ success: true });
});

// ==================== TAXONOMY CATALOG ENDPOINTS ====================
app.get('/api/taxonomy/countries', (req: Request, res: Response) => {
  const includeHidden = req.query.include_hidden === '1' || req.query.include_hidden === 'true';
  res.json(getCountryCatalog(includeHidden));
});

app.post('/api/taxonomy/country-profiles', (req: Request, res: Response) => {
  const resData = saveCountryProfiles(req.body);
  res.json({ success: true, ...resData });
});

app.get('/api/taxonomy/institutions', (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  const country = String(req.query.country || '').trim();
  const limit = parseInt(String(req.query.limit || '100'), 10) || 100;
  const includeHidden = req.query.include_hidden === '1' || req.query.include_hidden === 'true';
  res.json(getInstitutionCatalog(q, country, limit, includeHidden));
});

app.get('/api/taxonomy/institution-profiles', (_req: Request, res: Response) => {
  const { profilesMap } = getInstitutionProfiles();
  res.json({ success: true, profiles: profilesMap });
});

app.post('/api/taxonomy/institution-profiles', (req: Request, res: Response) => {
  const saved = saveInstitutionProfiles(req.body);
  res.json({ success: true, ...saved });
});

app.post('/api/taxonomy/catalog-visibility', (req: Request, res: Response) => {
  res.json(saveCatalogVisibility(req.body || {}));
});

app.post('/api/taxonomy/consolidate-institutions', (_req: Request, res: Response) => {
  res.json(consolidateDuplicateInstitutions());
});

// ==================== STATS & DASHBOARD ====================
app.get('/api/stats', (_req: Request, res: Response) => {
  const files = Object.values(getAllFiles());
  const folders = Object.values(getAllFolders());
  const tags = getAllTags();
  const userStats = getUserStats();
  const totalSize = files.reduce((acc, f) => acc + (Number(f.file_size ?? f.size) || 0), 0);
  const totalDownloads = files.reduce((acc, f) => acc + (Number(f.downloads) || 0), 0);
  res.json({
    files_count: files.length,
    folders_count: folders.length,
    tags_count: tags.length,
    total_size: totalSize,
    total_size_formatted: formatSize(totalSize),
    total_downloads: totalDownloads,
    ...userStats,
  });
});

app.get('/api/dashboard', (_req: Request, res: Response) => {
  const files = Object.values(getAllFiles());
  const folders = Object.values(getAllFolders());
  const users = Object.values(getAllUsers());
  const admins = Object.values(getAllAdmins());
  const tags = getAllTags();
  const deleted = getAllDeleted().map((d) => ({
    ...d,
    id: d.item_id || d.trash_id,
    type: d.item_type,
    remaining_days: 30,
  }));

  const topDownloads = [...files]
    .sort((a, b) => (Number(b.downloads) || 0) - (Number(a.downloads) || 0))
    .slice(0, 10)
    .map((f) => formatFileForClient(f));

  const topRatedAll = getTopRatedItems(20);
  const topRatedFiles = topRatedAll
    .filter((r) => r.item_type === 'file')
    .map((r) => {
      const fl = getFile(r.item_id);
      return {
        ...r,
        avg: r.average,
        name: fl?.file_name || fl?.original_name || fl?.name || r.item_id,
        file_type: fl?.file_type || fl?.type || 'other',
      };
    });
  const topRatedFolders = topRatedAll
    .filter((r) => r.item_type === 'folder')
    .map((r) => {
      const fd = getFolder(r.item_id);
      return {
        ...r,
        avg: r.average,
        name: fd?.name || r.item_id,
      };
    });

  res.json({
    users_count: users.length,
    banned_count: users.filter((u) => u.banned).length,
    admins_count: admins.length,
    files_count: files.length,
    folders_count: folders.length,
    tags_count: tags.length,
    most_active_users: users.slice(0, 10).map((u) => ({
      ...u,
      first_name: u.first_name || u.name || u.id,
      role: u.banned ? 'banned' : getUserRole(u.id),
    })),
    most_active_admins: admins.map((a) => ({
      ...a,
      first_name: a.first_name || a.name || a.id,
    })),
    top_downloads: topDownloads,
    top_rated_files: topRatedFiles,
    top_rated_folders: topRatedFolders,
    recent_deleted: deleted,
  });
});

// ==================== RATINGS ====================
app.get('/api/ratings/top', (_req: Request, res: Response) => {
  res.json(getTopRatedItems(20));
});

app.get('/api/ratings/:item_type/:item_id', (req: Request, res: Response) => {
  const r = getItemRatings(pStr(req.params.item_type), pStr(req.params.item_id), String(req.query.user_id || ''));
  res.json({ ...r, avg: r.average });
});

app.post('/api/ratings/:item_type/:item_id', (req: Request, res: Response) => {
  const userId = String(req.body?.user_id || OWNER_ID);
  const stars = Number(req.body?.rating ?? req.body?.stars ?? 5);
  const r = setItemRating(pStr(req.params.item_type), pStr(req.params.item_id), userId, stars);
  res.json({ success: true, ...r, avg: r.average, rating: { avg: r.average, count: r.count } });
});

app.delete('/api/ratings/:item_type/:item_id', (req: Request, res: Response) => {
  const userId = String(req.body?.user_id || req.query.user_id || OWNER_ID);
  const r = deleteItemRating(pStr(req.params.item_type), pStr(req.params.item_id), userId);
  res.json({ success: true, ...r, avg: r.average, rating: { avg: r.average, count: r.count } });
});

// ==================== DELETED (TRASH) ====================
app.get('/api/deleted', (_req: Request, res: Response) => {
  const items = getAllDeleted().map((d) => ({
    ...d,
    id: d.item_id || d.trash_id,
    type: d.item_type,
    remaining_days: 30,
  }));
  res.json(items);
});

app.post('/api/deleted/restore', (req: Request, res: Response) => {
  const id = String(req.body?.trash_id || req.body?.id || '');
  const all = getAllDeleted();
  const match = all.find((d) => d.trash_id === id || d.item_id === id);
  if (!match) return res.status(404).json({ success: false, error: 'العنصر غير موجود في السلة' });
  const restored = restoreFromTrash(match.trash_id);
  res.json({ success: Boolean(restored), item: restored });
});

app.delete('/api/deleted/permanent', (req: Request, res: Response) => {
  const id = String(req.body?.trash_id || req.body?.id || '');
  const all = getAllDeleted();
  const match = all.find((d) => d.trash_id === id || d.item_id === id);
  const ok = match ? permanentDeleteFromTrash(match.trash_id) : permanentDeleteFromTrash(id);
  res.json({ success: ok });
});

// ==================== GROUPS ====================
app.get('/api/groups', (_req: Request, res: Response) => {
  res.json(getAllGroups());
});

app.post('/api/groups/create', (req: Request, res: Response) => {
  const grp = createGroup(req.body || {});
  res.json({ success: true, group: grp });
});

app.delete('/api/groups/:group_id', (req: Request, res: Response) => {
  res.json({ success: deleteGroup(pStr(req.params.group_id)) });
});

app.get('/api/groups/:group_id/messages', (req: Request, res: Response) => {
  res.json(getGroupMessages(pStr(req.params.group_id)));
});

app.post('/api/groups/:group_id/send', (req: Request, res: Response) => {
  const msg = addGroupMessage(pStr(req.params.group_id), req.body || {});
  res.json({ success: Boolean(msg), message: msg });
});

app.post('/api/groups/:group_id/fetch', (_req: Request, res: Response) => {
  res.json({ success: true, fetched: 0 });
});

// ==================== QUIZZES & QUESTIONS ====================
app.get('/api/quizzes', (req: Request, res: Response) => {
  const folderId = req.query.folder_id ? String(req.query.folder_id) : undefined;
  const list = getAllQuizzes(folderId).map((q) => formatQuizForClient(q));
  res.json(list);
});

app.post('/api/quizzes/create', (req: Request, res: Response) => {
  const quiz = createQuiz(req.body || {});
  res.json({ success: true, quiz: formatQuizForClient(quiz) });
});

app.post('/api/quizzes/create-from-file', upload.single('file'), (req: Request, res: Response) => {
  const b = req.body || {};
  const quiz = createQuiz({
    title: b.title || req.file?.originalname || 'اختبار مستورد',
    description: b.description || '',
    folder_id: b.folder_id || 'root',
    created_by: b.user_id || b.requester_id || OWNER_ID,
    tags: b.tags ? (typeof b.tags === 'string' ? JSON.parse(b.tags) : b.tags) : [],
  });
  res.json({ success: true, quiz: formatQuizForClient(quiz), extracted_count: 0 });
});

app.get('/api/quizzes/:quiz_id', (req: Request, res: Response) => {
  const q = getQuiz(pStr(req.params.quiz_id));
  if (!q) return res.status(404).json({ error: 'الاختبار غير موجود' });
  res.json(formatQuizForClient(q));
});

app.put('/api/quizzes/:quiz_id', (req: Request, res: Response) => {
  const updated = updateQuiz(pStr(req.params.quiz_id), req.body || {});
  if (!updated) return res.status(404).json({ success: false, error: 'الاختبار غير موجود' });
  res.json({ success: true, quiz: formatQuizForClient(updated) });
});

app.delete('/api/quizzes/:quiz_id', (req: Request, res: Response) => {
  const qid = pStr(req.params.quiz_id);
  const deleted = deleteQuiz(qid);
  if (!deleted) return res.status(404).json({ success: false, error: 'الاختبار غير موجود' });
  addToTrash('quiz', qid, deleted, String(req.query.user_id || req.body?.user_id || ''));
  res.json({ success: true });
});

app.post('/api/quizzes/:quiz_id/questions', (req: Request, res: Response) => {
  const q = addQuizQuestion(pStr(req.params.quiz_id), req.body || {});
  if (!q) return res.status(404).json({ success: false, error: 'الاختبار غير موجود' });
  res.json({ success: true, question: q });
});

app.put('/api/quizzes/:quiz_id/questions/:question_id', (req: Request, res: Response) => {
  const q = updateQuizQuestion(pStr(req.params.quiz_id), pStr(req.params.question_id), req.body || {});
  if (!q) return res.status(404).json({ success: false, error: 'السؤال غير موجود' });
  res.json({ success: true, question: q });
});

app.delete('/api/quizzes/:quiz_id/questions/:question_id', (req: Request, res: Response) => {
  const ok = deleteQuizQuestion(pStr(req.params.quiz_id), pStr(req.params.question_id));
  res.json({ success: ok });
});

app.post('/api/quizzes/:quiz_id/link/:question_id', (req: Request, res: Response) => {
  const qid = pStr(req.params.quiz_id);
  const quiz = getQuiz(qid);
  if (!quiz) return res.status(404).json({ success: false, error: 'الاختبار غير موجود' });
  const linked = new Set<string>(Array.isArray(quiz.linked_question_ids) ? quiz.linked_question_ids : []);
  linked.add(pStr(req.params.question_id));
  const updated = updateQuiz(qid, { linked_question_ids: Array.from(linked) });
  res.json({ success: true, quiz: updated });
});

app.post('/api/quizzes/:quiz_id/unlink/:question_id', (req: Request, res: Response) => {
  const qid = pStr(req.params.quiz_id);
  const questionId = pStr(req.params.question_id);
  const quiz = getQuiz(qid);
  if (!quiz) return res.status(404).json({ success: false, error: 'الاختبار غير موجود' });
  const linked = (Array.isArray(quiz.linked_question_ids) ? quiz.linked_question_ids : []).filter(
    (id: string) => id !== questionId
  );
  const updated = updateQuiz(qid, { linked_question_ids: linked });
  res.json({ success: true, quiz: updated });
});

app.post('/api/quizzes/:quiz_id/reorder', (req: Request, res: Response) => {
  const quiz = getQuiz(pStr(req.params.quiz_id));
  if (!quiz) return res.status(404).json({ success: false, error: 'الاختبار غير موجود' });
  res.json({ success: true });
});

app.post('/api/quizzes/session', (req: Request, res: Response) => {
  const b = req.body || {};
  if (b.quiz_id) {
    const q = getQuiz(String(b.quiz_id));
    if (!q) return res.status(404).json({ error: 'الاختبار غير موجود' });
    return res.json({ success: true, quiz: q, questions: q.questions || [] });
  }
  const allQ = getAllQuestions();
  res.json({ success: true, questions: allQ.slice(0, Number(b.limit) || 20) });
});

app.get('/api/questions', (req: Request, res: Response) => {
  const quizId = req.query.quiz_id ? String(req.query.quiz_id) : '';
  if (quizId) {
    const q = getQuiz(quizId);
    const qs = getAllQuestions().filter((item) => item.quiz_id === quizId);
    return res.json([...(q?.questions || []), ...qs]);
  }
  res.json(getAllQuestions());
});

app.get('/api/questions/tags', (_req: Request, res: Response) => {
  const tags = new Set<string>();
  for (const q of getAllQuestions()) {
    for (const t of q.tags || []) tags.add(t);
  }
  res.json(Array.from(tags));
});

app.get('/api/questions/:question_id', (req: Request, res: Response) => {
  const q = getQuestion(pStr(req.params.question_id));
  if (!q) return res.status(404).json({ error: 'السؤال غير موجود' });
  res.json(q);
});

app.post('/api/questions/create', (req: Request, res: Response) => {
  const q = createQuestion(req.body || {});
  if (req.body?.quiz_id) {
    addQuizQuestion(String(req.body.quiz_id), q);
  }
  res.json({ success: true, question: q });
});

app.put('/api/questions/:question_id', (req: Request, res: Response) => {
  const updated = updateQuestion(pStr(req.params.question_id), req.body || {});
  if (!updated) return res.status(404).json({ success: false, error: 'السؤال غير موجود' });
  res.json({ success: true, question: updated });
});

app.delete('/api/questions/:question_id', (req: Request, res: Response) => {
  const qid = pStr(req.params.question_id);
  const deleted = deleteQuestion(qid);
  if (!deleted) return res.status(404).json({ success: false, error: 'السؤال غير موجود' });
  addToTrash('question', qid, deleted);
  res.json({ success: true });
});

app.post('/api/questions/import', upload.single('file'), (_req: Request, res: Response) => {
  res.json({ success: true, imported: 0, questions: [] });
});

// ==================== TELEGRAM MEDIA & AI & GOOGLE STUBS ====================
app.post('/api/telegram/upload-taxonomy-icon', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'لم يتم إرفاق صورة' });
  const tgUploaded = await uploadBufferOrFileToTelegram(req.file.path, req.file.originalname, req.file.mimetype);
  if (tgUploaded?.file_id) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.json({
      success: true,
      file_id: tgUploaded.file_id,
      icon: `tg:${tgUploaded.file_id}`,
      url: `/api/telegram/image/${encodeURIComponent(tgUploaded.file_id)}`,
    });
  }
  const fileId = req.file.filename;
  res.json({
    success: true,
    file_id: fileId,
    icon: `telegram:${fileId}`,
    url: `/uploads/${encodeURIComponent(fileId)}`,
  });
});

app.post('/api/telegram/upload-image', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'لم يتم إرفاق صورة' });
  const tgUploaded = await uploadBufferOrFileToTelegram(req.file.path, req.file.originalname, req.file.mimetype);
  if (tgUploaded?.file_id) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.json({
      success: true,
      file_id: tgUploaded.file_id,
      url: `/api/telegram/image/${encodeURIComponent(tgUploaded.file_id)}`,
    });
  }
  const fileId = req.file.filename;
  res.json({
    success: true,
    file_id: fileId,
    url: `/uploads/${encodeURIComponent(fileId)}`,
  });
});

app.post('/api/telegram/upload-question-attachment', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'لم يتم إرفاق ملف' });
  const tgUploaded = await uploadBufferOrFileToTelegram(req.file.path, req.file.originalname, req.file.mimetype);
  if (tgUploaded?.file_id) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.json({
      success: true,
      file_id: tgUploaded.file_id,
      name: req.file.originalname,
      url: `/api/telegram/file/${encodeURIComponent(tgUploaded.file_id)}`,
    });
  }
  const fileId = req.file.filename;
  res.json({
    success: true,
    file_id: fileId,
    name: req.file.originalname,
    url: `/uploads/${encodeURIComponent(fileId)}`,
  });
});

app.get('/api/telegram/image/:file_id', async (req: Request, res: Response) => {
  const fid = pStr(req.params.file_id);
  const filePath = path.join(UPLOADS_DIR, fid);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  const streamed = await proxyTelegramFile(fid, res);
  if (streamed) return;
  res.redirect('/static/assets/nukhaa-logo.png');
});

app.get('/api/telegram/file/:file_id', async (req: Request, res: Response) => {
  const fid = pStr(req.params.file_id);
  const filePath = path.join(UPLOADS_DIR, fid);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  const streamed = await proxyTelegramFile(fid, res);
  if (streamed) return;
  res.status(404).send('File not found');
});

app.post('/api/ai/chat', (req: Request, res: Response) => {
  const msg = String(req.body?.message || req.body?.prompt || '').trim();
  res.json({
    success: true,
    reply: msg
      ? `مرحباً بك في مساعد نخاع الذكي. بخصوص سؤالك: "${msg}" — يمكنك البحث في الملفات والمجلدات والاختبارات عبر شريط البحث أو فلاتر التصنيف العلمي.`
      : 'مرحباً بك في منصة نخاع التعليمية!',
  });
});

app.get('/api/google/status', (req: Request, res: Response) => {
  const uid = String(req.query.user_id || '').trim();
  const fbCfg = getFirebaseAppletConfig();
  const configured = Boolean((process.env.GOOGLE_CLIENT_ID || fbCfg.oAuthClientId || '').trim());
  const gInfo = uid ? getUserActiveGoogleAccessToken(uid) : null;
  res.json({
    configured,
    connected: Boolean(gInfo && gInfo.sub),
    has_token: Boolean(gInfo && gInfo.token),
    email: gInfo?.email || '',
    name: gInfo?.name || '',
    picture: gInfo?.picture || '',
    sub: gInfo?.sub || '',
    accounts: gInfo?.accounts || [],
  });
});

app.post('/api/google/switch-account', (req: Request, res: Response) => {
  const uid = String(req.body?.user_id || '').trim();
  const target = String(req.body?.sub || req.body?.email || '').trim();
  const switched = switchActiveGoogleAccount(uid, target);
  if (!switched.ok || !switched.user) {
    return res.status(400).json({ success: false, error: switched.error || 'تعذر تبديل حساب كوكل' });
  }
  const gInfo = getUserActiveGoogleAccessToken(uid);
  res.json({
    success: true,
    user: switched.user,
    email: gInfo?.email || '',
    accounts: gInfo?.accounts || [],
  });
});

app.get('/api/google/auth-url', (_req: Request, res: Response) => {
  res.json({
    url: null,
    use_client_oauth: true,
  });
});

app.post('/api/google/disconnect', (req: Request, res: Response) => {
  const uid = String(req.body?.user_id || '').trim();
  const sub = req.body?.sub ? String(req.body.sub).trim() : undefined;
  if (uid) {
    unlinkGoogleAccount(uid, sub);
  }
  res.json({ success: true });
});

app.get('/api/google/drive/list', async (req: Request, res: Response) => {
  const uid = String(req.query.user_id || '').trim();
  const folderId = String(req.query.folder_id || 'root').trim() || 'root';
  const gInfo = uid ? getUserActiveGoogleAccessToken(uid) : null;
  if (!gInfo || !gInfo.token) {
    return res.status(401).json({
      error: 'يرجى ربط أو تحديث صلاحية حساب كوكل للوصول إلى Google Drive',
      needs_google_connection: true,
    });
  }
  try {
    const q = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      q
    )}&fields=files(id,name,mimeType,size,iconLink,thumbnailLink,webViewLink)&pageSize=100&orderBy=folder,name`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${gInfo.token}` },
    });
    if (!r.ok) {
      return res.status(r.status).json({
        error: 'انتهت جلسة Google Drive أو لم يتم منح صلاحية القراءة — اضغط تحديث/إضافة حساب كوكل',
        needs_google_connection: true,
      });
    }
    const data = (await r.json()) as { files?: Array<Record<string, any>> };
    const items = Array.isArray(data.files) ? data.files : [];
    res.json({ items, files: items });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'تعذر جلب ملفات Google Drive' });
  }
});

app.post('/api/google/drive/upload-file', async (req: Request, res: Response) => {
  const b = req.body || {};
  const uid = String(b.user_id || '').trim();
  const fileId = String(b.file_id || '').trim();
  const rawFileName = String(b.file_name || 'drive_file').trim();
  const mimeType = String(b.mime_type || 'application/octet-stream').trim();
  const targetFolderId = String(b.target_folder_id || 'root').trim() || 'root';

  const gInfo = uid ? getUserActiveGoogleAccessToken(uid) : null;
  if (!gInfo || !gInfo.token) {
    return res.status(401).json({
      success: false,
      error: 'يرجى ربط حساب كوكل أولاً',
      needs_google_connection: true,
    });
  }

  try {
    let downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
    let finalName = rawFileName;
    let finalMime = mimeType;

    if (mimeType === 'application/vnd.google-apps.document') {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId
      )}/export?mimeType=application/pdf`;
      if (!finalName.toLowerCase().endsWith('.pdf')) finalName += '.pdf';
      finalMime = 'application/pdf';
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId
      )}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`;
      if (!finalName.toLowerCase().endsWith('.xlsx')) finalName += '.xlsx';
      finalMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (mimeType === 'application/vnd.google-apps.presentation') {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId
      )}/export?mimeType=application/vnd.openxmlformats-officedocument.presentationml.presentation`;
      if (!finalName.toLowerCase().endsWith('.pptx')) finalName += '.pptx';
      finalMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }

    const r = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${gInfo.token}` },
    });
    if (!r.ok) {
      return res.status(r.status).json({
        success: false,
        error: 'تعذر تنزيل الملف من Google Drive',
      });
    }
    const ab = await r.arrayBuffer();
    const buf = Buffer.from(ab);
    const tmpPath = path.join(UPLOADS_DIR, `gdrive_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`);
    fs.writeFileSync(tmpPath, buf);

    const tgRes = await uploadBufferOrFileToTelegram(tmpPath, finalName, finalMime);
    try {
      fs.unlinkSync(tmpPath);
    } catch {}

    const created = createFileRecord({
      original_name: finalName,
      folder_id: targetFolderId,
      size: buf.length,
      mime_type: finalMime,
      telegram_file_id: tgRes?.file_id || '',
      uploaded_by: uid,
      source: 'google_drive',
    });

    res.json({ success: true, file: formatFileForClient(created, uid) });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'فشل رفع الملف من Google Drive' });
  }
});

app.get('/api/google/classroom/courses', async (req: Request, res: Response) => {
  const uid = String(req.query.user_id || '').trim();
  const gInfo = uid ? getUserActiveGoogleAccessToken(uid) : null;
  if (!gInfo || !gInfo.token) {
    return res.status(401).json({
      error: 'يرجى ربط حساب كوكل للوصول إلى Google Classroom',
      needs_google_connection: true,
    });
  }
  try {
    const r = await fetch('https://classroom.googleapis.com/v1/courses?pageSize=50', {
      headers: { Authorization: `Bearer ${gInfo.token}` },
    });
    if (!r.ok) {
      return res.status(r.status).json({
        error: 'تعذر جلب صفوف Classroom — تأكد من منح صلاحية Classroom عند ربط حساب كوكل',
        needs_google_connection: true,
      });
    }
    const data = (await r.json()) as { courses?: Array<Record<string, any>> };
    res.json({ courses: Array.isArray(data.courses) ? data.courses : [] });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'تعذر جلب الصفوف' });
  }
});

app.get('/api/google/classroom/course/:courseId/materials', async (req: Request, res: Response) => {
  const uid = String(req.query.user_id || '').trim();
  const courseId = pStr(req.params.courseId).trim();
  const gInfo = uid ? getUserActiveGoogleAccessToken(uid) : null;
  if (!gInfo || !gInfo.token) {
    return res.status(401).json({ error: 'يرجى ربط حساب كوكل أولاً', needs_google_connection: true });
  }
  try {
    const headers = { Authorization: `Bearer ${gInfo.token}` };
    const [matRes, cwRes, annRes] = await Promise.all([
      fetch(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/courseWorkMaterials?pageSize=40`, { headers }).catch(() => null),
      fetch(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/courseWork?pageSize=40`, { headers }).catch(() => null),
      fetch(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/announcements?pageSize=40`, { headers }).catch(() => null),
    ]);
    const materials: Array<Record<string, any>> = [];
    if (matRes && matRes.ok) {
      const d = (await matRes.json()) as any;
      for (const m of d.courseWorkMaterial || []) {
        materials.push({
          id: m.id,
          type: 'material',
          title: m.title || 'مادة دراسية',
          text: m.description || '',
          created: m.creationTime || '',
          materials_count: Array.isArray(m.materials) ? m.materials.length : 0,
        });
      }
    }
    if (cwRes && cwRes.ok) {
      const d = (await cwRes.json()) as any;
      for (const w of d.courseWork || []) {
        materials.push({
          id: w.id,
          type: 'courseWork',
          title: w.title || 'مهمة دراسية',
          text: w.description || '',
          created: w.creationTime || '',
          materials_count: Array.isArray(w.materials) ? w.materials.length : 0,
        });
      }
    }
    if (annRes && annRes.ok) {
      const d = (await annRes.json()) as any;
      for (const a of d.announcements || []) {
        materials.push({
          id: a.id,
          type: 'announcement',
          title: (a.text || 'إعلان').slice(0, 70),
          text: a.text || '',
          created: a.creationTime || '',
          materials_count: Array.isArray(a.materials) ? a.materials.length : 0,
        });
      }
    }
    materials.sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')));
    res.json({ materials });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'تعذر جلب منشورات الصف' });
  }
});

app.get('/api/google/classroom/course/:courseId/post/:itemId', async (req: Request, res: Response) => {
  const uid = String(req.query.user_id || '').trim();
  const courseId = pStr(req.params.courseId).trim();
  const itemId = pStr(req.params.itemId).trim();
  const itemType = String(req.query.item_type || 'material').trim();
  const gInfo = uid ? getUserActiveGoogleAccessToken(uid) : null;
  if (!gInfo || !gInfo.token) {
    return res.status(401).json({ error: 'يرجى ربط حساب كوكل أولاً' });
  }
  try {
    const endpoint =
      itemType === 'announcement'
        ? `announcements/${encodeURIComponent(itemId)}`
        : itemType === 'courseWork'
        ? `courseWork/${encodeURIComponent(itemId)}`
        : `courseWorkMaterials/${encodeURIComponent(itemId)}`;
    const r = await fetch(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/${endpoint}`, {
      headers: { Authorization: `Bearer ${gInfo.token}` },
    });
    if (!r.ok) {
      return res.status(r.status).json({ error: 'تعذر تحميل تفاصيل المنشور' });
    }
    const raw = (await r.json()) as any;
    const attachments: Array<Record<string, any>> = [];
    for (const m of raw.materials || []) {
      if (m.driveFile?.driveFile) {
        attachments.push({
          type: 'drive',
          id: m.driveFile.driveFile.id,
          title: m.driveFile.driveFile.title || 'ملف Drive',
          url: m.driveFile.driveFile.alternateLink || '',
        });
      } else if (m.youtubeVideo) {
        attachments.push({
          type: 'youtube',
          title: m.youtubeVideo.title || 'فيديو يوتيوب',
          url: m.youtubeVideo.alternateLink || '',
        });
      } else if (m.link) {
        attachments.push({
          type: 'link',
          title: m.link.title || m.link.url || 'رابط',
          url: m.link.url || '',
        });
      }
    }
    res.json({
      post: {
        id: raw.id,
        title: raw.title || (raw.text || '').slice(0, 60) || 'منشور',
        text: raw.description || raw.text || '',
        created: raw.creationTime || '',
        attachments,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'تعذر جلب تفاصيل المنشور' });
  }
});

// ==================== START SERVER IMMEDIATELY ====================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Nukhaa] Server listening on http://0.0.0.0:${PORT}`);
  initDb()
    .then(() => startTelegramBotPolling())
    .catch((err) => {
      console.error('[Nukhaa] Background DB/Bot sync error:', err);
    });
});
