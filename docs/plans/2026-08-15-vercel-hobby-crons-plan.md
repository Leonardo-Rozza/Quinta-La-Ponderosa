# Plan de implementación: Vercel Hobby sin cron jobs

## Objetivo

Permitir el deploy demostrativo en Vercel Hobby y dejar la programación Pro lista
para restaurar sin modificar los workers.

## Pasos

1. Reemplazar el contenido activo de `vercel.json` por un objeto válido con sólo
   el schema oficial de Vercel.
2. Crear `vercel.pro.json.example` con los jobs originales de cinco y quince
   minutos.
3. Actualizar README y `.env.example` para reflejar que los schedules están
   pausados, explicar su impacto y documentar la restauración al pasar a Pro.
4. Validar ambos JSON y comprobar que las rutas de la plantilla corresponden a
   Route Handlers existentes.
5. Ejecutar lint, typecheck, tests, build y `git diff --check`.
6. Revisar y registrar únicamente los archivos de este cambio.
