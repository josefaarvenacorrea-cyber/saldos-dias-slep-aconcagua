import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dvDe, formatearRut, numeroRut, rutValido, claveInicialDe } from '../src/lib/rut.ts';
import { repartirDiasHabiles, diasHabilesEntre, diasHabilesRestantesDelAnio } from '../src/lib/fechas.ts';
import { feriadoPorVencer, feriadoPostergable } from '../src/lib/feriado.ts';
import { horas, numero } from '../src/lib/formato.ts';
import { leerDias } from '../src/lib/excel/dias.ts';
import { leerDescansos } from '../src/lib/excel/descansos.ts';
import { leerDotacion } from '../src/lib/excel/dotacion.ts';

// Genera los Excel ficticios de prueba.
execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'scripts/crear-datos-prueba.ts']);

test('RUT: dígito verificador, formato y clave inicial', () => {
  assert.equal(dvDe('11111111'), '1');
  assert.equal(dvDe('22222222'), '2');
  assert.equal(numeroRut(' 12.345.678-k '), '12345678');
  assert.ok(rutValido('11.111.111-1'));
  assert.ok(!rutValido('11111111-2'));
  assert.equal(formatearRut('22222222'), '22.222.222-2');
  assert.equal(claveInicialDe('9876543'), '9876');
});

test('Fechas: reparto en días hábiles, saltando fin de semana y feriados', () => {
  // viernes 17-09-2026 + 2 días: el 18 es feriado y el 19-20 fin de semana → 17 y 21
  assert.deepEqual(repartirDiasHabiles('2026-09-17', 2).map((d) => d.fecha), ['2026-09-17', '2026-09-21']);
  assert.deepEqual(repartirDiasHabiles('2026-03-05', 0.5), [{ fecha: '2026-03-05', fraccion: 0.5 }]);
  assert.equal(diasHabilesEntre('2026-02-16', '2026-02-25'), 8);
});

test('Formato de números y horas', () => {
  assert.equal(numero(3.5), '3,5');
  assert.equal(horas(55.25), '55 h 15 min');
  assert.equal(horas(-3.5), '−3 h 30 min');
});

test('Días: saldo = inicial − detalle, sin contar repetidas, con RUT de dígito corrido', async () => {
  const r = await leerDias(await readFile('.datos-prueba/dias-prueba.xlsx'));
  assert.equal(r.resumen.funcionarios, 3);
  assert.equal(r.resumen.repetidas, 1);
  const ana = r.personas['11111111'];
  assert.equal(ana.administrativos.saldo, 3.5);
  assert.equal(ana.feriadoLegal.inicial, 25);
  assert.equal(ana.feriadoLegal.saldo, 20);
  assert.equal(r.personas['22222222'].administrativos.usados, 2); // la repetida no se cuenta
  assert.equal(r.personas['15555555'].feriadoLegal.usados, 3); // dígito corrido igual se asigna
  assert.ok(r.alertas.some((a) => a.alerta === 'RUT-DV distinto al de SALDOS'));
  assert.ok(r.alertas.some((a) => a.alerta === 'Solicitud repetida'));
});

test('Feriado legal por vencer: lo usado se descuenta primero de los días acumulados', async () => {
  const r = await leerDias(await readFile('.datos-prueba/dias-prueba.xlsx'));
  // Las tres personas tienen 10 días acumulados y 15 del año.
  assert.equal(feriadoPorVencer(r.personas['11111111'].feriadoLegal), 5); // usó 5
  assert.equal(feriadoPorVencer(r.personas['22222222'].feriadoLegal), 10); // no ha usado
  assert.equal(feriadoPorVencer(r.personas['15555555'].feriadoLegal), 7); // usó 3
  const base = { acumuladoAnterior: 10, anualidad: 15, inicial: 25, usadosSegunResumen: 0 };
  assert.equal(feriadoPorVencer({ ...base, usados: 12, saldo: 13 }), 0); // ya usó los acumulados: los del año se pueden postergar
  assert.equal(feriadoPorVencer({ ...base, usados: 7.5, saldo: 17.5 }), 2.5);
  assert.equal(feriadoPorVencer({ ...base, acumuladoAnterior: 0, usados: 0, saldo: 15 }), 0);
});

test('Feriado legal postergable: solo los días del año en curso, nunca los acumulados', () => {
  const base = { acumuladoAnterior: 10, anualidad: 15, inicial: 25, usadosSegunResumen: 0 };
  // Sin usar nada: se posterga la anualidad completa y los 10 acumulados quedan por vencer.
  assert.equal(feriadoPostergable({ ...base, usados: 0, saldo: 25 }), 15);
  // Ya usó los acumulados y 2 de la anualidad: todo el saldo es postergable.
  assert.equal(feriadoPostergable({ ...base, usados: 12, saldo: 13 }), 13);
  // Medios días: usó 7,5, quedan 2,5 acumulados por vencer y 15 postergables.
  assert.equal(feriadoPostergable({ ...base, usados: 7.5, saldo: 17.5 }), 15);
  // Sin acumulados: todo el saldo se puede postergar.
  assert.equal(feriadoPostergable({ ...base, acumuladoAnterior: 0, usados: 0, saldo: 15 }), 15);
  // Sin saldo: no hay nada que postergar.
  assert.equal(feriadoPostergable({ ...base, usados: 25, saldo: 0 }), 0);
  // Postergable + por vencer siempre suman el saldo.
  const caso = { ...base, usados: 3, saldo: 22 };
  assert.equal(feriadoPostergable(caso) + feriadoPorVencer(caso), caso.saldo);
});

