import { User } from './user';

export class Room {
  name: string = '';
  locked: boolean = false;
  members: Array<User> = [];
}
