import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { ensurePromiseTryPolyfill } from './app/shared/utils/pdf-signature-coordinates.util';

ensurePromiseTryPolyfill();
bootstrapApplication(App, appConfig)

  .catch((err) => console.error(err));
