# Mis días · SLEP Aconcagua

Plataforma para que cada funcionario del Servicio Local de Educación Pública Aconcagua consulte sus
**días administrativos**, su **feriado legal** y sus **descansos complementarios**: saldo, historial de
solicitudes con fechas y calendario. Solo consulta: nadie puede modificar datos desde la plataforma,
salvo la administración al subir los Excel.

La identidad visual sigue el UI Kit v3.0.1 del Kit Digital del Gobierno de Chile (colores, tipografía
Roboto / Roboto Slab, botones, alertas, tablas) con los logos del SLEP Aconcagua.

## Cómo se usa día a día (Administración de Personas)

1. Entrar con `administracion.personas@slepaconcagua.gob.cl`.
2. Ir a **Cargar datos** y subir el Excel actualizado (días, descansos o dotación). Se publica de inmediato.
3. Revisar **Alertas**: la plataforma revisa cada archivo y avisa de solicitudes repetidas, RUT mal
   escritos, descuadres entre hojas, saldos negativos, fechas raras y personas sin correo. Cada alerta
   indica la hoja y la fila del Excel. Se pueden descargar en Excel.
4. Si se subió un archivo equivocado: en **Cargar datos → Historial** se puede volver a una versión anterior.

En **Funcionarios** se ve a cada persona tal como ella ve su información, y se puede restablecer su
contraseña, desbloquearla, deshabilitar la cuenta o cambiar su correo de ingreso.

## Reglas de cálculo

- **Saldo = saldo inicial − solicitudes del detalle**, contando una sola vez las solicitudes repetidas
  (misma persona, tipo, fecha de inicio y cantidad).
- Días administrativos: saldo inicial de la hoja SALDOS. Feriado legal: días acumulados del año anterior
  + días de anualidad. Descanso complementario: horas reconocidas (resoluciones REX y meses) − horas usadas.
- Las solicitudes se asignan a la persona por el **número de RUT** (sin dígito verificador), así un dígito
  mal escrito no deja una solicitud fuera. Igual se avisa para corregir el Excel.
- Los días se reparten en días hábiles (lunes a viernes, sin feriados) para el calendario.
- Solo se leen las hojas necesarias; las hojas ocultas y el archivo original no se guardan.

## Ingreso de funcionarios

- Correo: el de la Dotación (si la Dotación trae una columna `CORREO PERSONAL`, se usa ese y también se
  acepta el institucional). La administración puede fijar otro correo a mano.
- Contraseña inicial: los **cuatro primeros dígitos del RUT**, sin puntos. En el primer ingreso se
  obliga a crear una contraseña nueva (mínimo 8 caracteres, con letras y números, sin el RUT).
- Seguridad: bloqueo de 15 minutos tras 5 intentos fallidos; contraseñas guardadas cifradas (scrypt);
  sesión de 8 horas en cookie segura; registro de actividad.

## Puesta en marcha en Vercel (una vez)

1. Proyecto conectado a este repositorio, en el equipo `gestion-de-personas`.
2. **Storage → Create Database → Neon** y conectarla al proyecto (agrega `DATABASE_URL`).
3. **Settings → Environment Variables**: crear `ADMIN_INITIAL_PASSWORD` (mínimo 8 caracteres) para
   producción. Es la contraseña del primer ingreso de la administración; al entrar se pide cambiarla.
4. Volver a desplegar. Las tablas se crean solas.

## Desarrollo local

```bash
npm install
node --experimental-strip-types scripts/crear-datos-prueba.ts   # Excel ficticios en .datos-prueba/
npm run dev                                                     # usa PGlite local si no hay DATABASE_URL
npm test
```

`scripts/verificar-excel.ts` lee Excel reales con los mismos lectores y muestra solo totales.

**Nunca subir Excel con datos reales al repositorio** (`.gitignore` excluye `*.xlsx`).

## Mantención anual

Agregar los feriados del nuevo año en `src/lib/fechas.ts` (constante `FERIADOS`).
