import { HttpInterceptorFn } from '@angular/common/http';
import { timeout, catchError, throwError } from 'rxjs';

/** Default timeout for outbound HTTP requests made by the API tester (ms). */
export const DEFAULT_HTTP_TIMEOUT_MS = 120_000;

export const httpTimeoutInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    timeout({
      each: DEFAULT_HTTP_TIMEOUT_MS,
      with: () =>
        throwError(() => ({
          name: 'TimeoutError',
          message: `Request timed out after ${DEFAULT_HTTP_TIMEOUT_MS / 1000}s`
        }))
    }),
    catchError(err => throwError(() => err))
  );