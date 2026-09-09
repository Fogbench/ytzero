import type { Language } from "./types";

type DeviceSettingsMessages = {
  deviceSettingsTitle: string;
  deviceSettingsDescription: string;
  connection: string;
  currentInstance: string;
  changeInstanceHint: string;
  session: string;
  signOutHint: string;
  more: string;
  less: string;
};

const deviceSettingsMessages: Record<Language, DeviceSettingsMessages> = {
  en: {
    deviceSettingsTitle: "Settings", deviceSettingsDescription: "Connection and session settings for this television.", connection: "Connection", currentInstance: "Current instance", changeInstanceHint: "Forget this address and connect the television to another YT Zero instance.", session: "Session", signOutHint: "Remove this television's access to the current profile.", more: "More", less: "Less",
  },
  pl: {
    deviceSettingsTitle: "Ustawienia", deviceSettingsDescription: "Połączenie i sesja tego telewizora.", connection: "Połączenie", currentInstance: "Bieżąca instancja", changeInstanceHint: "Usuń ten adres i połącz telewizor z inną instancją YT Zero.", session: "Sesja", signOutHint: "Usuń dostęp tego telewizora do bieżącego profilu.", more: "Więcej", less: "Mniej",
  },
  de: {
    deviceSettingsTitle: "Einstellungen", deviceSettingsDescription: "Verbindungs- und Sitzungseinstellungen für diesen Fernseher.", connection: "Verbindung", currentInstance: "Aktuelle Instanz", changeInstanceHint: "Diese Adresse entfernen und den Fernseher mit einer anderen YT-Zero-Instanz verbinden.", session: "Sitzung", signOutHint: "Den Zugriff dieses Fernsehers auf das aktuelle Profil entfernen.", more: "Mehr", less: "Weniger",
  },
  fr: {
    deviceSettingsTitle: "Réglages", deviceSettingsDescription: "Connexion et session de ce téléviseur.", connection: "Connexion", currentInstance: "Instance actuelle", changeInstanceHint: "Oublier cette adresse et connecter le téléviseur à une autre instance YT Zero.", session: "Session", signOutHint: "Supprimer l’accès de ce téléviseur au profil actuel.", more: "Plus", less: "Moins",
  },
  es: {
    deviceSettingsTitle: "Ajustes", deviceSettingsDescription: "Conexión y sesión de este televisor.", connection: "Conexión", currentInstance: "Instancia actual", changeInstanceHint: "Olvida esta dirección y conecta el televisor a otra instancia de YT Zero.", session: "Sesión", signOutHint: "Elimina el acceso de este televisor al perfil actual.", more: "Más", less: "Menos",
  },
  "pt-BR": {
    deviceSettingsTitle: "Configurações", deviceSettingsDescription: "Conexão e sessão desta televisão.", connection: "Conexão", currentInstance: "Instância atual", changeInstanceHint: "Esqueça este endereço e conecte a televisão a outra instância do YT Zero.", session: "Sessão", signOutHint: "Remova o acesso desta televisão ao perfil atual.", more: "Mais", less: "Menos",
  },
  ru: {
    deviceSettingsTitle: "Настройки", deviceSettingsDescription: "Подключение и сеанс этого телевизора.", connection: "Подключение", currentInstance: "Текущая установка", changeInstanceHint: "Удалить этот адрес и подключить телевизор к другой установке YT Zero.", session: "Сеанс", signOutHint: "Удалить доступ этого телевизора к текущему профилю.", more: "Ещё", less: "Скрыть",
  },
  ja: {
    deviceSettingsTitle: "設定", deviceSettingsDescription: "このテレビの接続とセッションの設定です。", connection: "接続", currentInstance: "現在のインスタンス", changeInstanceHint: "このアドレスを削除し、別の YT Zero インスタンスに接続します。", session: "セッション", signOutHint: "このテレビから現在のプロフィールへのアクセスを削除します。", more: "その他", less: "閉じる",
  },
  hu: {
    deviceSettingsTitle: "Beállítások", deviceSettingsDescription: "A televízió kapcsolati és munkamenet-beállításai.", connection: "Kapcsolat", currentInstance: "Jelenlegi példány", changeInstanceHint: "A cím törlése és a televízió csatlakoztatása egy másik YT Zero-példányhoz.", session: "Munkamenet", signOutHint: "A televízió hozzáférésének eltávolítása a jelenlegi profilhoz.", more: "Továbbiak", less: "Kevesebb",
  },
};

