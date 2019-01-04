import { Component, Input, OnInit } from '@angular/core';
import { Message } from '../../models/message';
import { faSync } from '@fortawesome/pro-light-svg-icons';

@Component({
  moduleId: module.id,
  selector: 'message',
  templateUrl: './message.html',
  styleUrls: ['./message.css']
})

export class MessageComponent implements OnInit {

  @Input()
  message: Message;

  faSync = faSync;

  constructor() {}

  ngOnInit() {}
}
