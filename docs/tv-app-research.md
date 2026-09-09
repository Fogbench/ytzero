# Aplikacja TV dla YT Zero — research i decyzja techniczna

Stan: 9 września 2026. Zakres: Apple TV, Android TV/Google TV i Fire TV.
Tizen i webOS są celowo poza zakresem.

## Decyzja

Najlepszym punktem startowym jest **Expo + `react-native-tvos`**, czyli kierunek
z podanego repozytorium, ale z Expo jako warstwą projektu i konfiguracji.
`react-native-tvos` utrzymuje wsparcie tvOS i Android TV, udostępnia natywne
zdarzenia focusu oraz TV-owe zachowanie `Pressable`. Dokumentacja projektu
rekomenduje Expo dla nowych aplikacji, a oficjalny szablon Expo `with-tv` jest
dziś oparty na stabilnej gałęzi `react-native-tvos`.

Nie jest to aplikacja webowa naciągnięta na telewizor: React Native tworzy
natywne widoki, focus i zdarzenia pilota. Współdzielimy logikę i większość UI,
ale zachowujemy możliwość dołożenia małych modułów Swift/Kotlin tam, gdzie
player lub zachowanie systemowe wymaga kodu platformowego.

Alternatywa — osobne SwiftUI dla tvOS i Jetpack Compose for TV dla Androida —
dałaby największą kontrolę, ale podwoiłaby koszt implementacji feedu, parowania,
filtrów i stanów błędów. Na etapie produktu YT Zero nie daje to proporcjonalnej
korzyści. Androidowy Media3 pozostaje dobrą warstwą pod natywnym playerem, nie
powodem do utrzymywania drugiego kompletnego klienta.

| Obszar | Apple TV | Android/Google TV | Fire TV |
| --- | --- | --- | --- |
| UI i nawigacja | natywne widoki tvOS i systemowy focus | natywne widoki Android i D-pad | ten sam wariant Android TV |
| Runtime | `react-native-tvos` | `react-native-tvos` | `react-native-tvos`; Amazon wskazuje ten sam szablon Expo |
| Player docelowy | AVPlayer przez `expo-video` lub moduł natywny | Media3/ExoPlayer przez `expo-video` lub moduł natywny | wariant Android |
| Dystrybucja | App Store / TestFlight | Play Console / sideload | Amazon Appstore / sideload |

## Co już działa w prototypie

Kod aplikacji znajduje się w `apps/tv` i zawiera:

- wpisanie i lokalny zapis adresu instancji (HTTPS oraz jawnie oznaczone HTTP
  dla zaufanej sieci domowej),
- utworzenie jednorazowego kodu, QR prowadzący do przeglądarkowego `/tv/pair`
  i kod do ręcznego przepisania,
- zatwierdzenie konkretnego profilu w istniejącym UI YT Zero,
- jednorazową wymianę kodu urządzenia na sesję Bearer, która wygasa
  po 30 dniach bezczynności i odnawia ten termin przy każdym użyciu, zapisaną
  w bezpiecznym magazynie systemu,
- natywny feed z paginacją, sortowaniem po publikacji/dodaniu, przełącznikiem
  nieobejrzane/wszystkie, focusami pilota, natywnym paralaksem miniatur na tvOS
  i przejściem do pełnego Watch Page,
- natywny sidebar TV zachowujący kolejność i widoczność pozycji z ustawienia
  `sidebar_nav`, z ikonami w stanie zwiniętym i pełnymi widokami YT Zero poza
  nieobsługiwanymi na TV sekcjami Social i Puls,
- avatar i nazwę aktywnego profilu oraz natywny picker respektujący metodę
  logowania, ukrywanie innych profili, PIN profilu i blokadę rodzicielską,
- pełny Watch Page dociągający kanoniczny stan materiału i aktywnego profilu:
  pionowy wariant dla Shorts, neutralne tagi, kanał, postęp, polubienie,
  obejrzane, planowanie na dziś, odrzucenie/przywrócenie, podobne materiały oraz
  komentarze zgodne z `watch_show_comments` i `watch_show_related`,
- osobny ekran ustawień urządzenia z wylogowaniem i zmianą instancji,
- komplet tekstów dla tych samych dziewięciu języków co główne UI.

To jest działający pionowy przekrój, nie kompletna aplikacja. Watch Page ma już
docelową, natywną strukturę treści i akcji, ale jego hero świadomie nie udaje
gotowego playera przed wprowadzeniem krótkotrwałych media-ticketów.

