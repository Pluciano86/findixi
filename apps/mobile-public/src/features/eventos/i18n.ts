type EventosI18nKey =
  | 'eventos.titulo'
  | 'eventos.buscarNombre'
  | 'eventos.municipio'
  | 'eventos.categoria'
  | 'eventos.ordenarPor'
  | 'eventos.todosMunicipios'
  | 'eventos.todasCategorias'
  | 'eventos.fechaAsc'
  | 'eventos.fechaDesc'
  | 'eventos.alfabetico'
  | 'eventos.soloHoy'
  | 'eventos.estaSemana'
  | 'eventos.gratis'
  | 'eventos.loading'
  | 'eventos.errorCargar'
  | 'eventos.reintentar'
  | 'evento.variasFechas'
  | 'evento.sinFecha'
  | 'evento.costoLabel'
  | 'evento.costoNoDisponible'
  | 'evento.sinResultados'
  | 'evento.variosMunicipios';

type Dict = Record<EventosI18nKey, string>;

const ES: Dict = {
  'eventos.titulo': 'Eventos en Puerto Rico',
  'eventos.buscarNombre': 'Buscar por nombre',
  'eventos.municipio': 'Municipio:',
  'eventos.categoria': 'Categoría:',
  'eventos.ordenarPor': 'Ordenar por:',
  'eventos.todosMunicipios': 'Todos los municipios',
  'eventos.todasCategorias': 'Todas las categorías',
  'eventos.fechaAsc': 'Fecha (ascendente)',
  'eventos.fechaDesc': 'Fecha (descendente)',
  'eventos.alfabetico': 'Alfabético',
  'eventos.soloHoy': 'Solo hoy',
  'eventos.estaSemana': 'Esta semana',
  'eventos.gratis': 'Gratis',
  'eventos.loading': 'Cargando eventos...',
  'eventos.errorCargar': 'No pudimos cargar los eventos. Intenta nuevamente.',
  'eventos.reintentar': 'Reintentar',
  'evento.variasFechas': 'Varias Fechas Disponibles',
  'evento.sinFecha': 'Sin fecha',
  'evento.costoLabel': 'Costo: {costo}',
  'evento.costoNoDisponible': 'Costo no disponible',
  'evento.sinResultados': 'No se encontraron eventos para los filtros seleccionados.',
  'evento.variosMunicipios': 'Varias Localidades',
};

const EN: Dict = {
  'eventos.titulo': 'Events in Puerto Rico',
  'eventos.buscarNombre': 'Search by name',
  'eventos.municipio': 'Municipality:',
  'eventos.categoria': 'Category:',
  'eventos.ordenarPor': 'Sort by:',
  'eventos.todosMunicipios': 'All municipalities',
  'eventos.todasCategorias': 'All categories',
  'eventos.fechaAsc': 'Date (ascending)',
  'eventos.fechaDesc': 'Date (descending)',
  'eventos.alfabetico': 'Alphabetical',
  'eventos.soloHoy': 'Today only',
  'eventos.estaSemana': 'This week',
  'eventos.gratis': 'Free',
  'eventos.loading': 'Loading events...',
  'eventos.errorCargar': "We couldn't load the events. Please try again.",
  'eventos.reintentar': 'Retry',
  'evento.variasFechas': 'Multiple Dates Available',
  'evento.sinFecha': 'No date',
  'evento.costoLabel': 'Cost: {costo}',
  'evento.costoNoDisponible': 'Cost not available',
  'evento.sinResultados': 'No events found for the selected filters.',
  'evento.variosMunicipios': 'Multiple Venues',
};

const ZH: Dict = {
  'eventos.titulo': '波多黎各的活动',
  'eventos.buscarNombre': '按名称搜索',
  'eventos.municipio': '市镇：',
  'eventos.categoria': '类别：',
  'eventos.ordenarPor': '排序方式：',
  'eventos.todosMunicipios': '所有市镇',
  'eventos.todasCategorias': '所有类别',
  'eventos.fechaAsc': '日期（升序）',
  'eventos.fechaDesc': '日期（降序）',
  'eventos.alfabetico': '按字母顺序',
  'eventos.soloHoy': '仅今天',
  'eventos.estaSemana': '本周',
  'eventos.gratis': '免费',
  'eventos.loading': '加载活动中...',
  'eventos.errorCargar': '无法加载活动，请重试。',
  'eventos.reintentar': '重试',
  'evento.variasFechas': '多个可用日期',
  'evento.sinFecha': '无日期',
  'evento.costoLabel': '费用：{costo}',
  'evento.costoNoDisponible': '费用不可用',
  'evento.sinResultados': '未找到符合筛选条件的活动。',
  'evento.variosMunicipios': '多个场地',
};

