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
./mvnw clean verify org.sonarsource.scanner.maven:sonar-maven-plugin:sonar -Dsonar.projectKey=cundiapp-backend -Dsonar.projectName="CundiApp Backend" -Dsonar.host.url=http://localhost:9000
```

JaCoCo ya deja `target/site/jacoco/jacoco.xml`, que SonarQube lee solo. No hace falta tocar `pom.xml`.

## 5. Ver el informe

Entra a `http://localhost:9000/projects`: cada proyecto muestra Seguridad, Fiabilidad, Mantenibilidad, Cobertura, Duplicaciones y Security Hotspots, y la compuerta de calidad («Quality Gate»). La edición Community no exporta un PDF: para el profesor se muestra el **Overview** de cada proyecto en la pantalla o se comparten capturas.
