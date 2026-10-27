# Budowa `index.html`

Całość to jeden plik HTML bez kroku budowania. Kolejność w pliku:

1. **`<head>`** — tytuł, `<meta name="version">`, czcionki, style CSS interfejsu.
2. **Interfejs** — kamera (lewo), filtry i pora dnia (góra), dźwięki (prawo), panel nastawnika (dół), komunikat o awarii symulacji.
3. **Skrypty Three.js** z jsDelivr: biblioteka, OrbitControls i przebiegi post-processingu (EffectComposer, RenderPass, ShaderPass, UnrealBloomPass).
4. **Fizyka — obiekt `PHYS`**: stałe, geometria toru i rozjazdów, ciała, pojazdy, sprzęgi, łańcuch, zderzaki, kontakt koło–szyna, teren, krok symulacji.
5. **Scena** — renderer, kamery, pora dnia, niebo, gwiazdy, księżyc, post-processing.
6. **Zestaw tekstur `TK`** — generatory canvas.
7. **Tabor** — materiały i funkcje `buildLoco`, `buildWoodVan`, `buildSteelVan`.
8. **Teren i tor** — szyny, łubki, podkłady, podsypka, rozjazdy, przystanek.
9. **Obsługa interfejsu** — przyciski, suwaki, kamery, klawisze WSAD.
10. **Dźwięki** — Web Audio.
11. **Efekty** — mapa otoczenia, dym, iskry, poświaty, stożek reflektora.
12. **Pętla** — `frame()` zawsze najpierw planuje kolejną klatkę, potem w `try` liczy fizykę, efekty, dźwięki i rysuje.
