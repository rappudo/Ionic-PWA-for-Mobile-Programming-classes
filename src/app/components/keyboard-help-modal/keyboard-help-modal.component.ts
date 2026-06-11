import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';

interface ShortcutGroup {
  title: string;
  items: { keys: string[]; description: string }[];
}

@Component({
  selector: 'app-keyboard-help-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'keyboard-help-modal.component.html',
  styleUrls: ['keyboard-help-modal.component.scss'],
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
  ],
})
export class KeyboardHelpModalComponent {
  private readonly modalCtrl = inject(ModalController);

  readonly groups: ShortcutGroup[] = [
    {
      title: 'Navegação',
      items: [
        { keys: ['g', 'h'], description: 'Ir pro Home (catálogo)' },
        { keys: ['g', 'l'], description: 'Ir pras Listas' },
        { keys: ['g', 'f'], description: 'Ir pro Feed' },
        { keys: ['g', 'a'], description: 'Ir pros Amigos' },
        { keys: ['g', 'r'], description: 'Ir pras Recomendações' },
        { keys: ['g', 'u'], description: 'Ir pra Surpreenda-me' },
        { keys: ['g', 'p'], description: 'Ir pro Perfil' },
        { keys: ['g', 's'], description: 'Ir pras Estatísticas' },
      ],
    },
    {
      title: 'Ações',
      items: [
        { keys: ['/'], description: 'Focar a busca' },
        { keys: ['t'], description: 'Alternar tema claro/escuro' },
        { keys: ['?'], description: 'Mostrar esta ajuda' },
        { keys: ['Esc'], description: 'Fechar modal / sair do campo' },
      ],
    },
  ];

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }
}
