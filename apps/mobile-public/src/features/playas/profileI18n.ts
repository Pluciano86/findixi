export type ProfilePlayaI18nKey =
  | 'perfilPlaya.titulo'
  | 'perfilPlaya.btnFavorito'
  | 'perfilPlaya.enFavoritos'
  | 'perfilPlaya.descripcion'
  | 'perfilPlaya.cargandoInfo'
  | 'perfilPlaya.acceso'
  | 'perfilPlaya.cercanosComida'
  | 'perfilPlaya.cercanosLugares'
  | 'perfilPlaya.playas45'
  | 'perfilPlaya.aptaPara'
  | 'perfilPlaya.distancia'
  | 'perfilPlaya.climaActualizando'
  | 'perfilPlaya.minLabel'
  | 'perfilPlaya.maxLabel'
  | 'perfilPlaya.viento'
  | 'perfilPlaya.humedad'
  | 'playa.descripcionNoDisponible'
  | 'playa.accesoNoDisponible'
  | 'perfilPlaya.direccionNoDisponible'
  | 'perfilPlaya.sinAptitudes';

type Dict = Record<ProfilePlayaI18nKey, string>;

const ES: Dict = {
  'perfilPlaya.titulo': 'Perfil de Playa',
  'perfilPlaya.btnFavorito': 'Añadir a favoritos',
  'perfilPlaya.enFavoritos': 'En favoritos',
  'perfilPlaya.descripcion': 'Descripcion',
  'perfilPlaya.cargandoInfo': 'Cargando información...',
  'perfilPlaya.acceso': 'Acceso',
  'perfilPlaya.cercanosComida': 'Lugares para comer a menos de 10 minutos de {nombre}',
  'perfilPlaya.cercanosLugares': 'Lugares de interes cerca de {nombre}',
  'perfilPlaya.playas45': 'Playas a menos de 45 minutos de {nombre}',
  'perfilPlaya.aptaPara': 'Playa apta para:',
  'perfilPlaya.distancia': 'Cargando distancia...',
  'perfilPlaya.climaActualizando': 'Actualizando...',
  'perfilPlaya.minLabel': 'Mínima',
  'perfilPlaya.maxLabel': 'Máxima',
  'perfilPlaya.viento': 'Viento',
  'perfilPlaya.humedad': 'Humedad',
  'playa.descripcionNoDisponible': 'Descripción no disponible.',
  'playa.accesoNoDisponible': 'Información de acceso no disponible.',
  'perfilPlaya.direccionNoDisponible': 'Dirección no disponible',
  'perfilPlaya.sinAptitudes': 'Sin aptitudes registradas',
};

const EN: Dict = {
  'perfilPlaya.titulo': 'Beach Profile',
  'perfilPlaya.btnFavorito': 'Add to favorites',
  'perfilPlaya.enFavoritos': 'In favorites',
  'perfilPlaya.descripcion': 'Description',
  'perfilPlaya.cargandoInfo': 'Loading information...',
  'perfilPlaya.acceso': 'Access',
  'perfilPlaya.cercanosComida': 'Places to eat within 10 minutes of {nombre}',
  'perfilPlaya.cercanosLugares': 'Points of interest near {nombre}',
  'perfilPlaya.playas45': 'Beaches within 45 minutes of {nombre}',
  'perfilPlaya.aptaPara': 'Beach suitable for:',
  'perfilPlaya.distancia': 'Calculating distance...',
  'perfilPlaya.climaActualizando': 'Updating...',
  'perfilPlaya.minLabel': 'Low',
  'perfilPlaya.maxLabel': 'High',
  'perfilPlaya.viento': 'Wind',
  'perfilPlaya.humedad': 'Humidity',
  'playa.descripcionNoDisponible': 'Description not available.',
  'playa.accesoNoDisponible': 'Access information not available.',
  'perfilPlaya.direccionNoDisponible': 'Address not available',
  'perfilPlaya.sinAptitudes': 'No beach activities listed',
};

const ZH: Dict = {
  'perfilPlaya.titulo': '海滩资料',
  'perfilPlaya.btnFavorito': '加入收藏',
  'perfilPlaya.enFavoritos': '已收藏',
  'perfilPlaya.descripcion': '介绍',
  'perfilPlaya.cargandoInfo': '正在加载信息...',
  'perfilPlaya.acceso': '访问',
  'perfilPlaya.cercanosComida': '{nombre} 附近10分钟内的用餐地点',
  'perfilPlaya.cercanosLugares': '{nombre} 附近的景点',
  'perfilPlaya.playas45': '{nombre} 附近45分钟内的海滩',
  'perfilPlaya.aptaPara': '适合于：',
  'perfilPlaya.distancia': '正在计算距离...',
  'perfilPlaya.climaActualizando': '更新中...',
  'perfilPlaya.minLabel': '最低',
  'perfilPlaya.maxLabel': '最高',
  'perfilPlaya.viento': '风速',
  'perfilPlaya.humedad': '湿度',
  'playa.descripcionNoDisponible': '暂无描述。',
  'playa.accesoNoDisponible': '暂无访问说明。',
  'perfilPlaya.direccionNoDisponible': '暂无地址',
  'perfilPlaya.sinAptitudes': '暂无适配活动',
};

