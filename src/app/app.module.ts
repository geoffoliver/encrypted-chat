import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule }   from '@angular/forms';
import { MomentModule } from 'angular2-moment';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faKeyboard, faSync } from '@fortawesome/pro-light-svg-icons';
import { faCircle } from '@fortawesome/pro-solid-svg-icons';

import { environment } from '../environments/environment';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { RoomComponent } from './components/room/room.component';
import { MessageComponent } from './components/message/message.component';

const config: SocketIoConfig = {
  url: environment.socketUrl,
};

@NgModule({
  declarations: [
    AppComponent,
    RoomComponent,
    MessageComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    MomentModule,
    NgbModule,
    SocketIoModule.forRoot(config),
    FontAwesomeModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {
  constructor() {
    library.add(faKeyboard, faCircle, faSync)
  }
}
