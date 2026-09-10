import type { Language } from "./types";

type Messages = {
  discoveryIntro: string; nearbyInstances: string; searchingInstances: string; noInstancesFound: string;
  discoveryUnavailable: string; discoveryHint: string; scanAgain: string; manualAddress: string;
};

export const discoveryMessages: Record<Language, Messages> = {
  en: {
    discoveryIntro: "Choose a nearby YT Zero instance or enter its address. Then pair this television with your profile.",
    nearbyInstances: "On your network", searchingInstances: "Looking for YT Zero…", noInstancesFound: "No instances found yet",
    discoveryUnavailable: "Local discovery is unavailable", discoveryHint: "Connect your television and server to the same local network. You can also enter an address.",
    scanAgain: "Search again", manualAddress: "Enter an address",
  },
  pl: {
    discoveryIntro: "Wybierz instancję YT Zero w pobliżu lub wpisz jej adres. Następnie sparuj telewizor ze swoim profilem.",
    nearbyInstances: "W Twojej sieci", searchingInstances: "Szukanie YT Zero…", noInstancesFound: "Nie znaleziono jeszcze instancji",
    discoveryUnavailable: "Wykrywanie w sieci jest niedostępne", discoveryHint: "Połącz telewizor i serwer z tą samą siecią lokalną. Możesz też wpisać adres.",
    scanAgain: "Szukaj ponownie", manualAddress: "Wpisz adres",
  },
  de: {
    discoveryIntro: "Wähle eine YT-Zero-Instanz in der Nähe oder gib ihre Adresse ein. Kopple dann diesen Fernseher mit deinem Profil.",
    nearbyInstances: "In deinem Netzwerk", searchingInstances: "YT Zero wird gesucht…", noInstancesFound: "Noch keine Instanzen gefunden",
    discoveryUnavailable: "Lokale Suche ist nicht verfügbar", discoveryHint: "Verbinde Fernseher und Server mit demselben lokalen Netzwerk. Du kannst auch eine Adresse eingeben.",
    scanAgain: "Erneut suchen", manualAddress: "Adresse eingeben",
  },
  fr: {
    discoveryIntro: "Choisissez une instance YT Zero à proximité ou saisissez son adresse. Associez ensuite ce téléviseur à votre profil.",
    nearbyInstances: "Sur votre réseau", searchingInstances: "Recherche de YT Zero…", noInstancesFound: "Aucune instance trouvée pour le moment",
    discoveryUnavailable: "La recherche locale est indisponible", discoveryHint: "Connectez votre téléviseur et votre serveur au même réseau local. Vous pouvez aussi saisir une adresse.",
    scanAgain: "Relancer la recherche", manualAddress: "Saisir une adresse",
  },
  es: {
    discoveryIntro: "Elige una instancia de YT Zero cercana o introduce su dirección. Después, vincula este televisor con tu perfil.",
    nearbyInstances: "En tu red", searchingInstances: "Buscando YT Zero…", noInstancesFound: "Aún no se han encontrado instancias",
    discoveryUnavailable: "La búsqueda local no está disponible", discoveryHint: "Conecta el televisor y el servidor a la misma red local. También puedes introducir una dirección.",
    scanAgain: "Buscar de nuevo", manualAddress: "Introducir una dirección",
  },
  "pt-BR": {
    discoveryIntro: "Escolha uma instância do YT Zero próxima ou digite o endereço dela. Depois, vincule esta televisão ao seu perfil.",
    nearbyInstances: "Na sua rede", searchingInstances: "Buscando YT Zero…", noInstancesFound: "Nenhuma instância encontrada ainda",
    discoveryUnavailable: "A busca local está indisponível", discoveryHint: "Conecte a televisão e o servidor à mesma rede local. Você também pode digitar um endereço.",
    scanAgain: "Buscar novamente", manualAddress: "Digitar um endereço",
  },
  ru: {
    discoveryIntro: "Выберите экземпляр YT Zero поблизости или введите его адрес. Затем привяжите телевизор к своему профилю.",
    nearbyInstances: "В вашей сети", searchingInstances: "Поиск YT Zero…", noInstancesFound: "Экземпляры пока не найдены",
    discoveryUnavailable: "Поиск в локальной сети недоступен", discoveryHint: "Подключите телевизор и сервер к одной локальной сети. Также можно ввести адрес вручную.",
    scanAgain: "Искать снова", manualAddress: "Ввести адрес",
  },
  ja: {
    discoveryIntro: "近くの YT Zero インスタンスを選ぶか、アドレスを入力してください。その後、このテレビをプロフィールとペアリングします。",
    nearbyInstances: "ネットワーク上のインスタンス", searchingInstances: "YT Zero を検索中…", noInstancesFound: "インスタンスはまだ見つかりません",
    discoveryUnavailable: "ローカル検索を利用できません", discoveryHint: "テレビとサーバーを同じローカルネットワークに接続してください。アドレスを直接入力することもできます。",
    scanAgain: "もう一度検索", manualAddress: "アドレスを入力",
  },
  hu: {
    discoveryIntro: "Válassz egy közeli YT Zero-példányt, vagy add meg a címét. Ezután párosítsd a televíziót a profiloddal.",
    nearbyInstances: "A hálózatodon", searchingInstances: "YT Zero keresése…", noInstancesFound: "Még nem található példány",
    discoveryUnavailable: "A helyi keresés nem érhető el", discoveryHint: "Csatlakoztasd a televíziót és a szervert ugyanahhoz a helyi hálózathoz. Kézzel is megadhatsz egy címet.",
    scanAgain: "Keresés újra", manualAddress: "Cím megadása",
  },
};
