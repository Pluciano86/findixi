export type PlayasI18nKey =
  | 'playas.title'
  | 'playas.heading'
  | 'playas.searchPlaceholder'
  | 'playas.costaLabel'
  | 'playas.todasCostas'
  | 'playas.municipiosLabel'
  | 'playas.todosMunicipios'
  | 'playas.aptaNadar'
  | 'playas.aptaSurfear'
  | 'playas.aptaSnorkel'
  | 'playas.aptaPara'
  | 'playas.nadar'
  | 'playas.surfear'
  | 'playas.snorkel'
  | 'playas.sinResultados'
  | 'playas.sinResultadosConFiltros'
  | 'playas.filtroNombre'
  | 'playas.filtroCosta'
  | 'playas.filtroMunicipio'
  | 'playas.filtroNadar'
  | 'playas.filtroSurfear'
  | 'playas.filtroSnorkel'
  | 'playas.errorCargar'
  | 'playas.verSiguientes'
  | 'playas.accesoBote'
  | 'playas.calculando'
  | 'playas.vientoDe'
  | 'playas.costaSur'
  | 'playas.costaEste'
  | 'playas.costaMetro'
  | 'playas.costaNorte'
  | 'playas.costaOeste'
  | 'playas.costaIslas'
  | 'playas.climaDesconocido'
  | 'playa.noImageTitle'
  | 'playa.noImageSubtitle'
  | 'playas.loading'
  | 'playas.reintentar';

type Dict = Record<PlayasI18nKey, string>;

const ES: Dict = {
  'playas.title': 'Listado de Playas',
  'playas.heading': 'Playas de Puerto Rico',
  'playas.searchPlaceholder': 'Buscar por nombre',
  'playas.costaLabel': 'Costa:',
  'playas.todasCostas': 'Todas las Costas',
  'playas.municipiosLabel': 'Municipios:',
  'playas.todosMunicipios': 'Todos',
  'playas.aptaNadar': 'Apta para nadar',
  'playas.aptaSurfear': 'Apta para surfear',
  'playas.aptaSnorkel': 'Apta para snorkel',
  'playas.aptaPara': 'Apta para:',
  'playas.nadar': 'Nadar',
  'playas.surfear': 'Surfear',
  'playas.snorkel': 'Snorkel',
  'playas.sinResultados': 'No se encontraron playas con los filtros seleccionados.',
  'playas.sinResultadosConFiltros': 'No se encontraron playas que coincidan con {filtros}.',
  'playas.filtroNombre': 'nombre "{valor}"',
  'playas.filtroCosta': 'costa "{valor}"',
  'playas.filtroMunicipio': 'municipio "{valor}"',
  'playas.filtroNadar': 'aptas para nadar',
  'playas.filtroSurfear': 'aptas para surfear',
  'playas.filtroSnorkel': 'aptas para snorkel',
  'playas.errorCargar': 'No pudimos mostrar las playas.',
  'playas.verSiguientes': '🔽 Ver siguientes',
  'playas.accesoBote': 'Acceso en bote',
  'playas.calculando': 'Calculando...',
  'playas.vientoDe': 'Viento de: {valor}',
  'playas.costaSur': 'Sur',
  'playas.costaEste': 'Este',
  'playas.costaMetro': 'Metro',
  'playas.costaNorte': 'Norte',
  'playas.costaOeste': 'Oeste',
  'playas.costaIslas': 'Islas Municipio',
  'playas.climaDesconocido': 'Clima desconocido',
  'playa.noImageTitle': 'Lo sentimos',
  'playa.noImageSubtitle': 'Imagen no disponible',
  'playas.loading': 'Cargando playas...',
  'playas.reintentar': 'Reintentar',
};

