import { dbLoadDoc, dbSaveDoc, nowBaghdadStr, normalizeArabic } from './db.ts';
import crypto from 'crypto';

function genId(len = 16): string {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

// ==================== TAXONOMY CATALOG ====================
const COLLECTION_TAGS = 'tags';
const DOC_TAGS_CONFIG = 'config';

const IRAQ_GOVERNORATE_ROWS: Array<[string, string, string]> = [
  ['بغداد', 'Baghdad', 'IQ-BG'],
  ['البصرة', 'Basra', 'IQ-BA'],
  ['نينوى', 'Nineveh', 'IQ-NI'],
  ['أربيل', 'Erbil', 'IQ-AR'],
  ['النجف', 'Najaf', 'IQ-NA'],
  ['كربلاء', 'Karbala', 'IQ-KA'],
  ['السليمانية', 'Sulaymaniyah', 'IQ-SU'],
  ['دهوك', 'Duhok', 'IQ-DA'],
  ['كركوك', 'Kirkuk', 'IQ-KI'],
  ['الأنبار', 'Anbar', 'IQ-AN'],
  ['ديالى', 'Diyala', 'IQ-DI'],
  ['بابل', 'Babylon', 'IQ-BB'],
  ['واسط', 'Wasit', 'IQ-WA'],
  ['ذي قار', 'Dhi Qar', 'IQ-DQ'],
  ['ميسان', 'Maysan', 'IQ-MA'],
  ['المثنى', 'Muthanna', 'IQ-MU'],
  ['القادسية', 'Qadisiyyah', 'IQ-QA'],
  ['صلاح الدين', 'Saladin', 'IQ-SD'],
  ['حلبجة', 'Halabja', 'IQ-HL'],
];

const IRAQI_GOVERNORATES: Array<Record<string, any>> = IRAQ_GOVERNORATE_ROWS.map(([ar, en, code]) => ({
  id: code.toLowerCase(),
  code,
  name: ar,
  name_ar: ar,
  name_en: en,
  country_code: 'IQ',
}));

const ISO_COUNTRY_CODES = [
  'IQ', 'EG', 'SA', 'SY', 'JO', 'LB', 'PS', 'KW', 'AE', 'QA', 'BH', 'OM', 'YE',
  'DZ', 'MA', 'TN', 'LY', 'SD', 'MR', 'SO', 'DJ', 'KM',
  'TR', 'IR', 'DE', 'GB', 'US', 'FR', 'IT', 'ES', 'CA', 'AU', 'RU', 'UA', 'CN', 'JP', 'KR', 'IN', 'PK', 'MY', 'ID',
  'AF', 'AL', 'AD', 'AO', 'AG', 'AR', 'AM', 'AT', 'AZ', 'BS', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BT', 'BO', 'BA',
  'BW', 'BR', 'BN', 'BG', 'BF', 'BI', 'CV', 'KH', 'CM', 'CF', 'TD', 'CL', 'CO', 'CG', 'CD', 'CR', 'CI', 'HR', 'CU',
  'CY', 'CZ', 'DK', 'DM', 'DO', 'EC', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET', 'FJ', 'FI', 'GA', 'GM', 'GE', 'GH', 'GR',
  'GD', 'GT', 'GN', 'GW', 'GY', 'HT', 'HN', 'HU', 'IS', 'IE', 'IL', 'JM', 'KZ', 'KE', 'KI', 'KP', 'KG', 'LA', 'LV',
  'LS', 'LR', 'LI', 'LT', 'LU', 'MG', 'MW', 'MV', 'ML', 'MT', 'MH', 'MU', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MZ',
  'MM', 'NA', 'NR', 'NP', 'NL', 'NZ', 'NI', 'NE', 'NG', 'MK', 'NO', 'PW', 'PA', 'PG', 'PY', 'PE', 'PH', 'PL', 'PT',
  'RO', 'RW', 'KN', 'LC', 'VC', 'WS', 'SM', 'ST', 'SN', 'RS', 'SC', 'SL', 'SG', 'SK', 'SI', 'SB', 'ZA', 'SS', 'LK',
  'SR', 'SE', 'CH', 'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TO', 'TT', 'TM', 'TV', 'UG', 'UY', 'UZ', 'VU', 'VA', 'VE',
  'VN', 'ZM', 'ZW',
];

const KURDISH_COUNTRY_NAMES: Record<string, string> = {
  IQ: 'عێراق',
  EG: 'میسر',
  SA: 'سعودیە',
  JO: 'ئوردن',
  SY: 'سوریا',
  LB: 'لوبنان',
  PS: 'فەلەستین',
  KW: 'کوێت',
  AE: 'ئیمارات',
  QA: 'قەتەر',
  BH: 'بەحرەین',
  OM: 'عومان',
  YE: 'یەمەن',
  TR: 'تورکیا',
  IR: 'ئێران',
  DE: 'ئەڵمانیا',
  GB: 'بەریتانیا',
  US: 'ئەمریکا',
  FR: 'فەڕەنسا',
  IT: 'ئیتاڵیا',
  ES: 'ئیسپانیا',
  CA: 'کەنەدا',
  AU: 'ئوسترالیا',
  RU: 'ڕووسیا',
  CN: 'چین',
  JP: 'ژاپۆن',
  IN: 'هیندستان',
  SE: 'سوید',
  NL: 'هۆڵەندا',
  CH: 'سویسرا',
  AT: 'نەمسا',
  NO: 'نەرویج',
  DK: 'دانیمارک',
  FI: 'فینلەندا',
  IS: 'ئایسلەندا',
};

function codeToFlagEmoji(code: string): string {
  const clean = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) return '🏳️';
  return String.fromCodePoint(...clean.split('').map((c) => 127397 + c.charCodeAt(0)));
}

function buildAllWorldCountries(): Array<Record<string, any>> {
  let arDisplay: Intl.DisplayNames | null = null;
  let enDisplay: Intl.DisplayNames | null = null;
  try {
    arDisplay = new Intl.DisplayNames(['ar'], { type: 'region' });
    enDisplay = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    // fallback if Intl not available
  }

  const seen = new Set<string>();
  const list: Array<Record<string, any>> = [];
  for (const rawCode of ISO_COUNTRY_CODES) {
    const code = rawCode.toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    let nameAr = code;
    let nameEn = code;
    try {
      nameAr = arDisplay?.of(code) || code;
      nameEn = enDisplay?.of(code) || code;
    } catch {
      // ignore
    }
    if (code === 'PS') {
      nameAr = 'فلسطين';
      nameEn = 'Palestine';
    }
    const flag = codeToFlagEmoji(code);
    const nameKu = KURDISH_COUNTRY_NAMES[code] || nameAr;
    list.push({
      id: `country:${code}`,
      code,
      name: nameAr,
      name_ar: nameAr,
      name_en: nameEn,
      name_ku: nameKu,
      translations: { en: nameEn, ku: nameKu },
      flag,
      flag_emoji: flag,
      governorates: code === 'IQ' ? IRAQI_GOVERNORATES : [],
    });
  }
  return list;
}

export const DEFAULT_COUNTRIES: Array<Record<string, any>> = buildAllWorldCountries();

function makeInstId(countryCode: string, name: string): string {
  return `institution:${countryCode.toUpperCase()}:${encodeURIComponent(name.trim())}`;
}

