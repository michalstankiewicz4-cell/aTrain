# Zasady pracy w tym repozytorium

- Odpowiadaj po polsku.
- Nigdy nie dodawaj własnych pomysłów — tylko je proponuj; implementuj to, o co poproszono.
- Fizyka musi pozostać prawdziwa: żadnego „oszukiwania” (przyklejania do toru, warunków logicznych zamiast sił).

## Wersjonowanie (pilnować przy każdym pushu)

Szczegóły: [docs/wersjonowanie.md](docs/wersjonowanie.md).

- Jeden push = najwyżej jeden bump wersji, i tylko gdy zmienia się działanie `index.html` (PATCH poprawka, MINOR nowa funkcja, MAJOR zmiana łamiąca).
- Zmiany tylko w dokumentacji/README/CHANGELOG/workflow — bez bumpa.
- Przy bumpie zaktualizuj razem: `VERSION`, `<meta name="version">` w `index.html`, nowy wpis w `CHANGELOG.md`, tag `vX.Y.Z`.
- Gdy zmiana dotyczy działania opisanego w `docs/`, zaktualizuj odpowiedni plik dokumentacji w tym samym pushu.
