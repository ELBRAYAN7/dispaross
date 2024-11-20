import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// Crear escena, cámara y renderizador
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);



// Luz ambiental tenue
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // Intensidad reducida
scene.add(ambientLight);

document.body.appendChild( VRButton.createButton( renderer ) );

// Luz direccional tenue
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.001); // Intensidad reducida
directionalLight.position.set(10, 10, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Luz puntual roja para crear un aura de miedo
const redPointLight = new THREE.PointLight(0xff0000, 1, 100); // Color rojo, intensidad 1, alcance 10
redPointLight.position.set(0, 9, -40); // Posición frente a la cámara inicial
scene.add(redPointLight);

// Variables para el modelo y colisiones
let collidableMeshes = []; // Lista de objetos con los que detectar colisiones
let object3D = null; // Variable para almacenar el modelo cargado

// Cargar modelo GLB con preservación de texturas


const loader = new GLTFLoader();
loader.load(
    'casa.glb',
    (gltf) => {
        object3D = gltf.scene;
        object3D.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry.attributes.uv) {
                    child.geometry.attributes.uv.needsUpdate = true;
                }
                if (child.material.map) {
                    child.material.map.wrapS = THREE.RepeatWrapping;
                    child.material.map.wrapT = THREE.RepeatWrapping;
                    child.material.map.repeat.set(10, 20);
                    child.material.map.needsUpdate = true;
                }
                // Añadir los objetos con colisiones a la lista
                collidableMeshes.push(child);
            }
        });

        object3D.scale.set(1, 1, 1);
        scene.add(object3D);

        // Crear esferas dispersas por el modelo cargado
        createSpheresInObject(object3D, 100); // Generar 100 esferas
    },
    undefined,
    (error) => {
        console.error('Error al cargar el modelo:', error);
    }
);

// Función para crear esfera
function createSphere(x, y, z) {
    const geometry = new THREE.SphereGeometry(0.5, 16, 16); // Radio de 0.5, 16 segmentos
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Color verde
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(x, y, z); // Posición de la esfera
    sphere.name = `sphere-${Math.random()}`; // Asignar un nombre único a cada esfera
    scene.add(sphere);
    collidableMeshes.push(sphere); // Agregar la esfera a la lista de colisiones
    return sphere;
}

// Función para generar esferas dentro del objeto cargado
function createSpheresInObject(object, numSpheres) {
    if (!object) return;

    const box = new THREE.Box3().setFromObject(object); // Obtener el contorno del objeto (caja)
    const size = new THREE.Vector3();
    box.getSize(size);

    // Crear esferas en posiciones aleatorias dentro del objeto
    for (let i = 0; i < numSpheres; i++) {
        const x = Math.random() * size.x - size.x / 2 + box.min.x; // Posición aleatoria en X
        const y = Math.random() * size.y - size.y / 2 + box.min.y; // Posición aleatoria en Y
        const z = Math.random() * size.z - size.z / 2 + box.min.z; // Posición aleatoria en Z
        createSphere(x, y, z);
    }
}

// Posición inicial de la cámara
camera.position.set(0, 8, -4);

// Variables para el movimiento y rotación
const movementSpeed = 0.1; // Velocidad de movimiento
const keysPressed = {};
let yaw = 0; // Rotación horizontal
let pitch = 0; // Rotación vertical
const sensitivity = 0.002; // Sensibilidad del ratón

// Capturar movimiento del ratón
window.addEventListener('mousemove', (event) => {
    yaw -= event.movementX * sensitivity;
    pitch -= event.movementY * sensitivity;

    // Restringir el ángulo de pitch para evitar un giro completo
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
});

// Eventos de teclado
window.addEventListener('keydown', (event) => {
    keysPressed[event.key] = true;
});
window.addEventListener('keyup', (event) => {
    keysPressed[event.key] = false;
});

// Raycaster para detección de colisiones
const raycaster = new THREE.Raycaster();
const collisionDistance = 0.5; // Distancia mínima para considerar una colisión

// Función para mover la cámara
function updateCameraPosition() {
    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();
    const movement = new THREE.Vector3();

    // Vector hacia adelante
    camera.getWorldDirection(direction);
    direction.y = 0; // Mantener movimiento en el plano XZ
    direction.normalize();

    // Vector hacia la derecha
    right.crossVectors(camera.up, direction);
    right.normalize();

    // Movimiento basado en las teclas
    if (keysPressed['ArrowUp']) movement.addScaledVector(direction, movementSpeed);
    if (keysPressed['ArrowDown']) movement.addScaledVector(direction, -movementSpeed);
    if (keysPressed['ArrowLeft']) movement.addScaledVector(right, movementSpeed);
    if (keysPressed['ArrowRight']) movement.addScaledVector(right, -movementSpeed);

    // Simular nueva posición
    const newPosition = camera.position.clone().add(movement);

    // Verificar colisión usando Raycaster
    raycaster.set(camera.position, movement.clone().normalize());
    const intersects = raycaster.intersectObjects(collidableMeshes, true);

    if (intersects.length === 0 || intersects[0].distance > collisionDistance) {
        // Mover cámara si no hay colisión
        camera.position.copy(newPosition);
    }
}

