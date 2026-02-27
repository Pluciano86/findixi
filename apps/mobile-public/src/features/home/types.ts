import type { LanguageCode } from '../../i18n/languages';

export type LocalizedLabelMap = Partial<Record<LanguageCode, string>>;

export type HomeBannerItem = {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  idComercio: number | null;
  externalUrl: string | null;
};

export type HomeCategoryItem = {
  id: number;
  labels: LocalizedLabelMap;
  fallbackLabel: string;
  imageUrl: string;
  colorHex: string | null;
  iconName: string | null;
};

export type HomeComercioCard = {
  id: number;
  nombre: string;
  municipio: string;
  coverUrl: string;
  logoUrl: string;
};

export type HomeEventoCard = {
  id: number;
  nombre: string;
  descripcion: string;
  imageUrl: string;
  lugar: string;
};

export type HomeAreaCard = {
  idArea: number;
  slug: string;
  labels: LocalizedLabelMap;
  fallbackLabel: string;
  imageUrl: string;
};

export type HomeIndexData = {
  topBanners: HomeBannerItem[];
  categories: HomeCategoryItem[];
  comidaCards: HomeComercioCard[];
  jangueoCards: HomeComercioCard[];
  eventos: HomeEventoCard[];
  areas: HomeAreaCard[];
};
