import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule }   from '@angular/forms';
import { MomentModule } from 'angular2-moment';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { RoomComponent } from './components/room/room.component';
import { MessageComponent } from './components/message/message.component';

const config: SocketIoConfig = {
  //url: document.location.protocol + '//' + document.location.hostname + ':4000',
  url: 'https://cup.plan8home.com:4000',
};

@NgModule({
  declarations: [
    AppComponent,
    RoomComponent,
    MessageComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    MomentModule,
    NgbModule,
    SocketIoModule.forRoot(config)
  ],
  providers: [],
  bootstrap: [AppComponent],
  entryComponents: [
    RoomComponent
  ]
})
export class AppModule { }
