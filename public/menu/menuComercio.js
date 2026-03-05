// menu/menuComercio.js
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../shared/supabaseClient.js';
import { getMenuI18n, clearMenuI18nCache } from '../shared/menuI18n.js';
import { mountLangSelector } from '../shared/langSelector.js';
import { getLang } from '../js/i18n.js';
import { resolverPlanComercio } from '../shared/planes.js';

const params = new URLSearchParams(window.location.search);
const idComercio = params.get('idComercio') || params.get('id');
const modeParam = (params.get('modo') || params.get('mode') || 'view').toLowerCase();
const mesaParam = (params.get('mesa') || params.get('table') || '').trim();
const sourceParam = (params.get('source') || '').toLowerCase();
const orderMode = modeParam === 'mesa' ? 'mesa' : modeParam === 'pickup' ? 'pickup' : 'view';
const allowPickup = orderMode === 'pickup' && sourceParam === 'app';
const allowMesa = orderMode === 'mesa';
const allowOrdering = allowPickup || allowMesa;
const orderSource = allowPickup ? 'app' : allowMesa ? 'qr' : 'qr';
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
const seccionesEl = document.getElementById('seccionesMenu');
const btnVolver = document.getElementById('btnVolver');
const btnMenuPdf = document.getElementById('btnMenuPdf');
const heroPortada = document.getElementById('heroPortada');
const heroOverlay = document.getElementById('heroOverlay');
const heroImg = document.getElementById('heroImg');
const heroNombre = document.getElementById('heroNombre');
const heroMenuWord = document.getElementById('heroMenuWord');
let seccionActivaWrapper = null;
const footerLogoComercio = document.getElementById('footerLogoComercio');
const footerNombreComercio = document.getElementById('footerNombreComercio');
const footerTelefono = document.getElementById('footerTelefono');
const footerFacebook = document.getElementById('footerFacebook');
const footerInstagram = document.getElementById('footerInstagram');
const isDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const ORDER_HISTORY_KEY = 'findixi_orders';
let planPermiteMenu = true;
let planPermiteOrdenes = true;

function loadOrderHistory() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ORDER_HISTORY_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return data
        .map((item) => {
          if (typeof item === 'number' || typeof item === 'string') return { id: Number(item) };
          return item && typeof item === 'object' ? item : null;
        })
        .filter((item) => item && Number.isFinite(Number(item.id)));
    }
    return [];
  } catch {
    return [];
  }
}

function saveOrderHistory(list) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function rememberOrder(orderId, comercioId) {
  const idNum = Number(orderId);
  if (!Number.isFinite(idNum) || idNum <= 0) return;
  const history = loadOrderHistory();
  if (history.some((entry) => Number(entry.id) === idNum)) return;
  history.unshift({
    id: idNum,
    idComercio: Number(comercioId) || null,
    created_at_local: new Date().toISOString(),
  });
  saveOrderHistory(history.slice(0, 50));
}

