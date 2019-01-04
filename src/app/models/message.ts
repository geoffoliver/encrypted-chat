import { User } from './user';

export class Message {
  date: number;
  type: string = 'incoming';
  from: User;
  message: string = '';
  delivered: boolean = false;
}
