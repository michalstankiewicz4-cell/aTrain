# Pliki projektu

Strona statyczna bez kroku budowania. `index.html` ładuje Three.js r147 z jsDelivr, a potem skrypty projektu w tej kolejności (zwykłe skrypty, wspólny zakres globalny):

| Plik | Zawartość |
|---|---|
| `index.html` | Nagłówek (meta SEO, Open Graph, JSON-LD), style, interfejs: kamera, filtry/pogoda/wygląd, dźwięki, panel nastawnika |
| `js/physics.js` | `PHYS` — silnik fizyczny: tor i rozjazdy, ciała, pojazdy, sprzęgi, łańcuch, zderzaki, kontakt koło–szyna, teren, krok symulacji. Działa też w Node (`module.exports`) do testów |
| `js/land.js` | `LAND` — mapa wysokości lądu (góra, skarpa, morze, wzgórza), wspólna dla fizyki i grafiki. Działa też w Node |
| `js/texkit.js` | `TK` — tekstury proceduralne (canvas), `fitUV`, `roundedBox` |
| `js/stock.js` | `initStock(mat)` — materiały i modele taboru: `buildLoco`, `buildWoodVan`, `buildSteelVan` |
| `js/plants.js` | `PLANTS` — drzewa i krzewy z kodu, imitacje (impostory), las |
| `js/world.js` | `initWorld(...)` — siatki terenu, morze, rozmieszczenie lasu |
| `js/weather.js` | `initWeather(...)` — niebo z chmurami, odbicia, deszcz, pioruny, zmienne warunki |
| `js/app.js` | Aplikacja: scena, pora dnia, kamery, potok obrazu (bloom, filtry, wygląd kamery), tor i podkłady, przystanek, pojazdy, sterowanie, dźwięki, efekty, pętla |
| `assets/screenshot.jpg` | Obraz podglądu dla wyszukiwarek i mediów społecznościowych (1200 × 630) |
| `sitemap.xml` | Mapa strony dla wyszukiwarek |

Do testów z konsoli przeglądarki: `window.__train` (symulacja, świat, pogoda, renderer, kamera).
