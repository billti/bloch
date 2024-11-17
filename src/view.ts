// Copyright (c) Bill Ticehurst
// Licensed under the MIT License

import "./view.css";

import { h, render } from "preact"
import {BlochSphere} from "./bloch"

render(h(BlochSphere, null), document.body);