const EN: Dict = {
  'playas.title': 'Beach Listing',
  'playas.heading': 'Beaches of Puerto Rico',
  'playas.searchPlaceholder': 'Search by name',
  'playas.costaLabel': 'Coast:',
  'playas.todasCostas': 'All Coasts',
  'playas.municipiosLabel': 'Municipalities:',
  'playas.todosMunicipios': 'All',
  'playas.aptaNadar': 'Suitable for swimming',
  'playas.aptaSurfear': 'Suitable for surfing',
  'playas.aptaSnorkel': 'Suitable for snorkeling',
  'playas.aptaPara': 'Suitable for:',
  'playas.nadar': 'Swim',
  'playas.surfear': 'Surf',
  'playas.snorkel': 'Snorkel',
  'playas.sinResultados': 'No beaches found with the selected filters.',
  'playas.sinResultadosConFiltros': 'No beaches found matching {filtros}.',
  'playas.filtroNombre': 'name "{valor}"',
  'playas.filtroCosta': 'coast "{valor}"',
  'playas.filtroMunicipio': 'municipality "{valor}"',
  'playas.filtroNadar': 'suitable for swimming',
  'playas.filtroSurfear': 'suitable for surfing',
  'playas.filtroSnorkel': 'suitable for snorkeling',
  'playas.errorCargar': "We couldn't show the beaches.",
  'playas.verSiguientes': '🔽 See more',
  'playas.accesoBote': 'Boat access',
  'playas.calculando': 'Calculating...',
  'playas.vientoDe': 'Wind: {valor}',
  'playas.costaSur': 'South',
  'playas.costaEste': 'East',
  'playas.costaMetro': 'Metro',
  'playas.costaNorte': 'North',
  'playas.costaOeste': 'West',
  'playas.costaIslas': 'Municipal Islands',
  'playas.climaDesconocido': 'Unknown weather',
  'playa.noImageTitle': "We're sorry",
  'playa.noImageSubtitle': 'Image not available',
  'playas.loading': 'Loading beaches...',
  'playas.reintentar': 'Retry',
};

const ZH: Dict = {
  'playas.title': '海滩列表',
  'playas.heading': '波多黎各的海滩',
  'playas.searchPlaceholder': '按名称搜索',
  'playas.costaLabel': '海岸：',
  'playas.todasCostas': '所有海岸',
  'playas.municipiosLabel': '市镇：',
  'playas.todosMunicipios': '全部',
  'playas.aptaNadar': '适合游泳',
  'playas.aptaSurfear': '适合冲浪',
  'playas.aptaSnorkel': '适合浮潜',
  'playas.aptaPara': '适合：',
  'playas.nadar': '游泳',
  'playas.surfear': '冲浪',
  'playas.snorkel': '浮潜',
  'playas.sinResultados': '未找到符合筛选条件的海滩。',
  'playas.sinResultadosConFiltros': '未找到匹配 {filtros} 的海滩。',
  'playas.filtroNombre': '名称“{valor}”',
  'playas.filtroCosta': '海岸“{valor}”',
  'playas.filtroMunicipio': '市镇“{valor}”',
  'playas.filtroNadar': '适合游泳',
  'playas.filtroSurfear': '适合冲浪',
  'playas.filtroSnorkel': '适合浮潜',
  'playas.errorCargar': '无法显示海滩。',
  'playas.verSiguientes': '🔽 查看更多',
  'playas.accesoBote': '乘船可达',
  'playas.calculando': '计算中...',
  'playas.vientoDe': '风速：{valor}',
  'playas.costaSur': '南部',
  'playas.costaEste': '东部',
  'playas.costaMetro': '都会区',
  'playas.costaNorte': '北部',
  'playas.costaOeste': '西部',
  'playas.costaIslas': '市属岛屿',
  'playas.climaDesconocido': '天气未知',
  'playa.noImageTitle': '很抱歉',
  'playa.noImageSubtitle': '暂无图片',
  'playas.loading': '正在加载海滩...',
  'playas.reintentar': '重试',
};

