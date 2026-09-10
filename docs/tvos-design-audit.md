# Audyt interfejsu tvOS — 10 września 2026

Zakres: wszystkie komponenty ekranów i modali w `apps/tv`, łącznie ze stanami
ładowania, pustymi wynikami, błędami, nawigacją pilotem i preferencjami dostępności.
To ocena implementacji względem wytycznych mających zastosowanie do tej aplikacji,
nie certyfikat Apple ani deklaracja zgodności ze wszystkimi dokumentami HIG.

## Zasady i poprawki

- Materiały: `TvSurface` rozróżnia panel nawigacyjny od powierzchni treści.
  Kontekst panelu uniemożliwia tworzenie szkła pod jego przyciskami. `TvControlSurface`
  stosuje tam cienkie wypełnienia. Samodzielne przyciski nawigacji mają natywne
  szkło również w spoczynku; wiersze treści korzystają z niego przy focusie. Ustawienia, formularz połączenia i długi opis mają
  zwykłe powierzchnie treści. Miniatury pozostają obrazami.
- Focus: jeden mechanizm powiększania, spokojne rozjaśnienie, bez obrysu opcji listy
  i bez dużych białych prostokątów. Ramka pozostaje dla pól tekstowych, obszaru
  przewijanego tekstu i miniaturek. Wybrany filtr/zakładka ma dodatkowo znacznik;
  zaznaczenie i focus nie są utożsamiane.
- Czytelność: jaśniejsze teksty pomocnicze, elastyczne etykiety przycisków,
  dwuwierszowe tytuły w kolejce. Przyciski i filtry mają co najmniej 66 punktów
  wysokości. Sortowanie może się przewijać, a wysokość menu uwzględnia skalę fontu.
- Modale: spójne przyciemnienie tła, izolacja focusu, jawny przycisk zamknięcia.
  Wstecz w podmenu wraca poziom wyżej; krzyżyk zamyka okno. Ruch panelu nie wyłącza
  materiału ani nie wygasza jego szkła wraz z tekstem.
- Dostępność: nagłówki i stany wyboru są opisane semantycznie. Karty filmów,
  Shortsów i zakładek udostępniają akcję menu dla technologii asystujących.
  `Reduce Motion` oraz `Reduce Transparency` pozostają obsługiwane. Dodano
  odczyt i obserwację `Increase Contrast` z UIKit; wtedy powierzchnie są stabilne
  i nieprzezroczyste, focus mocniejszy, a zdjęcia pod tekstem ciemniejsze.
- Bezpieczeństwo interakcji: zapisywanie ustawienia nie wyłącza kontrolki mającej
  focus; stan busy blokuje kolejne żądanie i jest przekazywany dostępności.
  Odtwarzacz pozostaje natywnym AVKit; audyt wyglądu nie zastępuje mechanizmów
  gestów, mediów ani autoryzacji.

Preferencje dostępności są odczytywane z systemu, nie są nowymi zapisanymi
ustawieniami YT Zero. Most UIKit nie zapisuje ani nie eksportuje tych danych.

## Regresje znalezione w końcowym sprawdzeniu

- Po teście `Increase Contrast` został włączony tryb nieprzezroczysty. Przywrócono
  wcześniejsze ustawienie systemowe: zwiększony kontrast wyłączony, ograniczenie
  przezroczystości wyłączone. Obsługa tych preferencji pozostaje w aplikacji.
- `opacity: 0` na zachowanej liście unieważniało natywny efekt szkła. Granica
  `TvGlassVisibility` usuwa wyłącznie ukryty materiał, a odtwarza go przy powrocie.
  Listy, offset i przyciski pozostają zamontowane. Zamiana załadowanych wyników
  filtrów używa przesunięcia, bez animacji przezroczystości nad szkłem.