function mostrarBloqueoMenu({
  titulo = 'Menú disponible en Findixi Plus',
  mensaje = 'Este comercio aún no tiene habilitado su menú en Findixi.',
} = {}) {
  const existente = document.getElementById('menuPlanOverlay');
  if (existente) return;
  const overlay = document.createElement('div');
  overlay.id = 'menuPlanOverlay';
  overlay.className = 'fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center space-y-3">
      <h2 class="text-xl font-semibold text-gray-900">${titulo}</h2>
      <p class="text-sm text-gray-600">${mensaje}</p>
      <a href="../listadoComercios.html" class="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
        Volver al listado
      </a>
    </div>
  `;
  document.body.appendChild(overlay);
}

function comercioVerificado(comercio = {}) {
  const estadoPropiedad = String(comercio?.estado_propiedad || '').toLowerCase();
  const estadoVerificacion = String(comercio?.estado_verificacion || '').toLowerCase();
  const propietarioVerificado = comercio?.propietario_verificado === true;
  const verificacionOk = ['otp_verificado', 'sms_verificado', 'messenger_verificado', 'manual_aprobado'].includes(
    estadoVerificacion
  );
  return estadoPropiedad === 'verificado' && (propietarioVerificado || verificacionOk);
}

const DEFAULT_TEMA = {
  colortexto: '#1f2937',
  colortitulo: '#111827',
  colorprecio: '#2563eb',
  colorboton: '#2563eb',
  colorbotontexto: '#ffffff',
  fontbody_size: 16,
  fonttitle_size: 18,
  nombre_font_size: 28,
  menu_font_size: 20,
  seccion_desc_font_family: null,
  seccion_desc_font_url: null,
  seccion_desc_font_size: 14,
  seccion_desc_color: null,
  colorComercio: '#111827',
  colorMenu: '#111827',
  overlayoscuro: 40,
  pdfurl: '',
  colorBotonPDF: 'rgba(37, 99, 235, 0.8)',
  portadaimagen: '',
  backgroundimagen: '',
  backgroundcolor: '#ffffff',
  textomenu: 'Menú',
  ocultar_nombre: false,
  ocultar_menu: false,
  fontbodyfamily: null,
  fontbodyurl: null,
  fonttitlefamily: null,
  fonttitleurl: null,
  fontnombrefamily: null,
  fontnombreurl: null,
  fontmenuwordfamily: null,
  fontmenuwordurl: null,
  nombre_shadow: '',
  nombre_stroke_width: 0,
  nombre_stroke_color: '#000000',
  menu_shadow: '',
  menu_stroke_width: 0,
  menu_stroke_color: '#000000',
  titulos_shadow: '',
  titulos_stroke_width: 0,
  titulos_stroke_color: '#000000',
  boton_shadow: '',
  boton_stroke_width: 0,
  boton_stroke_color: '#000000',
  item_bg_color: '#ffffff',
  item_overlay: 0,
  productoAlign: 'left',
};

let temaActual = { ...DEFAULT_TEMA };
let linkFuente = null;
let coverUrl = '';
let backgroundUrl = '';
const fontLinks = new Set();
let menusBase = [];
let productosBase = [];
let productosView = [];
const productosById = new Map();
const menuViewById = new Map(); // idMenu -> { menu, productos }
let renderToken = 0;
let seccionActivaId = null;
const menuButtons = new Map(); // idMenu -> { btn, titleEl, descEl }

let cartState = { items: [] };
let cartDrawer = null;
let cartBar = null;
let cartBarPlaceholder = null;
let cartBarInitialTop = 0;
let cartBarSticky = false;
let cartKey = null;
let modifiersDrawer = null;
let currentModifiersProduct = null;
let currentEditLine = null;
const modifierGroupsCache = new Map();
const modifierItemsCache = new Map();
const modifierItemGroupMap = new Map();
const modifierMapBuiltForProduct = new Set();
let productTaxMap = new Map();
let defaultTaxRates = [];
let taxRateDenominator = 10000000;

const getCurrentLang = () => {
  const stored = (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || '';
  const docLang = (typeof document !== 'undefined' && document.documentElement?.lang) || '';
  const fallback = getLang ? getLang() : 'es';
  return (stored || docLang || fallback || 'es').toLowerCase().split('-')[0];
};

const ORDER_TEXTS = {
  es: {
    viewOrder: 'Ver Orden',
    add: 'Agregar',
    customizeOrder: 'Personaliza tu orden',
    cancel: 'Cancelar',
    notesOptional: 'Notas (opcional)',
    notePlaceholder: 'Ej: sin cebolla, salsa aparte',
    addToCart: 'Agregar al carrito',
    saveChanges: 'Guardar cambios',
    loadingOptions: 'Cargando opciones...',
    optionsLoadError: 'No se pudieron cargar opciones.',
    noOptionsProduct: 'Este producto no tiene opciones.',
    requiredWithMin: 'Requerido (min {min})',
    required: 'Requerido',
    optional: 'Opcional',
    maxFmt: 'max {max}',
    noOptionsAvailable: 'Sin opciones disponibles.',
    maxSelectAlert: 'Puedes seleccionar maximo {max} opciones.',
    groupRequiredAlert: 'Debes elegir al menos {min} opcion(es) en "{group}".',
    optionGroupFallback: 'Opciones',
    optionItemFallback: 'Opcion',
    cartTitle: 'Tu pedido',
    close: 'Cerrar',
    customerFieldsTitle: 'Datos para el recibo',
    firstName: 'Nombre',
    lastName: 'Apellido',
    phone: 'Telefono',
    email: 'Email',
    phonePlaceholder: '787-000-0000',
    emailPlaceholder: 'correo@ejemplo.com',
    phoneHelp: 'Necesario para enviarte el enlace del pedido.',
    emailHelp: 'El recibo sera enviado a este email.',
    subtotal: 'Subtotal',
    tax: 'Tax',
    total: 'Total',
    emptyCart: 'Tu carrito esta vacio.',
    noteLabel: 'Nota',
    lineTotal: 'Total',
    edit: 'Editar',
    remove: 'Eliminar',
    deleteConfirmFmt: 'Seguro deseas eliminar {name} del pedido?',
    addedItemFmt: '{name} anadido correctamente',
    updatedItemFmt: '{name} actualizado correctamente',
    checkoutPickup: 'Proceder con el pago',
    checkoutMesa: 'Enviar orden a cocina',
    premiumOnly: 'Las ordenes en linea estan disponibles solo en Findixi Premium.',
    completePickup: 'Por favor completa nombre, apellido, telefono y email antes de pagar.',
    invalidEmail: 'Ingresa un email valido para recibir el recibo.',
    invalidPhone: 'Ingresa un telefono valido.',
    reconnectClover: 'Este comercio debe reconectar Clover para aceptar pagos.',
    orderCreateErrorFmt: 'Error creando orden ({status})',
    paymentLinkError: 'No se pudo obtener el enlace de pago.',
    orderSentMesa: 'Orden enviada. El pago se realiza en el local.',
    unexpectedOrderError: 'Error inesperado al enviar la orden.',
    productFallbackFmt: 'Producto {id}',
  },
  en: {
    viewOrder: 'View Order',
    add: 'Add',
    customizeOrder: 'Customize your order',
    cancel: 'Cancel',
    notesOptional: 'Notes (optional)',
    notePlaceholder: 'e.g. no onions, sauce on the side',
    addToCart: 'Add to cart',
    saveChanges: 'Save changes',
    loadingOptions: 'Loading options...',
    optionsLoadError: 'Could not load options.',
    noOptionsProduct: 'This product has no options.',
    requiredWithMin: 'Required (min {min})',
    required: 'Required',
    optional: 'Optional',
    maxFmt: 'max {max}',
    noOptionsAvailable: 'No options available.',
    maxSelectAlert: 'You can select a maximum of {max} options.',
    groupRequiredAlert: 'You must select at least {min} option(s) in "{group}".',
    optionGroupFallback: 'Options',
    optionItemFallback: 'Option',
    cartTitle: 'Your order',
    close: 'Close',
    customerFieldsTitle: 'Receipt information',
    firstName: 'First name',
    lastName: 'Last name',
    phone: 'Phone',
    email: 'Email',
    phonePlaceholder: '787-000-0000',
    emailPlaceholder: 'email@example.com',
    phoneHelp: 'Required to send your order link.',
    emailHelp: 'Receipt will be sent to this email.',
    subtotal: 'Subtotal',
    tax: 'Tax',
    total: 'Total',
    emptyCart: 'Your cart is empty.',
    noteLabel: 'Note',
    lineTotal: 'Total',
    edit: 'Edit',
    remove: 'Remove',
    deleteConfirmFmt: 'Are you sure you want to remove {name} from the order?',
    addedItemFmt: '{name} added successfully',
    updatedItemFmt: '{name} updated successfully',
    checkoutPickup: 'Proceed to payment',
    checkoutMesa: 'Send order to kitchen',
    premiumOnly: 'Online orders are available only with Findixi Premium.',
    completePickup: 'Please complete first name, last name, phone and email before checkout.',
    invalidEmail: 'Enter a valid email to receive the receipt.',
    invalidPhone: 'Enter a valid phone number.',
    reconnectClover: 'This business must reconnect Clover to accept payments.',
    orderCreateErrorFmt: 'Error creating order ({status})',
    paymentLinkError: 'Could not get payment link.',
    orderSentMesa: 'Order sent. Payment is completed at the store.',
    unexpectedOrderError: 'Unexpected error sending the order.',
    productFallbackFmt: 'Product {id}',
  },
  fr: {
    viewOrder: 'Voir la commande',
    add: 'Ajouter',
    customizeOrder: 'Personnalisez votre commande',
    cancel: 'Annuler',
    notesOptional: 'Notes (facultatif)',
    notePlaceholder: 'Ex : sans oignon, sauce a part',
    addToCart: 'Ajouter au panier',
    saveChanges: 'Enregistrer les modifications',
    loadingOptions: 'Chargement des options...',
    optionsLoadError: 'Impossible de charger les options.',
    noOptionsProduct: "Ce produit n'a pas d'options.",
    requiredWithMin: 'Obligatoire (min {min})',
    required: 'Obligatoire',
    optional: 'Optionnel',
    maxFmt: 'max {max}',
    noOptionsAvailable: 'Aucune option disponible.',
    maxSelectAlert: 'Vous pouvez selectionner un maximum de {max} options.',
    groupRequiredAlert: 'Vous devez choisir au moins {min} option(s) dans "{group}".',
    optionGroupFallback: 'Options',
    optionItemFallback: 'Option',
    cartTitle: 'Votre commande',
    close: 'Fermer',
    customerFieldsTitle: 'Informations pour le recu',
    firstName: 'Prenom',
    lastName: 'Nom',
    phone: 'Telephone',
    email: 'E-mail',
    phonePlaceholder: '787-000-0000',
    emailPlaceholder: 'email@exemple.com',
    phoneHelp: 'Necessaire pour vous envoyer le lien de commande.',
    emailHelp: 'Le recu sera envoye a cet e-mail.',
    subtotal: 'Sous-total',
    tax: 'Taxe',
    total: 'Total',
    emptyCart: 'Votre panier est vide.',
    noteLabel: 'Note',
    lineTotal: 'Total',
    edit: 'Modifier',
    remove: 'Supprimer',
    deleteConfirmFmt: 'Voulez-vous vraiment supprimer {name} de la commande ?',
    addedItemFmt: '{name} ajoute avec succes',
    updatedItemFmt: '{name} mis a jour avec succes',
    checkoutPickup: 'Proceder au paiement',
    checkoutMesa: 'Envoyer la commande en cuisine',
    premiumOnly: 'Les commandes en ligne sont disponibles uniquement avec Findixi Premium.',
    completePickup: 'Veuillez completer prenom, nom, telephone et e-mail avant de payer.',
    invalidEmail: 'Entrez un e-mail valide pour recevoir le recu.',
    invalidPhone: 'Entrez un numero de telephone valide.',
    reconnectClover: 'Ce commerce doit reconnecter Clover pour accepter les paiements.',
    orderCreateErrorFmt: 'Erreur lors de la creation de la commande ({status})',
    paymentLinkError: 'Impossible d obtenir le lien de paiement.',
    orderSentMesa: 'Commande envoyee. Le paiement se fait sur place.',
    unexpectedOrderError: "Erreur inattendue lors de l'envoi de la commande.",
    productFallbackFmt: 'Produit {id}',
  },
  pt: {
    viewOrder: 'Ver Pedido',
    add: 'Adicionar',
    customizeOrder: 'Personalize seu pedido',
    cancel: 'Cancelar',
    notesOptional: 'Notas (opcional)',
    notePlaceholder: 'Ex: sem cebola, molho a parte',
    addToCart: 'Adicionar ao carrinho',
    saveChanges: 'Salvar alteracoes',
    loadingOptions: 'Carregando opcoes...',
    optionsLoadError: 'Nao foi possivel carregar as opcoes.',
    noOptionsProduct: 'Este produto nao tem opcoes.',
    requiredWithMin: 'Obrigatorio (min {min})',
    required: 'Obrigatorio',
    optional: 'Opcional',
    maxFmt: 'max {max}',
    noOptionsAvailable: 'Sem opcoes disponiveis.',
    maxSelectAlert: 'Voce pode selecionar no maximo {max} opcoes.',
    groupRequiredAlert: 'Voce deve escolher pelo menos {min} opcao(oes) em "{group}".',
    optionGroupFallback: 'Opcoes',
    optionItemFallback: 'Opcao',
    cartTitle: 'Seu pedido',
    close: 'Fechar',
    customerFieldsTitle: 'Dados para o recibo',
    firstName: 'Nome',
    lastName: 'Sobrenome',
    phone: 'Telefone',
    email: 'E-mail',
    phonePlaceholder: '787-000-0000',
    emailPlaceholder: 'email@exemplo.com',
    phoneHelp: 'Necessario para enviar o link do pedido.',
    emailHelp: 'O recibo sera enviado para este e-mail.',
    subtotal: 'Subtotal',
    tax: 'Imposto',
    total: 'Total',
    emptyCart: 'Seu carrinho esta vazio.',
    noteLabel: 'Nota',
    lineTotal: 'Total',
    edit: 'Editar',
    remove: 'Remover',
    deleteConfirmFmt: 'Tem certeza de que deseja remover {name} do pedido?',
    addedItemFmt: '{name} adicionado com sucesso',
    updatedItemFmt: '{name} atualizado com sucesso',
    checkoutPickup: 'Prosseguir para pagamento',
    checkoutMesa: 'Enviar pedido para a cozinha',
    premiumOnly: 'Pedidos online estao disponiveis somente no Findixi Premium.',
    completePickup: 'Preencha nome, sobrenome, telefone e e-mail antes de pagar.',
    invalidEmail: 'Informe um e-mail valido para receber o recibo.',
    invalidPhone: 'Informe um telefone valido.',
    reconnectClover: 'Este comercio precisa reconectar o Clover para aceitar pagamentos.',
    orderCreateErrorFmt: 'Erro ao criar pedido ({status})',
    paymentLinkError: 'Nao foi possivel obter o link de pagamento.',
    orderSentMesa: 'Pedido enviado. O pagamento e feito no local.',
    unexpectedOrderError: 'Erro inesperado ao enviar o pedido.',
    productFallbackFmt: 'Produto {id}',
  },
  de: {
    viewOrder: 'Bestellung ansehen',
    add: 'Hinzufugen',
    customizeOrder: 'Passe deine Bestellung an',
    cancel: 'Abbrechen',
    notesOptional: 'Notizen (optional)',
    notePlaceholder: 'z. B. ohne Zwiebeln, Sauce separat',
    addToCart: 'In den Warenkorb',
    saveChanges: 'Anderungen speichern',
    loadingOptions: 'Optionen werden geladen...',
    optionsLoadError: 'Optionen konnten nicht geladen werden.',
    noOptionsProduct: 'Dieses Produkt hat keine Optionen.',
    requiredWithMin: 'Erforderlich (min {min})',
    required: 'Erforderlich',
    optional: 'Optional',
    maxFmt: 'max {max}',
    noOptionsAvailable: 'Keine Optionen verfugbar.',
    maxSelectAlert: 'Du kannst maximal {max} Optionen auswahlen.',
    groupRequiredAlert: 'Du musst mindestens {min} Option(en) in "{group}" auswahlen.',
    optionGroupFallback: 'Optionen',
    optionItemFallback: 'Option',
    cartTitle: 'Deine Bestellung',
    close: 'Schliessen',
    customerFieldsTitle: 'Daten fur den Beleg',
    firstName: 'Vorname',
    lastName: 'Nachname',
    phone: 'Telefon',
    email: 'E-Mail',
    phonePlaceholder: '787-000-0000',
    emailPlaceholder: 'email@beispiel.com',
    phoneHelp: 'Erforderlich, um dir den Bestelllink zu senden.',
    emailHelp: 'Der Beleg wird an diese E-Mail gesendet.',
    subtotal: 'Zwischensumme',
    tax: 'Steuer',
    total: 'Gesamt',
    emptyCart: 'Dein Warenkorb ist leer.',
    noteLabel: 'Notiz',
    lineTotal: 'Gesamt',
    edit: 'Bearbeiten',
    remove: 'Entfernen',
    deleteConfirmFmt: 'Mochtest du {name} wirklich aus der Bestellung entfernen?',
    addedItemFmt: '{name} erfolgreich hinzugefugt',
    updatedItemFmt: '{name} erfolgreich aktualisiert',
    checkoutPickup: 'Zur Zahlung',
    checkoutMesa: 'Bestellung an die Kuche senden',
    premiumOnly: 'Online-Bestellungen sind nur mit Findixi Premium verfugbar.',
    completePickup: 'Bitte Vorname, Nachname, Telefon und E-Mail vor der Zahlung ausfullen.',
    invalidEmail: 'Gib eine gultige E-Mail fur den Beleg ein.',
    invalidPhone: 'Gib eine gultige Telefonnummer ein.',
    reconnectClover: 'Dieses Geschaft muss Clover erneut verbinden, um Zahlungen anzunehmen.',
    orderCreateErrorFmt: 'Fehler beim Erstellen der Bestellung ({status})',
    paymentLinkError: 'Zahlungslink konnte nicht abgerufen werden.',
    orderSentMesa: 'Bestellung gesendet. Die Zahlung erfolgt vor Ort.',
    unexpectedOrderError: 'Unerwarteter Fehler beim Senden der Bestellung.',
    productFallbackFmt: 'Produkt {id}',
  },
  it: {
    viewOrder: 'Vedi ordine',
    add: 'Aggiungi',
    customizeOrder: 'Personalizza il tuo ordine',
    cancel: 'Annulla',
    notesOptional: 'Note (opzionale)',
    notePlaceholder: 'Es: senza cipolla, salsa a parte',
    addToCart: 'Aggiungi al carrello',
    saveChanges: 'Salva modifiche',
    loadingOptions: 'Caricamento opzioni...',
    optionsLoadError: 'Impossibile caricare le opzioni.',
    noOptionsProduct: 'Questo prodotto non ha opzioni.',
    requiredWithMin: 'Obbligatorio (min {min})',
    required: 'Obbligatorio',
    optional: 'Opzionale',
    maxFmt: 'max {max}',
    noOptionsAvailable: 'Nessuna opzione disponibile.',
    maxSelectAlert: 'Puoi selezionare un massimo di {max} opzioni.',
    groupRequiredAlert: 'Devi scegliere almeno {min} opzione(i) in "{group}".',
    optionGroupFallback: 'Opzioni',
    optionItemFallback: 'Opzione',
    cartTitle: 'Il tuo ordine',
    close: 'Chiudi',
    customerFieldsTitle: 'Dati per la ricevuta',
    firstName: 'Nome',
    lastName: 'Cognome',
    phone: 'Telefono',
    email: 'Email',
    phonePlaceholder: '787-000-0000',
    emailPlaceholder: 'email@esempio.com',
    phoneHelp: "Necessario per inviarti il link dell'ordine.",
    emailHelp: 'La ricevuta verra inviata a questa email.',
    subtotal: 'Subtotale',
    tax: 'Tassa',
    total: 'Totale',
    emptyCart: 'Il tuo carrello e vuoto.',
    noteLabel: 'Nota',
    lineTotal: 'Totale',
    edit: 'Modifica',
    remove: 'Rimuovi',
    deleteConfirmFmt: 'Sei sicuro di voler rimuovere {name} dall ordine?',
    addedItemFmt: '{name} aggiunto correttamente',
    updatedItemFmt: '{name} aggiornato correttamente',
    checkoutPickup: 'Procedi al pagamento',
    checkoutMesa: 'Invia ordine in cucina',
    premiumOnly: 'Gli ordini online sono disponibili solo con Findixi Premium.',
    completePickup: 'Completa nome, cognome, telefono ed email prima di pagare.',
    invalidEmail: 'Inserisci una email valida per ricevere la ricevuta.',
    invalidPhone: 'Inserisci un numero di telefono valido.',
    reconnectClover: 'Questo commercio deve ricollegare Clover per accettare pagamenti.',
    orderCreateErrorFmt: 'Errore nella creazione ordine ({status})',
    paymentLinkError: 'Impossibile ottenere il link di pagamento.',
    orderSentMesa: 'Ordine inviato. Il pagamento si effettua nel locale.',
    unexpectedOrderError: "Errore imprevisto durante l'invio dell ordine.",
    productFallbackFmt: 'Prodotto {id}',
  },
  zh: {
    viewOrder: '查看订单',
    add: '添加',
    customizeOrder: '自定义你的订单',
    cancel: '取消',
    notesOptional: '备注（可选）',
    notePlaceholder: '例如：不要洋葱，酱汁另放',
    addToCart: '加入购物车',
    saveChanges: '保存更改',
    loadingOptions: '正在加载选项...',
    optionsLoadError: '无法加载选项。',
    noOptionsProduct: '该商品没有可选项。',
    requiredWithMin: '必选（最少 {min}）',
    required: '必选',
    optional: '可选',
    maxFmt: '最多 {max}',
    noOptionsAvailable: '暂无可选项。',
    maxSelectAlert: '你最多可以选择 {max} 个选项。',
    groupRequiredAlert: '你必须在“{group}”中至少选择 {min} 个选项。',
    optionGroupFallback: '选项',
    optionItemFallback: '选项',
    cartTitle: '你的订单',
    close: '关闭',
    customerFieldsTitle: '收据信息',
    firstName: '名字',
    lastName: '姓氏',
    phone: '电话',
    email: '邮箱',
    phonePlaceholder: '787-000-0000',
    emailPlaceholder: 'email@example.com',
    phoneHelp: '用于发送订单链接。',
    emailHelp: '收据将发送到该邮箱。',
    subtotal: '小计',
    tax: '税费',
    total: '总计',
    emptyCart: '你的购物车为空。',
    noteLabel: '备注',
    lineTotal: '总计',
    edit: '编辑',
    remove: '删除',
    deleteConfirmFmt: '确定要从订单中删除 {name} 吗？',
    addedItemFmt: '{name} 已成功添加',
    updatedItemFmt: '{name} 已成功更新',
    checkoutPickup: '去付款',
    checkoutMesa: '发送订单到厨房',
    premiumOnly: '在线下单仅适用于 Findixi Premium。',
    completePickup: '付款前请填写名字、姓氏、电话和邮箱。',
    invalidEmail: '请输入有效邮箱以接收收据。',
    invalidPhone: '请输入有效电话号码。',
    reconnectClover: '该商家需要重新连接 Clover 才能收款。',
    orderCreateErrorFmt: '创建订单出错（{status}）',
    paymentLinkError: '无法获取付款链接。',
    orderSentMesa: '订单已发送。请到店付款。',
    unexpectedOrderError: '发送订单时发生意外错误。',
    productFallbackFmt: '商品 {id}',
  },
  ko: {
    viewOrder: '주문 보기',
    add: '추가',
    customizeOrder: '주문을 맞춤 설정하세요',
    cancel: '취소',
    notesOptional: '메모(선택)',
    notePlaceholder: '예: 양파 빼고, 소스는 따로',
    addToCart: '장바구니에 추가',
    saveChanges: '변경사항 저장',
    loadingOptions: '옵션을 불러오는 중...',
    optionsLoadError: '옵션을 불러올 수 없습니다.',
    noOptionsProduct: '이 상품에는 옵션이 없습니다.',
    requiredWithMin: '필수 (최소 {min})',
    required: '필수',
    optional: '선택',
    maxFmt: '최대 {max}',
    noOptionsAvailable: '사용 가능한 옵션이 없습니다.',
    maxSelectAlert: '최대 {max}개 옵션까지 선택할 수 있습니다.',
    groupRequiredAlert: '"{group}"에서 최소 {min}개를 선택해야 합니다.',
    optionGroupFallback: '옵션',
    optionItemFallback: '옵션',
    cartTitle: '내 주문',
    close: '닫기',
    customerFieldsTitle: '영수증 정보',
    firstName: '이름',
    lastName: '성',
    phone: '전화번호',
    email: '이메일',
    phonePlaceholder: '787-000-0000',
    emailPlaceholder: 'email@example.com',
    phoneHelp: '주문 링크 전송에 필요합니다.',
    emailHelp: '영수증이 이 이메일로 전송됩니다.',
    subtotal: '소계',
    tax: '세금',
    total: '합계',
    emptyCart: '장바구니가 비어 있습니다.',
    noteLabel: '메모',
    lineTotal: '합계',
    edit: '수정',
    remove: '삭제',
    deleteConfirmFmt: '주문에서 {name}을(를) 삭제하시겠습니까?',
    addedItemFmt: '{name}이(가) 성공적으로 추가되었습니다',
    updatedItemFmt: '{name}이(가) 성공적으로 업데이트되었습니다',
    checkoutPickup: '결제로 진행',
    checkoutMesa: '주문을 주방으로 보내기',
    premiumOnly: '온라인 주문은 Findixi Premium에서만 가능합니다.',
    completePickup: '결제 전에 이름, 성, 전화번호, 이메일을 입력하세요.',
    invalidEmail: '영수증 수신을 위해 올바른 이메일을 입력하세요.',
    invalidPhone: '올바른 전화번호를 입력하세요.',
    reconnectClover: '결제를 받으려면 이 상점이 Clover를 다시 연결해야 합니다.',
    orderCreateErrorFmt: '주문 생성 오류 ({status})',
    paymentLinkError: '결제 링크를 가져올 수 없습니다.',
    orderSentMesa: '주문이 전송되었습니다. 결제는 매장에서 진행됩니다.',
    unexpectedOrderError: '주문 전송 중 예기치 않은 오류가 발생했습니다.',
    productFallbackFmt: '상품 {id}',
  },
  ja: {
    viewOrder: '注文を見る',
    add: '追加',
    customizeOrder: '注文をカスタマイズ',
    cancel: 'キャンセル',
    notesOptional: 'メモ（任意）',
    notePlaceholder: '例：玉ねぎ抜き、ソース別添え',
    addToCart: 'カートに追加',
    saveChanges: '変更を保存',
    loadingOptions: 'オプションを読み込み中...',
    optionsLoadError: 'オプションを読み込めませんでした。',
    noOptionsProduct: 'この商品にはオプションがありません。',
    requiredWithMin: '必須（最小 {min}）',
    required: '必須',
    optional: '任意',
    maxFmt: '最大 {max}',
    noOptionsAvailable: '利用可能なオプションがありません。',
    maxSelectAlert: '最大 {max} 個まで選択できます。',
    groupRequiredAlert: '"{group}" で少なくとも {min} 個選択してください。',
    optionGroupFallback: 'オプション',
    optionItemFallback: 'オプション',
    cartTitle: 'あなたの注文',
    close: '閉じる',
    customerFieldsTitle: '領収書情報',
    firstName: '名',
    lastName: '姓',
    phone: '電話',
    email: 'メール',
    phonePlaceholder: '787-000-0000',
    emailPlaceholder: 'email@example.com',
    phoneHelp: '注文リンク送信に必要です。',
    emailHelp: '領収書はこのメールに送信されます。',
    subtotal: '小計',
    tax: '税金',
    total: '合計',
    emptyCart: 'カートは空です。',
    noteLabel: 'メモ',
    lineTotal: '合計',
    edit: '編集',
    remove: '削除',
    deleteConfirmFmt: '注文から {name} を削除してもよろしいですか？',
    addedItemFmt: '{name} を追加しました',
    updatedItemFmt: '{name} を更新しました',
    checkoutPickup: '支払いに進む',
    checkoutMesa: '注文をキッチンに送信',
    premiumOnly: 'オンライン注文は Findixi Premium のみ利用可能です。',
    completePickup: '支払い前に名、姓、電話、メールを入力してください。',
    invalidEmail: '領収書受信用に有効なメールを入力してください。',
    invalidPhone: '有効な電話番号を入力してください。',
    reconnectClover: '支払いを受け付けるには Clover の再接続が必要です。',
    orderCreateErrorFmt: '注文作成エラー（{status}）',
    paymentLinkError: '支払いリンクを取得できませんでした。',
    orderSentMesa: '注文を送信しました。支払いは店舗で行います。',
    unexpectedOrderError: '注文送信中に予期しないエラーが発生しました。',
    productFallbackFmt: '商品 {id}',
  },
};

function formatOrderText(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : `{${key}}`));
}

function getOrderTexts() {
  const lang = getCurrentLang();
  return ORDER_TEXTS[lang] || ORDER_TEXTS.en;
}

function orderText(key, vars = {}) {
  const texts = getOrderTexts();
  const fallback = ORDER_TEXTS.en?.[key] || ORDER_TEXTS.es?.[key] || key;
  return formatOrderText(texts?.[key] || fallback, vars);
}

const LOADER_TEXTS = {
  es: 'Traduciendo menu...',
  en: 'Translating menu...',
  fr: 'Traduction du menu...',
  pt: 'Traduzindo menu...',
  de: 'Menu wird ubersetzt...',
  it: 'Traduzione del menu...',
  zh: '正在翻译菜单...',
  ko: '메뉴 번역 중...',
  ja: 'メニューを翻訳中...',
};

function getLoaderText() {
  const lang = getCurrentLang();
  return LOADER_TEXTS[lang] || LOADER_TEXTS.en;
}

function applyLoaderLanguage() {
  const loaderText = document.getElementById('globalLoaderText');
  if (!loaderText) return;
  loaderText.textContent = getLoaderText();
}

const showGlobalLoader = () => {
  const loader = document.getElementById('globalLoader');
  if (!loader) return;
  applyLoaderLanguage();
  loader.classList.remove('hidden', 'opacity-0');
  loader.classList.add('flex', 'opacity-100');
};

const hideGlobalLoader = () => {
  const loader = document.getElementById('globalLoader');
  if (!loader) return;
  loader.classList.remove('opacity-100');
  loader.classList.add('opacity-0');
  setTimeout(() => {
    loader.classList.remove('flex');
    loader.classList.add('hidden');
  }, 200);
};

function cacheBust(url) {
  if (!url) return '';
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}cb=${Date.now()}`;
}

