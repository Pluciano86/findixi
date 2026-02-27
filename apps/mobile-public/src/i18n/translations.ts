import type { LanguageCode } from './languages';

const ES_TRANSLATIONS = {
  'header.changeLanguage': 'Cambiar idioma',

  'home.categoriesTitle': 'Categorías más Buscadas',
  'home.toggleAllCategories': 'Ver todas las Categorías...',
  'home.toggleLessCategories': 'Ver menos...',

  'home.specialsLunch': 'Especiales de Almuerzo',
  'home.specialsHappyHour': 'Happy Hour',
  'home.specialsCta': 'Dale aquí y chequea los especiales',

  'home.comidaTitle': '¡Aquí sí, se come Brutal!',
  'home.loadingRestaurants': 'Cargando lugares...',
  'home.emptyRestaurants': 'No hay lugares disponibles.',

  'home.jangueoTitle': '¿Nos Fuimos pal Jangueo?',
  'home.loadingJangueo': 'Cargando lugares...',
  'home.emptyJangueo': 'No hay lugares disponibles.',

  'home.eventsTitle': 'Chequea los próximos Eventos',
  'home.loadingEvents': 'Cargando eventos...',
  'home.emptyEvents': 'No hay eventos disponibles.',
  'home.moreEvents': 'Ver más eventos',

  'home.beachTitle': "Vamos Pa' la Playa",
  'home.areaTitle': 'Descubre lo que hay en tu Área',
  'home.metroSubtitle': 'Área Metropolitana',
  'home.loadingAreas': 'Cargando áreas...',

  'home.noBanners': 'No hay banners disponibles.',
  'home.loadingContent': 'Cargando contenido...',
  'home.loadError': 'No se pudo cargar el inicio.',

  'home.businessBadge': 'Para Negocios',
  'home.businessTitle': '¿Eres dueño de negocio?',
  'home.businessCopy': 'Te interesa más visibilidad en Findixi. Registra tu comercio y activa tu perfil.',
  'home.businessCta': 'Comenzar ahora',

  'footer.home': 'Inicio',
  'footer.near': 'Cerca de Mi',
  'footer.events': 'Eventos',
  'footer.profile': 'Mi Perfil',
} as const;

type TranslationKey = keyof typeof ES_TRANSLATIONS;
type TranslationDictionary = Record<TranslationKey, string>;

const EN_TRANSLATIONS: TranslationDictionary = {
  'header.changeLanguage': 'Change language',

  'home.categoriesTitle': 'Top Categories',
  'home.toggleAllCategories': 'See all Categories...',
  'home.toggleLessCategories': 'Show fewer categories...',

  'home.specialsLunch': 'Lunch Specials',
  'home.specialsHappyHour': 'Happy Hour Specials',
  'home.specialsCta': "Tap here to see today's specials",

  'home.comidaTitle': 'Here we eat amazing!',
  'home.loadingRestaurants': 'Loading places...',
  'home.emptyRestaurants': 'No places available.',

  'home.jangueoTitle': 'Ready to Party?',
  'home.loadingJangueo': 'Loading places...',
  'home.emptyJangueo': 'No places available.',

  'home.eventsTitle': 'Check upcoming Events',
  'home.loadingEvents': 'Loading events...',
  'home.emptyEvents': 'No events available.',
  'home.moreEvents': 'See more events',

  'home.beachTitle': "Let's hit the Beach",
  'home.areaTitle': 'Discover what’s in your Area',
  'home.metroSubtitle': 'Metropolitan Area',
  'home.loadingAreas': 'Loading areas...',

  'home.noBanners': 'No banners available.',
  'home.loadingContent': 'Loading content...',
  'home.loadError': 'Could not load the home screen.',

  'home.businessBadge': 'For Businesses',
  'home.businessTitle': 'Do you own a business?',
  'home.businessCopy': 'Get more visibility on Findixi. Register your business and activate your profile.',
  'home.businessCta': 'Get started now',

  'footer.home': 'Home',
  'footer.near': 'Near Me',
  'footer.events': 'Events',
  'footer.profile': 'My Profile',
};

