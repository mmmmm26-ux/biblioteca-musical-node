# Naciones: Poder y Consecuencias

Juego web educativo (en español, para celular y computadora) sobre elecciones, gobierno y reformas constitucionales con **reglas reales** de **El Salvador**, **Estados Unidos** y **España**, y partidos y personas **ficticios**.

> No representa todas las leyes de ningún país ni predice su futuro. Las simulaciones son escenarios con supuestos explícitos.

## Cómo ejecutarlo

Requisitos: Node.js 18 o superior (probado con Node 22) y npm.

```bash
cd naciones
npm install
npm run dev          # servidor de desarrollo: abra la URL que muestra (p. ej. http://localhost:5173)
```

Versión de producción (archivos estáticos en `dist/`, sin servidor propio ni claves de IA):

```bash
npm run build
npm run preview      # sirve dist/ en http://localhost:4173
```

`dist/` puede publicarse en cualquier alojamiento estático (usa rutas relativas).

### Comprobaciones

```bash
npm run typecheck    # TypeScript estricto
npm test             # 46 pruebas unitarias y de recorrido (Vitest)
npm run build && npm run e2e   # recorrido en navegador real (Chromium, pantalla de celular) con capturas en e2e-capturas/
npm run docs:reglas  # regenera docs/REGLAS.md desde los módulos de datos
```

`npm run e2e` usa `playwright-core` con el Chromium indicado en `CHROME_PATH` (por defecto `/opt/pw-browsers/chromium`).

## Qué se puede hacer

1. Elegir país y dificultad; crear un partido y una candidatura ficticios (o liderar un partido ficticio existente), con posición política, prioridades y compromisos.
2. Hacer campaña: giras por territorios, mensaje, publicidad, debate y apoyos de organizaciones; consultar encuestas con margen de error.
3. Celebrar elecciones con el sistema de cada país y ver cómo se reparten los escaños (tabla D’Hondt incluida).
4. Formar gobierno o pasar a la oposición. En España hay que negociar la investidura.
5. Gobernar por turnos mensuales con calendario interno: presupuesto, impuestos, salario mínimo, regulación ambiental, aranceles (EE. UU.), dentro de las competencias reales.
6. Proponer reformas institucionales de un catálogo verificado; el motor jurídico indica la norma necesaria, quién puede iniciarla, mayorías, etapas, plazos, referéndum y controversias. Los atajos ilegales se rechazan.
7. Ver «¿Por qué pasó esto?» (decisiones, eventos externos, azar, inercia, efectos institucionales), noticias generadas sólo con hechos del motor, historial, mapa, indicadores, glosario y fuentes.
8. Guardar (automático y manual), exportar/importar con validación, crear ramas y compararlas.

## Estructura

```
naciones/
  src/engine/            motor (TypeScript puro, sin interfaz)
    legal/               mayorías, reglas fechadas y enmiendas, procedimientos como máquinas de estados
    electoral/           votantes heterogéneos, fórmulas (D’Hondt, Hare, Huntington-Hill), elecciones
    economy/             modelo macro-fiscal mensual
    actors/              posturas de partidos y legisladores, negociación, apoyo ciudadano
    government/          formación de gobierno parlamentaria (investidura, acuerdos)
    save/                guardado, versionado, validación, ramas
    events.ts news.ts    eventos con semilla; noticias derivadas del registro
    game.ts              orquestación de turnos, acciones del jugador y de la IA
  src/data/countries/    un módulo por país: reglas con fuentes, territorios, partidos, procedimientos, reformas
  src/ui/                interfaz React (móvil primero)
  tests/                 pruebas
  docs/                  REGLAS.md (generado), MODELO.md, PROGRESO.md
```

Para añadir un país: crear `src/data/countries/<id>.ts` que cumpla la interfaz `CountryModule` (`src/engine/country.ts`) y registrarlo en `src/data/countries/index.ts`.

Documentación: [docs/REGLAS.md](docs/REGLAS.md) (reglas, fuentes, fechas y verificación), [docs/MODELO.md](docs/MODELO.md) (supuestos), [docs/PROGRESO.md](docs/PROGRESO.md) (estado y siguientes pasos).