const FR: Dict = {
  'perfilPlaya.titulo': 'Profil de plage',
  'perfilPlaya.btnFavorito': 'Ajouter aux favoris',
  'perfilPlaya.enFavoritos': 'Dans les favoris',
  'perfilPlaya.descripcion': 'Description',
  'perfilPlaya.cargandoInfo': 'Chargement des informations...',
  'perfilPlaya.acceso': 'Accès',
  'perfilPlaya.cercanosComida': 'Lieux pour manger à moins de 10 minutes de {nombre}',
  'perfilPlaya.cercanosLugares': "Lieux d’intérêt près de {nombre}",
  'perfilPlaya.playas45': 'Plages à moins de 45 minutes de {nombre}',
  'perfilPlaya.aptaPara': 'Plage adaptée pour :',
  'perfilPlaya.distancia': 'Calcul de la distance...',
  'perfilPlaya.climaActualizando': 'Mise à jour...',
  'perfilPlaya.minLabel': 'Min',
  'perfilPlaya.maxLabel': 'Max',
  'perfilPlaya.viento': 'Vent',
  'perfilPlaya.humedad': 'Humidité',
  'playa.descripcionNoDisponible': 'Description non disponible.',
  'playa.accesoNoDisponible': "Informations d'accès non disponibles.",
  'perfilPlaya.direccionNoDisponible': 'Adresse non disponible',
  'perfilPlaya.sinAptitudes': 'Aucune aptitude enregistrée',
};

const PT: Dict = {
  'perfilPlaya.titulo': 'Perfil da praia',
  'perfilPlaya.btnFavorito': 'Adicionar aos favoritos',
  'perfilPlaya.enFavoritos': 'Nos favoritos',
  'perfilPlaya.descripcion': 'Descrição',
  'perfilPlaya.cargandoInfo': 'Carregando informações...',
  'perfilPlaya.acceso': 'Acesso',
  'perfilPlaya.cercanosComida': 'Lugares para comer a menos de 10 minutos de {nombre}',
  'perfilPlaya.cercanosLugares': 'Lugares de interesse perto de {nombre}',
  'perfilPlaya.playas45': 'Praias a menos de 45 minutos de {nombre}',
  'perfilPlaya.aptaPara': 'Praia adequada para:',
  'perfilPlaya.distancia': 'Calculando distância...',
  'perfilPlaya.climaActualizando': 'Atualizando...',
  'perfilPlaya.minLabel': 'Mín',
  'perfilPlaya.maxLabel': 'Máx',
  'perfilPlaya.viento': 'Vento',
  'perfilPlaya.humedad': 'Umidade',
  'playa.descripcionNoDisponible': 'Descrição não disponível.',
  'playa.accesoNoDisponible': 'Informações de acesso não disponíveis.',
  'perfilPlaya.direccionNoDisponible': 'Endereço não disponível',
  'perfilPlaya.sinAptitudes': 'Sem aptidões registradas',
};

const DE: Dict = {
  'perfilPlaya.titulo': 'Strandprofil',
  'perfilPlaya.btnFavorito': 'Zu Favoriten hinzufügen',
  'perfilPlaya.enFavoritos': 'In Favoriten',
  'perfilPlaya.descripcion': 'Beschreibung',
  'perfilPlaya.cargandoInfo': 'Informationen werden geladen...',
  'perfilPlaya.acceso': 'Zugang',
  'perfilPlaya.cercanosComida': 'Essensmöglichkeiten in weniger als 10 Minuten von {nombre}',
  'perfilPlaya.cercanosLugares': 'Sehenswürdigkeiten in der Nähe von {nombre}',
  'perfilPlaya.playas45': 'Strände in weniger als 45 Minuten von {nombre}',
  'perfilPlaya.aptaPara': 'Strand geeignet für:',
  'perfilPlaya.distancia': 'Distanz wird berechnet...',
  'perfilPlaya.climaActualizando': 'Aktualisieren...',
  'perfilPlaya.minLabel': 'Min',
  'perfilPlaya.maxLabel': 'Max',
  'perfilPlaya.viento': 'Wind',
  'perfilPlaya.humedad': 'Luftfeuchtigkeit',
  'playa.descripcionNoDisponible': 'Beschreibung nicht verfügbar.',
  'playa.accesoNoDisponible': 'Zugangsinformationen nicht verfügbar.',
  'perfilPlaya.direccionNoDisponible': 'Adresse nicht verfügbar',
  'perfilPlaya.sinAptitudes': 'Keine Aktivitäten angegeben',
};