const FR: Dict = {
  'eventos.titulo': 'Événements à Porto Rico',
  'eventos.buscarNombre': 'Rechercher par nom',
  'eventos.municipio': 'Municipalité :',
  'eventos.categoria': 'Catégorie :',
  'eventos.ordenarPor': 'Trier par :',
  'eventos.todosMunicipios': 'Toutes les municipalités',
  'eventos.todasCategorias': 'Toutes les catégories',
  'eventos.fechaAsc': 'Date (croissante)',
  'eventos.fechaDesc': 'Date (décroissante)',
  'eventos.alfabetico': 'Alphabétique',
  'eventos.soloHoy': "Aujourd'hui seulement",
  'eventos.estaSemana': 'Cette semaine',
  'eventos.gratis': 'Gratuit',
  'eventos.loading': 'Chargement des événements...',
  'eventos.errorCargar': 'Impossible de charger les événements. Réessayez.',
  'eventos.reintentar': 'Réessayer',
  'evento.variasFechas': 'Plusieurs dates disponibles',
  'evento.sinFecha': 'Sans date',
  'evento.costoLabel': 'Coût : {costo}',
  'evento.costoNoDisponible': 'Coût non disponible',
  'evento.sinResultados': 'Aucun événement trouvé pour les filtres sélectionnés.',
  'evento.variosMunicipios': 'Plusieurs lieux',
};

const PT: Dict = {
  'eventos.titulo': 'Eventos em Porto Rico',
  'eventos.buscarNombre': 'Buscar por nome',
  'eventos.municipio': 'Município:',
  'eventos.categoria': 'Categoria:',
  'eventos.ordenarPor': 'Ordenar por:',
  'eventos.todosMunicipios': 'Todos os municípios',
  'eventos.todasCategorias': 'Todas as categorias',
  'eventos.fechaAsc': 'Data (crescente)',
  'eventos.fechaDesc': 'Data (decrescente)',
  'eventos.alfabetico': 'Alfabético',
  'eventos.soloHoy': 'Somente hoje',
  'eventos.estaSemana': 'Esta semana',
  'eventos.gratis': 'Grátis',
  'eventos.loading': 'Carregando eventos...',
  'eventos.errorCargar': 'Não foi possível carregar os eventos. Tente novamente.',
  'eventos.reintentar': 'Tentar novamente',
  'evento.variasFechas': 'Várias datas disponíveis',
  'evento.sinFecha': 'Sem data',
  'evento.costoLabel': 'Custo: {costo}',
  'evento.costoNoDisponible': 'Custo não disponível',
  'evento.sinResultados': 'Nenhum evento encontrado para os filtros selecionados.',
  'evento.variosMunicipios': 'Várias localidades',
};

const DE: Dict = {
  'eventos.titulo': 'Veranstaltungen in Puerto Rico',
  'eventos.buscarNombre': 'Nach Name suchen',
  'eventos.municipio': 'Gemeinde:',
  'eventos.categoria': 'Kategorie:',
  'eventos.ordenarPor': 'Sortieren nach:',
  'eventos.todosMunicipios': 'Alle Gemeinden',
  'eventos.todasCategorias': 'Alle Kategorien',
  'eventos.fechaAsc': 'Datum (aufsteigend)',
  'eventos.fechaDesc': 'Datum (absteigend)',
  'eventos.alfabetico': 'Alphabetisch',
  'eventos.soloHoy': 'Nur heute',
  'eventos.estaSemana': 'Diese Woche',
  'eventos.gratis': 'Kostenlos',
  'eventos.loading': 'Veranstaltungen werden geladen...',
  'eventos.errorCargar': 'Die Veranstaltungen konnten nicht geladen werden. Bitte erneut versuchen.',
  'eventos.reintentar': 'Erneut versuchen',
  'evento.variasFechas': 'Mehrere Termine verfügbar',
  'evento.sinFecha': 'Kein Datum',
  'evento.costoLabel': 'Kosten: {costo}',
  'evento.costoNoDisponible': 'Kosten nicht verfügbar',
  'evento.sinResultados': 'Keine Veranstaltungen für die ausgewählten Filter gefunden.',
  'evento.variosMunicipios': 'Mehrere Orte',
};

