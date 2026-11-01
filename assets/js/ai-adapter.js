/* GMW AI adapter — فعلاً فقط موتور قواعد محلی (بدون API و بدون هزینه).
   برای اتصال آینده به هوش مصنوعی: provider جدید با همان رابط diagnose(text, ctx) → Promise<result> اضافه شود
   و از طریق Backend (نه مستقیم از مرورگر) فراخوانی شود تا کلید API فاش نشود. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GMWAI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DISCLAIMER = 'این خروجی صرفاً راهنمای اولیه بر پایهٔ علائم گفته‌شده است و تشخیص قطعی نیست. تشخیص نهایی فقط با معاینهٔ حضوری خودرو توسط تعمیرکار متخصص ممکن است.';
  var URG = { low: 0, medium: 1, high: 2, critical: 3 };
  var URG_LABEL = { low: 'کم — قابل پیگیری در سرویس بعدی', medium: 'متوسط — در چند روز آینده بررسی شود', high: 'بالا — هرچه زودتر به تعمیرکار مراجعه کنید', critical: 'فوری — از رانندگی خودداری و با امداد/تعمیرکار تماس بگیرید' };

  function norm(s) {
    return String(s || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').replace(/[ًٌٍَُِّْ]/g, '').replace(/\s+/g, ' ').toLowerCase();
  }

  var RULES = [
    { id: 'brake-noise', title: 'صدا یا لرزش در ترمز', kw: ['صدای ترمز', 'جیر جیر', 'جیغ', 'ساییدگی', 'لنت', 'ترمز لرز', 'پدال ترمز لرز', 'ترمز صدا'], urgency: 'high',
      causes: ['ساییدگی لنت‌ها', 'کج‌شدن یا خط‌افتادن دیسک', 'گیرکردن کاسه‌نمد/کالیپر'], parts: ['لنت جلو/عقب', 'دیسک ترمز', 'کالیپر'],
      questions: ['صدا هنگام ترمز است یا همیشگی؟', 'آخرین بار کِی لنت‌ها عوض شد؟', 'پدال ترمز نرم‌تر از قبل شده؟'] },
    { id: 'brake-soft', title: 'نرم‌شدن یا پایین‌رفتن پدال ترمز', kw: ['پدال ترمز نرم', 'پدال ترمز پایین', 'ترمز نمی‌گیرد', 'ترمز نمیگیره', 'ترمز نمی گیرد', 'ترمز ضعیف', 'ترمز بریده'], urgency: 'critical',
      causes: ['نشتی روغن ترمز', 'هوا در مدار ترمز', 'خرابی مغز/کمک ترمز'], parts: ['شیلنگ‌ها و لوله‌های ترمز', 'پمپ ترمز', 'روغن ترمز'],
      questions: ['سطح روغن ترمز پایین است؟', 'چراغ ترمز روی صفحه روشن شده؟'] },
    { id: 'steering-heavy', title: 'سنگینی یا لقی فرمان', kw: ['فرمان سنگین', 'فرمان لق', 'لقی فرمان', 'فرمان صدا', 'فرمان خالی', 'فرمان سفت'], urgency: 'high',
      causes: ['خرابی یا لقی سیبک/سرمیل', 'مشکل جعبه فرمان یا پمپ هیدرولیک', 'کمبود روغن هیدرولیک'], parts: ['سیبک فرمان', 'سرمیل فرمان', 'جعبه فرمان', 'قرقری فرمان'],
      questions: ['سنگینی فقط در سرعت کم است؟', 'صدا هنگام پیچاندن فرمان در جا هست؟', 'نشتی روغن زیر خودرو دیده‌اید؟'] },
    { id: 'suspension-knock', title: 'صدای تق‌تق از جلوبندی یا عقب‌بندی', kw: ['تق تق', 'تقتق', 'دست انداز', 'دست‌انداز', 'صدای جلوبندی', 'صدا از جلو', 'صدای عقب', 'کمک فنر', 'کمک‌فنر', 'ضربه'], urgency: 'medium',
      causes: ['خرابی کمک‌فنر یا توپی سرکمک', 'ساییدگی بوش‌های طبق/موج‌گیر', 'شل‌شدن اتصالات میل موج‌گیر'], parts: ['کمک‌فنر', 'توپی سرکمک', 'بوش‌های طبق و موج‌گیر', 'میل موج‌گیر و اتصالات'],
      questions: ['صدا در دست‌انداز بیشتر است یا در پیچ؟', 'از جلو است یا عقب؟', 'نشتی روغن از بدنهٔ کمک‌فنر هست؟'] },
    { id: 'vibration', title: 'لرزش فرمان یا بدنه در سرعت', kw: ['لرزش', 'می‌لرزد', 'میلرزه', 'لرزه', 'ویبره'], urgency: 'medium',
      causes: ['بالانس یا کج‌شدن رینگ/لاستیک', 'خرابی بلبرینگ چرخ', 'لقی اتصالات فرمان'], parts: ['لاستیک و رینگ', 'بلبرینگ چرخ', 'سیبک و سرمیل'],
      questions: ['لرزش در چه سرعتی شروع می‌شود؟', 'فقط فرمان می‌لرزد یا کل بدنه؟', 'آخرین بالانس و دنده‌بندی کِی بود؟'] },
    { id: 'wheel-bearing', title: 'صدای وزوز یا غرش از چرخ', kw: ['وزوز', 'غرش', 'بلبرینگ', 'صدای چرخ', 'هوم هوم', 'صدای ویز'], urgency: 'high',
      causes: ['خرابی بلبرینگ چرخ'], parts: ['بلبرینگ چرخ جلو/عقب', 'توپی'],
      questions: ['صدا با افزایش سرعت بیشتر می‌شود؟', 'در پیچ به چپ یا راست تغییر می‌کند؟'] },
    { id: 'pull-side', title: 'کشیدن خودرو به یک سمت', kw: ['به یک سمت', 'می‌کشد', 'میکشه', 'کشیدگی', 'کج می‌رود', 'کج میره'], urgency: 'medium',
      causes: ['تنظیم نبودن زاویهٔ چرخ‌ها (تنظیم فرمان)', 'فشار باد نامساوی', 'ترمز درگیر یا خرابی طبق/بوش'], parts: ['تنظیم زوایای چرخ', 'لاستیک‌ها', 'طبق و بوش‌ها', 'کالیپر ترمز'],
      questions: ['هنگام ترمز هم می‌کشد؟', 'اخیراً با دست‌انداز یا جدول برخورد داشتید؟'] },
    { id: 'overheat', title: 'داغ‌شدن موتور', kw: ['داغ', 'جوش', 'عقربه دما', 'دمای موتور', 'آب رادیاتور', 'بخار'], urgency: 'critical',
      causes: ['کمبود مایع خنک‌کننده یا نشتی', 'خرابی ترموستات/فن/واترپمپ', 'گرفتگی رادیاتور'], parts: ['رادیاتور', 'ترموستات', 'واترپمپ', 'فن'],
      questions: ['سطح مایع خنک‌کننده چقدر است؟', 'فن رادیاتور روشن می‌شود؟'] },
    { id: 'oil-light', title: 'چراغ روغن/باتری یا هشدار روی صفحه', kw: ['چراغ روغن', 'چراغ باتری', 'چراغ موتور', 'چک', 'هشدار'], urgency: 'high',
      causes: ['افت فشار یا کمبود روغن موتور', 'مشکل دینام/باتری', 'خطای حسگرها'], parts: ['روغن و فیلتر روغن', 'دینام/باتری', 'حسگرها (با دستگاه عیب‌یاب)'],
      questions: ['کدام چراغ روشن است؟ دائم یا چشمک‌زن؟', 'سطح روغن موتور را کنترل کرده‌اید؟'] },
    { id: 'start', title: 'استارت نخوردن', kw: ['استارت', 'روشن نمی', 'روشن نمیشه', 'روشن نمی‌شود', 'استارت نمی'], urgency: 'medium',
      causes: ['ضعف یا سولفاته‌شدن باتری', 'خرابی استارت', 'مشکل سوخت‌رسانی یا جرقه'], parts: ['باتری', 'استارت', 'شمع/کوئل', 'پمپ بنزین'],
      questions: ['هنگام استارت صدای تیک‌تیک می‌آید؟', 'چراغ‌های داشبورد روشن می‌شوند؟'] },
    { id: 'smoke', title: 'دود یا بوی غیرعادی', kw: ['دود', 'بوی سوختگی', 'بوی بنزین', 'بوی سوخت'], urgency: 'critical',
      causes: ['نشتی روغن/سوخت روی اگزوز', 'اتصالی برق', 'مشکل ترمز یا کلاچ'], parts: ['بررسی نشتی‌ها', 'سیم‌کشی', 'ترمز/کلاچ'],
      questions: ['رنگ دود چیست (سفید، آبی، سیاه)؟', 'بو از داخل کابین است یا موتور؟'] }
  ];

  var localRules = {
    id: 'local-rules', enabled: true,
    diagnose: function (text, ctx) {
      var t = norm(text), scored = [];
      RULES.forEach(function (r) {
        var hits = r.kw.filter(function (k) { return t.indexOf(norm(k)) >= 0; }).length;
        if (hits) scored.push({ rule: r, hits: hits });
      });
      scored.sort(function (a, b) { return b.hits - a.hits || URG[b.rule.urgency] - URG[a.rule.urgency]; });
      var top = scored.slice(0, 3).map(function (s) { return s.rule; });
      if (!top.length) {
        return Promise.resolve({ matched: false, provider: 'local-rules', disclaimer: DISCLAIMER, urgency: 'low', urgencyLabel: URG_LABEL.low,
          causes: [], parts: [], questions: ['علامت را دقیق‌تر شرح دهید: صدا، لرزش، بو یا چراغ هشدار؟', 'مشکل در چه شرایطی رخ می‌دهد (سرعت، ترمز، پیچ، سرد/گرم)؟', 'از چه زمانی شروع شده است؟'],
          visitAdvice: 'اگر علامت ادامه دارد، برای معاینه به تعمیرکار مراجعه کنید.', topics: [] });
      }
      var urgency = top.reduce(function (m, r) { return URG[r.urgency] > URG[m] ? r.urgency : m; }, 'low');
      function uniq(arr) { return arr.filter(function (x, i) { return arr.indexOf(x) === i; }); }
      var res = {
        matched: true, provider: 'local-rules', disclaimer: DISCLAIMER, urgency: urgency, urgencyLabel: URG_LABEL[urgency],
        topics: top.map(function (r) { return r.title; }),
        causes: uniq([].concat.apply([], top.map(function (r) { return r.causes; }))),
        parts: uniq([].concat.apply([], top.map(function (r) { return r.parts; }))),
        questions: uniq([].concat.apply([], top.map(function (r) { return r.questions; }))).slice(0, 6),
        visitAdvice: urgency === 'critical' ? 'ادامهٔ رانندگی خطرناک است؛ خودرو را متوقف کنید و با امداد یا تعمیرکار تماس بگیرید.'
          : urgency === 'high' ? 'توصیه می‌شود در اولین فرصت (ترجیحاً همین چند روز) به تعمیرکار مراجعه کنید.'
          : 'در اولین سرویس یا فرصت مناسب خودرو را معاینه کنید.'
      };
      return Promise.resolve(res);
    }
  };

  /* جایگاه اتصال آینده — فعلاً غیرفعال تا هیچ هزینه‌ای ایجاد نشود */
  var remote = { id: 'remote-llm', enabled: false, diagnose: function () { return Promise.reject(new Error('اتصال هوش مصنوعی هنوز فعال نشده است')); } };

  var providers = { 'local-rules': localRules, 'remote-llm': remote };
  var active = 'local-rules';

  return {
    DISCLAIMER: DISCLAIMER, providers: providers,
    setProvider: function (id) { if (providers[id] && providers[id].enabled) active = id; return active; },
    diagnose: function (text, ctx) { return providers[active].diagnose(text, ctx || {}); }
  };
});
