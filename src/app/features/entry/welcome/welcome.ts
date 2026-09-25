import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../../core/session/session.service';

/** Pantalla de entrada: los dos caminos, iniciar sesión o consultar la guía sin cuenta. */
@Component({
  selector: 'app-welcome',
  imports: [RouterLink],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
})
export class Welcome {
  protected readonly sesion = inject(SessionService);
}
