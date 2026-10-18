/**
 * Saca la página HTML de un archivo MHTML (`.mht` o `.mhtml`).
 *
 * <p>Chrome en el teléfono no guarda la página como `.html`: con «Descargar página» la guarda como un
 * MHTML, un solo archivo MIME que trae la página y sus hojas de estilo e imágenes. La importación del
 * CMAD lee solo el HTML, así que aquí se toma esa parte y se le quita la codificación de transporte
 * (Chrome la deja tal cual, `binary`; otros navegadores usan `quoted-printable` o `base64`).
 *
 * <p>Todo ocurre en el navegador. Lo que no es un MHTML se devuelve igual, para usarla siempre.
 */
export function extraerHtmlDeMhtml(contenido: string): string {
  const cabecera = cabeceraDe(contenido);
  if (!/^MIME-Version:/im.test(cabecera) || !/Content-Type:\s*multipart\/related/i.test(cabecera)) {
    return contenido;
  }
  const limite = /boundary="?([^";\s]+)"?/i.exec(cabecera)?.[1];
  if (!limite) {
    return contenido;
  }

  for (const parte of contenido.split(`--${limite}`)) {
    const { cabecera: cabeceraDeLaParte, cuerpo } = separar(parte);
    if (/^Content-Type:\s*text\/html/im.test(cabeceraDeLaParte)) {
      return decodificar(cuerpo, cabeceraDeLaParte);
    }
  }
  return contenido;
}

/** Las cabeceras MIME van hasta la primera línea en blanco; las que ocupan varias líneas se juntan. */
function cabeceraDe(texto: string): string {
  return separar(texto.slice(0, 4000)).cabecera;
}

function separar(texto: string): { cabecera: string; cuerpo: string } {
  const corte = /\r?\n\r?\n/.exec(texto);
  if (!corte) {
    return { cabecera: unir(texto), cuerpo: '' };
  }
  return {
    cabecera: unir(texto.slice(0, corte.index)),
    cuerpo: texto.slice(corte.index + corte[0].length).replace(/\r?\n$/, ''),
  };
}

function unir(cabecera: string): string {
  return cabecera.replace(/\r?\n[ \t]+/g, ' ');
}

function decodificar(cuerpo: string, cabecera: string): string {
  const codificacion = /^Content-Transfer-Encoding:\s*(\S+)/im.exec(cabecera)?.[1]?.toLowerCase();
  const juego = /charset="?([^";\s]+)"?/i.exec(cabecera)?.[1] ?? 'utf-8';
  if (codificacion === 'quoted-printable') {
    return aTexto(desdeQuotedPrintable(cuerpo), juego);
  }
  if (codificacion === 'base64') {
    return aTexto(Uint8Array.from(atob(cuerpo.replace(/\s+/g, '')), (c) => c.charCodeAt(0)), juego);
  }
  return cuerpo;
}

/** `=C3=A1` es el byte 0xC3 y luego el 0xA1; un `=` al final de la línea es un salto que no existe. */
function desdeQuotedPrintable(texto: string): Uint8Array {
  const bytes: number[] = [];
  const codificador = new TextEncoder();
  const sinSaltos = texto.replace(/=\r?\n/g, '');
  for (let i = 0; i < sinSaltos.length; i++) {
    const hex = sinSaltos[i] === '=' ? sinSaltos.slice(i + 1, i + 3) : '';
    if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(...codificador.encode(sinSaltos[i]));
    }
  }
  return Uint8Array.from(bytes);
}

function aTexto(bytes: Uint8Array, juego: string): string {
  try {
    return new TextDecoder(juego).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}