- Licznik kolejki powodował błąd renderowania na Hermes bez `Intl.PluralRules`.
  Polyfill FormatJS z zależnościami oraz danymi dziewięciu języków ładuje się przed
  formatowaniem. Wynik ma formy `1 film`, `2 filmy`, `12 filmów` i odstęp od tytułu.
- Ekran przygotowania filmu ma kolejność Wstecz → Szczegóły. Focus jest nadawany
  Szczegółom dopiero w natywnym środowisku modalu; błąd z możliwością ponowienia
  kieruje focus na Ponów.
- Wstecz korzysta ze wspólnej geometrii górnego rzędu. Usunięto go z Ustawień
  i zduplikowaną strzałkę w formularzu adresu. Kolejka/profil oraz karuzela mają
  własne wspólne szklane kapsuły. Wybór profilu jest pełnoekranowy, z tłem w kolorze
  awatara, obwódką focusu i niezależnym znacznikiem bieżącego profilu.

## Pokrycie ekranów

| Powierzchnia | Ocena kodu i zastosowane zasady | Kontrola w symulatorze w tej iteracji |
| --- | --- | --- |
| Feed / hero / kontynuacja / kanały | Treść bez szkła, kontrolki wspólne, odrębne zaznaczenie i focus | Sprawdzono główny feed i szczegóły |
| Live, zaplanowane, pobrane, Shorts, rekomendacje, historia, polubione, odrzucone | Wspólny `FeedScreen`, `VideoCard`/`TvShortCard`, filtry i puste stany | Sprawdzono w symulatorze |
| Zakładki | Ciemne wypełnienie wiersza, akcja dostępności, powrót focusu | Sprawdzono w symulatorze |
| Obserwowane playlisty / filmy playlisty | Powierzchnie treści, zapisane sortowanie i zachowane miejsce na liście | Sprawdzono w symulatorze |
| Kanał / zakładki kanału | Wspólne kontrolki, znacznik aktywnej zakładki, aktualizacja treści | Sprawdzono w symulatorze |
| Szczegóły filmu | Obraz w tle, gradacja tekstu, wspólne przyciski, alternatywa dla przytrzymania | Sprawdzono |
| Akcje filmu / planowanie / dodawanie do playlisty | Jeden panel szkła, wewnętrzne wypełnienia, stabilne nagłówki i zamykanie | Sprawdzono trzy podwidoki; ponowne otwarcie przyciskiem Więcej działa |
| Kolejka: pusta i z filmami | Jeden panel, wspólne kontrolki i przestawianie focusu po usunięciu | Sprawdzono w symulatorze |
| Pełny opis / pełny komentarz | Nieprzezroczysta powierzchnia czytania, przewijanie pilotem, zamknięcie | Opis sprawdzony; komentarz współdzieli komponent |
| Menu profilu / wybór profilu / PIN | Menu na szkle, pełnoekranowy wybór i PIN, niezależny stan profilu | Menu i wybór sprawdzone; PIN oceniony w kodzie |
| Ustawienia i powiązanie profilu systemowego | Zwykłe sekcje treści, kontrolki nie tracą focusu przy zapisie | Sprawdzono w symulatorze |
| Wyszukiwanie instancji / adres / parowanie | Zwykła powierzchnia formularza, systemowa klawiatura, QR i kod tekstowy | Sprawdzono w symulatorze |
| Start / odtwarzanie / błędy połączenia i odtwarzania | Konsekwentne loading/error, AVKit, redukcja ruchu | Start, przygotowanie filmu, AVKit i powrót sprawdzone; błędy ocenione w kodzie |

## Weryfikacja i ograniczenia

- `bun test src` w `apps/tv`: 109 testów, 0 błędów, 877 asercji.
- `bun run typecheck` w `apps/tv`: bez błędów.
- Katalog i formatowanie lokalizacji UI: 8 testów, 0 błędów, 33060 asercji.
- Formatowanie kolejki sprawdzono również w osobnym procesie bez natywnych
  `Intl.PluralRules`, `Intl.Locale` i `Intl.getCanonicalLocales` oraz w kolejce tvOS.
