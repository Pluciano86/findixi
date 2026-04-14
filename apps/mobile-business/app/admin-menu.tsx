import { DEFAULT_APP_BASE_URLS } from '@findixi/shared';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  processColor,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BusinessChrome, type FooterItem } from '../src/components/BusinessChrome';
import { ScreenState } from '../src/components/ScreenState';
import { getSessionOrReset } from '../src/lib/auth-session';
import {
  deleteMenuProduct,
  fetchMenuAdminContext,
  getCloverOauthStartUrl,
  reorderMenuSections,
  runCloverImport,
  saveMenuProduct,
  saveMenuSection,
  saveMenuTheme,
  uploadMenuThemeImage,
  type MenuAdminContext,
  type MenuProduct,
  type MenuSection,
  type MenuTheme,
} from '../src/lib/business-menu-admin';
import { findMenuFontByName, MENU_FONTS, resolveNativeMenuFontFamily, type MenuFontOption } from '../src/lib/menu-fonts';
import { fetchBusinessAccessByUser, type BusinessProfile } from '../src/lib/business-profile';
import { borderRadius, fonts, primaryBlue, primaryOrange, shadows, spacing } from '../src/theme/tokens';

const LOGO_PLACEHOLDER = 'https://placehold.co/160x160?text=Logo';

type SectionFormState = {
  titulo: string;
  subtitulo: string;
  descripcion: string;
  orden: string;
  activo: boolean;
  noTraducir: boolean;
};

type ProductFormState = {
  nombre: string;
  descripcion: string;
  precio: string;
  orden: string;
  activo: boolean;
  noTraducirNombre: boolean;
};

function buildWebUrl(path: string, idComercio: number): string {
  return `${DEFAULT_APP_BASE_URLS.comercio}${path}?id=${idComercio}`;
}

function createSectionForm(sectionCount = 0): SectionFormState {
  return {
    titulo: '',
    subtitulo: '',
    descripcion: '',
    orden: String(sectionCount + 1),
    activo: true,
    noTraducir: false,
  };
}

function createProductForm(productCount = 0): ProductFormState {
  return {
    nombre: '',
    descripcion: '',
    precio: '',
    orden: String(productCount + 1),
    activo: true,
    noTraducirNombre: false,
  };
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '$0.00';
  return `$${value.toFixed(2)}`;
}

