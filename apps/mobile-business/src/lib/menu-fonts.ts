export type MenuFontOption = {
  name: string;
  url: string;
  category: string;
};

// Same curated catalog used in web admin/comercio menu customization.
export const MENU_FONTS: MenuFontOption[] = [
  { name: 'Kanit', url: 'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap', category: 'Sans' },
  { name: 'Poppins', url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap', category: 'Sans' },
  { name: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap', category: 'Sans' },
  { name: 'Montserrat', url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700&display=swap', category: 'Sans' },
  { name: 'Roboto', url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap', category: 'Sans' },
  { name: 'Nunito', url: 'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700&display=swap', category: 'Sans' },
  { name: 'Mulish', url: 'https://fonts.googleapis.com/css2?family=Mulish:wght@300;400;600;700&display=swap', category: 'Sans' },
  { name: 'Source Sans Pro', url: 'https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600;700&display=swap', category: 'Sans' },
  { name: 'Open Sans', url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap', category: 'Sans' },
  { name: 'Work Sans', url: 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;600;700&display=swap', category: 'Sans' },
  { name: 'Playfair Display', url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap', category: 'Classic/Serif' },
  { name: 'Merriweather', url: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap', category: 'Classic/Serif' },
  { name: 'Libre Baskerville', url: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&display=swap', category: 'Classic/Serif' },
  { name: 'Cormorant Garamond', url: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&display=swap', category: 'Classic/Serif' },
  { name: 'Dancing Script', url: 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600;700&display=swap', category: 'Handwrite' },
  { name: 'Pacifico', url: 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap', category: 'Handwrite' },
  { name: 'Caveat', url: 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&display=swap', category: 'Handwrite' },
  { name: 'Great Vibes', url: 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap', category: 'Handwrite' },
  { name: 'Bebas Neue', url: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap', category: 'Display' },
  { name: 'Oswald', url: 'https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;600&display=swap', category: 'Display' },
  { name: 'Anton', url: 'https://fonts.googleapis.com/css2?family=Anton&display=swap', category: 'Display' },
  { name: 'Fjalla One', url: 'https://fonts.googleapis.com/css2?family=Fjalla+One&display=swap', category: 'Display' },
];

const FONT_LOOKUP = new Map<string, MenuFontOption>(
  MENU_FONTS.map((font) => [normalizeFontKey(font.name), font])
);

const NATIVE_FONT_FAMILY = new Map<string, string>([
  ['kanit', 'Kanit_400Regular'],
  ['poppins', 'Poppins_400Regular'],
  ['inter', 'Inter_400Regular'],
  ['montserrat', 'Montserrat_400Regular'],
  ['roboto', 'Roboto_400Regular'],
  ['nunito', 'Nunito_400Regular'],
  ['mulish', 'Mulish_400Regular'],
  ['source sans pro', 'SourceSansPro_400Regular'],
  ['open sans', 'OpenSans_400Regular'],
  ['work sans', 'WorkSans_400Regular'],
  ['playfair display', 'PlayfairDisplay_400Regular'],
  ['merriweather', 'Merriweather_400Regular'],
  ['libre baskerville', 'LibreBaskerville_400Regular'],
  ['cormorant garamond', 'CormorantGaramond_400Regular'],
  ['dancing script', 'DancingScript_400Regular'],
  ['pacifico', 'Pacifico_400Regular'],
  ['caveat', 'Caveat_400Regular'],
  ['great vibes', 'GreatVibes_400Regular'],
  ['bebas neue', 'BebasNeue_400Regular'],
  ['oswald', 'Oswald_400Regular'],
  ['anton', 'Anton_400Regular'],
  ['fjalla one', 'FjallaOne_400Regular'],
]);

const GENERIC_FONT_KEYS = new Set(['sans-serif', 'serif', 'system-ui', 'inherit', 'default']);

function normalizeFontKey(value: string): string {
  return String(value || '')
    .replace(/['"]/g, '')
    .replace(/\+/g, ' ')
    .replace(/_/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function extractPrimaryFont(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const primary = raw.split(',')[0] || raw;
  return normalizeFontKey(primary);
}

export function findMenuFontByName(value: string | null | undefined): MenuFontOption | null {
  const key = extractPrimaryFont(String(value || ''));
  if (!key || GENERIC_FONT_KEYS.has(key)) return null;
  return FONT_LOOKUP.get(key) || null;
}

export function resolveNativeMenuFontFamily(value: string | null | undefined): string | undefined {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  if (/_[0-9]{3}(Regular|Light|Medium|SemiBold|Bold)(?:_Italic)?$/i.test(raw)) return raw;

  const key = extractPrimaryFont(raw);
  if (!key || GENERIC_FONT_KEYS.has(key)) return undefined;

  const direct = NATIVE_FONT_FAMILY.get(key);
  if (direct) return direct;

  const match = findMenuFontByName(raw);
  if (!match) return undefined;
  return NATIVE_FONT_FAMILY.get(normalizeFontKey(match.name));
}