function faviconLogo(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`;
}

const RAW_IRAQI_INSTITUTIONS: Array<{
  name: string;
  name_en: string;
  name_ku?: string;
  domain: string;
  aliases?: string[];
}> = [
  { name: 'جامعة بغداد', name_en: 'University of Baghdad', name_ku: 'زانکۆی بەغدا', domain: 'uobaghdad.edu.iq', aliases: ['Baghdad University', 'UOB'] },
  { name: 'الجامعة المستنصرية', name_en: 'Mustansiriyah University', name_ku: 'زانکۆی موستەنسریە', domain: 'uomustansiriyah.edu.iq', aliases: ['Al-Mustansiriya University'] },
  { name: 'جامعة النهرين', name_en: 'Al-Nahrain University', name_ku: 'زانکۆی نەهرەین', domain: 'nahrainuniv.edu.iq', aliases: ['Nahrain University'] },
  { name: 'الجامعة التكنولوجية', name_en: 'University of Technology, Iraq', name_ku: 'زانکۆی تەکنەلۆجیا', domain: 'uotechnology.edu.iq', aliases: ['UOT'] },
  { name: 'جامعة البصرة', name_en: 'University of Basrah', name_ku: 'زانکۆی بەسرە', domain: 'uobasrah.edu.iq', aliases: ['Basra University'] },
  { name: 'جامعة الموصل', name_en: 'University of Mosul', name_ku: 'زانکۆی مووسڵ', domain: 'uomosul.edu.iq', aliases: ['Mosul University'] },
  { name: 'جامعة الكوفة', name_en: 'University of Kufa', name_ku: 'زانکۆی کووفە', domain: 'uokufa.edu.iq', aliases: ['Kufa University'] },
  { name: 'جامعة بابل', name_en: 'University of Babylon', name_ku: 'زانکۆی بابل', domain: 'uobabylon.edu.iq', aliases: ['Babylon University'] },
  { name: 'جامعة كربلاء', name_en: 'University of Karbala', name_ku: 'زانکۆی کەربەلا', domain: 'uokerbala.edu.iq', aliases: ['Kerbala University'] },
  { name: 'جامعة القادسية', name_en: 'University of Al-Qadisiyah', name_ku: 'زانکۆی قادسیە', domain: 'qu.edu.iq', aliases: ['Qadisiyah University'] },
  { name: 'جامعة ذي قار', name_en: 'University of Thi-Qar', name_ku: 'زانکۆی زیقار', domain: 'utq.edu.iq', aliases: ['Thi Qar University', 'Dhi Qar University'] },
  { name: 'جامعة الأنبار', name_en: 'University of Anbar', name_ku: 'زانکۆی ئەنبار', domain: 'uoanbar.edu.iq', aliases: ['Anbar University'] },
  { name: 'جامعة ديالى', name_en: 'University of Diyala', name_ku: 'زانکۆی دیالە', domain: 'uodiyala.edu.iq', aliases: ['Diyala University'] },
  { name: 'جامعة تكريت', name_en: 'Tikrit University', name_ku: 'زانکۆی تکریت', domain: 'tu.edu.iq', aliases: ['University of Tikrit'] },
  { name: 'جامعة كركوك', name_en: 'University of Kirkuk', name_ku: 'زانکۆی کەرکووک', domain: 'uokirkuk.edu.iq', aliases: ['Kirkuk University'] },
  { name: 'جامعة واسط', name_en: 'University of Wasit', name_ku: 'زانکۆی واست', domain: 'uowasit.edu.iq', aliases: ['Wasit University'] },
  { name: 'جامعة ميسان', name_en: 'University of Misan', name_ku: 'زانکۆی میسان', domain: 'uomisan.edu.iq', aliases: ['Maysan University'] },
  { name: 'جامعة المثنى', name_en: 'Al-Muthanna University', name_ku: 'زانکۆی موسەنا', domain: 'mu.edu.iq', aliases: ['Muthanna University'] },
  { name: 'جامعة ابن سينا للعلوم الطبية والصيدلانية', name_en: 'Ibn Sina University of Medical and Pharmaceutical Sciences', name_ku: 'زانکۆی ئیبن سینا بۆ زانستە پزیشکی و دەرمانسازییەکان', domain: 'ibnsina.edu.iq', aliases: ['Ibn Sina Medical University'] },
  { name: 'جامعة جابر بن حيان الطبية', name_en: 'Jabir Ibn Hayyan Medical University', name_ku: 'زانکۆی جابر کوڕی حەیانی پزیشکی', domain: 'jmu.edu.iq', aliases: ['Jabir Medical University'] },
  { name: 'كلية طب الزهراء', name_en: 'Al-Zahraa Medical College', name_ku: 'کۆلێژی پزیشکی زەهرا', domain: 'uobasrah.edu.iq', aliases: ['كلية الطب الزهراء - جامعة البصرة'] },
  { name: 'جامعة الفلوجة', name_en: 'University of Fallujah', name_ku: 'زانکۆی فەلووجە', domain: 'uofallujah.edu.iq', aliases: ['Fallujah University'] },
  { name: 'جامعة سامراء', name_en: 'University of Samarra', name_ku: 'زانکۆی سامەڕا', domain: 'uosamarra.edu.iq', aliases: ['Samarra University'] },
  { name: 'جامعة نينوى', name_en: 'Ninevah University', name_ku: 'زانکۆی نەینەوا', domain: 'uoninevah.edu.iq', aliases: ['Nineveh University'] },
  { name: 'جامعة سومر', name_en: 'University of Sumer', name_ku: 'زانکۆی سۆمەر', domain: 'uos.edu.iq', aliases: ['Sumer University'] },
  { name: 'جامعة القاسم الخضراء', name_en: 'Al-Qasim Green University', name_ku: 'زانکۆی قاسمی سەوز', domain: 'uoqasim.edu.iq', aliases: ['Qasim Green University'] },
  { name: 'جامعة الكرخ للعلوم', name_en: 'Al-Karkh University of Science', name_ku: 'زانکۆی کەرخ بۆ زانست', domain: 'kus.edu.iq', aliases: ['Karkh University'] },
  { name: 'جامعة البصرة للنفط والغاز', name_en: 'Basrah University for Oil and Gas', name_ku: 'زانکۆی بەسرە بۆ نەوت و گاز', domain: 'buog.edu.iq', aliases: ['BUOG'] },
  { name: 'جامعة تلعفر', name_en: 'University of Telafer', name_ku: 'زانکۆی تەلەعفەر', domain: 'uotelafer.edu.iq', aliases: ['Tal Afar University'] },
  { name: 'جامعة الحمدانية', name_en: 'University of Al-Hamdaniya', name_ku: 'زانکۆی حەمدانیە', domain: 'uohamdaniya.edu.iq', aliases: ['Hamdaniya University'] },
  { name: 'الجامعة العراقية', name_en: 'Al-Iraqia University', name_ku: 'زانکۆی عێراقیە', domain: 'aliraqia.edu.iq', aliases: ['Iraqia University'] },
  { name: 'جامعة تكنولوجيا المعلومات والاتصالات', name_en: 'University of Information Technology and Communications', name_ku: 'زانکۆی تەکنەلۆجیای زانیاری و پەیوەندییەکان', domain: 'uoitc.edu.iq', aliases: ['UOITC'] },
  { name: 'الجامعة التقنية الوسطى', name_en: 'Middle Technical University', name_ku: 'زانکۆی تەکنیکی ناوەڕاست', domain: 'mtu.edu.iq', aliases: ['MTU'] },
  { name: 'الجامعة التقنية الجنوبية', name_en: 'Southern Technical University', name_ku: 'زانکۆی تەکنیکی باشوور', domain: 'stu.edu.iq', aliases: ['STU'] },
  { name: 'الجامعة التقنية الشمالية', name_en: 'Northern Technical University', name_ku: 'زانکۆی تەکنیکی باکوور', domain: 'ntu.edu.iq', aliases: ['NTU'] },
  { name: 'جامعة الفرات الأوسط التقنية', name_en: 'Al-Furat Al-Awsat Technical University', name_ku: 'زانکۆی تەکنیکی فوراتی ناوەڕاست', domain: 'atu.edu.iq', aliases: ['ATU'] },
  { name: 'جامعة صلاح الدين - أربيل', name_en: 'Salahaddin University-Erbil', name_ku: 'زانکۆی سەلاحەدین - هەولێر', domain: 'su.edu.krd', aliases: ['جامعة صلاح الدين', 'Salahaddin University'] },
  { name: 'جامعة هولير الطبية', name_en: 'Hawler Medical University', name_ku: 'زانکۆی پزیشکی هەولێر', domain: 'hmu.edu.krd', aliases: ['جامعة أربيل الطبية'] },
  { name: 'جامعة السليمانية', name_en: 'University of Sulaimani', name_ku: 'زانکۆی سلێمانی', domain: 'univsul.edu.iq', aliases: ['Sulaimani University'] },
  { name: 'جامعة دهوك', name_en: 'University of Duhok', name_ku: 'زانکۆی دهۆک', domain: 'uod.ac', aliases: ['Duhok University'] },
  { name: 'جامعة زاخو', name_en: 'University of Zakho', name_ku: 'زانکۆی زاخۆ', domain: 'uoz.edu.krd', aliases: ['Zakho University'] },
  { name: 'جامعة كويه', name_en: 'Koya University', name_ku: 'زانکۆی کۆیە', domain: 'koyauniversity.org', aliases: ['جامعة كويسنجق'] },
  { name: 'جامعة سوران', name_en: 'Soran University', name_ku: 'زانکۆی سۆران', domain: 'soran.edu.iq', aliases: [] },
  { name: 'جامعة حلبجة', name_en: 'University of Halabja', name_ku: 'زانکۆی هەڵەبجە', domain: 'uoh.edu.iq', aliases: [] },
  { name: 'جامعة كرميان', name_en: 'University of Garmian', name_ku: 'زانکۆی گەرمیان', domain: 'garmian.edu.krd', aliases: [] },
  { name: 'جامعة رابرين', name_en: 'University of Raparin', name_ku: 'زانکۆی ڕاپەڕین', domain: 'uor.edu.krd', aliases: [] },
  { name: 'جامعة بوليتكنيك أربيل', name_en: 'Erbil Polytechnic University', name_ku: 'زانکۆی پۆلیتەکنیکی هەولێر', domain: 'epu.edu.iq', aliases: ['EPU'] },
  { name: 'جامعة بوليتكنيك السليمانية', name_en: 'Sulaimani Polytechnic University', name_ku: 'زانکۆی پۆلیتەکنیکی سلێمانی', domain: 'spu.edu.iq', aliases: ['SPU'] },
  { name: 'جامعة بوليتكنيك دهوك', name_en: 'Duhok Polytechnic University', name_ku: 'زانکۆی پۆلیتەکنیکی دهۆک', domain: 'dpu.edu.krd', aliases: ['DPU'] },
  { name: 'جامعة كردستان - هولير', name_en: 'University of Kurdistan Hewler', name_ku: 'زانکۆی کوردستان - هەولێر', domain: 'ukh.edu.krd', aliases: ['UKH'] },
  { name: 'جامعة العميد', name_en: 'University of Al-Ameed', name_ku: 'زانکۆی عەمید', domain: 'alameed.edu.iq', aliases: ['Al-Ameed University'] },
  { name: 'جامعة وارث الأنبياء', name_en: 'University of Warith Al-Anbiyaa', name_ku: 'زانکۆی وارس ئەلئەنبیا', domain: 'uowa.edu.iq', aliases: ['Warith Al-Anbiyaa University'] },
  { name: 'جامعة الكفيل', name_en: 'University of Alkafeel', name_ku: 'زانکۆی کەفیل', domain: 'alkafeel.edu.iq', aliases: ['Al-Kafeel University'] },
  { name: 'جامعة الزهراء للبنات', name_en: 'Al-Zahraa University for Women', name_ku: 'زانکۆی زەهرا بۆ کچان', domain: 'alzahraa.edu.iq', aliases: [] },
  { name: 'جامعة السبطين للعلوم الطبية', name_en: 'Al-Sibtain University for Medical Sciences', name_ku: 'زانکۆی سبتەین بۆ زانستە پزیشکییەکان', domain: 'alsibtain.edu.iq', aliases: [] },
  { name: 'جامعة التراث', name_en: 'Al-Turath University', name_ku: 'زانکۆی توراس', domain: 'turath.edu.iq', aliases: [] },
  { name: 'جامعة المنصور', name_en: 'Al-Mansour University College', name_ku: 'کۆلێژی زانکۆیی مەنسوور', domain: 'muc.edu.iq', aliases: ['كلية المنصور الجامعة'] },
  { name: 'جامعة الرافدين', name_en: 'Al-Rafidain University College', name_ku: 'کۆلێژی زانکۆیی ڕافیدەین', domain: 'ruc.edu.iq', aliases: ['كلية الرافدين الجامعة'] },
  { name: 'جامعة المأمون', name_en: 'Al-Mamoon University College', name_ku: 'کۆلێژی زانکۆیی مەئموون', domain: 'almamonuc.edu.iq', aliases: ['كلية المأمون الجامعة'] },
  { name: 'جامعة دجلة', name_en: 'Dijlah University College', name_ku: 'کۆلێژی زانکۆیی دیجلە', domain: 'duc.edu.iq', aliases: ['كلية دجلة الجامعة'] },
  { name: 'جامعة الفراهيدي', name_en: 'Al-Farahidi University', name_ku: 'زانکۆی فەراهیدی', domain: 'uoalfarahidi.edu.iq', aliases: [] },
  { name: 'جامعة أوروك', name_en: 'Uruk University', name_ku: 'زانکۆی ئورووک', domain: 'uruk.edu.iq', aliases: [] },
  { name: 'جامعة العين العراقية', name_en: 'Al-Ayen Iraqi University', name_ku: 'زانکۆی عەین', domain: 'alayen.edu.iq', aliases: ['جامعة العين'] },
  { name: 'جامعة المستقبل', name_en: 'Al-Mustaqbal University', name_ku: 'زانکۆی موستەقبەل', domain: 'uomus.edu.iq', aliases: ['كلية المستقبل الجامعة'] },
  { name: 'الجامعة الأسلامية', name_en: 'The Islamic University, Najaf', name_ku: 'زانکۆی ئیسلامی', domain: 'iunajaf.edu.iq', aliases: ['الجامعة الإسلامية في النجف'] },
  { name: 'جامعة الإسراء', name_en: 'Al-Esraa University', name_ku: 'زانکۆی ئیسرا', domain: 'esraa.edu.iq', aliases: ['كلية الإسراء الجامعة'] },
  { name: 'جامعة البيان', name_en: 'Al-Bayan University', name_ku: 'زانکۆی بەیان', domain: 'albayan.edu.iq', aliases: [] },
  { name: 'جامعة الكتاب', name_en: 'Al-Kitab University', name_ku: 'زانکۆی کیتاب', domain: 'uoalkitab.edu.iq', aliases: [] },
  { name: 'جامعة جيهان - أربيل', name_en: 'Cihan University-Erbil', name_ku: 'زانکۆی جیهان - هەولێر', domain: 'cihanuniversity.edu.iq', aliases: ['جامعة جيهان'] },
  { name: 'الجامعة الأمريكية في العراق - السليمانية', name_en: 'American University of Iraq, Sulaimani', name_ku: 'زانکۆی ئەمریکی لە عێراق - سلێمانی', domain: 'auis.edu.krd', aliases: ['AUIS'] },
  { name: 'الجامعة الأمريكية في العراق - بغداد', name_en: 'American University of Iraq - Baghdad', name_ku: 'زانکۆی ئەمریکی لە عێراق - بەغدا', domain: 'auib.edu.iq', aliases: ['AUIB'] },
  { name: 'كلية بغداد للعلوم الطبية', name_en: 'Baghdad College of Medical Sciences', name_ku: 'کۆلێژی بەغدا بۆ زانستە پزیشکییەکان', domain: 'bcms.edu.iq', aliases: [] },
  { name: 'كلية الحلة الجامعة', name_en: 'Hilla University College', name_ku: 'کۆلێژی حللە', domain: 'hilla-unc.edu.iq', aliases: [] },
  { name: 'كلية الزهاوي الجامعة', name_en: 'Al-Zahrawi University College', name_ku: 'کۆلێژی زەهراوی', domain: 'g.alzahu.edu.iq', aliases: ['كلية الزهراوي الجامعة'] },
  { name: 'كلية اشور الجامعة', name_en: 'Ashur University', name_ku: 'زانکۆی ئاشوور', domain: 'au.edu.iq', aliases: ['جامعة آشور'] },
  { name: 'كلية المعقل الجامعة', name_en: 'Al-Maaqal University', name_ku: 'زانکۆی مەعقەل', domain: 'almaaqal.edu.iq', aliases: ['جامعة المعقل'] },
  { name: 'كلية الكوت الجامعة', name_en: 'Al-Kut University College', name_ku: 'کۆلێژی کووت', domain: 'alkutcollege.edu.iq', aliases: [] },
  { name: 'كلية النور الجامعة', name_en: 'Al-Noor University', name_ku: 'زانکۆی نوور', domain: 'alnoor.edu.iq', aliases: ['جامعة النور'] },
  { name: 'كلية الحدباء الجامعة', name_en: 'Al-Hadba University', name_ku: 'زانکۆی حەدبا', domain: 'hu.edu.iq', aliases: ['جامعة الحدباء'] },
  { name: 'جامعة تيشك الدولية', name_en: 'Tishk International University', name_ku: 'زانکۆی نێودەوڵەتی تیشک', domain: 'tiu.edu.iq', aliases: ['TIU', 'جامعة إيشك'] },
  { name: 'جامعة كومار للعلوم والتكنولوجيا', name_en: 'Komar University of Science and Technology', name_ku: 'زانکۆی کۆمار بۆ زانست و تەکنەلۆجیا', domain: 'komar.edu.iq', aliases: ['KUST'] },
];

const RAW_WORLD_INSTITUTIONS: Array<{
  country_code: string;
  name: string;
  name_en: string;
  domain: string;
  aliases?: string[];
}> = [
  // Egypt
  { country_code: 'EG', name: 'جامعة القاهرة', name_en: 'Cairo University', domain: 'cu.edu.eg', aliases: ['قصر العيني'] },
  { country_code: 'EG', name: 'جامعة عين شمس', name_en: 'Ain Shams University', domain: 'asu.edu.eg' },
  { country_code: 'EG', name: 'جامعة الإسكندرية', name_en: 'Alexandria University', domain: 'alexu.edu.eg' },
  { country_code: 'EG', name: 'جامعة المنصورة', name_en: 'Mansoura University', domain: 'mans.edu.eg' },
  { country_code: 'EG', name: 'جامعة الأزهر', name_en: 'Al-Azhar University', domain: 'azhar.edu.eg' },
  { country_code: 'EG', name: 'جامعة أسيوط', name_en: 'Assiut University', domain: 'aun.edu.eg' },
  { country_code: 'EG', name: 'جامعة الزقازيق', name_en: 'Zagazig University', domain: 'zu.edu.eg' },
  { country_code: 'EG', name: 'جامعة طنطا', name_en: 'Tanta University', domain: 'tanta.edu.eg' },
  // Saudi Arabia
  { country_code: 'SA', name: 'جامعة الملك سعود', name_en: 'King Saud University', domain: 'ksu.edu.sa' },
  { country_code: 'SA', name: 'جامعة الملك عبد العزيز', name_en: 'King Abdulaziz University', domain: 'kau.edu.sa' },
  { country_code: 'SA', name: 'جامعة الملك فيصل', name_en: 'King Faisal University', domain: 'kfu.edu.sa' },
  { country_code: 'SA', name: 'جامعة الملك خالد', name_en: 'King Khalid University', domain: 'kku.edu.sa' },
  { country_code: 'SA', name: 'جامعة أم القرى', name_en: 'Umm Al-Qura University', domain: 'uqu.edu.sa' },
  { country_code: 'SA', name: 'جامعة الإمام عبد الرحمن بن فيصل', name_en: 'Imam Abdulrahman Bin Faisal University', domain: 'iau.edu.sa' },
  // Jordan
  { country_code: 'JO', name: 'الجامعة الأردنية', name_en: 'University of Jordan', domain: 'ju.edu.jo' },
  { country_code: 'JO', name: 'جامعة العلوم والتكنولوجيا الأردنية', name_en: 'Jordan University of Science and Technology', domain: 'just.edu.jo' },
  { country_code: 'JO', name: 'جامعة اليرموك', name_en: 'Yarmouk University', domain: 'yu.edu.jo' },
  { country_code: 'JO', name: 'الجامعة الهاشمية', name_en: 'The Hashemite University', domain: 'hu.edu.jo' },
  { country_code: 'JO', name: 'جامعة مؤتة', name_en: 'Mutah University', domain: 'mutah.edu.jo' },
  // Syria
  { country_code: 'SY', name: 'جامعة دمشق', name_en: 'Damascus University', domain: 'damascusuniversity.edu.sy' },
  { country_code: 'SY', name: 'جامعة حلب', name_en: 'University of Aleppo', domain: 'alepuniv.edu.sy' },
  { country_code: 'SY', name: 'جامعة تشرين', name_en: 'Tishreen University', domain: 'tishreen.edu.sy' },
  { country_code: 'SY', name: 'جامعة البعث', name_en: 'Al-Baath University', domain: 'albaath-univ.edu.sy' },
  // Lebanon & Palestine & Gulf
  { country_code: 'LB', name: 'الجامعة الأميركية في بيروت', name_en: 'American University of Beirut', domain: 'aub.edu.lb' },
  { country_code: 'LB', name: 'الجامعة اللبنانية', name_en: 'Lebanese University', domain: 'ul.edu.lb' },
  { country_code: 'PS', name: 'جامعة النجاح الوطنية', name_en: 'An-Najah National University', domain: 'najah.edu' },
  { country_code: 'PS', name: 'جامعة القدس', name_en: 'Al-Quds University', domain: 'alquds.edu' },
  { country_code: 'PS', name: 'الجامعة الإسلامية بغزة', name_en: 'Islamic University of Gaza', domain: 'iugaza.edu.ps' },
  { country_code: 'KW', name: 'جامعة الكويت', name_en: 'Kuwait University', domain: 'ku.edu.kw' },
  { country_code: 'AE', name: 'جامعة الإمارات العربية المتحدة', name_en: 'United Arab Emirates University', domain: 'uaeu.ac.ae' },
  { country_code: 'AE', name: 'جامعة الشارقة', name_en: 'University of Sharjah', domain: 'sharjah.ac.ae' },
  { country_code: 'QA', name: 'جامعة قطر', name_en: 'Qatar University', domain: 'qu.edu.qa' },
  { country_code: 'OM', name: 'جامعة السلطان قابوس', name_en: 'Sultan Qaboos University', domain: 'squ.edu.om' },
  { country_code: 'BH', name: 'جامعة الخليج العربي', name_en: 'Arabian Gulf University', domain: 'agu.edu.bh' },
  { country_code: 'YE', name: 'جامعة صنعاء', name_en: 'Sanaa University', domain: 'su.edu.ye' },
  { country_code: 'YE', name: 'جامعة عدن', name_en: 'University of Aden', domain: 'aden-univ.net' },
  { country_code: 'SD', name: 'جامعة الخرطوم', name_en: 'University of Khartoum', domain: 'uofk.edu' },
  { country_code: 'DZ', name: 'جامعة الجزائر 1', name_en: 'University of Algiers 1', domain: 'univ-alger.dz' },
  { country_code: 'MA', name: 'جامعة محمد الخامس', name_en: 'Mohammed V University', domain: 'um5.ac.ma' },
  { country_code: 'TN', name: 'جامعة تونس المنار', name_en: 'University of Tunis El Manar', domain: 'utm.rnu.tn' },
  { country_code: 'LY', name: 'جامعة طرابلس', name_en: 'University of Tripoli', domain: 'uot.edu.ly' },
  // Global Medical / Top Universities
  { country_code: 'GB', name: 'جامعة أكسفورد', name_en: 'University of Oxford', domain: 'ox.ac.uk' },
  { country_code: 'GB', name: 'جامعة كامبريدج', name_en: 'University of Cambridge', domain: 'cam.ac.uk' },
  { country_code: 'GB', name: 'كلية لندن الإمبراطورية', name_en: 'Imperial College London', domain: 'imperial.ac.uk' },
  { country_code: 'GB', name: 'كلية لندن الجامعية', name_en: 'University College London (UCL)', domain: 'ucl.ac.uk' },
  { country_code: 'US', name: 'جامعة هارفارد', name_en: 'Harvard University', domain: 'harvard.edu' },
  { country_code: 'US', name: 'جامعة جونز هوبكنز', name_en: 'Johns Hopkins University', domain: 'jhu.edu' },
  { country_code: 'US', name: 'جامعة ستانفورد', name_en: 'Stanford University', domain: 'stanford.edu' },
  { country_code: 'DE', name: 'جامعة شاريتيه برلين الطبية', name_en: 'Charité - Universitätsmedizin Berlin', domain: 'charite.de' },
  { country_code: 'DE', name: 'جامعة هايدلبرغ', name_en: 'Heidelberg University', domain: 'uni-heidelberg.de' },
  { country_code: 'TR', name: 'جامعة إسطنبول', name_en: 'Istanbul University', domain: 'istanbul.edu.tr' },
  { country_code: 'TR', name: 'جامعة حاجي تبه', name_en: 'Hacettepe University', domain: 'hacettepe.edu.tr' },
  { country_code: 'TR', name: 'جامعة أنقرة', name_en: 'Ankara University', domain: 'ankara.edu.tr' },
  { country_code: 'IR', name: 'جامعة طهران للعلوم الطبية', name_en: 'Tehran University of Medical Sciences', domain: 'tums.ac.ir' },
  { country_code: 'RU', name: 'جامعة سيتشينوف الطبية الأولى في موسكو', name_en: 'Sechenov First Moscow State Medical University', domain: 'sechenov.ru' },
];

export const DEFAULT_IRAQI_INSTITUTIONS: Array<Record<string, any>> = RAW_IRAQI_INSTITUTIONS.map((item) => {
  const logo = faviconLogo(item.domain);
  return {
    id: makeInstId('IQ', item.name),
    name: item.name,
    name_ar: item.name,
    name_en: item.name_en,
    name_ku: item.name_ku || item.name,
    translations: {
      en: item.name_en,
      ku: item.name_ku || item.name,
    },
    country_code: 'IQ',
    domain: item.domain,
    website: `https://${item.domain}`,
    icon: logo,
    logo_url: logo,
    aliases: item.aliases || [],
  };
});

