# Ląd

Teren powstaje przy starcie strony z kodu (`js/land.js`) i jest **jedną mapą wysokości dla fizyki i grafiki**: to, co widać, jest tym, w co uderza wykolejony pojazd.

## Mapa

- 1600 × 1600 m, węzły co 2 m (801 × 801), poziom odniesienia: główka szyny = 0 m.
- Pod torem formacja na −0,45 m (jak dotąd); od 2,6 do 14 m od osi toru teren łagodnie przechodzi w naturalny.
- Szum gradientowy okresowy i fbm oraz erozja kroplowa — przeniesione z laboratorium lądu (repo Battle, LandKit).

## Elementy

| Element | Opis |
|---|---|
| Góra | W środku owalu, podstawa w kształcie stadionu, stopa 14 m od osi toru; szczyt ok. 70 m. Grzbiet z ostrymi graniami (szum „ridged”), żleby z erozji kroplowej. |
| Skarpa | Na południe od toru (ok. 35–40 m od prostej), ok. 14 m nad morzem, pod nią wąska kamienista plaża. Dalej na wschód i zachód brzeg obniża się do plaż. |
| Morze | Poziom −15 m. Płycizna prześwituje, przy brzegu piana; fale w szaderze, wyższe przy silnym wietrze. |
| Wzgórza | Przy torze prawie płasko (±0,5 m), dalej łagodne wzgórza do kilkunastu metrów. Bez jezior i rzek. |
| Las | Ok. 10 tys. drzew: świerki i sosny na górze (do granicy lasu), lasy i zagajniki na równinie, brzozy, dęby i jałowce na skrajach. Nie rosną w pasie 12 m od toru, na krawędzi skarpy, na urwiskach ani przy przystanku. |

## Rośliny

Drzewa rosną z kodu według gatunku (laboratorium roślin, PlantKit): pień, gałęzie, karty liści z teksturami rysowanymi na canvasie, kołysanie na wietrze w szaderze. Blisko kamery (do 80 m) są pełne modele z cieniami, dalej imitacje (impostory): jeden czworokąt na drzewo, oświetlony z właściwej strony (ForestKit).

## Barwy terenu

Szader terenu jak w LandKit: piasek, mokry piasek, trawa, zarośla, skała, dno morza — zależnie od wysokości nad morzem i nachylenia; z bliska detal z proceduralnej tekstury trawy.

## Fizyka

Poza torem fizyka pyta mapę o wysokość gruntu (`sim.groundH`), więc wykolejone koła i pudła opierają się o zbocza, skarpę i dno morza. Grunt poza podsypką jest miękki i stawia opór toczenia.