const FR: Dict = {
  'playas.title': 'Liste des plages',
  'playas.heading': 'Plages de Porto Rico',
  'playas.searchPlaceholder': 'Rechercher par nom',
  'playas.costaLabel': 'Côte :',
  'playas.todasCostas': 'Toutes les côtes',
  'playas.municipiosLabel': 'Municipalités :',
  'playas.todosMunicipios': 'Toutes',
  'playas.aptaNadar': 'Adaptée pour nager',
  'playas.aptaSurfear': 'Adaptée pour surfer',
  'playas.aptaSnorkel': 'Adaptée pour faire du snorkeling',
  'playas.aptaPara': 'Adaptée pour :',
  'playas.nadar': 'Nager',
  'playas.surfear': 'Surfer',
  'playas.snorkel': 'Snorkel',
  'playas.sinResultados': 'Aucune plage trouvée avec les filtres sélectionnés.',
  'playas.sinResultadosConFiltros': 'Aucune plage correspondant à {filtros}.',
  'playas.filtroNombre': 'nom "{valor}"',
  'playas.filtroCosta': 'côte "{valor}"',
  'playas.filtroMunicipio': 'municipalité "{valor}"',
  'playas.filtroNadar': 'adaptée pour nager',
  'playas.filtroSurfear': 'adaptée pour surfer',
  'playas.filtroSnorkel': 'adaptée pour snorkeling',
  'playas.errorCargar': 'Impossible d’afficher les plages.',
  'playas.verSiguientes': '🔽 Voir plus',
  'playas.accesoBote': 'Accès en bateau',
  'playas.calculando': 'Calcul en cours...',
  'playas.vientoDe': 'Vent : {valor}',
  'playas.costaSur': 'Sud',
  'playas.costaEste': 'Est',
  'playas.costaMetro': 'Métro',
  'playas.costaNorte': 'Nord',
  'playas.costaOeste': 'Ouest',
  'playas.costaIslas': 'Îles municipales',
  'playas.climaDesconocido': 'Météo inconnue',
  'playa.noImageTitle': 'Nous sommes désolés',
  'playa.noImageSubtitle': 'Image non disponible',
  'playas.loading': 'Chargement des plages...',
  'playas.reintentar': 'Réessayer',
};

const PT: Dict = {
  'playas.title': 'Lista de praias',
  'playas.heading': 'Praias de Porto Rico',
  'playas.searchPlaceholder': 'Buscar por nome',
  'playas.costaLabel': 'Costa:',
  'playas.todasCostas': 'Todas as Costas',
  'playas.municipiosLabel': 'Municípios:',
  'playas.todosMunicipios': 'Todos',
  'playas.aptaNadar': 'Apta para nadar',
  'playas.aptaSurfear': 'Apta para surfar',
  'playas.aptaSnorkel': 'Apta para snorkel',
  'playas.aptaPara': 'Apta para:',
  'playas.nadar': 'Nadar',
  'playas.surfear': 'Surfar',
  'playas.snorkel': 'Snorkel',
  'playas.sinResultados': 'Não foram encontradas praias com os filtros selecionados.',
  'playas.sinResultadosConFiltros': 'Não foram encontradas praias que correspondam a {filtros}.',
  'playas.filtroNombre': 'nome "{valor}"',
  'playas.filtroCosta': 'costa "{valor}"',
  'playas.filtroMunicipio': 'município "{valor}"',
  'playas.filtroNadar': 'aptas para nadar',
  'playas.filtroSurfear': 'aptas para surfar',
  'playas.filtroSnorkel': 'aptas para snorkel',
  'playas.errorCargar': 'Não foi possível mostrar as praias.',
  'playas.verSiguientes': '🔽 Ver mais',
  'playas.accesoBote': 'Acesso de barco',
  'playas.calculando': 'Calculando...',
  'playas.vientoDe': 'Vento: {valor}',
  'playas.costaSur': 'Sul',
  'playas.costaEste': 'Leste',
  'playas.costaMetro': 'Metro',
  'playas.costaNorte': 'Norte',
  'playas.costaOeste': 'Oeste',
  'playas.costaIslas': 'Ilhas Município',
  'playas.climaDesconocido': 'Clima desconhecido',
  'playa.noImageTitle': 'Desculpe',
  'playa.noImageSubtitle': 'Imagem não disponível',
  'playas.loading': 'Carregando praias...',
  'playas.reintentar': 'Tentar novamente',
};