// Función para actualizar la orientación de la cámara
function updateCameraRotation() {
    const quaternion = new THREE.Quaternion();
    const pitchQuaternion = new THREE.Quaternion();

    // Rotación en yaw (horizontal)
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    // Rotación en pitch (vertical)
    pitchQuaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch);

    // Combinar ambas rotaciones
    quaternion.multiply(pitchQuaternion);

    // Aplicar rotación a la cámara
    camera.quaternion.copy(quaternion);
}

// Redimensionar ventana
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Variable para el marcador de puntos
let score = 0;

// Crear un marcador de puntos en HTML
const scoreElement = document.createElement('div');
scoreElement.style.position = 'absolute';
scoreElement.style.top = '10px';
scoreElement.style.left = '10px';
scoreElement.style.fontSize = '24px';
scoreElement.style.color = 'white';
scoreElement.innerText = `Puntos: ${score}`;
document.body.appendChild(scoreElement);

// Mensaje de victoria
const winMessage = document.createElement('div');
winMessage.style.position = 'absolute';
winMessage.style.top = '50%';
winMessage.style.left = '50%';
winMessage.style.transform = 'translate(-50%, -50%)';
winMessage.style.fontSize = '48px';
winMessage.style.color = 'white';
winMessage.style.display = 'none';
winMessage.innerText = '¡Ganaste!';
document.body.appendChild(winMessage);

// Array para almacenar esferas disparadas
let firedSpheres = [];

// Función de disparo de esferas
function shoot() {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction); // Obtener la dirección en la que está mirando la cámara

    const geometry = new THREE.SphereGeometry(0.6, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const sphere = new THREE.Mesh(geometry, material);

    sphere.position.copy(camera.position);
    scene.add(sphere);

    firedSpheres.push(sphere);

    // Dirección de la esfera disparada
    const velocity = direction.clone().multiplyScalar(0.9);
    sphere.userData = { velocity };
}

// Detectar las colisiones de las esferas disparadas
function detectCollisions() {
    firedSpheres.forEach((sphere) => {
        collidableMeshes.forEach((target) => {
            const distance = sphere.position.distanceTo(target.position);
            if (distance < 0.5) { // Colisión detectada
                // Eliminar la esfera disparada
                scene.remove(sphere);
                firedSpheres = firedSpheres.filter((s) => s !== sphere);

                // Reaparecer la esfera generada en una nueva posición aleatoria
                const box = new THREE.Box3().setFromObject(object3D);
                const size = new THREE.Vector3();
                box.getSize(size);

                target.position.set(
                    Math.random() * size.x - size.x / 2 + box.min.x,
                    Math.random() * size.y - size.y / 2 + box.min.y,
                    Math.random() * size.z - size.z / 2 + box.min.z
                );

                // Eliminar la esfera generada
                scene.remove(target);
                collidableMeshes = collidableMeshes.filter((mesh) => mesh !== target);

                // Incrementar el marcador de puntos
                score++;
                scoreElement.innerText = `Puntos: ${score}`;

                // Comprobar si se alcanzó la puntuación de 3
                if (score >= 3) {
                    winMessage.style.display = 'block'; // Mostrar mensaje de victoria
                    // Detener interacciones
                    firedSpheres = [];
                    collidableMeshes = [];
                }
            }
        });
    });
}

// Función de animación
function animate() {
    requestAnimationFrame(animate);

    // Actualizar la posición de la cámara
    updateCameraPosition();
    updateCameraRotation();

    // Detectar las colisiones de las esferas disparadas
    detectCollisions();

    // Actualizar la posición de las esferas disparadas
    firedSpheres.forEach((sphere) => {
        if (sphere) {
            sphere.position.add(sphere.userData.velocity); // Mover la esfera
        }
    });

    // Renderizar la escena
    renderer.render(scene, camera);
}

// Evento de disparo con la tecla espacio
window.addEventListener('keydown', (event) => {
    if (event.key === ' ') {
        shoot();
    }
});

animate();

window.addEventListener('click', () => {
    document.body.requestPointerLock();
});