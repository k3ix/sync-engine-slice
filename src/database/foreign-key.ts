import { QueryFailedError } from 'typeorm';

const FOREIGN_KEY_VIOLATION = '23503';

export function isForeignKeyViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    'code' in err.driverError &&
    err.driverError.code === FOREIGN_KEY_VIOLATION
  );
}