test('Jefaturas: se empareja el nombre escrito en la Dotación, aunque esté incompleto', async () => {
  const { tokensNombre, resolverPorNombre } = await import('../src/lib/nombres.ts');

  assert.deepEqual(tokensNombre('Ríos Soto, María José'), ['MARIA', 'JOSE', 'RIOS', 'SOTO']);
  assert.deepEqual(tokensNombre('Alejandra de las Mercedes Meza Veas'), ['ALEJANDRA', 'MERCEDES', 'MEZA', 'VEAS']);

  const personas = [
    { rut: '11111111', nombre: 'Alejandra de las Mercedes Meza Veas' },
    { rut: '22222222', nombre: 'Carlos Andrés Rivas Mena' },
    { rut: '33333333', nombre: 'Carlos Ignacio Rivas Mena' },
    { rut: '44444444', nombre: 'María José Ríos Soto' },
  ];
  const r = (nombre: string, propio = '99999999') => resolverPorNombre(nombre, propio, personas);

  // Nombre incompleto, pero sin ninguna duda de quién es.
  assert.deepEqual(r('Alejandra Meza Veas'), { rut: '11111111' });
  assert.deepEqual(r('Alejandra Meza'), { rut: '11111111' });
  // Con acentos, sin acentos y con el apellido primero da lo mismo.
  assert.deepEqual(r('MEZA VEAS, ALEJANDRA'), { rut: '11111111' });
  assert.deepEqual(r('Rios Soto Maria Jose'), { rut: '44444444' });
  // Dos personas con el mismo apellido: no se adivina, se avisa.
  assert.deepEqual(r('Rivas Mena'), { motivo: 'ambiguo' });
  assert.deepEqual(r('Carlos Rivas Mena'), { motivo: 'ambiguo' });
  // Con el segundo nombre ya se distingue.
  assert.deepEqual(r('Carlos Andrés Rivas'), { rut: '22222222' });
  // Una sola palabra nunca alcanza.
  assert.deepEqual(r('Alejandra'), { motivo: 'muy_corto' });
  // Nombre que no está en la Dotación, y jefatura de sí misma.
  assert.deepEqual(r('Pedro Pérez Soto'), { motivo: 'no_existe' });
  assert.deepEqual(r('Alejandra Meza Veas', '11111111'), { motivo: 'si_mismo' });
});

test('Permisos: cada tipo con su regla de fraccionamiento y su tope de saldo', async () => {
  const r = await import('../src/lib/reglasPermisos.ts');
  const saldos = { feriado: 15, goce: 2.5, compensatorioMin: 450 }; // 450 min = 7:30

  // Lunes 23 a miércoles 25 de noviembre de 2026.
  type Tipo = 'feriado' | 'goce' | 'compensatorio' | 'interferiado' | 'otros';
  const rango = (tipo: Tipo, previas = {}) => r.diasDelRango('2026-11-23', '2026-11-25', tipo, previas);

  // Feriado legal: todos los días quedan completos, aunque se intente media jornada.
  const feriado = rango('feriado', { '2026-11-24': 'am' as const });
  assert.equal(r.totalDias(feriado), 3);
  assert.ok(feriado.every((d) => d.jornada === 'completa'));

  // Con goce: medio día vale 0,5, así que se llega a 2,5.
  const goce = rango('goce', { '2026-11-25': 'pm' as const });
  assert.equal(r.totalDias(goce), 2.5);
  assert.equal(r.jornadaUnica(goce), null); // jornadas mezcladas: el papel no puede expresarlo
  assert.equal(r.jornadaUnica(rango('goce')), 'completa');

  // Un solo medio día son 0,5.
  assert.equal(r.totalDias(r.diasDelRango('2026-11-23', '2026-11-23', 'goce', { '2026-11-23': 'am' })), 0.5);

  // El fin de semana no se descuenta: sábado 28 y domingo 29 suman 0.
  assert.equal(r.totalDias(r.diasDelRango('2026-11-28', '2026-11-29', 'goce')), 0);

  const base = { horaDesde: '08:30', horaHasta: '11:30', certificado: null };

  // Con goce pasando el saldo de 2,5.
  const exceso = r.revisar({ ...base, tipo: 'goce', dias: r.diasDelRango('2026-11-23', '2026-11-26', 'goce') }, saldos);
  assert.equal(exceso.ok, false);
  assert.match(exceso.error ?? '', /saldo disponible es de 2\.5/);

  // Con goce dentro del saldo.
  assert.equal(r.revisar({ ...base, tipo: 'goce', dias: goce }, saldos).ok, true);

  // Feriado legal con medio día: lo rechaza aunque alcance el saldo.
  const medio = r.diasDelRango('2026-11-23', '2026-11-23', 'goce', { '2026-11-23': 'am' });
  const malFeriado = r.revisar({ ...base, tipo: 'feriado', dias: medio }, saldos);
  assert.equal(malFeriado.ok, false);
  assert.match(malFeriado.error ?? '', /días completos/);

  // Compensatorio: por horas y dentro del saldo.
  const unDia = r.diasDelRango('2026-11-23', '2026-11-23', 'compensatorio');
  assert.equal(r.revisar({ ...base, tipo: 'compensatorio', dias: unDia }, saldos).minutos, 180);
  assert.equal(r.revisar({ ...base, tipo: 'compensatorio', dias: unDia, horaHasta: '17:00' }, saldos).ok, false);
  assert.equal(r.revisar({ ...base, tipo: 'compensatorio', dias: unDia, horaHasta: '08:00' }, saldos).ok, false);
  assert.equal(r.horasTexto(450), '7:30');

  // Otros permisos: sin certificado no se puede enviar.
  const sinCert = r.revisar({ ...base, tipo: 'otros', dias: rango('otros') }, saldos);
  assert.equal(sinCert.ok, false);
  assert.match(sinCert.error ?? '', /certificado/);
  assert.equal(r.revisar({ ...base, tipo: 'otros', dias: rango('otros'), certificado: 'cert.pdf' }, saldos).ok, true);

  // Interferiado: no descuenta saldo, pero solo se puede pedir en los días que corresponden.
  assert.equal(r.descuentaSaldo('interferiado'), false);
});

