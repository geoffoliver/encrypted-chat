import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'encrypted-chat';

  isCollapsed: boolean = true;

  toggleMemberList() {
    let className = 'member-list-active';
    document.body.classList.toggle(className);
  }
}