export const DEFAULT_WORLD_INSTITUTIONS: Array<Record<string, any>> = RAW_WORLD_INSTITUTIONS.map((item) => {
  const logo = faviconLogo(item.domain);
  return {
    id: makeInstId(item.country_code, item.name),
    name: item.name,
    name_ar: item.name,
    name_en: item.name_en,
    name_ku: item.name,
    translations: {
      en: item.name_en,
      ku: item.name,
    },
    country_code: item.country_code,
    domain: item.domain,
    website: `https://${item.domain}`,
    icon: logo,
    logo_url: logo,
    aliases: item.aliases || [],
  };
});

// Optional external world universities cache (loaded asynchronously in background)
let externalWorldUniversities: Array<Record<string, any>> = [];
let externalWorldLoadStarted = false;

function triggerExternalWorldUniversitiesLoad(): void {
  if (externalWorldLoadStarted) return;
  externalWorldLoadStarted = true;
  fetch('https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((data: any) => {
      if (!Array.isArray(data)) return;
      const mapped: Array<Record<string, any>> = [];
      for (const row of data) {
        const cc = String(row?.alpha_two_code || '').toUpperCase();
        const nameEn = String(row?.name || '').trim();
        if (!cc || !nameEn) continue;
        const domain = Array.isArray(row?.domains) && row.domains[0] ? String(row.domains[0]) : '';
        const logo = domain ? faviconLogo(domain) : '';
        mapped.push({
          id: makeInstId(cc, nameEn),
          name: nameEn,
          name_ar: nameEn,
          name_en: nameEn,
          name_ku: nameEn,
          translations: { en: nameEn, ku: nameEn },
          country_code: cc,
          domain,
          website: Array.isArray(row?.web_pages) && row.web_pages[0] ? String(row.web_pages[0]) : domain ? `https://${domain}` : '',
          icon: logo,
          logo_url: logo,
          aliases: [],
        });
      }
      externalWorldUniversities = mapped;
    })
    .catch(() => {
      // ignore offline or fetch errors
    });
}