const DE: Dict = {
  'playas.title': 'Strandliste',
  'playas.heading': 'Strände von Puerto Rico',
  'playas.searchPlaceholder': 'Nach Name suchen',
  'playas.costaLabel': 'Küste:',
  'playas.todasCostas': 'Alle Küsten',
  'playas.municipiosLabel': 'Gemeinden:',
  'playas.todosMunicipios': 'Alle',
  'playas.aptaNadar': 'Geeignet zum Schwimmen',
  'playas.aptaSurfear': 'Geeignet zum Surfen',
  'playas.aptaSnorkel': 'Geeignet zum Schnorcheln',
  'playas.aptaPara': 'Geeignet für:',
  'playas.nadar': 'Schwimmen',
  'playas.surfear': 'Surfen',
  'playas.snorkel': 'Schnorcheln',
  'playas.sinResultados': 'Keine Strände mit den ausgewählten Filtern gefunden.',
  'playas.sinResultadosConFiltros': 'Keine Strände gefunden, die {filtros} entsprechen.',
  'playas.filtroNombre': 'Name "{valor}"',
  'playas.filtroCosta': 'Küste "{valor}"',
  'playas.filtroMunicipio': 'Gemeinde "{valor}"',
  'playas.filtroNadar': 'zum Schwimmen geeignet',
  'playas.filtroSurfear': 'zum Surfen geeignet',
  'playas.filtroSnorkel': 'zum Schnorcheln geeignet',
  'playas.errorCargar': 'Strände konnten nicht angezeigt werden.',
  'playas.verSiguientes': '🔽 Mehr anzeigen',
  'playas.accesoBote': 'Zugang per Boot',
  'playas.calculando': 'Wird berechnet...',
  'playas.vientoDe': 'Wind: {valor}',
  'playas.costaSur': 'Süd',
  'playas.costaEste': 'Ost',
  'playas.costaMetro': 'Metro',
  'playas.costaNorte': 'Nord',
  'playas.costaOeste': 'West',
  'playas.costaIslas': 'Gemeindeinseln',
  'playas.climaDesconocido': 'Unbekanntes Wetter',
  'playa.noImageTitle': 'Es tut uns leid',
  'playa.noImageSubtitle': 'Bild nicht verfügbar',
  'playas.loading': 'Strände werden geladen...',
  'playas.reintentar': 'Erneut versuchen',
};

const IT: Dict = {
  'playas.title': 'Elenco spiagge',
  'playas.heading': 'Spiagge di Porto Rico',
  'playas.searchPlaceholder': 'Cerca per nome',
  'playas.costaLabel': 'Costa:',
  'playas.todasCostas': 'Tutte le coste',
  'playas.municipiosLabel': 'Comuni:',
  'playas.todosMunicipios': 'Tutti',
  'playas.aptaNadar': 'Adatta per nuotare',
  'playas.aptaSurfear': 'Adatta per surfare',
  'playas.aptaSnorkel': 'Adatta per fare snorkeling',
  'playas.aptaPara': 'Adatta per:',
  'playas.nadar': 'Nuotare',
  'playas.surfear': 'Surf',
  'playas.snorkel': 'Snorkel',
  'playas.sinResultados': 'Nessuna spiaggia trovata con i filtri selezionati.',
  'playas.sinResultadosConFiltros': 'Nessuna spiaggia che corrisponda a {filtros}.',
  'playas.filtroNombre': 'nome "{valor}"',
  'playas.filtroCosta': 'costa "{valor}"',
  'playas.filtroMunicipio': 'comune "{valor}"',
  'playas.filtroNadar': 'adatte per nuotare',
  'playas.filtroSurfear': 'adatte per surfare',
  'playas.filtroSnorkel': 'adatte per snorkeling',
  'playas.errorCargar': 'Impossibile mostrare le spiagge.',
  'playas.verSiguientes': '🔽 Vedi altre',
  'playas.accesoBote': 'Accesso in barca',
  'playas.calculando': 'Calcolo in corso...',
  'playas.vientoDe': 'Vento: {valor}',
  'playas.costaSur': 'Sud',
  'playas.costaEste': 'Est',
  'playas.costaMetro': 'Metro',
  'playas.costaNorte': 'Nord',
  'playas.costaOeste': 'Ovest',
  'playas.costaIslas': 'Isole municipali',
  'playas.climaDesconocido': 'Clima sconosciuto',
  'playa.noImageTitle': 'Ci dispiace',
  'playa.noImageSubtitle': 'Immagine non disponibile',
  'playas.loading': 'Caricamento spiagge...',
  'playas.reintentar': 'Riprova',
};

