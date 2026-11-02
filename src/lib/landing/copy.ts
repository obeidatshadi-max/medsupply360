/**
 * Copy for the public front page, shared by the app (src/components/landing) and the promotional demo
 * (src/demo/landing-html.ts), so the two can never say different things.
 *
 * Rules for this copy: only describe screens that exist in the app today; every figure on the page is made up and
 * says so; plain English for readers who are not native speakers. The Arabic is written to read naturally rather
 * than word for word and has not had a native review.
 */
export type LandingCopy = {
  meta: { title: string; description: string };
  brand: string;
  strap: string;
  skip: string;
  nav: { label: string; how: string; pillars: string; preview: string; signIn: string; demo: string; language: string; languageHref: string };
  hero: { title: string; subtitle: string; body: string; primary: string; secondary: string; points: string[] };
  preview: {
    title: string;
    sample: string;
    stats: { label: string; value: string; note: string }[];
    priorityTitle: string;
    priorities: { title: string; value: string; tone: "bad" | "good" }[];
    linesTitle: string;
    lines: { name: string; share: number }[];
  };
  pillars: { title: string; items: { title: string; body: string }[] };
  journey: { title: string; subtitle: string; steps: { title: string; body: string }[] };
  how: { title: string; subtitle: string; items: { title: string; body: string }[] };
  close: { title: string; body: string; cta: string };
  footer: { line: string; audience: string };
};

export const landingEn: LandingCopy = {
  meta: {
    title: "MedSupply360: Every tender. Every device. Every dinar.",
    description:
      "One control tower for medical equipment, devices and consumables distributors: sales, tenders, installed base, stock and cash in one owner view.",
  },
  brand: "MedSupply360",
  strap: "Business control tower",
  skip: "Skip to content",
  nav: { label: "Main", how: "What is inside", pillars: "What you gain", preview: "A first look", signIn: "Sign in", demo: "Try the demo", language: "العربية", languageHref: "/ar" },
  hero: {
    title: "Every tender. Every device. Every dinar.",
    subtitle: "One control tower for medical equipment, devices and consumables distributors.",
    body: "MedSupply360 brings your ERP exports, tender records and field data into one owner view: what sold, what is owed, what may expire, and what to do first.",
    primary: "Sign in to your workspace",
    secondary: "See what is inside",
    points: ["Every figure names its period", "Shows how fresh your data is", "Separate access for owner, tender and finance"],
  },
  preview: {
    title: "A first look",
    sample: "Sample data. All figures are made up.",
    stats: [
      { label: "Sales, Jan-Sep 2026", value: "JOD 4.54M", note: "Net revenue by business line" },
      { label: "Gross profit", value: "JOD 1.51M", note: "33.3% margin, before operating costs" },
      { label: "Cash received, Jan-Sep 2026", value: "JOD 3.86M", note: "Receipts may relate to earlier sales" },
      { label: "Overdue balances", value: "JOD 117.1K", note: "Shown apart from what is not yet due" },
    ],
    priorityTitle: "Your priority list",
    priorities: [
      { title: "Stock may expire", value: "JOD 21,760", tone: "bad" },
      { title: "Overdue customer balances", value: "JOD 117.1K", tone: "bad" },
      { title: "Management actions with an owner", value: "3 open", tone: "good" },
    ],
    linesTitle: "Gross margin by business line",
    lines: [
      { name: "Equipment", share: 25 },
      { name: "Devices", share: 32 },
      { name: "Consumables", share: 39 },
    ],
  },
  pillars: {
    title: "Five things the owner can see in one place",
    items: [
      { title: "Sales and margin", body: "Equipment, devices and consumables side by side, with gross profit by line. Every figure says which period it covers." },
      { title: "Tenders, start to cash", body: "Ten stages from announcement to payment, the guarantees held, the invoices raised and what the authorities still owe. Days in stage, not a guess at what is stuck." },
      { title: "Installed base and service", body: "Follow each installed machine through usage, consumables, service and replacement, so repeat sales and service income are not missed." },
      { title: "Stock and cash risk", body: "Stock that may expire before it sells, reorder cover, and overdue balances with their age." },
      { title: "Actions that stick", body: "Findings become management actions with a named owner and a date. Targets, accounts and tenders are assigned to the sales team." },
    ],
  },
  journey: {
    title: "From ERP export to the next step",
    subtitle: "Checking comes before reading. You see what is missing before you rely on a number.",
    steps: [
      { title: "Collect", body: "Upload ERP exports as Excel or CSV. Tenders are recorded by the tender team. Installed equipment and targets are entered by hand." },
      { title: "Check", body: "A preview shows what will be loaded. Unrecognised columns can be matched by you. A banner says how recent the data is." },
      { title: "See", body: "The owner overview shows sales, margin, cash, stock and tenders, each with its period." },
      { title: "Decide", body: "A short priority list ranks what needs attention first, with estimates labelled as estimates." },
      { title: "Act", body: "Each action gets an owner and a due date." },
      { title: "Follow up", body: "Update history records who entered or changed data, and when." },
    ],
  },
  how: {
    title: "What is inside today",
    subtitle: "These are working screens of the application, not plans.",
    items: [
      { title: "Owner overview", body: "Sales, margin, cash, stock and follow-up on one page." },
      { title: "Tender tracker", body: "Ten stages, guarantees, invoices and payments, with the owner's overview first." },
      { title: "Installed base", body: "Every installation with its usage, consumables and service cover." },
      { title: "Opportunity radar", body: "Customers whose reorder is overdue, based on their own purchase rhythm. These are estimates, not forecasts." },
      { title: "Smart upload", body: "Excel or CSV with a preview before anything is saved, and a column picker for unfamiliar headings." },
      { title: "Sales force", body: "People, their supplier companies, targets, accounts and tenders, with visits logged." },
      { title: "Roles and access", body: "Owner, tender and finance users each open only what they need." },
      { title: "Basic or Advanced", body: "Start with the short daily view and switch to the full one when you want more." },
    ],
  },
  close: {
    title: "See your whole business in one view.",
    body: "Sign in to continue. To look around first, try the demo on made-up data.",
    cta: "Sign in to your workspace",
  },
  footer: { line: "MedSupply360 · Business control tower", audience: "For medical equipment, devices and consumables distributors." },
};

