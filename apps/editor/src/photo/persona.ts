import { setLiveBitmap } from '@poulpe/render';
import { ui, type Persona, type ToolId } from '../store';
import { isPhotoTool } from './photoTools';

export { openPhoto } from '../io';

/** Outils communs à toutes les Personas. */
const SHARED: ToolId[] = ['select', 'text', 'eyedropper', 'hand', 'zoom'];

/** Passe d'une Persona à l'autre ; l'outil suit s'il n'existe pas dans la nouvelle. */
export function setPersona(persona: Persona): void {
  const { tool } = ui.get();
  if (ui.get().persona === persona) return;
  let next = tool;
  if (persona === 'photo' && !SHARED.includes(tool) && !isPhotoTool(tool)) next = 'brush';
  if (persona !== 'photo' && isPhotoTool(tool)) next = 'select';
  if (next !== tool) window.dispatchEvent(new Event('poulpe:toolchange'));
  ui.set({
    persona,
    tool: next,
    maskEditId: null,
    editingTextId: null,
    cropId: null,
    nodeSelection: [],
    linkFrom: null,
  });
}

export { setLiveBitmap };
