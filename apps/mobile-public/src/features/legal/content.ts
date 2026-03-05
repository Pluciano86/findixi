import type { LanguageCode } from '../../i18n/languages';

type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  emailLine?: string;
};

type LegalDocument = {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

type LegalContentByLanguage = {
  privacy: LegalDocument;
  terms: LegalDocument;
};

const EMAIL = 'info@findixi.com';

const ES_CONTENT: LegalContentByLanguage = {
  privacy: {
    title: 'Política de Privacidad - Findixi',
    updated: 'Última actualización: 1 de marzo de 2026',
    intro:
      'Findixi ("nosotros") respeta tu privacidad y se compromete a proteger tu información personal.',
    sections: [
      {
        title: 'Información que recopilamos',
        paragraphs: ['Podemos recopilar información personal como:'],
        bullets: ['Nombre', 'Correo electrónico', 'Número de teléfono', 'Datos de cuenta y registro', 'Información de comercios enviada a la plataforma'],
      },
      {
        title: 'Cómo usamos tu información',
        paragraphs: ['Usamos tu información para:'],
        bullets: [
          'Brindar acceso a la plataforma',
          'Enviar notificaciones de cuenta',
          'Enviar códigos de verificación (OTP)',
          'Notificar actualizaciones y aprobaciones de comercios',
          'Enviar mensajes promocionales opcionales (solo si diste consentimiento)',
          'Mejorar la experiencia del usuario',
        ],
      },
      {
        title: 'Comunicaciones por SMS',
        paragraphs: [
          'Al compartir tu número y autorizar el servicio, aceptas recibir SMS de Findixi.',
          'La frecuencia de mensajes puede variar. Pueden aplicar cargos de mensajes y datos.',
          'Puedes responder STOP para cancelar o HELP para asistencia.',
          'No vendemos tu información móvil a terceros. Solo compartimos datos con proveedores/carriers necesarios para operar la plataforma.',
        ],
      },
      {
        title: 'Seguridad de datos',
        paragraphs: ['Aplicamos medidas administrativas, técnicas y físicas razonables para proteger tu información.'],
      },
      {
        title: 'Servicios de terceros',
        paragraphs: ['Findixi puede usar proveedores externos para operar funciones de la plataforma. Estos proveedores deben mantener confidencialidad y seguridad.'],
      },
      {
        title: 'Contáctanos',
        paragraphs: ['Si tienes preguntas sobre esta Política de Privacidad, contáctanos:'],
        emailLine: 'Correo:',
      },
    ],
  },
  terms: {
    title: 'Términos de Servicio - Findixi',
    updated: 'Última actualización: 1 de marzo de 2026',
    intro: 'Al acceder o usar Findixi, aceptas estos Términos de Servicio.',
    sections: [
      {
        title: '1. Uso de la plataforma',
        paragraphs: ['Findixi conecta usuarios con comercios locales. Debes usar la plataforma solo para fines legales.'],
      },
      {
        title: '2. Cuentas de usuario',
        paragraphs: ['Eres responsable de proteger tus credenciales y de la actividad que ocurra en tu cuenta.'],
      },
      {
        title: '3. Listados de comercios',
        paragraphs: ['Cada comercio es responsable de la exactitud de su información. Findixi puede remover contenido que incumpla políticas.'],
      },
      {
        title: '4. Comunicaciones',
        paragraphs: ['Al compartir tu información de contacto, aceptas recibir comunicaciones de Findixi relacionadas con tu cuenta o actividad de la plataforma.'],
        bullets: ['La frecuencia de SMS puede variar', 'Pueden aplicar cargos de mensajes y datos', 'Responde STOP para cancelar', 'Responde HELP para asistencia'],
      },
      {
        title: '5. Propiedad intelectual',
        paragraphs: ['El contenido, marca y materiales de la plataforma pertenecen a Findixi, salvo indicación contraria.'],
      },
      {
        title: '6. Limitación de responsabilidad',
        paragraphs: ['Findixi no es responsable por acciones, servicios o productos ofrecidos por comercios listados en la plataforma.'],
      },
      {
        title: '7. Cambios a estos términos',
        paragraphs: ['Podemos actualizar estos términos en cualquier momento. El uso continuo de la plataforma implica aceptación de los cambios.'],
      },
      {
        title: '8. Contacto',
        paragraphs: ['Para preguntas sobre estos términos:'],
        emailLine: 'Correo:',
      },
    ],
  },
};

const EN_CONTENT: LegalContentByLanguage = {
  privacy: {
    title: 'Privacy Policy - Findixi',
    updated: 'Last updated: March 1, 2026',
    intro: 'Findixi ("we") respects your privacy and is committed to protecting your personal information.',
    sections: [
      {
        title: 'Information We Collect',
        paragraphs: ['We may collect personal information such as:'],
        bullets: ['Name', 'Email address', 'Phone number', 'Account and registration details', 'Business information submitted to the platform'],
      },
      {
        title: 'How We Use Your Information',
        paragraphs: ['We use your information to:'],
        bullets: [
          'Provide access to the platform',
          'Send account notifications',
          'Send verification codes (OTP)',
          'Notify business updates and approvals',
          'Send optional promotional messages (only with consent)',
          'Improve user experience',
        ],
      },
      {
        title: 'SMS Communications',
        paragraphs: [
          'By providing your phone number and opting in, you agree to receive SMS messages from Findixi.',
          'Message frequency may vary. Message and data rates may apply.',
          'Reply STOP to unsubscribe or HELP for assistance.',
          'We do not sell your mobile information. Data is shared only with providers/carriers needed to operate the platform.',
        ],
      },
      {
        title: 'Data Security',
        paragraphs: ['We apply reasonable administrative, technical, and physical safeguards to protect your information.'],
      },
      {
        title: 'Third-Party Services',
        paragraphs: ['Findixi may use third-party providers to support platform operations. These providers must preserve confidentiality and security.'],
      },
      {
        title: 'Contact Us',
        paragraphs: ['If you have questions about this Privacy Policy, contact us:'],
        emailLine: 'Email:',
      },
    ],
  },
  terms: {
    title: 'Terms of Service - Findixi',
    updated: 'Last updated: March 1, 2026',
    intro: 'By accessing or using Findixi, you agree to these Terms of Service.',
    sections: [
      {
        title: '1. Use of the Platform',
        paragraphs: ['Findixi connects users with local businesses. You agree to use the platform only for lawful purposes.'],
      },
      {
        title: '2. User Accounts',
        paragraphs: ['You are responsible for protecting your credentials and all activity under your account.'],
      },
      {
        title: '3. Business Listings',
        paragraphs: ['Businesses are responsible for listing accuracy. Findixi may remove content that violates policies.'],
      },
      {
        title: '4. Communications',
        paragraphs: ['By providing contact information, you consent to account and platform communications from Findixi.'],
        bullets: ['SMS frequency may vary', 'Message and data rates may apply', 'Reply STOP to unsubscribe', 'Reply HELP for support'],
      },
      {
        title: '5. Intellectual Property',
        paragraphs: ['Platform content, branding, and materials belong to Findixi unless otherwise stated.'],
      },
      {
        title: '6. Limitation of Liability',
        paragraphs: ['Findixi is not responsible for actions, services, or products offered by businesses listed on the platform.'],
      },
      {
        title: '7. Changes to These Terms',
        paragraphs: ['We may update these terms at any time. Continued use of the platform means you accept those changes.'],
      },
      {
        title: '8. Contact',
        paragraphs: ['For questions about these terms:'],
        emailLine: 'Email:',
      },
    ],
  },
};

const ZH_CONTENT: LegalContentByLanguage = {
  privacy: {
    title: '隐私政策 - Findixi',
    updated: '最后更新：2026年3月1日',
    intro: 'Findixi（“我们”）尊重您的隐私，并致力于保护您的个人信息。',
    sections: [
      { title: '我们收集的信息', paragraphs: ['我们可能收集以下个人信息：'], bullets: ['姓名', '电子邮箱', '电话号码', '账户与注册信息', '提交到平台的商家信息'] },
      { title: '我们如何使用信息', paragraphs: ['我们使用您的信息来：'], bullets: ['提供平台访问', '发送账户通知', '发送验证码（OTP）', '通知商家更新与审核', '发送可选促销信息（仅在您同意时）', '改进用户体验'] },
      { title: '短信通信', paragraphs: ['当您提供手机号并同意后，即表示同意接收 Findixi 短信。', '短信频率可能变化，可能产生短信与流量费用。', '回复 STOP 可退订，回复 HELP 可获得帮助。', '我们不会出售您的手机信息，仅会与为平台服务所需的服务商/运营商共享。'] },
      { title: '数据安全', paragraphs: ['我们采取合理的管理、技术和物理安全措施来保护您的信息。'] },
      { title: '第三方服务', paragraphs: ['Findixi 可能使用第三方服务商支持平台运行。这些服务商必须遵守保密与安全要求。'] },
      { title: '联系我们', paragraphs: ['如对本隐私政策有疑问，请联系：'], emailLine: '邮箱：' },
    ],
  },
  terms: {
    title: '服务条款 - Findixi',
    updated: '最后更新：2026年3月1日',
    intro: '访问或使用 Findixi 即表示您同意本服务条款。',
    sections: [
      { title: '1. 平台使用', paragraphs: ['Findixi 连接用户与本地商家。您仅可将平台用于合法用途。'] },
      { title: '2. 用户账户', paragraphs: ['您有责任保护账户凭证，并对账户下的活动负责。'] },
      { title: '3. 商家信息', paragraphs: ['商家需确保信息准确。Findixi 可移除违反政策的内容。'] },
      { title: '4. 通信', paragraphs: ['当您提供联系方式时，您同意接收与账户或平台活动相关的信息。'], bullets: ['短信频率可能变化', '可能产生短信与流量费用', '回复 STOP 退订', '回复 HELP 获取帮助'] },
      { title: '5. 知识产权', paragraphs: ['除非另有说明，平台内容、品牌和材料均归 Findixi 所有。'] },
      { title: '6. 责任限制', paragraphs: ['Findixi 不对平台商家提供的行为、服务或产品负责。'] },
      { title: '7. 条款变更', paragraphs: ['我们可随时更新条款。继续使用平台即表示接受更新后的条款。'] },
      { title: '8. 联系方式', paragraphs: ['如对条款有疑问：'], emailLine: '邮箱：' },
    ],
  },
};

const FR_CONTENT: LegalContentByLanguage = {
  privacy: {
    title: 'Politique de Confidentialité - Findixi',
    updated: 'Dernière mise à jour : 1 mars 2026',
    intro: 'Findixi (« nous ») respecte votre vie privée et protège vos informations personnelles.',
    sections: [
      { title: 'Informations collectées', paragraphs: ['Nous pouvons collecter :'], bullets: ['Nom', 'Adresse e-mail', 'Numéro de téléphone', 'Données de compte et d’inscription', 'Informations commerciales soumises à la plateforme'] },
      { title: 'Utilisation des informations', paragraphs: ['Nous utilisons vos données pour :'], bullets: ['Fournir l’accès à la plateforme', 'Envoyer des notifications de compte', 'Envoyer des codes OTP', 'Notifier les mises à jour des commerces', 'Envoyer des messages promotionnels optionnels (avec consentement)', 'Améliorer l’expérience utilisateur'] },
      { title: 'Communications SMS', paragraphs: ['En fournissant votre numéro et en acceptant, vous consentez à recevoir des SMS de Findixi.', 'La fréquence peut varier. Des frais SMS/data peuvent s’appliquer.', 'Répondez STOP pour vous désabonner ou HELP pour assistance.', 'Nous ne vendons pas vos données mobiles. Le partage se fait uniquement avec les prestataires nécessaires.'] },
      { title: 'Sécurité des données', paragraphs: ['Nous appliquons des mesures administratives, techniques et physiques raisonnables pour protéger vos informations.'] },
      { title: 'Services tiers', paragraphs: ['Findixi peut utiliser des prestataires tiers pour faire fonctionner la plateforme. Ces prestataires doivent respecter la confidentialité et la sécurité.'] },
      { title: 'Nous contacter', paragraphs: ['Pour toute question sur cette politique :'], emailLine: 'E-mail :', },
    ],
  },
  terms: {
    title: 'Conditions d’Utilisation - Findixi',
    updated: 'Dernière mise à jour : 1 mars 2026',
    intro: 'En accédant à Findixi ou en l’utilisant, vous acceptez ces conditions.',
    sections: [
      { title: '1. Utilisation de la plateforme', paragraphs: ['Findixi met en relation les utilisateurs avec des commerces locaux. Utilisation légale uniquement.'] },
      { title: '2. Comptes utilisateur', paragraphs: ['Vous êtes responsable de vos identifiants et de l’activité de votre compte.'] },
      { title: '3. Fiches commerces', paragraphs: ['Les commerces doivent garantir l’exactitude des informations. Findixi peut supprimer les contenus non conformes.'] },
      { title: '4. Communications', paragraphs: ['En fournissant vos coordonnées, vous acceptez les communications liées au compte et à la plateforme.'], bullets: ['La fréquence des SMS peut varier', 'Des frais SMS/data peuvent s’appliquer', 'Répondez STOP pour vous désinscrire', 'Répondez HELP pour assistance'] },
      { title: '5. Propriété intellectuelle', paragraphs: ['Sauf mention contraire, le contenu et la marque de la plateforme appartiennent à Findixi.'] },
      { title: '6. Limitation de responsabilité', paragraphs: ['Findixi n’est pas responsable des actions, services ou produits des commerces listés.'] },
      { title: '7. Modifications', paragraphs: ['Nous pouvons modifier ces conditions à tout moment. L’utilisation continue implique acceptation.'] },
      { title: '8. Contact', paragraphs: ['Pour toute question :'], emailLine: 'E-mail :', },
    ],
  },
};

const PT_CONTENT: LegalContentByLanguage = {
  privacy: {
    title: 'Política de Privacidade - Findixi',
    updated: 'Última atualização: 1 de março de 2026',
    intro: 'A Findixi ("nós") respeita sua privacidade e protege suas informações pessoais.',
    sections: [
      { title: 'Informações coletadas', paragraphs: ['Podemos coletar:'], bullets: ['Nome', 'E-mail', 'Telefone', 'Dados de conta e cadastro', 'Informações comerciais enviadas à plataforma'] },
      { title: 'Como usamos suas informações', paragraphs: ['Usamos seus dados para:'], bullets: ['Dar acesso à plataforma', 'Enviar notificações da conta', 'Enviar códigos OTP', 'Notificar atualizações de comércios', 'Enviar promoções opcionais (com consentimento)', 'Melhorar a experiência do usuário'] },
      { title: 'Comunicações por SMS', paragraphs: ['Ao informar seu telefone e aceitar, você concorda em receber SMS da Findixi.', 'A frequência pode variar. Tarifas de SMS/dados podem ser aplicadas.', 'Responda STOP para cancelar ou HELP para ajuda.', 'Não vendemos suas informações móveis. Compartilhamento apenas com provedores/operadoras necessários.'] },
      { title: 'Segurança de dados', paragraphs: ['Aplicamos medidas administrativas, técnicas e físicas razoáveis para proteger suas informações.'] },
      { title: 'Serviços de terceiros', paragraphs: ['A Findixi pode usar fornecedores terceirizados para operar a plataforma. Esses fornecedores devem manter confidencialidade e segurança.'] },
      { title: 'Fale conosco', paragraphs: ['Se tiver dúvidas sobre esta política:'], emailLine: 'E-mail:' },
    ],
  },
  terms: {
    title: 'Termos de Serviço - Findixi',
    updated: 'Última atualização: 1 de março de 2026',
    intro: 'Ao acessar ou usar a Findixi, você concorda com estes termos.',
    sections: [
      { title: '1. Uso da plataforma', paragraphs: ['A Findixi conecta usuários a comércios locais. Use a plataforma apenas para fins legais.'] },
      { title: '2. Contas de usuário', paragraphs: ['Você é responsável por proteger suas credenciais e pela atividade da sua conta.'] },
      { title: '3. Listagens de comércios', paragraphs: ['Os comércios são responsáveis pela precisão das informações. A Findixi pode remover conteúdo que viole políticas.'] },
      { title: '4. Comunicações', paragraphs: ['Ao fornecer contato, você concorda com comunicações relacionadas à conta e à plataforma.'], bullets: ['A frequência de SMS pode variar', 'Tarifas de SMS/dados podem ser aplicadas', 'Responda STOP para cancelar', 'Responda HELP para suporte'] },
      { title: '5. Propriedade intelectual', paragraphs: ['Conteúdo, marca e materiais da plataforma pertencem à Findixi, salvo indicação em contrário.'] },
      { title: '6. Limitação de responsabilidade', paragraphs: ['A Findixi não se responsabiliza por ações, serviços ou produtos de comércios listados.'] },
      { title: '7. Alterações destes termos', paragraphs: ['Podemos atualizar estes termos a qualquer momento. O uso contínuo implica aceitação.'] },
      { title: '8. Contato', paragraphs: ['Para dúvidas sobre estes termos:'], emailLine: 'E-mail:' },
    ],
  },
};

const DE_CONTENT: LegalContentByLanguage = {
  privacy: {
    title: 'Datenschutzerklärung - Findixi',
    updated: 'Letzte Aktualisierung: 1. März 2026',
    intro: 'Findixi („wir“) respektiert Ihre Privatsphäre und schützt Ihre personenbezogenen Daten.',
    sections: [
      { title: 'Welche Daten wir erheben', paragraphs: ['Wir können folgende Daten erfassen:'], bullets: ['Name', 'E-Mail-Adresse', 'Telefonnummer', 'Konto- und Registrierungsdaten', 'Geschäftsinformationen auf der Plattform'] },
      { title: 'Wie wir Ihre Daten verwenden', paragraphs: ['Wir verwenden Ihre Daten, um:'], bullets: ['Zugang zur Plattform zu ermöglichen', 'Kontobenachrichtigungen zu senden', 'OTP-Codes zu senden', 'Geschäfts-Updates mitzuteilen', 'Optionale Werbenachrichten zu senden (mit Einwilligung)', 'Die Nutzererfahrung zu verbessern'] },
      { title: 'SMS-Kommunikation', paragraphs: ['Mit Angabe Ihrer Telefonnummer und Einwilligung stimmen Sie SMS von Findixi zu.', 'Die Häufigkeit kann variieren. Gebühren für SMS/Daten können anfallen.', 'Antworten Sie mit STOP zum Abmelden oder HELP für Hilfe.', 'Wir verkaufen keine mobilen Daten. Eine Weitergabe erfolgt nur an notwendige Dienstleister/Carrier.'] },
      { title: 'Datensicherheit', paragraphs: ['Wir setzen angemessene administrative, technische und physische Schutzmaßnahmen ein.'] },
      { title: 'Drittanbieter-Dienste', paragraphs: ['Findixi kann Drittanbieter zur Unterstützung der Plattform nutzen. Diese müssen Vertraulichkeit und Sicherheit einhalten.'] },
      { title: 'Kontakt', paragraphs: ['Bei Fragen zu dieser Datenschutzerklärung:'], emailLine: 'E-Mail:' },
    ],
  },
  terms: {
    title: 'Nutzungsbedingungen - Findixi',
    updated: 'Letzte Aktualisierung: 1. März 2026',
    intro: 'Durch Zugriff auf oder Nutzung von Findixi akzeptieren Sie diese Nutzungsbedingungen.',
    sections: [
      { title: '1. Nutzung der Plattform', paragraphs: ['Findixi verbindet Nutzer mit lokalen Geschäften. Die Nutzung ist nur zu rechtmäßigen Zwecken erlaubt.'] },
      { title: '2. Benutzerkonten', paragraphs: ['Sie sind für den Schutz Ihrer Zugangsdaten und Aktivitäten in Ihrem Konto verantwortlich.'] },
      { title: '3. Geschäftseinträge', paragraphs: ['Geschäfte sind für die Richtigkeit ihrer Angaben verantwortlich. Findixi kann regelwidrige Inhalte entfernen.'] },
      { title: '4. Kommunikation', paragraphs: ['Mit Angabe Ihrer Kontaktdaten stimmen Sie kontobezogener und plattformbezogener Kommunikation zu.'], bullets: ['SMS-Häufigkeit kann variieren', 'SMS/Datengebühren können anfallen', 'STOP zum Abmelden', 'HELP für Hilfe'] },
      { title: '5. Geistiges Eigentum', paragraphs: ['Inhalte, Marken und Materialien der Plattform gehören Findixi, sofern nicht anders angegeben.'] },
      { title: '6. Haftungsbeschränkung', paragraphs: ['Findixi haftet nicht für Handlungen, Leistungen oder Produkte gelisteter Geschäfte.'] },
      { title: '7. Änderungen', paragraphs: ['Wir können diese Bedingungen jederzeit ändern. Die fortgesetzte Nutzung gilt als Zustimmung.'] },
      { title: '8. Kontakt', paragraphs: ['Fragen zu diesen Bedingungen:'], emailLine: 'E-Mail:' },
    ],
  },
};

const IT_CONTENT: LegalContentByLanguage = {
  privacy: {
    title: 'Informativa sulla Privacy - Findixi',
    updated: 'Ultimo aggiornamento: 1 marzo 2026',
    intro: 'Findixi (“noi”) rispetta la tua privacy e protegge i tuoi dati personali.',
    sections: [
      { title: 'Dati raccolti', paragraphs: ['Possiamo raccogliere:'], bullets: ['Nome', 'Email', 'Numero di telefono', 'Dati di account e registrazione', 'Informazioni commerciali inviate alla piattaforma'] },
      { title: 'Come usiamo i dati', paragraphs: ['Usiamo i tuoi dati per:'], bullets: ['Fornire accesso alla piattaforma', 'Inviare notifiche account', 'Inviare codici OTP', 'Notificare aggiornamenti dei commerci', 'Inviare promozioni opzionali (con consenso)', 'Migliorare l’esperienza utente'] },
      { title: 'Comunicazioni SMS', paragraphs: ['Fornendo il numero e acconsentendo, accetti di ricevere SMS da Findixi.', 'La frequenza può variare. Possono applicarsi costi SMS/dati.', 'Rispondi STOP per annullare o HELP per assistenza.', 'Non vendiamo i tuoi dati mobili. Condivisione solo con fornitori/operatori necessari.'] },
      { title: 'Sicurezza dei dati', paragraphs: ['Adottiamo misure amministrative, tecniche e fisiche ragionevoli per proteggere i dati.'] },
      { title: 'Servizi di terze parti', paragraphs: ['Findixi può usare fornitori terzi per il funzionamento della piattaforma. Devono rispettare riservatezza e sicurezza.'] },
      { title: 'Contattaci', paragraphs: ['Per domande su questa informativa:'], emailLine: 'Email:' },
    ],
  },
  terms: {
    title: 'Termini di Servizio - Findixi',
    updated: 'Ultimo aggiornamento: 1 marzo 2026',
    intro: 'Accedendo o utilizzando Findixi, accetti questi Termini di Servizio.',
    sections: [
      { title: '1. Uso della piattaforma', paragraphs: ['Findixi collega utenti e attività locali. È consentito solo uso lecito.'] },
      { title: '2. Account utente', paragraphs: ['Sei responsabile delle credenziali e delle attività del tuo account.'] },
      { title: '3. Schede attività', paragraphs: ['Le attività sono responsabili dell’accuratezza delle informazioni. Findixi può rimuovere contenuti non conformi.'] },
      { title: '4. Comunicazioni', paragraphs: ['Fornendo i tuoi contatti, accetti comunicazioni relative all’account e alla piattaforma.'], bullets: ['La frequenza SMS può variare', 'Possono applicarsi costi SMS/dati', 'Rispondi STOP per annullare', 'Rispondi HELP per assistenza'] },
      { title: '5. Proprietà intellettuale', paragraphs: ['Contenuti, brand e materiali della piattaforma appartengono a Findixi salvo diversa indicazione.'] },
      { title: '6. Limitazione di responsabilità', paragraphs: ['Findixi non è responsabile per azioni, servizi o prodotti dei commerci elencati.'] },
      { title: '7. Modifiche ai termini', paragraphs: ['Possiamo aggiornare questi termini in qualsiasi momento. L’uso continuo implica accettazione.'] },
      { title: '8. Contatto', paragraphs: ['Per domande sui termini:'], emailLine: 'Email:' },
    ],
  },
};

const KO_CONTENT: LegalContentByLanguage = {
  privacy: {
    title: '개인정보 처리방침 - Findixi',
    updated: '최종 업데이트: 2026년 3월 1일',
    intro: 'Findixi("당사")는 귀하의 개인정보를 존중하며 보호하기 위해 노력합니다.',
    sections: [
      { title: '수집하는 정보', paragraphs: ['당사는 다음 정보를 수집할 수 있습니다:'], bullets: ['이름', '이메일', '전화번호', '계정/가입 정보', '플랫폼에 제출된 비즈니스 정보'] },
      { title: '정보 이용 목적', paragraphs: ['수집한 정보는 다음 목적으로 사용됩니다:'], bullets: ['플랫폼 접근 제공', '계정 알림 발송', 'OTP 인증코드 발송', '비즈니스 업데이트/승인 안내', '선택적 프로모션 발송(동의 시)', '사용자 경험 개선'] },
      { title: 'SMS 통신', paragraphs: ['전화번호 제공 및 동의 시 Findixi SMS 수신에 동의하게 됩니다.', '메시지 빈도는 달라질 수 있으며 통신요금이 발생할 수 있습니다.', '수신 거부는 STOP, 도움말은 HELP를 보내세요.', '모바일 정보는 판매하지 않으며, 운영에 필요한 제공업체/통신사와만 공유합니다.'] },
      { title: '데이터 보안', paragraphs: ['당사는 합리적인 관리적, 기술적, 물리적 보호조치를 시행합니다.'] },
      { title: '제3자 서비스', paragraphs: ['플랫폼 운영을 위해 제3자 서비스를 사용할 수 있으며, 해당 제공업체는 기밀성과 보안을 준수해야 합니다.'] },
      { title: '문의', paragraphs: ['본 방침 관련 문의:'], emailLine: '이메일:' },
    ],
  },
  terms: {
    title: '서비스 이용약관 - Findixi',
    updated: '최종 업데이트: 2026년 3월 1일',
    intro: 'Findixi에 접근하거나 사용하면 본 약관에 동의한 것으로 간주됩니다.',
    sections: [
      { title: '1. 플랫폼 이용', paragraphs: ['Findixi는 사용자와 지역 비즈니스를 연결합니다. 합법적인 목적에 한해 사용해야 합니다.'] },
      { title: '2. 사용자 계정', paragraphs: ['계정 자격 증명 보호 및 계정 활동에 대한 책임은 사용자에게 있습니다.'] },
      { title: '3. 비즈니스 등록정보', paragraphs: ['비즈니스는 정보 정확성에 책임이 있습니다. 정책 위반 콘텐츠는 제거될 수 있습니다.'] },
      { title: '4. 커뮤니케이션', paragraphs: ['연락처 제공 시 계정/플랫폼 관련 안내 수신에 동의합니다.'], bullets: ['SMS 빈도는 달라질 수 있음', '메시지/데이터 요금이 부과될 수 있음', 'STOP으로 수신 거부', 'HELP로 도움 요청'] },
      { title: '5. 지식재산권', paragraphs: ['별도 명시가 없는 한 플랫폼 콘텐츠와 브랜드는 Findixi 소유입니다.'] },
      { title: '6. 책임 제한', paragraphs: ['Findixi는 등록된 비즈니스의 행위, 서비스, 상품에 대해 책임지지 않습니다.'] },
      { title: '7. 약관 변경', paragraphs: ['약관은 언제든 변경될 수 있으며, 계속 사용 시 변경사항에 동의한 것으로 간주됩니다.'] },
      { title: '8. 연락처', paragraphs: ['약관 관련 문의:'], emailLine: '이메일:' },
    ],
  },
};

const JA_CONTENT: LegalContentByLanguage = {
  privacy: {
    title: 'プライバシーポリシー - Findixi',
    updated: '最終更新日: 2026年3月1日',
    intro: 'Findixi（「当社」）は、利用者のプライバシーを尊重し、個人情報の保護に努めます。',
    sections: [
      { title: '収集する情報', paragraphs: ['当社は次の情報を収集する場合があります。'], bullets: ['氏名', 'メールアドレス', '電話番号', 'アカウント/登録情報', 'プラットフォームに送信された事業者情報'] },
      { title: '情報の利用目的', paragraphs: ['収集した情報は次の目的で利用します。'], bullets: ['プラットフォームへのアクセス提供', 'アカウント通知の送信', 'OTP認証コードの送信', '事業者更新/承認の通知', '任意のプロモーション配信（同意時）', 'ユーザー体験の改善'] },
      { title: 'SMS連絡', paragraphs: ['電話番号提供と同意により、FindixiからのSMS受信に同意したものとみなされます。', '配信頻度は変動する場合があり、通信料が発生することがあります。', '配信停止はSTOP、サポートはHELPと返信してください。', 'モバイル情報は販売しません。運用に必要な提供事業者/通信事業者とのみ共有します。'] },
      { title: 'データセキュリティ', paragraphs: ['当社は合理的な管理的・技術的・物理的対策を講じます。'] },
      { title: '第三者サービス', paragraphs: ['Findixiはプラットフォーム運用のため第三者サービスを利用する場合があります。これらの提供者は機密性と安全性を維持する必要があります。'] },
      { title: 'お問い合わせ', paragraphs: ['本ポリシーに関するお問い合わせ先:'], emailLine: 'メール:' },
    ],
  },
  terms: {
    title: '利用規約 - Findixi',
    updated: '最終更新日: 2026年3月1日',
    intro: 'Findixiにアクセスまたは利用することで、本利用規約に同意したものとみなされます。',
    sections: [
      { title: '1. プラットフォームの利用', paragraphs: ['Findixiはユーザーと地域ビジネスをつなぐサービスです。合法的な目的に限って利用してください。'] },
      { title: '2. ユーザーアカウント', paragraphs: ['アカウント情報の管理およびアカウント内の活動は利用者の責任です。'] },
      { title: '3. 事業者掲載情報', paragraphs: ['事業者は掲載情報の正確性に責任を負います。ポリシー違反のコンテンツは削除される場合があります。'] },
      { title: '4. 連絡', paragraphs: ['連絡先を提供すると、アカウント/プラットフォーム関連連絡の受信に同意したものとみなされます。'], bullets: ['SMS配信頻度は変動する場合があります', '通信料が発生する場合があります', '停止はSTOP', 'サポートはHELP'] },
      { title: '5. 知的財産', paragraphs: ['別途記載がない限り、プラットフォームのコンテンツ・ブランド・素材はFindixiに帰属します。'] },
      { title: '6. 責任の制限', paragraphs: ['Findixiは掲載事業者の行為・サービス・商品について責任を負いません。'] },
      { title: '7. 規約の変更', paragraphs: ['規約はいつでも更新される場合があります。継続利用は変更後規約への同意を意味します。'] },
      { title: '8. 連絡先', paragraphs: ['本規約に関するお問い合わせ:'], emailLine: 'メール:' },
    ],
  },
};

const LEGAL_CONTENT: Record<LanguageCode, LegalContentByLanguage> = {
  es: ES_CONTENT,
  en: EN_CONTENT,
  zh: ZH_CONTENT,
  fr: FR_CONTENT,
  pt: PT_CONTENT,
  de: DE_CONTENT,
  it: IT_CONTENT,
  ko: KO_CONTENT,
  ja: JA_CONTENT,
};

export function getLegalContent(lang: LanguageCode): LegalContentByLanguage {
  return LEGAL_CONTENT[lang] ?? ES_CONTENT;
}

export function getLegalEmail(): string {
  return EMAIL;
}
