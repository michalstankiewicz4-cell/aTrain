# Pociąg na owalu

Symulacja 3D lokomotywy spalinowej i dwóch wagonów jeżdżących po torze z prawdziwą fizyką: koła z obrzeżami toczą się po profilu szyny, sprzęgi i zderzaki są osobnymi ciałami ze sprężynami i luzem, a wykolejenie, poślizg kół czy zderzenie z odczepionym wagonem wynikają wyłącznie z sił — nic nie jest „przyklejone” do toru. Tor biegnie wokół wysokiej góry, wzdłuż skarpy nad morzem, przez las.

**Uruchom:** https://michalstankiewicz4-cell.github.io/aTrain/

Wersja: zobacz plik [`VERSION`](VERSION) i [`CHANGELOG.md`](CHANGELOG.md).

> **GameLaboratory:** tabor (lokomotywa i wagony z częściami) oraz fizyka koło–szyna z rozjazdami są też w [GameLaboratory](https://michalstankiewicz4-cell.github.io/GameLaboratory/labs/vehicles.html) (repozytorium `michalstankiewicz4-cell/GameLaboratory`, z historią): model jako TrainKit (`js/models/train/`), fizyka jako zachowanie „koło na szynie” (`js/behaviors/rail/`, obliczenia bez zmian), sieć torowa w `js/models/structures/railway/`. Ten projekt zostaje jako samodzielna symulacja.

## Co jest w środku

- **Tabor**: lokomotywa SM31-017 (napęd na obie osie), wagon kryty drewniany i wagon kryty stalowy — modele i tekstury generowane proceduralnie w przeglądarce.
- **Tor**: owal (prosta = 3× długość składu, łuki 180° o promieniu 50 m) plus przedłużenie przez dwa fizyczne rozjazdy; szyny 25 m ze szczelinami i łubkami, fizyczne podkłady, podsypka.
- **Ląd**: wysoka góra w środku owalu, skarpa nad morzem na południu, łagodne wzgórza i las (świerki, sosny, brzozy, dęby, jałowce). Teren jest ten sam w fizyce i w grafice — wykolejony wagon zatrzyma się na zboczu.
- **Sprzęgi**: sprzęg kłowy (Janney) między lokomotywą a wagonem 1 — sprzęga się sam przy najeździe; łańcuch na haku (5 ogniw) między wagonami.
- **Sterowanie**: prędkość zadana, kierunek, moc silnika (poślizg kół przy dużym obciążeniu), hamulec, blokada kół, masy pojazdów, zwrotnice, luz obrzeży, szczelina styków.
- **Pogoda**: chmury, deszcz, mgła, burza z piorunami, wiatr kołyszący drzewami i morzem; przycisk „Zmienne warunki” — pogoda sama się zmienia.
- **Oprawa**: pora dnia z nocą, gwiazdami i księżycem, światła pociągu z cieniami, bloom, dym i iskry; filtry (pixelart, scanlines, CRT), palety, wygląd kamery (filmowy, bodycam) i efekty obiektywu; proceduralne dźwięki przestrzenne. Menu można ukryć (przycisk lub klawisz **H**).

## Dokumentacja

| Plik | Zawartość |
|---|---|
| [docs/sterowanie.md](docs/sterowanie.md) | Wszystkie przyciski, suwaki, kamery i klawisze |
| [docs/fizyka.md](docs/fizyka.md) | Silnik fizyczny: ciała, kontakt koło–szyna, tarcie, napęd, hamulec, zderzaki, sprzęgi, teren |
| [docs/tor.md](docs/tor.md) | Geometria toru, rozjazdy, styki szyn, podkłady |
| [docs/lad.md](docs/lad.md) | Ląd: góra, skarpa, morze, las; skąd pochodzą |
| [docs/pogoda.md](docs/pogoda.md) | Pogoda, zmienne warunki, deszcz, mgła, pioruny |
| [docs/grafika.md](docs/grafika.md) | Modele taboru, tekstury proceduralne, oświetlenie, efekty, filtry i wygląd kamery |
| [docs/dzwieki.md](docs/dzwieki.md) | Proceduralne dźwięki i ich źródła |
| [docs/budowa-pliku.md](docs/budowa-pliku.md) | Pliki projektu i kolejność ich ładowania |
| [docs/wersjonowanie.md](docs/wersjonowanie.md) | Zasady numerowania wersji |

## Technika

Strona statyczna bez kroku budowania: `index.html` i skrypty w `js/`. Grafika: Three.js r147 (z jsDelivr). Fizyka: własny silnik w JavaScripcie liczony na CPU, krok 1/2400 s. Ląd, rośliny i pogoda przeniesione z laboratoriów repozytorium [Battle](https://github.com/michalstankiewicz4-cell/Battle) (LandKit, PlantKit, ForestKit, SkyKit, RainKit, LookPipeline).

---

## English

**aTrain — a free 3D train physics simulator in the browser.** A diesel locomotive and two goods wagons run on a railway line by the sea with real physics: wheel–rail contact with flanges and adjustable flange clearance, a Janney knuckle coupler that couples itself when the cars meet, a chain coupler with slack, sprung buffers and suspension, rail joints with physical gaps (and their click), railway turnouts, wheel slip under heavy load, braking, wheel lock and real derailments. The line runs around a high mountain, along cliffs above the ocean and through a procedural forest, under changing weather — clouds, rain, fog, thunderstorms — from day to a starry night.

Features: realistic train physics · wheel and flange simulation · knuckle and chain couplers · buffers · turnouts and derailments · procedural terrain, sea and trees · dynamic weather and day–night cycle · train lights and shadows · procedural spatial sound · retro filters (pixel art, scanlines, CRT) and camera looks (cinematic, bodycam) · runs in any WebGL browser, no install.
