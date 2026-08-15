# Centrado del visor de galería

## Problema

Tailwind Preflight aplica `margin: 0` de forma global y pisa el `margin: auto`
del estilo nativo de `<dialog>`. El visor conserva su ancho y alto limitados, pero
queda anclado al borde superior izquierdo cuando se abre con `showModal()`.

## Diseño aprobado

- Conservar las dimensiones actuales del visor en escritorio y móvil.
- Centrar el `<dialog>` de forma explícita en ambos ejes con
  `position: fixed`, `inset: 0` y `margin: auto`.
- Mantener backdrop visible y parejo alrededor.
- No modificar la estructura React ni la lógica de apertura y cierre.
- Preservar cierre con X, Escape y puntero fuera; foco inicial, navegación por
  teclado y retorno del foco a la miniatura.

## Alternativas descartadas

- Restaurar sólo `margin: auto`: corrige el navegador actual, pero todavía
  depende del posicionamiento del stylesheet del user agent.
- Usar `top/left: 50%` y `transform`: agrega geometría innecesaria y complica
  futuras animaciones o ajustes de zoom.
- Hacer el `<dialog>` de pantalla completa y centrar un panel interior: el rect
  del diálogo abarcaría todo el viewport y rompería el cierre por backdrop
  existente.

## Validación

- Verificar geométricamente que los márgenes izquierdo/derecho y superior/inferior
  sean equivalentes dentro de una tolerancia de un píxel.
- Probar escritorio y viewport móvil.
- Confirmar que clic interior no cierre y clic exterior, X y Escape sí cierren.
- Confirmar foco inicial en Cerrar, confinamiento de Tab y retorno a la miniatura.
- Ejecutar lint, typecheck, tests, build y `git diff --check`.