function parseColorToHexAlpha(color, defaultHex = '#2563eb', defaultAlpha = 0.8) {
  if (!color) return { hex: defaultHex, alpha: defaultAlpha };
  if (color.startsWith('rgb')) {
    const parts = color.replace(/rgba?\(|\)/g, '').split(',').map((v) => v.trim());
    const [r = 0, g = 0, b = 0, a = defaultAlpha] = parts;
    const hex = `#${[r, g, b]
      .map((n) => {
        const num = parseInt(n, 10);
        const clamped = Number.isFinite(num) ? Math.min(Math.max(num, 0), 255) : 0;
        return clamped.toString(16).padStart(2, '0');
      })
      .join('')}`;
    const alpha = Number.parseFloat(a) || defaultAlpha;
    return { hex, alpha: Math.min(Math.max(alpha, 0), 1) };
  }
  const hex = color.startsWith('#') ? color : `#${color}`;
  return { hex, alpha: defaultAlpha };
}

function ensureFontLink(url) {
  if (!url) return;
  // Si ya se cargó
  if (fontLinks.has(url)) return;
  const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
    (l) => l.href === url
  );
  if (existing) {
    fontLinks.add(url);
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
  fontLinks.add(url);
}

function aplicarFuentePublica(fuente) {
  if (!fuente?.url || !fuente.name) return;
  ensureFontLink(fuente.url);
}

function setCssVars() {
  const t = temaActual;
  document.body.style.setProperty('--menu-color-texto', t.colortexto);
  document.body.style.setProperty('--menu-color-titulo', t.colortitulo);
  document.body.style.setProperty('--menu-color-precio', t.colorprecio);
  document.body.style.setProperty('--menu-color-boton', t.colorboton);
  document.body.style.setProperty('--menu-color-boton-texto', t.colorbotontexto);
  document.body.style.color = t.colortexto || '#1f2937';

  if (backgroundUrl) {
    const alpha = Math.min(Math.max(Number(t.overlayoscuro) || 0, 0), 80) / 100;
    const bgColor = t.backgroundcolor || '#ffffff';
    document.body.style.backgroundImage = `linear-gradient(rgba(0,0,0,${alpha}), rgba(0,0,0,${alpha})), url(${backgroundUrl})`;
    document.body.style.backgroundColor = bgColor;
    document.body.style.backgroundSize = '100% auto';
    document.body.style.backgroundRepeat = 'repeat-y';
    document.body.style.backgroundAttachment = 'scroll';
    document.body.style.backgroundPosition = 'center top';
  } else {
    document.body.style.backgroundImage = '';
    document.body.style.backgroundColor = t.backgroundcolor || '#ffffff';
  }
}

