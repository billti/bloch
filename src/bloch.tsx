// Copyright (c) Bill Ticehurst
// Licensed under the MIT License

/* TODO:

- Add a help pop-up for the gate sequence textarea
- Wire up the settings to the renderer (rotation speed, trail length, colors, etc.)
- Save/restore settings
- Use CSS to honor the light/dark theme for the settings
- Fix warning about unicode chars in KaTeX
- Only show the equation once the rotation for it starts
- Show the equations from state vector to bloch angles
- Add a slider to drag back and forth to replay the gates
- Scroll to and highlight the current equation as history moves forward and back
- Draw the equator option (z plane line)

To convert basis state coeffeicients a & b into a point on the Bloch sphere:
 - Calculate the angle theta = 2 * acos(magnitute(a))
 - Calculate the angle phi = arg(b) - arg(a), normalized to [0, 2 * PI)
*/

import { useEffect, useRef, useState } from "preact/hooks";
import katex from "katex";

import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshBasicMaterialParameters,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
  WireframeGeometry,
} from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import * as fontJson from "three/examples/fonts/helvetiker_regular.typeface.json";

import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";

import {
  AppliedGate,
  Rotations,
  Ket0,
  vec2,
  PauliX,
  PauliY,
  PauliZ,
  SGate,
  TGate,
  Hadamard,
  numToStr,
  rotationMatrix,
  Ident,
} from "../src/cplx.js";

import rzOps from "./rz-array.json";

const colors = {
  sphereColor: 0x404080,
  sphereBrightness: 2,
  sphereOpacity: 0.5,
  directionalLightBrightness: 0.25,
  markerColor: 0xc00000,
  sphereLinesOpacity: 0.2,
};

const gateLaTeX = {
  X: "\\begin{bmatrix} 0 & 1 \\\\ 1 & 0 \\end{bmatrix}",
  Y: "\\begin{bmatrix} 0 & -i \\\\ i & 0 \\end{bmatrix}",
  Z: "\\begin{bmatrix} 1 & 0 \\\\ 0 & -1 \\end{bmatrix}",
  S: "\\begin{bmatrix} 1 & 0 \\\\ 0 & e^{i {\\pi \\over 2}} \\end{bmatrix}",
  SA: "\\begin{bmatrix} 1 & 0 \\\\ 0 & e^{-i {\\pi \\over 2}} \\end{bmatrix}",
  T: "\\begin{bmatrix} 1 & 0 \\\\ 0 & e^{i {\\pi \\over 4}} \\end{bmatrix}",
  TA: "\\begin{bmatrix} 1 & 0 \\\\ 0 & e^{-i {\\pi \\over 4}} \\end{bmatrix}",
  H: "{1 \\over \\sqrt{2}} \\begin{bmatrix} 1 & 1 \\\\ 1 & -1 \\end{bmatrix}",
  Rx: "\\begin{bmatrix} \\cos({\\theta \\over 2}) & -i \\sin({\\theta \\over 2}) \\\\ -i \\sin({\\theta \\over 2}) & \\cos({\\theta \\over 2}) \\end{bmatrix}",
  Ry: "\\begin{bmatrix} \\cos({\\theta \\over 2}) & - \\sin({\\theta \\over 2}) \\\\ \\sin({\\theta \\over 2}) & \\cos({\\theta \\over 2}) \\end{bmatrix}",
  Rz: "\\begin{bmatrix} \\exp({-i \\theta / 2}) & 0 \\\\ 0 & \\exp({i \\theta / 2}) \\end{bmatrix}",
};

// See https://gizma.com/easing/#easeInOutSine
function easeInOutSine(x: number) {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

function easeOutSine(x: number) {
  return Math.sin((x * Math.PI) / 2);
}

function hslToRgb(h: number, s: number, l: number) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }
  return (
    (Math.min(r * 255, 255) << 16) |
    (Math.min(g * 255, 255) << 8) |
    Math.min(b * 255, 255)
  );
}

function hueToRgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function createText(scene: Scene, done: () => void) {
  const loader = new FontLoader();
  const font = loader.parse(fontJson);

  const fontMat = new MeshBasicMaterial({ color: 0x606080, opacity: 1 });
  const fontProps = {
    font,
    size: 0.6,
    height: 0.01,
    bevelThickness: 0.075,
    bevelSize: 0.01,
    bevelEnabled: true,
  };
  const xGeo = new TextGeometry("x", fontProps);
  const yGeo = new TextGeometry("y", fontProps);
  const zGeo = new TextGeometry("z", fontProps);

  const xMesh = new Mesh(xGeo, fontMat);
  const yMesh = new Mesh(yGeo, fontMat);
  const zMesh = new Mesh(zGeo, fontMat);
  xGeo.computeBoundingBox();
  yGeo.computeBoundingBox();
  zGeo.computeBoundingBox();

  xMesh.position.set(
    -0.5 * (xGeo.boundingBox!.max.x - xGeo.boundingBox!.min.x),
    -0.5 * (xGeo.boundingBox!.max.y - xGeo.boundingBox!.min.y),
    6.4
  );
  yMesh.position.set(
    6.4,
    -0.5 * (xGeo.boundingBox!.max.y - xGeo.boundingBox!.min.y),
    0
  );

  zMesh.position.set(
    -0.5 * (zGeo.boundingBox!.max.x - zGeo.boundingBox!.min.x),
    6.4,
    0
  );
  scene.add(xMesh);
  scene.add(yMesh);
  scene.add(zMesh);
  done();
}

const rotationTimeMs = 100;

class BlochRenderer {
  // gui: GUI;
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  qubit: Group;
  trail: Group;
  rotationAxis: Group;
  animationCallbackId = 0;
  gateQueue: AppliedGate[] = [];
  rotations: Rotations;

