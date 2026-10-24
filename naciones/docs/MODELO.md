# Modelo de simulación y supuestos

Todo lo de este documento pertenece a la **capa C (simulación)**. Las reglas jurídicas (capa A) están en `docs/REGLAS.md`; los datos observados de partida (capa B) figuran en cada módulo de país con su fuente.

El objetivo es un modelo **simple, consistente y explicable**, no un pronóstico. Los parámetros son valores de juego razonables, no estimaciones científicas.

## 1. Separación de motores

- **Motor jurídico** (`engine/legal`): decide si una acción es admisible (iniciativa, competencia, cláusulas pétreas, duplicados, reglas pendientes) y qué procedimiento sigue. Los procedimientos son grafos de pasos (`votacion`, `veto-camara`, `sancion`, `espera`, `solicitud-referendum`, `referendum`, `ratificacion-territorial`, `disolucion-elecciones`, `nueva-legislatura`, `publicacion`, `vigencia`). Ninguna norma cambia sin recorrerlos.
- **Reglas fechadas**: cada partida guarda una copia de las reglas (`rules`) y la versión (`rulesetVersion`). Las reformas aprobadas se guardan como `amendments` con fecha de efecto; el valor vigente en una fecha se calcula con `ruleAt`. Las actualizaciones del juego no modifican partidas existentes.
- **Transitorias modeladas**: `inmediata`, `siguiente-eleccion` (rige para la próxima elección de ese cargo) o `siguiente-mandato` (rige para el mandato que empieza tras la próxima elección).
- **Publicación ≠ vigencia**: los pasos de publicación y entrada en vigor son distintos (p. ej. 8 días en El Salvador, 20 en España por el Código Civil, inmediata en EE. UU.).

## 2. Electores y elecciones

- Siete segmentos (jóvenes urbanos, asalariados, clase media profesional, pequeños empresarios, población rural, jubilados, trabajo precario) con posición media en dos ejes (económico y social), **dispersión amplia** (σ ≈ 0,45) y prioridades temáticas. Cada segmento se representa con 25 votantes tipo (cuadratura gaussiana 5×5): un grupo no es un bloque.
- **Neutralidad**: las posiciones se miden respecto al centro del electorado de cada país (media ponderada por población), para que ninguna orientación parta con ventaja por cómo se definieron los segmentos.
- Composición por territorio según su urbanización; las zonas rurales son algo más tradicionales en el eje social. En EE. UU. hay además una inclinación territorial aproximada (parámetro inspirado en patrones históricos, no un dato oficial).
- Utilidad de votar a un partido: −2,2·distancia² + 1,2·popularidad + 0,8·(implantación − 0,5) + 1,2·coincidencia de prioridades (+60 % en temas de campaña) + identidad territorial (partidos territoriales) + movilización + ruido del día de la elección (σ 0,1). Elección por logit multinomial.
- **Voto útil**: en sistemas mayoritarios los partidos con menos de 15 % de voto esperado pierden apoyo.
- **Voto retrospectivo**: el partido del Ejecutivo gana o pierde popularidad según la aprobación ((aprobación − 50)/50 · 0,6).
- Participación por segmento (propensión base × factor del país, + movilización).
- Sistemas: D’Hondt por circunscripción con barrera (España), D’Hondt/Hare (El Salvador, según la regla vigente), presidencia por mayoría relativa o con segunda vuelta, Colegio Electoral con elección contingente, 435 distritos uninominales (geografía simulada fija por semilla), Senado de EE. UU. por clases, Senado español simplificado (3+1 por provincia y autonómicos por voto nacional).
- **Encuestas**: estimación del modelo + error muestral (n = 1000) + efecto de encuestadora; se muestra el margen al 95 % (±3,1 pp) y se advierte que no incluye otros errores.

## 3. Actores y negociación

- Postura de un partido ante una propuesta = 3·(acercamiento de la política a su posición) + relación con el Gobierno (+0,55 socios, −0,25 oposición) + concesiones (+0,42 incluir prioridades, +0,48 inversión territorial) + 0,6·(apoyo ciudadano − 0,5) − 0,12 en reformas constitucionales + interés en escaños (en reformas electorales se recalcula el reparto con los votos de la última elección).
- Voto: sí > 0,08; no < −0,08; si no, abstención. Cada legislador tiene disciplina individual: puede apartarse de la línea del partido según su propia posición.
- La IA del Ejecutivo presenta presupuestos y alguna ley acorde a su programa, y negocia concesiones hasta tener mayoría estimada (máx. 3 socios).
- Investidura (España): los partidos aceptan acuerdos (coalición, programa, inversión territorial, abstención) según su distancia al candidato y la existencia de alternativas más cercanas, con un componente incierto con semilla. El Rey propone al candidato con más apoyo esperado (simplificación de las consultas).
- Organizaciones (empresas, sindicatos, sociedad civil) con preferencias sobre palancas; su ánimo puede desencadenar huelgas, recortes o anuncios de inversión y protestas.
- Gobiernos territoriales (comunidades, estados) asignados según el voto simulado; en EE. UU. ratifican enmiendas.

