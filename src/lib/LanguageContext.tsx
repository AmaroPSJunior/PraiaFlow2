import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'pt-br' | 'en' | 'es' | 'zh' | 'hi' | 'fr';

interface Translations {
  [key: string]: {
    'pt-br': string;
    en: string;
    es: string;
    zh: string;
    hi: string;
    fr: string;
  };
}

export const translations: Translations = {
  // General
  appName: { 'pt-br': 'PraiaFlow', en: 'PraiaFlow', es: 'PraiaFlow', zh: 'PraiaFlow', hi: 'PraiaFlow', fr: 'PraiaFlow' },
  mesa: { 'pt-br': 'Mesa', en: 'Table', es: 'Mesa', zh: '桌子', hi: 'मेज़', fr: 'Table' },
  login: { 'pt-br': 'Entrar', en: 'Login', es: 'Iniciar sesión', zh: '登录', hi: 'लॉगिन', fr: 'Connexion' },
  logout: { 'pt-br': 'Sair', en: 'Logout', es: 'Cerrar sesión', zh: '登出', hi: 'लॉगआउट', fr: 'Déconnexion' },
  loading: { 'pt-br': 'Carregando...', en: 'Loading...', es: 'Cargando...', zh: '加载中...', hi: 'लोड हो रहा है...', fr: 'Chargement...' },
  
  // Login
  welcome: { 'pt-br': 'Seja bem-vindo ao Quiosque!', en: 'Welcome to the Beach Bar!', es: '¡Bienvenido al Quiosque!', zh: '欢迎来到海滩酒吧！', hi: 'कियोस्क में आपका स्वागत है!', fr: 'Bienvenue au Bar de la Plage !' },
  adminPanel: { 'pt-br': 'Painel Administrativo', en: 'Admin Panel', es: 'Panel de Administración', zh: '管理面板', hi: 'प्रशासन पैनल', fr: 'Panneau d\'administration' },
  loginDescription: { 'pt-br': 'Faça login com sua conta Google para realizar pedidos e acompanhar o status em tempo real.', en: 'Login with your Google account to place orders and track status in real time.', es: 'Inicie sesión con su cuenta de Google para realizar pedidos y seguir el estado en tiempo real.', zh: '使用您的 Google 帐户登录以实时下单并跟踪状态。', hi: 'वास्तविक समय में ऑर्डर देने और स्थिति ट्रैक करने के लिए अपने Google खाते से लॉग in करें।', fr: 'Connectez-vous avec votre compte Google pour passer des commandes et suivre l\'état en temps réel.' },
  adminDescription: { 'pt-br': 'Acesse para gerenciar pedidos, cardápio e mesas em tempo real.', en: 'Access to manage orders, menu and tables in real time.', es: 'Acceda para gestionar pedidos, menú y mesas en tiempo real.', zh: '访问以实时管理订单、菜单和桌子。', hi: 'वास्तविक समय में ऑर्डर, मेनू और टेबल प्रबंधित करने के लिए एक्सेस करें।', fr: 'Accédez pour gérer les commandes, le menu et les tables en temps réel.' },
  loginButton: { 'pt-br': 'Entrar com Google', en: 'Sign in with Google', es: 'Iniciar sesión con Google', zh: '使用 Google 登录', hi: 'Google के साथ साइन इन करें', fr: 'Se connecter avec Google' },
  accessDenied: { 'pt-br': 'Ops! Você está logado, mas não tem permissão de administrador.', en: 'Oops! You are logged in, but you don\'t have admin permission.', es: '¡Vaya! Has iniciado sesión, mas no tienes permiso de administrador.', zh: '哎呀！您已登录，但没有管理员权限。', hi: 'ओह! आप लॉग इन हैं, लेकिन आपके पास व्यवस्थापक अनुमति नहीं है।', fr: 'Oups ! Vous êtes connecté, mas vous n\'avez pas la permission d\'administrateur.' },
  loggedInAs: { 'pt-br': 'E-mail logado:', en: 'Logged in as:', es: 'Sesión iniciada como:', zh: '登录身份：', hi: 'इस रूप में लॉग इन किया गया:', fr: 'Connecté en tant que :' },
  tryAnotherAccount: { 'pt-br': 'Sair e tentar outra conta', en: 'Logout and try another account', es: 'Cerrar sesión e intentar con otra cuenta', zh: '登出并尝试其他帐户', hi: 'लॉगआउट करें और दूसरा खाता आज़माएं', fr: 'Se déconnecter et essayer un autre compte' },
  restrictedAccess: { 'pt-br': 'Acesso restrito a administradores autorizados.', en: 'Restricted access to authorized administrators.', es: 'Acceso restringido a administradores autorizados.', zh: '仅限授权管理员访问。', hi: 'अधिकृत प्रशासकों के लिए प्रतिबंधित पहुंच।', fr: 'Accès restreint aux administrateurs autorisés.' },
  termsAgreement: { 'pt-br': 'Ao entrar, você concorda com nossos termos de uso.', en: 'By entering, you agree to our terms of use.', es: 'Al entrar, aceptas nuestros términos de uso.', zh: '登录即表示您同意我们的使用条款。', hi: 'प्रवेश करके, आप हमारी उपयोग की शर्तों से सहमत होते हैं।', fr: 'En entrant, vous acceptez nos conditions d\'utilisation.' },

  // Client View
  categories: { 'pt-br': 'Categorias', en: 'Categories', es: 'Categorías', zh: '类别', hi: 'श्रेणियाँ', fr: 'Catégories' },
  all: { 'pt-br': 'Todos', en: 'All', es: 'Todos', zh: '全部', hi: 'सभी', fr: 'Tous' },
  drinks: { 'pt-br': 'Bebidas', en: 'Drinks', es: 'Bebidas', zh: '饮料', hi: 'पेय', fr: 'Boissons' },
  snacks: { 'pt-br': 'Petiscos', en: 'Snacks', es: 'Aperitivos', zh: '小吃', hi: 'स्नैक्स', fr: 'Snacks' },
  meals: { 'pt-br': 'Refeições', en: 'Meals', es: 'Comidas', zh: '正餐', hi: 'भोजन', fr: 'Repas' },
  addToCart: { 'pt-br': 'Adicionar', en: 'Add to Cart', es: 'Añadir al carrito', zh: '添加到购物车', hi: 'कार्ट में जोड़ें', fr: 'Ajouter au panier' },
  cart: { 'pt-br': 'Seu Carrinho', en: 'Your Cart', es: 'Tu Carrito', zh: '您的购物车', hi: 'आपकी कार्ट', fr: 'Votre Panier' },
  cartEmpty: { 'pt-br': 'Seu carrinho está vazio', en: 'Your cart is empty', es: 'Tu carrito está vacío', zh: '您的购物车是空的', hi: 'आपकी कार्ट खाली है', fr: 'Votre panier est vide' },
  total: { 'pt-br': 'Total', en: 'Total', es: 'Total', zh: '总计', hi: 'कुल', fr: 'Total' },
  finishOrder: { 'pt-br': 'Finalizar Pedido', en: 'Finish Order', es: 'Finalizar pedido', zh: '完成订单', hi: 'ऑर्डर पूरा करें', fr: 'Finaliser la commande' },
  orderPlaced: { 'pt-br': 'Pedido Realizado!', en: 'Order Placed!', es: '¡Pedido realizado!', zh: '订单已下！', hi: 'ऑर्डर दे दिया गया है!', fr: 'Commande passée !' },
  processingOrder: { 'pt-br': 'Processando seu pedido...', en: 'Processing your order...', es: 'Procesando tu pedido...', zh: '正在处理您的订单...', hi: 'आपका ऑर्डर प्रोसेस किया जा रहा है...', fr: 'Traitement de votre commande...' },
  paymentPix: { 'pt-br': 'Pagamento PIX', en: 'PIX Payment', es: 'Pago PIX', zh: 'PIX 支付', hi: 'PIX भुगतान', fr: 'Paiement PIX' },
  pixDescription: { 'pt-br': 'Escaneie o código acima ou use o copia e cola para pagar', en: 'Scan the code above or use copy and paste to pay', es: 'Escanea el código de arriba o usa copiar y pegar para pagar', zh: '扫描上方代码或使用复制粘贴进行支付', hi: 'भुगतान करने के लिए ऊपर दिए गए कोड को स्कैन करें या कॉपी और पेस्ट का उपयोग करें', fr: 'Scannez le code ci-dessus ou utilisez le copier-coller pour payer' },
  confirmPayment: { 'pt-br': 'Confirmar Pagamento', en: 'Confirm Payment', es: 'Confirmar pago', zh: '确认付款', hi: 'भुगतान की पुष्टि करें', fr: 'Confirmer le paiement' },
  cancel: { 'pt-br': 'Cancelar', en: 'Cancel', es: 'Cancelar', zh: '取消', hi: 'रद्द करें', fr: 'Annuler' },
  orderStatus: { 'pt-br': 'Status do Pedido', en: 'Order Status', es: 'Estado del pedido', zh: '订单状态', hi: 'ऑर्डर की स्थिति', fr: 'Statut de la commande' },
  paidWaiting: { 'pt-br': 'Pago - Aguardando Preparo', en: 'Paid - Waiting Preparation', es: 'Pagado - Esperando preparación', zh: '已付款 - 等待准备', hi: 'भुगतान किया गया - तैयारी की प्रतीक्षा है', fr: 'Payé - En attente de préparation' },
  preparing: { 'pt-br': 'Em Preparo', en: 'Preparing', es: 'En preparación', zh: '准备中', hi: 'तैयारी में', fr: 'En préparation' },
  ready: { 'pt-br': 'Pronto para Retirada', en: 'Ready for Pickup', es: 'Listo para recoger', zh: '准备取货', hi: 'पिकअप के लिए तैयार', fr: 'Prêt pour le retrait' },
  delivered: { 'pt-br': 'Entregue', en: 'Delivered', es: 'Entregado', zh: '已送达', hi: 'पहुंचा दिया गया', fr: 'Livré' },
  cancelled: { 'pt-br': 'Cancelado', en: 'Cancelled', es: 'Cancelado', zh: '已取消', hi: 'रद्द कर दिया गया', fr: 'Annulé' },
  observations: { 'pt-br': 'Observações', en: 'Observations', es: 'Observaciones', zh: '备注', hi: 'टिप्पणियाँ', fr: 'Observations' },
  quantity: { 'pt-br': 'Quantidade', en: 'Quantity', es: 'Cantidad', zh: '数量', hi: 'मात्रा', fr: 'Quantité' },
  addNote: { 'pt-br': 'Adicionar observação (ex: sem cebola)', en: 'Add note (e.g. no onion)', es: 'Añadir nota (ej: sin cebolla)', zh: '添加备注（例如：不要洋葱）', hi: 'नोट जोड़ें (जैसे: कोई प्याज नहीं)', fr: 'Ajouter une note (ex : sans oignon)' },
  confirm: { 'pt-br': 'Confirmar', en: 'Confirm', es: 'Confirmar', zh: '确认', hi: 'पुष्टि करें', fr: 'Confirmer' },
  remove: { 'pt-br': 'Remover', en: 'Remove', es: 'Eliminar', zh: '移除', hi: 'हटाएं', fr: 'Supprimer' },

  // Admin View
  dashboard: { 'pt-br': 'Painel', en: 'Dashboard', es: 'Tablero', zh: '仪表板', hi: 'डैशबोर्ड', fr: 'Tableau de bord' },
  orders: { 'pt-br': 'Pedidos', en: 'Orders', es: 'Pedidos', zh: '订单', hi: 'ऑर्डर', fr: 'Commandes' },
  menu: { 'pt-br': 'Cardápio', en: 'Menu', es: 'Menú', zh: '菜单', hi: 'मेनू', fr: 'Menu' },
  tables: { 'pt-br': 'Mesas', en: 'Tables', es: 'Mesas', zh: '桌子', hi: 'टेबल', fr: 'Tables' },
  totalRevenue: { 'pt-br': 'Faturamento Total', en: 'Total Revenue', es: 'Ingresos totales', zh: '总收入', hi: 'कुल राजस्व', fr: 'Revenu total' },
  newOrders: { 'pt-br': 'Novos Pedidos', en: 'New Orders', es: 'Nuevos pedidos', zh: '新订单', hi: 'नए ऑर्डर', fr: 'Nouvelles commandes' },
  preparingCount: { 'pt-br': 'Em Preparo', en: 'Preparing', es: 'En preparación', zh: '准备中', hi: 'तैयारी में', fr: 'En préparation' },
  manageOrders: { 'pt-br': 'Gerenciamento de Pedidos', en: 'Order Management', es: 'Gestión de pedidos', zh: '订单管理', hi: 'ऑर्डर प्रबंधन', fr: 'Gestion des commandes' },
  idMesa: { 'pt-br': 'ID / Mesa', en: 'ID / Table', es: 'ID / Mesa', zh: 'ID / 桌子', hi: 'ID / टेबल', fr: 'ID / Table' },
  items: { 'pt-br': 'Itens', en: 'Items', es: 'Artículos', zh: '项目', hi: 'आइटम', fr: 'Articles' },
  status: { 'pt-br': 'Status', en: 'Status', es: 'Estado', zh: '状态', hi: 'स्थिति', fr: 'Statut' },
  actions: { 'pt-br': 'Ações', en: 'Actions', es: 'Acciones', zh: '操作', hi: 'कार्रवाई', fr: 'Actions' },
  prepare: { 'pt-br': 'Preparar', en: 'Prepare', es: 'Preparar', zh: '准备', hi: 'तैयाر करें', fr: 'Préparer' },
  done: { 'pt-br': 'Pronto', en: 'Done', es: 'Listo', zh: '完成', hi: 'हो गया', fr: 'Fait' },
  deliver: { 'pt-br': 'Entregar', en: 'Deliver', es: 'Entregar', zh: '送达', hi: 'वितरित करें', fr: 'Livrer' },
  available: { 'pt-br': 'Disponível', en: 'Available', es: 'Disponible', zh: '可用', hi: 'उपलब्ध', fr: 'Disponible' },
  unavailable: { 'pt-br': 'Indisponível', en: 'Unavailable', es: 'No disponible', zh: '不可用', hi: 'अनुपलब्ध', fr: 'Indisponible' },
  change: { 'pt-br': 'Alterar', en: 'Change', es: 'Cambiar', zh: '更改', hi: 'बदलें', fr: 'Modifier' },
  addItem: { 'pt-br': 'Novo Item', en: 'Add Item', es: 'Añadir artículo', zh: '添加项目', hi: 'आइटम जोड़ें', fr: 'Ajouter un article' },
  editItem: { 'pt-br': 'Editar Item', en: 'Edit Item', es: 'Editar artículo', zh: '编辑项目', hi: 'आइटम संपादित करें', fr: 'Modifier l\'article' },
  addCategory: { 'pt-br': 'Nova Categoria', en: 'Add Category', es: 'Añadir categoría', zh: '添加类别', hi: 'श्रेणी जोड़ें', fr: 'Ajouter une catégorie' },
  editCategory: { 'pt-br': 'Editar Categoria', en: 'Edit Category', es: 'Editar categoría', zh: '编辑类别', hi: 'श्रेणी संपादित करें', fr: 'Modifier la catégorie' },
  name: { 'pt-br': 'Nome', en: 'Name', es: 'Nombre', zh: '名称', hi: 'नाम', fr: 'Nom' },
  description: { 'pt-br': 'Descrição', en: 'Description', es: 'Descripción', zh: '描述', hi: 'विवरण', fr: 'Description' },
  price: { 'pt-br': 'Preço', en: 'Price', es: 'Precio', zh: '价格', hi: 'कीमत', fr: 'Prix' },
  category: { 'pt-br': 'Categoria', en: 'Category', es: 'Categoría', zh: '类别', hi: 'श्रेणी', fr: 'Catégorie' },
  selectCategory: { 'pt-br': 'Selecione uma categoria', en: 'Select a category', es: 'Selecciona una categoría', zh: '选择类别', hi: 'श्रेणी चुनें', fr: 'Sélectionnez une catégorie' },
  imageUrl: { 'pt-br': 'URL da Imagem', en: 'Image URL', es: 'URL de la imagen', zh: '图片 URL', hi: 'छवि URL', fr: 'URL de l\'image' },
  save: { 'pt-br': 'Salvar', en: 'Save', es: 'Guardar', zh: '保存', hi: 'सहेजें', fr: 'Enregistrer' },
  id: { 'pt-br': 'ID (Slug)', en: 'ID (Slug)', es: 'ID (Slug)', zh: 'ID (Slug)', hi: 'ID (Slug)', fr: 'ID (Slug)' },
  icon: { 'pt-br': 'Ícone', en: 'Icon', es: 'Icono', zh: '图标', hi: 'आइकन', fr: 'Icône' },
  history: { 'pt-br': 'Histórico', en: 'History', es: 'Historial', zh: '历史', hi: 'इतिहास', fr: 'Historique' },
  date: { 'pt-br': 'Data', en: 'Date', es: 'Fecha', zh: '日期', hi: 'तारीख', fr: 'Date' },
  user: { 'pt-br': 'Usuário', en: 'User', es: 'Usuario', zh: '用户', hi: 'उपयोगकर्ता', fr: 'Utilisateur' },
  action: { 'pt-br': 'Ação', en: 'Action', es: 'Acción', zh: '动作', hi: 'कार्रवाई', fr: 'Action' },
  entity: { 'pt-br': 'Entidade', en: 'Entity', es: 'Entidad', zh: '实体', hi: 'सत्ता', fr: 'Entité' },
  
  // Home
  client: { 'pt-br': 'Cliente', en: 'Client', es: 'Cliente', zh: '客户', hi: 'ग्राहक', fr: 'Client' },
  admin: { 'pt-br': 'Administrador', en: 'Administrator', es: 'Administrador', zh: '管理员', hi: 'व्यवस्थापक', fr: 'Administrateur' },
  waiter: { 'pt-br': 'Atendente', en: 'Attendant', es: 'Attendant', zh: '服务员', hi: 'परिचारक', fr: 'Serveur' },
  scanQrCode: { 'pt-br': 'Escanear QR Code', en: 'Scan QR Code', es: 'Escanear código QR', zh: '扫描二维码', hi: 'क्यूआर कोड स्कैन करें', fr: 'Scanner le code QR' },
  chooseTable: { 'pt-br': 'Escolher Mesa Livre', en: 'Choose Free Table', es: 'Elegir mesa libre', zh: '选择空闲桌子', hi: 'मुफ़्त टेबल चुनें', fr: 'Choisir une table libre' },
  noFreeTables: { 'pt-br': 'Não há mesas livres no momento.', en: 'No free tables at the moment.', es: 'No hay mesas libres en este momento.', zh: '目前没有空闲桌子。', hi: 'इस समय कोई खाली टेबल नहीं है।', fr: 'Il n\'y a pas de tables libres pour le moment.' },
  back: { 'pt-br': 'Voltar', en: 'Back', es: 'Volver', zh: '返回', hi: 'पीछे', fr: 'Retour' },
  selectYourTable: { 'pt-br': 'Selecione sua mesa', en: 'Select your table', es: 'Selecciona tu mesa', zh: '选择您的桌子', hi: 'अपनी टेबल चुनें', fr: 'Sélectionnez votre table' },
  cameraError: { 'pt-br': 'Erro ao acessar a câmera.', en: 'Error accessing camera.', es: 'Error al acceder a la cámara.', zh: '访问摄像头时出错。', hi: 'कैमरा एक्सेस करने में त्रुटि।', fr: 'Erreur lors de l\'accès à la caméra.' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'pt-br';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string) => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}
