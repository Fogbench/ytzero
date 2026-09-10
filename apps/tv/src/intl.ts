// Hermes versions differ in their Intl coverage. Load dependencies first and
// register only the application's locales before any pluralized copy renders.
import "@formatjs/intl-getcanonicallocales/polyfill.js";
import "@formatjs/intl-locale/polyfill.js";
import "@formatjs/intl-pluralrules/polyfill-force.js";
import "@formatjs/intl-pluralrules/locale-data/en.js";
import "@formatjs/intl-pluralrules/locale-data/pl.js";
import "@formatjs/intl-pluralrules/locale-data/de.js";
import "@formatjs/intl-pluralrules/locale-data/es.js";
import "@formatjs/intl-pluralrules/locale-data/fr.js";
import "@formatjs/intl-pluralrules/locale-data/hu.js";
import "@formatjs/intl-pluralrules/locale-data/ja.js";
import "@formatjs/intl-pluralrules/locale-data/pt.js";
import "@formatjs/intl-pluralrules/locale-data/ru.js";