## 4. Economía (mensual)

Unidades: PIB y deuda en miles de millones de moneda nominal; tasas en %; servicios en índices 0-100 (50 = nivel inicial; no son mediciones oficiales).

- **PIB real** = potencial × (1 + brecha). Potencial crece al ritmo base del país más efectos de largo plazo: infraestructura, educación, confianza, capacidad administrativa (+) y carga de impuestos sobre renta y sociedades (−).
- **Brecha** = demanda privada (persistencia 0,93, eventos, ruido σ 0,12 %, confianza empresarial) + impulso fiscal + efecto monetario.
- **Impulso fiscal**: por categoría, (gasto real − gasto neutral)/PIB potencial, que converge con una demora característica (3-12 meses) y se multiplica por un multiplicador (0,45-0,8) escalado por apertura (El Salvador 0,6). Los impuestos tienen multiplicadores negativos (−0,25 a −0,4).
- **Política monetaria**: EE. UU. con regla de Taylor (Reserva Federal, fuera del control del jugador); España con tipos del BCE exógenos; El Salvador dolarizado (tipos internacionales).
- **Inflación**: subyacente con inercia (0,9) hacia objetivo + 30·brecha + efecto del salario mínimo; choques de nivel por IVA (0,5 por punto) y aranceles (0,12 por punto) que se trasladan en unos meses; precios internacionales.
- **Desempleo**: ley de Okun respecto a un desempleo estructural que cambia lentamente con políticas activas, salario mínimo y cotizaciones.
- **Pobreza**: responde al desempleo, a las transferencias, a la inflación y al salario mínimo.
- **Servicios públicos**: objetivo = 50 + 35·ln(gasto real ejecutado/base), con demoras (salud 18 meses, educación 48, seguridad 12, infraestructura 36). El gasto **ejecutado** sólo puede crecer a un ritmo limitado por la **capacidad administrativa**: los aumentos bruscos tardan en convertirse en servicio. En sistemas federales/autonómicos el gasto nacional pesa sólo en parte (p. ej. educación en EE. UU. 15 %).
- **Cuentas públicas**: ingresos = Σ bases tributarias × tipos × PIB nominal × (1 + brecha) × cumplimiento + otros ingresos; gasto = presupuesto nominal/12 + estabilizadores + emergencias; intereses = coste medio × deuda. **Déficit = gasto + intereses − ingresos; deuda(t) = deuda(t−1) + déficit** (probado en `tests/economy.test.ts`). El coste medio de la deuda converge (≈ 6 años) al tipo de mercado, que sube con la deuda por encima de un umbral, con el déficit y con la pérdida de confianza.
- **Presupuestos en términos nominales**: si no se aprueba uno nuevo, se prorroga el anterior y la inflación reduce su valor real.
- **Aprobación**: por segmento, según empleo, precios, servicios que priorizan, carga tributaria percibida, cercanía de las políticas a su posición, "luna de miel" del gobierno nuevo y eventos; inercia 0,3 y ruido.

## 5. Eventos y azar

- Toda la aleatoriedad usa flujos con semilla (`engine/rng.ts`). **Los eventos externos dependen sólo de la semilla y del mes**, por lo que dos ramas de la misma partida los comparten; el ruido económico también se indexa por mes.
- Eventos externos (parámetros): desaceleración/auge mundial, petróleo, endurecimiento financiero, desastres naturales (más probables en El Salvador), caída de remesas (El Salvador), epidemias.
- Eventos internos según el estado: huelgas, inversión empresarial, protestas, escándalos ficticios (más probables con baja capacidad administrativa).

## 6. Explicaciones

Cada turno guarda las contribuciones a los cambios de actividad, inflación, desempleo, deuda, servicios, confianza y aprobación, clasificadas como **decisión**, **evento externo**, **aleatorio**, **tendencia/inercia** o **institucional**. Las reformas constitucionales no reciben cifras de impacto: sus efectos aparecen en las reglas que cambian y en la conducta de los actores; las consecuencias se presentan como escenarios cualitativos.

## 7. Limitaciones conocidas

- No hay elecciones regionales ni municipales; los gobiernos territoriales se infieren del voto.
- No se modelan enmiendas parlamentarias, comisiones detalladas, primarias, financiación de partidos, medios de comunicación ni política exterior.
- Multiplicadores y elasticidades fijos (en la realidad dependen del contexto).
- Los datos observados son del último año disponible y se usan como punto de partida sin extrapolar a la fecha de inicio.
