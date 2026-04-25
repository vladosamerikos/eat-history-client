import { z } from 'zod';
import i18n from '@/i18n';

/**
 * Devuelve un mensaje traducido para errores de zod.
 * Uso: zod-i18n.ts importado al arranque (main.tsx) registra el errorMap.
 */
const errorMap: z.ZodErrorMap = (issue, ctx) => {
  const t = i18n.t.bind(i18n);
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: t('errors.required') };
      }
      return { message: ctx.defaultError };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: t('errors.email') };
      return { message: ctx.defaultError };
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        if (issue.minimum === 1) return { message: t('errors.required') };
        return { message: t('errors.minLength', { min: issue.minimum }) };
      }
      return { message: ctx.defaultError };
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: t('errors.maxLength', { max: issue.maximum }) };
      return { message: ctx.defaultError };
    case z.ZodIssueCode.custom:
      return { message: issue.message ?? ctx.defaultError };
    default:
      return { message: ctx.defaultError };
  }
};

export function installZodI18n(): void {
  z.setErrorMap(errorMap);
}