test('Interferiado: solo el día hábil que está justo antes de un feriado', async () => {
  const r = await import('../src/lib/reglasPermisos.ts');
  const c = await import('../src/lib/feriadosChile.ts');
  const saldos = { feriado: 15, goce: 2.5, compensatorioMin: 450 };
  const base = { horaDesde: '08:30', horaHasta: '11:30', certificado: null };
  // Devolver 8 horas a razón de 1 hora extra por día, empezando el miércoles 9 de diciembre.
  const plan = (desde = '2026-12-09', horas = 8, porDia = 1) => ({
    horas,
    horasPorDia: porDia,
    desde,
    dias: r.planRecuperacion(desde, horas, porDia),
  });
  const pedir = (desde: string, recuperacion = plan(), hasta = desde) =>
    r.revisar(
      { ...base, tipo: 'interferiado' as const, dias: r.diasDelRango(desde, hasta, 'interferiado'), recuperacion },
      saldos,
    );

  // Lunes 7 de diciembre de 2026, justo antes de la Inmaculada Concepción del martes 8.
  assert.equal(c.esInterferiado('2026-12-07'), true);
  assert.equal(pedir('2026-12-07').ok, true);

  // Jueves 24 de diciembre, justo antes de Navidad.
  assert.equal(c.esInterferiado('2026-12-24'), true);

  // Un feriado que cae sábado no sirve de puente: acá no se trabaja los sábados.
  assert.equal(c.esFeriado('2026-10-31'), true);
  assert.equal(c.esInterferiado('2026-10-30'), false);

  // Un lunes cualquiera no lo es.
  assert.equal(c.esInterferiado('2026-11-23'), false);
  const malo = pedir('2026-11-23');
  assert.equal(malo.ok, false);
  assert.match(malo.error ?? '', /justo antes de un feriado/);

  // El feriado mismo no es interferiado, ni tampoco un fin de semana.
  assert.equal(c.esInterferiado('2026-12-25'), false);
  assert.equal(c.esInterferiado('2026-12-26'), false);

  // Los feriados no se descuentan del saldo en ningún tipo de permiso.
  const cruzaFeriado = r.diasDelRango('2026-12-07', '2026-12-09', 'goce');
  assert.equal(r.totalDias(cruzaFeriado), 2); // el martes 8 es feriado y no cuesta día
  assert.equal(r.motivoNoHabil('2026-12-08'), 'Inmaculada Concepción');
  assert.equal(r.motivoNoHabil('2026-12-05'), 'fin de semana');
  assert.equal(r.motivoNoHabil('2026-12-07'), null);

  // Sin calendario del año no se adivina.
  assert.equal(c.hayCalendarioPara('2031-05-05'), false);
  assert.match(pedir('2031-05-05').error ?? '', /feriados de ese año/);
});

test('Interferiado: las horas se devuelven y el calendario tiene que cuadrar', async () => {
  const r = await import('../src/lib/reglasPermisos.ts');
  const saldos = { feriado: 15, goce: 2.5, compensatorioMin: 450 };
  const base = { horaDesde: '08:30', horaHasta: '11:30', certificado: null };
  const dias = r.diasDelRango('2026-12-07', '2026-12-07', 'interferiado');
  const pedir = (recuperacion: unknown) =>
    r.revisar({ ...base, tipo: 'interferiado' as const, dias, recuperacion } as never, saldos);

  // 8 horas a 1 por día: ocho días hábiles seguidos, saltando el fin de semana.
  const ocho = r.planRecuperacion('2026-12-09', 8, 1);
  assert.equal(ocho.length, 8);
  assert.equal(r.totalRecuperado(ocho), 8);
  assert.deepEqual(
    ocho.map((d) => d.fecha),
    ['2026-12-09', '2026-12-10', '2026-12-11', '2026-12-14', '2026-12-15', '2026-12-16', '2026-12-17', '2026-12-18'],
  );

  // El último día lleva el resto cuando no es múltiplo exacto.
  const siete = r.planRecuperacion('2026-12-09', 7, 2);
  assert.equal(siete.length, 4);
  assert.deepEqual(siete.map((d) => d.horas), [2, 2, 2, 1]);
  assert.equal(r.totalRecuperado(siete), 7);

  // El plan salta los feriados: empezando el lunes 7, el martes 8 no se usa.
  assert.equal(r.planRecuperacion('2026-12-07', 2, 1)[1].fecha, '2026-12-09');

  // Sin plan, o con un plan que no suma, no se puede pedir.
  assert.match(pedir(null).error ?? '', /cuántas horas vas a devolver/);
  assert.match(pedir({ horas: 8, horasPorDia: 0, desde: '2026-12-09', dias: [] }).error ?? '', /horas extra vas a hacer/);
  assert.match(
    pedir({ horas: 8, horasPorDia: 1, desde: '2026-12-09', dias: r.planRecuperacion('2026-12-09', 5, 1) }).error ?? '',
    /no suma las horas/,
  );
  assert.equal(pedir({ horas: 8, horasPorDia: 1, desde: '2026-12-09', dias: ocho }).ok, true);
});

