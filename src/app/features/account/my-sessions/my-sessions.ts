import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { SessionService } from '../../../core/session/session.service';
import { EstudianteRepository, SesionAbierta } from '../../../data-access/estudiante.repository';

/** Un dispositivo reconocible a partir del user agent, para no mostrarle al estudiante la cadena cruda. */
interface Dispositivo {
  nombre: string;
  sistema: string | null;
  esTelefono: boolean;
}

/**
 * Mis sesiones (SCRUM-49): ver desde qué dispositivos hay una sesión abierta y cerrarlas.
 * Quien entra aquí suele sospechar que alguien más usó su cuenta, así que lo importante es
 * reconocer los dispositivos y poder cerrar todo de una vez.
 */
@Component({
  selector: 'app-my-sessions',
  imports: [RouterLink],
  templateUrl: './my-sessions.html',
  styleUrl: './my-sessions.css',
})
export class MySessions {
  private readonly repositorio = inject(EstudianteRepository);
  private readonly sesion = inject(SessionService);
  private readonly router = inject(Router);
  private readonly notificador = inject(NotifierService);

  protected readonly sesiones = signal<SesionAbierta[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);
  protected readonly cerrando = signal<number | null>(null);
  protected readonly varias = computed(() => this.sesiones().length > 1);

  constructor() {
    this.cargar();
  }

  /**
   * Del user agent solo se saca lo que el estudiante reconocería: el navegador y el sistema.
   * No se intenta adivinar el modelo del equipo; una etiqueta equivocada sería peor que ninguna.
   */
  protected dispositivo(sesion: SesionAbierta): Dispositivo {
    const agente = sesion.dispositivo ?? '';
    if (!agente.trim()) {
      return { nombre: 'Dispositivo desconocido', sistema: null, esTelefono: false };
    }

    const navegadores: [RegExp, string][] = [
      [/Edg\//, 'Microsoft Edge'],
      [/OPR\/|Opera/, 'Opera'],
      [/Firefox\//, 'Firefox'],
      // Chrome va después de Edge y Opera porque ellos también se anuncian como Chrome.
      [/Chrome\//, 'Chrome'],
      [/Safari\//, 'Safari'],
      [/PostmanRuntime|curl|insomnia/i, 'Herramienta de pruebas'],
    ];
    const sistemas: [RegExp, string][] = [
      [/Windows NT/, 'Windows'],
      [/Android/, 'Android'],
      [/iPhone|iPad|iPod/, 'iPhone o iPad'],
      [/Mac OS X/, 'Mac'],
      [/Linux/, 'Linux'],
    ];

    return {
      nombre: navegadores.find(([patron]) => patron.test(agente))?.[1] ?? 'Navegador desconocido',
      sistema: sistemas.find(([patron]) => patron.test(agente))?.[1] ?? null,
      esTelefono: /Android|iPhone|iPad|iPod|Mobile/.test(agente),
    };
  }

  protected metodo(sesion: SesionAbierta): string {
    return sesion.metodo === 'google' ? 'Entró con Google' : 'Entró con contraseña';
  }

  /** "Hoy a las 14:30" o "28 de septiembre, 14:30": la fecha exacta importa para reconocer un acceso ajeno. */
  protected desdeCuando(fecha: string): string {
    const inicio = new Date(fecha);
    if (Number.isNaN(inicio.getTime())) {
      return 'Fecha no disponible';
    }

    // 'numeric' y no '2-digit': "7:12 p. m." se lee mejor que "07:12 p. m.".
    const hora = inicio.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
    const hoy = new Date();
    const mismoDia = inicio.toDateString() === hoy.toDateString();
    if (mismoDia) {
      return `Hoy a las ${hora}`;
    }
    return `${inicio.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}, ${hora}`;
  }

  protected vigenciaRestante(fecha: string): string {
    const expira = new Date(fecha).getTime();
    if (Number.isNaN(expira)) {
      return '';
    }

    const dias = Math.ceil((expira - Date.now()) / 86_400_000);
    if (dias <= 0) {
      return 'Vence hoy';
    }
    return dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`;
  }

  protected async cerrarUna(sesion: SesionAbierta): Promise<void> {
    const equipo = this.dispositivo(sesion);
    const confirmado = await this.notificador.confirmar(
      '¿Cerrar esta sesión?',
      `Se cerrará la sesión de ${equipo.nombre}${equipo.sistema ? ` en ${equipo.sistema}` : ''}. ` +
        'Si es este dispositivo, tendrás que iniciar sesión de nuevo.',
      'Cerrar sesión',
    );
    if (!confirmado) {
      return;
    }

    this.cerrando.set(sesion.consecutivo);
    this.repositorio.cerrarSesionEnDispositivo(sesion.consecutivo).subscribe({
      next: () => {
        this.sesiones.update((abiertas) => abiertas.filter((s) => s.consecutivo !== sesion.consecutivo));
        this.cerrando.set(null);
        void this.notificador.aviso('Sesión cerrada.');
      },
      error: () => {
        this.cerrando.set(null);
        void this.notificador.problema(
          'No pudimos cerrar la sesión',
          'No logramos comunicarnos con el servidor. Intenta de nuevo en unos minutos.',
        );
      },
    });
  }

  protected async cerrarTodas(): Promise<void> {
    const confirmado = await this.notificador.confirmar(
      '¿Cerrar la sesión en todos los dispositivos?',
      'Se cerrarán todas, incluida la de este dispositivo. Tendrás que iniciar sesión de nuevo.',
      'Cerrar todas',
    );
    if (!confirmado) {
      return;
    }

    const irAEntrar = () => {
      // El backend ya revocó todo, incluida esta sesión: solo queda limpiar el estado local.
      this.sesion.limpiar();
      void this.router.navigate(['/cuenta/entrar']);
      void this.notificador.aviso('Se cerraron todas tus sesiones.');
    };
    this.repositorio.cerrarTodasMisSesiones().subscribe({
      next: irAEntrar,
      error: () =>
        void this.notificador.problema(
          'No pudimos cerrar las sesiones',
          'No logramos comunicarnos con el servidor. Intenta de nuevo en unos minutos.',
        ),
    });
  }

  private cargar(): void {
    this.repositorio.misSesiones().subscribe({
      next: (abiertas) => {
        this.sesiones.set(abiertas);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }
}