// Start loading world universities in background
triggerExternalWorldUniversitiesLoad();

export const TAG_PALETTE = [
  '#D4A574', '#E57373', '#F06292', '#BA68C8',
  '#9575CD', '#7986CB', '#64B5F6', '#4FC3F7',
  '#4DD0E1', '#4DB6AC', '#81C784', '#AED581',
  '#FFD54F', '#FFB74D', '#FF8A65', '#A1887F',
];

function normalizeParentTagId(parentTagId: string | null | undefined): string | null {
  if (!parentTagId) return null;
  const raw = String(parentTagId).trim();
  if (!raw) return null;
  // Convert legacy underscore institution IDs like institution:IQ:جامعة_البصرة to URL-encoded form
  if (raw.startsWith('institution:') && !raw.includes('%')) {
    const parts = raw.split(':');
    if (parts.length >= 3) {
      const cc = parts[1].toUpperCase();
      const rest = parts.slice(2).join(':').replace(/_/g, ' ').trim();
      return `institution:${cc}:${encodeURIComponent(rest)}`;
    }
  }
  return raw;
}

function normalizeTaxonomyDocInPlace(doc: Record<string, any>): boolean {
  let changed = false;
  if (!Array.isArray(doc.categories)) {
    doc.categories = [];
    changed = true;
  }
  if (!Array.isArray(doc.tags)) {
    doc.tags = doc.tags && typeof doc.tags === 'object' ? Object.values(doc.tags) : [];
    changed = true;
  }

  // Find Country category id
  const countryCat = doc.categories.find(
    (c: any) =>
      c?.catalog_source === 'countries' ||
      c?.id === 'cat_1784099815232' ||
      c?.id === 'cat_country' ||
      String(c?.name || '').trim() === 'البلد'
  );
  const countryCatId = countryCat ? countryCat.id : 'cat_1784099815232';

  // Issue #14: Remove "المحافظة" / "المحافظات" category and migrate its placements into Country ("البلد") under country:IQ
  const govCatIds = new Set<string>();
  for (const c of doc.categories) {
    const cname = String(c?.name || '').trim();
    if (
      c?.id === 'cat_df273d801f0d478e' ||
      cname === 'المحافظة' ||
      cname === 'المحافظات' ||
      c?.catalog_source === 'governorates'
    ) {
      govCatIds.add(c.id);
    }
  }

  if (govCatIds.size > 0) {
    doc.categories = doc.categories.filter((c: any) => !govCatIds.has(c.id));
    changed = true;
  }

  // Also remove govCatIds from linked_from_category_ids of any category
  for (const c of doc.categories) {
    if (Array.isArray(c.linked_from_category_ids)) {
      const filtered = c.linked_from_category_ids.filter((id: string) => !govCatIds.has(id));
      if (filtered.length !== c.linked_from_category_ids.length) {
        c.linked_from_category_ids = filtered;
        changed = true;
      }
    }
  }

  // Migrate tag placements that referenced governorate category or underscore institution IDs
  for (const tag of doc.tags) {
    if (!tag || typeof tag !== 'object') continue;
    if (govCatIds.has(tag.category_id)) {
      tag.category_id = countryCatId;
      if (!tag.parent_tag_id) tag.parent_tag_id = 'country:IQ';
      changed = true;
    }
    const normPrimaryParent = normalizeParentTagId(tag.parent_tag_id);
    if (normPrimaryParent !== (tag.parent_tag_id || null)) {
      tag.parent_tag_id = normPrimaryParent;
      changed = true;
    }
    if (Array.isArray(tag.placements)) {
      const nextPlacements: Array<Record<string, any>> = [];
      for (const p of tag.placements) {
        if (!p || typeof p !== 'object') continue;
        let cid = p.category_id;
        let pid = normalizeParentTagId(p.parent_tag_id);
        if (govCatIds.has(cid)) {
          cid = countryCatId;
          pid = pid || 'country:IQ';
          changed = true;
        }
        if (pid !== (p.parent_tag_id || null)) {
          changed = true;
        }
        const exists = nextPlacements.some(
          (ep) => ep.category_id === cid && (ep.parent_tag_id || null) === (pid || null)
        );
        if (!exists) {
          nextPlacements.push({
            ...p,
            category_id: cid,
            parent_tag_id: pid,
          });
        } else {
          changed = true;
        }
      }
      tag.placements = nextPlacements;
    }
  }

  return changed;
}

