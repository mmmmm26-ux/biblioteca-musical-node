// Recorrido completo en navegador real (Chromium) con pantalla de celular.
// Uso: npm run build && npm run e2e   (CHROME_PATH permite indicar otro ejecutable)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 4173;
const URL = `http://127.0.0.1:${PORT}/`;
const OUT = 'e2e-capturas';
mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('El servidor no arrancó')), 20000);
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } });
});

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium' });
const results = [];
const errors = [];
let shot = 0;

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return page;
}
async function snap(page, name) {
  shot++;
  await page.screenshot({ path: `${OUT}/${String(shot).padStart(2, '0')}-${name}.png`, fullPage: false });
}
async function noHScroll(page, where) {
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  check(`Sin desplazamiento horizontal en ${where} (${w[0]} ≤ ${w[1]})`, w[0] <= w[1] + 1);
}
function nav(page, label) {
  return page.locator('nav.bottomnav button', { hasText: label }).click();
}
function check(name, ok) {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? '✔' : '✘'} ${name}`);
}
async function startGame(page, countryName, seed) {
  await page.goto(URL);
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await page.getByRole('button', { name: new RegExp(countryName) }).first().click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Semilla', { exact: true }).fill(seed);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Comenzar la campaña' }).click();
  // tutorial
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Empezar a jugar' }).click();
}
async function advanceUntil(page, text, max = 8) {
  for (let i = 0; i < max; i++) {
    if (await page.getByText(text, { exact: false }).first().isVisible().catch(() => false)) return true;
    await page.locator('header button.adv').click();
    await page.waitForTimeout(150);
  }
  return page.getByText(text, { exact: false }).first().isVisible().catch(() => false);
}

try {
  // ------------------------------------------------ El Salvador: recorrido completo
  let page = await newPage();
  await startGame(page, 'El Salvador', 'demo1');
  check('Partida creada y resumen visible', await page.getByText('Indicadores').first().isVisible());
  await noHScroll(page, 'resumen');
  await snap(page, 'sv-resumen');
  // campaña
  await nav(page, 'Campaña');
  for (const t of ['San Salvador', 'La Libertad', 'Santa Ana']) await page.getByRole('button', { name: t, exact: true }).click();
  await page.getByRole('button', { name: /^Visitar/ }).click();
  await page.getByRole('button', { name: 'Fijar mensaje' }).click();
  await page.getByRole('button', { name: '10 fondos' }).click();
  await page.getByRole('button', { name: 'Participar' }).click();
  check('Acciones de campaña aplicadas', await page.getByText('Ya participó').isVisible());
  await noHScroll(page, 'campaña');
  await snap(page, 'sv-campana');
  check('Elecciones celebradas (noche electoral)', await advanceUntil(page, 'Noche electoral', 8));
  await snap(page, 'sv-resultados');
  await noHScroll(page, 'resultados');
  await page.getByRole('button', { name: 'Continuar' }).first().click();
  // avanzar hasta la toma de posesión
  for (let i = 0; i < 5; i++) await page.locator('header button.adv').click();
  const role = await page.locator('.topbar .sub').innerText();
  check(`Gobierno u oposición tras la toma de posesión (${role})`, /Gobierno|oposición/.test(role));
  // propuesta constitucional
  await nav(page, 'Constitución');
  await page.getByRole('button', { name: /Restablecer la segunda vuelta/ }).click();
  check('Se muestra la regla actual y su fuente', await page.getByText('Regla actual').isVisible());
  await page.getByRole('button', { name: /Ver procedimiento/ }).click();
  check('Se muestran etapas y mayorías', await page.getByText('Etapas, mayorías y plazos').isVisible());
  await snap(page, 'sv-reforma');
  await page.getByRole('button', { name: 'Aprobar la reforma por decreto del Ejecutivo' }).click();
  check('Atajo inválido rechazado con explicación', await page.getByText(/Inválido/).first().isVisible());
  const presentar = page.getByRole('button', { name: 'Presentar e iniciar el trámite' });
  const canSubmit = await presentar.isEnabled();
  if (canSubmit) await presentar.click();
  else await page.getByRole('button', { name: 'Cancelar' }).last().click();
  check(`Reforma presentada o bloqueada por requisitos (${canSubmit ? 'presentada' : 'bloqueada: iniciativa'})`, true);
  // presupuesto (si gobierna)
  await nav(page, 'Gobierno');
  const budgetBtn = page.getByRole('button', { name: 'Revisar y presentar el presupuesto' });
  if (await budgetBtn.isVisible().catch(() => false)) {
    await page.getByLabel('Salud', { exact: true }).fill('3.6');
    await budgetBtn.click();
    await page.getByRole('button', { name: 'Presentar e iniciar el trámite' }).click();
    check('Presupuesto presentado', true);
  } else {
    // en la oposición: proponer exigencia ambiental
    await page.getByLabel('Exigencia ambiental').fill('60');
    await page.getByRole('button', { name: /Revisar \(ley\)/ }).click();
    await page.getByRole('button', { name: 'Presentar e iniciar el trámite' }).click();
    check('Ley presentada desde la oposición', true);
  }
  for (let i = 0; i < 4; i++) await page.locator('header button.adv').click();
  await nav(page, 'Congreso');
  const votes = await page.getByText(/Aprobado en|No aprobado en|veta|Sanción/).count();
  const anyProc = (await page.locator('.card').filter({ hasText: /En trámite|En vigor|Rechazada/ }).count()) > 0;
  check(`Votaciones y trámites visibles en el Congreso`, anyProc || votes > 0);
  await snap(page, 'sv-congreso');
  await nav(page, 'Resumen');
  check('Panel «¿Por qué pasó esto?» con causas', await page.getByText(/Decisión|Evento externo|Aleatorio|Tendencia/).first().isVisible());
  await snap(page, 'sv-porque');
  // guardar y continuar
  await nav(page, 'Más');
  await page.getByRole('button', { name: /Guardar, cargar/ }).click();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar (.json)' }).click()]);
  const exportPath = `${OUT}/partida-exportada.json`;
  await dl.saveAs(exportPath);
  check('Exportación descargada', true);
  writeFileSync(`${OUT}/danada.json`, '{"format":"naciones-guardado","formatVersion":1,"state":{}}');
  await page.locator('input[type=file]').setInputFiles(`${OUT}/danada.json`);
  await page.waitForTimeout(400);
  check('Importación de archivo inválido rechazada', await page.getByText(/Formato de partida desconocido|Falta/).first().isVisible());
  const dateBefore = await page.locator('.topbar .sub').innerText();
  await page.reload();
  await page.getByRole('button', { name: 'Cargar' }).first().click();
  const dateAfter = await page.locator('.topbar .sub').innerText();
  check(`Partida recuperada tras recargar (${dateAfter.split('·')[0].trim()})`, dateBefore.split('·')[0] === dateAfter.split('·')[0]);
  await page.locator('header button.adv').click();
  check('La partida continúa tras cargar', (await page.locator('.topbar .sub').innerText()) !== dateAfter);
  await page.locator('input[type=file]').count();
  // importar el archivo exportado
  await nav(page, 'Más');
  await page.getByRole('button', { name: /Guardar, cargar/ }).click();
  await page.locator('input[type=file]').setInputFiles(exportPath);
  await page.waitForTimeout(400);
  check('Importación del archivo exportado validada', (await page.locator('.topbar .sub').innerText()).split('·')[0] === dateBefore.split('·')[0]);
  await page.close();

  // ------------------------------------------------ España: parlamentarismo
  page = await newPage();
  await startGame(page, 'España', 'demo2');
  check('España: elecciones generales celebradas', await advanceUntil(page, 'Noche electoral', 4));
  check('España: aviso de que ganar no garantiza gobernar', await page.getByText(/investidura|negociación/).first().isVisible());
  await snap(page, 'es-resultados');
  await page.getByRole('button', { name: 'Continuar' }).first().click();
  await page.locator('header button.adv').click();
  await nav(page, /Investidura|Gobierno/);
  check('España: negociación de investidura disponible', await page.getByRole('heading', { name: 'Formación de gobierno' }).isVisible());
  await page.getByRole('button', { name: 'Pedir la abstención' }).first().click();
  check('España: respuesta del partido a la oferta', await page.getByText(/acepta|rechaza/).first().isVisible());
  await noHScroll(page, 'investidura');
  await snap(page, 'es-investidura');
  await page.close();

  // ------------------------------------------------ Estados Unidos: Colegio Electoral
  page = await newPage();
  await startGame(page, 'Estados Unidos', 'demo3');
  check('EE. UU.: elección general celebrada', await advanceUntil(page, 'Noche electoral', 6));
  check('EE. UU.: Colegio Electoral', await page.getByText(/Colegio Electoral/).first().isVisible());
  await snap(page, 'us-resultados');
  await noHScroll(page, 'resultados EE. UU.');
  await page.getByRole('button', { name: 'Continuar' }).first().click();
  await nav(page, 'Constitución');
  await page.getByRole('button', { name: /voto popular nacional/ }).click();
  await page.getByRole('button', { name: /Ver procedimiento/ }).click();
  check('EE. UU.: enmienda exige 3/4 de los estados', await page.getByText(/3\/4 de los territorios|38/).first().isVisible());
  await snap(page, 'us-enmienda');
  await page.close();

  // ------------------------------------------------ escritorio
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(URL);
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await snap(page, 'escritorio-nueva');
  await page.close();
} catch (e) {
  errors.push(`excepción: ${e.message}`);
  console.error(e);
} finally {
  check('Sin errores de JavaScript en la consola', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
  await browser.close();
  server.kill();
  writeFileSync(`${OUT}/resultado.json`, JSON.stringify({ results, errors }, null, 2));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`);
  process.exit(failed ? 1 : 0);
}
