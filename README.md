# Pociąg na owalu

Symulacja 3D lokomotywy spalinowej i dwóch wagonów jeżdżących po torze z prawdziwą fizyką: koła z obrzeżami toczą się po profilu szyny, sprzęgi i zderzaki są osobnymi ciałami ze sprężynami i luzem, a wykolejenie, poślizg kół czy zderzenie z odczepionym wagonem wynikają wyłącznie z sił — nic nie jest „przyklejone” do toru.

**Uruchom:** https://michalstankiewicz4-cell.github.io/aTrain/

Wersja: zobacz plik [`VERSION`](VERSION) i [`CHANGELOG.md`](CHANGELOG.md).

## Co jest w środku

- **Tabor**: lokomotywa SM31-017 (napęd na obie osie), wagon kryty drewniany i wagon kryty stalowy — modele i tekstury generowane proceduralnie w przeglądarce.
- **Tor**: owal (prosta = 3× długość składu, łuki 180° o promieniu 50 m) plus przedłużenie przez dwa fizyczne rozjazdy; szyny 25 m ze szczelinami i łubkami, fizyczne podkłady, podsypka i miękki grunt.
- **Sprzęgi**: sprzęg kłowy (Janney) między lokomotywą a wagonem 1 — sprzęga się sam przy najeździe; łańcuch na haku (5 ogniw) między wagonami.
- **Sterowanie**: prędkość zadana, kierunek, moc silnika (poślizg kół przy dużym obciążeniu), hamulec, blokada kół, masy pojazdów, zwrotnice, luz obrzeży, szczelina styków.
- **Oprawa**: pora dnia z nocą, gwiazdami i księżycem, światła pociągu z cieniami, bloom, dym i iskry, filtry (pixelart, scanlines, CRT) i palety, proceduralne dźwięki przestrzenne.

## Dokumentacja

| Plik | Zawartość |
|---|---|
| [docs/sterowanie.md](docs/sterowanie.md) | Wszystkie przyciski, suwaki, kamery i klawisze |
| [docs/fizyka.md](docs/fizyka.md) | Silnik fizyczny: ciała, kontakt koło–szyna, tarcie, napęd, hamulec, zderzaki, sprzęgi |
| [docs/tor.md](docs/tor.md) | Geometria toru, rozjazdy, styki szyn, podkłady i teren |
| [docs/grafika.md](docs/grafika.md) | Modele taboru, tekstury proceduralne, oświetlenie, efekty i filtry |
| [docs/dzwieki.md](docs/dzwieki.md) | Proceduralne dźwięki i ich źródła |
| [docs/budowa-pliku.md](docs/budowa-pliku.md) | Jak zorganizowany jest `index.html` |
| [docs/wersjonowanie.md](docs/wersjonowanie.md) | Zasady numerowania wersji |

## Technika

Jeden plik `index.html`, bez kroku budowania. Grafika: Three.js r147 (z jsDelivr). Fizyka: własny silnik w JavaScripcie liczony na CPU, krok 1/2400 s.
