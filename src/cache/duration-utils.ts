import type { Duration } from './cache-interfaces.js';

/**
 * Multiplicadores para converter unidades de tempo em milissegundos
 */
const DURATION_MULTIPLIERS = {
  s: 1000,        // segundos
  m: 60000,       // minutos
  h: 3600000,     // horas
  d: 86400000,    // dias
  w: 604800000,   // semanas
} as const;

/**
 * Parse de duração human-readable para milissegundos
 * @param duration - Número (ms) ou string no formato '30s', '10m', '2h', '1d', '1w'
 * @returns Tempo em milissegundos
 * @throws Error se o formato for inválido
 * 
 * @example
 * parseDuration(60000) // 60000
 * parseDuration('30s') // 30000
 * parseDuration('10m') // 600000
 * parseDuration('2h')  // 7200000
 * parseDuration('1d')  // 86400000
 * parseDuration('1w')  // 604800000
 */
export function parseDuration(duration: Duration): number {
  // Se já é número, retorna diretamente
  if (typeof duration === 'number') {
    return duration;
  }

  // Regex para extrair número e unidade
  const match = duration.match(/^(\d+)([smhdw])$/);
  
  if (!match) {
    throw new Error(
      `Invalid duration format: "${duration}". ` +
      `Use formats like '30s', '10m', '2h', '1d', '1w' or a number in milliseconds.`
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2] as keyof typeof DURATION_MULTIPLIERS;
  
  return value * DURATION_MULTIPLIERS[unit];
}

/**
 * Converte milissegundos para formato human-readable
 * @param ms - Tempo em milissegundos
 * @returns String no formato mais apropriado
 * 
 * @example
 * formatDuration(30000)  // '30s'
 * formatDuration(600000) // '10m'
 * formatDuration(7200000) // '2h'
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h`;
  if (ms < 604800000) return `${Math.floor(ms / 86400000)}d`;
  return `${Math.floor(ms / 604800000)}w`;
}

/**
 * Valida se uma string é uma duração válida
 * @param value - Valor a ser validado
 * @returns true se for uma duração válida
 */
export function isValidDuration(value: unknown): value is Duration {
  if (typeof value === 'number') {
    return value >= 0;
  }
  if (typeof value === 'string') {
    return /^\d+[smhdw]$/.test(value);
  }
  return false;
}
