# Deploy demostrativo en Vercel Hobby sin cron jobs

## Contexto

El proyecto programa dos workers desde `vercel.json`: procesamiento de eventos y
emails cada cinco minutos, y conciliación de reservas cada quince. Vercel Hobby
rechaza durante el deploy cualquier cron con una frecuencia mayor a una ejecución
diaria.

El deploy temporal será únicamente demostrativo: no aceptará reservas ni pagos
reales mientras los workers estén pausados.

## Diseño aprobado

- Mantener `vercel.json` válido y sin la propiedad `crons` para que Hobby pueda
  desplegar el proyecto.
- Bloquear server-side la creación de reservas, checkouts y enlaces de reintento
  en todo deploy salvo que `RESERVAS_ONLINE_ENABLED=true`; desarrollo local queda
  habilitado para QA.
- Mostrar en la UI el modo demostrativo y ofrecer consulta por WhatsApp sin
  ocultar la disponibilidad.
- Conservar los dos endpoints, su lógica y la autenticación mediante
  `CRON_SECRET` sin cambios.
- Guardar la configuración exacta de producción en
  `vercel.pro.json.example`, un nombre que Vercel no interpreta automáticamente.
- Documentar el estado temporal, el impacto operativo y el comando para restaurar
  la configuración Pro.
- No reemplazar los workers por schedules diarios: esa frecuencia demoraría
  reintentos, emails y liberación de holds de una forma incompatible con el flujo.

## Restauración al contratar Pro

1. Configurar `CRON_SECRET` y el resto de variables productivas, manteniendo
   `RESERVAS_ONLINE_ENABLED=false`.
2. Copiar `vercel.pro.json.example` sobre `vercel.json` y redesplegar.
3. Comprobar ambos jobs en el panel de Vercel y ejecutar el checklist completo.
4. Establecer `RESERVAS_ONLINE_ENABLED=true` y hacer un segundo deploy.

## Impacto temporal

Sin scheduler no se envían automáticamente los emails encolados, no se reintentan
eventos fallidos y no se concilian/liberan holds vencidos. Los datos permanecen
durables y los endpoints pueden ejecutarse manualmente con un Bearer válido, pero
el guard server-side impide que el sitio acepte operaciones reales en este estado.

## Validación

- Parsear `vercel.json` y `vercel.pro.json.example` como JSON estricto.
- Confirmar que el archivo activo no contiene `crons` y la plantilla conserva
  exactamente las rutas y frecuencias originales.
- Probar que el flag falla cerrado en deploy y sólo se habilita de forma explícita.
- Ejecutar lint, typecheck, tests, build y `git diff --check`.
