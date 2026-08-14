# Plan de implementación: pulido final de UI

## Resultado esperado

Entregar una landing más compacta y consistente en la que el footer, la navegación por anclas, la grilla de servicios, la cronología del hero, el visor de galería y el botón de WhatsApp funcionen correctamente en escritorio y móvil.

## Fase 1: navegación y estructura

1. Mover los IDs navegables al inicio visual del contenido de cada sección.
2. Eliminar el `scroll-margin-top` duplicado y conservar un único offset global para la cabecera fija.
3. Cambiar los enlaces internos del footer a anclas nativas.
4. Convertir la dirección del footer en un enlace de Google Maps.
5. Verificar navegación inicial, repetición del mismo hash y atrás/adelante.

Archivos principales:

- `src/components/sections/Jornada.tsx`
- `src/components/sections/Servicios.tsx`
- `src/components/sections/Galeria.tsx`
- `src/components/sections/reservas/index.tsx`
- `src/components/sections/Ubicacion.tsx`
- `src/components/sections/Footer.tsx`
- `src/app/globals.css`

## Fase 2: hero y servicios

1. Crear `hero__meta` y mover allí datos principales y `Dayline`.
2. Retirar el posicionamiento absoluto de la cronología.
3. Definir dos columnas en escritorio y apilado en móvil.
4. Ajustar padding del hero para vistas panorámicas bajas.
5. Cambiar las tarjetas regulares de servicios a cuatro columnas en escritorio.
6. Mantener dos columnas en tablet y una en móvil.

Archivos principales:

- `src/components/sections/Hero.tsx`
- `src/components/sections/Servicios.tsx`
- `src/app/globals.css`

## Fase 3: galería y WhatsApp

1. Quitar la observación redundante del visor.
2. Detectar un click/tap real de backdrop mediante inicio y fin del puntero fuera del diálogo.
3. Mantener X, Escape, flechas, foco inicial y restauración de foco.
4. Recuperar el botón circular verde con glifo oficial y pulso sutil.
5. Mantener listener de scroll pasivo y el botón fuera del tab order cuando está oculto.
6. Normalizar el teléfono en el generador compartido de URLs de WhatsApp.

Archivos principales:

- `src/components/sections/Galeria.tsx`
- `src/components/layout/WhatsAppButton.tsx`
- `src/lib/utils.ts`
- `src/app/globals.css`

## Fase 4: footer compacto

1. Eliminar el bloque `footer__lead`.
2. Reducir padding, separaciones y altura total sin achicar objetivos táctiles.
3. Mantener tres columnas en escritorio y una composición responsiva en tablet/móvil.
4. Confirmar que WhatsApp no cubra enlaces al llegar al final de la página.

Archivos principales:

- `src/components/sections/Footer.tsx`
- `src/app/globals.css`

## Fase 5: verificación

1. Ejecutar `git diff --check`, ESLint, TypeScript y Vitest.
2. Ejecutar build de producción con webpack.
3. Revisar 1440×900, una vista panorámica baja, 768×1024, 390×844 y 360×640.
4. Probar todos los enlaces del footer.
5. Probar X, Escape, backdrop, flechas y restauración de foco en galería.
6. Medir que los hashes dejen el contenido debajo de la cabecera fija.
7. Confirmar que no haya overflow horizontal ni errores de consola.

## Orden de commits sugerido

1. `docs: planificar pulido final de ui`
2. `fix: pulir navegación y componentes visuales`

## Condiciones de cierre

- Footer notablemente más compacto que la versión observada.
- Todos los destinos internos, externos y legales son accionables.
- La cronología se mantiene visible junto a los datos del hero.
- Servicios no deja una tarjeta huérfana.
- El visor cierra sólo mediante acciones intencionales.
- WhatsApp recupera el círculo verde sin tooltip automático.
- Checks automáticos y QA responsivo aprobados.
