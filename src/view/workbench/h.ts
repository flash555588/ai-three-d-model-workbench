import htm from "htm";
import { createElement } from "./dom";

export const html = htm.bind(createElement);