function loadTagsConfigDoc(): Record<string, any> {
  const doc = dbLoadDoc(COLLECTION_TAGS, DOC_TAGS_CONFIG);
  if (!doc) {
    const initial = {
      tags: [],
      categories: [
        { id: 'cat_1784099815232', icon: '🌍', name: 'البلد', sort_order: 0, translations: { en: 'Country', ku: 'وڵات' }, catalog_source: 'countries' },
        { id: 'cat_inst', icon: '🎓', name: 'المؤسسة التعليمية', sort_order: 1, translations: { en: 'Educational institution', ku: 'دامەزراوەی پەروەردەیی' }, catalog_source: 'institutions', linked_from_category_ids: ['cat_1784099815232'] },
        { id: 'cat_stage', icon: '📚', name: 'المراحل', sort_order: 2, translations: { en: 'Stage', ku: 'قۆناغ' } },
      ],
      deleted_tags: [],
      institution_profiles: {},
      country_profiles: {},
      catalog_visibility: {},
    };
    dbSaveDoc(COLLECTION_TAGS, DOC_TAGS_CONFIG, initial);
    return initial;
  }
  if (!Array.isArray(doc.tags)) {
    doc.tags = doc.tags && typeof doc.tags === 'object' ? Object.values(doc.tags) : [];
  }
  if (!Array.isArray(doc.categories)) {
    doc.categories = [];
  }
  if (!Array.isArray(doc.deleted_tags)) {
    doc.deleted_tags = doc.trash && typeof doc.trash === 'object' ? Object.values(doc.trash) : [];
  }
  if (!doc.institution_profiles || typeof doc.institution_profiles !== 'object') {
    doc.institution_profiles = {};
  }
  if (!doc.country_profiles || typeof doc.country_profiles !== 'object') {
    doc.country_profiles = {};
  }
  if (!doc.catalog_visibility || typeof doc.catalog_visibility !== 'object') {
    doc.catalog_visibility = {};
  }
  if (normalizeTaxonomyDocInPlace(doc)) {
    dbSaveDoc(COLLECTION_TAGS, DOC_TAGS_CONFIG, doc);
  }
  return doc;
}

