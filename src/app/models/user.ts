export class User {
  id: string = '';
  name: string = '';
  system: boolean = false;
  pubKey: string = '';
  me: boolean = false;
  typing: boolean = false;
  active: boolean = true;

  constructor(u:any) {
    if (!u){
      return;
    }

    this.id = u.id || '';
    this.name = u.name || '';
    this.system = u.system || false;
    this.pubKey = u.pubKey || '';
    this.typing = u.typing || false;
    if(u.hasOwnProperty('active')){
      this.active = u.active;
    }else{
      this.active = true;
    }
  }
}