const IT: Dict = {
  'eventos.titulo': 'Eventi a Porto Rico',
  'eventos.buscarNombre': 'Cerca per nome',
  'eventos.municipio': 'Comune:',
  'eventos.categoria': 'Categoria:',
  'eventos.ordenarPor': 'Ordina per:',
  'eventos.todosMunicipios': 'Tutti i comuni',
  'eventos.todasCategorias': 'Tutte le categorie',
  'eventos.fechaAsc': 'Data (crescente)',
  'eventos.fechaDesc': 'Data (decrescente)',
  'eventos.alfabetico': 'Alfabetico',
  'eventos.soloHoy': 'Solo oggi',
  'eventos.estaSemana': 'Questa settimana',
  'eventos.gratis': 'Gratis',
  'eventos.loading': 'Caricamento eventi...',
  'eventos.errorCargar': 'Impossibile caricare gli eventi. Riprova.',
  'eventos.reintentar': 'Riprova',
  'evento.variasFechas': 'Più date disponibili',
  'evento.sinFecha': 'Senza data',
  'evento.costoLabel': 'Costo: {costo}',
  'evento.costoNoDisponible': 'Costo non disponibile',
  'evento.sinResultados': 'Nessun evento trovato per i filtri selezionati.',
  'evento.variosMunicipios': 'Più sedi',
};

const KO: Dict = {
  'eventos.titulo': '푸에르토리코의 이벤트',
  'eventos.buscarNombre': '이름으로 검색',
  'eventos.municipio': '지역:',
  'eventos.categoria': '카테고리:',
  'eventos.ordenarPor': '정렬 기준:',
  'eventos.todosMunicipios': '모든 지역',
  'eventos.todasCategorias': '모든 카테고리',
  'eventos.fechaAsc': '날짜(오름차순)',
  'eventos.fechaDesc': '날짜(내림차순)',
  'eventos.alfabetico': '알파벳순',
  'eventos.soloHoy': '오늘만',
  'eventos.estaSemana': '이번 주',
  'eventos.gratis': '무료',
  'eventos.loading': '이벤트 불러오는 중...',
  'eventos.errorCargar': '이벤트를 불러올 수 없습니다. 다시 시도해주세요.',
  'eventos.reintentar': '다시 시도',
  'evento.variasFechas': '여러 날짜 가능',
  'evento.sinFecha': '날짜 없음',
  'evento.costoLabel': '비용: {costo}',
  'evento.costoNoDisponible': '비용 정보 없음',
  'evento.sinResultados': '선택한 필터에 대한 이벤트를 찾을 수 없습니다.',
  'evento.variosMunicipios': '여러 장소',
};

const JA: Dict = {
  'eventos.titulo': 'プエルトリコのイベント',
  'eventos.buscarNombre': '名前で検索',
  'eventos.municipio': '市町村：',
  'eventos.categoria': 'カテゴリー：',
  'eventos.ordenarPor': '並び替え：',
  'eventos.todosMunicipios': 'すべての市町村',
  'eventos.todasCategorias': 'すべてのカテゴリー',
  'eventos.fechaAsc': '日付（昇順）',
  'eventos.fechaDesc': '日付（降順）',
  'eventos.alfabetico': 'アルファベット順',
  'eventos.soloHoy': '今日のみ',
  'eventos.estaSemana': '今週',
  'eventos.gratis': '無料',
  'eventos.loading': 'イベントを読み込み中...',
  'eventos.errorCargar': 'イベントを読み込めませんでした。もう一度お試しください。',
  'eventos.reintentar': '再試行',
  'evento.variasFechas': '複数の日程あり',
  'evento.sinFecha': '日付なし',
  'evento.costoLabel': '料金：{costo}',
  'evento.costoNoDisponible': '料金情報なし',
  'evento.sinResultados': '選択したフィルターに該当するイベントはありません。',
  'evento.variosMunicipios': '複数の会場',
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

export function tEventos(key: EventosI18nKey, lang: string, params?: Record<string, string | number>): string {
  const code = normalizeLang(lang);
  const template = DICTS[code]?.[key] || ES[key] || key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params[token];
    return value == null ? '' : String(value);
  });
}