function saveTagsConfigDoc(doc: Record<string, any>): void {
  dbSaveDoc(COLLECTION_TAGS, DOC_TAGS_CONFIG, doc);
}

export function getCountryCatalog(includeHidden = false): { items: Array<Record<string, any>>; countries: Array<Record<string, any>> } {
  const doc = loadTagsConfigDoc();
  const countryProfiles: Record<string, any> = doc.country_profiles || {};
  const vis: Record<string, any> = doc.catalog_visibility || {};
  const hiddenCountries: string[] = Array.isArray(vis.hidden_countries) ? vis.hidden_countries : [];
  const hiddenIds: string[] = Array.isArray(vis.hidden_ids) ? vis.hidden_ids : [];

  const map = new Map<string, Record<string, any>>();
  for (const def of DEFAULT_COUNTRIES) {
    map.set(def.code, JSON.parse(JSON.stringify(def)));
  }

  for (const [key, c] of Object.entries(countryProfiles)) {
    if (!c || typeof c !== 'object') continue;
    const code = String(c.code || key || '').replace(/^country:/i, '').toUpperCase();
    if (!code) continue;
    const id = `country:${code}`;
    const existing = map.get(code) || {};
    const flag = c.flag || c.flag_emoji || existing.flag || codeToFlagEmoji(code);
    map.set(code, {
      ...existing,
      ...c,
      id,
      code,
      name: c.name || c.name_ar || existing.name || code,
      name_ar: c.name_ar || c.name || existing.name_ar || code,
      name_en: c.name_en || existing.name_en || code,
      name_ku: c.name_ku || existing.name_ku || c.name || existing.name || code,
      flag,
      flag_emoji: flag,
    });
  }

  let items: Array<Record<string, any>> = Array.from(map.values()).map((c) => {
    const isHidden = hiddenCountries.includes(c.code) || hiddenIds.includes(c.id);
    return {
      ...c,
      hidden: isHidden,
    };
  });

  if (!includeHidden) {
    items = items.filter((c) => !c.hidden);
  }

  return { items, countries: items };
}

export function saveCountryProfiles(profiles: any): Record<string, any> {
  const doc = loadTagsConfigDoc();
  if (profiles && typeof profiles === 'object') {
    doc.country_profiles = { ...(doc.country_profiles || {}), ...profiles };
    saveTagsConfigDoc(doc);
  }
  return getCountryCatalog(true);
}

export function getInstitutionProfiles(): { profiles: Array<Record<string, any>>; profilesMap: Record<string, Record<string, any>> } {
  const doc = loadTagsConfigDoc();
  const map: Record<string, Record<string, any>> = doc.institution_profiles || {};
  return { profiles: Object.values(map), profilesMap: map };
}

export function saveInstitutionProfiles(profiles: any): { profiles: Array<Record<string, any>>; institution_profiles: Record<string, Record<string, any>> } {
  const doc = loadTagsConfigDoc();
  const map: Record<string, Record<string, any>> = doc.institution_profiles || {};
  if (Array.isArray(profiles)) {
    for (const p of profiles) {
      if (p && p.id) map[p.id] = p;
    }
  } else if (profiles && typeof profiles === 'object') {
    if (profiles.id) {
      map[profiles.id] = { ...(map[profiles.id] || {}), ...profiles };
    } else if (profiles.profiles) {
      return saveInstitutionProfiles(profiles.profiles);
    } else {
      for (const [k, v] of Object.entries(profiles)) {
        if (v && typeof v === 'object') map[k] = { id: k, ...(v as Record<string, any>) };
      }
    }
  }
  doc.institution_profiles = map;
  saveTagsConfigDoc(doc);
  return { profiles: Object.values(map), institution_profiles: map };
}

