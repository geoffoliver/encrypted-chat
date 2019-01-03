import { User } from './user';

export class Message {
  date: number;
  type: string = 'incoming';
  from: User;
  text: string = '';
  delivered: boolean = false;
}