Prototyp został uruchomiony i sprawdzony na symulatorze Apple TV 4K z tvOS
26.5: odtworzenie zapisanej sesji, pobranie 40-elementowego feedu, miniatury,
nawigacja fokusem, przejście przez akcje i półkę podobnych na Watch Page,
otwieranie zwykłego filmu i Shortsa oraz powrót Menu/Back działają. W
`react-native-tvos` 0.86.2-0 z Fabric wielokolumnowy `FlatList` potrafił po
załadowaniu danych zwinąć wysokość do jednego punktu mimo `flex: 1`; ekran feedu
ustala więc jawnie wymiar okna i blokuje kurczenie listy. To była przyczyna
ciemnego ekranu po prawidłowym parowaniu.

## Parowanie i model bezpieczeństwa

Przepływ przypomina OAuth Device Authorization Grant, ale jest lokalny dla
instancji YT Zero:

```text
TV: POST /api/auth/device/code
        │
        ├── QR: https://instancja/tv/pair?code=ABCD-EFGH
        └── kod ręczny: ABCD-EFGH
                         │
telefon/komputer: zalogowanie → wybór bieżącego profilu → zatwierdzenie
                         │
TV: POST /api/auth/device/token (polling) → jednorazowy Bearer → /api/feed
```

Kod parowania żyje 10 minut, jest jednorazowy i ma 32⁸ możliwych wartości.
Serwer nie zwraca tokenu przeglądarce zatwierdzającej; odbiera go wyłącznie TV,
który zna losowy `device_code`. Dla `none`, logowania współdzielonego i OIDC
gateway sesja ma zakres konta, zaczyna od zatwierdzonego profilu i pozwala
przełączać profile z zachowaniem PIN-ów oraz blokady rodzicielskiej. Dla
`per_profile`, proxy i OIDC mapped pozostaje przypięta do zatwierdzonego profilu.
Może zostać unieważniona przez `/auth/logout`. Wygasa po 30 dniach bezczynności,
ale każde uwierzytelnione żądanie z telewizora przesuwa termin wygaśnięcia o
kolejne 30 dni. Kod
urządzenia jest stanem przejściowym, a sesja TV jest lokalnym stanem
uwierzytelnienia — oba są wyłączone z backupu przenośnego.

Adres instancji oraz token są konfiguracją konkretnego urządzenia i trafiają do
`expo-secure-store`. Token nie trafia do logów, QR ani query stringów. Android
ma włączony cleartext dla ręcznie wybranego lokalnego HTTP, a tvOS deklaruje
`NSAllowsLocalNetworking`; publiczne hosty bez podanego schematu domyślnie
otrzymują HTTPS.

## Reguły interfejsu TV

- Wszystkie ścieżki muszą działać D-padem/Apple TV Remote bez dotyku i kursora.
- Focus ma być oczywisty, stabilny i pozostawać pod kontrolą systemowego silnika;
  dane doładowane w tle nie powinny przenosić go bez intencji użytkownika.
- Back/Menu wraca o jeden poziom, a Play/Pause jest zarezerwowane dla playera.
- Układ pozostaje poziomy, z bezpiecznym marginesem, dużą typografią i celami
  fokusowymi czytelnymi z kilku metrów.
- Funkcje instancji (filtry feedu, obejrzane, odrzucenie) mogą być zmieniane na
  TV. Ustawienia serwera i kont pozostają w pełnym webowym UI. Na TV zostają
  wyłącznie ustawienia urządzenia: instancja, sesja, później player i napisy.

## Odtwarzacz: najtrudniejsza część

Nie należy budować playera z YouTube IFrame API w WebView. IFrame jest
przeglądarkowym API opartym o `postMessage`, a tvOS nie traktuje WebView jako
wspieranej drogi w `react-native-tvos`. Dochodzą focus, pilot, fullscreen,
autoplay, nagłówki autoryzacji i reguły YouTube zabraniające zasłaniania playera
lub obchodzenia jego identyfikacji. Efekt byłby mniej natywny i mniej niezawodny.

Docelowa ścieżka:

1. `expo-video` jako wspólna kontrolka oparta o AVPlayer i Media3/ExoPlayer.
2. Własna cienka abstrakcja YT Zero nad źródłem, pozycją, napisami, ścieżką
   audio, live/HLS i zdarzeniami pilota.