const en = {
  ...deviceSettingsMessages.en,
  booting: "Starting YT Zero…",
  instanceTitle: "Connect to YT Zero",
  instanceDescription: "Enter the address of your YT Zero instance. This is saved only on this television.",
  addressLabel: "Instance address",
  addressHint: "For example: https://video.example.com or http://192.168.1.20:3001",
  connect: "Connect",
  connecting: "Connecting…",
  invalidAddress: "Enter a valid HTTP or HTTPS address without a path.",
  cannotConnect: "YT Zero could not be reached at this address.",
  cleartextTitle: "Local connection",
  cleartextHint: "HTTP does not encrypt the connection. Use it only on a trusted home network; HTTPS is recommended.",
  pairTitle: "Pair this television",
  pairDescription: "Scan the QR code with a signed-in device, or open the address and enter the code.",
  enterCode: "Enter this code",
  waiting: "Waiting for approval…",
  pairExpired: "The pairing code expired.",
  retry: "Create a new code",
  changeInstance: "Change instance",
  feedTitle: "Your feed",
  published: "Published",
  arrival: "Added",
  inboxOnly: "Unwatched",
  allVideos: "Show all",
  loadingFeed: "Loading your feed…",
  loadMore: "Load more",
  emptyFeed: "Nothing to watch",
  emptyFeedHint: "You are caught up, or the current filters hide every video.",
  loadError: "The feed could not be loaded.",
  settings: "Device",
  signOut: "Sign out",
  back: "Back",
  markWatched: "Mark watched",
  reject: "Reject",
  actionFailed: "The action could not be saved.",
  feedPrototype: "This first build covers pairing and feed management. Native playback is the next milestone.",
  noDescription: "No description.",
};

type Messages = { [Key in keyof typeof en]: string };
export type TranslationKey = keyof Messages;
export type Translate = (key: TranslationKey) => string;

