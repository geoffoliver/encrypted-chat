import { Component, Input, OnInit } from '@angular/core';
import { Message } from '../../models/message';

@Component({
  moduleId: module.id,
  selector: 'message',
  templateUrl: './message.html',
  styleUrls: ['./message.css']
})

export class MessageComponent implements OnInit {

  @Input()
  message: Message;

  constructor() {}

  ngOnInit() {}
}