function sanitizeColor(value: string, fallback: string): string {
  const clean = String(value || '').trim();
  return clean || fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolvePreviewColor(value: string | null | undefined, fallback: string): string {
  const candidate = sanitizeColor(String(value || ''), fallback);
  try {
    return processColor(candidate) == null ? fallback : candidate;
  } catch {
    return fallback;
  }
}

function resolveThemeAssetUrl(pathOrUrl: string): string {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${raw}`;
}

type MenuThemeFontFamilyKey =
  | 'fontbodyfamily'
  | 'fonttitlefamily'
  | 'fontnombrefamily'
  | 'fontmenuwordfamily'
  | 'seccion_desc_font_family';
type MenuThemeFontUrlKey =
  | 'fontbodyurl'
  | 'fonttitleurl'
  | 'fontnombreurl'
  | 'fontmenuwordurl'
  | 'seccion_desc_font_url';
type HeaderTextTarget = 'nombre' | 'menu';
type ContentStyleTarget = 'title' | 'product' | 'item';
type FontPickerTarget = HeaderTextTarget | 'title' | 'product';
type ColorPickerField = 'text' | 'stroke' | 'shadow' | 'title' | 'productText' | 'productPrice' | 'itemBg';

const COLOR_PRESETS = ['#ffffff', '#111827', '#2563eb', '#22c55e', '#f97316', '#facc15', '#ec4899', '#06b6d4'];

type ParsedShadow = {
  offsetY: number;
  blur: number;
  color: string;
};

function parseShadowValue(value: string | null | undefined, fallbackColor = '#00000080'): ParsedShadow {
  const raw = String(value || '').trim();
  if (!raw) {
    return { offsetY: 0, blur: 0, color: fallbackColor };
  }

  const colorMatch = raw.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g);
  const color = colorMatch?.[colorMatch.length - 1] || fallbackColor;
  const offsets = raw.replace(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/g, '').trim().split(/\s+/);
  const offsetY = Number.parseFloat((offsets[1] || '0').replace('px', '')) || 0;
  const blur = Number.parseFloat((offsets[2] || '0').replace('px', '')) || 0;

  return {
    offsetY: clampNumber(offsetY, 0, 24),
    blur: clampNumber(blur, 0, 30),
    color,
  };
}

function buildShadowValue(intensity: number, color: string): string {
  const safe = clampNumber(Number(intensity) || 0, 0, 30);
  if (safe <= 0) return '';
  const offsetY = clampNumber(Math.round(safe * 0.45), 0, 24);
  const blur = clampNumber(Math.round(safe), 0, 30);
  return `0 ${offsetY}px ${blur}px ${color}`;
}

function buildStrokeOffsets(width: number): Array<{ x: number; y: number }> {
  const radius = clampNumber(Math.round(width), 0, 8);
  if (radius <= 0) return [];

  const offsets: Array<{ x: number; y: number }> = [];
  for (let x = -radius; x <= radius; x += 1) {
    for (let y = -radius; y <= radius; y += 1) {
      if (x === 0 && y === 0) continue;
      if (Math.hypot(x, y) <= radius + 0.25) {
        offsets.push({ x, y });
      }
    }
  }
  return offsets;
}

type RgbColor = { r: number; g: number; b: number };

function normalizeHexColor(value: string, fallback = '#ffffff'): string {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  const full = withHash.length === 4 ? `#${withHash[1]}${withHash[1]}${withHash[2]}${withHash[2]}${withHash[3]}${withHash[3]}` : withHash;
  const ok = /^#[0-9a-fA-F]{6}$/.test(full);
  return ok ? full.toLowerCase() : fallback;
}

function hexToRgb(value: string): RgbColor {
  const safe = normalizeHexColor(value, '#ffffff').replace('#', '');
  return {
    r: Number.parseInt(safe.slice(0, 2), 16),
    g: Number.parseInt(safe.slice(2, 4), 16),
    b: Number.parseInt(safe.slice(4, 6), 16),
  };
}

function rgbToHex(rgb: RgbColor): string {
  const part = (value: number) => clampNumber(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`;
}

type OutlinedPreviewTextProps = {
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string | null | undefined;
  strokeWidth: number;
  strokeColor: string;
  shadow: ParsedShadow;
  numberOfLines?: number;
};

function OutlinedPreviewText({
  text,
  color,
  fontSize,
  fontFamily,
  strokeWidth,
  strokeColor,
  shadow,
  numberOfLines = 1,
}: OutlinedPreviewTextProps) {
  const offsets = buildStrokeOffsets(strokeWidth);
  const safeText = text || '';
  return (
    <View style={styles.outlinedWrap}>
      {offsets.map((offset, index) => (
        <Text
          key={`${offset.x}-${offset.y}-${index}`}
          numberOfLines={numberOfLines}
          style={[
            styles.outlinedLayer,
            {
              color: strokeColor,
              fontSize,
              transform: [{ translateX: offset.x }, { translateY: offset.y }],
              fontFamily: fontFamily || undefined,
            },
          ]}
        >
          {safeText}
        </Text>
      ))}
      <Text
        numberOfLines={numberOfLines}
        style={[
          styles.outlinedMain,
          {
            color,
            fontSize,
            fontFamily: fontFamily || undefined,
            textShadowColor: shadow.color,
            textShadowRadius: shadow.blur,
            textShadowOffset: {
              width: 0,
              height: shadow.offsetY,
            },
          },
        ]}
      >
        {safeText}
      </Text>
    </View>
  );
}

export default function BusinessAdminMenuScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ idComercio?: string }>();
  const targetComercioId = Number(params.idComercio || 0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [idComercio, setIdComercio] = useState(0);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [context, setContext] = useState<MenuAdminContext | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});

  const [sectionModalVisible, setSectionModalVisible] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [sectionForm, setSectionForm] = useState<SectionFormState>(createSectionForm(0));
  const [savingSection, setSavingSection] = useState(false);

  const [productModalVisible, setProductModalVisible] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<number>(0);
  const [productForm, setProductForm] = useState<ProductFormState>(createProductForm(0));
  const [savingProduct, setSavingProduct] = useState(false);

  const [syncingClover, setSyncingClover] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [themeForm, setThemeForm] = useState<MenuTheme | null>(null);
  const [savingTheme, setSavingTheme] = useState(false);
  const [uploadingPortada, setUploadingPortada] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [activeHeaderEditor, setActiveHeaderEditor] = useState<HeaderTextTarget>('nombre');
  const [openHeaderEditor, setOpenHeaderEditor] = useState<HeaderTextTarget | null>(null);
  const [activeContentEditor, setActiveContentEditor] = useState<ContentStyleTarget>('title');
  const [openContentEditor, setOpenContentEditor] = useState<ContentStyleTarget | null>(null);
  const [fontPickerTarget, setFontPickerTarget] = useState<FontPickerTarget | null>(null);
  const [showAdvancedTheme, setShowAdvancedTheme] = useState(false);
  const [colorPickerField, setColorPickerField] = useState<ColorPickerField | null>(null);
  const [colorPickerRgb, setColorPickerRgb] = useState<RgbColor>({ r: 255, g: 255, b: 255 });
  const [colorPickerHex, setColorPickerHex] = useState('#ffffff');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const session = await getSessionOrReset();
      if (!session?.user) {
        setProfile(null);
        setIdComercio(0);
        setAssignmentCount(0);
        setContext(null);
        router.replace('/login');
        return;
      }

      const access = await fetchBusinessAccessByUser(session.user.id);
      setAssignmentCount(access.assignmentCount);

      const selectedComercio =
        Number.isFinite(targetComercioId) && targetComercioId > 0
          ? access.comercios.find((entry) => entry.idComercio === targetComercioId) || null
          : null;

      const selectedProfile = selectedComercio?.profile || access.profile;
      const comercioId = Number(selectedComercio?.idComercio || access.primaryComercioId || selectedProfile?.id || 0);

      setProfile(selectedProfile);
      setIdComercio(comercioId);

      if (!selectedProfile || !comercioId) {
        setContext(null);
        setThemeForm(null);
        return;
      }

      const menuContext = await fetchMenuAdminContext(comercioId);
      setContext(menuContext);
      setThemeForm(menuContext.menuTheme);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'No se pudo cargar Admin Menú.';
      setError(message);
      setContext(null);
      setThemeForm(null);
    } finally {
      setLoading(false);
    }
  }, [router, targetComercioId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      return undefined;
    }, [loadData])
  );

  const sectionCount = context?.sections.length || 0;
  const productCount = (context?.sections || []).reduce((acc, section) => acc + section.productos.length, 0);
  const previewBannerUrl = themeForm?.portadaimagen ? resolveThemeAssetUrl(themeForm.portadaimagen) : '';
  const previewBackgroundUrl = themeForm?.backgroundimagen ? resolveThemeAssetUrl(themeForm.backgroundimagen) : '';
  const previewBackgroundColor = resolvePreviewColor(themeForm?.backgroundcolor, '#0f172a');
  const previewNameColor = resolvePreviewColor(themeForm?.colorComercio, '#ffffff');
  const previewMenuColor = resolvePreviewColor(themeForm?.colorMenu, '#ffffff');
  const previewTitleColor = resolvePreviewColor(themeForm?.colortitulo, '#0f172a');
  const previewTextColor = resolvePreviewColor(themeForm?.colortexto, '#334155');
  const previewButtonColor = resolvePreviewColor(themeForm?.colorboton, primaryOrange);
  const previewButtonTextColor = resolvePreviewColor(themeForm?.colorbotontexto, '#ffffff');
  const previewSectionDescColor = resolvePreviewColor(themeForm?.seccion_desc_color, previewTextColor);
  const previewItemBgColor = resolvePreviewColor(themeForm?.item_bg_color, '#ffffff');
  const previewPriceColor = resolvePreviewColor(themeForm?.colorprecio, '#2563eb');
  const previewItemBorderColor = `rgba(15, 23, 42, ${0.08 + clampNumber(Number(themeForm?.item_overlay || 0), 0, 80) / 220})`;
  const previewOverlayOpacity = clampNumber(Number(themeForm?.overlayoscuro || 0), 0, 80) / 100;
  const previewNombreFontFamily = resolveNativeMenuFontFamily(themeForm?.fontnombrefamily);
  const previewMenuFontFamily = resolveNativeMenuFontFamily(themeForm?.fontmenuwordfamily);
  const previewTitleFontFamily = resolveNativeMenuFontFamily(themeForm?.fonttitlefamily);
  const previewBodyFontFamily = resolveNativeMenuFontFamily(themeForm?.fontbodyfamily);
  const previewSectionDescFontFamily = resolveNativeMenuFontFamily(themeForm?.seccion_desc_font_family);
  const selectedNombreFont =
    findMenuFontByName(themeForm?.fontnombrefamily)?.name || String(themeForm?.fontnombrefamily || '').trim() || 'Default';
  const selectedMenuFont =
    findMenuFontByName(themeForm?.fontmenuwordfamily)?.name || String(themeForm?.fontmenuwordfamily || '').trim() || 'Default';
  const selectedTitleFont =
    findMenuFontByName(themeForm?.fonttitlefamily)?.name || String(themeForm?.fonttitlefamily || '').trim() || 'Default';
  const selectedBodyFont =
    findMenuFontByName(themeForm?.fontbodyfamily)?.name || String(themeForm?.fontbodyfamily || '').trim() || 'Default';
  const previewNombreShadow = parseShadowValue(themeForm?.nombre_shadow);
  const previewMenuShadow = parseShadowValue(themeForm?.menu_shadow);
  const previewNombreStrokeColor = resolvePreviewColor(themeForm?.nombre_stroke_color, '#000000');
  const previewMenuStrokeColor = resolvePreviewColor(themeForm?.menu_stroke_color, '#000000');
  const activeEditorIsNombre = activeHeaderEditor === 'nombre';
  const activeEditorTitle = activeEditorIsNombre ? 'Nombre del comercio' : 'Palabra Menú';
  const activeTextColorInput = activeEditorIsNombre ? themeForm?.colorComercio || '' : themeForm?.colorMenu || '';
  const activeTextColor = activeEditorIsNombre ? previewNameColor : previewMenuColor;
  const activeFontName = activeEditorIsNombre ? selectedNombreFont : selectedMenuFont;
  const activeFontSize = activeEditorIsNombre
    ? clampNumber(Number(themeForm?.nombre_font_size || 28), 10, 100)
    : clampNumber(Number(themeForm?.menu_font_size || 20), 10, 80);
  const activeStrokeWidth = activeEditorIsNombre
    ? clampNumber(Number(themeForm?.nombre_stroke_width || 0), 0, 8)
    : clampNumber(Number(themeForm?.menu_stroke_width || 0), 0, 8);
  const activeStrokeColorInput = activeEditorIsNombre ? themeForm?.nombre_stroke_color || '' : themeForm?.menu_stroke_color || '';
  const activeStrokeColor = activeEditorIsNombre ? previewNombreStrokeColor : previewMenuStrokeColor;
  const activeShadow = activeEditorIsNombre ? previewNombreShadow : previewMenuShadow;
  const activeShadowIntensity = clampNumber(activeShadow.blur, 0, 30);
  const editorVisible = openHeaderEditor != null;
  const contentEditorVisible = openContentEditor != null;
  const activeContentEditorTitle =
    activeContentEditor === 'title' ? 'Título de sección' : activeContentEditor === 'product' ? 'Productos' : 'Cuadro del ítem';
  const activeContentFontName = activeContentEditor === 'title' ? selectedTitleFont : selectedBodyFont;
  const activeContentFontSize = clampNumber(
    Number(activeContentEditor === 'title' ? themeForm?.fonttitle_size : themeForm?.fontbody_size),
    10,
    80
  );

  const footerItems = useMemo<FooterItem[]>(() => {
    return [
      {
        key: 'edit-profile',
        label: 'Editar Perfil',
        onPress: () => router.push((idComercio ? `/perfil?idComercio=${idComercio}` : '/perfil') as never),
      },
      {
        key: 'stats',
        label: 'Estadisticas',
        onPress: () => router.push((idComercio ? `/estadisticas?idComercio=${idComercio}` : '/estadisticas') as never),
      },
      {
        key: 'menu',
        label: 'Admin Menu',
        onPress: () => router.push((idComercio ? `/admin-menu?idComercio=${idComercio}` : '/admin-menu') as never),
        active: true,
      },
      {
        key: 'specials',
        label: 'Especiales',
        onPress: () => {
          if (!idComercio) return;
          void Linking.openURL(buildWebUrl('/especiales/adminEspeciales.html', idComercio));
        },
      },
      {
        key: 'promo',
        label: 'Promocionar',
        onPress: () => {
          if (!idComercio) return;
          void Linking.openURL(buildWebUrl('/paquetes.html', idComercio));
        },
      },
      {
        key: 'account',
        label: 'Editar cuenta',
        onPress: () => {
          if (!idComercio) return;
          void Linking.openURL(buildWebUrl('/editarPerfilComercio.html', idComercio));
        },
      },
    ];
  }, [idComercio, router]);

  const openCreateSection = useCallback(() => {
    setEditingSectionId(null);
    setSectionForm(createSectionForm(sectionCount));
    setSectionModalVisible(true);
  }, [sectionCount]);

  const openEditSection = useCallback((section: MenuSection) => {
    setEditingSectionId(section.id);
    setSectionForm({
      titulo: section.titulo,
      subtitulo: section.subtitulo,
      descripcion: section.descripcion,
      orden: String(section.orden || 1),
      activo: section.activo,
      noTraducir: section.noTraducir,
    });
    setSectionModalVisible(true);
  }, []);

  const onSaveSection = useCallback(async () => {
    if (!context) return;

    setSavingSection(true);
    try {
      await saveMenuSection(
        context.idComercio,
        {
          titulo: sectionForm.titulo,
          subtitulo: sectionForm.subtitulo,
          descripcion: sectionForm.descripcion,
          orden: Math.max(1, Number.parseInt(sectionForm.orden || '1', 10) || 1),
          activo: sectionForm.activo,
          noTraducir: sectionForm.noTraducir,
        },
        editingSectionId
      );
      setSectionModalVisible(false);
      await loadData();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'No se pudo guardar la sección.';
      Alert.alert('Admin Menú', message);
    } finally {
      setSavingSection(false);
    }
  }, [context, editingSectionId, loadData, sectionForm]);

  const openCreateProduct = useCallback((section: MenuSection) => {
    setEditingProductId(null);
    setActiveSectionId(section.id);
    setProductForm(createProductForm(section.productos.length));
    setProductModalVisible(true);
  }, []);

  const openEditProduct = useCallback((sectionId: number, product: MenuProduct) => {
    setEditingProductId(product.id);
    setActiveSectionId(sectionId);
    setProductForm({
      nombre: product.nombre,
      descripcion: product.descripcion,
      precio: String(product.precio),
      orden: String(product.orden || 1),
      activo: product.activo,
      noTraducirNombre: product.noTraducirNombre,
    });
    setProductModalVisible(true);
  }, []);

  const onSaveProduct = useCallback(async () => {
    if (!context || !activeSectionId) return;

    const parsedPrice = Number.parseFloat((productForm.precio || '').replace(',', '.'));

    setSavingProduct(true);
    try {
      await saveMenuProduct(
        activeSectionId,
        {
          nombre: productForm.nombre,
          descripcion: productForm.descripcion,
          precio: parsedPrice,
          orden: Math.max(1, Number.parseInt(productForm.orden || '1', 10) || 1),
          activo: productForm.activo,
          noTraducirNombre: productForm.noTraducirNombre,
        },
        editingProductId
      );
      setProductModalVisible(false);
      await loadData();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'No se pudo guardar el producto.';
      Alert.alert('Admin Menú', message);
    } finally {
      setSavingProduct(false);
    }
  }, [activeSectionId, context, editingProductId, loadData, productForm]);

  const onDeleteProduct = useCallback(
    (product: MenuProduct) => {
      Alert.alert('Eliminar producto', `¿Deseas eliminar "${product.nombre || 'este producto'}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteMenuProduct(product.id, product.imagen);
                await loadData();
              } catch (deleteError) {
                const message = deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el producto.';
                Alert.alert('Admin Menú', message);
              }
            })();
          },
        },
      ]);
    },
    [loadData]
  );

  const onToggleSection = useCallback((id: number) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const onMoveSection = useCallback(
    async (sectionId: number, direction: 'up' | 'down') => {
      if (!context) return;

      const ordered = [...context.sections].sort((a, b) => a.orden - b.orden);
      const currentIndex = ordered.findIndex((section) => section.id === sectionId);
      if (currentIndex < 0) return;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= ordered.length) return;

      const copy = [...ordered];
      const temp = copy[currentIndex];
      copy[currentIndex] = copy[targetIndex];
      copy[targetIndex] = temp;

      const updates = copy.map((section, index) => ({
        id: section.id,
        orden: index + 1,
      }));

      setSavingOrder(true);
      try {
        await reorderMenuSections(updates);
        await loadData();
      } catch (orderError) {
        const message = orderError instanceof Error ? orderError.message : 'No se pudo actualizar el orden.';
        Alert.alert('Admin Menú', message);
      } finally {
        setSavingOrder(false);
      }
    },
    [context, loadData]
  );

  const onCloverConnect = useCallback(() => {
    if (!context) return;
    void Linking.openURL(getCloverOauthStartUrl(context.idComercio));
  }, [context]);

  const onCloverSync = useCallback(async () => {
    if (!context) return;

    setSyncingClover(true);
    try {
      const result = await runCloverImport(context.idComercio);
      Alert.alert(
        'Importación Clover',
        `Secciones: ${result.menus}\nProductos: ${result.productos}\nOpciones: ${result.opciones}`
      );
      await loadData();
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : 'No se pudo sincronizar con Clover.';
      Alert.alert('Clover', message);
    } finally {
      setSyncingClover(false);
    }
  }, [context, loadData]);

  const setThemeValue = useCallback((key: keyof MenuTheme, value: string | number | boolean) => {
    setThemeForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: value,
      } as MenuTheme;
    });
  }, []);

  const setThemeFont = useCallback(
    (familyKey: MenuThemeFontFamilyKey, urlKey: MenuThemeFontUrlKey, font: MenuFontOption | null) => {
      setThemeForm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [familyKey]: font?.name || null,
          [urlKey]: font?.url || null,
        } as MenuTheme;
      });
    },
    []
  );

  const setHeaderEditorFont = useCallback(
    (target: HeaderTextTarget, font: MenuFontOption | null) => {
      if (target === 'nombre') {
        setThemeFont('fontnombrefamily', 'fontnombreurl', font);
        return;
      }
      setThemeFont('fontmenuwordfamily', 'fontmenuwordurl', font);
    },
    [setThemeFont]
  );

  const setContentEditorFont = useCallback(
    (target: 'title' | 'product', font: MenuFontOption | null) => {
      if (target === 'title') {
        setThemeFont('fonttitlefamily', 'fonttitleurl', font);
        return;
      }
      setThemeFont('fontbodyfamily', 'fontbodyurl', font);
    },
    [setThemeFont]
  );

  const onChangeHeaderTextColor = useCallback(
    (target: HeaderTextTarget, color: string) => {
      if (!themeForm) return;
      if (target === 'nombre') {
        setThemeValue('colorComercio', sanitizeColor(color, themeForm.colorComercio));
        return;
      }
      setThemeValue('colorMenu', sanitizeColor(color, themeForm.colorMenu));
    },
    [setThemeValue, themeForm]
  );

  const onChangeHeaderStrokeColor = useCallback(
    (target: HeaderTextTarget, color: string) => {
      if (!themeForm) return;
      if (target === 'nombre') {
        setThemeValue('nombre_stroke_color', sanitizeColor(color, themeForm.nombre_stroke_color));
        return;
      }
      setThemeValue('menu_stroke_color', sanitizeColor(color, themeForm.menu_stroke_color));
    },
    [setThemeValue, themeForm]
  );

  const onChangeHeaderShadow = useCallback(
    (target: HeaderTextTarget, intensity: number, color?: string) => {
      const current = target === 'nombre' ? parseShadowValue(themeForm?.nombre_shadow) : parseShadowValue(themeForm?.menu_shadow);
      const nextColor = sanitizeColor(String(color || current.color), current.color);
      const shadowValue = buildShadowValue(intensity, nextColor);
      setThemeValue(target === 'nombre' ? 'nombre_shadow' : 'menu_shadow', shadowValue);
    },
    [setThemeValue, themeForm?.menu_shadow, themeForm?.nombre_shadow]
  );

  const applyColorPickerValue = useCallback(
    (hexColor: string) => {
      const safeHex = normalizeHexColor(hexColor, '#ffffff');
      if (colorPickerField === 'text') {
        onChangeHeaderTextColor(activeHeaderEditor, safeHex);
        return;
      }
      if (colorPickerField === 'stroke') {
        onChangeHeaderStrokeColor(activeHeaderEditor, safeHex);
        return;
      }
      if (colorPickerField === 'shadow') {
        onChangeHeaderShadow(activeHeaderEditor, activeShadowIntensity, safeHex);
        return;
      }
      if (colorPickerField === 'title') {
        setThemeValue('colortitulo', sanitizeColor(safeHex, themeForm?.colortitulo || safeHex));
        return;
      }
      if (colorPickerField === 'productText') {
        setThemeValue('colortexto', sanitizeColor(safeHex, themeForm?.colortexto || safeHex));
        return;
      }
      if (colorPickerField === 'productPrice') {
        setThemeValue('colorprecio', sanitizeColor(safeHex, themeForm?.colorprecio || safeHex));
        return;
      }
      if (colorPickerField === 'itemBg') {
        setThemeValue('item_bg_color', sanitizeColor(safeHex, themeForm?.item_bg_color || safeHex));
      }
    },
    [
      activeHeaderEditor,
      activeShadowIntensity,
      colorPickerField,
      onChangeHeaderShadow,
      onChangeHeaderStrokeColor,
      onChangeHeaderTextColor,
      setThemeValue,
      themeForm?.colorprecio,
      themeForm?.colortexto,
      themeForm?.colortitulo,
      themeForm?.item_bg_color,
    ]
  );

  const openColorPicker = useCallback(
    (field: ColorPickerField, initialColor: string) => {
      const hex = normalizeHexColor(initialColor, '#ffffff');
      setColorPickerField(field);
      setColorPickerHex(hex);
      setColorPickerRgb(hexToRgb(hex));
    },
    []
  );

  const onSelectFontFromPicker = useCallback(
    (font: MenuFontOption | null) => {
      if (!fontPickerTarget) return;
      if (fontPickerTarget === 'nombre' || fontPickerTarget === 'menu') {
        setHeaderEditorFont(fontPickerTarget, font);
      } else if (fontPickerTarget === 'title' || fontPickerTarget === 'product') {
        setContentEditorFont(fontPickerTarget, font);
      }
      setFontPickerTarget(null);
    },
    [fontPickerTarget, setContentEditorFont, setHeaderEditorFont]
  );

  const onSaveTheme = useCallback(async () => {
    if (!context || !themeForm) return;
    setSavingTheme(true);
    try {
      await saveMenuTheme(context.idComercio, themeForm);
      Alert.alert('Admin Menú', 'Diseño guardado correctamente.');
      await loadData();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : String((saveError as { message?: unknown } | null)?.message || 'No se pudo guardar el diseño.');
      Alert.alert('Admin Menú', message);
    } finally {
      setSavingTheme(false);
    }
  }, [context, loadData, themeForm]);

  const onPickThemeImage = useCallback(
    async (type: 'portada' | 'background') => {
      if (!context || !themeForm) return;

      const setUploading = type === 'portada' ? setUploadingPortada : setUploadingBackground;
      setUploading(true);
      try {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permiso requerido', 'Debes permitir acceso a tus fotos para subir imágenes.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.9,
        });

        if (result.canceled) return;
        const picked = result.assets?.[0];
        if (!picked?.uri) {
          Alert.alert('Imagen inválida', 'No se pudo leer la imagen seleccionada.');
          return;
        }

        const path = await uploadMenuThemeImage(context.idComercio, type, {
          uri: picked.uri,
          fileName: picked.fileName,
          mimeType: picked.mimeType,
        });

        setThemeForm((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            [type === 'portada' ? 'portadaimagen' : 'backgroundimagen']: path,
          };
        });

        Alert.alert('Imagen cargada', 'Imagen subida. Pulsa Guardar Diseño para aplicar el cambio.');
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : 'No se pudo subir la imagen.';
        Alert.alert('Admin Menú', message);
      } finally {
        setUploading(false);
      }
    },
    [context, themeForm]
  );

  const onClearThemeImage = useCallback((type: 'portada' | 'background') => {
    setThemeForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [type === 'portada' ? 'portadaimagen' : 'backgroundimagen']: '',
      };
    });
  }, []);

  return (
    <BusinessChrome title="Admin Menú" footerItems={footerItems}>
      {loading ? <ScreenState loading message="Cargando Admin Menú..." /> : null}

      {!loading && error ? <ScreenState message={error} /> : null}

      {!loading && !error && !profile ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cuenta activa sin comercio vinculado</Text>
          <Text style={styles.cardBody}>
            Esta cuenta inició sesión, pero no encontramos un comercio disponible para mostrar.
            {assignmentCount > 0 ? ` (${assignmentCount} asignación(es) detectada(s))` : ''}
          </Text>
        </View>
      ) : null}

      {!loading && !error && context ? (
        <ScrollView contentContainerStyle={styles.scrollWrap}>
          <View style={[styles.summaryCard, shadows.card]}>
            <Image source={{ uri: context.logoUrl || LOGO_PLACEHOLDER }} style={styles.commerceLogo} />
            <View style={styles.summaryMeta}>
              <Text style={styles.commerceName}>{context.nombreComercio || 'Comercio'}</Text>
              <Text style={styles.planBadge}>Plan: {context.planNombre || `Nivel ${context.planNivel}`}</Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Secciones</Text>
              <Text style={styles.kpiValue}>{sectionCount}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Productos</Text>
              <Text style={styles.kpiValue}>{productCount}</Text>
            </View>
          </View>

          {!context.planPermiteMenu ? (
            <View style={styles.blockedCard}>
              <Text style={styles.blockedTitle}>Menú bloqueado por plan</Text>
              <Text style={styles.blockedBody}>
                {context.comercioVerificado
                  ? 'Admin Menú está disponible desde Findixi Plus.'
                  : 'Este comercio debe completar verificación para habilitar menú y visibilidad completa.'}
              </Text>
              <Pressable style={styles.primaryBtn} onPress={() => void Linking.openURL(buildWebUrl('/paquetes.html', context.idComercio))}>
                <Text style={styles.primaryBtnText}>Cambiar Plan</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {themeForm ? (
                <View style={styles.themeCard}>
                  <Text style={styles.themeTitle}>Personalización del Menú</Text>
                  <Text style={styles.themeLead}>
                    Edita colores, tamaño y fuente. La vista previa se actualiza al instante para que veas cómo quedará.
                  </Text>

                  <View style={styles.previewCard}>
                    <Text style={styles.previewTitle}>Vista previa en vivo</Text>

                    <View style={styles.previewAssetsRow}>
                      <View style={styles.previewAssetCard}>
                        <Text style={styles.previewAssetLabel}>Portada</Text>
                        {themeForm.portadaimagen ? (
                          <Image source={{ uri: resolveThemeAssetUrl(themeForm.portadaimagen) }} style={styles.previewAssetImage} />
                        ) : (
                          <View style={styles.previewAssetPlaceholder}>
                            <Text style={styles.previewAssetPlaceholderText}>Sin portada</Text>
                          </View>
                        )}
                        <View style={styles.previewAssetActions}>
                          <Pressable
                            style={styles.inlinePrimaryBtn}
                            onPress={() => void onPickThemeImage('portada')}
                            disabled={uploadingPortada}
                          >
                            <Text style={styles.inlinePrimaryBtnText}>{uploadingPortada ? 'Subiendo...' : themeForm.portadaimagen ? 'Cambiar' : 'Subir'}</Text>
                          </Pressable>
                          <Pressable
                            style={styles.inlineNeutralBtn}
                            onPress={() => onClearThemeImage('portada')}
                            disabled={uploadingPortada || !themeForm.portadaimagen}
                          >
                            <Text style={styles.inlineNeutralBtnText}>Quitar</Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.previewAssetCard}>
                        <Text style={styles.previewAssetLabel}>Background</Text>
                        {themeForm.backgroundimagen ? (
                          <Image source={{ uri: resolveThemeAssetUrl(themeForm.backgroundimagen) }} style={styles.previewAssetImage} />
                        ) : (
                          <View style={styles.previewAssetPlaceholder}>
                            <Text style={styles.previewAssetPlaceholderText}>Sin background</Text>
                          </View>
                        )}
                        <View style={styles.previewAssetActions}>
                          <Pressable
                            style={styles.inlinePrimaryBtn}
                            onPress={() => void onPickThemeImage('background')}
                            disabled={uploadingBackground}
                          >
                            <Text style={styles.inlinePrimaryBtnText}>{uploadingBackground ? 'Subiendo...' : themeForm.backgroundimagen ? 'Cambiar' : 'Subir'}</Text>
                          </Pressable>
                          <Pressable
                            style={styles.inlineNeutralBtn}
                            onPress={() => onClearThemeImage('background')}
                            disabled={uploadingBackground || !themeForm.backgroundimagen}
                          >
                            <Text style={styles.inlineNeutralBtnText}>Quitar</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.previewSectionLabel}>Encabezado del menú</Text>
                    <View style={styles.previewStage}>
                      {previewBackgroundUrl ? (
                        <Image source={{ uri: previewBackgroundUrl }} style={styles.previewBackgroundImage} />
                      ) : (
                        <View style={[styles.previewBackgroundImage, { backgroundColor: previewBackgroundColor }]} />
                      )}
                      <View style={[styles.previewOverlay, { opacity: previewOverlayOpacity }]} />

                      <View style={styles.previewBannerArea}>
                        {previewBannerUrl ? (
                          <Image source={{ uri: previewBannerUrl }} style={styles.previewBannerImage} resizeMode="contain" />
                        ) : (
                          <View style={[styles.previewBannerImage, styles.previewBannerFallback]}>
                            <Text style={styles.previewBannerFallbackText}>Sube portada para ver el banner</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.previewContent}>
                        {!themeForm.ocultar_nombre ? (
                          <OutlinedPreviewText
                            text={context.nombreComercio || 'Nombre del comercio'}
                            color={previewNameColor}
                            fontSize={clampNumber(Number(themeForm.nombre_font_size || 28), 10, 100)}
                            fontFamily={previewNombreFontFamily}
                            strokeWidth={themeForm.nombre_stroke_width}
                            strokeColor={previewNombreStrokeColor}
                            shadow={previewNombreShadow}
                            numberOfLines={2}
                          />
                        ) : (
                          <Text style={styles.previewHiddenText}>Nombre oculto</Text>
                        )}

                        {!themeForm.ocultar_menu ? (
                          <OutlinedPreviewText
                            text={themeForm.textomenu || 'Menú'}
                            color={previewMenuColor}
                            fontSize={clampNumber(Number(themeForm.menu_font_size || 20), 10, 80)}
                            fontFamily={previewMenuFontFamily}
                            strokeWidth={themeForm.menu_stroke_width}
                            strokeColor={previewMenuStrokeColor}
                            shadow={previewMenuShadow}
                          />
                        ) : (
                          <Text style={styles.previewHiddenText}>Palabra menú oculta</Text>
                        )}
                      </View>
                    </View>

                    <Text style={styles.previewSectionLabel}>Contenido del menú</Text>
                    <View style={styles.previewContentCard}>
                      <View style={styles.previewTitleOnlyCard}>
                        <Text
                          style={[
                            styles.previewItemTitle,
                            {
                              color: previewTitleColor,
                              fontSize: clampNumber(Number(themeForm.fonttitle_size || 18), 10, 80),
                              fontFamily: previewTitleFontFamily || undefined,
                              textAlign: themeForm.productoAlign === 'center' ? 'center' : 'left',
                            },
                          ]}
                        >
                          Entradas
                        </Text>
                      </View>

                      <View style={styles.previewProductsGrid}>
                        <View style={styles.previewVariantWrap}>
                          <Text style={styles.previewVariantLabel}>Producto con imagen</Text>
                          <View
                            style={[
                              styles.previewItemCard,
                              {
                                backgroundColor: previewItemBgColor,
                                borderColor: previewItemBorderColor,
                              },
                            ]}
                          >
                            <View style={styles.previewProductRow}>
                              <View style={styles.previewItemImageMock}>
                                <Text style={styles.previewItemImageMockText}>Imagen</Text>
                              </View>
                              <View
                                style={[
                                  styles.previewProductInfo,
                                  { alignItems: themeForm.productoAlign === 'center' ? 'center' : 'flex-start' },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.previewItemDesc,
                                    {
                                      color: previewTextColor,
                                      fontSize: clampNumber(Number(themeForm.fontbody_size || 16), 10, 80),
                                      fontFamily: previewBodyFontFamily || undefined,
                                      textAlign: themeForm.productoAlign === 'center' ? 'center' : 'left',
                                    },
                                  ]}
                                >
                                  Camarones al ajillo
                                </Text>
                                <Text
                                  style={[
                                    styles.previewItemDesc,
                                    {
                                      color: previewSectionDescColor,
                                      fontSize: clampNumber(Number(themeForm.seccion_desc_font_size || 14), 10, 80),
                                      fontFamily: previewSectionDescFontFamily || previewBodyFontFamily || undefined,
                                      textAlign: themeForm.productoAlign === 'center' ? 'center' : 'left',
                                    },
                                  ]}
                                >
                                  Salteados con mantequilla y ajo
                                </Text>
                                <Text
                                  style={[
                                    styles.previewItemTitle,
                                    {
                                      color: previewPriceColor,
                                      fontSize: clampNumber(Number(themeForm.fontbody_size || 16), 10, 80),
                                      fontFamily: previewBodyFontFamily || undefined,
                                      textAlign: themeForm.productoAlign === 'center' ? 'center' : 'left',
                                    },
                                  ]}
                                >
                                  $14.99
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        <View style={styles.previewVariantWrap}>
                          <Text style={styles.previewVariantLabel}>Producto sin imagen</Text>
                          <View
                            style={[
                              styles.previewItemCard,
                              {
                                backgroundColor: previewItemBgColor,
                                borderColor: previewItemBorderColor,
                                alignItems: themeForm.productoAlign === 'center' ? 'center' : 'flex-start',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.previewItemDesc,
                                {
                                  color: previewTextColor,
                                  fontSize: clampNumber(Number(themeForm.fontbody_size || 16), 10, 80),
                                  fontFamily: previewBodyFontFamily || undefined,
                                  textAlign: themeForm.productoAlign === 'center' ? 'center' : 'left',
                                },
                              ]}
                            >
                              Churrasco a la parrilla
                            </Text>
                            <Text
                              style={[
                                styles.previewItemDesc,
                                {
                                  color: previewSectionDescColor,
                                  fontSize: clampNumber(Number(themeForm.seccion_desc_font_size || 14), 10, 80),
                                  fontFamily: previewSectionDescFontFamily || previewBodyFontFamily || undefined,
                                  textAlign: themeForm.productoAlign === 'center' ? 'center' : 'left',
                                },
                              ]}
                            >
                              Con papas y ensalada de la casa
                            </Text>
                            <Text
                              style={[
                                styles.previewItemTitle,
                                {
                                  color: previewPriceColor,
                                  fontSize: clampNumber(Number(themeForm.fontbody_size || 16), 10, 80),
                                  fontFamily: previewBodyFontFamily || undefined,
                                  textAlign: themeForm.productoAlign === 'center' ? 'center' : 'left',
                                },
                              ]}
                            >
                              $18.50
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.previewEditorRows}>
                      <View style={styles.previewEditorRow}>
                        <View style={styles.previewEditorTextWrap}>
                          <OutlinedPreviewText
                            text={context.nombreComercio || 'Nombre del comercio'}
                            color={previewNameColor}
                            fontSize={clampNumber(Number(themeForm.nombre_font_size || 28), 10, 100)}
                            fontFamily={previewNombreFontFamily}
                            strokeWidth={themeForm.nombre_stroke_width}
                            strokeColor={previewNombreStrokeColor}
                            shadow={previewNombreShadow}
                          />
                        </View>
                        <Pressable
                          style={[styles.editTargetBtn, openHeaderEditor === 'nombre' ? styles.editTargetBtnActive : null]}
                          onPress={() => {
                            setActiveHeaderEditor('nombre');
                            setOpenHeaderEditor((prev) => (prev === 'nombre' ? null : 'nombre'));
                          }}
                        >
                          <Text style={[styles.editTargetBtnText, openHeaderEditor === 'nombre' ? styles.editTargetBtnTextActive : null]}>
                            Editar
                          </Text>
                        </Pressable>
                      </View>
                      <View style={styles.previewEditorRow}>
                        <View style={styles.previewEditorTextWrap}>
                          <OutlinedPreviewText
                            text={themeForm.textomenu || 'Menú'}
                            color={previewMenuColor}
                            fontSize={clampNumber(Number(themeForm.menu_font_size || 20), 10, 80)}
                            fontFamily={previewMenuFontFamily}
                            strokeWidth={themeForm.menu_stroke_width}
                            strokeColor={previewMenuStrokeColor}
                            shadow={previewMenuShadow}
                          />
                        </View>
                        <Pressable
                          style={[styles.editTargetBtn, openHeaderEditor === 'menu' ? styles.editTargetBtnActive : null]}
                          onPress={() => {
                            setActiveHeaderEditor('menu');
                            setOpenHeaderEditor((prev) => (prev === 'menu' ? null : 'menu'));
                          }}
                        >
                          <Text style={[styles.editTargetBtnText, openHeaderEditor === 'menu' ? styles.editTargetBtnTextActive : null]}>
                            Editar
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {editorVisible ? (
                      <View style={styles.editorPanel}>
                      <Text style={styles.editorPanelTitle}>Editar {activeEditorTitle}</Text>

                      {activeEditorIsNombre ? (
                        <View style={styles.themeField}>
                          <Text style={styles.themeLabel}>Nombre</Text>
                          <View style={styles.readonlyValueWrap}>
                            <Text style={styles.readonlyValueText}>{context.nombreComercio || 'Nombre del comercio'}</Text>
                          </View>
                          <Text style={styles.themeHint}>Nombre no editable aquí. Puedes cambiarlo desde Editar Perfil.</Text>
                        </View>
                      ) : (
                        <View style={styles.themeField}>
                          <Text style={styles.themeLabel}>Texto</Text>
                          <TextInput
                            style={styles.input}
                            value={themeForm.textomenu}
                            placeholder="Menú"
                            onChangeText={(value) => setThemeValue('textomenu', value)}
                          />
                        </View>
                      )}

                      <View style={styles.themeField}>
                        <Text style={styles.themeLabel}>Font ({activeFontName})</Text>
                        <Pressable style={styles.fontDropdownBtn} onPress={() => setFontPickerTarget(activeHeaderEditor)}>
                          <Text style={styles.fontDropdownBtnText}>Seleccionar font</Text>
                        </Pressable>
                      </View>

                      <View style={styles.themeField}>
                        <Text style={styles.themeLabel}>Size ({Math.round(activeFontSize)} px)</Text>
                        <Slider
                          minimumValue={activeEditorIsNombre ? 10 : 10}
                          maximumValue={activeEditorIsNombre ? 100 : 80}
                          value={activeFontSize}
                          minimumTrackTintColor={primaryOrange}
                          maximumTrackTintColor="#cbd5e1"
                          thumbTintColor={primaryOrange}
                          step={1}
                          onValueChange={(value) => {
                            const safe = clampNumber(Math.round(value), activeEditorIsNombre ? 10 : 10, activeEditorIsNombre ? 100 : 80);
                            setThemeValue(activeEditorIsNombre ? 'nombre_font_size' : 'menu_font_size', safe);
                          }}
                        />
                      </View>

                      <View style={styles.themeField}>
                        <Text style={styles.themeLabel}>Color</Text>
                        <View style={styles.colorInputWrap}>
                          <View style={[styles.colorSwatch, { backgroundColor: activeTextColor }]} />
                          <TextInput
                            style={[styles.input, styles.colorInput]}
                            value={activeTextColorInput}
                            onChangeText={(value) => onChangeHeaderTextColor(activeHeaderEditor, value)}
                          />
                          <Pressable style={styles.colorPickerBtn} onPress={() => openColorPicker('text', activeTextColorInput)}>
                            <Text style={styles.colorPickerBtnText}>Picker</Text>
                          </Pressable>
                        </View>
                        <View style={styles.colorPresetRow}>
                          {COLOR_PRESETS.map((color) => (
                            <Pressable
                              key={`text-${activeHeaderEditor}-${color}`}
                              style={[styles.colorPreset, { backgroundColor: color }]}
                              onPress={() => onChangeHeaderTextColor(activeHeaderEditor, color)}
                            />
                          ))}
                        </View>
                      </View>

                      <View style={styles.themeField}>
                        <Text style={styles.themeLabel}>Borde ({activeStrokeWidth.toFixed(1)} px)</Text>
                        <Slider
                          minimumValue={0}
                          maximumValue={8}
                          value={activeStrokeWidth}
                          minimumTrackTintColor={primaryBlue}
                          maximumTrackTintColor="#cbd5e1"
                          thumbTintColor={primaryBlue}
                          step={0.5}
                          onValueChange={(value) =>
                            setThemeValue(activeEditorIsNombre ? 'nombre_stroke_width' : 'menu_stroke_width', clampNumber(value, 0, 8))
                          }
                        />
                        <View style={styles.colorInputWrap}>
                          <View style={[styles.colorSwatch, { backgroundColor: activeStrokeColor }]} />
                          <TextInput
                            style={[styles.input, styles.colorInput]}
                            value={activeStrokeColorInput}
                            onChangeText={(value) => onChangeHeaderStrokeColor(activeHeaderEditor, value)}
                          />
                          <Pressable style={styles.colorPickerBtn} onPress={() => openColorPicker('stroke', activeStrokeColorInput)}>
                            <Text style={styles.colorPickerBtnText}>Picker</Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.themeField}>
                        <Text style={styles.themeLabel}>Sombra ({Math.round(activeShadowIntensity)})</Text>
                        <Slider
                          minimumValue={0}
                          maximumValue={30}
                          value={activeShadowIntensity}
                          minimumTrackTintColor="#475569"
                          maximumTrackTintColor="#cbd5e1"
                          thumbTintColor="#334155"
                          step={1}
                          onValueChange={(value) => onChangeHeaderShadow(activeHeaderEditor, value)}
                        />
                        <View style={styles.colorInputWrap}>
                          <View style={[styles.colorSwatch, { backgroundColor: resolvePreviewColor(activeShadow.color, '#00000080') }]} />
                          <TextInput
                            style={[styles.input, styles.colorInput]}
                            value={resolvePreviewColor(activeShadow.color, '#00000080')}
                            onChangeText={(value) => onChangeHeaderShadow(activeHeaderEditor, activeShadowIntensity, value)}
                          />
                          <Pressable
                            style={styles.colorPickerBtn}
                            onPress={() => openColorPicker('shadow', resolvePreviewColor(activeShadow.color, '#00000080'))}
                          >
                            <Text style={styles.colorPickerBtnText}>Picker</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                    ) : null}

                    <View style={styles.previewEditorRows}>
                      <View style={styles.previewEditorRow}>
                        <View style={styles.previewEditorTextWrap}>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.previewItemTitle,
                              {
                                color: previewTitleColor,
                                fontSize: clampNumber(Number(themeForm.fonttitle_size || 18), 10, 80),
                                fontFamily: previewTitleFontFamily || undefined,
                              },
                            ]}
                          >
                            Título de sección
                          </Text>
                        </View>
                        <Pressable
                          style={[styles.editTargetBtn, openContentEditor === 'title' ? styles.editTargetBtnActive : null]}
                          onPress={() => {
                            setActiveContentEditor('title');
                            setOpenContentEditor((prev) => (prev === 'title' ? null : 'title'));
                          }}
                        >
                          <Text style={[styles.editTargetBtnText, openContentEditor === 'title' ? styles.editTargetBtnTextActive : null]}>
                            Editar
                          </Text>
                        </Pressable>
                      </View>

                      <View style={styles.previewEditorRow}>
                        <View style={styles.previewEditorTextWrap}>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.previewItemDesc,
                              {
                                color: previewTextColor,
                                fontSize: clampNumber(Number(themeForm.fontbody_size || 16), 10, 80),
                                fontFamily: previewBodyFontFamily || undefined,
                              },
                            ]}
                          >
                            Productos y precios
                          </Text>
                        </View>
                        <Pressable
                          style={[styles.editTargetBtn, openContentEditor === 'product' ? styles.editTargetBtnActive : null]}
                          onPress={() => {
                            setActiveContentEditor('product');
                            setOpenContentEditor((prev) => (prev === 'product' ? null : 'product'));
                          }}
                        >
                          <Text style={[styles.editTargetBtnText, openContentEditor === 'product' ? styles.editTargetBtnTextActive : null]}>
                            Editar
                          </Text>
                        </Pressable>
                      </View>

                      <View style={styles.previewEditorRow}>
                        <View style={styles.previewEditorTextWrap}>
                          <Text numberOfLines={1} style={[styles.previewItemDesc, { color: '#475569' }]}>
                            Cuadro del ítem
                          </Text>
                        </View>
                        <Pressable
                          style={[styles.editTargetBtn, openContentEditor === 'item' ? styles.editTargetBtnActive : null]}
                          onPress={() => {
                            setActiveContentEditor('item');
                            setOpenContentEditor((prev) => (prev === 'item' ? null : 'item'));
                          }}
                        >
                          <Text style={[styles.editTargetBtnText, openContentEditor === 'item' ? styles.editTargetBtnTextActive : null]}>
                            Editar
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {contentEditorVisible ? (
                      <View style={styles.editorPanel}>
                        <Text style={styles.editorPanelTitle}>Editar {activeContentEditorTitle}</Text>

                        {activeContentEditor === 'title' ? (
                          <>
                            <View style={styles.themeField}>
                              <Text style={styles.themeLabel}>Font ({activeContentFontName})</Text>
                              <Pressable style={styles.fontDropdownBtn} onPress={() => setFontPickerTarget('title')}>
                                <Text style={styles.fontDropdownBtnText}>Seleccionar font</Text>
                              </Pressable>
                            </View>

                            <View style={styles.themeField}>
                              <Text style={styles.themeLabel}>Size ({Math.round(activeContentFontSize)} px)</Text>
                              <Slider
                                minimumValue={10}
                                maximumValue={80}
                                value={activeContentFontSize}
                                minimumTrackTintColor={primaryOrange}
                                maximumTrackTintColor="#cbd5e1"
                                thumbTintColor={primaryOrange}
                                step={1}
                                onValueChange={(value) => setThemeValue('fonttitle_size', clampNumber(Math.round(value), 10, 80))}
                              />
                            </View>

                            <View style={styles.themeField}>
                              <Text style={styles.themeLabel}>Color título</Text>
                              <View style={styles.colorInputWrap}>
                                <View style={[styles.colorSwatch, { backgroundColor: previewTitleColor }]} />
                                <TextInput
                                  style={[styles.input, styles.colorInput]}
                                  value={themeForm.colortitulo}
                                  onChangeText={(value) => setThemeValue('colortitulo', sanitizeColor(value, themeForm.colortitulo))}
                                />
                                <Pressable style={styles.colorPickerBtn} onPress={() => openColorPicker('title', themeForm.colortitulo)}>
                                  <Text style={styles.colorPickerBtnText}>Picker</Text>
                                </Pressable>
                              </View>
                            </View>
                          </>
                        ) : null}

                        {activeContentEditor === 'product' ? (
                          <>
                            <View style={styles.themeField}>
                              <Text style={styles.themeLabel}>Font productos ({activeContentFontName})</Text>
                              <Pressable style={styles.fontDropdownBtn} onPress={() => setFontPickerTarget('product')}>
                                <Text style={styles.fontDropdownBtnText}>Seleccionar font</Text>
                              </Pressable>
                            </View>

                            <View style={styles.themeField}>
                              <Text style={styles.themeLabel}>Size ({Math.round(activeContentFontSize)} px)</Text>
                              <Slider
                                minimumValue={10}
                                maximumValue={80}
                                value={activeContentFontSize}
                                minimumTrackTintColor={primaryOrange}
                                maximumTrackTintColor="#cbd5e1"
                                thumbTintColor={primaryOrange}
                                step={1}
                                onValueChange={(value) => setThemeValue('fontbody_size', clampNumber(Math.round(value), 10, 80))}
                              />
                            </View>

                            <View style={styles.themeField}>
                              <Text style={styles.themeLabel}>Color texto producto</Text>
                              <View style={styles.colorInputWrap}>
                                <View style={[styles.colorSwatch, { backgroundColor: previewTextColor }]} />
                                <TextInput
                                  style={[styles.input, styles.colorInput]}
                                  value={themeForm.colortexto}
                                  onChangeText={(value) => setThemeValue('colortexto', sanitizeColor(value, themeForm.colortexto))}
                                />
                                <Pressable style={styles.colorPickerBtn} onPress={() => openColorPicker('productText', themeForm.colortexto)}>
                                  <Text style={styles.colorPickerBtnText}>Picker</Text>
                                </Pressable>
                              </View>
                            </View>

                            <View style={styles.themeField}>
                              <Text style={styles.themeLabel}>Color precio</Text>
                              <View style={styles.colorInputWrap}>
                                <View style={[styles.colorSwatch, { backgroundColor: previewPriceColor }]} />
                                <TextInput
                                  style={[styles.input, styles.colorInput]}
                                  value={themeForm.colorprecio}
                                  onChangeText={(value) => setThemeValue('colorprecio', sanitizeColor(value, themeForm.colorprecio))}
                                />
                                <Pressable style={styles.colorPickerBtn} onPress={() => openColorPicker('productPrice', themeForm.colorprecio)}>
                                  <Text style={styles.colorPickerBtnText}>Picker</Text>
                                </Pressable>
                              </View>
                            </View>
                          </>
                        ) : null}

                        {activeContentEditor === 'item' ? (
                          <>
                            <View style={styles.themeField}>
                              <Text style={styles.themeLabel}>Color cuadro ítem</Text>
                              <View style={styles.colorInputWrap}>
                                <View style={[styles.colorSwatch, { backgroundColor: previewItemBgColor }]} />
                                <TextInput
                                  style={[styles.input, styles.colorInput]}
                                  value={themeForm.item_bg_color}
                                  onChangeText={(value) => setThemeValue('item_bg_color', sanitizeColor(value, themeForm.item_bg_color))}
                                />
                                <Pressable style={styles.colorPickerBtn} onPress={() => openColorPicker('itemBg', themeForm.item_bg_color)}>
                                  <Text style={styles.colorPickerBtnText}>Picker</Text>
                                </Pressable>
                              </View>
                            </View>

                            <View style={styles.themeField}>
                              <Text style={styles.themeLabel}>Opacidad de borde ({Math.round(themeForm.item_overlay || 0)})</Text>
                              <Slider
                                minimumValue={0}
                                maximumValue={80}
                                value={clampNumber(Number(themeForm.item_overlay || 0), 0, 80)}
                                minimumTrackTintColor={primaryBlue}
                                maximumTrackTintColor="#cbd5e1"
                                thumbTintColor={primaryBlue}
                                step={1}
                                onValueChange={(value) => setThemeValue('item_overlay', clampNumber(Math.round(value), 0, 80))}
                              />
                            </View>

                            <View style={styles.alignRow}>
                              <Text style={styles.themeLabel}>Alineación productos</Text>
                              <View style={styles.alignButtons}>
                                <Pressable
                                  style={[styles.alignBtn, themeForm.productoAlign === 'left' ? styles.alignBtnActive : null]}
                                  onPress={() => setThemeValue('productoAlign', 'left')}
                                >
                                  <Text style={[styles.alignBtnText, themeForm.productoAlign === 'left' ? styles.alignBtnTextActive : null]}>
                                    Izquierda
                                  </Text>
                                </Pressable>
                                <Pressable
                                  style={[styles.alignBtn, themeForm.productoAlign === 'center' ? styles.alignBtnActive : null]}
                                  onPress={() => setThemeValue('productoAlign', 'center')}
                                >
                                  <Text style={[styles.alignBtnText, themeForm.productoAlign === 'center' ? styles.alignBtnTextActive : null]}>
                                    Centro
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                          </>
                        ) : null}
                      </View>
                    ) : null}

                    <View style={styles.previewMetaWrap}>
                      <Text style={styles.previewMetaText}>Fuente Nombre: {selectedNombreFont}</Text>
                      <Text style={styles.previewMetaText}>Fuente Menú: {selectedMenuFont}</Text>
                      <Text style={styles.previewMetaText}>Fuente Título: {selectedTitleFont}</Text>
                      <Text style={styles.previewMetaText}>Fuente Productos: {selectedBodyFont}</Text>
                    </View>
                  </View>

                  <Pressable style={styles.advancedToggleBtn} onPress={() => setShowAdvancedTheme((prev) => !prev)}>
                    <Text style={styles.advancedToggleBtnText}>{showAdvancedTheme ? 'Ocultar Avanzado' : 'Mostrar Avanzado'}</Text>
                  </Pressable>

                  {showAdvancedTheme ? (
                    <View style={styles.advancedWrap}>
                      <View style={styles.themeField}>
                        <Text style={styles.themeLabel}>URL PDF</Text>
                        <TextInput
                          style={styles.input}
                          value={themeForm.pdfurl}
                          placeholder="https://..."
                          onChangeText={(value) => setThemeValue('pdfurl', value)}
                        />
                      </View>

                      <View style={styles.themeGrid}>
                        <View style={styles.themeFieldHalf}>
                          <Text style={styles.themeLabel}>Color botón</Text>
                          <View style={styles.colorInputWrap}>
                            <View style={[styles.colorSwatch, { backgroundColor: previewButtonColor }]} />
                            <TextInput
                              style={[styles.input, styles.colorInput]}
                              value={themeForm.colorboton}
                              onChangeText={(value) => setThemeValue('colorboton', sanitizeColor(value, themeForm.colorboton))}
                            />
                          </View>
                        </View>
                        <View style={styles.themeFieldHalf}>
                          <Text style={styles.themeLabel}>Texto botón</Text>
                          <View style={styles.colorInputWrap}>
                            <View style={[styles.colorSwatch, { backgroundColor: previewButtonTextColor }]} />
                            <TextInput
                              style={[styles.input, styles.colorInput]}
                              value={themeForm.colorbotontexto}
                              onChangeText={(value) => setThemeValue('colorbotontexto', sanitizeColor(value, themeForm.colorbotontexto))}
                            />
                          </View>
                        </View>
                        <View style={styles.themeFieldHalf}>
                          <Text style={styles.themeLabel}>Color título</Text>
                          <View style={styles.colorInputWrap}>
                            <View style={[styles.colorSwatch, { backgroundColor: previewTitleColor }]} />
                            <TextInput
                              style={[styles.input, styles.colorInput]}
                              value={themeForm.colortitulo}
                              onChangeText={(value) => setThemeValue('colortitulo', sanitizeColor(value, themeForm.colortitulo))}
                            />
                          </View>
                        </View>
                        <View style={styles.themeFieldHalf}>
                          <Text style={styles.themeLabel}>Color texto</Text>
                          <View style={styles.colorInputWrap}>
                            <View style={[styles.colorSwatch, { backgroundColor: previewTextColor }]} />
                            <TextInput
                              style={[styles.input, styles.colorInput]}
                              value={themeForm.colortexto}
                              onChangeText={(value) => setThemeValue('colortexto', sanitizeColor(value, themeForm.colortexto))}
                            />
                          </View>
                        </View>
                      </View>

                      <View style={styles.themeField}>
                        <Text style={styles.themeLabel}>Fuente Body ({themeForm.fontbodyfamily || 'Por defecto'})</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="number-pad"
                          value={String(themeForm.fontbody_size)}
                          onChangeText={(value) =>
                            setThemeValue('fontbody_size', Math.min(80, Math.max(10, Number.parseInt(value || '16', 10) || 16)))
                          }
                        />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fontChipsRow}>
                          <Pressable
                            style={[styles.fontChip, !themeForm.fontbodyfamily ? styles.fontChipActive : null]}
                            onPress={() => setThemeFont('fontbodyfamily', 'fontbodyurl', null)}
                          >
                            <Text style={[styles.fontChipText, !themeForm.fontbodyfamily ? styles.fontChipTextActive : null]}>Default</Text>
                          </Pressable>
                          {MENU_FONTS.map((font) => (
                            <Pressable
                              key={`font-body-${font.name}`}
                              style={[styles.fontChip, themeForm.fontbodyfamily === font.name ? styles.fontChipActive : null]}
                              onPress={() => setThemeFont('fontbodyfamily', 'fontbodyurl', font)}
                            >
                              <Text
                                style={[
                                  styles.fontChipText,
                                  themeForm.fontbodyfamily === font.name ? styles.fontChipTextActive : null,
                                  { fontFamily: resolveNativeMenuFontFamily(font.name) },
                                ]}
                              >
                                {font.name}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>

                      <View style={styles.themeField}>
                        <Text style={styles.themeLabel}>Fuente Título ({themeForm.fonttitlefamily || 'Por defecto'})</Text>
                        <TextInput
                          style={styles.input}
                          keyboardType="number-pad"
                          value={String(themeForm.fonttitle_size)}
                          onChangeText={(value) =>
                            setThemeValue('fonttitle_size', Math.min(80, Math.max(10, Number.parseInt(value || '18', 10) || 18)))
                          }
                        />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fontChipsRow}>
                          <Pressable
                            style={[styles.fontChip, !themeForm.fonttitlefamily ? styles.fontChipActive : null]}
                            onPress={() => setThemeFont('fonttitlefamily', 'fonttitleurl', null)}
                          >
                            <Text style={[styles.fontChipText, !themeForm.fonttitlefamily ? styles.fontChipTextActive : null]}>Default</Text>
                          </Pressable>
                          {MENU_FONTS.map((font) => (
                            <Pressable
                              key={`font-title-${font.name}`}
                              style={[styles.fontChip, themeForm.fonttitlefamily === font.name ? styles.fontChipActive : null]}
                              onPress={() => setThemeFont('fonttitlefamily', 'fonttitleurl', font)}
                            >
                              <Text
                                style={[
                                  styles.fontChipText,
                                  themeForm.fonttitlefamily === font.name ? styles.fontChipTextActive : null,
                                  { fontFamily: resolveNativeMenuFontFamily(font.name) },
                                ]}
                              >
                                {font.name}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>

                      <View style={styles.themeField}>
                        <Text style={styles.themeLabel}>Background color (sin imagen)</Text>
                        <View style={styles.colorInputWrap}>
                          <View style={[styles.colorSwatch, { backgroundColor: previewBackgroundColor }]} />
                          <TextInput
                            style={[styles.input, styles.colorInput]}
                            value={themeForm.backgroundcolor}
                            onChangeText={(value) => setThemeValue('backgroundcolor', sanitizeColor(value, themeForm.backgroundcolor))}
                          />
                        </View>
                      </View>

                      <View style={styles.themeField}>
                        <Text style={styles.themeLabel}>Fuente Descripción Sección ({themeForm.seccion_desc_font_family || 'Por defecto'})</Text>
                        <View style={styles.themeGrid}>
                          <View style={styles.themeFieldHalf}>
                            <Text style={styles.themeLabel}>Tamaño descripción</Text>
                            <TextInput
                              style={styles.input}
                              keyboardType="number-pad"
                              value={String(themeForm.seccion_desc_font_size)}
                              onChangeText={(value) =>
                                setThemeValue(
                                  'seccion_desc_font_size',
                                  Math.min(80, Math.max(10, Number.parseInt(value || '14', 10) || 14))
                                )
                              }
                            />
                          </View>
                          <View style={styles.themeFieldHalf}>
                            <Text style={styles.themeLabel}>Color descripción</Text>
                            <TextInput
                              style={styles.input}
                              value={themeForm.seccion_desc_color}
                              onChangeText={(value) =>
                                setThemeValue('seccion_desc_color', sanitizeColor(value, themeForm.seccion_desc_color))
                              }
                            />
                          </View>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fontChipsRow}>
                          <Pressable
                            style={[styles.fontChip, !themeForm.seccion_desc_font_family ? styles.fontChipActive : null]}
                            onPress={() => setThemeFont('seccion_desc_font_family', 'seccion_desc_font_url', null)}
                          >
                            <Text style={[styles.fontChipText, !themeForm.seccion_desc_font_family ? styles.fontChipTextActive : null]}>Default</Text>
                          </Pressable>
                          {MENU_FONTS.map((font) => (
                            <Pressable
                              key={`font-seccion-desc-${font.name}`}
                              style={[styles.fontChip, themeForm.seccion_desc_font_family === font.name ? styles.fontChipActive : null]}
                              onPress={() => setThemeFont('seccion_desc_font_family', 'seccion_desc_font_url', font)}
                            >
                              <Text
                                style={[
                                  styles.fontChipText,
                                  themeForm.seccion_desc_font_family === font.name ? styles.fontChipTextActive : null,
                                  { fontFamily: resolveNativeMenuFontFamily(font.name) },
                                ]}
                              >
                                {font.name}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>

                      <View style={styles.themeGrid}>
                        <View style={styles.themeFieldHalf}>
                          <Text style={styles.themeLabel}>Overlay (0-80)</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="number-pad"
                            value={String(themeForm.overlayoscuro)}
                            onChangeText={(value) =>
                              setThemeValue('overlayoscuro', Math.min(80, Math.max(0, Number.parseInt(value || '0', 10) || 0)))
                            }
                          />
                        </View>
                        <View style={styles.themeFieldHalf}>
                          <Text style={styles.themeLabel}>Opacidad item (0-80)</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="number-pad"
                            value={String(themeForm.item_overlay)}
                            onChangeText={(value) =>
                              setThemeValue('item_overlay', Math.min(80, Math.max(0, Number.parseInt(value || '0', 10) || 0)))
                            }
                          />
                        </View>
                      </View>

                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Ocultar nombre del comercio</Text>
                        <Switch
                          value={themeForm.ocultar_nombre}
                          onValueChange={(value) => setThemeValue('ocultar_nombre', value)}
                          trackColor={{ true: '#fdba74', false: '#e2e8f0' }}
                          thumbColor={themeForm.ocultar_nombre ? '#ea580c' : '#94a3b8'}
                        />
                      </View>

                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Ocultar palabra menú</Text>
                        <Switch
                          value={themeForm.ocultar_menu}
                          onValueChange={(value) => setThemeValue('ocultar_menu', value)}
                          trackColor={{ true: '#fdba74', false: '#e2e8f0' }}
                          thumbColor={themeForm.ocultar_menu ? '#ea580c' : '#94a3b8'}
                        />
                      </View>

                      <View style={styles.alignRow}>
                        <Text style={styles.themeLabel}>Alineación productos</Text>
                        <View style={styles.alignButtons}>
                          <Pressable
                            style={[styles.alignBtn, themeForm.productoAlign === 'left' ? styles.alignBtnActive : null]}
                            onPress={() => setThemeValue('productoAlign', 'left')}
                          >
                            <Text style={[styles.alignBtnText, themeForm.productoAlign === 'left' ? styles.alignBtnTextActive : null]}>
                              Izquierda
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[styles.alignBtn, themeForm.productoAlign === 'center' ? styles.alignBtnActive : null]}
                            onPress={() => setThemeValue('productoAlign', 'center')}
                          >
                            <Text style={[styles.alignBtnText, themeForm.productoAlign === 'center' ? styles.alignBtnTextActive : null]}>
                              Centro
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.actionsRow}>
                    <Pressable style={styles.primaryBtn} onPress={() => void onSaveTheme()} disabled={savingTheme}>
                      <Text style={styles.primaryBtnText}>{savingTheme ? 'Guardando...' : 'Guardar Diseño'}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondaryBtn}
                      onPress={() => void Linking.openURL(buildWebUrl('/adminMenuComercio.html', context.idComercio))}
                    >
                      <Text style={styles.secondaryBtnText}>Abrir Diseño Web</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.actionsRow}>
                <Pressable style={styles.primaryBtn} onPress={openCreateSection}>
                  <Text style={styles.primaryBtnText}>Nueva Sección</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => void Linking.openURL(buildWebUrl('/adminMenuComercio.html', context.idComercio))}
                >
                  <Text style={styles.secondaryBtnText}>Diseño Web</Text>
                </Pressable>
              </View>

              <View style={styles.cloverCard}>
                <Text style={styles.cloverTitle}>Integración Clover</Text>
                {!context.planPermiteOrdenes ? (
                  <Text style={styles.cloverBody}>Órdenes Clover disponibles en plan Premium.</Text>
                ) : (
                  <View style={styles.cloverActions}>
                    <View style={styles.cloverStatusWrap}>
                      <Text style={[styles.cloverStatus, context.cloverConnected ? styles.statusConnected : styles.statusDisconnected]}>
                        {context.cloverConnected ? 'Conectado' : 'Sin conexión'}
                      </Text>
                    </View>
                    <Pressable style={styles.cloverBtn} onPress={onCloverConnect}>
                      <Text style={styles.cloverBtnText}>Conectar</Text>
                    </Pressable>
                    <Pressable style={styles.cloverSyncBtn} onPress={onCloverSync} disabled={syncingClover}>
                      <Text style={styles.cloverSyncBtnText}>{syncingClover ? 'Sincronizando...' : 'Sincronizar'}</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <View style={styles.sectionListWrap}>
                {context.sections.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>Aún no hay secciones creadas</Text>
                    <Text style={styles.emptyBody}>Crea tu primera sección para añadir productos.</Text>
                  </View>
                ) : null}

                {context.sections.map((section) => {
                  const isOpen = Boolean(expandedSections[section.id]);
                  return (
                    <View key={`section-${section.id}`} style={styles.sectionCard}>
                      <Pressable style={styles.sectionHeader} onPress={() => onToggleSection(section.id)}>
                        <View style={styles.sectionHeaderLeft}>
                          <Text style={styles.sectionTitle}>{section.titulo || 'Sección'}</Text>
                          <Text style={styles.sectionMeta}>
                            #{section.orden} • {section.productos.length} producto{section.productos.length === 1 ? '' : 's'}
                          </Text>
                        </View>
                        <View style={styles.sectionHeaderRight}>
                          <Text style={[styles.sectionState, section.activo ? styles.stateOn : styles.stateOff]}>
                            {section.activo ? 'Activa' : 'Inactiva'}
                          </Text>
                          <Text style={styles.chevron}>{isOpen ? '˄' : '˅'}</Text>
                        </View>
                      </Pressable>

                      {isOpen ? (
                        <View style={styles.sectionBody}>
                          {section.subtitulo ? <Text style={styles.subtitulo}>{section.subtitulo}</Text> : null}
                          {section.descripcion ? <Text style={styles.descripcion}>{section.descripcion}</Text> : null}

                          <View style={styles.sectionActions}>
                            <Pressable style={styles.inlineBtn} onPress={() => openEditSection(section)}>
                              <Text style={styles.inlineBtnText}>Editar sección</Text>
                            </Pressable>
                            <Pressable style={styles.inlineBtn} onPress={() => void onMoveSection(section.id, 'up')} disabled={savingOrder}>
                              <Text style={styles.inlineBtnText}>Subir</Text>
                            </Pressable>
                            <Pressable style={styles.inlineBtn} onPress={() => void onMoveSection(section.id, 'down')} disabled={savingOrder}>
                              <Text style={styles.inlineBtnText}>Bajar</Text>
                            </Pressable>
                            <Pressable style={styles.addProductBtn} onPress={() => openCreateProduct(section)}>
                              <Text style={styles.addProductBtnText}>+ Producto</Text>
                            </Pressable>
                          </View>

                          {section.productos.length === 0 ? <Text style={styles.emptyProducts}>No hay productos en esta sección.</Text> : null}

                          {section.productos.map((product) => (
                            <Pressable
                              key={`product-${product.id}`}
                              style={styles.productCard}
                              onPress={() => openEditProduct(section.id, product)}
                            >
                              {product.imagen ? <Image source={{ uri: `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${product.imagen}` }} style={styles.productImage} /> : null}
                              <View style={styles.productMeta}>
                                <Text style={styles.productName}>{product.nombre || 'Producto'}</Text>
                                <Text numberOfLines={2} style={styles.productDesc}>
                                  {product.descripcion || 'Sin descripción'}
                                </Text>
                              </View>
                              <View style={styles.productRight}>
                                <Text style={styles.productPrice}>{formatMoney(product.precio)}</Text>
                                <Pressable onPress={() => onDeleteProduct(product)}>
                                  <Text style={styles.deleteText}>Eliminar</Text>
                                </Pressable>
                              </View>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      ) : null}

      <Modal visible={colorPickerField != null} animationType="slide" transparent onRequestClose={() => setColorPickerField(null)}>
        <View style={styles.colorPickerBackdrop}>
          <View style={styles.colorPickerCard}>
            <Text style={styles.modalTitle}>Color Picker</Text>
            <View style={styles.colorPickerWrap}>
              <View style={[styles.colorPickerPreview, { backgroundColor: colorPickerHex }]} />

              <Text style={styles.themeLabel}>HEX (puedes pegar color externo)</Text>
              <TextInput
                style={styles.input}
                value={colorPickerHex}
                onChangeText={(value) => {
                  setColorPickerHex(value);
                  const normalized = normalizeHexColor(value, '');
                  if (!normalized) return;
                  const rgb = hexToRgb(normalized);
                  setColorPickerRgb(rgb);
                  applyColorPickerValue(normalized);
                }}
              />

              <Text style={styles.themeLabel}>Rojo: {Math.round(colorPickerRgb.r)}</Text>
              <Slider
                minimumValue={0}
                maximumValue={255}
                step={1}
                minimumTrackTintColor="#ef4444"
                maximumTrackTintColor="#cbd5e1"
                value={colorPickerRgb.r}
                onValueChange={(value) => {
                  const next = { ...colorPickerRgb, r: Math.round(value) };
                  const hex = rgbToHex(next);
                  setColorPickerRgb(next);
                  setColorPickerHex(hex);
                  applyColorPickerValue(hex);
                }}
              />

              <Text style={styles.themeLabel}>Verde: {Math.round(colorPickerRgb.g)}</Text>
              <Slider
                minimumValue={0}
                maximumValue={255}
                step={1}
                minimumTrackTintColor="#22c55e"
                maximumTrackTintColor="#cbd5e1"
                value={colorPickerRgb.g}
                onValueChange={(value) => {
                  const next = { ...colorPickerRgb, g: Math.round(value) };
                  const hex = rgbToHex(next);
                  setColorPickerRgb(next);
                  setColorPickerHex(hex);
                  applyColorPickerValue(hex);
                }}
              />

              <Text style={styles.themeLabel}>Azul: {Math.round(colorPickerRgb.b)}</Text>
              <Slider
                minimumValue={0}
                maximumValue={255}
                step={1}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="#cbd5e1"
                value={colorPickerRgb.b}
                onValueChange={(value) => {
                  const next = { ...colorPickerRgb, b: Math.round(value) };
                  const hex = rgbToHex(next);
                  setColorPickerRgb(next);
                  setColorPickerHex(hex);
                  applyColorPickerValue(hex);
                }}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setColorPickerField(null)}>
                <Text style={styles.modalCancelText}>Cerrar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={fontPickerTarget != null}
        animationType="slide"
        transparent
        onRequestClose={() => setFontPickerTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Seleccionar Font</Text>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              <Pressable
                style={styles.fontOptionRow}
                onPress={() => {
                  onSelectFontFromPicker(null);
                }}
              >
                <Text style={styles.fontOptionTitle}>Default</Text>
                <Text style={styles.fontOptionMeta}>Fuente por defecto</Text>
              </Pressable>
              {MENU_FONTS.map((font) => (
                <Pressable
                  key={`font-picker-${fontPickerTarget || 'none'}-${font.name}`}
                  style={styles.fontOptionRow}
                  onPress={() => {
                    onSelectFontFromPicker(font);
                  }}
                >
                  <Text style={[styles.fontOptionTitle, { fontFamily: resolveNativeMenuFontFamily(font.name) }]}>
                    {font.name}
                  </Text>
                  <Text style={styles.fontOptionMeta}>{font.category}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setFontPickerTarget(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={sectionModalVisible} animationType="slide" transparent onRequestClose={() => setSectionModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingSectionId ? 'Editar Sección' : 'Nueva Sección'}</Text>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              <Text style={styles.inputLabel}>Título</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Aperitivos"
                value={sectionForm.titulo}
                onChangeText={(value) => setSectionForm((prev) => ({ ...prev, titulo: value }))}
              />

              <Text style={styles.inputLabel}>Subtítulo</Text>
              <TextInput
                style={styles.input}
                placeholder="Opcional"
                value={sectionForm.subtitulo}
                onChangeText={(value) => setSectionForm((prev) => ({ ...prev, subtitulo: value }))}
              />

              <Text style={styles.inputLabel}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Descripción de la sección"
                multiline
                value={sectionForm.descripcion}
                onChangeText={(value) => setSectionForm((prev) => ({ ...prev, descripcion: value }))}
              />

              <Text style={styles.inputLabel}>Orden</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={sectionForm.orden}
                onChangeText={(value) => setSectionForm((prev) => ({ ...prev, orden: value.replace(/[^0-9]/g, '') }))}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Sección activa</Text>
                <Switch
                  value={sectionForm.activo}
                  onValueChange={(value) => setSectionForm((prev) => ({ ...prev, activo: value }))}
                  trackColor={{ true: '#93c5fd', false: '#e2e8f0' }}
                  thumbColor={sectionForm.activo ? '#2563eb' : '#94a3b8'}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>No traducir título</Text>
                <Switch
                  value={sectionForm.noTraducir}
                  onValueChange={(value) => setSectionForm((prev) => ({ ...prev, noTraducir: value }))}
                  trackColor={{ true: '#fdba74', false: '#e2e8f0' }}
                  thumbColor={sectionForm.noTraducir ? '#ea580c' : '#94a3b8'}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setSectionModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={() => void onSaveSection()} disabled={savingSection}>
                <Text style={styles.modalSaveText}>{savingSection ? 'Guardando...' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={productModalVisible} animationType="slide" transparent onRequestClose={() => setProductModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingProductId ? 'Editar Producto' : 'Nuevo Producto'}</Text>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              <Text style={styles.inputLabel}>Nombre</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej. Mofongo relleno"
                value={productForm.nombre}
                onChangeText={(value) => setProductForm((prev) => ({ ...prev, nombre: value }))}
              />

              <Text style={styles.inputLabel}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Descripción del producto"
                multiline
                value={productForm.descripcion}
                onChangeText={(value) => setProductForm((prev) => ({ ...prev, descripcion: value }))}
              />

              <Text style={styles.inputLabel}>Precio</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="0.00"
                value={productForm.precio}
                onChangeText={(value) => setProductForm((prev) => ({ ...prev, precio: value.replace(/[^0-9.,]/g, '') }))}
              />

              <Text style={styles.inputLabel}>Orden</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={productForm.orden}
                onChangeText={(value) => setProductForm((prev) => ({ ...prev, orden: value.replace(/[^0-9]/g, '') }))}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Producto activo</Text>
                <Switch
                  value={productForm.activo}
                  onValueChange={(value) => setProductForm((prev) => ({ ...prev, activo: value }))}
                  trackColor={{ true: '#93c5fd', false: '#e2e8f0' }}
                  thumbColor={productForm.activo ? '#2563eb' : '#94a3b8'}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>No traducir nombre</Text>
                <Switch
                  value={productForm.noTraducirNombre}
                  onValueChange={(value) => setProductForm((prev) => ({ ...prev, noTraducirNombre: value }))}
                  trackColor={{ true: '#fdba74', false: '#e2e8f0' }}
                  thumbColor={productForm.noTraducirNombre ? '#ea580c' : '#94a3b8'}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setProductModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={() => void onSaveProduct()} disabled={savingProduct}>
                <Text style={styles.modalSaveText}>{savingProduct ? 'Guardando...' : 'Guardar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </BusinessChrome>
  );
}

const styles = StyleSheet.create({
  scrollWrap: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    color: '#0f172a',
    fontSize: 22,
  },
  cardBody: {
    fontFamily: fonts.regular,
    color: '#475569',
    fontSize: 16,
    lineHeight: 22,
  },
  summaryCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  commerceLogo: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  summaryMeta: {
    flex: 1,
    gap: 3,
  },
  commerceName: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: '#0f172a',
  },
  planBadge: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: '#1d4ed8',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kpiCard: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 78,
  },
  kpiLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#1e3a8a',
  },
  kpiValue: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: '#1d4ed8',
    lineHeight: 36,
  },
  blockedCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  blockedTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: '#92400e',
  },
  blockedBody: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#78350f',
    lineHeight: 21,
  },
  themeCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#f8fafc',
    padding: spacing.md,
    gap: spacing.sm,
  },
  themeTitle: {
    fontFamily: fonts.bold,
    fontSize: 19,
    color: '#0f172a',
  },
  themeLead: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  previewCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  previewTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#0f172a',
    textAlign: 'center',
  },
  previewSectionLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#334155',
    marginTop: spacing.xs,
  },
  previewAssetsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  previewAssetCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    gap: spacing.xs,
    backgroundColor: '#f8fafc',
  },
  previewAssetLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
  },
  previewAssetImage: {
    width: '100%',
    height: 64,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  previewAssetPlaceholder: {
    height: 64,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  previewAssetPlaceholderText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#64748b',
  },
  previewAssetActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  previewStage: {
    height: 360,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  previewBannerArea: {
    height: '42%',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    backgroundColor: 'transparent',
  },
  previewBannerImage: {
    width: '100%',
    height: '100%',
  },
  previewBannerFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: 'transparent',
  },
  previewBannerFallbackText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#cbd5e1',
  },
  previewBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  previewContent: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
    gap: spacing.xs,
    alignItems: 'center',
  },
  outlinedWrap: {
    position: 'relative',
    alignSelf: 'center',
    maxWidth: '100%',
  },
  outlinedLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
    includeFontPadding: false,
  },
  outlinedMain: {
    textAlign: 'center',
    includeFontPadding: false,
  },
  previewCommerceName: {
    fontFamily: fonts.bold,
    textAlign: 'center',
    lineHeight: 34,
  },
  previewMenuWord: {
    fontFamily: fonts.medium,
    textAlign: 'center',
    lineHeight: 30,
  },
  previewHiddenText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#e2e8f0',
    textAlign: 'center',
  },
  previewItemCard: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  previewContentCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: borderRadius.md,
    backgroundColor: '#f8fafc',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  previewTitleOnlyCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  previewProductsGrid: {
    gap: spacing.sm,
  },
  previewVariantWrap: {
    gap: spacing.xs,
  },
  previewVariantLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#64748b',
  },
  previewProductRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  previewItemImageMock: {
    width: 68,
    height: 68,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewItemImageMockText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: '#475569',
  },
  previewProductInfo: {
    flex: 1,
    gap: 4,
  },
  previewItemTitle: {
    fontFamily: fonts.bold,
    lineHeight: 24,
  },
  previewItemDesc: {
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  previewItemButton: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginTop: 2,
  },
  previewItemButtonText: {
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  previewMetaWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  previewMetaText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#475569',
  },
  previewEditorRows: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  previewEditorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#f8fafc',
  },
  previewEditorTextWrap: {
    flex: 1,
    minHeight: 28,
    justifyContent: 'center',
  },
  editTargetBtn: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  editTargetBtnActive: {
    borderColor: primaryOrange,
    backgroundColor: '#ffedd5',
  },
  editTargetBtnText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#334155',
  },
  editTargetBtnTextActive: {
    color: '#9a3412',
  },
  editorPanel: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.xs,
    backgroundColor: '#ffffff',
  },
  editorPanelTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#0f172a',
    textAlign: 'center',
  },
  advancedToggleBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  advancedToggleBtnText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#334155',
  },
  advancedWrap: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: borderRadius.md,
    backgroundColor: '#f8fafc',
    padding: spacing.sm,
  },
  fontDropdownBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontDropdownBtnText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: '#334155',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  themeField: {
    gap: 4,
  },
  themeImageActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlinePrimaryBtn: {
    flex: 1,
    borderRadius: borderRadius.md,
    backgroundColor: primaryBlue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
  },
  inlinePrimaryBtnText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#ffffff',
  },
  inlineNeutralBtn: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    minWidth: 78,
  },
  inlineNeutralBtnText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#334155',
  },
  themeImagePreview: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#e2e8f0',
    marginTop: 4,
  },
  themeFieldHalf: {
    width: '48%',
    gap: 4,
  },
  colorInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  colorSwatch: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  colorInput: {
    flex: 1,
  },
  colorPickerBtn: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
  },
  colorPickerBtnText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#334155',
  },
  colorPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 6,
  },
  colorPreset: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  themeLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#334155',
  },
  themeHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
  },
  readonlyValueWrap: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: borderRadius.md,
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  readonlyValueText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: '#0f172a',
  },
  alignRow: {
    gap: spacing.xs,
  },
  fontChipsRow: {
    gap: spacing.xs,
    paddingVertical: 4,
    paddingRight: spacing.sm,
  },
  fontChip: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fontChipActive: {
    borderColor: primaryOrange,
    backgroundColor: '#ffedd5',
  },
  fontChipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#334155',
  },
  fontChipTextActive: {
    color: '#9a3412',
  },
  alignButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  alignBtn: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  alignBtnActive: {
    borderColor: primaryOrange,
    backgroundColor: '#ffedd5',
  },
  alignBtnText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#334155',
  },
  alignBtnTextActive: {
    color: '#9a3412',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: borderRadius.md,
    backgroundColor: primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  primaryBtnText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: '#ffffff',
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  secondaryBtnText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: '#334155',
  },
  cloverCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#dcfce7',
    backgroundColor: '#f0fdf4',
    padding: spacing.md,
    gap: spacing.sm,
  },
  cloverTitle: {
    fontFamily: fonts.bold,
    fontSize: 19,
    color: '#14532d',
  },
  cloverBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#166534',
  },
  cloverActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cloverStatusWrap: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#dcfce7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  cloverStatus: {
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  statusConnected: {
    color: '#166534',
  },
  statusDisconnected: {
    color: '#991b1b',
  },
  cloverBtn: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#16a34a',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  cloverBtnText: {
    fontFamily: fonts.medium,
    color: '#166534',
    fontSize: 13,
  },
  cloverSyncBtn: {
    borderRadius: borderRadius.md,
    backgroundColor: '#16a34a',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  cloverSyncBtnText: {
    fontFamily: fonts.medium,
    color: '#ffffff',
    fontSize: 13,
  },
  sectionListWrap: {
    gap: spacing.sm,
  },
  emptyCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: '#334155',
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
  },
  sectionCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: '#f8fafc',
  },
  sectionHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: '#0f172a',
  },
  sectionMeta: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#64748b',
  },
  sectionState: {
    fontFamily: fonts.medium,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  stateOn: {
    color: '#166534',
    backgroundColor: '#dcfce7',
  },
  stateOff: {
    color: '#475569',
    backgroundColor: '#e2e8f0',
  },
  chevron: {
    fontFamily: fonts.medium,
    fontSize: 18,
    color: '#475569',
  },
  sectionBody: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  subtitulo: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: '#334155',
  },
  descripcion: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  sectionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  inlineBtn: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  inlineBtnText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#334155',
  },
  addProductBtn: {
    borderRadius: borderRadius.md,
    backgroundColor: primaryBlue,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  addProductBtnText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#ffffff',
  },
  emptyProducts: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  productCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  productImage: {
    width: 54,
    height: 54,
    borderRadius: borderRadius.sm,
  },
  productMeta: {
    flex: 1,
    gap: 2,
  },
  productName: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#0f172a',
  },
  productDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  productRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  productPrice: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#1d4ed8',
  },
  deleteText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#dc2626',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  colorPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: spacing.md,
    gap: spacing.sm,
  },
  colorPickerCard: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '78%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: spacing.md,
    gap: spacing.sm,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: '#0f172a',
    textAlign: 'center',
  },
  modalScroll: {
    maxHeight: 420,
  },
  modalContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  colorPickerWrap: {
    gap: spacing.xs,
  },
  colorPickerPreview: {
    height: 56,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  fontOptionRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  fontOptionTitle: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: '#0f172a',
  },
  fontOptionMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#64748b',
  },
  inputLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#334155',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  inputMultiline: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  switchRow: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: borderRadius.md,
    backgroundColor: '#f8fafc',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: '#334155',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  modalCancelText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: '#334155',
  },
  modalSaveBtn: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: primaryOrange,
  },
  modalSaveText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: '#ffffff',
  },
});
