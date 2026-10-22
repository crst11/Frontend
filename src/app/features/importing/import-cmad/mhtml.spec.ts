import { extraerHtmlDeMhtml, extraerPaginasDeMhtml } from './mhtml';

describe('extraerPaginasDeMhtml', () => {
  const LIMITE = '----MultipartBoundary--abc123----';
  const parte = (tipo: string, cuerpo: string): string =>
    [`--${LIMITE}`, `Content-Type: ${tipo}`, 'Content-Transfer-Encoding: binary', '', cuerpo].join('\r\n');

  /** Lo que guarda Chrome en el teléfono de una página con marcos: el marco de afuera, uno vacío, la tabla y recursos. */
  const conMarcos = [
    'From: <Saved by Blink>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/related;',
    '\ttype="text/html";',
    `\tboundary="${LIMITE}"`,
    '',
    parte('text/html', '<html><frameset><frame src="pub_rep_val.jsp"></frameset></html>'),
    parte('text/html', '<html></html>'),
    parte('text/css', 'body { color: red }'),
    parte('text/html', '<html><body><table><tr><td>la tabla</td></tr></table></body></html>'),
    parte('image/gif', 'GIF89a'),
    `--${LIMITE}--`,
    '',
  ].join('\r\n');

  it('devuelve todas las páginas HTML, en el orden en que vienen, y deja los recursos', () => {
    expect(extraerPaginasDeMhtml(conMarcos)).toEqual([
      '<html><frameset><frame src="pub_rep_val.jsp"></frameset></html>',
      '<html></html>',
      '<html><body><table><tr><td>la tabla</td></tr></table></body></html>',
    ]);
  });

  it('lo que no es un MHTML se devuelve como su única página', () => {
    expect(extraerPaginasDeMhtml('<html><body>hola</body></html>')).toEqual(['<html><body>hola</body></html>']);
  });

  it('un MHTML sin ninguna parte HTML se devuelve tal cual', () => {
    const sinHtml = conMarcos.replace(/text\/html/g, 'text/plain');
    expect(extraerPaginasDeMhtml(sinHtml)).toEqual([sinHtml]);
  });

  it('extraerHtmlDeMhtml sigue devolviendo la primera página, como lo usa el CMAD', () => {
    expect(extraerHtmlDeMhtml(conMarcos)).toBe('<html><frameset><frame src="pub_rep_val.jsp"></frameset></html>');
  });
});

describe('extraerHtmlDeMhtml', () => {
  const LIMITE = '----MultipartBoundary--abc123----';

  /** Un MHTML como el de Chrome: cabecera, la parte HTML y una hoja de estilo. */
  function mhtml(parteHtml: string, saltos = '\r\n'): string {
    return [
      'From: <Saved by Blink>',
      'Snapshot-Content-Location: https://moodle.example/grade/report/user/index.php?id=1',
      'MIME-Version: 1.0',
      'Content-Type: multipart/related;',
      '\ttype="text/html";',
      `\tboundary="${LIMITE}"`,
      '',
      `--${LIMITE}`,
      parteHtml,
      `--${LIMITE}`,
      'Content-Type: text/css',
      'Content-Transfer-Encoding: binary',
      '',
      'body { color: red }',
      `--${LIMITE}--`,
      '',
    ].join(saltos);
  }

  it('toma la parte HTML tal cual cuando Chrome la deja binary', () => {
    const html = '<!DOCTYPE html><html><body><p>Notas de Ingeniería</p></body></html>';
    const archivo = mhtml(['Content-Type: text/html', 'Content-Transfer-Encoding: binary', '', html].join('\r\n'));

    expect(extraerHtmlDeMhtml(archivo)).toBe(html);
  });

  it('funciona con saltos de línea de Unix', () => {
    const html = '<html><body>hola</body></html>';
    const archivo = mhtml(['Content-Type: text/html', 'Content-Transfer-Encoding: binary', '', html].join('\n'), '\n');

    expect(extraerHtmlDeMhtml(archivo)).toBe(html);
  });

  it('no mezcla la hoja de estilo ni el resto de las partes', () => {
    const archivo = mhtml(['Content-Type: text/html', 'Content-Transfer-Encoding: binary', '', '<p>solo esto</p>'].join('\r\n'));

    const resultado = extraerHtmlDeMhtml(archivo);

    expect(resultado).toBe('<p>solo esto</p>');
    expect(resultado).not.toContain('color: red');
    expect(resultado).not.toContain('MultipartBoundary');
  });

  it('decodifica quoted-printable: tildes, saltos suaves y el signo igual', () => {
    const parte = [
      'Content-Type: text/html; charset="utf-8"',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      '<p class=3D"nota">Evaluaci=C3=B3n de Ingenier=C3=ADa de Soft=',
      'ware I</p>',
    ].join('\r\n');

    expect(extraerHtmlDeMhtml(mhtml(parte))).toBe('<p class="nota">Evaluación de Ingeniería de Software I</p>');
  });

  it('decodifica base64', () => {
    const html = '<p>Calificación 4,5</p>';
    const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(html)));
    const parte = ['Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: base64', '', base64.slice(0, 12), base64.slice(12)].join('\r\n');

    expect(extraerHtmlDeMhtml(mhtml(parte))).toBe(html);
  });

  it('respeta un juego de caracteres distinto de utf-8', () => {
    const parte = [
      'Content-Type: text/html; charset=iso-8859-1',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      '<p>Calificaci=F3n</p>',
    ].join('\r\n');

    expect(extraerHtmlDeMhtml(mhtml(parte))).toBe('<p>Calificación</p>');
  });

  it('un HTML normal se devuelve igual', () => {
    const html = '<!DOCTYPE html><html><body>nada que extraer</body></html>';

    expect(extraerHtmlDeMhtml(html)).toBe(html);
  });

  it('un texto pegado se devuelve igual', () => {
    const texto = 'R1-A1-S1 Taller 25 4,5\nTotal del curso 4,2';

    expect(extraerHtmlDeMhtml(texto)).toBe(texto);
  });

  it('un MHTML sin parte HTML se devuelve igual, para que el lector diga que no encontró la tabla', () => {
    const archivo = mhtml(['Content-Type: image/png', 'Content-Transfer-Encoding: base64', '', 'AAAA'].join('\r\n'));

    expect(extraerHtmlDeMhtml(archivo)).toBe(archivo);
  });
});
