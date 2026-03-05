import { type useLevaControls } from '../Controls';

export type ControlValues = ReturnType<typeof useLevaControls>['controls'];

export interface PresetData {
  version: string;
  timestamp: string;
  controls: ControlValues;
}

/**
 * Partial control values used by built-in presets.
 * Only glass-related controls are included (no shape/animation/debug settings).
 */
export type GlassPresetValues = Pick<
  ControlValues,
  | 'refThickness'
  | 'refFactor'
  | 'refDispersion'
  | 'refFresnelRange'
  | 'refFresnelHardness'
  | 'refFresnelFactor'
  | 'glareRange'
  | 'glareHardness'
  | 'glareFactor'
  | 'glareConvergence'
  | 'glareOppositeFactor'
  | 'glareAngle'
  | 'blurRadius'
  | 'blurEdge'
  | 'tint'
  | 'shadowExpand'
  | 'shadowFactor'
>;

export interface BuiltInPreset {
  id: string;
  values: GlassPresetValues;
}

export const BUILT_IN_PRESETS: BuiltInPreset[] = [
  {
    id: 'crystalClear',
    values: {
      refThickness: 25,
      refFactor: 1.52,
      refDispersion: 3,
      refFresnelRange: 35,
      refFresnelHardness: 30,
      refFresnelFactor: 25,
      glareRange: 40,
      glareHardness: 45,
      glareFactor: 100,
      glareConvergence: 60,
      glareOppositeFactor: 70,
      glareAngle: -45,
      blurRadius: 1,
      blurEdge: true,
      tint: { r: 255, g: 255, b: 255, a: 0 },
      shadowExpand: 25,
      shadowFactor: 15,
    },
  },
  {
    id: 'frostedGlass',
    values: {
      refThickness: 12,
      refFactor: 1.1,
      refDispersion: 2,
      refFresnelRange: 20,
      refFresnelHardness: 10,
      refFresnelFactor: 15,
      glareRange: 50,
      glareHardness: 8,
      glareFactor: 40,
      glareConvergence: 30,
      glareOppositeFactor: 40,
      glareAngle: -45,
      blurRadius: 45,
      blurEdge: true,
      tint: { r: 240, g: 245, b: 255, a: 0.05 },
      shadowExpand: 30,
      shadowFactor: 10,
    },
  },
  {
    id: 'tintedWindow',
    values: {
      refThickness: 18,
      refFactor: 1.35,
      refDispersion: 4,
      refFresnelRange: 28,
      refFresnelHardness: 18,
      refFresnelFactor: 22,
      glareRange: 35,
      glareHardness: 25,
      glareFactor: 70,
      glareConvergence: 45,
      glareOppositeFactor: 60,
      glareAngle: -30,
      blurRadius: 2,
      blurEdge: true,
      tint: { r: 80, g: 160, b: 220, a: 0.2 },
      shadowExpand: 28,
      shadowFactor: 18,
    },
  },
  {
    id: 'diamond',
    values: {
      refThickness: 35,
      refFactor: 2.42,
      refDispersion: 38,
      refFresnelRange: 50,
      refFresnelHardness: 55,
      refFresnelFactor: 45,
      glareRange: 55,
      glareHardness: 70,
      glareFactor: 120,
      glareConvergence: 75,
      glareOppositeFactor: 90,
      glareAngle: -45,
      blurRadius: 1,
      blurEdge: false,
      tint: { r: 255, g: 255, b: 255, a: 0 },
      shadowExpand: 20,
      shadowFactor: 12,
    },
  },
  {
    id: 'waterDrop',
    values: {
      refThickness: 15,
      refFactor: 1.33,
      refDispersion: 5,
      refFresnelRange: 40,
      refFresnelHardness: 12,
      refFresnelFactor: 18,
      glareRange: 45,
      glareHardness: 15,
      glareFactor: 80,
      glareConvergence: 40,
      glareOppositeFactor: 50,
      glareAngle: -50,
      blurRadius: 1,
      blurEdge: true,
      tint: { r: 220, g: 240, b: 255, a: 0.03 },
      shadowExpand: 22,
      shadowFactor: 8,
    },
  },
  {
    id: 'soapBubble',
    values: {
      refThickness: 3,
      refFactor: 1.3,
      refDispersion: 45,
      refFresnelRange: 80,
      refFresnelHardness: 15,
      refFresnelFactor: 60,
      glareRange: 60,
      glareHardness: 10,
      glareFactor: 65,
      glareConvergence: 35,
      glareOppositeFactor: 85,
      glareAngle: -40,
      blurRadius: 1,
      blurEdge: true,
      tint: { r: 200, g: 220, b: 255, a: 0.05 },
      shadowExpand: 15,
      shadowFactor: 5,
    },
  },
  {
    id: 'ice',
    values: {
      refThickness: 22,
      refFactor: 1.31,
      refDispersion: 8,
      refFresnelRange: 35,
      refFresnelHardness: 40,
      refFresnelFactor: 30,
      glareRange: 38,
      glareHardness: 55,
      glareFactor: 95,
      glareConvergence: 55,
      glareOppositeFactor: 65,
      glareAngle: -35,
      blurRadius: 12,
      blurEdge: true,
      tint: { r: 170, g: 210, b: 255, a: 0.15 },
      shadowExpand: 30,
      shadowFactor: 20,
    },
  },
  {
    id: 'obsidian',
    values: {
      refThickness: 40,
      refFactor: 1.5,
      refDispersion: 6,
      refFresnelRange: 60,
      refFresnelHardness: 50,
      refFresnelFactor: 70,
      glareRange: 30,
      glareHardness: 60,
      glareFactor: 85,
      glareConvergence: 65,
      glareOppositeFactor: 40,
      glareAngle: -45,
      blurRadius: 3,
      blurEdge: false,
      tint: { r: 20, g: 20, b: 30, a: 0.55 },
      shadowExpand: 35,
      shadowFactor: 40,
    },
  },
];

export function exportPreset(
  controls: ReturnType<typeof useLevaControls>['controls'],
  filename: string = 'liquid-glass-preset.json',
): void {
  const preset: PresetData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    controls: structuredClone(controls),
  };

  const jsonStr = JSON.stringify(preset, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function importPreset(file: File): Promise<PresetData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const preset = JSON.parse(content) as PresetData;

        if (!preset.version || !preset.controls) {
          reject(new Error('Invalid preset file format'));
          return;
        }

        resolve(preset);
      } catch (err) {
        reject(new Error(`Failed to parse preset file: ${err}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
