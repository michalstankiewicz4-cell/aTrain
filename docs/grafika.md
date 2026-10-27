# Grafika

Three.js r147. Wszystkie tekstury i modele powstają w przeglądarce — repozytorium nie zawiera obrazków ani plików 3D.

## Tabor

**Lokomotywa SM31-017** — maska z żaluzjami i wentylatorem, wydech z dymem, kabina z oknami, drzwiami i wycieraczkami, poręcze, stopnie, syreny, antena, zbiornik paliwa, zbiorniki powietrza, skrzynia akumulatorów, piasecznice z rurkami, klocki hamulcowe, lampy na wspornikach, napisy.

**Wagon 1 (drewniany)** — deski, żelazne okucia, drzwi przesuwne, wywietrzniki, drabinka, koło hamulca ręcznego, dach kryty papą, wzmocnienia (cięgna) pod podłogą.

**Wagon 2 (stalowy)** — żebrowane ściany i drzwi, klapy wentylacyjne, dach z żebrami, czerwone lampy końcowe.

Wspólne: zestawy kołowe, maźnice ze sprężynami i wspornikami, zderzaki, sprzęg kłowy, hak z łańcuchem, przewody hamulcowe.

## Tekstury proceduralne

Technika z laboratorium Space (ShipKit): jeden układ rysowany na canvasie jednocześnie do mapy koloru, chropowatości i wypukłości. Szum fbm, zabrudzenia, rdza, zacieki. Generatory: blacha stalowa, deski, blacha ryflowana, pasy ostrzegawcze, papa, żaluzje, odlew, szczotkowany metal, drewno podkładów, tłuczeń, trawa, napisy, niebo.

Współrzędne UV liczone w skali świata, żeby faktura miała tę samą wielkość na każdej części.

## Oświetlenie i efekty

- Mapa otoczenia z proceduralnego nieba (odbicia na metalu i szybach).
- Słońce z cieniami podążającymi za kamerą; w nocy księżyc.
- Światła pociągu: z przodu 2 białe i reflektor (stożek światła, cień), z tyłu 2 czerwone.
- Bloom na jasnych źródłach, silniejszy w nocy.
- Dym z wydechu i iskry spod kół (cząsteczki).
- Tonemapping ACES, sRGB.

## Ląd, las i pogoda

Teren, morze i las — [lad.md](lad.md); niebo z chmurami, deszcz i pioruny — [pogoda.md](pogoda.md). Odbicia i światło otoczenia materiałów liczone są z tego samego nieba co widać (odświeżane przy zmianie pogody i pory dnia).

## Filtry i wygląd kamery

Ostatni przebieg renderowania (jeden szader): ekspozycja, mapowanie tonów (ACES / AgX / Hable), temperatura barwowa i odcień, nasycenie, żywość, kontrast, efekty obiektywu z laboratorium wyglądu (LookPipeline: winieta, ziarno, aberracja chromatyczna, dystorsja beczkowa, krople na szkle, brud, odblask słońca, wyostrzenie), a potem pixelart, scanlines, CRT i palety z ditheringiem Bayera. Efekt wyłączony nie kosztuje nic.

## Optymalizacja

Statyczne części łączone w siatki według materiału (mniej wywołań rysowania); szyny z adaptacyjnym podziałem.

## Kontrola modeli

Modele sprawdzane narzędziem Model Doctor z repozytorium Space (`tools/modeldoctor.js`): NaN, odwrócone ściany, nachodzące powierzchnie (z-fighting), elementy w powietrzu, ukryte, za małe i za cienkie.