test('Días hábiles que quedan en el año, desde mañana', () => {
  assert.equal(diasHabilesRestantesDelAnio('2026-10-27'), 45);
  assert.equal(diasHabilesRestantesDelAnio('2026-12-30'), 1);
  assert.equal(diasHabilesRestantesDelAnio('2026-12-31'), 0);
});

test('Descansos: horas reconocidas con vencimiento y saldo', async () => {
  const r = await leerDescansos(await readFile('.datos-prueba/descansos-prueba.xlsx'));
  const ana = r.personas['11111111'];
  assert.equal(ana.totalReconocidas, 16.5);
  assert.equal(ana.usadas, 11);
  assert.equal(ana.saldo, 5.5);
  assert.equal(ana.reconocidas.find((x) => x.fuente.includes('192'))?.vence, '2028-03-20');
});

test('Dotación: correos y personas sin correo', async () => {
  const r = await leerDotacion(await readFile('.datos-prueba/dotacion-prueba.xlsx'));
  assert.equal(r.resumen.funcionarios, 3);
  assert.equal(r.resumen.conCorreo, 2);
  assert.equal(r.personas['11111111'].correoInstitucional, 'ana.prueba@ejemplo.cl');
});

test('Aviso de postergación: solo antes y durante el proceso', async () => {
  const { etapaPostergacion } = await import('../src/lib/postergacion.ts');
  assert.equal(etapaPostergacion('2026-10-01'), null);
  assert.equal(etapaPostergacion('2026-10-28'), null); // 22 días antes: todavía no se avisa
  assert.equal(etapaPostergacion('2026-10-29'), 'proximo'); // 21 días antes: parte el aviso
  assert.equal(etapaPostergacion('2026-11-18'), 'proximo');
  assert.equal(etapaPostergacion('2026-11-19'), 'abierto');
  assert.equal(etapaPostergacion('2026-11-23'), 'abierto');
  assert.equal(etapaPostergacion('2026-12-05'), 'abierto');
  assert.equal(etapaPostergacion('2026-12-06'), 'terminado');
  assert.equal(etapaPostergacion('2026-12-11'), 'terminado');
  assert.equal(etapaPostergacion('2026-12-12'), null);
});

test('Integración: carpeta del SharePoint y base que alimenta cada tipo', async () => {
  const { carpetaDe, baseDe, CARPETAS, TIPO_EXCEL } = await import('../src/lib/integracion.ts');
  assert.equal(CARPETAS[carpetaDe('feriado')], 'Feriado legal');
  assert.equal(CARPETAS[carpetaDe('goce')], 'Con goce de remuneraciones');
  assert.equal(CARPETAS[carpetaDe('compensatorio')], 'Permisos complementarios');
  // El interferiado y los demás permisos se archivan juntos.
  assert.equal(carpetaDe('interferiado'), 'otros');
  assert.equal(carpetaDe('otros'), 'otros');

  assert.equal(baseDe('feriado'), 'dias');
  assert.equal(baseDe('goce'), 'dias');
  assert.equal(baseDe('compensatorio'), 'descansos');
  assert.equal(baseDe('interferiado'), 'interferiados');
  assert.equal(baseDe('otros'), 'ninguna');

  // El texto del tipo en el Excel no es el de la pantalla.
  assert.equal(TIPO_EXCEL.goce, 'Con Goce de Remuneraciones');
  assert.equal(TIPO_EXCEL.interferiado, null);
});

