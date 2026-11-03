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
  nav: { label: string; how: string; pillars: string; intel: string; preview: string; signIn: string; workspace: string; demo: string; language: string; languageHref: string };
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
  /** Tender price intelligence: what the Price history screen does, with a made-up example of "how close we lose". */
  intel: {
    title: string;
    subtitle: string;
    items: { title: string; body: string }[];
    chartTitle: string;
    chartSample: string;
    buckets: { label: string; count: number }[];
    chartNote: string;
  };
  journey: { title: string; subtitle: string; steps: { title: string; body: string }[] };
  how: { title: string; subtitle: string; items: { title: string; body: string }[] };
  close: { title: string; body: string; cta: string };
  footer: { line: string; audience: string };
};

export const landingEn: LandingCopy = {
  meta: {
    title: "MedSupply360: Every tender. Every device. Every dinar.",
    description:
      "One place for distributors of medical equipment, devices and consumables to see sales, tenders, installed machines, stock and cash.",
  },
  brand: "MedSupply360",
  strap: "Business control tower",
  skip: "Skip to content",
  nav: { label: "Main", how: "What is inside", pillars: "What you gain", intel: "Tender intelligence", preview: "A first look", signIn: "Sign in", workspace: "Back to your workspace", demo: "Try the demo", language: "العربية", languageHref: "/ar" },
  hero: {
    title: "Every tender. Every device. Every dinar.",
    subtitle: "One place to see how your medical equipment, devices and consumables business is doing.",
    body: "MedSupply360 puts your sales files, tender records, installed machines and field work in one view for the owner. It shows what sold, which tenders to bid on and at what price, which customers are late to reorder, what stock may expire, and what to do first.",
    primary: "Sign in to your workspace",
    secondary: "See what is inside",
    points: ["Every figure shows its dates", "Past tender prices, with how many awards each is based on", "Owner, tender and finance staff each see only what they need"],
  },
  preview: {
    title: "A first look",
    sample: "Sample data. All figures are made up.",
    stats: [
      { label: "Sales, Jan-Sep 2026", value: "JOD 4.54M", note: "Sales after returns, by product line" },
      { label: "Profit on sales", value: "JOD 1.51M", note: "33.3% of sales, before running costs" },
      { label: "Cash received, Jan-Sep 2026", value: "JOD 3.86M", note: "Some of this may be for earlier sales" },
      { label: "Overdue balances", value: "JOD 117.1K", note: "Shown separately from bills not yet due" },
    ],
    priorityTitle: "Your priority list",
    priorities: [
      { title: "Stock may expire", value: "JOD 21,760", tone: "bad" },
      { title: "Overdue customer balances", value: "JOD 117.1K", tone: "bad" },
      { title: "Actions with a named person", value: "3 open", tone: "good" },
    ],
    linesTitle: "Profit margin by product line",
    lines: [
      { name: "Equipment", share: 25 },
      { name: "Devices", share: 32 },
      { name: "Consumables", share: 39 },
    ],
  },
  pillars: {
    title: "Five things the owner can see in one place",
    items: [
      { title: "Sales and profit", body: "Equipment, devices and consumables side by side, with the profit on each. Every figure says which dates it covers." },
      { title: "Tenders, start to cash", body: "Ten stages from announcement to payment, the guarantees you hold, the invoices you sent and what the authorities still owe. You see how many days each tender has waited, so you know what is stuck." },
      { title: "Installed machines and service", body: "Follow each installed machine: how much it is used, its supplies, its service and its replacement. You do not miss repeat sales or service income." },
      { title: "Stock and cash risk", body: "Stock that may expire before it sells, when to reorder, and overdue payments with their age." },
      { title: "Actions that get done", body: "Each finding becomes a task with a named person and a date. Targets, customers and tenders go to your sales team." },
    ],
  },
  intel: {
    title: "Tender intelligence: bid with facts, not memory",
    subtitle: "Load the authorities' award results once. The app turns them into prices you can use before your next bid.",
    items: [
      { title: "What the authorities paid", body: "Item by item: the typical award price, the lower half of the prices paid (a good place to aim), and the latest award with its date and authority." },
      { title: "How close we lose", body: "Your bids sorted into won, or lost by a small gap above the winner (up to 5%, 10% or 20%), so you can see if price decided it." },
      { title: "Honest about thin data", body: "Every price shows how many awards it is based on, and is marked thin, fair or good. A price in another currency is counted but never converted." },
      { title: "Tenders that need you today", body: "Ten stages from announcement to payment, days spent in each stage, the guarantees you hold and what the authorities still owe." },
    ],
    chartTitle: "How close we lose",
    chartSample: "Sample data. All figures are made up.",
    buckets: [
      { label: "Won", count: 16 },
      { label: "Lost, within 5% of the winner", count: 27 },
      { label: "Lost, 5% to 10% above the winner", count: 51 },
      { label: "Lost, 10% to 20% above the winner", count: 21 },
      { label: "Lost, more than 20% above the winner", count: 0 },
    ],
    chartNote: "In this sample, 78 of the 99 lost bids were within 10% of the winning price.",
  },
  journey: {
    title: "From your accounting files to your next step",
    subtitle: "Checking comes before reading. You see what is missing before you rely on a number.",
    steps: [
      { title: "Collect", body: "Upload files from your accounting system as Excel or CSV. The tender team records tenders. Installed machines and targets are typed in." },
      { title: "Check", body: "A preview shows what will be loaded. If a column name is not recognised, you can match it yourself. A banner shows how recent the data is." },
      { title: "See", body: "The owner overview shows sales, profit, cash, stock and tenders, each with its dates." },
      { title: "Decide", body: "A short list puts the most urgent items first. Estimates are labelled as estimates." },
      { title: "Act", body: "Each action gets a named person and a due date." },
      { title: "Follow up", body: "The update history shows who entered or changed data, and when." },
    ],
  },
  how: {
    title: "What is inside today",
    subtitle: "These are working screens of the application, not plans.",
    items: [
      { title: "Owner overview", body: "Sales, profit, cash, stock and follow-up on one page." },
      { title: "Tender tracker", body: "Ten stages, guarantees, invoices and payments, with the owner's summary first." },
      { title: "Tender price history", body: "What past tenders paid, item by item, and how your own bids did." },
      { title: "Installed base", body: "Every installed machine with its use, supplies and service cover." },
      { title: "Service and support", body: "Machines out of warranty with no service contract, and contracts about to end. Each is a chance to sell or renew." },
      { title: "Support functions", body: "How logistics, buying, HR, customer support and tender support are doing against the targets the owner sets." },
      { title: "Opportunity radar", body: "Customers who are late to reorder, based on how often they usually buy. These are estimates, not forecasts." },
      { title: "Sales force", body: "Each person, the supplier companies they cover, targets, customers and tenders, with visits logged." },
      { title: "Management actions", body: "Each finding becomes a task with a named person and a due date." },
      { title: "Smart upload", body: "Excel or CSV with a preview before anything is saved, and a column picker for unfamiliar headings." },
      { title: "Roles and access", body: "Owner, tender and finance users each open only what they need." },
      { title: "Basic or Advanced", body: "Start with the short daily view and switch to the full one when you want more." },
    ],
  },
  close: {
    title: "See your whole business in one view.",
    body: "Sign in to continue. To look around first, try the demo on made-up data.",
    cta: "Sign in to your workspace",
  },
  footer: { line: "MedSupply360 · Business control tower", audience: "For distributors of medical equipment, devices and consumables." },
};