export const landingAr: LandingCopy = {
  meta: {
    title: "MedSupply360: كل مناقصة. كل جهاز. كل دينار.",
    description: "برج مراقبة واحد لموزّعي المعدات والأجهزة والمستهلكات الطبية: المبيعات والمناقصات والأجهزة المركّبة والمخزون والنقد في عرض واحد للمالك.",
  },
  brand: "MedSupply360",
  strap: "برج مراقبة الأعمال",
  skip: "انتقل إلى المحتوى",
  nav: { label: "القائمة الرئيسية", how: "ما بداخله", pillars: "ما الذي تكسبه", preview: "نظرة أولى", signIn: "تسجيل الدخول", demo: "جرّب العرض", language: "English", languageHref: "/" },
  hero: {
    title: "كل مناقصة. كل جهاز. كل دينار.",
    subtitle: "برج مراقبة واحد لموزّعي المعدات والأجهزة والمستهلكات الطبية.",
    body: "يجمع MedSupply360 ملفات نظام المحاسبة وسجلات المناقصات والبيانات الميدانية في عرض واحد للمالك: ما الذي بِيع، وما المستحق على العملاء، وما الذي قد تنتهي صلاحيته، وبماذا تبدأ.",
    primary: "سجّل الدخول إلى مساحة عملك",
    secondary: "شاهد ما بداخله",
    points: ["كل رقم يبيّن فترته", "يُظهر مدى حداثة بياناتك", "صلاحيات منفصلة للمالك والمناقصات والمالية"],
  },
  preview: {
    title: "نظرة أولى",
    sample: "بيانات نموذجية. كل الأرقام من وحي الخيال.",
    stats: [
      { label: "المبيعات، كانون الثاني–أيلول 2026", value: "JOD 4.54M", note: "صافي الإيراد حسب خط الأعمال" },
      { label: "إجمالي الربح", value: "JOD 1.51M", note: "هامش 33.3% قبل التكاليف التشغيلية" },
      { label: "النقد المقبوض، كانون الثاني–أيلول 2026", value: "JOD 3.86M", note: "قد تعود المقبوضات إلى مبيعات سابقة" },
      { label: "الأرصدة المتأخرة", value: "JOD 117.1K", note: "تُعرض منفصلة عمّا لم يحِن موعده" },
    ],
    priorityTitle: "قائمة أولوياتك",
    priorities: [
      { title: "مخزون قد تنتهي صلاحيته", value: "JOD 21,760", tone: "bad" },
      { title: "أرصدة عملاء متأخرة", value: "JOD 117.1K", tone: "bad" },
      { title: "إجراءات إدارية لها مسؤول", value: "3 مفتوحة", tone: "good" },
    ],
    linesTitle: "هامش الربح الإجمالي حسب خط الأعمال",
    lines: [
      { name: "المعدات", share: 25 },
      { name: "الأجهزة", share: 32 },
      { name: "المستهلكات", share: 39 },
    ],
  },
  pillars: {
    title: "خمسة أمور يراها المالك في مكان واحد",
    items: [
      { title: "المبيعات والهامش", body: "المعدات والأجهزة والمستهلكات جنباً إلى جنب، مع إجمالي الربح لكل خط. وكل رقم يبيّن الفترة التي يغطيها." },
      { title: "المناقصات من البداية حتى التحصيل", body: "عشر مراحل من الإعلان حتى الدفع، والكفالات المحتجزة، والفواتير الصادرة، وما لا تزال الجهات مدينةً به. أيام في كل مرحلة، لا تخميناً لما تعثّر." },
      { title: "الأجهزة المركّبة والصيانة", body: "تابع كل جهاز مركّب عبر الاستخدام والمستهلكات والصيانة والاستبدال، فلا تفوتك مبيعات متكررة ولا دخل صيانة." },
      { title: "مخاطر المخزون والنقد", body: "مخزون قد تنتهي صلاحيته قبل أن يُباع، وتغطية إعادة الطلب، والأرصدة المتأخرة مع عمرها." },
      { title: "إجراءات تُنفَّذ", body: "تتحول الملاحظات إلى إجراءات إدارية لها مسؤول وموعد. وتُسنَد الأهداف والحسابات والمناقصات إلى فريق المبيعات." },
    ],
  },
  journey: {
    title: "من ملف نظام المحاسبة إلى الخطوة التالية",
    subtitle: "الفحص يسبق القراءة. ترى ما ينقص قبل أن تعتمد على أي رقم.",
    steps: [
      { title: "اجمع", body: "ارفع ملفات النظام بصيغة Excel أو CSV. وفريق المناقصات يسجّل المناقصات. أما الأجهزة المركّبة والأهداف فتُدخَل يدوياً." },
      { title: "افحص", body: "معاينة تُظهر ما سيُحمَّل. ويمكنك مطابقة الأعمدة غير المعروفة بنفسك. ولافتة تبيّن مدى حداثة البيانات." },
      { title: "شاهد", body: "تعرض نظرة المالك المبيعات والهامش والنقد والمخزون والمناقصات، ولكل منها فترته." },
      { title: "قرّر", body: "قائمة أولويات قصيرة ترتّب ما يحتاج انتباهاً أولاً، والتقديرات موسومة بأنها تقديرات." },
      { title: "نفّذ", body: "لكل إجراء مسؤول وتاريخ استحقاق." },
      { title: "تابع", body: "يسجّل سجل التحديثات من أدخل البيانات أو غيّرها، ومتى." },
    ],
  },
  how: {
    title: "ما بداخله اليوم",
    subtitle: "هذه شاشات عاملة في التطبيق، وليست خططاً.",
    items: [
      { title: "نظرة المالك", body: "المبيعات والهامش والنقد والمخزون والمتابعة في صفحة واحدة." },
      { title: "متتبّع المناقصات", body: "عشر مراحل، وكفالات وفواتير ودفعات، ونظرة المالك أولاً." },
      { title: "الأجهزة المركّبة", body: "كل تركيب مع استخدامه ومستهلكاته وتغطية صيانته." },
      { title: "رادار الفرص", body: "عملاء تأخر موعد إعادة طلبهم، بحسب إيقاع شرائهم هم. وهي تقديرات وليست تنبؤات." },
      { title: "الرفع الذكي", body: "ملف Excel أو CSV مع معاينة قبل حفظ أي شيء، ومُنتقي للأعمدة عند العناوين غير المألوفة." },
      { title: "فريق المبيعات", body: "الأفراد وشركاتهم الموردة وأهدافهم وحساباتهم ومناقصاتهم، مع تسجيل الزيارات." },
      { title: "الأدوار والصلاحيات", body: "مستخدمو المالك والمناقصات والمالية يفتح كلٌّ منهم ما يحتاجه فقط." },
      { title: "مبسّط أو متقدم", body: "ابدأ بالعرض اليومي المختصر وانتقل إلى الكامل عندما تريد المزيد." },
    ],
  },
  close: {
    title: "شاهد أعمالك كلها في عرض واحد.",
    body: "سجّل الدخول للمتابعة. وإن أردت الاطلاع أولاً فجرّب العرض على بيانات من وحي الخيال.",
    cta: "سجّل الدخول إلى مساحة عملك",
  },
  footer: { line: "MedSupply360 · برج مراقبة الأعمال", audience: "لموزّعي المعدات والأجهزة والمستهلكات الطبية." },
};

export type LandingLocale = "en" | "ar";
export const landingFor = (locale: LandingLocale): LandingCopy => (locale === "ar" ? landingAr : landingEn);