async function cargarTema() {
  try {
  const { data, error } = await supabase
    .from('menu_tema')
    .select('colortexto,colortitulo,colorprecio,colorboton,colorbotontexto,"colorComercio","colorMenu","productoAlign",ocultar_nombre,ocultar_menu,overlayoscuro,pdfurl,"colorBotonPDF",portadaimagen,backgroundimagen,backgroundcolor,textomenu,fontbodyfamily,fontbodyurl,fontbody_size,fonttitlefamily,fonttitleurl,fonttitle_size,fontnombrefamily,fontnombreurl,nombre_font_size,fontmenuwordfamily,fontmenuwordurl,menu_font_size,nombre_shadow,nombre_stroke_width,nombre_stroke_color,menu_shadow,menu_stroke_width,menu_stroke_color,titulos_shadow,titulos_stroke_width,titulos_stroke_color,boton_shadow,boton_stroke_width,boton_stroke_color,item_bg_color,item_overlay,seccion_desc_font_family,seccion_desc_font_url,seccion_desc_font_size,seccion_desc_color')
      .eq('idcomercio', idComercio)
      .maybeSingle();

    if (error) {
      console.warn('No se pudo cargar tema de menú:', error?.message || error);
    }

    temaActual = { ...DEFAULT_TEMA, ...(data || {}) };
  } catch (err) {
    console.warn('Error inesperado cargando tema, usando defaults:', err);
    temaActual = { ...DEFAULT_TEMA };
  }

  // background/portada
  if (temaActual.portadaimagen) {
    if (temaActual.portadaimagen.startsWith('http')) {
      coverUrl = cacheBust(temaActual.portadaimagen);
    } else {
      const pub = supabase.storage.from('galeriacomercios').getPublicUrl(temaActual.portadaimagen).data?.publicUrl || '';
      coverUrl = cacheBust(pub);
    }
  } else {
    coverUrl = '';
  }

  if (temaActual.backgroundimagen) {
    if (temaActual.backgroundimagen.startsWith('http')) {
      backgroundUrl = cacheBust(temaActual.backgroundimagen);
    } else {
      const pub = supabase.storage.from('galeriacomercios').getPublicUrl(temaActual.backgroundimagen).data?.publicUrl || '';
      backgroundUrl = cacheBust(pub);
    }
  } else {
    backgroundUrl = '';
  }

  // fuentes
  if (temaActual.fontbodyfamily && temaActual.fontbodyurl) {
    aplicarFuentePublica({ name: temaActual.fontbodyfamily, url: temaActual.fontbodyurl });
  }
  if (temaActual.fonttitlefamily && temaActual.fonttitleurl) {
    ensureFontLink(temaActual.fonttitleurl);
  }
  if (temaActual.fontnombrefamily && temaActual.fontnombreurl) {
    ensureFontLink(temaActual.fontnombreurl);
  }
  if (temaActual.fontmenuwordfamily && temaActual.fontmenuwordurl) {
    ensureFontLink(temaActual.fontmenuwordurl);
  }
  if (temaActual.seccion_desc_font_url) {
    ensureFontLink(temaActual.seccion_desc_font_url);
  }

  if (btnMenuPdf) {
    if (temaActual.pdfurl) {
      btnMenuPdf.href = temaActual.pdfurl;
      btnMenuPdf.classList.remove('hidden');
      const { hex, alpha } = parseColorToHexAlpha(temaActual.colorBotonPDF, '#2563eb', 0.8);
      btnMenuPdf.style.backgroundColor = hex;
      btnMenuPdf.style.opacity = alpha || 0.8;
    } else {
      btnMenuPdf.classList.add('hidden');
    }
  }

  setCssVars();
  if (isDev) console.log('[menu publico] Tema cargado', { idComercio, tema: temaActual, pdf: !!temaActual.pdfurl, coverUrl, backgroundUrl });
}

function getMenuBaseProductos(idMenu) {
  return (productosBase || [])
    .filter((p) => p.idMenu === idMenu)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
}

function pickTranslatedField(entry, primaryKey, fallbackKey) {
  const direct = entry?.[primaryKey];
  if (typeof direct === 'string' && direct.trim()) return direct;
  const fallback = entry?.[fallbackKey];
  if (typeof fallback === 'string' && fallback.trim()) return fallback;
  return '';
}

function buildMenuView(menu, menuTrad = null) {
  const menuTradData = menuTrad?.menu || null;
  const productosTrad = Array.isArray(menuTrad?.productos) ? menuTrad.productos : [];
  const tradById = new Map(productosTrad.map((t) => [Number(t.id ?? t.idproducto), t]));
  const baseProductos = getMenuBaseProductos(menu.id);
  const productos = baseProductos.map((p) => {
    const t = tradById.get(Number(p.id));
    if (!t) return p;
    return {
      ...p,
      nombre: pickTranslatedField(t, 'nombre', 'name') || p.nombre,
      descripcion: pickTranslatedField(t, 'descripcion', 'description') || p.descripcion,
    };
  });

  const translatedTitle = pickTranslatedField(menuTradData, 'titulo', 'title');
  const translatedDescription = pickTranslatedField(menuTradData, 'descripcion', 'description');

  return {
    menu: {
      ...menu,
      titulo: (translatedTitle || menu.titulo || 'Sin título').trim(),
      descripcion: (translatedDescription || menu.descripcion || '').trim(),
    },
    productos,
  };
}

function getMenuView(menuId) {
  const existing = menuViewById.get(menuId);
  if (existing) return existing;
  const baseMenu = menusBase.find((menu) => menu.id === menuId);
  if (!baseMenu) return null;
  return buildMenuView(baseMenu, null);
}

function updateMenuHeader(menuId) {
  const refs = menuButtons.get(menuId);
  if (!refs) return;
  const view = getMenuView(menuId);
  if (!view) return;
  const { titleEl, descEl } = refs;
  if (titleEl) titleEl.textContent = view.menu.titulo || 'Sin título';
  if (descEl) descEl.textContent = view.menu.descripcion || '';
}