export const landingAr: LandingCopy = {
  meta: {
    title: "MedSupply360: كل مناقصة. كل جهاز. كل دينار.",
    description: "برج مراقبة واحد لموزّعي المعدات والأجهزة والمستهلكات الطبية: المبيعات والمناقصات والأجهزة المركّبة والمخزون والنقد في عرض واحد للمالك.",
  },
  brand: "MedSupply360",
  strap: "برج مراقبة الأعمال",
  skip: "انتقل إلى المحتوى",
  nav: { label: "القائمة الرئيسية", how: "ما بداخله", pillars: "ما الذي تكسبه", intel: "ذكاء المناقصات", preview: "نظرة أولى", signIn: "تسجيل الدخول", workspace: "العودة إلى مساحة عملك", demo: "جرّب العرض", language: "English", languageHref: "/" },
  hero: {
    title: "كل مناقصة. كل جهاز. كل دينار.",
    subtitle: "برج مراقبة واحد لموزّعي المعدات والأجهزة والمستهلكات الطبية.",
    body: "يجمع MedSupply360 ملفات المبيعات وسجلات المناقصات والأجهزة المركّبة والعمل الميداني في عرض واحد للمالك: ما الذي بِيع، وأي مناقصة تتقدّم إليها وبأي سعر، وأي عملاء حان موعد إعادة طلبهم، وما الذي قد تنتهي صلاحيته، وبماذا تبدأ.",
    primary: "سجّل الدخول إلى مساحة عملك",
    secondary: "شاهد ما بداخله",
    points: ["كل رقم يبيّن فترته", "أسعار المناقصات السابقة مع عدد الإحالات خلفها", "صلاحيات منفصلة للمالك والمناقصات والمالية"],
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
  intel: {
    title: "ذكاء المناقصات: قدّم عرضك بدليل لا بالذاكرة",
    subtitle: "حمّل نتائج إحالات الجهات مرة واحدة. ويحوّلها التطبيق إلى أسعار تستعين بها قبل عرضك القادم.",
    items: [
      { title: "ما دفعته الجهات", body: "صنفاً صنفاً: سعر الإحالة الوسطي، والنصف الأدنى مما دُفع (مكان معقول لتستهدفه)، وآخر إحالة مع تاريخها وجهتها." },
      { title: "إلى أي مدى نخسر بفارق صغير", body: "عروضنا مصنّفة: فزنا، أو خسرنا بفارق أقل من 5% أو 10% أو 20% فوق سعر الفائز، فترى هل حسم السعر الأمر." },
      { title: "صريح بشأن قلّة البيانات", body: "كل سعر يبيّن عدد الإحالات التي يقوم عليها، ويوسَم بأنه ضعيف أو متوسط أو جيد. والسعر بعملة أخرى يُحتسب عدداً ولا يُحوَّل." },
      { title: "مناقصات تحتاجك اليوم", body: "عشر مراحل من الإعلان حتى الدفع، وأيام كل مرحلة، والكفالات المحتجزة، وما لا تزال الجهات مدينةً به." },
    ],
    chartTitle: "إلى أي مدى نخسر بفارق صغير",
    chartSample: "بيانات نموذجية. كل الأرقام من وحي الخيال.",
    buckets: [
      { label: "فزنا", count: 16 },
      { label: "خسرنا، ضمن 5% من الفائز", count: 27 },
      { label: "خسرنا، بين 5% و10% فوق السعر", count: 51 },
      { label: "خسرنا، بين 10% و20% فوق السعر", count: 21 },
      { label: "خسرنا، أكثر من 20% فوق السعر", count: 0 },
    ],
    chartNote: "في هذه العيّنة، كان 78 من 99 عرضاً خاسراً ضمن 10% من السعر الفائز.",
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
      { title: "سجل أسعار المناقصات", body: "ما دفعته المناقصات السابقة صنفاً صنفاً، وكيف كان أداء عروضنا." },
      { title: "الأجهزة المركّبة", body: "كل تركيب مع استخدامه ومستهلكاته وتغطية صيانته." },
      { title: "الصيانة والدعم", body: "أجهزة خرجت من الكفالة بلا عقد صيانة، وعقود قاربت الانتهاء: كل منها متابعة لبيع عقد أو تجديده." },
      { title: "رادار الفرص", body: "عملاء تأخر موعد إعادة طلبهم، بحسب إيقاع شرائهم هم. وهي تقديرات وليست تنبؤات." },
      { title: "فريق المبيعات", body: "الأفراد وشركاتهم الموردة وأهدافهم وحساباتهم ومناقصاتهم، مع تسجيل الزيارات." },
      { title: "الإجراءات الإدارية", body: "تتحول كل ملاحظة إلى إجراء له مسؤول باسمه وموعد استحقاق." },
      { title: "الرفع الذكي", body: "ملف Excel أو CSV مع معاينة قبل حفظ أي شيء، ومُنتقي للأعمدة عند العناوين غير المألوفة." },
      { title: "الأدوار والصلاحيات", body: "مستخدمو المالك والمناقصات والمالية يفتح كلٌّ منهم ما يحتاجه فقط." },
      { title: "الوظائف المساندة", body: "أداء الخدمات اللوجستية والمشتريات والموارد البشرية ودعم العملاء ودعم المناقصات مقابل الأهداف التي يضعها المالك." },
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
