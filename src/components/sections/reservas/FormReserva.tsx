'use client';

import { PRECIOS } from '@/lib/constants';
import { formatearPrecio } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, CreditCard, Loader2, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const esquemaReserva = z.object({
  nombreCompleto: z.string().trim().min(3, 'Ingresá tu nombre completo').max(100, 'El nombre es muy largo'),
  email: z.string().trim().email('Ingresá un email válido').max(254, 'El email es muy largo'),
  telefono: z.string().trim().min(8, 'Ingresá un teléfono válido').max(20, 'El teléfono es muy largo'),
  cantidadPersonas: z
    .number({ invalid_type_error: 'Ingresá la cantidad de personas' })
    .int('Usá un número entero')
    .min(1, 'Mínimo 1 persona')
    .max(PRECIOS.maximoPersonas, `Máximo ${PRECIOS.maximoPersonas} personas`),
  comentarios: z.string().trim().max(500, 'Usá hasta 500 caracteres').optional(),
  aceptarTerminos: z.boolean().refine(Boolean, 'Necesitamos que aceptes los términos para continuar'),
  honeypot: z.string().max(0, 'No se pudo validar el formulario').optional(),
});

export type DatosReserva = z.infer<typeof esquemaReserva>;

interface FormReservaProps {
  activeStep: 2 | 3;
  fechaLabel: string;
  isLoading?: boolean;
  onBack: () => void;
  onReview: () => void;
  onSubmit: (datos: DatosReserva) => void | Promise<void>;
}

const CAMPOS_CONTACTO: Array<keyof DatosReserva> = [
  'nombreCompleto',
  'email',
  'telefono',
  'cantidadPersonas',
  'comentarios',
];