export function getInstitutionCatalog(query = '', country = '', limit = 500, includeHidden = false): Record<string, any> {
  const doc = loadTagsConfigDoc();
  const profilesMap: Record<string, Record<string, any>> = doc.institution_profiles || {};
  const vis: Record<string, any> = doc.catalog_visibility || {};
  const hiddenIds: string[] = Array.isArray(vis.hidden_ids) ? vis.hidden_ids : [];

  // Count child tags placed under each institution
  const childCountByInstId = new Map<string, number>();
  for (const tag of doc.tags || []) {
    const placements = Array.isArray(tag?.placements) ? tag.placements : [];
    for (const p of placements) {
      const pid = normalizeParentTagId(p?.parent_tag_id);
      if (pid && pid.startsWith('institution:')) {
        childCountByInstId.set(pid, (childCountByInstId.get(pid) || 0) + 1);
      }
    }
  }

  const mergedMap = new Map<string, Record<string, any>>();
  for (const inst of DEFAULT_IRAQI_INSTITUTIONS) {
    mergedMap.set(inst.id, { ...inst });
  }
  for (const inst of DEFAULT_WORLD_INSTITUTIONS) {
    if (!mergedMap.has(inst.id)) mergedMap.set(inst.id, { ...inst });
  }
  for (const inst of externalWorldUniversities) {
    if (!mergedMap.has(inst.id)) mergedMap.set(inst.id, { ...inst });
  }

  for (const [rawId, prof] of Object.entries(profilesMap)) {
    if (!prof || typeof prof !== 'object') continue;
    const id = normalizeParentTagId(rawId) || rawId;
    const existing = mergedMap.get(id) || {};
    const icon = prof.icon || prof.logo_url || existing.icon || existing.logo_url || (prof.domain ? faviconLogo(prof.domain) : '');
    mergedMap.set(id, {
      ...existing,
      ...prof,
      id,
      icon,
      logo_url: prof.logo_url || icon,
      country_code: prof.country_code || existing.country_code || (id.split(':')[1] || 'IQ'),
    });
  }

  let items: Array<Record<string, any>> = Array.from(mergedMap.values()).map((item) => {
    const childCount = childCountByInstId.get(item.id) || 0;
    return {
      ...item,
      departments_count: item.departments_count ?? childCount,
      hidden: Boolean(item.hidden || hiddenIds.includes(item.id)),
    };
  });

  if (!includeHidden) {
    items = items.filter((i) => !i.hidden);
  }
  if (country) {
    const cUpper = country.trim().replace(/^country:/i, '').toUpperCase();
    items = items.filter((i) => String(i.country_code || 'IQ').toUpperCase() === cUpper);
  }
  if (query) {
    const qNorm = normalizeArabic(query.trim());
    items = items.filter((i) => {
      const hay = normalizeArabic(
        `${i.name || ''} ${i.name_ar || ''} ${i.name_en || ''} ${i.name_ku || ''} ${(i.aliases || []).join(' ')} ${Object.values(i.translations || {}).join(' ')}`
      );
      return hay.includes(qNorm);
    });
  }

  const total = items.length;
  const effectiveLimit = limit > 0 ? limit : 500;
  const sliced = items.slice(0, effectiveLimit);

  return {
    items: sliced,
    total,
    institutions: sliced,
    profiles: profilesMap,
  };
}

export function saveCatalogVisibility(payload: Record<string, any>): Record<string, any> {
  const doc = loadTagsConfigDoc();
  const current = doc.catalog_visibility || {};
  const hiddenIds = new Set<string>(Array.isArray(current.hidden_ids) ? current.hidden_ids : []);
  if (payload.item_id) {
    if (payload.hidden) hiddenIds.add(String(payload.item_id));
    else hiddenIds.delete(String(payload.item_id));
  }
  if (Array.isArray(payload.hidden_ids)) {
    hiddenIds.clear();
    payload.hidden_ids.forEach((id: string) => hiddenIds.add(String(id)));
  }
  doc.catalog_visibility = {
    ...current,
    ...payload,
    hidden_ids: Array.from(hiddenIds),
    updated_at: nowBaghdadStr(),
  };
  saveTagsConfigDoc(doc);
  return { success: true, ...doc.catalog_visibility };
}

export function consolidateDuplicateInstitutions(): Record<string, any> {
  const doc = loadTagsConfigDoc();
  const changed = normalizeTaxonomyDocInPlace(doc);
  if (changed) saveTagsConfigDoc(doc);
  return { success: true, merged_categories: changed ? 1 : 0, moved_placements: changed ? 1 : 0 };
}

// ==================== TAGS MANAGER (reads/writes tags/config) ====================

export function getTagCategories(): Array<Record<string, any>> {
  const doc = loadTagsConfigDoc();
  return [...(doc.categories || [])].sort(
    (a, b) => (a.sort_order ?? a.order ?? 0) - (b.sort_order ?? b.order ?? 0)
  );
}

export function createTagCategory(name: string, icon = '', color = '#D4A574', extra?: Record<string, any>): Record<string, any> {
  const doc = loadTagsConfigDoc();
  const id = (extra?.id as string) || `cat_${genId(16)}`;
  const order = doc.categories.length;
  const cat: Record<string, any> = {
    id,
    name: String(name || '').trim(),
    icon: icon || '',
    color: color || '#D4A574',
    sort_order: order,
    created_at: new Date().toISOString(),
    translations: extra?.translations || { en: '', ku: '' },
    linked_from_category_ids: Array.isArray(extra?.linked_from_category_ids) ? extra.linked_from_category_ids : [],
    catalog_source: extra?.catalog_source || '',
    ...(extra || {}),
  };
  doc.categories.push(cat);
  saveTagsConfigDoc(doc);
  return cat;
}

export function updateTagCategory(catId: string, updates: Record<string, any>): Record<string, any> | null {
  const doc = loadTagsConfigDoc();
  const idx = doc.categories.findIndex((c: any) => c.id === catId);
  if (idx === -1) return null;
  doc.categories[idx] = { ...doc.categories[idx], ...updates, id: catId };
  saveTagsConfigDoc(doc);
  return doc.categories[idx];
}

export function deleteTagCategory(catId: string): boolean {
  const doc = loadTagsConfigDoc();
  const before = doc.categories.length;
  doc.categories = doc.categories.filter((c: any) => c.id !== catId);
  if (doc.categories.length === before) return false;
  for (const tag of doc.tags) {
    if (tag.category_id === catId) tag.category_id = null;
    if (Array.isArray(tag.placements)) {
      tag.placements = tag.placements.filter((p: any) => p.category_id !== catId);
    }
  }
  saveTagsConfigDoc(doc);
  return true;
}

export function reorderTagCategories(orderedIds: string[]): boolean {
  const doc = loadTagsConfigDoc();
  orderedIds.forEach((id, idx) => {
    const cat = doc.categories.find((c: any) => c.id === id);
    if (cat) {
      cat.sort_order = idx;
    }
  });
  doc.categories.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  saveTagsConfigDoc(doc);
  return true;
}

export function getAllTags(): Array<Record<string, any>> {
  const doc = loadTagsConfigDoc();
  return [...(doc.tags || [])];
}

export function getTag(tagId: string): Record<string, any> | null {
  const doc = loadTagsConfigDoc();
  return (doc.tags || []).find((t: any) => t.id === tagId) || null;
}

export function getTagByName(name: string): Record<string, any> | null {
  const clean = String(name || '').trim().toLowerCase();
  if (!clean) return null;
  const doc = loadTagsConfigDoc();
  return (doc.tags || []).find((t: any) => String(t.name || '').trim().toLowerCase() === clean) || null;
}