3. Krótkotrwały **media ticket** wystawiany przez backend dla jednego filmu i
   profilu. Ticket musi działać nie tylko dla manifestu, lecz także dla URL-i
   segmentów HLS. Nie wolno wkładać 30-dniowego Bearera do adresu filmu.
4. Najpierw odtwarzanie lokalnych downloadów/Tubearchivist oraz serwerowego HLS,
   potem live, napisy i audio, na końcu strojenie seekingu i recovery per system.
5. Jeżeli wspólna kontrolka nie dowiezie pilota, track selection albo stabilnego
   HLS, podmieniamy wyłącznie implementację playera na moduł Swift/Kotlin.

`react-native-video` nie jest obecnie lepszą bazą: jego bieżąca gałąź v7 nadal
oznacza TV jako niedokończone w macierzy repozytorium. `expo-video` jest aktywnie
utrzymywanym modułem Expo z obsługą tvOS/Android, zgodnym z obranym szkieletem.

Istnieje też ryzyko produktowo-prawne: publiczna aplikacja odtwarzająca
wyekstrahowane strumienie YouTube wymaga osobnej weryfikacji zasad YouTube i
regulaminów sklepów. Samodzielny/sideloadowany klient do legalnie dostępnych
lokalnych materiałów jest technicznie prostszy, ale nie usuwa potrzeby przeglądu
przed publiczną dystrybucją.

## Kolejne etapy

1. Uruchomić obecny feed na emulatorze Android TV, a następnie sprawdzić focus
   traversal i overscan na fizycznym Apple TV oraz urządzeniu Fire TV.
2. Dodać endpoint media-ticket i natywny player dla pobranego pliku/HLS wraz z
   play/pause, seek, pozycją oglądania i błędami sieci.
3. Dodać wybór napisów, języka audio i podstawowe ustawienia playera zapisane
   lokalnie na urządzeniu.
4. Dodać półki Watchlist/Continue/Live, wyszukiwanie ekranową klawiaturą i
   pełniejsze filtry, korzystając z obecnych endpointów.
5. Testy na fizycznym Apple TV i Fire TV oraz przygotowanie ikon, bannerów,
   prywatności i pipeline'ów podpisywania.

## Uruchomienie i weryfikacja

```sh
cd apps/tv
bun install
bun test src
bun run typecheck
bunx expo prebuild --no-install
bun run tvos       # Xcode / symulator Apple TV
bun run android    # Android Studio / emulator TV
```

Backend i webowe zatwierdzanie parowania uruchamiają się standardowym
`bun run dev` w głównym katalogu. Do urządzenia fizycznego wpisuje się adres
instancji widoczny z jego sieci, nie `localhost` komputera.

Po zmianach w parowaniu lub stronie zatwierdzania uruchamiamy także:

```sh
cd app
bun test src/deviceAuth.test.ts src/deviceAuthRoutes.test.ts src/routesManifest.test.ts
bun run typecheck

cd ../ui
bun test src/i18nCatalog.test.ts src/i18nFormatting.test.ts
bun run typecheck
```

## Źródła

- [`react-native-tvos`: platformy, focus, ograniczenia i rekomendacja Expo](https://github.com/react-native-tvos/react-native-tvos)
- [Expo: budowanie aplikacji TV i oficjalny szablon `with-tv`](https://docs.expo.dev/guides/building-for-tv/)
- [Expo Video: natywna biblioteka wideo dla Android/iOS/tvOS/web](https://docs.expo.dev/versions/latest/sdk/video/)
- [Apple HIG: focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection/)
- [Apple HIG: remotes](https://developer.apple.com/design/human-interface-guidelines/remotes)
- [Apple: `NSAllowsLocalNetworking` i lokalne połączenia ATS](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking)
- [Android TV: focus system](https://developer.android.com/design/ui/tv/guides/styles/focus-system)
- [Android TV quality guidelines](https://developer.android.com/docs/quality-guidelines/tv-app-quality)
- [Android Media3 for TV](https://developer.android.com/media/media3/ui/androidtv)
- [Amazon: start React Native for Fire TV](https://developer.amazon.com/docs/fire-tv/get-started-with-react-native.html)
- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- [YouTube Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality)
- [`react-native-video` repository and v7 platform matrix](https://github.com/TheWidlarzGroup/react-native-video)
