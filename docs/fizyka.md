# Fizyka

Cała fizyka to własny silnik w JavaScripcie (obiekt `PHYS` w `index.html`), liczony na CPU. Nic nie jest prowadzone po szynach „na sztywno” — pojazdy utrzymują się na torze wyłącznie dzięki kontaktowi kół z szynami.

## Całkowanie

- Ciała sztywne (masa, tensor bezwładności, kwaterniony), półjawny Euler.
- Krok **H = 1/2400 s**; w każdej klatce wykonuje się tyle kroków, ile wynika z czasu rzeczywistego.
- Siły kontaktowe metodą kary (sprężyna + tłumik), tarcie Coulomba rozwiązywane impulsowo (6 iteracji na krok).

## Pojazdy

| | Lokomotywa | Wagon |
|---|---|---|
| Długość pudła | 9,0 m | 9,4 m |
| Rozstaw osi | 4,6 m | 5,6 m |
| Promień koła | 0,50 m | 0,46 m |
| Masa domyślna | 18 t | 12 t |
| Napęd | obie osie | — |

- Każdy zestaw kołowy to osobne ciało (1200 kg) połączone z pudłem przez usprężynowanie pionowe, poprzeczne i wzdłużne z tłumieniem, z odbojami (ugięcie 80 mm, odbicie 100 mm).
- Rozstaw wewnętrzny kół 1360 mm, szerokość toru 1435 mm.

## Kontakt koło–szyna

- Profil koła opisany 37 próbkami (z obrzeżem); szyna jako funkcja odległości (SDF) na odcinkach prostych i łukowych.
- Kontakt liczony dla każdej próbki osobno: sztywność 5·10⁹ N/m na metr szerokości, tłumienie 1,5·10⁷.
- Współczynnik tarcia stal–stal μ = 0,33. Poślizg kół i przytarcie obrzeży powstają same z sił.
- Siatka przestrzenna (komórka 2 m) wybiera kandydujące odcinki szyn; zwykła szyna ma szybką ścieżkę obliczeń.
- **Luz obrzeży** zmienia położenie profilu koła względem szyny dla wszystkich kół naraz.

## Napęd i hamulec

- Silnik: stała siła do 4 m/s, powyżej stała moc (z obrotów kół). Regulator PI dąży do prędkości zadanej.
- Moment zanika między 100 a 115 km/h prędkości obwodowej koła (ogranicznik obrotów) — chroni przed rozbieganiem się kół po wykolejeniu.
- Hamulec: ciśnienie narasta ze stałą czasową 3 s, opada 4 s; maks. 3500 N·m na zestaw.
- Blokada kół: bardzo duży moment hamujący — koła stoją, skład sunie po szynach na tarciu.

## Zderzaki i zderzenia pudeł

- Zderzaki talerzowe na wszystkich czołach; para styka się z każdą parą z innego pojazdu (także z odczepionymi wagonami).
- Skok 2 × 105 mm, sztywność 7,5·10⁵ N/m, tłumienie 3·10⁴; po wyczerpaniu skoku twardy ogranicznik. Tarcie talerzy μ = 0,15.
- Gdy zderzaki się miną (najazd skośny, wykolejenie), działa kolizja prostopadłościanów pudeł.
- Narożniki pudeł opierają się o grunt (μ = 0,5) przy przewróceniu.

## Sprzęg kłowy (lokomotywa – wagon 1)

- Dwie głowice po 150 kg na przekładni ciągłowo-zderzakowej, luz sprzęgu 20 mm.
- Kieł (knuckle) ma własny stopień swobody obrotu: otwarty do 1,6 rad, z ryglem i tarciem.
- Przy najeździe czoło drugiej głowicy naciska na ogon kła i domyka go — sprzęgnięcie wynika z kontaktu, nie z warunku logicznego.
- Przycisk „rozprzęgnij” podnosi dźwignię (zwalnia rygiel); pod naciągiem rygiel trzyma tarcie.

## Łańcuch na haku (wagon 1 – wagon 2)

- 5 ogniw jako osobne ciała (3 kg), kontakt ogniwo–ogniwo i ogniwo–hak, 10 podkroków na krok.
- „Zdejmij z haka” / „Załóż” — siła „ręki” podnosi ostatnie ogniwo nad dziób haka lub je opuszcza.

## Teren

- Podkłady to fizyczne prostopadłościany — po wykolejeniu koła uderzają w nie.
- Podsypka jako pole wysokości, poza nią ląd z mapy wysokości (`LAND`, ta sama co w grafice): miękki grunt z oporem toczenia, zbocza góry, skarpa, dno morza. Wykolejone koła i narożniki pudeł opierają się o rzeczywistą wysokość gruntu w danym miejscu.

## Bezpieczniki

- Jeśli pojawi się wartość nieskończona (NaN), symulacja zatrzymuje się i wyświetla komunikat; pętla rysowania działa dalej, więc przycisk Restart zawsze odpowiada.
