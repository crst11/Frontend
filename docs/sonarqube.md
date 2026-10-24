# Análisis de calidad con SonarQube

SonarQube revisa el código en busca de errores, vulnerabilidades, puntos críticos de seguridad, código duplicado y deuda técnica, y muestra la cobertura de las pruebas (SCRUM-255). Corre en tu equipo; el código no sale de él.

## 1. Levantar el servidor

Con Docker Desktop encendido:

```bash
docker run -d --name sonarqube -p 9000:9000 -v sonarqube_data:/opt/sonarqube/data -v sonarqube_extensions:/opt/sonarqube/extensions -v sonarqube_logs:/opt/sonarqube/logs sonarqube:community
```

Tarda uno o dos minutos en arrancar. Cuando `http://localhost:9000/api/system/status` responda `"status":"UP"`, entra a `http://localhost:9000`. Los volúmenes conservan los análisis; para volver a encenderlo después: `docker start sonarqube`.

## 2. Crear el token

Es un dato tuyo y no va en el repositorio.

1. Entra a `http://localhost:9000` con `admin` / `admin`. La primera vez pide cambiar la contraseña.
2. Arriba a la derecha, tu usuario → **My Account** → **Security** → **Generate Tokens**. Tipo **User Token**. Copia el valor, que solo se muestra una vez.
3. Guárdalo en una variable de entorno de tu terminal (no lo escribas en ningún archivo del proyecto):

```powershell
$env:SONAR_TOKEN = "el-token"
```

## 3. Analizar el Frontend

Desde la raíz del repositorio Frontend:

```bash
npm run test:cobertura
npx -y @sonar/scan -Dsonar.host.url=http://localhost:9000
```

La primera línea corre las pruebas y deja la cobertura en `coverage/cundiapp/lcov.info` (la carpeta `coverage/` no va a git). La segunda manda el análisis con la configuración de `sonar-project.properties`; el token lo toma de `SONAR_TOKEN`.

## 4. Analizar el Backend

Desde la raíz del repositorio Backend (con Docker encendido, por las pruebas con Testcontainers):

```bash
./mvnw clean verify org.sonarsource.scanner.maven:sonar-maven-plugin:sonar -Dsonar.host.url=http://localhost:9000
```

El nombre del proyecto y la regla que se ignora están en las propiedades de `pom.xml`. JaCoCo ya deja `target/site/jacoco/jacoco.xml`, que SonarQube lee solo. Si las pruebas ya corrieron y solo quieres repetir el análisis, basta el último objetivo: `./mvnw org.sonarsource.scanner.maven:sonar-maven-plugin:sonar -Dsonar.host.url=http://localhost:9000`.

## 5. Hallazgos que se revisaron y no se cambian

El primer análisis (24 de octubre de 2026) encontró, en el Backend, 8 errores y 4 vulnerabilidades; en el Frontend, 0 y 0. Los 8 errores y las mejoras de mantenibilidad se corrigieron (SCRUM-255): posibles `NullPointerException` de `queryForObject`, un `SecureRandom` creado en un método, tres registros con arreglos, expresiones regulares de tiempo superlineal sobre el texto que sube la persona y unos detalles del Frontend. Las tres vulnerabilidades de seguridad que quedan son decisiones de diseño, revisadas una por una:

| Regla | Dónde | Por qué es seguro |
|---|---|---|
| S2077, SQL armado con texto | `EstructuraDeEvaluacionAdaptador` (dos `DELETE … NOT IN (…)`) | Lo único que se concatena es `huecos(n)`, que produce `?,?,?` (n marcadores de posición). Todos los valores viajan como parámetros enlazados; ningún texto de la persona entra al SQL. |
| S3330, cookie sin `HttpOnly` | `SeguridadConfig`, `CookieCsrfTokenRepository.withHttpOnlyFalse()` | Es la cookie `XSRF-TOKEN` del patrón de doble envío: Angular debe leerla para repetirla en la cabecera `X-XSRF-TOKEN`, así que no puede ser `HttpOnly`. Solo lleva el token anti-CSRF; la cookie de refresco, que es la sesión, sí es `HttpOnly; Secure; SameSite`. |
| S4502, CSRF desactivado | `SeguridadConfig`, `requireCsrfProtectionMatcher` | CSRF no está apagado: está activo en las dos rutas que se autentican con cookie (refresco y cierre de sesión). El resto de la API usa `Authorization: Bearer`, que el navegador no adjunta solo, y por eso no se puede atacar con CSRF. |

Las 33 pruebas de `RestriccionesDeIntegridadTest` salen como «sin aserciones» (S2699) porque la aserción vive en `rechaza()` de `PruebaConBaseDeDatos`, otra clase, y SonarQube no la sigue. Se ignora esa regla solo para ese archivo, con el motivo escrito en `pom.xml`.

## 6. Ver el informe

Entra a `http://localhost:9000/projects`: cada proyecto muestra Seguridad, Fiabilidad, Mantenibilidad, Cobertura, Duplicaciones y Security Hotspots, y la compuerta de calidad («Quality Gate»). La edición Community no exporta un PDF: para el profesor se muestra el **Overview** de cada proyecto en la pantalla o se comparten capturas.