const ZH_TRANSLATIONS: TranslationDictionary = {
  'header.changeLanguage': '切换语言',

  'home.categoriesTitle': '最热门的分类',
  'home.toggleAllCategories': '查看所有分类...',
  'home.toggleLessCategories': '收起分类...',

  'home.specialsLunch': '午餐特惠',
  'home.specialsHappyHour': '欢乐时光特惠',
  'home.specialsCta': '点这里查看今日优惠',

  'home.comidaTitle': '这里的美食超棒！',
  'home.loadingRestaurants': '加载景点中...',
  'home.emptyRestaurants': '暂无景点。',

  'home.jangueoTitle': '准备去嗨吗？',
  'home.loadingJangueo': '加载景点中...',
  'home.emptyJangueo': '暂无景点。',

  'home.eventsTitle': '查看即将举行的活动',
  'home.loadingEvents': '加载活动中...',
  'home.emptyEvents': '暂无活动。',
  'home.moreEvents': '查看更多活动',

  'home.beachTitle': '去海滩吧',
  'home.areaTitle': '探索你所在的区域',
  'home.metroSubtitle': '大都会区',
  'home.loadingAreas': '正在加载区域...',

  'home.noBanners': '暂无横幅可显示。',
  'home.loadingContent': '加载内容中...',
  'home.loadError': '无法加载首页。',

  'home.businessBadge': '商家专区',
  'home.businessTitle': '你是商家老板吗？',
  'home.businessCopy': '在 Findixi 获得更多曝光。注册你的商家并激活你的资料。',
  'home.businessCta': '立即开始',

  'footer.home': '首页',
  'footer.near': '附近',
  'footer.events': '活动',
  'footer.profile': '我的账号',
};

const FR_TRANSLATIONS: TranslationDictionary = {
  'header.changeLanguage': 'Changer de langue',

  'home.categoriesTitle': 'Catégories les plus recherchées',
  'home.toggleAllCategories': 'Voir toutes les catégories...',
  'home.toggleLessCategories': 'Voir moins de catégories...',

  'home.specialsLunch': 'Formules Déjeuner',
  'home.specialsHappyHour': 'Offres Happy Hour',
  'home.specialsCta': 'Appuie ici pour voir les offres',

  'home.comidaTitle': 'Ici on mange super bien !',
  'home.loadingRestaurants': 'Chargement des lieux...',
  'home.emptyRestaurants': 'Aucun lieu disponible.',

  'home.jangueoTitle': 'On sort faire la fête ?',
  'home.loadingJangueo': 'Chargement des lieux...',
  'home.emptyJangueo': 'Aucun lieu disponible.',

  'home.eventsTitle': 'Consultez les prochains événements',
  'home.loadingEvents': 'Chargement des événements...',
  'home.emptyEvents': 'Aucun événement disponible.',
  'home.moreEvents': 'Voir plus d’événements',

  'home.beachTitle': 'Allons à la plage',
  'home.areaTitle': 'Découvrez ce qu’il y a dans votre zone',
  'home.metroSubtitle': 'Zone métropolitaine',
  'home.loadingAreas': 'Chargement des zones...',

  'home.noBanners': 'Aucune bannière disponible.',
  'home.loadingContent': 'Chargement du contenu...',
  'home.loadError': 'Impossible de charger l’accueil.',

  'home.businessBadge': 'Pour les entreprises',
  'home.businessTitle': 'Vous êtes propriétaire ?',
  'home.businessCopy': 'Obtenez plus de visibilité sur Findixi. Inscrivez votre commerce et activez votre profil.',
  'home.businessCta': 'Commencer maintenant',

  'footer.home': 'Accueil',
  'footer.near': 'Près de moi',
  'footer.events': 'Événements',
  'footer.profile': 'Mon profil',
};

const PT_TRANSLATIONS: TranslationDictionary = {
  'header.changeLanguage': 'Mudar idioma',

  'home.categoriesTitle': 'Categorias mais buscadas',
  'home.toggleAllCategories': 'Ver todas as categorias...',
  'home.toggleLessCategories': 'Ver menos categorias...',

  'home.specialsLunch': 'Especiais de Almoço',
  'home.specialsHappyHour': 'Ofertas de Happy Hour',
  'home.specialsCta': 'Toque aqui para ver as ofertas de hoje',

  'home.comidaTitle': 'Aqui a comida é top!',
  'home.loadingRestaurants': 'Carregando lugares...',
  'home.emptyRestaurants': 'Nenhum lugar disponível.',

  'home.jangueoTitle': 'Bora curtir?',
  'home.loadingJangueo': 'Carregando lugares...',
  'home.emptyJangueo': 'Nenhum lugar disponível.',

  'home.eventsTitle': 'Confira os próximos eventos',
  'home.loadingEvents': 'Carregando eventos...',
  'home.emptyEvents': 'Nenhum evento disponível.',
  'home.moreEvents': 'Ver mais eventos',

  'home.beachTitle': 'Vamos à praia',
  'home.areaTitle': 'Descubra o que há na sua área',
  'home.metroSubtitle': 'Região Metropolitana',
  'home.loadingAreas': 'Carregando áreas...',

  'home.noBanners': 'Nenhum banner disponível.',
  'home.loadingContent': 'Carregando conteúdo...',
  'home.loadError': 'Não foi possível carregar a tela inicial.',

  'home.businessBadge': 'Para Negócios',
  'home.businessTitle': 'Você é dono de negócio?',
  'home.businessCopy': 'Tenha mais visibilidade no Findixi. Cadastre seu comércio e ative seu perfil.',
  'home.businessCta': 'Começar agora',

  'footer.home': 'Início',
  'footer.near': 'Perto de mim',
  'footer.events': 'Eventos',
  'footer.profile': 'Meu perfil',
};

