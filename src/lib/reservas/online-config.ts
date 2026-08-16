import 'server-only';

interface ReservasRuntimeEnvironment {
  NODE_ENV?: string;
  RESERVAS_ONLINE_ENABLED?: string;
  VERCEL?: string;
}

/**
 * Los deploys fallan cerrados salvo habilitacion explicita. En desarrollo local
 * se mantiene el flujo activo para poder probar la integracion completa.
 */
export function reservasOnlineHabilitadas(
  environment: ReservasRuntimeEnvironment = process.env,
) {
  const configured = environment.RESERVAS_ONLINE_ENABLED?.trim().toLowerCase();

  if (configured !== undefined) return configured === 'true';

  return environment.VERCEL !== '1' && environment.NODE_ENV !== 'production';
}