test('Integración: los días se reparten al mes en que se toman', async () => {
  const { cargosPorMes, rangoDe, anioDe } = await import('../src/lib/integracion.ts');
  const { diasDelRango } = await import('../src/lib/reglasPermisos.ts');

  // Un feriado legal que cruza de junio a julio: un día en junio, el resto en julio.
  const cruza = diasDelRango('2026-06-30', '2026-07-03', 'feriado');
  const reparto = cargosPorMes(cruza);
  assert.deepEqual(
    reparto.map((c) => [c.mes, c.dias]),
    [
      [6, 1],
      [7, 3],
    ],
  );
  assert.equal(reparto[0].mesNombre, 'Junio');
  assert.deepEqual(rangoDe(cruza), { desde: '2026-06-30', hasta: '2026-07-03' });
  assert.equal(anioDe(cruza, 2027), 2026);

  // Un rango que cae en fin de semana no deja nada que cargar.
  assert.deepEqual(cargosPorMes(diasDelRango('2026-06-06', '2026-06-07', 'goce')), []);

  // El medio día vale 0,5 y se suma al mes que corresponde.
  const medio = [
    { fecha: '2026-03-02', jornada: 'am' as const },
    { fecha: '2026-03-03', jornada: 'completa' as const },
  ];
  assert.deepEqual(
    cargosPorMes(medio).map((c) => [c.mes, c.dias]),
    [[3, 1.5]],
  );

  // El total repartido por mes y el total del permiso tienen que coincidir siempre.
  const { totalDias } = await import('../src/lib/reglasPermisos.ts');
  const suma = cargosPorMes(cruza).reduce((t, c) => t + c.dias, 0);
  assert.equal(suma, totalDias(cruza));
});

test('Integración: el token se compara completo y en tiempo constante', async () => {
  const { tokenCalza, tokenDe } = await import('../src/lib/integracion.ts');
  assert.equal(tokenCalza('secreto-largo', 'secreto-largo'), true);
  assert.equal(tokenCalza('secreto-largo', 'secreto-largX'), false);
  assert.equal(tokenCalza('secreto-largo', 'secreto'), false);
  assert.equal(tokenCalza('secreto-largo', 'secreto-largo-de-mas'), false);
  // Sin token configurado no se entra ni con la cadena vacía.
  assert.equal(tokenCalza('', ''), false);

  const conCabecera = new Request('https://x.cl/api', { headers: { authorization: 'Bearer abc' } });
  assert.equal(tokenDe(conCabecera), 'abc');
  assert.equal(tokenDe(new Request('https://x.cl/api?token=def')), 'def');
  assert.equal(tokenDe(new Request('https://x.cl/api')), null);
});

test('Integración: el cursor lleva fecha e id, para no saltarse documentos', async () => {
  const { leerCursor, escribirCursor } = await import('../src/lib/integracion.ts');
  assert.deepEqual(leerCursor('2026-11-20T14:01:33.295Z|41'), { en: '2026-11-20T14:01:33.295Z', id: 41 });
  // Una fecha sola también sirve, por si el flujo parte con la hora de su última corrida.
  assert.deepEqual(leerCursor('2026-11-20T14:01:33.295Z'), { en: '2026-11-20T14:01:33.295Z', id: 0 });
  assert.equal(leerCursor(null), null);
  assert.equal(leerCursor('cualquier cosa'), null);
  assert.equal(leerCursor('2026-11-20T14:01:33.295Z|-3'), null);
  assert.equal(escribirCursor({ en: '2026-11-20T14:01:33.295Z', id: 41 }), '2026-11-20T14:01:33.295Z|41');

  // Ida y vuelta: lo que escribe el endpoint es lo que el flujo puede volver a leer.
  const c = { en: '2026-11-20T14:01:33.295Z', id: 7 };
  assert.deepEqual(leerCursor(escribirCursor(c)), c);
});

test('Dotación: si el RUT-DV está mal escrito, usa las columnas RUT y DV de la misma fila', async () => {
  const { default: ExcelJS } = await import('exceljs');
  const libro = new ExcelJS.Workbook();
  const h = libro.addWorksheet('Hoja1');
  h.addRow(['RUT-DV', 'RUT', 'DV', 'NOMBRE COMPLETO', 'CORREO INSTITUCIONAL', 'Jefatura']);
  h.addRow(['11111110-1', 11111111, 1, 'Persona Ficticia Uno', 'uno@ejemplo.cl', 'Jefatura Ficticia']); // RUT-DV con un dígito cambiado
  h.addRow(['22222220-2', 222222222, 2, 'Persona Ficticia Dos', 'dos@ejemplo.cl', '-']); // RUT con el dígito pegado
  const r = await leerDotacion(new Uint8Array(await libro.xlsx.writeBuffer()));
  assert.equal(r.personas['11111111']?.correoInstitucional, 'uno@ejemplo.cl');
  assert.equal(r.personas['11111111']?.jefatura, 'Jefatura Ficticia');
  assert.equal(r.personas['22222222']?.correoInstitucional, 'dos@ejemplo.cl');
  assert.equal(r.alertas.filter((a) => a.alerta === 'RUT-DV mal escrito').length, 2);
});