const DE_TRANSLATIONS: TranslationDictionary = {
  'header.changeLanguage': 'Sprache ändern',

  'home.categoriesTitle': 'Beliebteste Kategorien',
  'home.toggleAllCategories': 'Alle Kategorien anzeigen...',
  'home.toggleLessCategories': 'Weniger Kategorien anzeigen...',

  'home.specialsLunch': 'Mittagsangebote',
  'home.specialsHappyHour': 'Happy-Hour-Angebote',
  'home.specialsCta': 'Tippe hier, um die heutigen Angebote zu sehen',

  'home.comidaTitle': 'Hier isst man richtig gut!',
  'home.loadingRestaurants': 'Orte werden geladen...',
  'home.emptyRestaurants': 'Keine Orte verfügbar.',

  'home.jangueoTitle': 'Lust zu feiern?',
  'home.loadingJangueo': 'Orte werden geladen...',
  'home.emptyJangueo': 'Keine Orte verfügbar.',

  'home.eventsTitle': 'Bevorstehende Events ansehen',
  'home.loadingEvents': 'Events werden geladen...',
  'home.emptyEvents': 'Keine Events verfügbar.',
  'home.moreEvents': 'Mehr Events ansehen',

  'home.beachTitle': 'Ab zum Strand',
  'home.areaTitle': 'Entdecke, was es in deiner Gegend gibt',
  'home.metroSubtitle': 'Metropolregion',
  'home.loadingAreas': 'Gebiete werden geladen...',

  'home.noBanners': 'Keine Banner verfügbar.',
  'home.loadingContent': 'Inhalte werden geladen...',
  'home.loadError': 'Startseite konnte nicht geladen werden.',

  'home.businessBadge': 'Für Unternehmen',
  'home.businessTitle': 'Bist du Geschäftsinhaber?',
  'home.businessCopy': 'Mehr Sichtbarkeit auf Findixi. Registriere dein Geschäft und aktiviere dein Profil.',
  'home.businessCta': 'Jetzt starten',

  'footer.home': 'Start',
  'footer.near': 'In der Nähe',
  'footer.events': 'Events',
  'footer.profile': 'Mein Profil',
};

const IT_TRANSLATIONS: TranslationDictionary = {
  'header.changeLanguage': 'Cambia lingua',

  'home.categoriesTitle': 'Categorie più cercate',
  'home.toggleAllCategories': 'Vedi tutte le categorie...',
  'home.toggleLessCategories': 'Vedi meno categorie...',

  'home.specialsLunch': 'Speciali Pranzo',
  'home.specialsHappyHour': 'Offerte Happy Hour',
  'home.specialsCta': 'Tocca qui per vedere le offerte di oggi',

  'home.comidaTitle': 'Qui si mangia benissimo!',
  'home.loadingRestaurants': 'Caricamento luoghi...',
  'home.emptyRestaurants': 'Nessun luogo disponibile.',

  'home.jangueoTitle': 'Andiamo a divertirci?',
  'home.loadingJangueo': 'Caricamento luoghi...',
  'home.emptyJangueo': 'Nessun luogo disponibile.',

  'home.eventsTitle': 'Guarda i prossimi eventi',
  'home.loadingEvents': 'Caricamento eventi...',
  'home.emptyEvents': 'Nessun evento disponibile.',
  'home.moreEvents': 'Vedi più eventi',

  'home.beachTitle': 'Andiamo in spiaggia',
  'home.areaTitle': 'Scopri cosa c’è nella tua zona',
  'home.metroSubtitle': 'Area metropolitana',
  'home.loadingAreas': 'Caricamento aree...',

  'home.noBanners': 'Nessun banner disponibile.',
  'home.loadingContent': 'Caricamento contenuti...',
  'home.loadError': 'Impossibile caricare la home.',

  'home.businessBadge': 'Per aziende',
  'home.businessTitle': 'Sei proprietario di un’attività?',
  'home.businessCopy': 'Ottieni più visibilità su Findixi. Registra il tuo commercio e attiva il tuo profilo.',
  'home.businessCta': 'Inizia ora',

  'footer.home': 'Home',
  'footer.near': 'Vicino a me',
  'footer.events': 'Eventi',
  'footer.profile': 'Il mio profilo',
};