const KO: Dict = {
  'playas.title': '해변 목록',
  'playas.heading': '푸에르토리코의 해변',
  'playas.searchPlaceholder': '이름으로 검색',
  'playas.costaLabel': '해안:',
  'playas.todasCostas': '모든 해안',
  'playas.municipiosLabel': '지역:',
  'playas.todosMunicipios': '모두',
  'playas.aptaNadar': '수영에 적합',
  'playas.aptaSurfear': '서핑에 적합',
  'playas.aptaSnorkel': '스노클링에 적합',
  'playas.aptaPara': '적합:',
  'playas.nadar': '수영',
  'playas.surfear': '서핑',
  'playas.snorkel': '스노클',
  'playas.sinResultados': '선택한 필터에 맞는 해변이 없습니다.',
  'playas.sinResultadosConFiltros': '{filtros}에 해당하는 해변이 없습니다.',
  'playas.filtroNombre': '이름 "{valor}"',
  'playas.filtroCosta': '해안 "{valor}"',
  'playas.filtroMunicipio': '지역 "{valor}"',
  'playas.filtroNadar': '수영에 적합',
  'playas.filtroSurfear': '서핑에 적합',
  'playas.filtroSnorkel': '스노클링에 적합',
  'playas.errorCargar': '해변을 표시할 수 없습니다.',
  'playas.verSiguientes': '🔽 더 보기',
  'playas.accesoBote': '배로 접근',
  'playas.calculando': '계산 중...',
  'playas.vientoDe': '바람: {valor}',
  'playas.costaSur': '남부',
  'playas.costaEste': '동부',
  'playas.costaMetro': '메트로',
  'playas.costaNorte': '북부',
  'playas.costaOeste': '서부',
  'playas.costaIslas': '시군 섬',
  'playas.climaDesconocido': '날씨 정보 없음',
  'playa.noImageTitle': '죄송합니다',
  'playa.noImageSubtitle': '이미지가 없습니다',
  'playas.loading': '해변을 불러오는 중...',
  'playas.reintentar': '다시 시도',
};

const JA: Dict = {
  'playas.title': 'ビーチ一覧',
  'playas.heading': 'プエルトリコのビーチ',
  'playas.searchPlaceholder': '名前で検索',
  'playas.costaLabel': '海岸：',
  'playas.todasCostas': 'すべての海岸',
  'playas.municipiosLabel': '市町村：',
  'playas.todosMunicipios': 'すべて',
  'playas.aptaNadar': '泳げる',
  'playas.aptaSurfear': 'サーフィン可能',
  'playas.aptaSnorkel': 'シュノーケリング可能',
  'playas.aptaPara': '適する目的：',
  'playas.nadar': '泳ぐ',
  'playas.surfear': 'サーフィン',
  'playas.snorkel': 'シュノーケル',
  'playas.sinResultados': '選択したフィルターに該当するビーチはありません。',
  'playas.sinResultadosConFiltros': '{filtros}に該当するビーチはありません。',
  'playas.filtroNombre': '名前「{valor}」',
  'playas.filtroCosta': '海岸「{valor}」',
  'playas.filtroMunicipio': '市町村「{valor}」',
  'playas.filtroNadar': '泳げる',
  'playas.filtroSurfear': 'サーフィン可能',
  'playas.filtroSnorkel': 'シュノーケリング可能',
  'playas.errorCargar': 'ビーチを表示できませんでした。',
  'playas.verSiguientes': '🔽 もっと見る',
  'playas.accesoBote': 'ボートでアクセス',
  'playas.calculando': '計算中...',
  'playas.vientoDe': '風：{valor}',
  'playas.costaSur': '南部',
  'playas.costaEste': '東部',
  'playas.costaMetro': 'メトロ',
  'playas.costaNorte': '北部',
  'playas.costaOeste': '西部',
  'playas.costaIslas': '市町村の島々',
  'playas.climaDesconocido': '天気不明',
  'playa.noImageTitle': '申し訳ありません',
  'playa.noImageSubtitle': '画像はありません',
  'playas.loading': 'ビーチを読み込み中...',
  'playas.reintentar': '再試行',
};

const DICTS: Record<string, Dict> = {
  es: ES,
  en: EN,
  zh: ZH,
  fr: FR,
  pt: PT,
  de: DE,
  it: IT,
  ko: KO,
  ja: JA,
};

function normalizeLang(lang: string): string {
  return String(lang || 'es').toLowerCase().split('-')[0];
}

export function tPlayas(key: PlayasI18nKey, lang: string, params?: Record<string, string | number>): string {
  const code = normalizeLang(lang);
  const template = DICTS[code]?.[key] || ES[key] || key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params[token];
    return value == null ? '' : String(value);
  });
}

export function traducirCosta(lang: string, costa: string): string {
  const normalized = String(costa || '').trim().toLowerCase();
  const keyByCosta: Record<string, PlayasI18nKey> = {
    sur: 'playas.costaSur',
    este: 'playas.costaEste',
    metro: 'playas.costaMetro',
    norte: 'playas.costaNorte',
    oeste: 'playas.costaOeste',
    'islas municipio': 'playas.costaIslas',
    islas: 'playas.costaIslas',
  };
  const key = keyByCosta[normalized];
  return key ? tPlayas(key, lang) : costa;
}
