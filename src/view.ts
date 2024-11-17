
import "./view.css";

import { h, render } from "preact"
import {BlochSphere} from "./bloch"

render(h(BlochSphere, null), document.body);

// import { Scene, MeshBasicMaterial, Mesh, PerspectiveCamera, WebGLRenderer, BoxGeometry } from "three";

// import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
// import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";

// import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
// import * as fontJson from "three/examples/fonts/helvetiker_regular.typeface.json";

// import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js"

// import markdownIt from "markdown-it";
// import katex from "@vscode/markdown-it-katex";

// const vscode = acquireVsCodeApi();


// const md = markdownIt("commonmark");
// md.use(katex, {
//   enableMathBlockInHtml: true,
//   enableMathInlineInHtml: true,
// });

// function createText(scene: Scene, done: () => void) {
//   const loader = new FontLoader();
//   const fontMat = new MeshBasicMaterial({ color: 0x606080, opacity: 1 });

//   const font = loader.parse(fontJson);

//   const fontProps = {
//     font,
//     size: 0.6,
//     height: 0.01,
//     bevelThickness: 0.075,
//     bevelSize: 0.01,
//     bevelEnabled: true,
//   };
//   const xGeo = new TextGeometry("x", fontProps);
//   const yGeo = new TextGeometry("y", fontProps);
//   const zGeo = new TextGeometry("z", fontProps);

//   const xMesh = new Mesh(xGeo, fontMat);
//   const yMesh = new Mesh(yGeo, fontMat);
//   const zMesh = new Mesh(zGeo, fontMat);
//   xGeo.computeBoundingBox();
//   yGeo.computeBoundingBox();
//   zGeo.computeBoundingBox();

//   if (!xGeo.boundingBox || !yGeo.boundingBox || !zGeo.boundingBox) throw 'Error: Bounding box not found';

//   xMesh.position.set(
//     -0.5 * (xGeo.boundingBox.max.x - xGeo.boundingBox.min.x),
//     -0.5 * (xGeo.boundingBox.max.y - xGeo.boundingBox.min.y),
//     6.4
//   );
//   yMesh.position.set(
//     6.4,
//     -0.5 * (xGeo.boundingBox.max.y - xGeo.boundingBox.min.y),
//     0
//   );

//   zMesh.position.set(
//     -0.5 * (zGeo.boundingBox.max.x - zGeo.boundingBox.min.x),
//     6.4,
//     0
//   );
//   scene.add(xMesh);
//   scene.add(yMesh);
//   scene.add(zMesh);
//   done();
// }


// const scene = new Scene();
// const camera = new PerspectiveCamera(
//   75,
//   window.innerWidth / window.innerHeight,
//   0.1,
//   1000
// );

// const renderer = new WebGLRenderer();
// renderer.setSize(window.innerWidth, window.innerHeight);
// document.body.appendChild(renderer.domElement);

// const controls = new OrbitControls(camera, renderer.domElement);
// controls.addEventListener("change", () =>
//   requestAnimationFrame(() => {
//     controls.update();
//     renderer.render(scene, camera);
//   })
// );

// const geometry = new BoxGeometry(1, 1, 1);
// const material = new MeshBasicMaterial({ color: 0x00ff00 });
// const cube = new Mesh(geometry, material);
// scene.add(cube);

// const gui = new GUI();

// const cubeFolder = gui.addFolder("Cube");
// cubeFolder.add(cube.rotation, "x", 0, Math.PI * 2);
// cubeFolder.add(cube.rotation, "y", 0, Math.PI * 2);
// cubeFolder.add(cube.rotation, "z", 0, Math.PI * 2);
// cubeFolder.open();

// const cameraFolder = gui.addFolder("Camera");
// cameraFolder.add(camera.position, "z", 0, 20);
// cameraFolder.open();

// camera.position.z = 5;

// function animate() {
//   // cube.rotation.x += 0.01;
//   // cube.rotation.y += 0.01;
//   renderer.render(scene, camera);
// }

// createText(scene, () => renderer.setAnimationLoop(animate));

// const testElem = document.createElement("div");
// const inner = md.render(String.raw`# Hello, world!

//   Let's render some math:
  
//   $$x = {-b \pm \sqrt{b^2-4ac} \over 2a}$$
  
//   __Bold text__ and *italic text*
//   `);
// testElem.innerHTML = inner;

// testElem.style.position = "absolute";
// testElem.style.top = "20px";
// testElem.style.left = "40px"; 

// document.body.appendChild(testElem);