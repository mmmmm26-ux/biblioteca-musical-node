// Genera docs/REGLAS.md a partir de los módulos de datos (fuente única de verdad).
import { writeFileSync } from 'node:fs';
import { COUNTRIES } from '../src/data/countries';
import { verificationLabel } from '../src/engine/legal/rules';

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const val = (v: unknown) => (typeof v === 'object' ? `tabla (${Object.keys(v as object).length} valores)` : String(v));
let out = `# Reglas implementadas por país\n\nGenerado automáticamente con \`npm run docs:reglas\` desde \`src/data/countries\`. Versión de reglas y fecha de consulta: ver cada fila.\n\nNiveles de verificación: **Contrastada** (confirmada con fuentes oficiales o reproducciones fiables del texto en esta versión), **Pendiente de cotejo** (procede del texto oficial según el conocimiento del equipo; se usa en el juego con aviso), **Simplificación del juego** (no es derecho vigente) y **Pendiente** (acción desactivada).\n\n`;
for (const c of Object.values(COUNTRIES)) {
  out += `## ${c.name} — ${c.system.label}\n\nVersión de reglas: ${c.rulesetVersion}. Estado de la implementación: ${c.status}.\n\n`;
  out += `| Regla | Valor en el juego | Norma | Artículo | Fuente | Publicación / vigor | Consulta | Verificación |\n|---|---|---|---|---|---|---|---|\n`;
  for (const r of c.rules) {
    const s = c.sources.find((x) => x.id === r.sourceId);
    const dates = [r.published ?? s?.published, r.inForce ?? s?.inForce].map((d) => d ?? '—').join(' / ');
    out += `| ${esc(r.title)} | ${esc(val(r.value))} | ${r.normLevel} | ${esc(r.article)} | [${esc(s?.publisher ?? r.sourceId)}](${s?.url ?? ''}) | ${dates} | ${r.consulted} | ${verificationLabel(r.verification)} |\n`;
  }
  const contr = c.rules.filter((r) => r.controversy);
  if (contr.length) out += `\n**Controversias señaladas:**\n\n${contr.map((r) => `- *${r.title}*: ${r.controversy}`).join('\n')}\n`;
  out += `\n**Fuentes:**\n\n${c.sources.map((s) => `- ${s.title} — ${s.publisher}. ${s.url}${s.published ? ` (publicación ${s.published})` : ''}${s.inForce ? ` (vigor ${s.inForce})` : ''}${s.note ? `. ${s.note}` : ''}`).join('\n')}\n\n`;
  out += `**Alcance.** Implementado: ${c.coverage.implemented.join('; ')}.\n\nSimplificado: ${c.coverage.simplified.join('; ')}.\n\nPendiente: ${c.coverage.pending.join('; ')}.\n\n`;
}
writeFileSync('docs/REGLAS.md', out);
console.log('docs/REGLAS.md generado');