- Podpisany build Debug tvOS z mostem zwiększonego kontrastu: `BUILD SUCCEEDED`.
- Testy ręczne: tvOS 26.5 / Apple TV 4K (3rd generation). Ponowne otwieranie
  menu profilu i kolejki przez Select/krzyżyk/Back, powrót ze szczegółów i AVKit
  z zachowaniem szkła, wspólny rząd nagłówka kanału i playlisty, sortowanie oraz
  bezpieczny powrót z ekranu parowania do istniejącej sesji.
- Nie wykonano tej iteracji na fizycznym Siri Remote, z VoiceOver ani w emulatorze
  Android TV. Nie wymuszano wygaśnięcia zapisanej sesji ani zmiany profilu chronionego
  PIN-em. Te ścieżki oceniono w kodzie; to nie deklaracja gotowości wydania.

## Źródła

- [FormatJS: Intl.PluralRules i zależności dla React Native](https://formatjs.github.io/docs/polyfills/intl-pluralrules/)
- [Expo: problem szkła przy zmianie opacity rodzica](https://github.com/expo/expo/issues/41024)
- [Apple: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Meet Liquid Glass — szczególnie warstwowanie, 13:13](https://developer.apple.com/videos/play/wwdc2025/219/?time=793)
- [Apple: Designing for tvOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-tvos/)
- [Apple: Focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection/)
- [Apple: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple: Modality](https://developer.apple.com/design/human-interface-guidelines/modality)
- [Apple: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Apple: Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus)

## Wcześniejsze prace — zapis historyczny

Poniższa część opisuje wcześniejsze iteracje; bieżące decyzje o materiałach,
kolorze focusu i zachowaniu szkła podczas animacji znajdują się powyżej.

### tvOS: wygląd, ruch i odtwarzanie

Kierunek: aplikacja Apple TV na tvOS i przekazane referencje. Treść zajmuje
ekran, nawigacja unosi się nad nią. Szkło służy kontrolkom i panelom; miniatury
oraz tekst pozostają czytelne bez dodatkowych dekoracji.

## Analiza i zmiany

| Problem | Zmiana |
| --- | --- |
| Ekran startowy przypominał równomierną siatkę narzędziową | Karuzela dostępnych zaplanowanych filmów, potem Kontynuuj oglądanie i reszta feeda; bez powielania filmów |
| Sidebar miał ciężkie, płaskie tło | Odsunięty od krawędzi panel z natywnym Liquid Glass i białą kapsułą fokusu |
| Sidebar pomijał branding instancji | Nazwa i kolor znaku z istniejących ustawień `app_name` oraz `app_icon_color` |
| Zaplanowane filmy były widoczne pojedynczo | Pasek małych, pełnych miniaturek nad Kontynuuj oglądanie; fokus przełącza duży podgląd |
| Tło konkurowało z kartami | Rozmycie narastające w dolnej części obrazu, z zachowaniem ostrej góry |
| Szczegóły powielały miniaturę i wiele równorzędnych akcji | Obraz w tle, duży tytuł po lewej, Odtwórz/Wznów, Od początku i jedno menu Więcej |
| Opis pojawiał się dwukrotnie | Jeden skrót przy tytule; Więcej otwiera pełny opis przewijany pilotem |
| Jasne przyciski spoczynkowe zlewały się z focusem | Przyciemnione szkło w spoczynku, jasna kapsuła dopiero dla aktywnego elementu |
| Powrót ze szczegółów gubił miejsce na liście | Zachowanie widoku listy i zwrot fokusu do konkretnej karty |
| Ekran pod modalem nadal reagował na strzałki | Wstrzymanie przekierowań fokusu na czas modalu i AVKit |
| Pilot pomijał poziome rzędy filmów | Usunięta przezroczysta nakładka, która zasłaniała karty dla silnika fokusu UIKit; cienie pozostały tylko przy krawędziach |
| Profil, kolejka, tagi i kanały wymagały nielogicznych skoków | Pełne środowiska fokusu dla górnego paska i kolejnych rzędów; kanały przed pozostałą siatką filmów |
| Menu oferowało niepasujące operacje | Odświeżenie stanu filmu przed pokazaniem akcji; przywracanie tylko odrzuconych, nieobejrzanych filmów; brak pobierania i kolejkowania niedostępnych źródeł |
| Powrót zajmował miejsce tekstowym przyciskiem | Wspólny przycisk ze strzałką w lewo i przetłumaczoną etykietą dostępności |
| Brak kolejki i kontynuacji zgodnej z webem | Kolejka sesji z usuwaniem i zmianą kolejności; natywne menu, następny/poprzedni film, wspólny resolver API |
| Nagłówki i gęstość podstron były niespójne | Usunięte redundantne tytuły, cztery kolumny filmów, większe napisy i wspólne odstępy |
| Formularz instancji odstawał od reszty | Wspólny układ konfiguracji i parowania; wybór wykrytej instancji albo osobny formularz ręczny |
| Przyciski, karty i zakładki powiększały się inaczej | Wspólna sprężyna, niewielkie powiększenie, osobny stan naciśnięcia |
| Animacja własna nakładała się na powiększenie tvOS | Jeden mechanizm skali; zachowany delikatny natywny paralaks miniaturek |
| Przejścia mogły wygaszać szkło razem z rodzicem | Wejście z przesunięciem i wygaszeniem; szkło zastępowane czytelnym materiałem na czas animacji rodzica |
| Brak natywnego odtwarzania | Osobna granica `TvNativePlayer` oparta o AVPlayer przez `expo-video` |
| Wpisywanie adresu serwera pilotem | Bonjour wykrywa instancje w LAN; wybór otwiera istniejące parowanie QR/kodem |

`TvPressable`, `TvButton`, `TvGlassSurface`, `TvBackdrop` i wspólne parametry
ruchu są elementami wielokrotnego użytku. Szkło ma nieprzezroczysty wariant
zastępczy na starszych systemach i przy ograniczeniu przezroczystości. Ograniczenie
ruchu wyłącza skalowanie, obrót wskaźnika ładowania, przejścia i automatyczną
rotację karuzeli. Obrazy karuzeli przenikają się przez 650 ms, dopiero po
załadowaniu nowej grafiki. Slajdy zmieniają się co 8 sekund; rotacja zatrzymuje
się na przyciskach i miniaturkach, po przewinięciu hero poza widok, w sidebarze,
modalach i po opuszczeniu strony lub aplikacji. Licznik ma własne ciemne tło.
Komentarze korzystają z tego samego czytnika pełnego tekstu co opis filmu.

Dolne rozmycie nakłada drugą kopię tej samej grafiki przez `CAGradientLayer`.
Maska jest na własnym widoku UIKit wewnątrz `TvGradientMask`, ponieważ Fabric
nadpisuje maskę głównego widoku przy aktualizacji obramowań. Efekt nie rozmywa
kontrolek ani górnej części zdjęcia; ograniczenie przezroczystości go wyłącza.

Na tvOS z Fabric zarówno feed, jak i Watch Page wymagają jawnego rozmiaru
`FlatList`: samo `flex: 1` potrafiło zwinąć listę po załadowaniu danych. To
poprawka działania układu, nie dodatkowy wariant stylistyczny.
Sekcje kolejki i komentarzy mają wspólne środowiska fokusu, dzięki czemu można
do nich przejść z różnych kolumn poprzedzającego rzędu.
Filtrowanie kotwiczy listę przy wybranym tagu, nawet gdy usuwa karuzelę lub
rząd kanałów powyżej. Powrót ze szczegółów zachowuje konkretny przycisk lub
miniaturkę karuzeli, a wejście listy powtarza się bez jej ponownego montowania.

Korzeń aplikacji, wybór profilu, panel kolejki i czytnik opisu korzystają
z `TvFocusScope`. Natywny modal nie
zawiera korzenia React, którego wymaga `requestTVFocus` w używanej wersji
React Native. Lokalny widok Expo udostępnia UIKit wspólne środowisko starego
i nowego elementu oraz `preferredFocusEnvironments`. Po zmianie kolejności
fokus podąża za filmem, po usunięciu wybiera sąsiedni, a po wyczyszczeniu kolejki
przechodzi na Wróć. Stan nie jest przechowywany poza prezentowanym panelem.

## Odtwarzanie

Przycisk uruchamia pełnoekranowy systemowy odtwarzacz. AVKit zarządza pilotem,
Play/Pause, osią czasu, audio, napisami dostępnymi w źródle i zamykaniem kontrolek.
Po wyjściu fokus wraca do przycisku odtwarzania. Błąd udostępnia ponowną próbę
oraz powrót, bez usuwania wcześniejszej pozycji oglądania.

Serwer wybiera pobrany plik/Tubearchivist, dostępny HLS albo istniejący proxy
progresywnego VOD. Każdy URL używa piętnastominutowego uprawnienia do jednego
filmu, profilu i transportu. Odtwarzacz odnawia je podczas sesji; manifesty HLS
przekazują je także segmentom. Długotrwały Bearer pozostaje w nagłówkach API.
Żądania mediów ponownie sprawdzają sesję i ograniczenia profilu.

Postęp zapisuje się w tle, przy pauzie i wyjściu. Zapisy są uporządkowane;
wolne żądanie nie nadpisuje końcowej pozycji. Koniec filmu używa istniejącej
akcji oznaczenia jako obejrzany. Incognito pomija zapisy postępu i historii;
profile dziecięce zachowują kontrolę ograniczeń. Nie powstaje nowy format backupu.

Mały lokalny moduł `ytzero-player-control` przekazuje programowe play/pause/seek
na główny wątek Apple. Chroni to kontrolki AVKit przed zaobserwowanym na tvOS 26.5
błędem Auto Layout przy wyjściu z odtwarzania, gdy synchroniczna metoda biblioteki
wykonuje się na wątku JavaScript. Nadal używany jest ten sam obiekt `expo-video`.
Ten sam moduł zamyka pełnoekranowy kontroler przez publiczne API UIKit i czeka
na zakończenie animacji przed uruchomieniem kolejnego filmu. Wersja `expo-video`
używana w projekcie próbowała zamykać tvOS selektorem przeznaczonym dla iOS,
przez co po końcu filmu pozostawała ostatnia klatka.

Kolejka sesji ma pierwszeństwo nad feedem. Można ją otworzyć w górnym pasku,
w szczegółach i w systemowym pasku odtwarzacza. Lista ma limit 100 unikalnych
filmów, akcje przesuwania w górę/dół, usuwania oraz czyszczenia. AVKit otrzymuje
systemowe `UIAction` i `UIMenu`; obsługa pozostaje częścią natywnego odtwarzacza.
Po końcu filmu jawna kolejka przechodzi dalej. Bez niej kontynuacja korzysta
z `/playback/adjacent`, kontekstu źródłowej listy i preferencji profilu z weba.
W trybie potwierdzania szczegóły udostępniają akcję następnego filmu.
Kolejka jest wyłącznie w pamięci i czyści się po zmianie profilu lub połączenia.

## Weryfikacja i granice

- Build developerski z Expo Video i Expo Glass Effect kompiluje się na tvOS 26.5.
- Na symulatorze Apple TV 4K sprawdzono wygląd strony głównej, rozwijanie
  sidebara, przejście do szczegółów i nawigację fokusem.
- Sprawdzono przejście w obu kierunkach przez pasek miniaturek, Kontynuuj
  oglądanie, kanały, tagi i pierwsze rzędy feeda; także wejście z hero i lewej
  karty kontynuacji do górnego paska. Zmiana tagu z wynikami oraz pustym wynikiem
  zachowuje dostęp do filtra po zmianie wysokości nagłówka.
- Fokus miniaturek zmienia hero; rotacja działa poza przyciskami i zatrzymuje
  się na Odtwórz. Sprawdzono ostrą górę grafiki, dolne rozmycie oraz materiały
  przycisków szczegółów po zakończeniu animacji. Sidebar pokazuje nazwę instancji.
- Menu porównano dla zaplanowanego filmu i obejrzanego filmu z archiwum;
  niedostępne źródła, anulowanie aktywnego pobierania i usuwanie z kolejki
  filmu, który stracił dostępność, obejmują testy logiki akcji.
- Bonjour wykrył uruchomioną instancję; wybór pilotem otworzył ekran QR i kodu
  parowania. Anulowanie zachowało dotychczasową sesję. Szczegóły konfiguracji
  znajdują się w [opisie wykrywania w LAN](local-network-discovery.md).
- Na symulatorze odtworzono pobrany film przez AVPlayer, sprawdzono pauzę,
  przesunięcie pozycji i powrót Menu do przycisku odtwarzania. Zapis pozycji
  potwierdzono w istniejącym stanie profilu.
- Sprawdzono otwarcie natywnego menu kolejki, wybór innego filmu i przycisk
  poprzedniego filmu. Nowy obraz i wpis historii potwierdziły zmianę źródła.
  Po przewinięciu pierwszego filmu do końcówki AVKit odtworzył go do końca
  i automatycznie uruchomił drugi film z kolejki.
- Formularz ręczny korzysta z klawiatury tvOS; Menu kolejno zamyka klawiaturę
  i formularz. Zamknięcie panelu kolejki zwraca fokus do jego przycisku.
- Sprawdzono przesuwanie filmu w obie strony, usuwanie i czyszczenie kolejki
  wraz z docelowym focusem. Pełny opis otwiera się z aktywnym Wróć; przejście
  w dół zaznacza obszar tekstu i pozwala przewijać go pilotem. Menu wraca do
  skrótu opisu. Przejście z prawej karty polecanych do komentarzy i z powrotem
  również zostało sprawdzone.
- Testy obejmują zakresy bajtów przez rzeczywisty HTTP serwera Bun, autoryzację mediów, wygasanie/odnawianie,
  zmianę profilu, wylogowanie, ograniczenia dziecięce i przepisywanie HLS.
- Testy klienta obejmują wznowienie, kolejność zapisów, incognito i odrzucanie
  niepoprawnych źródeł. Backup sprawdza pozycję oglądania oraz wykluczenie ticketów.
- Aktywne live i osobne napisy YouTube wymagają kolejnych adapterów źródeł.
- Pierwsze odtworzenie niezgodnego pliku może wymagać przygotowania H.264/AAC.
  API zwraca wtedy 202, klient czeka z możliwością powrotu, a AVPlayer dostaje
  URL dopiero po przygotowaniu. Oryginał pozostaje zachowany w bibliotece.
- Tickety i obecne zadania HLS żyją w pamięci procesu. W klastrze żądania jednej
  sesji odtwarzania muszą trafiać do tego samego workera.
- Fizyczny Siri Remote, starszy tvOS oraz pozostałe platformy wymagają testów
  przed wydaniem produkcyjnym.

Źródła implementacji: [Expo Video](https://docs.expo.dev/versions/latest/sdk/video/),
[Expo Glass Effect](https://docs.expo.dev/versions/latest/sdk/glass-effect/),
[Apple UIGlassEffect](https://developer.apple.com/documentation/uikit/uiglasseffect),
[Apple UIFocusEnvironment](https://developer.apple.com/documentation/uikit/uifocusenvironment).
