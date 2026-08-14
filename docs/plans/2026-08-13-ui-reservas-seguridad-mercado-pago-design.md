# Rediseño editorial, reservas seguras y Mercado Pago

**Fecha:** 13 de agosto de 2026

**Estado:** aprobado

**Producto:** La Ponderosa

## Contexto

La Ponderosa combina una portada comercial de una quinta de alquiler por día con un flujo de reserva y pago de una seña del 50 % mediante Mercado Pago. La versión actual tiene una identidad cálida válida, pero presenta inconsistencias visuales, problemas de contraste y una reserva extensa que expone todos los campos al mismo tiempo.

La revisión técnica encontró además riesgos altos de seguridad y dos fallas críticas de integridad del negocio: una acreditación demorada puede llegar después de liberar la fecha y un evento de pago fuera de orden puede degradar una reserva ya confirmada. El entorno local autentica correctamente contra Mercado Pago, pero no permite una prueba integral porque usa una URL local, no tiene secretos efectivos para webhook/cron y el proyecto de Supabase configurado no resuelve.

## Objetivos

- Construir una identidad editorial premium, elegante y natural, sin perder cercanía.
- Equilibrar presentación de marca y conversión a reserva.
- Convertir la reserva en un flujo guiado, predecible y accesible de tres pasos.
- Mantener precio, disponibilidad y condiciones visibles antes del pago.
- Corregir vulnerabilidades de dependencias y superficies públicas de abuso.
- Garantizar que una reserva confirmada no se libere por eventos tardíos o fuera de orden.
- Hacer verificable la relación entre reserva, preferencia, orden y pago de Mercado Pago.
- Incorporar una base mínima de pruebas automáticas y una validación visual reproducible.

## Fuera de alcance

- No se inventarán fotografías, reseñas ni comodidades que no pertenezcan a la quinta.
- No se construirá un panel administrativo completo en esta etapa.
- No se capturarán datos de tarjeta dentro del sitio: el cobro continuará en Checkout Pro.
- No se ejecutarán pagos reales durante las pruebas.
- No se cambiarán precio, porcentaje de seña, capacidad ni horarios sin una decisión comercial explícita.

## Enfoques considerados

### 1. Editorial premium con conversión guiada — seleccionado

Una portada inmersiva conduce a una reserva de tres pasos integrada en la misma página. Mantiene la historia de marca y reduce la carga cognitiva sin agregar una navegación obligatoria.

### 2. Portada cinematográfica y reserva independiente

Ofrece una portada más limpia, pero agrega un salto antes de la acción principal y aumenta el riesgo de abandono.

### 3. Reserva primero

Coloca disponibilidad y calendario en el hero. Puede mejorar conversiones de usuarios decididos, pero debilita la percepción premium y la comprensión del lugar.

## Dirección visual

- Paleta de marfil, verde bosque, terracota apagada, arena y carbón.
- DM Serif Display para titulares y Source Sans 3 para lectura e interfaz.
- Escala tipográfica fluida y titulares de ancho controlado, evitando desbordes en tablet.
- Bordes contenidos, sombras de baja opacidad y superficies con contraste claro.
- Fotografía real con encuadres amplios y overlays diseñados para legibilidad.
- Animaciones breves, funcionales y desactivables con `prefers-reduced-motion`.
- Lenguaje directo, argentino y específico: quinta por el día, pileta, quincho, capacidad, horario y seña.

El concepto principal propuesto para el hero es: **“Un día lejos del ruido, más cerca de los tuyos”**. La bajada explicará el alquiler por día y la capacidad sin promesas genéricas. El CTA principal será **“Ver disponibilidad”** y el secundario **“Recorrer la quinta”**.

## Arquitectura de la portada

1. **Navegación:** barra flotante que se solidifica al desplazarse, enlaces semánticos y CTA persistente.
2. **Hero:** fotografía principal, ubicación, propuesta de valor, acciones y hechos clave.
3. **Franja de confianza:** pileta, quincho, hasta 30 personas, horario y precio desde la fuente compartida.
4. **Experiencia:** relato editorial y servicios agrupados por uso, no como una grilla genérica de íconos.
5. **Galería:** composición asimétrica con visor accesible, teclado y textos alternativos útiles.
6. **Reserva:** recorrido de tres pasos con resumen persistente.
7. **Ubicación:** información de acceso y mapa cargado de forma diferida.
8. **Preguntas frecuentes:** seña, saldo, medios de pago, cancelaciones, horarios y capacidad.
9. **Contacto y footer:** vías reales de contacto, redes válidas y políticas.