export function FormReserva({
  activeStep,
  fechaLabel,
  isLoading = false,
  onBack,
  onReview,
  onSubmit,
}: FormReservaProps) {
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<DatosReserva>({
    resolver: zodResolver(esquemaReserva),
    defaultValues: {
      nombreCompleto: '',
      email: '',
      telefono: '',
      cantidadPersonas: 10,
      comentarios: '',
      aceptarTerminos: false,
      honeypot: '',
    },
    mode: 'onTouched',
  });

  const datos = getValues();

  const continuarAlResumen = async () => {
    const esValido = await trigger(CAMPOS_CONTACTO, { shouldFocus: true });
    if (esValido) {
      onReview();
    }
  };

  return (
    <form className="booking-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="honeypot-field" aria-hidden="true">
        <label htmlFor="booking-website">Sitio web</label>
        <input
          id="booking-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register('honeypot')}
        />
      </div>

      <section className="booking-panel" hidden={activeStep !== 2} aria-labelledby="booking-contact-title">
        <div className="booking-panel__heading">
          <p>Paso 2 de 3</p>
          <h3 id="booking-contact-title" tabIndex={-1}>Contanos quién organiza</h3>
          <span>Usamos estos datos para enviarte la confirmación y coordinar la llegada.</span>
        </div>

        <div className="field-grid">
          <Field label="Nombre y apellido" error={errors.nombreCompleto?.message} inputId="nombreCompleto" wide>
            <input
              id="nombreCompleto"
              type="text"
              autoComplete="name"
              placeholder="Por ejemplo, Ana Pérez"
              aria-invalid={Boolean(errors.nombreCompleto)}
              aria-describedby={errors.nombreCompleto ? 'nombreCompleto-error' : undefined}
              {...register('nombreCompleto')}
            />
          </Field>

          <Field label="Email" error={errors.email?.message} inputId="email">
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ana@email.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : 'email-help'}
              {...register('email')}
            />
            <span className="field-help" id="email-help">Ahí llegará el comprobante.</span>
          </Field>

          <Field label="Teléfono / WhatsApp" error={errors.telefono?.message} inputId="telefono">
            <input
              id="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="11 1234 5678"
              aria-invalid={Boolean(errors.telefono)}
              aria-describedby={errors.telefono ? 'telefono-error' : undefined}
              {...register('telefono')}
            />
          </Field>

          <Field label="Cantidad de personas" error={errors.cantidadPersonas?.message} inputId="cantidadPersonas">
            <input
              id="cantidadPersonas"
              type="number"
              inputMode="numeric"
              min={1}
              max={PRECIOS.maximoPersonas}
              aria-invalid={Boolean(errors.cantidadPersonas)}
              aria-describedby={errors.cantidadPersonas ? 'cantidadPersonas-error' : 'cantidadPersonas-help'}
              {...register('cantidadPersonas', { valueAsNumber: true })}
            />
            <span className="field-help" id="cantidadPersonas-help">Máximo {PRECIOS.maximoPersonas}.</span>
          </Field>

          <Field label="Algo que debamos saber (opcional)" error={errors.comentarios?.message} inputId="comentarios" wide>
            <textarea
              id="comentarios"
              rows={4}
              placeholder="Contanos el tipo de encuentro o cualquier necesidad particular."
              aria-invalid={Boolean(errors.comentarios)}
              aria-describedby={errors.comentarios ? 'comentarios-error' : undefined}
              {...register('comentarios')}
            />
          </Field>
        </div>

        <div className="booking-panel__actions">
          <button type="button" className="button button--quiet" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            Cambiar fecha
          </button>
          <button type="button" className="button button--primary" onClick={continuarAlResumen}>
            Revisar reserva
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="booking-panel" hidden={activeStep !== 3} aria-labelledby="booking-review-title">
        <div className="booking-panel__heading">
          <p>Paso 3 de 3</p>
          <h3 id="booking-review-title" tabIndex={-1}>Revisá antes de pagar</h3>
          <span>Mercado Pago cobrará únicamente la seña indicada.</span>
        </div>

        <div className="booking-review">
          <dl className="booking-review__details">
            <div><dt>Fecha</dt><dd className="capitalize">{fechaLabel}</dd></div>
            <div><dt>A nombre de</dt><dd>{datos.nombreCompleto || '—'}</dd></div>
            <div><dt>Personas</dt><dd>{datos.cantidadPersonas}</dd></div>
            <div><dt>Email</dt><dd>{datos.email || '—'}</dd></div>
          </dl>

          <div className="booking-review__price">
            <div><span>Valor de la jornada</span><strong>{formatearPrecio(PRECIOS.porDia)}</strong></div>
            <div><span>Seña ahora ({PRECIOS.porcentajeSena * 100}%)</span><strong>{formatearPrecio(PRECIOS.sena)}</strong></div>
            <div><span>Resto en el lugar</span><strong>{formatearPrecio(PRECIOS.porDia - PRECIOS.sena)}</strong></div>
          </div>
        </div>

        <label className={`terms-check${errors.aceptarTerminos ? ' terms-check--error' : ''}`}>
          <input type="checkbox" aria-describedby={errors.aceptarTerminos ? 'aceptarTerminos-error' : undefined} {...register('aceptarTerminos')} />
          <span className="terms-check__box" aria-hidden="true"><Check /></span>
          <span>
            Leí y acepto los{' '}
            <Link href="/terminos" target="_blank" rel="noopener noreferrer">términos de reserva</Link>{' '}
            y la <Link href="/privacidad" target="_blank" rel="noopener noreferrer">política de privacidad</Link>.
          </span>
        </label>
        {errors.aceptarTerminos ? (
          <p className="field-error" id="aceptarTerminos-error" role="alert">{errors.aceptarTerminos.message}</p>
        ) : null}

        <div className="payment-assurance">
          <LockKeyhole aria-hidden="true" />
          <p><strong>Pago gestionado por Mercado Pago</strong><span>No ingresás datos de tarjeta en este sitio.</span></p>
        </div>

        <div className="booking-panel__actions">
          <button type="button" className="button button--quiet" onClick={onBack} disabled={isLoading}>
            <ArrowLeft aria-hidden="true" />
            Editar datos
          </button>
          <button type="submit" className="button button--mercadopago" disabled={isLoading}>
            {isLoading ? <Loader2 className="spin" aria-hidden="true" /> : <CreditCard aria-hidden="true" />}
            {isLoading ? 'Preparando pago…' : `Pagar seña de ${formatearPrecio(PRECIOS.sena)}`}
          </button>
        </div>
      </section>
    </form>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  inputId: string;
  wide?: boolean;
  children: React.ReactNode;
}

function Field({ label, error, inputId, wide = false, children }: FieldProps) {
  return (
    <div className={`field${wide ? ' field--wide' : ''}`}>
      <label htmlFor={inputId}>{label}</label>
      {children}
      {error ? <p className="field-error" id={`${inputId}-error`} role="alert">{error}</p> : null}
    </div>
  );
}
