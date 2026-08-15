# Plan de implementación: centrado del visor de galería

## Objetivo

Centrar el `<dialog>` de la galería en ambos ejes sin cambiar su tamaño ni sus
interacciones accesibles.

## Pasos

1. En `src/app/globals.css`, hacer explícita la geometría de `.gallery-viewer`
   con `position: fixed`, `inset: 0` y `margin: auto`.
2. Confirmar que los breakpoints sólo modifiquen ancho y alto, manteniendo el
   centrado base.
3. Ejecutar `git diff --check`, lint, typecheck, tests y build de producción.
4. Abrir el visor en escritorio y móvil; medir sus cuatro márgenes y probar X,
   Escape, clic interior/exterior, Tab y retorno de foco.
5. Revisar el diff final y registrar sólo los archivos de esta corrección.