const IT: Dict = {
  'perfilPlaya.titulo': 'Profilo spiaggia',
  'perfilPlaya.btnFavorito': 'Aggiungi ai preferiti',
  'perfilPlaya.enFavoritos': 'Nei preferiti',
  'perfilPlaya.descripcion': 'Descrizione',
  'perfilPlaya.cargandoInfo': 'Caricamento informazioni...',
  'perfilPlaya.acceso': 'Accesso',
  'perfilPlaya.cercanosComida': 'Luoghi dove mangiare a meno di 10 minuti da {nombre}',
  'perfilPlaya.cercanosLugares': 'Luoghi di interesse vicino a {nombre}',
  'perfilPlaya.playas45': 'Spiagge a meno di 45 minuti da {nombre}',
  'perfilPlaya.aptaPara': 'Spiaggia adatta per:',
  'perfilPlaya.distancia': 'Calcolo distanza...',
  'perfilPlaya.climaActualizando': 'Aggiornamento...',
  'perfilPlaya.minLabel': 'Min',
  'perfilPlaya.maxLabel': 'Max',
  'perfilPlaya.viento': 'Vento',
  'perfilPlaya.humedad': 'Umidità',
  'playa.descripcionNoDisponible': 'Descrizione non disponibile.',
  'playa.accesoNoDisponible': 'Informazioni di accesso non disponibili.',
  'perfilPlaya.direccionNoDisponible': 'Indirizzo non disponibile',
  'perfilPlaya.sinAptitudes': 'Nessuna attività registrata',
};

const KO: Dict = {
  'perfilPlaya.titulo': '해변 프로필',
  'perfilPlaya.btnFavorito': '즐겨찾기에 추가',
  'perfilPlaya.enFavoritos': '즐겨찾기',
  'perfilPlaya.descripcion': '설명',
  'perfilPlaya.cargandoInfo': '정보 불러오는 중...',
  'perfilPlaya.acceso': '접근',
  'perfilPlaya.cercanosComida': '{nombre} 인근 10분 내 식사 장소',
  'perfilPlaya.cercanosLugares': '{nombre} 인근 명소',
  'perfilPlaya.playas45': '{nombre} 인근 45분 내 해변',
  'perfilPlaya.aptaPara': '해변 적합 활동:',
  'perfilPlaya.distancia': '거리 계산 중...',
  'perfilPlaya.climaActualizando': '업데이트 중...',
  'perfilPlaya.minLabel': '최저',
  'perfilPlaya.maxLabel': '최고',
  'perfilPlaya.viento': '바람',
  'perfilPlaya.humedad': '습도',
  'playa.descripcionNoDisponible': '설명 없음.',
  'playa.accesoNoDisponible': '접근 정보 없음.',
  'perfilPlaya.direccionNoDisponible': '주소 없음',
  'perfilPlaya.sinAptitudes': '등록된 활동 없음',
};

const JA: Dict = {
  'perfilPlaya.titulo': 'ビーチのプロフィール',
  'perfilPlaya.btnFavorito': 'お気に入りに追加',
  'perfilPlaya.enFavoritos': 'お気に入り',
  'perfilPlaya.descripcion': '説明',
  'perfilPlaya.cargandoInfo': '情報を読み込み中...',
  'perfilPlaya.acceso': 'アクセス',
  'perfilPlaya.cercanosComida': '{nombre} から10分以内の食事スポット',
  'perfilPlaya.cercanosLugares': '{nombre} の近くの見どころ',
  'perfilPlaya.playas45': '{nombre} から45分以内のビーチ',
  'perfilPlaya.aptaPara': 'このビーチが適する目的：',
  'perfilPlaya.distancia': '距離を計算中...',
  'perfilPlaya.climaActualizando': '更新中...',
  'perfilPlaya.minLabel': '最低',
  'perfilPlaya.maxLabel': '最高',
  'perfilPlaya.viento': '風',
  'perfilPlaya.humedad': '湿度',
  'playa.descripcionNoDisponible': '説明はありません。',
  'playa.accesoNoDisponible': 'アクセス情報はありません。',
  'perfilPlaya.direccionNoDisponible': '住所はありません',
  'perfilPlaya.sinAptitudes': '利用可能な活動なし',
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

export function tPerfilPlaya(key: ProfilePlayaI18nKey, lang: string, params?: Record<string, string | number>): string {
  const code = normalizeLang(lang);
  const template = DICTS[code]?.[key] || ES[key] || key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params[token];
    return value == null ? '' : String(value);
  });
}
