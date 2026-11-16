export const DEFAULT_FILES = {
  'main.py': `# Python se ejecuta en el teléfono (Pyodide)
def saludar(nombre):
    return f"¡Hola, {nombre}!"

nombre = input("¿Cómo te llamas? ")
print(saludar(nombre))

cuadrados = [n * n for n in range(1, 6)]
print("Cuadrados:", cuadrados)
`,
  'index.html': `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mi página</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hola desde CodePad</h1>
  <p>Edita index.html, style.css y script.js.</p>
  <button id="boton">Haz clic</button>
  <p id="contador">Clics: 0</p>
  <script src="script.js"></script>
</body>
</html>
`,
  'style.css': `body {
  font-family: system-ui, sans-serif;
  background: #f4f6fb;
  color: #222;
  padding: 1.5rem;
}

h1 { color: #4f46e5; }

button {
  background: #4f46e5;
  color: white;
  border: 0;
  padding: .7rem 1.2rem;
  border-radius: 8px;
  font-size: 1rem;
}
`,
  'script.js': `let clics = 0;
const boton = document.getElementById('boton');
const contador = document.getElementById('contador');

boton.addEventListener('click', () => {
  clics++;
  contador.textContent = 'Clics: ' + clics;
  console.log('Clic número', clics);
});

console.log('script.js cargado');
`,
  'consultas.sql': `-- SQLite se ejecuta en el teléfono (sql.js).
-- La base de datos se guarda entre ejecuciones; usa "Reiniciar BD" para empezar de cero.
DROP TABLE IF EXISTS alumnos;
CREATE TABLE alumnos (id INTEGER PRIMARY KEY, nombre TEXT, nota REAL);

INSERT INTO alumnos (nombre, nota) VALUES
  ('Ana', 9.5), ('Luis', 7.8), ('Marta', 8.9), ('Pedro', 6.4);

SELECT nombre, nota FROM alumnos WHERE nota > 7 ORDER BY nota DESC;

SELECT COUNT(*) AS total, ROUND(AVG(nota), 2) AS promedio FROM alumnos;
`,
};