test('Avisos: el correo del permiso dice lo que corresponde según el tipo', async () => {
  const a = await import('../src/lib/avisos.ts');
  const base = {
    codigo: 'ABC123',
    nombre: 'Ana María Prueba Soto',
    jefaturaNombre: 'Jefa De Prueba Mena',
    autorizado: true,
    horaDesde: null,
    horaHasta: null,
    recuperacion: null,
  };

  // Feriado legal de varios días: dice el rango y el total.
  const feriado = { ...base, tipo: 'feriado' as const, desde: '2026-06-30', hasta: '2026-07-03', totalDias: 4 };
  assert.equal(a.asuntoPermiso(feriado), 'Permiso autorizado: Feriado Legal · ABC123');
  let c = a.cuerpoPermiso(feriado);
  assert.match(c, /Desde el <strong>30-06-2026<\/strong> hasta el <strong>03-07-2026<\/strong>, 4 días\./);
  assert.match(c, /quedó <strong>autorizada<\/strong>/);

  // Medio día: coma decimal, y plural, que es lo que corresponde para todo lo que no sea 1.
  c = a.cuerpoPermiso({ ...base, tipo: 'goce' as const, desde: '2026-03-02', hasta: '2026-03-02', totalDias: 0.5 });
  assert.match(c, /El <strong>02-03-2026<\/strong>, 0,5 días\./);
  assert.equal(a.diasTexto(1), '1 día');
  assert.equal(a.diasTexto(1.5), '1,5 días');

  // Descanso compensatorio: horas en vez de días.
  c = a.cuerpoPermiso({
    ...base,
    tipo: 'compensatorio' as const,
    desde: '2026-11-18',
    hasta: '2026-11-18',
    totalDias: 0,
    horaDesde: '14:00',
    horaHasta: '16:30',
  });
  assert.match(c, /de 14:00 a 16:30/);
  assert.ok(!/días/.test(c), 'un permiso por horas no debe hablar de días');

  // Interferiado: no cuenta días y sí explica la devolución.
  c = a.cuerpoPermiso({
    ...base,
    tipo: 'interferiado' as const,
    desde: '2026-12-07',
    hasta: '2026-12-07',
    totalDias: 1,
    recuperacion: { horas: 8, dias: 8, desde: '2026-12-09', hasta: '2026-12-18' },
  });
  assert.match(c, /no descuenta saldo/);
  assert.match(c, /8 horas repartidas\s+en 8 días/);
  assert.ok(!/, 1 día\./.test(c), 'el interferiado no descuenta saldo, no debe anunciar un día');

  // Rechazado: no habla del saldo descontado ni del código de verificación.
  c = a.cuerpoPermiso({ ...feriado, autorizado: false });
  assert.match(c, /<strong>no fue autorizada<\/strong>/);
  assert.match(c, /no se descontaron de su saldo/);
  assert.equal(a.asuntoPermiso({ ...feriado, autorizado: false }), 'Permiso no autorizado: Feriado Legal · ABC123');
});

test('Avisos: la copia siempre lleva a administración, y sin correo no se manda nada', async () => {
  const { correoPlano, COPIA_ADMINISTRACION } = await import('../src/lib/avisos.ts');
  const c = correoPlano('ana@x.cl', 'jefa@x.cl', 'Asunto', '<p>Hola</p>', 'doc.pdf', 'QkFTRTY0');
  assert.equal(c?.para, 'ana@x.cl');
  assert.equal(c?.copia, `jefa@x.cl;${COPIA_ADMINISTRACION}`);
  // Sin jefatura conocida, la copia queda solo con administración.
  assert.equal(correoPlano('ana@x.cl', null, 'A', 'B', 'c.pdf', 'd')?.copia, COPIA_ADMINISTRACION);
  // Sin correo del funcionario no hay a quién escribirle.
  assert.equal(correoPlano(null, 'jefa@x.cl', 'A', 'B', 'c.pdf', 'd'), null);
});

test('Avisos: el correo de la postergación distingue los tres cierres', async () => {
  const { cuerpoPostergacion, asuntoPostergacion } = await import('../src/lib/avisos.ts');
  const base = {
    codigo: 'XYZ789',
    nombre: 'Ana María Prueba Soto',
    jefaturaNombre: 'Jefa De Prueba Mena',
    anio: 2026,
    anioDeUso: 2027,
    fechaInicio: '2026-12-15',
  };
  assert.equal(asuntoPostergacion({ ...base, estadoTexto: '', acepto: true, diasAcumular: 10 }), 'Solicitud de feriado legal resuelta · XYZ789');

  // Aceptó: dice cuántos días acumula y para qué año.
  let c = cuerpoPostergacion({ ...base, estadoTexto: 'Postergación solicitada', acepto: true, diasAcumular: 10 });
  assert.match(c, /Acumula <strong>10 días<\/strong> de su feriado legal 2026/);
  assert.match(c, /para usarlos en 2027/);

  // Sin postergación o desistida: no hay días que acumular, así que no se menciona.
  for (const estado of ['Feriado autorizado', 'Desistida']) {
    c = cuerpoPostergacion({ ...base, estadoTexto: estado, acepto: false, diasAcumular: null });
    assert.match(c, new RegExp(estado));
    assert.ok(!/Acumulas/.test(c), `"${estado}" no debe anunciar días acumulados`);
  }
});