  constructor(canvas: HTMLCanvasElement) {
    // Sample GUI controls. See https://lil-gui.georgealways.com/
    // this.gui = new GUI();
    // const guiControls = {
    //   rotationSpeed: 500,
    //   trailLength: 1.0,
    //   transparency: 0.2,
    //   sphereColor: "#404080",
    //   trailColor: "#663399",
    //   showAxes: true,
    //   showEvolutionAsMatrices: false,
    // };

    // this.gui.title("UI settings");

    // this.gui.add(guiControls, "rotationSpeed", 0, 1000).name("Rotation speed");
    // this.gui.add(guiControls, "trailLength", 0, 1.0).name("Trail length");
    // this.gui.add(guiControls, "transparency", 0, 1.0).name("Transparency");
    // this.gui.add(guiControls, "showAxes").name("Show axes");
    // this.gui
    //   .add(guiControls, "showEvolutionAsMatrices")
    //   .name("Evolve matrices");
    // this.gui.addColor(guiControls, "sphereColor").name("Sphere color");
    // this.gui.addColor(guiControls, "trailColor").name("Trail color");
    // this.gui.close();

    this.rotations = new Rotations(64);

    // For VS Code, WebView body attribute 'data-vscode-theme-kind' will contain 'light' if light theme is active.
    // Note: The value is usually 'vscode-light' or 'vscode-dark', but high-contrast dark is just 'vscode-high-contrast',
    // whereas the light high contract theme is 'vscode-high-contrast-light'.
    // Default to 'light' if the attribute is not present. (e.g. in the Playground)
    const isLight = (
      document.body.getAttribute("data-vscode-theme-kind") ?? "light"
    ).includes("light");

    const renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });

    window.addEventListener("resize", () => this.render());

    const scene = new Scene();
    const camera = new PerspectiveCamera(
      30, // fov
      1, // aspect
      0.1, // near
      1000 // far
    );

    // In WebGL, Z is towards the camera (viewer looking towards -Z), Y is up, X is right
    // Position slightly towards the X and Y axis to give a 'canonical' view
    camera.position.x = 4;
    camera.position.y = 4;
    camera.position.z = 27;
    camera.lookAt(0, 0, 0);

    const light = new DirectionalLight(
      0xffffff,
      colors.directionalLightBrightness
    );
    light.position.set(-1, 2, 4);
    scene.add(light);

    // Note that the orbit controls move the camera, they don't rotate the
    // scene, so the X, Y, and Z axis for the Bloch sphere remain fixed.
    const controls = new OrbitControls(camera, renderer.domElement);

    // Create a group to hold the qubit
    const qubit = new Group();

    // Add the main sphere
    const sphereGeometry = new SphereGeometry(5, 32, 16);
    const material = new MeshLambertMaterial({
      emissive: colors.sphereColor,
      emissiveIntensity: colors.sphereBrightness,
      transparent: true,
      opacity: colors.sphereOpacity,
    });
    const sphere = new Mesh(sphereGeometry, material);
    qubit.add(sphere);

    // Add the 'spin' direction marker
    const coneGeometry = new ConeGeometry(0.2, 0.75, 32);
    const coneMat = new MeshBasicMaterial({ color: colors.markerColor });
    const marker = new Mesh(coneGeometry, coneMat);
    marker.position.set(0, 5.125, 0.4);
    marker.rotateX(Math.PI / 2);
    qubit.add(marker);

    // Draw the wires on it
    const sphereWireGeometry = new SphereGeometry(5.1, 16, 16);
    const wireframe = new WireframeGeometry(sphereWireGeometry);
    const sphereLines = new LineSegments(wireframe);
    const materialProps = sphereLines.material as MeshBasicMaterialParameters;
    materialProps.depthTest = true;
    materialProps.opacity = colors.sphereLinesOpacity;
    materialProps.transparent = true;
    qubit.add(sphereLines);
    scene.add(qubit);

    // Create a group to hold the trailing points
    const trail = new Group();
    scene.add(trail);

    // Add the axes
    const axisMaterial = new MeshBasicMaterial({ color: 0xe0d0c0 });
    const zAxis = new CylinderGeometry(0.075, 0.075, 12, 32, 8);
    const zAxisMesh = new Mesh(zAxis, axisMaterial);
    scene.add(zAxisMesh);

    const zPointer = new ConeGeometry(0.2, 0.8, 16);
    const zPointerMesh = new Mesh(zPointer, axisMaterial);
    zPointerMesh.position.set(0, 6, 0);
    scene.add(zPointerMesh);

    const yAxisMesh = new Mesh(zAxis, axisMaterial);
    yAxisMesh.rotateZ(Math.PI / 2);
    scene.add(yAxisMesh);
    const yPointerMesh = new Mesh(zPointer, axisMaterial);
    yPointerMesh.position.set(6, 0, 0);
    yPointerMesh.rotateZ(-Math.PI / 2);
    scene.add(yPointerMesh);

    const xAxisMesh = new Mesh(zAxis, axisMaterial);
    xAxisMesh.rotateX(Math.PI / 2);
    scene.add(xAxisMesh);
    const xPointerMesh = new Mesh(zPointer, axisMaterial);
    xPointerMesh.position.set(0, 0, 6);
    xPointerMesh.rotateX(Math.PI / 2);
    scene.add(xPointerMesh);

    const rotationAxis = new Group();
    const rotationAxisMaterial = new MeshLambertMaterial({
      emissive: 0x808080,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.75,
    });
    const axisBox = new BoxGeometry(0.33, 0.33, 12.5);
    const axisBoxMesh = new Mesh(axisBox, rotationAxisMaterial);
    rotationAxis.add(axisBoxMesh);

    const fins = [
      [2, 0.25, 0.25, 0, 0, 5.75],
      [0.25, 2, 0.25, 0, 0, 5.75],
      [2, 0.25, 0.25, 0, 0, -5.75],
      [0.25, 0.25, 2, 0, 0, -5.75],
    ];

    fins.forEach((fin) => {
      const finBox = new BoxGeometry(fin[0], fin[1], fin[2]);
      const finBoxMesh = new Mesh(finBox, rotationAxisMaterial);
      finBoxMesh.position.set(fin[3], fin[4], fin[5]);
      rotationAxis.add(finBoxMesh);
    });

    this.rotationAxis = rotationAxis;

    // See https://threejs.org/manual/#en/rendering-on-demand
    controls.addEventListener("change", () =>
      requestAnimationFrame(() => this.render())
    );

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.qubit = qubit;
    this.trail = trail;

    // Initial render after text is ready
    createText(scene, () => this.render());
  }

  queueGate(gate: AppliedGate) {
    this.gateQueue.push(gate);
    if (this.animationCallbackId) return; // Queue is already running

    // Close over these values for the running queue
    let currentGate: AppliedGate | undefined;
    let startTime = 0;

    const processQueue = () => {
      if (!currentGate) {
        currentGate = this.gateQueue.shift();
        if (!currentGate) {
          // Queue was empty. Done
          this.animationCallbackId = 0;
          return;
        } else {
          const axisInLocal = this.qubit.worldToLocal(currentGate.axis);
          this.rotationAxis.lookAt(axisInLocal);
          this.qubit.add(this.rotationAxis);
          startTime = performance.now();
        }
      }

      // Calculate the percent of rotation time elapsed from start to now
      const x = (performance.now() - startTime) / rotationTimeMs;

      // Ease the rotation
      const t = x < 1 ? easeInOutSine(x) : 1;

      // Rotate the qubit to the correct position
      const currentRotation = this.rotations.getRotationAtPercent(
        currentGate,
        t
      );

      currentRotation.path.forEach((val) => {
        // Draw any that don't already have a point
        if (val.ref) return;
        const trackGeo = new SphereGeometry(0.05, 16, 16);
        const trackBall = new Mesh(
          trackGeo,
          new MeshBasicMaterial({ color: 0x808080 })
        );
        trackBall.position.set(0, 5, 0);

        // Conver to world space
        trackBall.position.applyQuaternion(val.pos);

        // Save along with the interpolation point
        this.trail.add(trackBall);
        val.ref = trackBall;
      });

      // Set qubit position to slerped values
      this.qubit.quaternion.copy(currentRotation.pos);

      // Fade out the path trail as needed
      this.trail.children.forEach((child, idx, arr) => {
        const ball = child as Mesh;
        const sat = easeOutSine((idx + 1) / arr.length);
        const color = hslToRgb(0.6, sat, 0.5);
        ball.material = new MeshBasicMaterial({ color });
        ball.scale.setScalar(sat + 0.5);
      });

      this.render();

      // If that gate is done, unset it
      if (t >= 1) {
        currentGate = undefined;
        this.qubit.remove(this.rotationAxis);
        this.render();
      }

      this.animationCallbackId = requestAnimationFrame(processQueue);
    };

    // Kick off processing
    processQueue();
  }

  rotateX(angle: number) {
    this.queueGate(this.rotations.rotateX(angle));
  }

  rotateY(angle: number) {
    this.queueGate(this.rotations.rotateY(angle));
  }

  rotateZ(angle: number) {
    this.queueGate(this.rotations.rotateZ(angle));
  }

  rotateH(angle: number) {
    this.queueGate(this.rotations.rotateH(angle));
  }

  reset() {
    this.controls.reset();
    this.rotations.reset();
    this.trail.clear();
    this.scene.position.set(0, 0, 0);
    this.qubit.rotation.set(0, 0, 0);
    this.camera.position.set(4, 4, 27);
    this.camera.lookAt(0, 0, 0);
    this.render();
  }

  resizeRendererToDisplaySize() {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      this.renderer.setSize(width, height, false);
    }
    return needResize;
  }

  render() {
    if (this.resizeRendererToDisplaySize()) {
      const canvas = this.renderer.domElement;
      this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
      this.camera.updateProjectionMatrix();
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

export function BlochSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<BlochRenderer | null>(null);

  const [gateArray, setGateArray] = useState<string[]>([]);
  const [state, setState] = useState(Ket0);
  const [rAngles, setRAngles] = useState({"rx": "0.0", "ry": "0.0", "rz": "0.0"});
  const [rzSynth, setRzSynth] = useState(false);
  const [gateList, setGateList] = useState("");
  const [mathOpen, setMathOpen] = useState(false);

  let newState = state;

  useEffect(() => {
    if (canvasRef.current) {
      renderer.current = new BlochRenderer(canvasRef.current);
    }
  }, []);

  const getLaTeX = (
    gateName: string,
    gateMatrix: string,
    oldState: string,
    newState: string
  ) => `${gateName} | \\psi \\rangle_{${gateArray.length}} =
  ${gateMatrix}
  \\cdot ${oldState}
  = ${newState}`;

  function rotate(gate: string, angle = 0): void {
    const priorState = vec2(newState);
    if (renderer.current) {
      switch (gate) {
        case "X":
          renderer.current.rotateX(Math.PI);
          newState = PauliX.mulVec2(newState);
          gateArray.push(
            getLaTeX("X", gateLaTeX.X, priorState.toLaTeX(), newState.toLaTeX())
          );
          break;
        case "Y":
          renderer.current.rotateY(Math.PI);
          newState = PauliY.mulVec2(newState);
          gateArray.push(
            getLaTeX("Y", gateLaTeX.Y, priorState.toLaTeX(), newState.toLaTeX())
          );
          break;
        case "Z":
          renderer.current.rotateZ(Math.PI);
          newState = PauliZ.mulVec2(newState);
          gateArray.push(
            getLaTeX("Z", gateLaTeX.Z, priorState.toLaTeX(), newState.toLaTeX())
          );
          break;
        case "S":
          renderer.current.rotateZ(Math.PI / 2);
          newState = SGate.mulVec2(newState);
          gateArray.push(
            getLaTeX("S", gateLaTeX.S, priorState.toLaTeX(), newState.toLaTeX())
          );
          break;
        case "s":
          renderer.current.rotateZ(-Math.PI / 2);
          newState = SGate.adjoint().mulVec2(newState);
          gateArray.push(
            getLaTeX(
              "S†",
              gateLaTeX.SA,
              priorState.toLaTeX(),
              newState.toLaTeX()
            )
          );
          break;
        case "T":
          renderer.current.rotateZ(Math.PI / 4);
          newState = TGate.mulVec2(newState);
          gateArray.push(
            getLaTeX("T", gateLaTeX.T, priorState.toLaTeX(), newState.toLaTeX())
          );
          break;
        case "t":
          renderer.current.rotateZ(-Math.PI / 4);
          newState = TGate.adjoint().mulVec2(newState);
          gateArray.push(
            getLaTeX(
              "T†",
              gateLaTeX.TA,
              priorState.toLaTeX(),
              newState.toLaTeX()
            )
          );
          break;
        case "H":
          renderer.current.rotateH(Math.PI);
          newState = Hadamard.mulVec2(newState);
          gateArray.push(
            getLaTeX("H", gateLaTeX.H, priorState.toLaTeX(), newState.toLaTeX())
          );
          break;
        case "Rx":
          renderer.current.rotateX(angle);
          const rxMat = rotationMatrix('X', angle);
          newState = rxMat.mulVec2(newState);
          gateArray.push(
            getLaTeX(
              `Rx(${numToStr(angle)})`,
              rxMat.toLaTeX(),
              priorState.toLaTeX(),
              newState.toLaTeX()
            )
          );
          break;
        case "Ry":
          renderer.current.rotateY(angle);
          const ryMat = rotationMatrix('Y', angle);
          newState = ryMat.mulVec2(newState);
          gateArray.push(
            getLaTeX(
              `Ry(${numToStr(angle)})`,
              ryMat.toLaTeX(),
              priorState.toLaTeX(),
              newState.toLaTeX()
            )
          );
          break;
        case "Rz":
          renderer.current.rotateZ(angle);
          const rzMat = rotationMatrix('Z', angle);
          newState = rzMat.mulVec2(newState);
          gateArray.push(
            getLaTeX(
              `Rz(${numToStr(angle)})`,
              rzMat.toLaTeX(),
              priorState.toLaTeX(),
              newState.toLaTeX()
            )
          );
          break;
        default:
          console.error("Unknown gate: " + gate);
      }
    }
    setState(newState);
    setGateArray([...gateArray]);
  }

  function onRotationGate(gate: string, target: EventTarget | null) {
    let angle = 0;
    if (!target) throw "No target element";
    const input = (target as HTMLElement).nextElementSibling as HTMLInputElement;
    angle = parseFloat(input.value);

    if (rzSynth && gate === "Rz") {
      const angleIdx = Math.round(angle * 200) % 1256;
      const input = document.getElementById("gate_sequence") as HTMLTextAreaElement;
      input.value = rzOps[angleIdx];
      setGateList(input.value);
    } else {
      rotate(gate, angle);
    }
  }

  function reset() {
    setGateArray([]);
    setState(vec2(Ket0));
    setRAngles({"rx": "0.0", "ry": "0.0", "rz": "0.0"});
    setRzSynth(false);
    setGateList("");
    if (renderer.current) {
      renderer.current.reset();
    }
  }

  function applyGates(e: Event) {
    const input = document.getElementById("gate_sequence") as HTMLTextAreaElement;
    const text = input.value;
    // TODO: Handle "Rz(0.5)" type input, and "Ta" or "Sa" for "t" and "s".
    // Also, strip out any whitespace, commas, etc.
    for (const gate of text) {
      rotate(gate);
    }
  }

  function changeRzSynth(e: Event) {
    e.preventDefault();
    setRzSynth((e.target as HTMLInputElement).checked);
  }

  function onRChange(gate: string, e: Event) {
    e.preventDefault();
    const input = e.target as HTMLInputElement;
    const value = input.value;
    setRAngles({...rAngles, [gate]: value});
    showUnitary(e);
  }

  const mathListClass = mathOpen ? "math-list" : "math-list collapsed";

  function onCollapse() {
    setMathOpen(!mathOpen);
  }

  function showUnitary(e: Event) {
    const unitaryDiv = document.querySelector(".unitary-matrix") as HTMLDivElement;
    const unitaryContainer = unitaryDiv.parentElement! 
  
    // Deal with the case when hovering over a button for a gate
    const unitary = (e.target as HTMLElement)?.dataset?.["unitary"];
    if (unitary) {
      unitaryDiv.innerHTML = katex.renderToString((gateLaTeX as any)[unitary]);
      unitaryContainer.style.display = "block";
      return;
    }
    // Deal with the case when focused on an input for a rotation
    const angle = (e.target as HTMLElement)?.dataset?.["angle"];
    if (angle) {
      const input = e.target as HTMLInputElement;
      const value = parseFloat(input.value);
      if (typeof value === "number" && !isNaN(value)) {
        const matrix =
          angle === "rx"
            ? rotationMatrix("X", value)
            : angle === "ry"
            ? rotationMatrix("Y", value)
            : angle === "rz"
            ? rotationMatrix("Z", value)
            : undefined;
        if (matrix) {
          unitaryDiv.innerHTML = katex.renderToString(matrix.toLaTeX());
          unitaryContainer.style.display = "block";
          return;
        }
      }
    }
    // Deal with updates to the gate sequence textarea
    if ((e.target as HTMLElement).id === "gate_sequence") {
      const gates = (e.target as HTMLTextAreaElement).value;
      if (gates) {
        let mat = Ident;
        for(let i = 0; i < gates.length; i++) {
          switch(gates[i]) {
            case "X":
              mat = PauliX.mul(mat);
              break;
            case "Y":
              mat = PauliY.mul(mat);
              break;
            case "Z":
              mat = PauliZ.mul(mat);
              break;
            case "H":
              mat = Hadamard.mul(mat);
              break;
            case "S":
              mat = SGate.mul(mat);
              break;
            case "s":
              mat = SGate.adjoint().mul(mat);
              break;
            case "T":
              mat = TGate.mul(mat);
              break;
            case "t":
              mat = TGate.adjoint().mul(mat);
              break;
            default:
              // Skip anything unrecognized
          }
        }
        unitaryDiv.innerHTML = katex.renderToString(mat.toLaTeX());
        unitaryContainer.style.display = "block";
        return;
      }
    }
    // If we got here, we didn't find something to display, so just ensure it is hidden
    hideUnitary(e);
  }

  function hideUnitary(e: Event) {
    const unitaryDiv = document.querySelector(".unitary-matrix-help") as HTMLDivElement;
    unitaryDiv.style.display = "none";
  }

  function onRotationInput(e: Event) {
    const angle = (e.target as HTMLElement)?.dataset?.["angle"];
    if (angle) onRChange(angle, e);
    showUnitary(e);
  }

  function onGateInput(e: Event) {
    setGateList((e.target as HTMLTextAreaElement).value)
    showUnitary(e);
  }

  return (
    <div style="position: relative;">
      <canvas ref={canvasRef} id="sphereCanvas"></canvas>
      <div class='left-controls' onMouseOver={showUnitary} onMouseOut={hideUnitary} onFocusIn={showUnitary} onFocusOut={hideUnitary}>
        <div class="controls-heading">Unitary gates</div>
        <div class="gate-buttons">
          <button type="button" data-unitary="X" onClick={() => rotate("X")}>X</button>
          <button type="button" data-unitary="Y" onClick={() => rotate("Y")}>Y</button>
          <button type="button" data-unitary="Z" onClick={() => rotate("Z")}>Z</button>
          <button type="button" data-unitary="H" onClick={() => rotate("H")}>H</button>
        </div>
        <div class="gate-buttons">
          <button type="button"  data-unitary="S" onClick={() => rotate("S")}>S</button>
          <button type="button"  data-unitary="SA" onClick={() => rotate("s")}>S†</button>
          <button type="button" data-unitary="T" onClick={() => rotate("T")}>T</button>
          <button type="button" data-unitary="TA" onClick={() => rotate("t")}>T†</button>
        </div>
        <div class="gate-buttons">
          <button type="button" data-unitary="Rx" onClick={(e) => onRotationGate("Rx", e.target)}>Rx</button>
          <input type="number" data-angle="rx" min={0} max={Math.PI * 2} step={0.1} size={4} value={rAngles.rx} onInput={onRotationInput} />
        </div>
        <div class="gate-buttons">
          <button type="button" data-unitary="Ry" onClick={(e) => onRotationGate("Ry", e.target)}>Ry</button>
          <input type="number" data-angle="ry" min={0} max={Math.PI * 2} step={0.1} size={4} value={rAngles.ry} onInput={onRotationInput} />
        </div>
        <div class="gate-buttons">
          <button type="button" data-unitary="Rz" onClick={(e) => onRotationGate("Rz", e.target)}>Rz</button>
          <input type="number" data-angle="rz" min={0} max={Math.PI * 2} step={0.1} size={4} value={rAngles.rz} onInput={onRotationInput} />
        </div>
          <label>
            Synthesize Rz gate
            <input type="checkbox" checked={rzSynth} onChange={changeRzSynth} />
          </label>
        <div class="controls-heading">
          <span>Gate sequence</span>
          <a href="#help" onClick={() => (document.querySelector('.help-box') as HTMLDivElement).style.display = 'block'} style="font-size: 0.75em; outline: none;">(help)</a>
        </div>
        <textarea id="gate_sequence" rows={3} cols={16} placeholder={"Enter some gates"} value={gateList} onInput={onGateInput} />
        <button type="button" onClick={applyGates}>Run</button>
        <button type="button" onClick={reset}>Reset</button>
      </div>
      <div class="unitary-matrix-help">
        <div class="unitary-matrix-header">Unitary matrix</div>
        <div class="unitary-matrix"></div>
      </div>
      <div class={mathListClass}>
        {gateArray.map((str) => (
          <div class="math-list-entry">
            <div
              dangerouslySetInnerHTML={{ __html: katex.renderToString(str) }}
            ></div>
          </div>
        ))}
      </div>
      <div class="math-collapse" onClick={onCollapse}>{mathOpen ? "Collapse evolution" : "Show evolution"}</div>
      <div class='help-box' onClick={e => (e.currentTarget as HTMLDivElement).style.display = 'none'}>
        <p>Enter gates into the text area then click 'Run' to apply them. They are applied sequentially in the order given.</p>
        <p>Valid gates are X, Y, Z, H, S, T. Use lowercase for adjoint 's' or 't'. For example, 'THt' would apply a T gate, a Hadamard gate, then a T-adjoint gate.</p>
        <p>Gates may be separated by whitespace or commas, or have no separation.</p>
        <p>Click on this help box to close it.</p>
      </div>
    </div>
  );
}