Los testimonios permanecerán fuera de la interfaz hasta contar con reseñas auténticas y verificables.

## Reserva guiada

### Paso 1: fecha

- Mostrar disponibilidad, leyenda, precio y restricciones.
- Permitir navegación por teclado y anunciar la selección a tecnologías de asistencia.
- Ofrecer reintento si falla la consulta; nunca presentar un calendario vacío como si estuviera libre.
- Limitar el horizonte de reserva a un período comercial configurable.

### Paso 2: encuentro y contacto

- Solicitar nombre, email, teléfono, cantidad de personas y comentarios opcionales.
- Conservar valores al navegar entre pasos.
- Compartir reglas de validación entre cliente y servidor para evitar divergencias.
- Asociar errores al campo y mostrar un resumen accesible cuando corresponda.

### Paso 3: revisión y pago

- Presentar fecha, cantidad de personas, precio total, seña y saldo pendiente.
- Explicar que el sitio redirige a Mercado Pago y que la reserva solo queda confirmada al acreditarse.
- Exigir aceptación explícita de términos y política de cancelación mediante enlaces reales.
- Usar una clave de solicitud idempotente para poder reanudar la misma preferencia ante reintentos.

En escritorio, el flujo ocupará dos columnas con resumen fijo. En móvil será lineal y tendrá un CTA inferior persistente que no tape contenido ni mensajes.

## Estados posteriores al checkout

- **Confirmando:** consultar de forma acotada el estado real mientras el webhook termina de procesar.
- **Confirmada:** mostrar referencia, fecha y próximos pasos sin exponer datos personales mediante un identificador reutilizable.
- **Pendiente:** explicar el estado permitido por la política de medios de pago y su vencimiento real.
- **Rechazada:** permitir reintentar sin crear holds duplicados.
- **Expirada o con conflicto:** ofrecer una salida segura y contacto asistido; nunca prometer una fecha que ya fue reasignada.

Todas las páginas compartirán la identidad visual de la portada y mensajes accionables.

## Arquitectura técnica de interfaz

- La página y las secciones estáticas serán Server Components.
- Se limitarán los Client Components al menú interactivo, visor de galería y flujo de reserva.
- Los datos comerciales vivirán en una fuente compartida y tipada.
- Las variantes visuales reutilizarán primitivas pequeñas: botón, encabezado de sección, superficie, dato destacado y mensaje de estado.
- El CSS global conservará tokens y estilos base; los componentes evitarán depender de colisiones entre clases genéricas y utilidades.
- El mapa y contenido no crítico se cargarán después de la interacción o al acercarse al viewport.

## Modelo y reglas de reservas

La base tendrá migraciones versionadas. Como mínimo se garantizarán:

- Índice único parcial para una sola reserva activa por fecha.
- `hold_expires_at` explícito en lugar de inferir siempre desde `creado_en`.
- Identificador idempotente de solicitud de reserva.
- Estados de reserva y pago separados cuando sea necesario.
- Registro durable de eventos de Mercado Pago con identificador único.
- Transición atómica y monotónica de estados.
- Registro de entrega de notificaciones para evitar emails duplicados.

Una reserva confirmada no puede volver a pendiente o cancelada por un intento rechazado diferente. Reembolsos y contracargos se modelarán de forma explícita y vinculada al pago confirmado.

## Mercado Pago

- Checkout Pro continuará creando la preferencia exclusivamente en el servidor.
- El servidor recalculará el monto y validará fecha, cantidad y disponibilidad.
- La preferencia incluirá referencia externa, metadatos, vencimiento coherente, URLs HTTPS e idempotencia.
- Si se mantiene un hold de 30 minutos, se excluirán medios offline o de acreditación incompatible con ese plazo.
- Antes de confirmar se validarán pago aprobado, moneda ARS, monto esperado, preferencia, vendedor y entorno.
- Las notificaciones usarán Webhooks, no una mezcla ambigua con IPN.
- El secreto será obligatorio en entornos desplegados y la firma se verificará contra el mismo identificador que se procesa, con tolerancia temporal.
- Los eventos duplicados o fuera de orden serán inocuos.
- Un trabajo de reconciliación consultará Mercado Pago antes de liberar pendientes vencidas y resolverá webhooks perdidos.
- La respuesta al webhook será rápida; emails y otros efectos secundarios se ejecutarán de forma durable e idempotente.

