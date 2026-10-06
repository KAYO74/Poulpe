/* Textes de la gestion avancée des calques (ordre, glisser-déposer, menu contextuel). */

export const frLayers = {
  'menu.order': 'Ordre',
  'layer.selectAbove': 'Sélectionner le calque au-dessus',
  'layer.selectBelow': 'Sélectionner le calque en dessous',
  'layers.dragCount': '{n} calques',
  'layers.dropInto': 'Dans « {name} »',
};

export type MessageKeyLayers = keyof typeof frLayers;

export const enLayers: Record<MessageKeyLayers, string> = {
  'menu.order': 'Order',
  'layer.selectAbove': 'Select Layer Above',
  'layer.selectBelow': 'Select Layer Below',
  'layers.dragCount': '{n} layers',
  'layers.dropInto': 'Into “{name}”',
};