const KO_TRANSLATIONS: TranslationDictionary = {
  'header.changeLanguage': '언어 변경',

  'home.categoriesTitle': '인기 카테고리',
  'home.toggleAllCategories': '모든 카테고리 보기...',
  'home.toggleLessCategories': '카테고리 접기...',

  'home.specialsLunch': '점심 스페셜',
  'home.specialsHappyHour': '해피아워 스페셜',
  'home.specialsCta': '오늘의 스페셜을 보려면 여기를 터치',

  'home.comidaTitle': '여기 음식 최고!',
  'home.loadingRestaurants': '장소 불러오는 중...',
  'home.emptyRestaurants': '이용 가능한 장소가 없습니다.',

  'home.jangueoTitle': '파티하러 갈까요?',
  'home.loadingJangueo': '장소 불러오는 중...',
  'home.emptyJangueo': '이용 가능한 장소가 없습니다.',

  'home.eventsTitle': '다가오는 이벤트 확인',
  'home.loadingEvents': '이벤트 불러오는 중...',
  'home.emptyEvents': '이용 가능한 이벤트가 없습니다.',
  'home.moreEvents': '더 많은 이벤트 보기',

  'home.beachTitle': '해변으로 가요',
  'home.areaTitle': '내 주변을 둘러보기',
  'home.metroSubtitle': '대도시권',
  'home.loadingAreas': '지역 불러오는 중...',

  'home.noBanners': '표시할 배너가 없습니다.',
  'home.loadingContent': '콘텐츠 불러오는 중...',
  'home.loadError': '홈 화면을 불러올 수 없습니다.',

  'home.businessBadge': '비즈니스용',
  'home.businessTitle': '사업자이신가요?',
  'home.businessCopy': 'Findixi에서 더 많은 노출을 얻으세요. 매장을 등록하고 프로필을 활성화하세요.',
  'home.businessCta': '지금 시작',

  'footer.home': '홈',
  'footer.near': '내 주변',
  'footer.events': '이벤트',
  'footer.profile': '내 프로필',
};

const JA_TRANSLATIONS: TranslationDictionary = {
  'header.changeLanguage': '言語を変更',

  'home.categoriesTitle': '人気カテゴリー',
  'home.toggleAllCategories': 'すべてのカテゴリーを見る...',
  'home.toggleLessCategories': 'カテゴリーを減らして表示...',

  'home.specialsLunch': 'ランチスペシャル',
  'home.specialsHappyHour': 'ハッピーアワー特典',
  'home.specialsCta': '今日の特典を見るにはタップ',

  'home.comidaTitle': 'ここはご飯が最高！',
  'home.loadingRestaurants': '場所を読み込み中...',
  'home.emptyRestaurants': '利用できる場所がありません。',

  'home.jangueoTitle': '遊びに行こう？',
  'home.loadingJangueo': '場所を読み込み中...',
  'home.emptyJangueo': '利用できる場所がありません。',

  'home.eventsTitle': '今後のイベントをチェック',
  'home.loadingEvents': 'イベントを読み込み中...',
  'home.emptyEvents': '利用できるイベントがありません。',
  'home.moreEvents': 'さらにイベントを見る',

  'home.beachTitle': 'ビーチへ行こう',
  'home.areaTitle': '近くを探索',
  'home.metroSubtitle': '大都市圏',
  'home.loadingAreas': 'エリアを読み込み中...',

  'home.noBanners': '表示できるバナーがありません。',
  'home.loadingContent': 'コンテンツを読み込み中...',
  'home.loadError': 'ホーム画面を読み込めませんでした。',

  'home.businessBadge': 'ビジネス向け',
  'home.businessTitle': 'ビジネスオーナーですか？',
  'home.businessCopy': 'Findixiで露出を高めましょう。店舗を登録してプロフィールを有効化してください。',
  'home.businessCta': '今すぐ始める',

  'footer.home': 'ホーム',
  'footer.near': '近く',
  'footer.events': 'イベント',
  'footer.profile': '私のプロフィール',
};

const TRANSLATIONS: Record<LanguageCode, TranslationDictionary> = {
  es: ES_TRANSLATIONS,
  en: EN_TRANSLATIONS,
  zh: ZH_TRANSLATIONS,
  fr: FR_TRANSLATIONS,
  pt: PT_TRANSLATIONS,
  de: DE_TRANSLATIONS,
  it: IT_TRANSLATIONS,
  ko: KO_TRANSLATIONS,
  ja: JA_TRANSLATIONS,
};

export type I18nKey = TranslationKey;

export function translate(lang: LanguageCode, key: I18nKey): string {
  return TRANSLATIONS[lang][key] ?? ES_TRANSLATIONS[key];
}
