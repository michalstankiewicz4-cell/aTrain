# Pogoda

Niebo z chmurami, deszcz i pioruny przeniesione z laboratorium wyglądu (repo Battle: SkyKit, RainKit) do `js/weather.js`. Pora dnia, słońce, księżyc i gwiazdy pozostają z symulatora; pogoda je modyfikuje.

## Pogody

| Pogoda | Chmury | Wiatr | Deszcz | Widoczność | Pioruny |
|---|---|---|---|---|---|
| Bezchmurnie | 8% | 4 m/s | — | 25 km | — |
| Pogodnie | 35% | 6 m/s | — | 20 km | — |
| Zachmurzenie | 60% | 9 m/s | — | 15 km | — |
| Pochmurno | 86% | 11 m/s | — | 10 km | — |
| Deszcz | 94% | 10 m/s | 55% | 4 km | — |
| Mgła | 75% | 3 m/s | — | 0,4 km | — |
| Burza | 97% | 18 m/s | 90% | 2,5 km | tak |

Wybór pogody przechodzi do niej płynnie w kilka sekund.

## Zmienne warunki

Przycisk **Zmienne warunki** włącza samoczynne zmiany: co 70–150 s pogoda przechodzi (przez 35–60 s) do sąsiedniego stanu — np. pogodnie → zachmurzenie → pochmurno → deszcz → burza i z powrotem; czasem mgła. Wybranie pogody z listy wyłącza zmienne warunki.

## Co zmienia pogoda

- **Niebo**: warstwa chmur płynąca z wiatrem, zasłony deszczu na horyzoncie, mgiełka; z tego samego nieba liczone są odbicia i światło otoczenia materiałów.
- **Światło**: chmury i deszcz przyciemniają słońce (i cienie), rozjaśniają światło rozproszone.
- **Widoczność**: mgła sceny skraca się do widoczności (od 220 m do 2,6 km).
- **Deszcz**: krople wokół kamery, skośne przy wietrze, w szkwałach (przychodzi i odchodzi); krople na obiektywie.
- **Wiatr**: kołysanie drzew i wysokość fal.
- **Pioruny**: kanał błyskawicy z odgałęzieniami, rozbłysk chmur i sceny; grzmot po czasie odległość ÷ 343 m/s (checkbox „Grzmoty” w dźwiękach).
- W nocy chmury zasłaniają gwiazdy i księżyc.
