# Progreso

Versión 0.1.0 · reglas 2026-10-23.

## Terminado

- Base jugable de principio a fin en los tres países: país → campaña → elecciones → gobierno u oposición → propuestas → votaciones → consecuencias → guardar y continuar.
- Motor jurídico con reglas fechadas, enmiendas con transitorias, procedimientos por pasos y validación de iniciativa y competencias; atajos ilegales rechazados.
- **El Salvador (completo)**: presidencia por mayoría relativa (reforma 2025), mandato de 6 años y transitoria de 2027, reelección, Asamblea de 60 en 15 circunscripciones (incluida la del exterior, 2026) con D’Hondt, veto y superación con 40 votos, presupuesto, salario mínimo por decreto, reforma por las dos vías del art. 248 y cláusulas pétreas.
- **España (completo)**: Congreso de 350 con D’Hondt, barrera del 3 % y reparto del RD 806/2026, investidura con negociación y plazo de dos meses, censura, confianza, disolución, ley ordinaria/orgánica con veto del Senado, presupuestos con prórroga, reformas por los arts. 167 y 168, competencias autonómicas, BCE y UE.
- **Estados Unidos (simplificado)**: Colegio Electoral con contingente, 435 distritos, Senado por clases, filibusterismo, reconciliación, veto, Artículo V con ratificación estatal, federalismo y Reserva Federal.
- Modelo económico y social mensual coherente (identidad déficit-deuda probada), con demoras, capacidad administrativa, efectos distributivos y externos.
- Interfaz móvil primero: resumen, campaña, gobierno, investidura, congreso, constitución, mapa en rejilla, indicadores, elecciones, noticias, historial, comparación de ramas, guardado, glosario, fuentes, tutorial y panel «¿Por qué pasó esto?».
- Guardado automático y manual, exportación/importación con suma de verificación y validación, ramas.
- 46 pruebas (Vitest) y recorrido en navegador real (29 comprobaciones, Playwright + Chromium).

## Pendiente

- Cotejar con los textos oficiales las reglas marcadas «pendiente de cotejo» (62 de 108; 36 contrastadas y 10 simplificaciones o pendientes declaradas) y actualizar su estado en los módulos de datos; el entorno de desarrollo no permitió descargar BOE, Asamblea ni Congress.gov.
- Estados de emergencia jugables (régimen de excepción, alarma/excepción/sitio, National Emergencies Act).
- Control judicial jugable: recursos de inconstitucionalidad, veto por inconstitucionalidad (art. 138 SV), litigios federales.
- Decretos-leyes y su convalidación (España); juicio político (EE. UU.); antejuicio e interpelaciones (El Salvador).
- Elecciones regionales y municipales; primarias; mapas geográficos reales.
- Senado español con islas y voto limitado completo; Maine y Nebraska por distritos; límite de deuda y cierres del gobierno en EE. UU.
- IA narrativa opcional (sólo texto, sin poder alterar reglas ni cifras).

## Siguiente paso concreto

Cotejar en el BOE los artículos 68, 81, 90, 99.5, 115.3, 134 y 169 de la Constitución Española y el art. 248 de la Constitución salvadoreña (mínimo de 10 diputados) y cambiar su `verification` a `'contrastada'` en `src/data/countries/es.ts` y `sv.ts`; después, ejecutar `npm run docs:reglas` y `npm test`.