test('Avisos: los correos de "pendiente de firma" dicen a quién le toca y qué hacer', async () => {
  const a = await import('../src/lib/avisos.ts');

  // A la jefatura, por un permiso: tiene que aparecer el solicitante, el tipo y los días.
  const permiso = a.correoPermisoPendiente({
    codigo: 'ABC123',
    destinatarioNombre: 'Jefa De Prueba Mena',
    solicitanteNombre: 'Ana María Prueba Soto',
    jefaturaNombre: 'Jefa De Prueba Mena',
    enlace: 'https://ejemplo.cl/autorizaciones',
    tipo: 'goce',
    desde: '2026-12-02',
    hasta: '2026-12-03',
    totalDias: 1.5,
    horaDesde: null,
    horaHasta: null,
    detalle: null,
  });
  assert.equal(permiso.asunto, 'Permiso pendiente de su firma: Ana María Prueba Soto · Con Goce de Remuneraciones');
  assert.match(permiso.cuerpoHtml, /Estimado\/a Jefa De Prueba Mena/);
  assert.match(permiso.cuerpoHtml, /del 02-12-2026 al 03-12-2026/);
  assert.match(permiso.cuerpoHtml, /1,5 días/);
  assert.match(permiso.cuerpoHtml, /href="https:\/\/ejemplo\.cl\/autorizaciones"/);

  // Un permiso por horas no debe hablar de días.
  const porHoras = a.correoPermisoPendiente({
    codigo: 'ABC124',
    destinatarioNombre: 'Jefa De Prueba Mena',
    solicitanteNombre: 'Ana María Prueba Soto',
    jefaturaNombre: 'Jefa De Prueba Mena',
    enlace: 'https://ejemplo.cl/autorizaciones',
    tipo: 'compensatorio',
    desde: '2026-11-18',
    hasta: '2026-11-18',
    totalDias: 0,
    horaDesde: '14:00',
    horaHasta: '16:30',
    detalle: null,
  });
  assert.match(porHoras.cuerpoHtml, /de 14:00 a 16:30/);
  assert.ok(!/Días:/.test(porHoras.cuerpoHtml), 'un permiso por horas no lleva línea de días');

  // Al funcionario, cuando la jefatura propuso postergar: dice que falta su firma.
  const propuesta = a.correoPostergacionPropuesta({
    codigo: 'XYZ789',
    destinatarioNombre: 'Rodrigo Prueba Vera',
    solicitanteNombre: 'Rodrigo Prueba Vera',
    jefaturaNombre: 'Jefa De Prueba Mena',
    enlace: 'https://ejemplo.cl/mis-dias/postergacion',
    diasSolicitados: 12,
    fechaInicio: '2027-01-05',
    postergable: 12,
  });
  assert.match(propuesta.cuerpoHtml, /Estimado\/a Rodrigo Prueba Vera/);
  assert.match(propuesta.cuerpoHtml, /sección III/);
  assert.match(propuesta.cuerpoHtml, /acumular hasta 12 días/);

  // Solo los avisos de cierre llevan PDF y se archivan.
  assert.equal(a.esCierre('permiso.respondido'), true);
  assert.equal(a.esCierre('postergacion.cerrada'), true);
  for (const e of ['permiso.solicitado', 'postergacion.solicitada', 'postergacion.propuesta'] as const) {
    assert.equal(a.esCierre(e), false, `${e} no debe archivar ni adjuntar`);
  }
});

test('Avisos: el cierre de la postergación avisa que falta la resolución exenta', async () => {
  const { cuerpoPostergacion } = await import('../src/lib/avisos.ts');
  const base = {
    codigo: 'XYZ789',
    nombre: 'Ana María Prueba Soto',
    jefaturaNombre: 'Jefa De Prueba Mena',
    anio: 2026,
    anioDeUso: 2027,
    fechaInicio: '2026-12-15',
  };
  const c = cuerpoPostergacion({ ...base, estadoTexto: 'Postergación solicitada', acepto: true, diasAcumular: 10 });
  assert.match(c, /resolución exenta/);
  assert.match(c, /no se tramita en esta plataforma/);
  // Va después del cierre, para que no se lea contradictorio con "no hay que enviarlo".
  assert.ok(c.indexOf('resolución exenta') > c.indexOf('va adjunto'), 'la REX va al final');

  // Si no aceptó, no hay nada que oficializar.
  const d = cuerpoPostergacion({ ...base, estadoTexto: 'Feriado autorizado', acepto: false, diasAcumular: null });
  assert.ok(!/resolución exenta/.test(d));
});

