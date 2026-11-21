import { useControls, folder, Leva } from 'leva';
import { isChineseLanguage, isUzbekLanguage } from './utils';
import { LevaVectorNew } from './components/LevaVectorNew/LevaVectorNew';
import { LevaContainer } from './components/LevaContainer/LevaContainer';
import { LevaCheckButtons } from './components/LevaCheckButtons';
import { useMemo, useState } from 'react';
import { readControlFolderState, useControlFolders } from './utils/controlFolders';
import languages from './utils/languages';

export const useLevaControls = ({
  containerRender,
  rendererOptions,
}: {
  containerRender: {
    bgType: (props: { value: number; setValue: (v: number) => void }) => React.ReactNode;
  };
  rendererOptions?: {
    webgpuSupported: boolean;
    webgpuUnavailableReason?: string;
    onRendererChange?: (backend: 'webgl' | 'webgpu') => void;
  };
}) => {
  const [langName, setLangName] = useState<keyof typeof languages>(
    isChineseLanguage() ? 'zh-CN' : isUzbekLanguage() ? 'uz-UZ' : 'en-US',
  );
  const lang = useMemo(() => {
    return languages[langName];
  }, [langName]);

  const [folderState] = useState(readControlFolderState);

  const [controls, controlsAPI] = useControls(
    () => ({
      basicSettings: folder({
        renderer: LevaCheckButtons({
          label: lang['editor.renderer'],
          selected: ['webgl'],
          options: [
            { value: 'webgl', label: 'WebGL' },
            {
              value: 'webgpu',
              label: 'WebGPU',
              disabled: !rendererOptions?.webgpuSupported,
              title: !rendererOptions?.webgpuSupported
                ? (rendererOptions?.webgpuUnavailableReason || lang['editor.rendererWebGPUUnavailable'])
                : undefined,
            },
          ],
          singleMode: true,
          onClick: (v) => {
            rendererOptions?.onRendererChange?.(v[0] as 'webgl' | 'webgpu');
          },
        }),
        language: {
          label: lang['editor.language'],
          value: langName,
          options: {
            '简体中文': 'zh-CN',
            English: 'en-US',
            "O'zbekcha": 'uz-UZ',
          },
          transient: false,
          onChange: (value: keyof typeof languages) => {
            setLangName(value);
          },
        },
        showCursor: {
          label: lang['editor.showCursor'],
          value: false,
        },
      }, { collapsed: folderState.basicSettings }),
      backgroundSettings: folder({
        bgType: LevaContainer({
          label: lang['editor.bgType'],
          showLabel: false,
          contentValue: 0,
          content: containerRender.bgType,
        }),
      }, { collapsed: folderState.backgroundSettings }),
      shapeSettings: folder({
        shapeWidth: {
          label: lang['editor.shapeWidth'],
          min: 20,
          max: 800,
          step: 1,
          value: 200,
        },
        shapeHeight: {
          label: lang['editor.shapeHeight'],
          min: 20,
          max: 800,
          step: 1,
          value: 200,
        },
        shapeRadius: {
          label: lang['editor.shapeRadius'],
          min: 1,
          max: 100,
          step: 0.1,
          value: 50,
        },
        shapeSmoothing: {
          label: lang['editor.shapeSmoothing'],
          min: 0,
          max: 100,
          step: 1,
          value: 100,
        },
        showShape1: {
          label: lang['editor.showShape1'],
          value: true,
        },
        mergeRate: {
          label: lang['editor.mergeRate'],
          min: 0,
          max: 0.3,
          step: 0.01,
          value: 0.05,
        },
        springSizeFactor: {
          label: <span title={lang['editor.springSizeHint']}>{lang['editor.springSizeFactor']}</span>,
          min: 0,
          max: 50,
          step: 0.01,
          value: 10,
        },
      }, { collapsed: folderState.shapeSettings }),
      materialSettings: folder({
        refThickness: {
          label: lang['editor.refThickness'],
          min: 1,
          max: 80,
          step: 0.01,
          value: 20,
        },
        refDistance: {
          label: lang['editor.refDistance'],
          min: 0,
          max: 0.2,
          step: 0.001,
          value: 0.05,
        },
        refFactor: {
          label: <span title={lang['editor.refFactorHint']}>{lang['editor.refFactor']}</span>,
          min: 1,
          max: 4,
          step: 0.01,
          value: 1.4,
        },
        refDispersion: {
          label: lang['editor.refDispersion'],
          min: 0,
          max: 50,
          step: 0.01,
          value: 7,
        },
        tint: {
          label: lang['editor.tint'],
          value: { r: 255, b: 255, g: 255, a: 0 },
        },
        blurRadius: {
          label: lang['editor.blurRadius'],
          min: 1,
          max: 200,
          step: 1,
          value: 1,
        },
        blurEdge: {
          label: lang['editor.blurEdge'],
          value: true,
        },
      }, { collapsed: folderState.materialSettings }),
      lightingSettings: folder({
        glareAngle: {
          label: lang['editor.glareAngle'],
          min: -180,
          max: 180,
          step: 0.01,
          value: 0,
        },
        glareFactor: {
          label: lang['editor.glareFactor'],
          min: 0,
          max: 120,
          step: 0.01,
          value: 90,
        },
        glareRange: {
          label: lang['editor.glareRange'],
          min: 0,
          max: 100,
          step: 0.01,
          value: 30,
        },
        glareHardness: {
          label: lang['editor.glareHardness'],
          min: 0,
          max: 100,
          step: 0.01,
          value: 20,
        },
        glareConvergence: {
          label: lang['editor.glareConvergence'],
          min: 0,
          max: 100,
          step: 0.01,
          value: 50,
        },
        glareOppositeFactor: {
          label: <span title={lang['editor.glareOppositeHint']}>{lang['editor.glareOppositeFactor']}</span>,
          min: 0,
          max: 100,
          step: 0.01,
          value: 80,
        },
      }, { collapsed: folderState.lightingSettings }),
      reflectionSettings: folder({
        refFresnelFactor: {
          label: <span title={lang['editor.refFresnelHint']}>{lang['editor.refFresnelFactor']}</span>,
          min: 0,
          max: 100,
          step: 0.01,
          value: 20,
        },
        refFresnelRange: {
          label: <span title={lang['editor.refFresnelHint']}>{lang['editor.refFresnelRange']}</span>,
          min: 0,
          max: 100,
          step: 0.01,
          value: 30,
        },
        refFresnelHardness: {
          label: <span title={lang['editor.refFresnelHint']}>{lang['editor.refFresnelHardness']}</span>,
          min: 0,
          max: 100,
          step: 0.01,
          value: 20,
        },
      }, { collapsed: folderState.reflectionSettings }),
      darkEdgeSettings: folder({
        darkEdgeFactor: {
          label: lang['editor.darkEdgeFactor'],
          min: 0,
          max: 100,
          step: 1,
          value: 60,
        },
        darkEdgeWidth: {
          label: lang['editor.darkEdgeWidth'],
          min: 0,
          max: 10,
          step: 0.1,
          value: 1,
        },
        darkEdgeRange: {
          label: lang['editor.darkEdgeRange'],
          min: 0,
          max: 100,
          step: 1,
          value: 75,
        },
        darkEdgeFade: {
          label: lang['editor.darkEdgeFade'],
          min: 0,
          max: 100,
          step: 1,
          value: 67,
        },
        darkEdgeSoftness: {
          label: lang['editor.darkEdgeSoftness'],
          min: 0,
          max: 5,
          step: 0.1,
          value: 0,
        },
        darkEdgeLighting: {
          render: () => false,
          label: <span title={lang['editor.darkEdgeLightingHint']}>{lang['editor.darkEdgeLighting']}</span>,
          min: 0,
          max: 100,
          step: 1,
          value: 25,
        },
      }, { collapsed: folderState.darkEdgeSettings }),
      shadowSettings: folder({
        shadowFactor: {
          label: lang['editor.shadowFactor'],
          min: 0,
          max: 100,
          step: 0.01,
          value: 15,
        },
        shadowExpand: {
          label: lang['editor.shadowExpand'],
          min: 2,
          max: 100,
          step: 0.01,
          value: 25,
        },
        shadowPosition: LevaVectorNew({
          label: lang['editor.shadowPosition'],
          x: 0,
          y: -10,
          xMax: 20,
          yMax: 20,
        }),
      }, { collapsed: folderState.shadowSettings }),
      debugSettings: folder({
        step: {
          label: lang['editor.step'],
          value: 9,
          min: 0,
          max: 9,
          step: 1,
        },
      }, { collapsed: folderState.debugSettings }),
    }),
    [langName, rendererOptions?.webgpuSupported],
  );

  useControlFolders(lang, folderState);

  const levaGlobal = (
    <Leva
      theme={{
        sizes: {
          rootWidth: lang['_settings'].rootWidth,
          numberInputMinWidth: lang['_settings'].numberInputMinWidth,
          controlWidth: lang['_settings'].controlWidth,
        },
        space: {
          colGap: '5px',
        },
      }}
    ></Leva>
  );

  return {
    controls,
    controlsAPI,
    lang,
    langName,
    levaGlobal,
  };
};
