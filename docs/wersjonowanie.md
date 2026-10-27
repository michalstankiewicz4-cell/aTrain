# Wersjonowanie

Numer wersji ma postać **MAJOR.MINOR.PATCH** (semver) i jest zapisany w trzech miejscach, które zawsze muszą się zgadzać:

- plik `VERSION`,
- `<meta name="version" content="…">` w `index.html`,
- nagłówek najnowszego wpisu w `CHANGELOG.md`.

Każde wydanie dostaje też tag git `vX.Y.Z`.

## Zasady

- **Jedna wysyłka (push) = najwyżej jeden bump.** Kilka commitów w jednym pushu podbija wersję tylko raz.
- **Bump tylko wtedy, gdy zmienia się działanie gry** (`index.html`):
  - **PATCH** — poprawka błędu, strojenie parametrów, drobna zmiana wyglądu.
  - **MINOR** — nowa funkcja (np. nowy przycisk, nowy pojazd, nowy efekt).
  - **MAJOR** — zmiana łamiąca dotychczasowe działanie (np. przebudowa toru lub sterowania).
- **Bez bumpa**: zmiany wyłącznie w dokumentacji, README, CHANGELOG, workflow GitHub.
- Wpis w `CHANGELOG.md` dodawany jest w tym samym pushu co bump.