test('Avisos: un solo nombre por tipo y un solo sustantivo por trámite', async () => {
  const a = await import('../src/lib/avisos.ts');

  // El nombre del tipo es el de la columna Tipo de la planilla, para que el correo y la base digan
  // lo mismo. Antes convivían tres grafías según el estado del trámite.
  assert.equal(a.tipoTexto('feriado'), 'Feriado Legal');
  assert.equal(a.tipoTexto('goce'), 'Con Goce de Remuneraciones');
  assert.equal(a.tipoTexto('compensatorio'), 'Descanso Complementario');
  // Estos dos no tienen fila en esas bases, así que usan el nombre de la pantalla.
  assert.equal(a.tipoTexto('interferiado'), 'Interferiado');
  assert.equal(a.tipoTexto('otros'), 'Otros Permisos');

  const comun = {
    codigo: 'ABC123',
    nombre: 'Ana María Prueba Soto',
    jefaturaNombre: 'Jefa De Prueba Mena',
    desde: '2026-06-30',
    hasta: '2026-07-03',
    totalDias: 4,
    horaDesde: null,
    horaHasta: null,
    recuperacion: null,
  };
  // El permiso se llama "Permiso" en los dos estados, con la misma grafía del tipo.
  const pendiente = a.correoPermisoPendiente({
    ...comun,
    destinatarioNombre: 'Jefa De Prueba Mena',
    solicitanteNombre: 'Ana María Prueba Soto',
    enlace: 'https://x.cl/autorizaciones',
    tipo: 'feriado',
    detalle: null,
  });
  assert.match(pendiente.asunto, /^Permiso pendiente de su firma: .+ · Feriado Legal$/);
  assert.match(a.asuntoPermiso({ ...comun, tipo: 'feriado', autorizado: true }), /^Permiso autorizado: Feriado Legal/);

  // La solicitud de feriado legal se llama igual en sus tres estados, así no cambia de nombre a
  // mitad de camino.
  const pend = a.correoPostergacionPendiente({
    codigo: 'XYZ789',
    destinatarioNombre: 'Jefa De Prueba Mena',
    solicitanteNombre: 'Carla Prueba Rojas',
    jefaturaNombre: 'Jefa De Prueba Mena',
    enlace: 'https://x.cl/autorizaciones',
    diasSolicitados: 10,
    fechaInicio: '2026-12-15',
  });
  const prop = a.correoPostergacionPropuesta({
    codigo: 'XYZ789',
    destinatarioNombre: 'Carla Prueba Rojas',
    solicitanteNombre: 'Carla Prueba Rojas',
    jefaturaNombre: 'Jefa De Prueba Mena',
    enlace: 'https://x.cl/mis-dias/postergacion',
    diasSolicitados: 10,
    fechaInicio: '2026-12-15',
    postergable: 10,
  });
  for (const asunto of [pend.asunto, prop.asunto, a.asuntoPostergacion({
    codigo: 'XYZ789',
    nombre: 'Carla Prueba Rojas',
    jefaturaNombre: 'Jefa De Prueba Mena',
    estadoTexto: 'Postergación solicitada',
    acepto: true,
    anio: 2026,
    anioDeUso: 2027,
    diasAcumular: 10,
    fechaInicio: '2026-12-15',
  })]) {
    assert.match(asunto, /^Solicitud de feriado legal/, `"${asunto}" debe nombrar el trámite igual`);
  }
});

test('Avisos: el rechazo deja claro que el camino sigue abierto', async () => {
  const { cuerpoPermiso } = await import('../src/lib/avisos.ts');
  const c = cuerpoPermiso({
    codigo: 'ABC123',
    tipo: 'goce',
    nombre: 'Ana María Prueba Soto',
    jefaturaNombre: 'Jefa De Prueba Mena',
    autorizado: false,
    desde: '2026-06-30',
    hasta: '2026-07-03',
    totalDias: 4,
    horaDesde: null,
    horaHasta: null,
    recuperacion: null,
  });
  assert.match(c, /Puede volver a solicitarlo/);
  assert.match(c, /no cierra el trámite/);
});

test('Avisos: la unidad va con su nombre completo', async () => {
  const { cuerpoPostergacion } = await import('../src/lib/avisos.ts');
  const c = cuerpoPostergacion({
    codigo: 'XYZ789',
    nombre: 'Ana María Prueba Soto',
    jefaturaNombre: 'Jefa De Prueba Mena',
    estadoTexto: 'Postergación solicitada',
    acepto: true,
    anio: 2026,
    anioDeUso: 2027,
    diasAcumular: 10,
    fechaInicio: '2026-12-15',
  });
  assert.match(c, /Subdirección de Gestión y Desarrollo de Personas/);
});

test('Avisos: todo el set trata de usted', async () => {
  const a = await import('../src/lib/avisos.ts');
  const comun = {
    codigo: 'ABC123',
    nombre: 'Ana María Prueba Soto',
    jefaturaNombre: 'Jefa De Prueba Mena',
    desde: '2026-12-02',
    hasta: '2026-12-02',
    totalDias: 1,
    horaDesde: null,
    horaHasta: null,
    recuperacion: null,
  };
  const textos = [
    a.cuerpoPermiso({ ...comun, tipo: 'goce', autorizado: true }),
    a.cuerpoPermiso({ ...comun, tipo: 'goce', autorizado: false }),
    a.correoPermisoPendiente({ ...comun, destinatarioNombre: 'J', solicitanteNombre: 'A', enlace: 'https://x.cl', tipo: 'goce', detalle: null }).cuerpoHtml,
    a.correoPostergacionPendiente({ codigo: 'X', destinatarioNombre: 'J', solicitanteNombre: 'A', jefaturaNombre: 'J', enlace: 'https://x.cl', diasSolicitados: 10, fechaInicio: '2026-12-15' }).cuerpoHtml,
    a.correoPostergacionPropuesta({ codigo: 'X', destinatarioNombre: 'A', solicitanteNombre: 'A', jefaturaNombre: 'J', enlace: 'https://x.cl', diasSolicitados: 10, fechaInicio: '2026-12-15', postergable: 10 }).cuerpoHtml,
    a.cuerpoPostergacion({ codigo: 'X', nombre: 'A', jefaturaNombre: 'J', estadoTexto: 'E', acepto: true, anio: 2026, anioDeUso: 2027, diasAcumular: 10, fechaInicio: '2026-12-15' }),
  ];
  // Las formas de tuteo que había antes en estos textos.
  const tuteo = /\b(Hola|puedes|tienes|firmes|acumulas|declaras|declaraste|conversa|Entra)\b|\btu\b|\btus\b/;
  for (const t of textos) {
    const m = t.match(tuteo);
    assert.equal(m, null, `quedó tuteo: "${m?.[0]}" en "${t.replace(/<[^>]+>/g, ' ').trim().slice(0, 90)}"`);
  }
});