export function getTagsGrouped(): Record<string, any> {
  const doc = loadTagsConfigDoc();
  const categories = [...(doc.categories || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const tagsList = [...(doc.tags || [])];
  return {
    categories,
    tags: tagsList,
    deleted_tags: doc.deleted_tags || [],
    institution_profiles: doc.institution_profiles || {},
    country_profiles: doc.country_profiles || {},
    catalog_visibility: doc.catalog_visibility || {},
    palette: TAG_PALETTE,
  };
}

export function createTag(
  name: string,
  category = '',
  color = '#D4A574',
  description = '',
  placements: Array<Record<string, any>> = [],
  createdBy = '',
  icon = '',
  parentTagIds?: string[],
  extraFields?: Record<string, any>
): Record<string, any> {
  const cleanName = String(name || '').trim();
  const doc = loadTagsConfigDoc();
  const existing = (doc.tags || []).find(
    (t: any) => String(t.name || '').trim().toLowerCase() === cleanName.toLowerCase()
  );

  const normPlacements = Array.isArray(placements) && placements.length > 0
    ? placements.map((p, idx) => ({
        category_id: p.category_id || category || null,
        parent_tag_id: normalizeParentTagId(p.parent_tag_id),
        sort_order: p.sort_order ?? idx,
      }))
    : category && !extraFields?.standalone
    ? [{ category_id: category, parent_tag_id: normalizeParentTagId((parentTagIds && parentTagIds[0]) || null) }]
    : [];

  if (existing) {
    if (normPlacements.length > 0) {
      if (!Array.isArray(existing.placements)) existing.placements = [];
      for (const np of normPlacements) {
        const dup = existing.placements.some(
          (cp: any) => cp.category_id === np.category_id && (cp.parent_tag_id || null) === (np.parent_tag_id || null)
        );
        if (!dup) existing.placements.push(np);
      }
      saveTagsConfigDoc(doc);
    }
    return existing;
  }

  const id = `tag_${genId(16)}`;
  const firstCat = normPlacements[0]?.category_id || category || null;
  const tag: Record<string, any> = {
    id,
    name: cleanName,
    icon: icon || '',
    color: color || '#D4A574',
    description: description || '',
    category_id: firstCat,
    parent_tag_id: normPlacements[0]?.parent_tag_id || null,
    placements: normPlacements,
    standalone: Boolean(extraFields?.standalone ?? (normPlacements.length === 0)),
    translations: extraFields?.translations || { en: '', ku: '' },
    created_by: String(createdBy || ''),
    created_at: new Date().toISOString(),
    ...(extraFields || {}),
  };
  doc.tags.push(tag);
  saveTagsConfigDoc(doc);
  return tag;
}

export function updateTag(tagId: string, updates: Record<string, any>): Record<string, any> | null {
  const doc = loadTagsConfigDoc();
  const idx = (doc.tags || []).findIndex((t: any) => t.id === tagId);
  if (idx === -1) return null;
  if (Array.isArray(updates.placements)) {
    updates.placements = updates.placements.map((p: any, i: number) => ({
      ...p,
      category_id: p.category_id || null,
      parent_tag_id: normalizeParentTagId(p.parent_tag_id),
      sort_order: p.sort_order ?? i,
    }));
  }
  doc.tags[idx] = {
    ...doc.tags[idx],
    ...updates,
    id: tagId,
    updated_at: new Date().toISOString(),
  };
  saveTagsConfigDoc(doc);
  return doc.tags[idx];
}

export function deleteTag(tagId: string, deletedBy = ''): Record<string, any> | null {
  const doc = loadTagsConfigDoc();
  const idx = (doc.tags || []).findIndex((t: any) => t.id === tagId);
  if (idx === -1) return null;
  const [removed] = doc.tags.splice(idx, 1);
  if (!Array.isArray(doc.deleted_tags)) doc.deleted_tags = [];
  doc.deleted_tags.push({
    ...removed,
    deleted_at: new Date().toISOString(),
    deleted_by: String(deletedBy || ''),
  });
  saveTagsConfigDoc(doc);
  return removed;
}

export function getDeletedTags(): Array<Record<string, any>> {
  const doc = loadTagsConfigDoc();
  return Array.isArray(doc.deleted_tags) ? doc.deleted_tags : [];
}

export function restoreTag(tagId: string): Record<string, any> | null {
  const doc = loadTagsConfigDoc();
  if (!Array.isArray(doc.deleted_tags)) return null;
  const idx = doc.deleted_tags.findIndex((t: any) => t.id === tagId);
  if (idx === -1) return null;
  const [restored] = doc.deleted_tags.splice(idx, 1);
  const { deleted_at, deleted_by, ...clean } = restored;
  doc.tags.push(clean);
  saveTagsConfigDoc(doc);
  return clean;
}

export function permanentDeleteTag(tagId: string): boolean {
  const doc = loadTagsConfigDoc();
  const beforeTrash = (doc.deleted_tags || []).length;
  const beforeTags = (doc.tags || []).length;
  doc.deleted_tags = (doc.deleted_tags || []).filter((t: any) => t.id !== tagId);
  doc.tags = (doc.tags || []).filter((t: any) => t.id !== tagId);
  const changed = doc.deleted_tags.length < beforeTrash || doc.tags.length < beforeTags;
  if (changed) saveTagsConfigDoc(doc);
  return changed;
}

export function addTagPlacement(
  tagId: string,
  categoryId: string,
  parentTagId = '',
  _targetName = '',
  _includeSubfolders = false
): Record<string, any> | null {
  const doc = loadTagsConfigDoc();
  const tag = (doc.tags || []).find((t: any) => t.id === tagId);
  if (!tag) return null;
  if (!Array.isArray(tag.placements)) tag.placements = [];
  const pId = normalizeParentTagId(parentTagId);
  const exists = tag.placements.some(
    (p: any) => p.category_id === categoryId && (p.parent_tag_id || null) === pId
  );
  if (!exists) {
    tag.placements.push({
      category_id: categoryId,
      parent_tag_id: pId,
    });
    saveTagsConfigDoc(doc);
  }
  return tag;
}

export function removeTagPlacement(tagId: string, categoryId: string, parentTagId = ''): Record<string, any> | null {
  const doc = loadTagsConfigDoc();
  const tag = (doc.tags || []).find((t: any) => t.id === tagId);
  if (!tag) return null;
  const pId = normalizeParentTagId(parentTagId);
  if (Array.isArray(tag.placements)) {
    tag.placements = tag.placements.filter(
      (p: any) => !(p.category_id === categoryId && (p.parent_tag_id || null) === pId)
    );
    saveTagsConfigDoc(doc);
  }
  return tag;
}

export function bulkModifyPlacements(payload: Record<string, any>): Record<string, any> {
  const doc = loadTagsConfigDoc();
  const action = payload.action || 'link';
  const tagIds: string[] = Array.isArray(payload.tag_ids) ? payload.tag_ids : [];
  const destinations: Array<Record<string, any>> = Array.isArray(payload.destinations)
    ? payload.destinations
    : Array.isArray(payload.placements)
    ? payload.placements
    : [];
  const source = payload.source || null;

  let linked = 0;
  let unlinked = 0;
  let moved = 0;

  for (const tid of tagIds) {
    const tag = (doc.tags || []).find((t: any) => t.id === tid);
    if (!tag) continue;
    if (!Array.isArray(tag.placements)) tag.placements = [];

    const srcParent = source ? normalizeParentTagId(source.parent_tag_id) : null;

    if (action === 'unlink' && source) {
      const before = tag.placements.length;
      tag.placements = tag.placements.filter(
        (p: any) =>
          !(p.category_id === source.category_id && (p.parent_tag_id || null) === srcParent)
      );
      if (tag.placements.length < before) unlinked++;
    } else if (action === 'move' && source) {
      tag.placements = tag.placements.filter(
        (p: any) =>
          !(p.category_id === source.category_id && (p.parent_tag_id || null) === srcParent)
      );
      for (const dest of destinations) {
        const catId = dest.category_id;
        const parentId = normalizeParentTagId(dest.parent_tag_id);
        const exists = tag.placements.some(
          (p: any) => p.category_id === catId && (p.parent_tag_id || null) === parentId
        );
        if (!exists) {
          tag.placements.push({ category_id: catId, parent_tag_id: parentId });
          moved++;
        }
      }
    } else {
      for (const dest of destinations) {
        const catId = dest.category_id;
        const parentId = normalizeParentTagId(dest.parent_tag_id);
        const exists = tag.placements.some(
          (p: any) => p.category_id === catId && (p.parent_tag_id || null) === parentId
        );
        if (!exists) {
          tag.placements.push({ category_id: catId, parent_tag_id: parentId });
          linked++;
        }
      }
    }
  }
  saveTagsConfigDoc(doc);
  return { success: true, linked, unlinked, moved, count: linked + moved };
}

export function reorderTags(orderedIds: string[], _category?: string): boolean {
  const doc = loadTagsConfigDoc();
  orderedIds.forEach((id, idx) => {
    const tag = (doc.tags || []).find((t: any) => t.id === id);
    if (tag) {
      tag.sort_order = idx;
    }
  });
  saveTagsConfigDoc(doc);
  return true;
}

export function getAllTagNames(): string[] {
  return getAllTags().map((t) => t.name).filter(Boolean);
}

export function syncItemTags(
  _itemType: string,
  _itemId: string,
  _itemName: string,
  tagNames: string[],
  createdBy = ''
): void {
  const cleanNames = Array.from(new Set((tagNames || []).map((n) => String(n || '').trim()).filter(Boolean)));
  for (const name of cleanNames) {
    const tag = getTagByName(name);
    if (!tag) {
      createTag(name, '', '#D4A574', '', [], createdBy, '', [], { standalone: true });
    }
  }
}

export function removeItemFromAllTags(_itemType: string, _itemId: string): void {
  // No-op
}