## Seguridad

- Actualizar Next.js y dependencias con vulnerabilidades conocidas.
- Agregar rate limiting distribuido y protección antibot en la creación de reservas.
- Limitar reservas pendientes por actor y el horizonte máximo permitido.
- Hacer que webhook y cron fallen cerrados cuando falten secretos en entornos desplegados.
- Escapar valores del cliente antes de interpolarlos en emails HTML.
- Validar fechas por round-trip de calendario y zona horaria de negocio.
- Incorporar encabezados de seguridad y una política de contenido compatible con Mercado Pago, mapas y recursos usados.
- Evitar respuestas con datos personales y registrar errores sin secretos ni PII innecesaria.

## Errores y degradación

- Una falla de disponibilidad mostrará un estado de error con reintento; no asumirá que todas las fechas están libres.
- Una falla al crear la preferencia liberará o invalidará el hold de forma consistente.
- Si la preferencia fue creada pero falló la respuesta, el mismo identificador recuperará su URL en vez de crear otra.
- Los conflictos de fecha devolverán una respuesta estable y harán volver al primer paso con información actualizada.
- Los fallos de email no revertirán un pago, pero quedarán registrados para reintento.
- Los errores externos tendrán límites de tiempo y no filtrarán detalles internos al navegador.

## Accesibilidad y rendimiento

- Objetivo WCAG 2.2 AA para contraste, foco, nombres accesibles y navegación.
- Controles táctiles de al menos 44 por 44 píxeles.
- Calendario usable sin mouse y estados distinguibles por texto, no solo color.
- Regiones vivas para disponibilidad, selección, validación y redirección.
- Imágenes con tamaños correctos, prioridad solo para el hero y ausencia de layout shift perceptible.
- No se incorporarán carruseles o bibliotecas grandes si CSS y componentes nativos resuelven el caso.

## Pruebas

### Automatizadas

- Validaciones de fecha, horizonte y campos.
- Creación idempotente de reserva y preferencia.
- Carrera de dos reservas para la misma fecha.
- Firma válida, inválida, vencida y discrepancia entre identificadores.
- Pago insuficiente, moneda o preferencia incorrecta.
- Eventos duplicados, concurrentes y fuera de orden.
- Pago aprobado seguido por intento rechazado.
- Aprobación tardía, reconciliación y expiración.
- Fallos y timeouts de Mercado Pago, Supabase y correo.

### Visuales y de interacción

- Anchos de 360, 768, 1024 y 1440 píxeles.
- Navegación por teclado, lector de pantalla básico y reducción de movimiento.
- Ausencia de overflow horizontal, solapamientos y texto ilegible sobre imágenes.
- Auditorías de accesibilidad y métricas web sobre el build de producción.

### Mercado Pago

- Staging HTTPS con base y credenciales de prueba aisladas.
- Comprador de prueba distinto del vendedor.
- Escenarios aprobado, rechazado, pendiente, duplicado, reembolso y notificación demorada.
- Verificación de una sola transición, un solo email y correspondencia completa entre reserva, preferencia, orden y pago.

## Criterios de aceptación

- La portada transmite una identidad editorial coherente y mantiene precio y CTA visibles.
- El flujo completo se puede finalizar por teclado y en móvil sin perder datos.
- No quedan vulnerabilidades altas de producción con corrección disponible sin una justificación documentada.
- Ningún evento rechazado puede cancelar una reserva confirmada por otro pago.
- Una acreditación tardía no produce silenciosamente un cliente cobrado sin fecha.
- La base garantiza una sola reserva activa por fecha mediante una migración versionada.
- Webhook y cron rechazan solicitudes no autenticadas en entornos desplegados.
- Lint, tipos, build y pruebas pasan.
- El flujo sandbox de Mercado Pago funciona en staging HTTPS antes de habilitar producción.

## Despliegue

1. Crear y verificar migraciones en una base de staging.
2. Configurar URL pública HTTPS, secretos, credenciales de prueba y webhook.
3. Ejecutar regresión automática y revisión visual.
4. Completar la matriz sandbox de Mercado Pago.
5. Aplicar migraciones de producción con respaldo y verificación del índice.
6. Desplegar la aplicación y observar reservas, webhooks, errores y reconciliación.