const messages: Record<Language, Messages> = {
  en,
  pl: {
    ...deviceSettingsMessages.pl,
    booting: "Uruchamianie YT Zero…",
    instanceTitle: "Połącz z YT Zero",
    instanceDescription: "Podaj adres swojej instancji YT Zero. Zostanie zapisany tylko na tym telewizorze.",
    addressLabel: "Adres instancji",
    addressHint: "Na przykład: https://video.example.com albo http://192.168.1.20:3001",
    connect: "Połącz",
    connecting: "Łączenie…",
    invalidAddress: "Podaj poprawny adres HTTP lub HTTPS bez dodatkowej ścieżki.",
    cannotConnect: "Nie udało się połączyć z YT Zero pod tym adresem.",
    cleartextTitle: "Połączenie lokalne",
    cleartextHint: "HTTP nie szyfruje połączenia. Używaj go tylko w zaufanej sieci domowej; zalecany jest HTTPS.",
    pairTitle: "Połącz ten telewizor",
    pairDescription: "Zeskanuj kod QR na zalogowanym urządzeniu albo otwórz podany adres i wpisz kod.",
    enterCode: "Wpisz ten kod",
    waiting: "Oczekiwanie na zatwierdzenie…",
    pairExpired: "Kod parowania wygasł.",
    retry: "Utwórz nowy kod",
    changeInstance: "Zmień instancję",
    feedTitle: "Twój feed",
    published: "Opublikowane",
    arrival: "Dodane",
    inboxOnly: "Nieobejrzane",
    allVideos: "Pokaż wszystkie",
    loadingFeed: "Ładowanie feedu…",
    loadMore: "Wczytaj więcej",
    emptyFeed: "Nie ma nic do obejrzenia",
    emptyFeedHint: "Wszystko nadrobione albo bieżące filtry ukrywają wszystkie filmy.",
    loadError: "Nie udało się wczytać feedu.",
    settings: "Urządzenie",
    signOut: "Wyloguj",
    back: "Wróć",
    markWatched: "Oznacz obejrzane",
    reject: "Odrzuć",
    actionFailed: "Nie udało się zapisać działania.",
    feedPrototype: "Pierwsza wersja obejmuje parowanie i obsługę feedu. Natywny odtwarzacz jest kolejnym etapem.",
    noDescription: "Brak opisu.",
  },
  de: {
    ...deviceSettingsMessages.de,
    loadMore: "Mehr laden",
    booting: "YT Zero wird gestartet…", instanceTitle: "Mit YT Zero verbinden", instanceDescription: "Gib die Adresse deiner YT-Zero-Instanz ein. Sie wird nur auf diesem Fernseher gespeichert.", addressLabel: "Instanzadresse", addressHint: "Zum Beispiel: https://video.example.com oder http://192.168.1.20:3001", connect: "Verbinden", connecting: "Verbindung wird hergestellt…", invalidAddress: "Gib eine gültige HTTP- oder HTTPS-Adresse ohne Pfad ein.", cannotConnect: "YT Zero ist unter dieser Adresse nicht erreichbar.", cleartextTitle: "Lokale Verbindung", cleartextHint: "HTTP verschlüsselt die Verbindung nicht. Verwende es nur in einem vertrauenswürdigen Heimnetz; HTTPS wird empfohlen.", pairTitle: "Diesen Fernseher verbinden", pairDescription: "Scanne den QR-Code mit einem angemeldeten Gerät oder öffne die Adresse und gib den Code ein.", enterCode: "Diesen Code eingeben", waiting: "Warten auf Bestätigung…", pairExpired: "Der Verbindungscode ist abgelaufen.", retry: "Neuen Code erstellen", changeInstance: "Instanz wechseln", feedTitle: "Dein Feed", published: "Veröffentlicht", arrival: "Hinzugefügt", inboxOnly: "Ungesehen", allVideos: "Alle anzeigen", loadingFeed: "Feed wird geladen…", emptyFeed: "Nichts zu sehen", emptyFeedHint: "Du bist auf dem neuesten Stand oder die Filter blenden alle Videos aus.", loadError: "Der Feed konnte nicht geladen werden.", settings: "Gerät", signOut: "Abmelden", back: "Zurück", markWatched: "Als gesehen markieren", reject: "Ablehnen", actionFailed: "Die Aktion konnte nicht gespeichert werden.", feedPrototype: "Diese erste Version umfasst Kopplung und Feed-Verwaltung. Native Wiedergabe ist der nächste Meilenstein.", noDescription: "Keine Beschreibung.",
  },
  fr: {
    ...deviceSettingsMessages.fr,
    loadMore: "Charger plus",
    booting: "Démarrage de YT Zero…", instanceTitle: "Se connecter à YT Zero", instanceDescription: "Saisissez l’adresse de votre instance YT Zero. Elle est enregistrée uniquement sur ce téléviseur.", addressLabel: "Adresse de l’instance", addressHint: "Par exemple : https://video.example.com ou http://192.168.1.20:3001", connect: "Se connecter", connecting: "Connexion…", invalidAddress: "Saisissez une adresse HTTP ou HTTPS valide sans chemin.", cannotConnect: "YT Zero est inaccessible à cette adresse.", cleartextTitle: "Connexion locale", cleartextHint: "HTTP ne chiffre pas la connexion. Utilisez-le uniquement sur un réseau domestique fiable ; HTTPS est recommandé.", pairTitle: "Associer ce téléviseur", pairDescription: "Scannez le code QR avec un appareil connecté, ou ouvrez l’adresse et saisissez le code.", enterCode: "Saisissez ce code", waiting: "En attente de l’autorisation…", pairExpired: "Le code d’association a expiré.", retry: "Créer un nouveau code", changeInstance: "Changer d’instance", feedTitle: "Votre fil", published: "Publication", arrival: "Ajout", inboxOnly: "Non regardées", allVideos: "Tout afficher", loadingFeed: "Chargement du fil…", emptyFeed: "Rien à regarder", emptyFeedHint: "Vous êtes à jour ou les filtres masquent toutes les vidéos.", loadError: "Impossible de charger le fil.", settings: "Appareil", signOut: "Se déconnecter", back: "Retour", markWatched: "Marquer comme regardée", reject: "Rejeter", actionFailed: "Impossible d’enregistrer l’action.", feedPrototype: "Cette première version couvre l’association et la gestion du fil. La lecture native est la prochaine étape.", noDescription: "Aucune description.",
  },
  es: {
    ...deviceSettingsMessages.es,
    loadMore: "Cargar más",
    booting: "Iniciando YT Zero…", instanceTitle: "Conectar con YT Zero", instanceDescription: "Introduce la dirección de tu instancia de YT Zero. Solo se guardará en este televisor.", addressLabel: "Dirección de la instancia", addressHint: "Por ejemplo: https://video.example.com o http://192.168.1.20:3001", connect: "Conectar", connecting: "Conectando…", invalidAddress: "Introduce una dirección HTTP o HTTPS válida sin ruta.", cannotConnect: "No se ha podido acceder a YT Zero en esta dirección.", cleartextTitle: "Conexión local", cleartextHint: "HTTP no cifra la conexión. Úsalo solo en una red doméstica de confianza; se recomienda HTTPS.", pairTitle: "Vincular este televisor", pairDescription: "Escanea el código QR con un dispositivo que tenga la sesión iniciada, o abre la dirección e introduce el código.", enterCode: "Introduce este código", waiting: "Esperando autorización…", pairExpired: "El código de vinculación ha caducado.", retry: "Crear un código nuevo", changeInstance: "Cambiar instancia", feedTitle: "Tu feed", published: "Publicación", arrival: "Añadido", inboxOnly: "Sin ver", allVideos: "Mostrar todo", loadingFeed: "Cargando el feed…", emptyFeed: "Nada que ver", emptyFeedHint: "Estás al día o los filtros ocultan todos los vídeos.", loadError: "No se ha podido cargar el feed.", settings: "Dispositivo", signOut: "Cerrar sesión", back: "Volver", markWatched: "Marcar como visto", reject: "Rechazar", actionFailed: "No se ha podido guardar la acción.", feedPrototype: "Esta primera versión incluye la vinculación y la gestión del feed. La reproducción nativa es el siguiente objetivo.", noDescription: "Sin descripción.",
  },
  "pt-BR": {
    ...deviceSettingsMessages["pt-BR"],
    loadMore: "Carregar mais",
    booting: "Iniciando o YT Zero…", instanceTitle: "Conectar ao YT Zero", instanceDescription: "Digite o endereço da sua instância do YT Zero. Ele será salvo apenas nesta televisão.", addressLabel: "Endereço da instância", addressHint: "Por exemplo: https://video.example.com ou http://192.168.1.20:3001", connect: "Conectar", connecting: "Conectando…", invalidAddress: "Digite um endereço HTTP ou HTTPS válido, sem caminho.", cannotConnect: "Não foi possível acessar o YT Zero neste endereço.", cleartextTitle: "Conexão local", cleartextHint: "HTTP não criptografa a conexão. Use apenas em uma rede doméstica confiável; HTTPS é recomendado.", pairTitle: "Conectar esta TV", pairDescription: "Escaneie o código QR com um dispositivo conectado ou abra o endereço e digite o código.", enterCode: "Digite este código", waiting: "Aguardando autorização…", pairExpired: "O código de conexão expirou.", retry: "Criar novo código", changeInstance: "Alterar instância", feedTitle: "Seu feed", published: "Publicado", arrival: "Adicionado", inboxOnly: "Não assistidos", allVideos: "Mostrar todos", loadingFeed: "Carregando o feed…", emptyFeed: "Nada para assistir", emptyFeedHint: "Você está em dia ou os filtros ocultam todos os vídeos.", loadError: "Não foi possível carregar o feed.", settings: "Dispositivo", signOut: "Sair", back: "Voltar", markWatched: "Marcar como assistido", reject: "Rejeitar", actionFailed: "Não foi possível salvar a ação.", feedPrototype: "Esta primeira versão inclui conexão e gerenciamento do feed. A reprodução nativa é o próximo marco.", noDescription: "Sem descrição.",
  },
  ru: {
    ...deviceSettingsMessages.ru,
    loadMore: "Загрузить ещё",
    booting: "Запуск YT Zero…", instanceTitle: "Подключение к YT Zero", instanceDescription: "Введите адрес вашей установки YT Zero. Он будет сохранён только на этом телевизоре.", addressLabel: "Адрес установки", addressHint: "Например: https://video.example.com или http://192.168.1.20:3001", connect: "Подключиться", connecting: "Подключение…", invalidAddress: "Введите корректный адрес HTTP или HTTPS без пути.", cannotConnect: "Не удалось открыть YT Zero по этому адресу.", cleartextTitle: "Локальное подключение", cleartextHint: "HTTP не шифрует соединение. Используйте его только в доверенной домашней сети; рекомендуется HTTPS.", pairTitle: "Подключить телевизор", pairDescription: "Отсканируйте QR-код на устройстве с активным сеансом или откройте адрес и введите код.", enterCode: "Введите этот код", waiting: "Ожидание подтверждения…", pairExpired: "Срок действия кода истёк.", retry: "Создать новый код", changeInstance: "Сменить установку", feedTitle: "Ваша лента", published: "Опубликовано", arrival: "Добавлено", inboxOnly: "Непросмотренные", allVideos: "Показать все", loadingFeed: "Загрузка ленты…", emptyFeed: "Смотреть нечего", emptyFeedHint: "Вы всё посмотрели или фильтры скрывают все видео.", loadError: "Не удалось загрузить ленту.", settings: "Устройство", signOut: "Выйти", back: "Назад", markWatched: "Отметить просмотренным", reject: "Отклонить", actionFailed: "Не удалось сохранить действие.", feedPrototype: "Первая версия поддерживает подключение и управление лентой. Нативный проигрыватель — следующий этап.", noDescription: "Нет описания.",
  },
  ja: {
    ...deviceSettingsMessages.ja,
    loadMore: "さらに読み込む",
    booting: "YT Zero を起動中…", instanceTitle: "YT Zero に接続", instanceDescription: "YT Zero インスタンスのアドレスを入力します。このテレビにのみ保存されます。", addressLabel: "インスタンスのアドレス", addressHint: "例: https://video.example.com または http://192.168.1.20:3001", connect: "接続", connecting: "接続中…", invalidAddress: "パスを含まない有効な HTTP または HTTPS アドレスを入力してください。", cannotConnect: "このアドレスの YT Zero に接続できませんでした。", cleartextTitle: "ローカル接続", cleartextHint: "HTTP 接続は暗号化されません。信頼できるホームネットワークでのみ使用し、通常は HTTPS を推奨します。", pairTitle: "このテレビを接続", pairDescription: "ログイン済みの端末で QR コードを読み取るか、アドレスを開いてコードを入力します。", enterCode: "このコードを入力", waiting: "許可を待っています…", pairExpired: "接続コードの期限が切れました。", retry: "新しいコードを作成", changeInstance: "インスタンスを変更", feedTitle: "フィード", published: "公開日", arrival: "追加日", inboxOnly: "未視聴", allVideos: "すべて表示", loadingFeed: "フィードを読み込み中…", emptyFeed: "視聴する動画はありません", emptyFeedHint: "すべて視聴済みか、フィルターですべての動画が非表示です。", loadError: "フィードを読み込めませんでした。", settings: "デバイス", signOut: "ログアウト", back: "戻る", markWatched: "視聴済みにする", reject: "除外", actionFailed: "操作を保存できませんでした。", feedPrototype: "最初のバージョンは接続とフィード管理に対応しています。ネイティブ再生は次のマイルストーンです。", noDescription: "説明はありません。",
  },
  hu: {
    ...deviceSettingsMessages.hu,
    loadMore: "Továbbiak betöltése",
    booting: "A YT Zero indítása…", instanceTitle: "Csatlakozás a YT Zerohoz", instanceDescription: "Add meg a YT Zero-példány címét. A cím csak ezen a televízión lesz tárolva.", addressLabel: "Példány címe", addressHint: "Például: https://video.example.com vagy http://192.168.1.20:3001", connect: "Csatlakozás", connecting: "Csatlakozás…", invalidAddress: "Adj meg egy érvényes HTTP- vagy HTTPS-címet elérési út nélkül.", cannotConnect: "A YT Zero nem érhető el ezen a címen.", cleartextTitle: "Helyi kapcsolat", cleartextHint: "A HTTP nem titkosítja a kapcsolatot. Csak megbízható otthoni hálózaton használd; a HTTPS ajánlott.", pairTitle: "Televízió párosítása", pairDescription: "Olvasd be a QR-kódot egy bejelentkezett eszközzel, vagy nyisd meg a címet, és írd be a kódot.", enterCode: "Írd be ezt a kódot", waiting: "Várakozás az engedélyezésre…", pairExpired: "A párosítási kód lejárt.", retry: "Új kód létrehozása", changeInstance: "Példány váltása", feedTitle: "Saját hírfolyam", published: "Közzétéve", arrival: "Hozzáadva", inboxOnly: "Nem látott", allVideos: "Összes megjelenítése", loadingFeed: "Hírfolyam betöltése…", emptyFeed: "Nincs mit megnézni", emptyFeedHint: "Mindent megnéztél, vagy a szűrők elrejtik az összes videót.", loadError: "A hírfolyam nem tölthető be.", settings: "Eszköz", signOut: "Kijelentkezés", back: "Vissza", markWatched: "Megnézettnek jelölés", reject: "Elutasítás", actionFailed: "A művelet nem menthető.", feedPrototype: "Az első verzió a párosítást és a hírfolyam kezelését tartalmazza. A natív lejátszás a következő mérföldkő.", noDescription: "Nincs leírás.",
  },
};

const supported = new Set<Language>(["en", "pl", "de", "fr", "es", "pt-BR", "ru", "ja", "hu"]);

export function deviceLanguage(): Language {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  if (locale.toLowerCase().startsWith("pt-br")) return "pt-BR";
  const base = locale.split("-")[0] as Language;
  return supported.has(base) ? base : "en";
}

export function normalizeLanguage(value: unknown): Language {
  return typeof value === "string" && supported.has(value as Language) ? value as Language : "en";
}

export function translator(language: Language): Translate {
  return (key: keyof Messages): string => messages[language][key];
}

export const localeTags: Record<Language, string> = {
  en: "en-US", pl: "pl-PL", de: "de-DE", fr: "fr-FR", es: "es-ES",
  "pt-BR": "pt-BR", ru: "ru-RU", ja: "ja-JP", hu: "hu-HU",
};
