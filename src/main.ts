import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

if (!environment.socketUrl) {
  //alert("You have not set the 'socketUrl' in the environment config!!!");
  document.write('<div style="padding: 30px;">');
  document.write('<h1>Oh no!</h1>');
  document.write('<p>You forgot to set the "socketUrl" setting in the environment.ts file');
  document.write('</div>');
} else {
  platformBrowserDynamic().bootstrapModule(AppModule)
    .catch(err => console.error(err));
}