function renderMenuProducts(menuId) {
  const refs = menuButtons.get(menuId);
  if (!refs) return;
  const view = getMenuView(menuId);
  if (!view) return;
  const { listaDiv } = refs;
  listaDiv.innerHTML = '';
  updateMenuHeader(menuId);

  const productos = Array.isArray(view.productos) ? view.productos : [];
  if (!productos.length) {
    listaDiv.innerHTML = '<p class="text-sm text-gray-500">No hay productos disponibles.</p>';
    return;
  }

  const fontBody = temaActual.fontbodyfamily ? `'${temaActual.fontbodyfamily}', 'Kanit', sans-serif` : '';
  const alphaItem = 1 - Math.min(Math.max(Number(temaActual.item_overlay) || 0, 0), 80) / 100;
  const itemBgColor = temaActual.item_bg_color || '#ffffff';
  const toRgba = (color, a) => {
    const alpha = Math.min(Math.max(a, 0), 1);
    if (!color) return `rgba(0,0,0,${alpha})`;
    if (color.startsWith('rgb')) {
      const parts = color.replace(/rgba?\(|\)/g, '').split(',').map((v) => v.trim());
      const [r = 0, g = 0, b = 0] = parts;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    const hex = color.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  const itemBg = toRgba(itemBgColor, alphaItem);
  const alignVal = (temaActual.productoAlign || 'left').toLowerCase();
  const alignItems = alignVal === 'center' ? 'center' : 'flex-start';
  const textAlign = alignVal === 'center' ? 'center' : 'left';

  for (const p of productos) {
    const priceTxt = Number.isFinite(Number(p.precio)) ? Number(p.precio).toFixed(2) : (p.precio ?? '');
    productosById.set(p.id, p);
    const div = document.createElement('div');
    div.className = 'rounded-lg shadow p-4 mb-2 flex gap-4';
    div.style.backgroundColor = itemBg;

    const imagenHTML = p.imagen
      ? `
          <div class="w-24 h-24 flex-shrink-0">
              <img src="https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${p.imagen}" 
                    alt="${p.nombre}" class="w-full h-full object-cover rounded cursor-pointer"
                    onclick="ampliarImagen('${p.imagen}')">
            </div>
          `
      : '';

    div.innerHTML = `
      ${imagenHTML}
      <div class="flex flex-col justify-between" style="text-align:${textAlign};align-items:${alignItems};width:100%;flex:1;">
        <div class="w-full">
          <h3 class="text-xl font-semibold" style="color:${temaActual.colortitulo};${fontBody ? `font-family:${fontBody};` : ''}">${p.nombre}</h3>
          <p class="text-base leading-5 font-light" style="color:${temaActual.colortexto};${fontBody ? `font-family:${fontBody};` : ''}">${p.descripcion || ''}</p>
        </div>
        <div class="mt-2 w-full flex items-center justify-between gap-2 product-actions">
          <div class="font-bold text-xl" style="color:${temaActual.colorprecio};${fontBody ? `font-family:${fontBody};` : ''}">$${priceTxt}</div>
        </div>
      </div>
    `;

    if (allowOrdering && planPermiteOrdenes) {
      const actions = div.querySelector('.product-actions');
      if (actions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'text-sm font-semibold px-3 py-2 rounded-lg bg-black text-white';
        btn.textContent = orderText('add');
        btn.addEventListener('click', async () => {
          try {
            const groups = await fetchModifierGroups(p.id);
            if (!groups || groups.length === 0) {
              addLineItem(p, []);
              return;
            }
            openModifiersDrawer(p);
          } catch (err) {
            console.warn('Error cargando opciones:', err);
            addLineItem(p, []);
          }
        });
        actions.appendChild(btn);
      }
    }

    listaDiv.appendChild(div);
  }
}

async function cargarDatos() {
  await cargarTema();

  const { data: comercio, error: errorComercio } = await supabase
    .from('Comercios')
    .select('id, nombre, colorPrimario, colorSecundario, logo, telefono, facebook, instagram, plan_id, plan_nivel, plan_nombre, permite_menu, permite_ordenes, estado_propiedad, estado_verificacion, propietario_verificado')
    .eq('id', idComercio)
    .single();

  if (errorComercio || !comercio) return alert('Error cargando comercio');

  const planInfo = resolverPlanComercio(comercio || {});
  planPermiteMenu = planInfo.permite_menu;
  planPermiteOrdenes = planInfo.permite_ordenes;
  const verificado = comercioVerificado(comercio || {});
  if (!planPermiteMenu) {
    if (verificado) {
      mostrarBloqueoMenu();
    } else {
      mostrarBloqueoMenu({
        titulo: 'Perfil pendiente de verificación',
        mensaje: 'Este comercio aún no ha completado la verificación de propiedad. Su menú estará disponible cuando se valide.',
      });
    }
    return;
  }
  initOrderUi();

  if (heroNombre) {
    const colorComercioVal = temaActual.colorComercio || temaActual.colortitulo;
    const oculto = !!temaActual.ocultar_nombre;
    heroNombre.textContent = comercio.nombre || heroNombre.textContent || '';
    heroNombre.style.display = oculto ? 'none' : 'block';
    if (!oculto) {
      heroNombre.style.color = colorComercioVal;
      if (temaActual.nombre_font_size) heroNombre.style.fontSize = `${temaActual.nombre_font_size}px`;
      const strokeW = Number(temaActual.nombre_stroke_width) || 0;
      heroNombre.style.webkitTextStroke = strokeW > 0 ? `${strokeW}px ${temaActual.nombre_stroke_color || '#000'}` : '';
      heroNombre.style.paintOrder = 'stroke fill';
      heroNombre.style.textShadow = temaActual.nombre_shadow || '';
      heroNombre.style.fontFamily = temaActual.fontnombrefamily
        ? `'${temaActual.fontnombrefamily}', 'Kanit', sans-serif`
        : '';
    }
  }
  if (heroMenuWord) {
    const colorMenuVal = temaActual.colorMenu || temaActual.colortitulo;
    const ocultoMenu = !!temaActual.ocultar_menu;
    heroMenuWord.textContent = temaActual.textomenu || heroMenuWord.textContent || 'Menú';
    heroMenuWord.style.display = ocultoMenu ? 'none' : 'block';
    if (!ocultoMenu) {
      heroMenuWord.style.color = colorMenuVal;
      if (temaActual.menu_font_size) heroMenuWord.style.fontSize = `${temaActual.menu_font_size}px`;
      const strokeW = Number(temaActual.menu_stroke_width) || 0;
      heroMenuWord.style.webkitTextStroke = strokeW > 0 ? `${strokeW}px ${temaActual.menu_stroke_color || '#000'}` : '';
      heroMenuWord.style.paintOrder = 'stroke fill';
      heroMenuWord.style.textShadow = temaActual.menu_shadow || '';
      heroMenuWord.style.fontFamily = temaActual.fontmenuwordfamily
        ? `'${temaActual.fontmenuwordfamily}', 'Kanit', sans-serif`
        : '';
    }
  }
  document.body.style.setProperty('--colorPrimario', comercio.colorPrimario || '#3ea6c4');
  document.body.style.setProperty('--colorSecundario', comercio.colorSecundario || '#f5f5f5');

  if (heroPortada) {
    // Elimina overlay para evitar sombra detrás de PNG
    if (heroOverlay) heroOverlay.style.backgroundColor = 'transparent';
    if (heroImg) {
      const heroSrc = coverUrl || backgroundUrl || '';
      heroImg.src = heroSrc;
      const isEmpty = !heroSrc;
      heroImg.classList.toggle('hidden', isEmpty);
      if (isEmpty) {
        heroPortada.style.backgroundColor = temaActual.backgroundcolor || '#ffffff';
      }
    }
    if (!coverUrl && !backgroundUrl) {
      heroPortada.style.backgroundColor = temaActual.backgroundcolor || '#ffffff';
    }
    if (isDev) console.log('[menu publico] Hero', { portadaimagen: temaActual.portadaimagen, coverUrl, heroSrc: heroImg?.src || '' });
  }

  const { data: menus, error: errorMenus } = await supabase
    .from('menus')
    .select('id, titulo, descripcion, subtitulo, orden, no_traducir')
    .eq('idComercio', idComercio)
    .eq('activo', true)
    .order('orden', { ascending: true });

  if (errorMenus) return alert('Error cargando menú');
  menusBase = menus || [];
  menuButtons.clear();
  menuViewById.clear();

  if (!seccionesEl) {
    console.warn('[menu] Contenedor de secciones no encontrado');
    return;
  }
  // Asegura color de texto base para legibilidad sobre fondos
  seccionesEl.style.color = temaActual.colortexto || '#1f2937';

  // 1) cargar todos los productos una sola vez
  const menuIds = (menus || []).map((m) => m.id).filter(Boolean);

  if (menuIds.length) {
    const { data: productosAll, error: errorProductosAll } = await supabase
      .from('productos')
      .select('*')
      .in('idMenu', menuIds)
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (errorProductosAll) {
      console.warn('Error cargando productos base:', errorProductosAll);
      productosBase = [];
    } else {
      productosBase = productosAll || [];
    }
  } else {
    productosBase = [];
  }

  productosById.clear();
  productosBase.forEach((p) => {
    if (p?.id) productosById.set(p.id, p);
  });
  await cargarTaxRates(menuIds);
  if (allowOrdering && planPermiteOrdenes) updateCartUi();

  seccionesEl.innerHTML = '';
  let seccionActiva = null;
  seccionActivaWrapper = null;

  for (const menu of menus) {
    const wrapper = document.createElement('div');
    wrapper.className = 'w-[90%] mx-auto';

    const btn = document.createElement('button');
    btn.className = 'menuHeaderBtn w-full text-xl rounded mb-2 shadow font-medium hover:opacity-90 transition text-center space-y-1';
    btn.dataset.menuId = menu.id;

    const tituloTxt = (menu.titulo ?? 'Sin título').trim();
    btn.innerHTML = `
      <div class="w-full text-center">
        <div class="menuHeaderTitle font-bold">${tituloTxt}</div>
        <div class="menuHeaderDesc"></div>
      </div>
    `;
    btn.style.backgroundColor = temaActual.colorboton || '#2563eb';
    btn.style.color = temaActual.colorbotontexto || '#ffffff';
    const strokeBtn = Number(temaActual.boton_stroke_width) || 0;
    btn.style.webkitTextStroke = strokeBtn > 0 ? `${strokeBtn}px ${temaActual.boton_stroke_color || '#000'}` : '';
    btn.style.textShadow = temaActual.boton_shadow || '';
    const titleEl = btn.querySelector('.menuHeaderTitle');
    const descElHeader = btn.querySelector('.menuHeaderDesc');
    const titleSize =
      temaActual.seccion_font_size ??
      temaActual.boton_seccion_font_size ??
      temaActual.fonttitle_size ??
      18;
    const descSize = temaActual.seccion_desc_font_size ?? Math.round(titleSize * 0.8);
    if (titleEl) titleEl.style.fontSize = `${titleSize}px`;
    if (descElHeader) {
      descElHeader.style.fontSize = `${descSize}px`;
      const descColor = temaActual.seccion_desc_color || temaActual.colorbotontexto || '#ffffff';
      descElHeader.style.color = descColor;
      const descFont = temaActual.seccion_desc_font_family || temaActual.fonttitlefamily;
      if (descFont) descElHeader.style.fontFamily = `'${descFont}', 'Kanit', sans-serif`;
    }
    if (temaActual.fonttitlefamily && titleEl) {
      titleEl.style.fontFamily = `'${temaActual.fonttitlefamily}', 'Kanit', sans-serif`;
    }

    const productosContenedor = document.createElement('div');
    productosContenedor.className = 'hidden mt-2 space-y-2';
    const listaDiv = document.createElement('div');
    listaDiv.className = 'space-y-2';
    productosContenedor.appendChild(listaDiv);
    menuButtons.set(menu.id, {
      btn,
      titleEl: btn.querySelector('.menuHeaderTitle'),
      descEl: btn.querySelector('.menuHeaderDesc'),
      listaDiv,
      productosContenedor,
      wrapper,
    });

    btn.onclick = () => {
      if (seccionActiva === productosContenedor) {
        productosContenedor.classList.add('hidden');
        seccionActiva = null;
        seccionActivaId = null;
        if (seccionActivaWrapper) seccionActivaWrapper.classList.remove('menu-open');
        const descElLocal = btn.querySelector('.menuHeaderDesc');
        if (descElLocal) descElLocal.textContent = '';
        return;
      }
      if (seccionActiva) {
        seccionActiva.classList.add('hidden');
        if (seccionActivaWrapper) seccionActivaWrapper.classList.remove('menu-open');
        if (seccionActivaWrapper) {
          const prevDesc = seccionActivaWrapper.querySelector('.menuHeaderDesc');
          if (prevDesc) prevDesc.textContent = '';
        }
      }
      seccionActiva = productosContenedor;
      seccionActivaWrapper = wrapper;
      seccionActivaId = menu.id;
      productosContenedor.classList.remove('hidden');
      wrapper.classList.add('menu-open');
      renderMenuProducts(menu.id);
    };

    wrapper.appendChild(btn);
    wrapper.appendChild(productosContenedor);
    seccionesEl.appendChild(wrapper);
  }

  // Traduce secciones y productos según idioma actual
  await actualizarTitulosSecciones();

  const linkPerfil = document.getElementById('linkPerfilComercio');
  if (linkPerfil) {
    linkPerfil.href = `/perfilComercio.html?id=${idComercio}`;
    linkPerfil.setAttribute('aria-label', comercio.nombre || 'Perfil comercio');
  }
  if (footerNombreComercio) footerNombreComercio.textContent = comercio.nombre || '';
  if (footerLogoComercio) {
    const logoSrc = comercio.logo?.startsWith('http')
      ? comercio.logo
      : comercio.logo
      ? `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${comercio.logo}`
      : '';
    footerLogoComercio.src = logoSrc || '';
    footerLogoComercio.alt = comercio.nombre || 'Logo comercio';
  }
  if (footerTelefono) {
    const telefonoRaw = String(comercio.telefono || '').trim();
    if (telefonoRaw && telefonoRaw.toLowerCase() !== 'null') {
      footerTelefono.href = `tel:${telefonoRaw}`;
      footerTelefono.classList.remove('hidden');
    } else {
      footerTelefono.classList.add('hidden');
    }
  }
  if (footerFacebook) {
    if (comercio.facebook) {
      footerFacebook.href = comercio.facebook;
      footerFacebook.classList.remove('hidden');
    } else {
      footerFacebook.classList.add('hidden');
    }
  }
  if (footerInstagram) {
    if (comercio.instagram) {
      footerInstagram.href = comercio.instagram;
      footerInstagram.classList.remove('hidden');
    } else {
      footerInstagram.classList.add('hidden');
    }
  }

  const logoLink = document.getElementById('logoLinkPerfil');
  if (logoLink) {
    logoLink.href = `/perfilComercio.html?id=${idComercio}`;
  }
}

window.ampliarImagen = function (nombreImagen) {
  const modal = document.getElementById('modalImagen');
  const img = document.getElementById('imgAmpliada');
  if (!modal || !img) return;
  img.src = `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${nombreImagen}`;
  modal.classList.remove('hidden');
  if (modal) {
    modal.onclick = () => modal.classList.add('hidden');
  }
};

if (btnVolver) {
  btnVolver.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', () => {
  mountLangSelector('#langSwitcherMenu');
  cargarDatos();
});

window.addEventListener('lang:changed', async () => {
  clearMenuI18nCache();
  applyOrderUiLanguage();
  await actualizarTitulosSecciones();
  applyOrderUiLanguage();
});

async function actualizarTitulosSecciones() {
  if (!menusBase.length) return;
  const myToken = ++renderToken;
  showGlobalLoader();
  const lang = getCurrentLang();
  try {
    menuViewById.clear();
    const translatedProducts = [];

    await Promise.all(
      menusBase.map(async (menu) => {
        if (lang === 'es') {
          const view = buildMenuView(menu, null);
          if (myToken !== renderToken) return;
          menuViewById.set(menu.id, view);
          translatedProducts.push(...(view.productos || []));
          updateMenuHeader(menu.id);
          return;
        }

        try {
          const trad = await getMenuI18n(menu.id, lang, { includeProductos: true });
          const view = buildMenuView(menu, trad);
          if (myToken !== renderToken) return;
          menuViewById.set(menu.id, view);
          translatedProducts.push(...(view.productos || []));
          updateMenuHeader(menu.id);
        } catch (error) {
          console.warn('[menu] Traducción no disponible, usando original:', menu.id, error);
          const view = buildMenuView(menu, null);
          if (myToken !== renderToken) return;
          menuViewById.set(menu.id, view);
          translatedProducts.push(...(view.productos || []));
          updateMenuHeader(menu.id);
        }
      })
    );
    if (myToken !== renderToken) return;

    productosView = translatedProducts;

    if (seccionActivaId) {
      renderMenuProducts(seccionActivaId);
    }
  } catch (err) {
    console.warn('No se pudieron traducir encabezados/productos de menú:', err);
  } finally {
    if (myToken === renderToken) hideGlobalLoader();
  }
}

async function cargarTaxRates(menuIds) {
  if (!menuIds?.length) return;
  try {
    const { data: productosAll, error: prodErr } = await supabase
      .from('productos')
      .select('id, idMenu')
      .in('idMenu', menuIds);
    if (prodErr) throw prodErr;
    const productIds = (productosAll || []).map((p) => p.id).filter(Boolean);
    if (!productIds.length) return;

    let ptrRows = [];
    {
      const { data, error } = await supabase
        .from('producto_tax_rates')
        .select('*')
        .in('idproducto', productIds);
      if (!error) {
        ptrRows = data || [];
      } else {
        const msg = (error?.message || '').toLowerCase();
        if (!(msg.includes('column') && msg.includes('idproducto') && msg.includes('does not exist'))) {
          throw error;
        }
        const fallback = await supabase
          .from('producto_tax_rates')
          .select('*')
          .in('idProducto', productIds);
        if (fallback.error) throw fallback.error;
        ptrRows = fallback.data || [];
      }
    }

    let taxRatesRows = [];
    {
      const { data, error } = await supabase
        .from('clover_tax_rates')
        .select('*')
        .eq('idcomercio', Number(idComercio));
      if (!error) {
        taxRatesRows = data || [];
      } else {
        const msg = (error?.message || '').toLowerCase();
        if (!(msg.includes('column') && msg.includes('idcomercio') && msg.includes('does not exist'))) {
          throw error;
        }
        const fallback = await supabase
          .from('clover_tax_rates')
          .select('*')
          .eq('idComercio', Number(idComercio));
        if (fallback.error) throw fallback.error;
        taxRatesRows = fallback.data || [];
      }
    }

    defaultTaxRates = (taxRatesRows || []).filter((r) => r.is_default === true);
    const taxRateById = new Map();
    (taxRatesRows || []).forEach((r) => taxRateById.set(r.id, r));

    productTaxMap = new Map();
    (ptrRows || []).forEach((row) => {
      const idProducto = Number(row.idproducto ?? row.idProducto);
      const idTaxRate = Number(row.idtaxrate ?? row.idTaxRate);
      if (!Number.isFinite(idProducto) || !Number.isFinite(idTaxRate)) return;
      const rateRow = taxRateById.get(idTaxRate);
      if (!rateRow) return;
      const list = productTaxMap.get(idProducto) || [];
      list.push(rateRow);
      productTaxMap.set(idProducto, list);
    });
  } catch (err) {
    console.warn('[menu] No se pudieron cargar tax rates:', err);
    productTaxMap = new Map();
    defaultTaxRates = [];
  }
}

function renderModifiersByGroup(mods) {
  if (!mods.length) return '';
  const resolveGroup = (m) => {
    const raw = m.grupo || m.grupo_nombre || m.group;
    if (raw && raw !== orderText('optionGroupFallback')) return raw;
    const id = Number(m.idOpcionItem || m.id);
    const mapped = modifierItemGroupMap.get(id);
    return mapped || raw || orderText('optionGroupFallback');
  };
  const grouped = new Map();
  mods.forEach((m) => {
    const group = resolveGroup(m);
    const list = grouped.get(group) || [];
    list.push(m);
    grouped.set(group, list);
  });
  let html = '';
  for (const [group, list] of grouped.entries()) {
    html += `<div class="font-semibold text-xs text-gray-600 mt-2">${group}:</div>`;
    list.forEach((m) => {
      const price = m.precio_extra ? ` + $${Number(m.precio_extra).toFixed(2)}` : '';
      html += `<div class="text-xs text-gray-500">• ${m.nombre}${price}</div>`;
    });
  }
  return html;
}

function getTaxRateForProduct(idProducto) {
  const rates = productTaxMap.get(Number(idProducto)) || [];
  const useRates = rates.length ? rates : defaultTaxRates;
  const sum = useRates.reduce((acc, r) => acc + (Number(r.rate) || 0), 0);
  return sum / taxRateDenominator;
}

function initOrderUi() {
  if (!idComercio) return;

  cartKey = `cart_${idComercio}_${orderMode}${mesaParam ? `_mesa_${mesaParam}` : ''}`;
  cartState = loadCartState();

  const mainEl = document.getElementById('seccionesMenu');
  if (mainEl && mainEl.parentElement) {
    cartBarPlaceholder = document.createElement('div');
    cartBarPlaceholder.className = 'hidden';
    mainEl.parentElement.insertBefore(cartBarPlaceholder, mainEl);
  }

  if (!allowOrdering || !planPermiteOrdenes) return;
  buildCartBar();
  buildCartDrawer();
  buildModifiersDrawer();
  applyOrderUiLanguage();
  ensureModifierMapForCart().finally(() => updateCartUi());
  setupCartBarSticky();
}

function buildCartBar() {
  if (!cartBarPlaceholder || cartBar) return;
  cartBar = document.createElement('button');
  cartBar.id = 'cartBar';
  cartBar.type = 'button';
  cartBar.className = 'w-[90%] max-w-5xl mx-auto mt-2 mb-2 px-4 py-3 rounded-xl border bg-white shadow-sm flex items-center justify-between gap-3';
  cartBar.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-black text-white">
        <i class="fa-solid fa-basket-shopping"></i>
      </span>
      <span id="cartBarLabel" class="font-semibold text-sm sm:text-base">${orderText('viewOrder')}</span>
    </div>
    <span id="cartCount" class="text-sm font-semibold bg-black text-white px-3 py-1 rounded-full">0</span>
  `;
  cartBar.addEventListener('click', () => {
    if (!cartDrawer) return;
    cartDrawer.classList.remove('hidden');
  });
  cartBarPlaceholder.parentElement.insertBefore(cartBar, cartBarPlaceholder.nextSibling);
}

function buildModifiersDrawer() {
  if (modifiersDrawer) return;
  modifiersDrawer = document.createElement('div');
  modifiersDrawer.id = 'modifiersDrawer';
  modifiersDrawer.className = 'fixed inset-0 z-50 hidden';
  modifiersDrawer.innerHTML = `
    <div data-mod-close class="absolute inset-0 bg-black/60"></div>
    <div class="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl p-4 max-h-[80vh] overflow-auto">
      <div class="flex items-center justify-between mb-3">
        <h3 id="modDrawerTitle" class="text-lg font-semibold">${orderText('customizeOrder')}</h3>
        <button id="modDrawerCancelBtn" type="button" data-mod-close class="text-gray-500 hover:text-gray-700">${orderText('cancel')}</button>
      </div>
      <div class="flex flex-col items-center text-center gap-2 mb-3">
        <img id="modProductImage" src="" alt="" class="hidden w-24 h-24 rounded-xl object-cover" />
        <div id="modProductName" class="text-base sm:text-lg font-semibold"></div>
      </div>
      <div id="modGroups" class="space-y-4"></div>
      <div class="mt-4">
        <label id="modNoteLabel" for="modNote" class="text-sm font-semibold text-gray-700">${orderText('notesOptional')}</label>
        <textarea id="modNote" rows="3" class="mt-2 w-full border rounded-lg p-2 text-sm" placeholder="${orderText('notePlaceholder')}"></textarea>
      </div>
      <button id="modAddBtn" type="button" class="mt-4 w-full bg-black text-white py-3 rounded-lg font-semibold">${orderText('addToCart')}</button>
    </div>
  `;
  modifiersDrawer.addEventListener('click', (e) => {
    if (e.target?.closest('[data-mod-close]')) {
      closeModifiersDrawer();
    }
  });
  const addBtn = modifiersDrawer.querySelector('#modAddBtn');
  if (addBtn) addBtn.addEventListener('click', handleConfirmModifiers);
  document.body.appendChild(modifiersDrawer);
}

function openModifiersDrawer(product, lineItem = null) {
  if (!modifiersDrawer) buildModifiersDrawer();
  currentModifiersProduct = product;
  currentEditLine = lineItem ? { key: lineItem.key, qty: lineItem.qty, modifiers: lineItem.modifiers || [] } : null;
  renderModifiersForProduct(product, lineItem);
  const addBtn = modifiersDrawer.querySelector('#modAddBtn');
  if (addBtn) addBtn.textContent = currentEditLine ? orderText('saveChanges') : orderText('addToCart');
  modifiersDrawer.classList.remove('hidden');
}

function closeModifiersDrawer() {
  if (!modifiersDrawer) return;
  modifiersDrawer.classList.add('hidden');
  currentEditLine = null;
}

async function fetchModifierGroups(productId) {
  if (modifierGroupsCache.has(productId)) return modifierGroupsCache.get(productId);
  const tryFetch = async (col) => {
    let resp = await supabase
      .from('producto_opcion_grupos')
      .select('*')
      .eq(col, productId)
      .eq('activo', true)
      .order('orden', { ascending: true });
    if (!resp.error) return resp.data || [];
    const msg = (resp.error?.message || '').toLowerCase();
    if (msg.includes('column') && msg.includes('activo') && msg.includes('does not exist')) {
      resp = await supabase
        .from('producto_opcion_grupos')
        .select('*')
        .eq(col, productId)
        .order('orden', { ascending: true });
      if (!resp.error) return resp.data || [];
    }
    if (msg.includes('does not exist')) return null;
    throw resp.error;
  };
  let groups = await tryFetch('idproducto');
  if (groups === null) groups = await tryFetch('idProducto');
  groups = groups || [];
  modifierGroupsCache.set(productId, groups);
  return groups;
}

async function fetchModifierItems(groupId) {
  if (modifierItemsCache.has(groupId)) return modifierItemsCache.get(groupId);
  const tryFetch = async (col) => {
    let resp = await supabase
      .from('producto_opcion_items')
      .select('*')
      .eq(col, groupId)
      .eq('activo', true)
      .order('orden', { ascending: true });
    if (!resp.error) return resp.data || [];
    const msg = (resp.error?.message || '').toLowerCase();
    if (msg.includes('column') && msg.includes('activo') && msg.includes('does not exist')) {
      resp = await supabase
        .from('producto_opcion_items')
        .select('*')
        .eq(col, groupId)
        .order('orden', { ascending: true });
      if (!resp.error) return resp.data || [];
    }
    if (msg.includes('does not exist')) return null;
    throw resp.error;
  };
  let items = await tryFetch('idgrupo');
  if (items === null) items = await tryFetch('idGrupo');
  items = items || [];
  modifierItemsCache.set(groupId, items);
  return items;
}

async function renderModifiersForProduct(product, lineItem = null) {
  const groupsContainer = modifiersDrawer?.querySelector('#modGroups');
  const nameEl = modifiersDrawer?.querySelector('#modProductName');
  const imgEl = modifiersDrawer?.querySelector('#modProductImage');
  const noteEl = modifiersDrawer?.querySelector('#modNote');
  if (!groupsContainer || !nameEl) return;
  nameEl.textContent = product?.nombre ? product.nombre : '';
  if (imgEl) {
    if (product?.imagen) {
      imgEl.src = `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${product.imagen}`;
      imgEl.alt = product?.nombre || orderText('productFallbackFmt', { id: product?.id || '' });
      imgEl.classList.remove('hidden');
    } else {
      imgEl.classList.add('hidden');
    }
  }
  groupsContainer.innerHTML = `<p class="text-sm text-gray-500">${orderText('loadingOptions')}</p>`;
  if (noteEl) noteEl.value = lineItem?.nota || '';

  let groups = [];
  try {
    groups = await fetchModifierGroups(product.id);
  } catch (err) {
    groupsContainer.innerHTML = `<p class="text-sm text-red-500">${orderText('optionsLoadError')}</p>`;
    return;
  }

  if (!groups.length) {
    groupsContainer.innerHTML = `<p class="text-sm text-gray-500">${orderText('noOptionsProduct')}</p>`;
    return;
  }

  const selectedByGroup = new Map();
  const preselected = new Set(
    (lineItem?.modifiers || []).map((m) => Number(m.idOpcionItem || m.id)).filter((n) => Number.isFinite(n))
  );
  groupsContainer.innerHTML = '';

  for (const group of groups) {
    const groupId = group.id;
    const nombre = group.nombre || orderText('optionGroupFallback');
    const minSel = Number(group.min_sel ?? 0) || 0;
    const maxSelRaw = Number(group.max_sel ?? 0) || 0;
    const requerido = Boolean(group.requerido) || minSel > 0;
    const maxSel = maxSelRaw > 1 ? maxSelRaw : 1;

    const wrapper = document.createElement('div');
    wrapper.className = 'border rounded-xl p-3';
    const requiredLabel = requerido
      ? minSel
        ? orderText('requiredWithMin', { min: minSel })
        : orderText('required')
      : orderText('optional');
    const maxLabel = maxSel > 1 ? ` · ${orderText('maxFmt', { max: maxSel })}` : '';
    wrapper.innerHTML = `
      <div class="flex items-center justify-between">
        <h4 class="font-semibold text-sm">${nombre}</h4>
        <span class="text-xs text-gray-500">
          ${requiredLabel}${maxLabel}
        </span>
      </div>
      <div class="mt-2 space-y-2" data-group="${groupId}"></div>
    `;
    groupsContainer.appendChild(wrapper);
    selectedByGroup.set(groupId, []);

    let items = [];
    try {
      items = await fetchModifierItems(groupId);
    } catch {
      items = [];
    }

    const listEl = wrapper.querySelector(`[data-group="${groupId}"]`);
    if (!listEl) continue;
    if (!items.length) {
      listEl.innerHTML = `<p class="text-xs text-gray-500">${orderText('noOptionsAvailable')}</p>`;
      continue;
    }

    for (const item of items) {
      const extra = Number(item.precio_extra || 0);
      if (group?.nombre || group?.id) {
        const groupName = group?.nombre || orderText('optionGroupFallback');
        modifierItemGroupMap.set(item.id, groupName);
      }
      const inputType = maxSel > 1 ? 'checkbox' : 'radio';
      const row = document.createElement('label');
      row.className = 'flex items-center justify-between gap-2 text-sm';
      row.innerHTML = `
        <span class="flex items-center gap-2">
          <input type="${inputType}" name="group-${groupId}" data-group-id="${groupId}" data-item-id="${item.id}" />
          <span>${item.nombre || orderText('optionItemFallback')}</span>
        </span>
        <span class="text-xs text-gray-500">${extra ? `+ $${extra.toFixed(2)}` : ''}</span>
      `;
      const input = row.querySelector('input');
      if (input) {
        if (preselected.has(item.id)) {
          input.checked = true;
          if (inputType === 'radio') {
            selectedByGroup.set(groupId, [item]);
          } else {
            const selected = selectedByGroup.get(groupId) || [];
            selected.push(item);
            selectedByGroup.set(groupId, selected);
          }
        }
        input.addEventListener('change', (e) => {
          const selected = selectedByGroup.get(groupId) || [];
          if (inputType === 'radio') {
            selectedByGroup.set(groupId, [item]);
            return;
          }
          if (e.target.checked) {
            if (maxSel && selected.length >= maxSel) {
              e.target.checked = false;
              alert(orderText('maxSelectAlert', { max: maxSel }));
              return;
            }
            selected.push(item);
            selectedByGroup.set(groupId, selected);
          } else {
            const next = selected.filter((s) => s.id !== item.id);
            selectedByGroup.set(groupId, next);
          }
        });
      }
      listEl.appendChild(row);
    }
  }

  modifiersDrawer.selectedByGroup = selectedByGroup;
}

async function ensureModifierMapForCart() {
  const items = getCartItemsArray();
  if (!items.length) return;
  const productIds = Array.from(new Set(items.map((i) => Number(i.idProducto)).filter((id) => Number.isFinite(id))));
  for (const productId of productIds) {
    if (modifierMapBuiltForProduct.has(productId)) continue;
    let groups = [];
    try {
      groups = await fetchModifierGroups(productId);
    } catch {
      groups = [];
    }
    for (const group of groups) {
      let groupItems = [];
      try {
        groupItems = await fetchModifierItems(group.id);
      } catch {
        groupItems = [];
      }
      for (const item of groupItems) {
        const groupName = group?.nombre || orderText('optionGroupFallback');
        modifierItemGroupMap.set(item.id, groupName);
      }
    }
    modifierMapBuiltForProduct.add(productId);
  }

  let changed = false;
  for (const item of cartState.items) {
    const mods = item.modifiers || [];
    mods.forEach((m) => {
      if (m.grupo && m.grupo !== orderText('optionGroupFallback')) return;
      const id = Number(m.idOpcionItem || m.id);
      const mapped = modifierItemGroupMap.get(id);
      if (mapped && mapped !== m.grupo) {
        m.grupo = mapped;
        changed = true;
      }
    });
  }
  if (changed) saveCartState();
}

function handleConfirmModifiers() {
  if (!currentModifiersProduct || !modifiersDrawer) return;
  const groups = modifierGroupsCache.get(currentModifiersProduct.id) || [];
  const selectedByGroup = modifiersDrawer.selectedByGroup || new Map();
  const noteEl = modifiersDrawer.querySelector('#modNote');
  const nota = noteEl ? String(noteEl.value || '').trim() : '';
  for (const group of groups) {
    const groupId = group.id;
    const minSel = Number(group.min_sel ?? 0) || 0;
    const requerido = Boolean(group.requerido) || minSel > 0;
    const selected = selectedByGroup.get(groupId) || [];
    if (requerido && selected.length < Math.max(minSel, 1)) {
      alert(
        orderText('groupRequiredAlert', {
          min: Math.max(minSel, 1),
          group: group.nombre || orderText('optionGroupFallback'),
        })
      );
      return;
    }
  }

  const modifiers = [];
  for (const group of groups) {
    const selected = selectedByGroup.get(group.id) || [];
    selected.forEach((item) => modifiers.push({
      idOpcionItem: item.id,
      nombre: item.nombre || orderText('optionItemFallback'),
      precio_extra: Number(item.precio_extra || 0),
      grupo: group.nombre || orderText('optionGroupFallback'),
    }));
  }
  if (currentEditLine) {
    replaceLineItem(currentEditLine.key, currentModifiersProduct, modifiers, currentEditLine.qty, nota);
  } else {
    addLineItem(currentModifiersProduct, modifiers, nota);
  }
  closeModifiersDrawer();
}

function buildCartDrawer() {
  cartDrawer = document.createElement('div');
  cartDrawer.id = 'cartDrawer';
  cartDrawer.className = 'fixed inset-0 z-50 hidden';
  cartDrawer.innerHTML = `
    <div data-cart-close class="absolute inset-0 bg-black/60"></div>
    <div class="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl p-4 max-h-[80vh] overflow-auto">
      <div class="flex items-center justify-between mb-3">
        <h3 id="cartDrawerTitle" class="text-lg font-semibold">${orderText('cartTitle')}</h3>
        <button id="cartDrawerClose" type="button" data-cart-close class="text-gray-500 hover:text-gray-700">${orderText('close')}</button>
      </div>
      <div id="cartItems" class="space-y-3"></div>
      <div id="checkoutCustomerFields" class="mt-4 space-y-3">
        <div id="cartCustomerFieldsTitle" class="text-sm font-semibold text-gray-800">${orderText('customerFieldsTitle')}</div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="space-y-1">
            <label id="cartFirstNameLabel" class="text-xs text-gray-500">${orderText('firstName')}</label>
            <input id="cartFirstName" type="text" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="${orderText('firstName')}" />
          </div>
          <div class="space-y-1">
            <label id="cartLastNameLabel" class="text-xs text-gray-500">${orderText('lastName')}</label>
            <input id="cartLastName" type="text" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="${orderText('lastName')}" />
          </div>
        </div>
        <div class="space-y-1">
          <label id="cartPhoneLabel" class="text-xs text-gray-500">${orderText('phone')}</label>
          <input id="cartPhone" type="tel" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="${orderText('phonePlaceholder')}" />
          <p id="cartPhoneHelp" class="text-[11px] text-gray-400">${orderText('phoneHelp')}</p>
        </div>
        <div class="space-y-1">
          <label id="cartEmailLabel" class="text-xs text-gray-500">${orderText('email')}</label>
          <input id="cartEmail" type="email" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="${orderText('emailPlaceholder')}" />
          <p id="cartEmailHelp" class="text-[11px] text-gray-400">${orderText('emailHelp')}</p>
        </div>
      </div>
      <div class="mt-4 space-y-1 text-sm">
        <div class="flex items-center justify-between">
          <span id="cartSubtotalLabel">${orderText('subtotal')}</span>
          <span id="cartSubtotal">$0.00</span>
        </div>
        <div class="flex items-center justify-between">
          <span id="cartTaxLabel">${orderText('tax')}</span>
          <span id="cartTax">$0.00</span>
        </div>
        <div class="flex items-center justify-between text-base font-semibold">
          <span id="cartTotalLabel">${orderText('total')}</span>
          <span id="cartTotal">$0.00</span>
        </div>
      </div>
      <button id="cartCheckout" type="button" class="mt-4 w-full bg-green-600 text-white py-3 rounded-lg font-semibold"></button>
    </div>
  `;
  cartDrawer.addEventListener('click', (e) => {
    const target = e.target;
    if (target?.closest('[data-cart-close]')) {
      cartDrawer.classList.add('hidden');
    }
  });
  cartDrawer.addEventListener('click', (e) => {
    const btn = e.target?.closest('[data-cart-action]');
    if (!btn) return;
    const key = btn.getAttribute('data-key');
    if (!key) return;
    const action = btn.getAttribute('data-cart-action');
    if (action === 'inc') updateLineQty(key, 1);
    if (action === 'dec') updateLineQty(key, -1);
    if (action === 'remove') removeLineItem(key);
    if (action === 'edit') editLineItem(key);
  });
  const checkoutBtn = cartDrawer.querySelector('#cartCheckout');
  if (checkoutBtn) {
    checkoutBtn.textContent = allowMesa ? orderText('checkoutMesa') : orderText('checkoutPickup');
    checkoutBtn.addEventListener('click', submitOrder);
  }
  const customerFields = cartDrawer.querySelector('#checkoutCustomerFields');
  if (customerFields && !allowPickup) {
    customerFields.classList.add('hidden');
  }
  document.body.appendChild(cartDrawer);
}

function applyOrderUiLanguage() {
  if (cartBar) {
    const barLabel = cartBar.querySelector('#cartBarLabel');
    if (barLabel) barLabel.textContent = orderText('viewOrder');
  }

  if (modifiersDrawer) {
    const titleEl = modifiersDrawer.querySelector('#modDrawerTitle');
    const cancelBtn = modifiersDrawer.querySelector('#modDrawerCancelBtn');
    const noteLabel = modifiersDrawer.querySelector('#modNoteLabel');
    const noteInput = modifiersDrawer.querySelector('#modNote');
    const addBtn = modifiersDrawer.querySelector('#modAddBtn');
    if (titleEl) titleEl.textContent = orderText('customizeOrder');
    if (cancelBtn) cancelBtn.textContent = orderText('cancel');
    if (noteLabel) noteLabel.textContent = orderText('notesOptional');
    if (noteInput) noteInput.placeholder = orderText('notePlaceholder');
    if (addBtn) addBtn.textContent = currentEditLine ? orderText('saveChanges') : orderText('addToCart');
  }

  if (cartDrawer) {
    const setText = (selector, text) => {
      const el = cartDrawer.querySelector(selector);
      if (el) el.textContent = text;
    };
    setText('#cartDrawerTitle', orderText('cartTitle'));
    setText('#cartDrawerClose', orderText('close'));
    setText('#cartCustomerFieldsTitle', orderText('customerFieldsTitle'));
    setText('#cartFirstNameLabel', orderText('firstName'));
    setText('#cartLastNameLabel', orderText('lastName'));
    setText('#cartPhoneLabel', orderText('phone'));
    setText('#cartEmailLabel', orderText('email'));
    setText('#cartPhoneHelp', orderText('phoneHelp'));
    setText('#cartEmailHelp', orderText('emailHelp'));
    setText('#cartSubtotalLabel', orderText('subtotal'));
    setText('#cartTaxLabel', orderText('tax'));
    setText('#cartTotalLabel', orderText('total'));

    const firstNameInput = cartDrawer.querySelector('#cartFirstName');
    const lastNameInput = cartDrawer.querySelector('#cartLastName');
    const phoneInput = cartDrawer.querySelector('#cartPhone');
    const emailInput = cartDrawer.querySelector('#cartEmail');
    if (firstNameInput) firstNameInput.placeholder = orderText('firstName');
    if (lastNameInput) lastNameInput.placeholder = orderText('lastName');
    if (phoneInput) phoneInput.placeholder = orderText('phonePlaceholder');
    if (emailInput) emailInput.placeholder = orderText('emailPlaceholder');

    const checkoutBtn = cartDrawer.querySelector('#cartCheckout');
    if (checkoutBtn) {
      checkoutBtn.textContent = allowMesa ? orderText('checkoutMesa') : orderText('checkoutPickup');
    }
  }

  updateCartUi();
}

function loadCartState() {
  if (!cartKey || typeof localStorage === 'undefined') return { items: [] };
  try {
    const raw = localStorage.getItem(cartKey);
    if (!raw) return { items: [] };
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return { items: [] };
    if (Array.isArray(data.items)) return { items: data.items };
    // Compatibilidad con versión anterior (objeto por idProducto)
    if (data.items && typeof data.items === 'object') {
      const items = Object.values(data.items).map((item) => ({
        key: String(item.idProducto),
        idProducto: Number(item.idProducto),
        qty: Number(item.qty || 0),
        modifiers: [],
        nota: '',
      })).filter((item) => Number.isFinite(item.idProducto) && item.qty > 0);
      return { items };
    }
    return { items: (data.items || []).map((item) => ({
      ...item,
      nota: String(item.nota || '').trim(),
    })) };
  } catch {
    return { items: [] };
  }
}

function saveCartState() {
  if (!cartKey || typeof localStorage === 'undefined') return;
  localStorage.setItem(cartKey, JSON.stringify(cartState));
}

function getCartItemsArray() {
  return (cartState.items || []).filter((i) => Number.isFinite(Number(i.idProducto)) && Number(i.qty) > 0);
}

function buildLineKey(idProducto, modifiers = [], nota = '') {
  const ids = modifiers.map((m) => Number(m.idOpcionItem || m.id)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const noteKey = String(nota || '').trim().toLowerCase();
  return `${idProducto}:${ids.join(',')}:${noteKey}`;
}

function addLineItem(producto, modifiers = [], nota = '') {
  const idProducto = Number(producto?.id ?? producto?.idProducto);
  if (!Number.isFinite(idProducto)) return;
  const key = buildLineKey(idProducto, modifiers, nota);
  const existing = cartState.items.find((i) => i.key === key);
  if (existing) {
    existing.qty += 1;
  } else {
    cartState.items.push({
      key,
      idProducto,
      qty: 1,
      modifiers: modifiers.map((m) => ({
        idOpcionItem: Number(m.idOpcionItem || m.id),
        nombre: m.nombre || m.name || orderText('optionItemFallback'),
        grupo: m.grupo || m.grupo_nombre || m.group || orderText('optionGroupFallback'),
        precio_extra: Number(m.precio_extra || 0),
      })),
      nota: String(nota || '').trim(),
    });
  }
  saveCartState();
  updateCartUi();
  const nombre = producto?.nombre || orderText('productFallbackFmt', { id: idProducto });
  alert(orderText('addedItemFmt', { name: nombre }));
}

function updateLineQty(key, delta) {
  const idx = cartState.items.findIndex((i) => i.key === key);
  if (idx === -1) return;
  const nextQty = Math.max(0, Number(cartState.items[idx].qty || 0) + delta);
  if (nextQty === 0) {
    cartState.items.splice(idx, 1);
  } else {
    cartState.items[idx].qty = nextQty;
  }
  saveCartState();
  updateCartUi();
}

function removeLineItem(key) {
  const idx = cartState.items.findIndex((i) => i.key === key);
  if (idx === -1) return;
  const line = cartState.items[idx];
  const product = productosById.get(Number(line.idProducto));
  const nombre = product?.nombre || orderText('productFallbackFmt', { id: line.idProducto });
  if (!confirm(orderText('deleteConfirmFmt', { name: nombre }))) return;
  cartState.items.splice(idx, 1);
  saveCartState();
  updateCartUi();
}

function replaceLineItem(oldKey, producto, modifiers, qty, nota = '') {
  const idProducto = Number(producto?.id ?? producto?.idProducto);
  if (!Number.isFinite(idProducto)) return;
  const newKey = buildLineKey(idProducto, modifiers, nota);
  const mappedModifiers = modifiers.map((m) => ({
    idOpcionItem: Number(m.idOpcionItem || m.id),
    nombre: m.nombre || m.name || orderText('optionItemFallback'),
    grupo: m.grupo || m.grupo_nombre || m.group || orderText('optionGroupFallback'),
    precio_extra: Number(m.precio_extra || 0),
  }));
  const oldIdx = cartState.items.findIndex((i) => i.key === oldKey);
  if (oldIdx === -1) {
    cartState.items.push({ key: newKey, idProducto, qty: qty || 1, modifiers: mappedModifiers, nota: String(nota || '').trim() });
  } else {
    const existingIdx = cartState.items.findIndex((i) => i.key === newKey && i.key !== oldKey);
    if (existingIdx >= 0) {
      cartState.items[existingIdx].qty += qty || 1;
      cartState.items.splice(oldIdx, 1);
    } else {
      cartState.items[oldIdx] = { key: newKey, idProducto, qty: qty || 1, modifiers: mappedModifiers, nota: String(nota || '').trim() };
    }
  }
  saveCartState();
  updateCartUi();
  const nombre = producto?.nombre || orderText('productFallbackFmt', { id: idProducto });
  alert(orderText('updatedItemFmt', { name: nombre }));
}

function editLineItem(key) {
  const line = cartState.items.find((i) => i.key === key);
  if (!line) return;
  const product = productosById.get(Number(line.idProducto));
  if (!product) return;
  openModifiersDrawer(product, line);
}

function updateCartUi() {
  if (!cartBar || !cartDrawer) return;
  const items = getCartItemsArray();
  const count = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const countEl = cartBar.querySelector('#cartCount');
  if (countEl) countEl.textContent = String(count);
  cartBar.classList.toggle('opacity-70', count === 0);
  cartBar.classList.toggle('cursor-not-allowed', count === 0);

  const cartItemsEl = cartDrawer.querySelector('#cartItems');
  const cartSubtotalEl = cartDrawer.querySelector('#cartSubtotal');
  const cartTaxEl = cartDrawer.querySelector('#cartTax');
  const cartTotalEl = cartDrawer.querySelector('#cartTotal');
  if (!cartItemsEl || !cartSubtotalEl || !cartTaxEl || !cartTotalEl) return;
  if (count === 0) {
    cartItemsEl.innerHTML = `<p class="text-sm text-gray-500">${orderText('emptyCart')}</p>`;
    cartSubtotalEl.textContent = '$0.00';
    cartTaxEl.textContent = '$0.00';
    cartTotalEl.textContent = '$0.00';
    return;
  }

  let subtotal = 0;
  let taxTotal = 0;
  cartItemsEl.innerHTML = '';
  items.forEach((item) => {
    const product = productosById.get(Number(item.idProducto));
    const price = Number(product?.precio) || 0;
    const modsExtra = (item.modifiers || []).reduce((sum, m) => sum + (Number(m.precio_extra) || 0), 0);
    const unitPrice = price + modsExtra;
    const lineSubtotal = unitPrice * Number(item.qty);
    subtotal += lineSubtotal;
    const taxRate = getTaxRateForProduct(item.idProducto);
    taxTotal += lineSubtotal * taxRate;
    const mods = (item.modifiers || []).map((m) => ({
      nombre: m.nombre || orderText('optionItemFallback'),
      precio_extra: Number(m.precio_extra || 0),
      grupo: m.grupo || orderText('optionGroupFallback'),
    }));
    const row = document.createElement('div');
    row.className = 'border rounded-xl p-3';
    const imgSrc = product?.imagen
      ? `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${product.imagen}`
      : '';
    row.innerHTML = `
      <div class="flex items-start gap-3">
        ${imgSrc ? `<img src="${imgSrc}" alt="${product?.nombre || ''}" class="w-20 h-20 rounded-lg object-cover flex-shrink-0" />` : ''}
      <div class="flex-1">
        <div class="font-semibold text-base sm:text-lg">${product?.nombre || orderText('productFallbackFmt', { id: item.idProducto })}</div>
        <div class="text-xs text-gray-500 space-y-1 mt-1">
          ${renderModifiersByGroup(mods)}
        </div>
        ${item.nota ? `<div class="text-xs text-gray-500 mt-2"><span class="font-semibold text-gray-600">${orderText('noteLabel')}:</span> ${item.nota}</div>` : ''}
        <div class="mt-2 text-sm font-semibold">${orderText('lineTotal')}: $${lineSubtotal.toFixed(2)}</div>
      </div>
        <div class="flex flex-col items-center gap-2 min-w-[90px]">
          <div class="flex items-center gap-2">
            <button type="button" data-cart-action="dec" data-key="${item.key}" class="w-8 h-8 rounded-full border text-sm">-</button>
            <span class="min-w-[24px] text-center text-sm">${item.qty}</span>
            <button type="button" data-cart-action="inc" data-key="${item.key}" class="w-8 h-8 rounded-full border text-sm">+</button>
          </div>
          <div class="flex items-center gap-3 text-xs">
            <button type="button" data-cart-action="edit" data-key="${item.key}" class="text-blue-500">${orderText('edit')}</button>
            <button type="button" data-cart-action="remove" data-key="${item.key}" class="text-red-500">${orderText('remove')}</button>
          </div>
        </div>
      </div>
    `;
    cartItemsEl.appendChild(row);
  });
  cartSubtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  cartTaxEl.textContent = `$${taxTotal.toFixed(2)}`;
  cartTotalEl.textContent = `$${(subtotal + taxTotal).toFixed(2)}`;
}

function setupCartBarSticky() {
  if (!cartBar || !cartBarPlaceholder) return;
  const update = () => {
    if (!cartBar) return;
    if (!cartBarInitialTop) {
      const rect = cartBar.getBoundingClientRect();
      cartBarInitialTop = rect.top + window.scrollY;
    }
    const shouldStick = window.scrollY > cartBarInitialTop;
    if (shouldStick && !cartBarSticky) {
      cartBarSticky = true;
      const rect = cartBar.getBoundingClientRect();
      cartBar.classList.add('cart-bar-fixed');
      cartBarPlaceholder.classList.remove('hidden');
      cartBarPlaceholder.style.height = `${rect.height}px`;
    } else if (!shouldStick && cartBarSticky) {
      cartBarSticky = false;
      cartBar.classList.remove('cart-bar-fixed');
      cartBarPlaceholder.classList.add('hidden');
      cartBarPlaceholder.style.height = '0px';
    }
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', () => {
    cartBarInitialTop = 0;
    update();
  });
  requestAnimationFrame(update);
}

async function submitOrder() {
  if (!planPermiteOrdenes) {
    alert(orderText('premiumOnly'));
    return;
  }
  const items = getCartItemsArray();
  if (!items.length) return;
  let customer = null;
  if (allowPickup) {
    const firstName = String(document.querySelector('#cartFirstName')?.value || '').trim();
    const lastName = String(document.querySelector('#cartLastName')?.value || '').trim();
    const phone = String(document.querySelector('#cartPhone')?.value || '').trim();
    const email = String(document.querySelector('#cartEmail')?.value || '').trim();
    if (!firstName || !lastName || !email || !phone) {
      alert(orderText('completePickup'));
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      alert(orderText('invalidEmail'));
      return;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 7) {
      alert(orderText('invalidPhone'));
      return;
    }
    customer = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      email,
      phone,
      phoneNumber: phone,
    };
  }
  const payload = {
    idComercio: Number(idComercio),
    items: items.map((i) => ({
      idProducto: Number(i.idProducto),
      qty: Number(i.qty),
      modifiers: (i.modifiers || []).map((m) => ({ idOpcionItem: Number(m.idOpcionItem || m.id) })),
      nota: i.nota || '',
    })),
    ...(customer ? { customer } : {}),
    mode: orderMode,
    mesa: mesaParam || null,
    source: orderSource,
    idempotencyKey: `order_${idComercio}_${orderMode}_${mesaParam || 'na'}_${Date.now()}`,
  };
  if (allowPickup) {
    const basePath = isDev ? '/public' : '';
    if (window.location.protocol === 'https:') {
      const ordersUrl = `${window.location.origin}${basePath}/pedidos.html?tab=activos&token={ORDER_TOKEN}&session_id={CHECKOUT_SESSION_ID}`;
      payload.redirectUrls = {
        success: ordersUrl,
        failure: ordersUrl,
      };
    }
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token || SUPABASE_ANON_KEY;
    const resp = await fetch(`${FUNCTIONS_BASE}/clover-create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      if (resp.status === 401 && json?.needs_reconnect) {
        alert(orderText('reconnectClover'));
        return;
      }
      const rawMsg = json?.raw ? ` (${json.raw})` : '';
      const msg =
        (json?.error ? `${json.error}${rawMsg}` : '') ||
        json?.details?.message ||
        orderText('orderCreateErrorFmt', { status: resp.status });
      alert(msg);
      return;
    }

    const orderId = json?.order?.id;
    if (orderId) rememberOrder(orderId, idComercio);

    if (orderMode === 'pickup') {
      const url = json?.checkout_url || json?.order?.checkout_url;
      if (url) {
        window.location.href = url;
        return;
      }
      alert(orderText('paymentLinkError'));
      return;
    }

    alert(orderText('orderSentMesa'));
    cartState = { items: {} };
    saveCartState();
    updateCartUi();
    if (cartDrawer) cartDrawer.classList.add('hidden');
  } catch (err) {
    alert(err?.message || orderText('unexpectedOrderError'));
  }
}
